import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import PreferenciasResponse, PreferenciasUpdateRequest
from app.repositories.supabase_cliente_repository import SupabaseClienteRepository
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/preferencias", tags=["preferencias"])
bearer_scheme = HTTPBearer(auto_error=False)


def _cliente_autenticado(
    credenciais: HTTPAuthorizationCredentials | None,
) -> tuple[object, dict, SupabaseClienteRepository]:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para acessar suas preferencias.")
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Preferencias indisponiveis no momento.")
    try:
        usuario = AuthService(settings).usuario_atual(credenciais.credentials)
        repositorio = SupabaseClienteRepository(settings.supabase_url, settings.supabase_key)
        cliente = repositorio.get_by_auth_user_id(usuario.id)
    except Exception as exc:
        logger.warning("Falha ao consultar preferencias: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada. Entre novamente.") from exc
    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado para esta conta.")
    return usuario, cliente, repositorio


def _resposta(cliente: dict) -> PreferenciasResponse:
    return PreferenciasResponse(**(cliente.get("preferencias") or {}))


@router.get("", response_model=PreferenciasResponse)
def obter_preferencias(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> PreferenciasResponse:
    _, cliente, _ = _cliente_autenticado(credenciais)
    return _resposta(cliente)


@router.patch("", response_model=PreferenciasResponse)
def atualizar_preferencias(
    payload: PreferenciasUpdateRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> PreferenciasResponse:
    usuario, cliente, repositorio = _cliente_autenticado(credenciais)
    novas = {**(cliente.get("preferencias") or {}), **payload.model_dump(exclude_none=True)}
    try:
        atualizado = repositorio.atualizar_preferencias(usuario.id, novas)
    except Exception as exc:
        logger.exception("Falha ao salvar preferencias")
        raise HTTPException(status_code=503, detail="Nao foi possivel salvar suas preferencias agora.") from exc
    if not atualizado:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado para esta conta.")
    return _resposta(atualizado)
