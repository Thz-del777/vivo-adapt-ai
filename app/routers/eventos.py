import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import EventoDigitalRequest, EventoDigitalResponse
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.supabase_evento_repository import SupabaseEventoRepository
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/eventos", tags=["ild"])
bearer_scheme = HTTPBearer(auto_error=False)


@router.post("", response_model=EventoDigitalResponse)
def registrar_evento(
    payload: EventoDigitalRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> EventoDigitalResponse:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para registrar sua atividade.")

    settings = get_settings()
    if not settings.use_supabase or not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Atualizacao do ILD indisponivel no momento.")

    try:
        usuario = AuthService(settings).usuario_atual(credenciais.credentials)
        cliente = ClienteRepository(settings).get_by_auth_user_id(usuario.id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada.") from exc
    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado.")

    detalhes = {
        chave: valor
        for chave, valor in payload.detalhes.items()
        if chave in {"pagina", "elemento", "origem", "modalidade"}
        and isinstance(valor, (str, int, float, bool))
    }
    try:
        resultado = SupabaseEventoRepository(settings.supabase_url, settings.supabase_key).registrar(
            cliente_id=int(cliente["id"]),
            evento_chave=payload.evento_chave,
            tipo_evento=payload.tipo_evento,
            nome_tarefa=payload.nome_tarefa,
            duracao_segundos=payload.duracao_segundos,
            detalhes=detalhes,
        )
    except Exception as exc:
        logger.exception("Falha ao registrar evento digital")
        raise HTTPException(status_code=503, detail="Nao foi possivel atualizar o ILD agora.") from exc

    return EventoDigitalResponse(**resultado)
