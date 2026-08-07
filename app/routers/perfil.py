import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import (
    IldHistoricoItemResponse,
    IldIndicadoresResponse,
    IldPainelResponse,
    PerfilResponse,
    PerfilUpdateRequest,
)
from app.repositories.supabase_cliente_repository import SupabaseClienteRepository
from app.services.auth_service import AuthService
from app.services.ild_service import calcular_ild, classificar_perfil

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/perfil", tags=["perfil"])
bearer_scheme = HTTPBearer(auto_error=False)


def _dados_da_sessao(
    credenciais: HTTPAuthorizationCredentials | None,
) -> tuple[object, dict, SupabaseClienteRepository]:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para acessar seu perfil.")

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Perfil indisponivel no momento.")
    try:
        usuario = AuthService(settings).usuario_atual(credenciais.credentials)
        repositorio = SupabaseClienteRepository(settings.supabase_url, settings.supabase_key)
        cliente = repositorio.get_by_auth_user_id(usuario.id)
    except Exception as exc:
        logger.warning("Falha ao localizar perfil autenticado: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada. Entre novamente.") from exc

    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado para esta conta.")
    return usuario, cliente, repositorio


def _resposta(usuario: object, cliente: dict) -> PerfilResponse:
    ild = calcular_ild(cliente)
    return PerfilResponse(
        nome=cliente["nome"],
        email=getattr(usuario, "email", None),
        telefone=cliente.get("telefone"),
        ild=ild,
        perfil=classificar_perfil(ild),
    )


@router.get("", response_model=PerfilResponse)
def obter_perfil(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> PerfilResponse:
    usuario, cliente, _ = _dados_da_sessao(credenciais)
    return _resposta(usuario, cliente)


@router.get("/ild", response_model=IldPainelResponse)
def obter_painel_ild(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> IldPainelResponse:
    _, cliente, repositorio = _dados_da_sessao(credenciais)
    try:
        historico_banco = repositorio.listar_historico_ild(int(cliente["id"]))
    except Exception:
        logger.exception("Falha ao carregar historico do ILD")
        historico_banco = []

    ild = calcular_ild(cliente)
    perfil = classificar_perfil(ild)
    historico = [
        IldHistoricoItemResponse(
            ild=round(float(item.get("ild", ild))),
            perfil=item.get("perfil") or classificar_perfil(round(float(item.get("ild", ild)))),
            motivo=item.get("motivo_calculo") or "recalculo",
            calculado_em=item.get("calculado_em"),
        )
        for item in reversed(historico_banco)
    ]
    ultimo = historico_banco[0] if historico_banco else {}
    return IldPainelResponse(
        ild=ild,
        perfil=perfil,
        ultima_atualizacao=ultimo.get("calculado_em"),
        motivo_ultima_atualizacao=ultimo.get("motivo_calculo") or "avaliacao_inicial",
        indicadores=IldIndicadoresResponse(
            acessos_app=max(0, int(cliente.get("acessos_app", 0))),
            chamadas_suporte=max(0, int(cliente.get("chamadas_suporte", 0))),
            tempo_medio_tarefa=max(0, round(float(cliente.get("tempo_medio_tarefa", 0)))),
            erros=max(0, int(cliente.get("erros", 0))),
            tarefas_abandonadas=max(0, int(cliente.get("tarefas_abandonadas", 0))),
        ),
        historico=historico,
    )


@router.patch("", response_model=PerfilResponse)
def atualizar_perfil(
    payload: PerfilUpdateRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> PerfilResponse:
    usuario, _, repositorio = _dados_da_sessao(credenciais)
    try:
        cliente = repositorio.atualizar_perfil(
            usuario.id, payload.nome.strip(), payload.telefone.strip() if payload.telefone else None
        )
    except Exception as exc:
        logger.exception("Falha ao atualizar perfil")
        raise HTTPException(status_code=503, detail="Nao foi possivel salvar seu perfil agora.") from exc
    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente nao encontrado para esta conta.")
    return _resposta(usuario, cliente)
