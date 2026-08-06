import logging

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import (
    AuthCredentials,
    AuthSessionResponse,
    AuthUserResponse,
    MensagemResponse,
    PasswordChangeRequest,
    PasswordForgotRequest,
    PasswordResetRequest,
    SignUpRequest,
    SignUpResponse,
    SessoesDispositivosResponse,
)
from app.services.auth_service import AuthService
from app.services.password_security_service import SenhaInseguraError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service() -> AuthService:
    return AuthService(get_settings())


def _erro_login_para_http(exc: Exception) -> HTTPException:
    """Mantem erros genericos, mas explica quando o email nao foi confirmado."""
    mensagem = str(exc).lower()
    if "email not confirmed" in mensagem or "email not verified" in mensagem:
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme o e-mail enviado no cadastro antes de entrar.",
        )
    return HTTPException(status_code=401, detail="E-mail ou senha inválidos")


@router.post("/signup", response_model=SignUpResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignUpRequest, request: Request) -> SignUpResponse:
    try:
        return get_auth_service().cadastrar(
            payload.email,
            payload.senha,
            payload.nome,
            payload.avaliacao_inicial,
            request.headers.get("user-agent"),
        )
    except SenhaInseguraError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        if str(exc) == "Supabase Auth nao esta configurado":
            raise HTTPException(status_code=503, detail="Login indisponível no momento") from exc
        raise HTTPException(status_code=400, detail="Não foi possível criar a conta") from exc
    except Exception as exc:
        logger.exception("Falha no cadastro via Supabase Auth")
        raise HTTPException(status_code=400, detail="Não foi possível criar a conta") from exc


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: AuthCredentials, request: Request) -> AuthSessionResponse:
    try:
        return get_auth_service().entrar(
            payload.email, payload.senha, request.headers.get("user-agent")
        )
    except RuntimeError as exc:
        if str(exc) == "Supabase Auth nao esta configurado":
            raise HTTPException(status_code=503, detail="Login indisponível no momento") from exc
        raise _erro_login_para_http(exc) from exc
    except Exception as exc:
        logger.warning("Falha de autenticacao via Supabase Auth: %s", type(exc).__name__)
        raise _erro_login_para_http(exc) from exc


@router.post("/password/forgot", response_model=MensagemResponse)
def solicitar_redefinicao_senha(payload: PasswordForgotRequest) -> MensagemResponse:
    mensagem = "Se houver uma conta com esse e-mail, enviaremos as instrucoes de recuperacao."
    try:
        get_auth_service().solicitar_redefinicao_senha(payload.email)
    except RuntimeError as exc:
        if str(exc) == "Supabase Auth nao esta configurado":
            raise HTTPException(status_code=503, detail="Recuperacao indisponivel no momento") from exc
        logger.warning("Falha ao solicitar recuperacao de senha: %s", type(exc).__name__)
    except Exception as exc:
        # Mantem a resposta neutra para nao revelar se o e-mail possui conta.
        logger.warning("Falha ao solicitar recuperacao de senha: %s", type(exc).__name__)
    return MensagemResponse(mensagem=mensagem)


@router.post("/password/reset", response_model=MensagemResponse)
def redefinir_senha(
    payload: PasswordResetRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> MensagemResponse:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Link de recuperacao invalido ou expirado")
    try:
        get_auth_service().redefinir_senha(credenciais.credentials, payload.senha)
    except SenhaInseguraError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning("Falha ao redefinir senha: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Link de recuperacao invalido ou expirado") from exc
    return MensagemResponse(mensagem="Senha atualizada com sucesso.")


@router.get("/me", response_model=AuthUserResponse)
def me(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> AuthUserResponse:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token de acesso obrigatório")
    try:
        return get_auth_service().usuario_atual(credentials.credentials)
    except Exception as exc:
        logger.warning("Falha ao validar sessao: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada") from exc


@router.post("/password/change", response_model=MensagemResponse)
def alterar_senha(
    payload: PasswordChangeRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> MensagemResponse:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para alterar sua senha.")
    try:
        get_auth_service().alterar_senha(
            credenciais.credentials, payload.senha_atual, payload.nova_senha
        )
    except SenhaInseguraError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        mensagem = str(exc).lower()
        if "senha" in mensagem or "password" in mensagem:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        logger.warning("Falha ao alterar senha: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Nao foi possivel alterar a senha agora.") from exc
    return MensagemResponse(
        mensagem="Senha alterada com sucesso. Entre novamente em seus dispositivos."
    )


@router.get("/sessions", response_model=SessoesDispositivosResponse)
def listar_sessoes(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> SessoesDispositivosResponse:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para ver seus dispositivos.")
    try:
        sessoes = get_auth_service().listar_dispositivos(credenciais.credentials)
    except Exception as exc:
        logger.warning("Falha ao listar dispositivos: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada.") from exc
    return SessoesDispositivosResponse(sessoes=sessoes)


@router.delete("/sessions/{session_id}", response_model=MensagemResponse)
def revogar_sessao(
    session_id: UUID,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> MensagemResponse:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para remover um dispositivo.")
    try:
        revogada = get_auth_service().revogar_dispositivo(
            credenciais.credentials, str(session_id)
        )
    except Exception as exc:
        logger.warning("Falha ao revogar dispositivo: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Nao foi possivel remover o dispositivo agora.") from exc
    if not revogada:
        raise HTTPException(status_code=404, detail="Dispositivo nao encontrado ou ja removido.")
    return MensagemResponse(mensagem="O acesso deste dispositivo foi removido.")


@router.post("/sessions/revoke-others", response_model=MensagemResponse)
def revogar_outras_sessoes(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> MensagemResponse:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para remover outros dispositivos.")
    try:
        removidas = get_auth_service().revogar_outros_dispositivos(credenciais.credentials)
    except Exception as exc:
        logger.warning("Falha ao revogar outras sessoes: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Nao foi possivel remover as sessoes agora.") from exc
    return MensagemResponse(
        mensagem=f"{removidas} outro(s) dispositivo(s) tiveram o acesso removido."
    )
