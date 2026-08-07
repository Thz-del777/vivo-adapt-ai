import logging
import base64
import binascii
import json
from typing import Any

import httpx

from app.core.config import Settings
from app.models.schemas import AvaliacaoInicial, AuthSessionResponse, AuthUserResponse, SignUpResponse
from app.repositories.supabase_cliente_repository import SupabaseClienteRepository
from app.repositories.supabase_notificacao_repository import SupabaseNotificacaoRepository
from app.repositories.supabase_sessao_repository import SupabaseSessaoRepository
from app.services.onboarding_service import definir_ild_inicial
from app.services.password_security_service import PasswordSecurityService


logger = logging.getLogger(__name__)


class AuthService:
    """Encapsula Supabase Auth sem registrar senhas ou tokens em logs."""

    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_key:
            raise RuntimeError("Supabase Auth nao esta configurado")

        from supabase import create_client

        self.settings = settings
        self.client = create_client(settings.supabase_url, settings.supabase_key)

    def _user_response(self, user: Any) -> AuthUserResponse:
        app_metadata = getattr(user, "app_metadata", None) or {}
        email = getattr(user, "email", None)
        papel = (
            "funcionario"
            if app_metadata.get("papel") == "funcionario"
            or (email and email.lower() in self.settings.allowed_employee_emails)
            else "cliente"
        )
        return AuthUserResponse(
            id=str(user.id),
            email=email,
            email_confirmado=bool(getattr(user, "email_confirmed_at", None)),
            papel=papel,
        )

    def _session_response(self, session: Any) -> AuthSessionResponse:
        return AuthSessionResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            token_type=session.token_type,
            expires_in=session.expires_in,
            user=self._user_response(session.user),
        )

    def renovar_sessao(self, refresh_token: str) -> AuthSessionResponse:
        response = self.client.auth.refresh_session(refresh_token)
        if not response.session:
            raise RuntimeError("Sessao nao pode ser renovada")
        return self._session_response(response.session)

    def cadastrar(
        self,
        email: str,
        senha: str,
        nome: str | None,
        avaliacao_inicial: AvaliacaoInicial,
        user_agent: str | None = None,
    ) -> SignUpResponse:
        PasswordSecurityService().validar(senha)
        options: dict[str, Any] = {}
        if nome:
            options["data"] = {"nome": nome}
        response = self.client.auth.sign_up({"email": email, "password": senha, "options": options})
        if not response.user:
            raise RuntimeError("Nao foi possivel criar a conta")

        indicadores, ild, perfil = definir_ild_inicial(avaliacao_inicial)
        cliente = None
        try:
            cliente = SupabaseClienteRepository(
                self.settings.supabase_url, self.settings.supabase_key
            ).salvar_avaliacao_inicial(str(response.user.id), indicadores, ild, perfil)
            if not cliente:
                raise RuntimeError("Cliente da conta nao encontrado")
        except Exception:
            # A conta ja existe no Auth. O cadastro nao deve falhar se o perfil
            # inicial nao puder ser salvo; o atendimento aplicara seus fallbacks.
            logger.exception("Nao foi possivel salvar a avaliacao inicial do cliente")
            ild = None
            perfil = None

        if ild is not None and cliente:
            try:
                SupabaseNotificacaoRepository(
                    self.settings.supabase_url, self.settings.supabase_key
                ).criar(
                    int(cliente["id"]),
                    "sistema",
                    "Bem-vindo ao Vivo AdaptAI",
                    "Seu atendimento ja esta preparado para acompanhar o seu ritmo digital.",
                    "home.html",
                )
            except Exception:
                logger.warning("Conta criada, mas a notificacao de boas-vindas falhou", exc_info=True)

        session = self._session_response(response.session) if response.session else None
        if response.session:
            self.registrar_dispositivo(
                response.session.access_token, str(response.user.id), user_agent
            )
        mensagem = "Conta criada com sucesso."
        if not session:
            mensagem = "Conta criada. Confirme seu e-mail para entrar."
        return SignUpResponse(
            user=self._user_response(response.user),
            session=session,
            mensagem=mensagem,
            ild=ild,
            perfil=perfil,
        )

    def entrar(self, email: str, senha: str, user_agent: str | None = None) -> AuthSessionResponse:
        response = self.client.auth.sign_in_with_password({"email": email, "password": senha})
        if not response.session:
            raise RuntimeError("Nao foi possivel iniciar a sessao")
        self.registrar_dispositivo(
            response.session.access_token, str(response.session.user.id), user_agent
        )
        return self._session_response(response.session)

    def solicitar_redefinicao_senha(self, email: str) -> None:
        destino = f"{self.settings.frontend_url.rstrip('/')}/nova-senha.html"
        self.client.auth.reset_password_for_email(email, {"redirect_to": destino})

    def redefinir_senha(self, access_token: str, senha: str) -> None:
        PasswordSecurityService().validar(senha)
        resposta = self.client.auth.get_user(access_token)
        if not resposta.user:
            raise RuntimeError("Link de recuperacao invalido ou expirado")
        self.client.auth.admin.update_user_by_id(str(resposta.user.id), {"password": senha})

    def usuario_atual(self, access_token: str) -> AuthUserResponse:
        response = self.client.auth.get_user(access_token)
        if not response.user:
            raise RuntimeError("Sessao invalida")
        usuario = self._user_response(response.user)
        session_id = self._claims(access_token).get("session_id")
        if session_id:
            SupabaseSessaoRepository(
                self.settings.supabase_url, self.settings.supabase_key
            ).validar_ou_registrar(str(session_id), usuario.id)
        return usuario

    def confirmar_senha(self, email: str, senha: str, auth_user_id: str) -> None:
        resposta = httpx.post(
            f"{self.settings.supabase_url.rstrip('/')}/auth/v1/token",
            params={"grant_type": "password"},
            headers={
                "apikey": self.settings.supabase_publishable_key or self.settings.supabase_key,
                "Content-Type": "application/json",
            },
            json={"email": email, "password": senha},
            timeout=10.0,
        )
        if not resposta.is_success:
            raise RuntimeError("Senha incorreta")
        dados = resposta.json()
        usuario = dados.get("user") or {}
        token_verificacao = dados.get("access_token")
        if str(usuario.get("id") or "") != auth_user_id or not token_verificacao:
            raise RuntimeError("Senha incorreta")
        # A confirmação não deve deixar uma sessão adicional e invisível aberta.
        try:
            self._logout(str(token_verificacao), "local")
        except httpx.HTTPError:
            logger.warning("A sessao temporaria de revalidacao nao pôde ser encerrada")

    def alterar_senha(self, access_token: str, senha_atual: str, nova_senha: str) -> None:
        usuario = self.usuario_atual(access_token)
        if not usuario.email:
            raise RuntimeError("Conta sem e-mail para revalidacao")
        self.confirmar_senha(usuario.email, senha_atual, usuario.id)
        if senha_atual == nova_senha:
            raise RuntimeError("A nova senha deve ser diferente da atual")
        PasswordSecurityService().validar(nova_senha)
        self.client.auth.admin.update_user_by_id(usuario.id, {"password": nova_senha})
        try:
            self._logout(access_token, "global")
        except httpx.HTTPError:
            pass
        SupabaseSessaoRepository(
            self.settings.supabase_url, self.settings.supabase_key
        ).revogar_todas(usuario.id)

    def registrar_dispositivo(
        self, access_token: str, auth_user_id: str, user_agent: str | None
    ) -> None:
        session_id = self._claims(access_token).get("session_id")
        if not session_id:
            return
        SupabaseSessaoRepository(
            self.settings.supabase_url, self.settings.supabase_key
        ).registrar(str(session_id), auth_user_id, user_agent)

    def listar_dispositivos(self, access_token: str) -> list[dict[str, Any]]:
        usuario = self.usuario_atual(access_token)
        atual = str(self._claims(access_token).get("session_id") or "")
        sessoes = SupabaseSessaoRepository(
            self.settings.supabase_url, self.settings.supabase_key
        ).listar(usuario.id)
        for sessao in sessoes:
            sessao["atual"] = str(sessao["id"]) == atual
        return sessoes

    def revogar_dispositivo(self, access_token: str, session_id: str) -> bool:
        usuario = self.usuario_atual(access_token)
        atual = str(self._claims(access_token).get("session_id") or "")
        repositorio = SupabaseSessaoRepository(
            self.settings.supabase_url, self.settings.supabase_key
        )
        revogada = repositorio.revogar(session_id, usuario.id)
        if revogada and session_id == atual:
            self._logout(access_token, "local")
        return revogada

    def revogar_outros_dispositivos(self, access_token: str) -> int:
        usuario = self.usuario_atual(access_token)
        atual = str(self._claims(access_token).get("session_id") or "")
        self._logout(access_token, "others")
        return SupabaseSessaoRepository(
            self.settings.supabase_url, self.settings.supabase_key
        ).revogar_outras(usuario.id, atual)

    def revogar_todas_sessoes(self, access_token: str) -> None:
        claims = self._claims(access_token)
        self._logout(access_token, "global")
        auth_user_id = claims.get("sub")
        if auth_user_id:
            SupabaseSessaoRepository(
                self.settings.supabase_url, self.settings.supabase_key
            ).revogar_todas(str(auth_user_id))

    def excluir_usuario(self, auth_user_id: str) -> None:
        self.client.auth.admin.delete_user(auth_user_id)

    def _logout(self, access_token: str, scope: str) -> None:
        resposta = httpx.post(
            f"{self.settings.supabase_url.rstrip('/')}/auth/v1/logout",
            params={"scope": scope},
            headers={
                "apikey": self.settings.supabase_key,
                "Authorization": f"Bearer {access_token}",
            },
            timeout=10.0,
        )
        resposta.raise_for_status()

    @staticmethod
    def _claims(access_token: str) -> dict[str, Any]:
        try:
            parte = access_token.split(".")[1]
            parte += "=" * (-len(parte) % 4)
            return json.loads(base64.urlsafe_b64decode(parte).decode("utf-8"))
        except (IndexError, ValueError, binascii.Error, json.JSONDecodeError):
            return {}
