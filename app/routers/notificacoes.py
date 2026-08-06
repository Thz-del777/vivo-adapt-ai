import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import NotificacaoAcaoResponse, NotificacoesResponse, RealtimeConfigResponse
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.supabase_notificacao_repository import SupabaseNotificacaoRepository
from app.services.auth_service import AuthService


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])
bearer_scheme = HTTPBearer(auto_error=False)


def _contexto(
    credenciais: HTTPAuthorizationCredentials | None,
) -> tuple[int, SupabaseNotificacaoRepository]:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para ver suas notificacoes.")
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Notificacoes indisponiveis no momento.")
    try:
        usuario = AuthService(settings).usuario_atual(credenciais.credentials)
        cliente = ClienteRepository(settings).get_by_auth_user_id(usuario.id)
    except Exception as exc:
        logger.warning("Falha ao validar sessao das notificacoes: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada. Entre novamente.") from exc
    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado para esta conta.")
    return int(cliente["id"]), SupabaseNotificacaoRepository(settings.supabase_url, settings.supabase_key)


@router.get("", response_model=NotificacoesResponse)
def listar_notificacoes(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> NotificacoesResponse:
    cliente_id, repositorio = _contexto(credenciais)
    try:
        return NotificacoesResponse(
            notificacoes=repositorio.listar(cliente_id),
            nao_lidas=repositorio.contar_nao_lidas(cliente_id),
        )
    except Exception as exc:
        logger.exception("Falha ao listar notificacoes")
        raise HTTPException(status_code=503, detail="Nao foi possivel carregar suas notificacoes agora.") from exc


@router.get("/realtime/config", response_model=RealtimeConfigResponse)
def obter_configuracao_realtime(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> RealtimeConfigResponse:
    _contexto(credenciais)
    settings = get_settings()
    if not settings.supabase_publishable_key:
        raise HTTPException(status_code=503, detail="Atualizacao em tempo real indisponivel no momento.")
    return RealtimeConfigResponse(
        supabase_url=settings.supabase_url,
        supabase_publishable_key=settings.supabase_publishable_key,
    )


@router.patch("/ler-todas", response_model=NotificacaoAcaoResponse)
def ler_todas(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> NotificacaoAcaoResponse:
    cliente_id, repositorio = _contexto(credenciais)
    try:
        repositorio.marcar_todas_lidas(cliente_id)
        return NotificacaoAcaoResponse(atualizado=True, nao_lidas=0)
    except Exception as exc:
        logger.exception("Falha ao marcar notificacoes como lidas")
        raise HTTPException(status_code=503, detail="Nao foi possivel atualizar as notificacoes.") from exc


@router.patch("/{notificacao_id}/ler", response_model=NotificacaoAcaoResponse)
def ler_notificacao(
    notificacao_id: int,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> NotificacaoAcaoResponse:
    cliente_id, repositorio = _contexto(credenciais)
    try:
        atualizado = repositorio.marcar_lida(notificacao_id, cliente_id)
        if not atualizado:
            raise HTTPException(status_code=404, detail="Notificacao nao encontrada.")
        return NotificacaoAcaoResponse(
            atualizado=True,
            nao_lidas=repositorio.contar_nao_lidas(cliente_id),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Falha ao ler notificacao")
        raise HTTPException(status_code=503, detail="Nao foi possivel atualizar a notificacao.") from exc


@router.delete("/{notificacao_id}", response_model=NotificacaoAcaoResponse)
def arquivar_notificacao(
    notificacao_id: int,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> NotificacaoAcaoResponse:
    cliente_id, repositorio = _contexto(credenciais)
    try:
        atualizado = repositorio.arquivar(notificacao_id, cliente_id)
        if not atualizado:
            raise HTTPException(status_code=404, detail="Notificacao nao encontrada.")
        return NotificacaoAcaoResponse(
            atualizado=True,
            nao_lidas=repositorio.contar_nao_lidas(cliente_id),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Falha ao arquivar notificacao")
        raise HTTPException(status_code=503, detail="Nao foi possivel arquivar a notificacao.") from exc
