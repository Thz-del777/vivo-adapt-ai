import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.models.schemas import (
    AcaoPrivacidadeResponse,
    ConsentimentoPrivacidadeResponse,
    ConsentimentosPrivacidadeUpdateRequest,
    ConfirmacaoPrivacidadeRequest,
    ExcluirContaRequest,
    PrivacidadeResumoResponse,
)
from app.repositories.supabase_cliente_repository import SupabaseClienteRepository
from app.repositories.supabase_privacidade_repository import (
    TIPOS_CONSENTIMENTO,
    SupabasePrivacidadeRepository,
)
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/privacidade", tags=["privacidade"])
bearer_scheme = HTTPBearer(auto_error=False)
VERSAO_POLITICA = "1.0"

PADRAO_CONSENTIMENTOS = {
    "personalizacao": True,
    "historico": True,
    "dados_uso_anonimos": False,
    "comunicacoes": False,
}
MAPA_PREFERENCIAS = {
    "personalizacao": "personalizacao_atendimento",
    "historico": "salvar_historico",
    "dados_uso_anonimos": "dados_uso_anonimos",
    "comunicacoes": "notificacoes_novidades",
}


def _contexto(
    credenciais: HTTPAuthorizationCredentials | None,
) -> tuple[Settings, object, dict, SupabasePrivacidadeRepository, str]:
    if not credenciais or credenciais.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Faca login para gerenciar seus dados.")
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Central de privacidade indisponivel no momento.")
    token = credenciais.credentials
    try:
        usuario = AuthService(settings).usuario_atual(token)
        cliente = SupabaseClienteRepository(
            settings.supabase_url, settings.supabase_key
        ).get_by_auth_user_id(usuario.id)
    except Exception as exc:
        raise HTTPException(
            status_code=401, detail="Sessao invalida ou expirada. Entre novamente."
        ) from exc
    if not cliente:
        raise HTTPException(status_code=404, detail="Conta de cliente nao encontrada.")
    return (
        settings,
        usuario,
        cliente,
        SupabasePrivacidadeRepository(settings.supabase_url, settings.supabase_key),
        token,
    )


def _consentimentos_completos(
    repositorio: SupabasePrivacidadeRepository, cliente: dict
) -> list[dict]:
    existentes = {item["tipo"]: item for item in repositorio.listar_consentimentos(int(cliente["id"]))}
    preferencias = cliente.get("preferencias") or {}
    faltantes = {
        tipo: bool(preferencias.get(MAPA_PREFERENCIAS[tipo], PADRAO_CONSENTIMENTOS[tipo]))
        for tipo in TIPOS_CONSENTIMENTO
        if tipo not in existentes
    }
    if faltantes:
        return repositorio.salvar_consentimentos(int(cliente["id"]), faltantes, VERSAO_POLITICA)
    return list(existentes.values())


