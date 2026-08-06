import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import (
    AtendimentoDetalheResponse,
    AtendimentoOperacaoResponse,
    AtendimentoPainelResponse,
    AtendimentoRespostaRequest,
)
from app.repositories.supabase_operacao_repository import SupabaseOperacaoRepository
from app.services.auth_service import AuthService


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/operacao", tags=["operacao"])
bearer_scheme = HTTPBearer(auto_error=False)


def _atendente(
    credenciais: HTTPAuthorizationCredentials | None,
) -> tuple[object, str, SupabaseOperacaoRepository]:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login como atendente.")
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Painel de atendimento indisponivel no momento.")
    try:
        usuario = AuthService(settings).usuario_atual(credenciais.credentials)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada.") from exc
    if usuario.papel != "funcionario":
        raise HTTPException(status_code=403, detail="Esta area e exclusiva para funcionarios autorizados.")
    nome = (usuario.email or "Atendente").split("@")[0].replace(".", " ").title()
    return usuario, nome, SupabaseOperacaoRepository(settings.supabase_url, settings.supabase_key)


@router.get("/atendimentos", response_model=AtendimentoPainelResponse)
def listar_atendimentos(
    status: Literal["aberta", "em_andamento", "concluida", "cancelada"] | None = Query(default=None),
    somente_meus: bool = Query(default=False),
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AtendimentoPainelResponse:
    usuario, _, repositorio = _atendente(credenciais)
    try:
        todos = repositorio.listar()
        filtrados = [item for item in todos if (not status or item["status"] == status)]
        if somente_meus:
            filtrados = [item for item in filtrados if str(item.get("atendente_auth_user_id")) == usuario.id]
        return AtendimentoPainelResponse(
            abertas=sum(item["status"] == "aberta" for item in todos),
            em_andamento=sum(item["status"] == "em_andamento" for item in todos),
            concluidas=sum(item["status"] == "concluida" for item in todos),
            minhas=sum(str(item.get("atendente_auth_user_id")) == usuario.id and item["status"] == "em_andamento" for item in todos),
            solicitacoes=filtrados,
        )
    except Exception as exc:
        logger.exception("Falha ao carregar fila de atendimento")
        raise HTTPException(status_code=503, detail="Nao foi possivel carregar a fila agora.") from exc


@router.get("/atendimentos/{solicitacao_id}", response_model=AtendimentoDetalheResponse)
def obter_atendimento(
    solicitacao_id: int,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AtendimentoDetalheResponse:
    _, _, repositorio = _atendente(credenciais)
    try:
        atendimento = repositorio.obter(solicitacao_id)
    except Exception as exc:
        logger.exception("Falha ao carregar atendimento")
        raise HTTPException(status_code=503, detail="Nao foi possivel carregar o atendimento.") from exc
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    return AtendimentoDetalheResponse(**atendimento)


@router.patch("/atendimentos/{solicitacao_id}/assumir", response_model=AtendimentoOperacaoResponse)
def assumir_atendimento(
    solicitacao_id: int,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AtendimentoOperacaoResponse:
    usuario, nome, repositorio = _atendente(credenciais)
    try:
        atualizado = repositorio.assumir(solicitacao_id, usuario.id, nome)
    except Exception as exc:
        logger.exception("Falha ao assumir atendimento")
        raise HTTPException(status_code=503, detail="Nao foi possivel assumir o atendimento.") from exc
    if not atualizado:
        raise HTTPException(status_code=409, detail="Este atendimento ja foi assumido ou encerrado.")
    return AtendimentoOperacaoResponse(atualizado=True, status="em_andamento", mensagem="Atendimento atribuido a voce.")


@router.post("/atendimentos/{solicitacao_id}/respostas", response_model=AtendimentoOperacaoResponse)
def responder_atendimento(
    solicitacao_id: int,
    payload: AtendimentoRespostaRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AtendimentoOperacaoResponse:
    usuario, nome, repositorio = _atendente(credenciais)
    try:
        atualizado = repositorio.responder(solicitacao_id, usuario.id, nome, payload.mensagem.strip())
    except Exception as exc:
        logger.exception("Falha ao responder atendimento")
        raise HTTPException(status_code=503, detail="Nao foi possivel enviar a resposta.") from exc
    if not atualizado:
        raise HTTPException(status_code=409, detail="Assuma este atendimento antes de responder.")
    return AtendimentoOperacaoResponse(atualizado=True, status="em_andamento", mensagem="Resposta enviada ao cliente.")


@router.patch("/atendimentos/{solicitacao_id}/concluir", response_model=AtendimentoOperacaoResponse)
def concluir_atendimento(
    solicitacao_id: int,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AtendimentoOperacaoResponse:
    usuario, nome, repositorio = _atendente(credenciais)
    try:
        atualizado = repositorio.concluir(solicitacao_id, usuario.id, nome)
    except Exception as exc:
        logger.exception("Falha ao concluir atendimento")
        raise HTTPException(status_code=503, detail="Nao foi possivel concluir o atendimento.") from exc
    if not atualizado:
        raise HTTPException(status_code=409, detail="Somente o atendente responsavel pode concluir.")
    return AtendimentoOperacaoResponse(atualizado=True, status="concluida", mensagem="Atendimento concluido.")
