import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import (
    ConversaHistoricoDetalheResponse,
    ConversaHistoricoResponse,
    EncerramentoConversaResponse,
)
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.supabase_conversa_repository import SupabaseConversaRepository
from app.repositories.supabase_notificacao_repository import SupabaseNotificacaoRepository
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversas", tags=["historico"])
bearer_scheme = HTTPBearer(auto_error=False)


def _cliente_da_sessao(
    credenciais: HTTPAuthorizationCredentials | None,
) -> tuple[dict, object]:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para ver seu historico.")

    settings = get_settings()
    try:
        usuario = AuthService(settings).usuario_atual(credenciais.credentials)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada. Entre novamente.") from exc

    cliente = ClienteRepository(settings).get_by_auth_user_id(usuario.id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado para esta conta.")
    return cliente, settings


def _repositorio(settings: object) -> SupabaseConversaRepository:
    if not getattr(settings, "supabase_url", None) or not getattr(settings, "supabase_key", None):
        raise HTTPException(status_code=503, detail="Historico indisponivel no momento.")
    return SupabaseConversaRepository(settings.supabase_url, settings.supabase_key)


def _historico_ativo(cliente: dict) -> bool:
    return (cliente.get("preferencias") or {}).get("salvar_historico", True)


@router.get("", response_model=list[ConversaHistoricoResponse])
def listar_conversas(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> list[ConversaHistoricoResponse]:
    cliente, settings = _cliente_da_sessao(credenciais)
    if not _historico_ativo(cliente):
        return []
    try:
        return _repositorio(settings).listar_conversas_cliente(int(cliente["id"]))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Falha ao consultar historico")
        raise HTTPException(status_code=503, detail="Historico indisponivel no momento.") from exc


@router.patch("/atual/encerrar", response_model=EncerramentoConversaResponse)
def encerrar_conversa_atual(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> EncerramentoConversaResponse:
    cliente, settings = _cliente_da_sessao(credenciais)
    if not getattr(settings, "use_supabase", False) or not _historico_ativo(cliente):
        return EncerramentoConversaResponse(
            encerrada=False,
            conversas_encerradas=0,
            status="historico_desativado",
        )

    try:
        encerradas = _repositorio(settings).encerrar_conversas_abertas(int(cliente["id"]))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Falha ao encerrar conversa")
        raise HTTPException(
            status_code=503,
            detail="Nao foi possivel encerrar o atendimento agora. Tente novamente.",
        ) from exc

    if not encerradas:
        return EncerramentoConversaResponse(
            encerrada=False,
            conversas_encerradas=0,
            status="sem_conversa_aberta",
        )

    conversa_mais_recente = max(
        encerradas,
        key=lambda conversa: conversa.get("iniciada_em") or "",
    )
    if (cliente.get("preferencias") or {}).get("notificacoes_resumo", True):
        try:
            SupabaseNotificacaoRepository(settings.supabase_url, settings.supabase_key).criar(
                int(cliente["id"]),
                "atendimento",
                "Atendimento encerrado",
                "Seu atendimento foi encerrado e ja esta disponivel no historico.",
                "historico.html",
                {"conversa_id": int(conversa_mais_recente["id"])},
            )
        except Exception:
            logger.warning("Conversa encerrada, mas a notificacao de resumo falhou", exc_info=True)
    return EncerramentoConversaResponse(
        encerrada=True,
        conversas_encerradas=len(encerradas),
        conversa_id=int(conversa_mais_recente["id"]),
        status="encerrada",
    )


@router.get("/{conversa_id}", response_model=ConversaHistoricoDetalheResponse)
def obter_conversa(
    conversa_id: int,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> ConversaHistoricoDetalheResponse:
    cliente, settings = _cliente_da_sessao(credenciais)
    if not _historico_ativo(cliente):
        raise HTTPException(status_code=403, detail="O historico esta desativado nas suas permissoes.")
    try:
        conversa = _repositorio(settings).obter_conversa_cliente(conversa_id, int(cliente["id"]))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Falha ao consultar conversa")
        raise HTTPException(status_code=503, detail="Historico indisponivel no momento.") from exc
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada.")
    return conversa