@router.get("", response_model=PrivacidadeResumoResponse)
def obter_resumo_privacidade(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> PrivacidadeResumoResponse:
    _, usuario, cliente, repositorio, _ = _contexto(credenciais)
    try:
        consentimentos = _consentimentos_completos(repositorio, cliente)
        dados = repositorio.exportar_dados(cliente)
    except Exception as exc:
        logger.exception("Falha ao consultar dados de privacidade")
        raise HTTPException(status_code=503, detail="Nao foi possivel carregar seus dados agora.") from exc
    totais = {
        "conversas": len(dados["conversas"]),
        "mensagens": len(dados["mensagens"]),
        "eventos_digitais": len(dados["eventos_digitais"]),
        "notificacoes": len(dados["notificacoes"]),
    }
    return PrivacidadeResumoResponse(
        email=getattr(usuario, "email", None),
        nome=cliente["nome"],
        consentimentos=[ConsentimentoPrivacidadeResponse(**item) for item in consentimentos],
        totais=totais,
        versao_politica=VERSAO_POLITICA,
        atualizado_em="28/07/2026",
    )


@router.patch("/consentimentos", response_model=list[ConsentimentoPrivacidadeResponse])
def atualizar_consentimentos(
    payload: ConsentimentosPrivacidadeUpdateRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> list[ConsentimentoPrivacidadeResponse]:
    _, usuario, cliente, repositorio, _ = _contexto(credenciais)
    alteracoes = payload.model_dump(exclude_none=True)
    if not alteracoes:
        raise HTTPException(status_code=422, detail="Informe ao menos um consentimento.")
    try:
        preferencias = dict(cliente.get("preferencias") or {})
        for tipo, valor in alteracoes.items():
            preferencias[MAPA_PREFERENCIAS[tipo]] = valor
        repositorio.atualizar_preferencias_consentimento(usuario.id, preferencias)
        salvos = repositorio.salvar_consentimentos(
            int(cliente["id"]), alteracoes, VERSAO_POLITICA
        )
        return [ConsentimentoPrivacidadeResponse(**item) for item in salvos]
    except Exception as exc:
        logger.exception("Falha ao salvar consentimentos")
        raise HTTPException(status_code=503, detail="Nao foi possivel salvar suas escolhas agora.") from exc


@router.get("/dados/download")
def baixar_dados(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Response:
    _, usuario, cliente, repositorio, _ = _contexto(credenciais)
    try:
        dados = repositorio.exportar_dados(cliente)
    except Exception as exc:
        logger.exception("Falha ao exportar dados pessoais")
        raise HTTPException(status_code=503, detail="Nao foi possivel preparar o arquivo agora.") from exc
    exportacao = {
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "titular": {"auth_user_id": usuario.id, "email": getattr(usuario, "email", None)},
        "dados": dados,
        "informacoes_lgpd": {
            "finalidades": ["autenticacao", "atendimento adaptado", "suporte e seguranca"],
            "direitos": ["acesso", "correcao", "portabilidade", "revogacao", "exclusao"],
            "observacao": "Senhas, chaves e tokens nunca fazem parte desta exportacao.",
        },
    }
    conteudo = json.dumps(exportacao, ensure_ascii=False, indent=2, default=str)
    data = datetime.now(timezone.utc).date().isoformat()
    return Response(
        content=conteudo,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="vivo-adaptai-dados-{data}.json"'},
    )


@router.delete("/historico", response_model=AcaoPrivacidadeResponse)
def limpar_historico(
    payload: ConfirmacaoPrivacidadeRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AcaoPrivacidadeResponse:
    _, _, cliente, repositorio, _ = _contexto(credenciais)
    if payload.confirmacao.strip().upper() != "APAGAR HISTORICO":
        raise HTTPException(status_code=400, detail='Digite "APAGAR HISTORICO" para confirmar.')
    try:
        removidos = repositorio.limpar_historico(int(cliente["id"]))
    except Exception as exc:
        logger.exception("Falha ao limpar historico")
        raise HTTPException(status_code=503, detail="Nao foi possivel apagar o historico agora.") from exc
    return AcaoPrivacidadeResponse(
        concluido=True,
        mensagem="Seu historico de conversas e atendimentos foi apagado.",
        removidos=removidos,
    )


@router.post("/sessoes/revogar", response_model=AcaoPrivacidadeResponse)
def revogar_sessoes(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AcaoPrivacidadeResponse:
    settings, _, _, _, token = _contexto(credenciais)
    try:
        AuthService(settings).revogar_todas_sessoes(token)
    except Exception as exc:
        logger.exception("Falha ao revogar sessoes")
        raise HTTPException(status_code=503, detail="Nao foi possivel encerrar as sessoes agora.") from exc
    return AcaoPrivacidadeResponse(
        concluido=True,
        mensagem="As sessoes da sua conta foram revogadas. Entre novamente para continuar.",
    )


@router.delete("/conta", response_model=AcaoPrivacidadeResponse)
def excluir_conta(
    payload: ExcluirContaRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AcaoPrivacidadeResponse:
    settings, usuario, cliente, repositorio, token = _contexto(credenciais)
    if payload.confirmacao.strip().upper() != "EXCLUIR MINHA CONTA":
        raise HTTPException(status_code=400, detail='Digite "EXCLUIR MINHA CONTA" para confirmar.')
    if not getattr(usuario, "email", None):
        raise HTTPException(status_code=400, detail="Esta conta nao possui e-mail para revalidacao.")
    auth = AuthService(settings)
    try:
        auth.confirmar_senha(usuario.email, payload.senha, usuario.id)
    except Exception as exc:
        raise HTTPException(status_code=403, detail="Senha incorreta. A conta nao foi excluida.") from exc
    try:
        auth.revogar_todas_sessoes(token)
        removidos = repositorio.excluir_dados_conta(int(cliente["id"]))
        auth.excluir_usuario(usuario.id)
    except Exception as exc:
        logger.exception("Falha ao excluir conta")
        raise HTTPException(
            status_code=503,
            detail="Nao foi possivel concluir a exclusao. Entre em contato com o suporte.",
        ) from exc
    return AcaoPrivacidadeResponse(
        concluido=True,
        mensagem="Sua conta e os dados associados foram excluidos.",
        removidos=removidos,
    )
