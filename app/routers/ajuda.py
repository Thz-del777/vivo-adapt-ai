import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import SolicitacaoAjudaRequest, SolicitacaoAjudaResponse
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.supabase_solicitacao_repository import SupabaseSolicitacaoRepository
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ajuda", tags=["ajuda"])
bearer_scheme = HTTPBearer(auto_error=False)


@router.post(
    "/solicitacoes",
    response_model=SolicitacaoAjudaResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_solicitacao(
    payload: SolicitacaoAjudaRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> SolicitacaoAjudaResponse:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para solicitar um atendente humano.")

    settings = get_settings()
    if not settings.use_supabase or not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Atendimento humano indisponivel no momento.")

    try:
        usuario = AuthService(settings).usuario_atual(credenciais.credentials)
        cliente = ClienteRepository(settings).get_by_auth_user_id(usuario.id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada. Entre novamente.") from exc
    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado para esta conta.")

    try:
        solicitacao = SupabaseSolicitacaoRepository(
            settings.supabase_url,
            settings.supabase_key,
        ).criar(int(cliente["id"]), payload.assunto, payload.descricao.strip())
    except Exception as exc:
        logger.exception("Falha ao registrar solicitacao de ajuda")
        raise HTTPException(
            status_code=503,
            detail="Nao foi possivel chamar um atendente agora. Tente novamente.",
        ) from exc

    return SolicitacaoAjudaResponse(
        protocolo=solicitacao["protocolo"],
        mensagem="Solicitacao recebida. Um atendente podera continuar pelo seu historico.",
    )
