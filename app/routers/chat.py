import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.models.schemas import ChatRequest, ChatResponse
from app.repositories.cliente_repository import ClienteRepository
from app.services.ai_service import GroqService
from app.services.auth_service import AuthService
from app.services.atendimento_service import AtendimentoService
from app.services.demo_service import gerar_resposta_demo
from app.services.fallback_service import gerar_resposta_fallback
from app.services.ild_service import calcular_ild, classificar_perfil
from app.services.prompt_service import criar_prompt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])
bearer_scheme = HTTPBearer(auto_error=False)


def obter_usuario_autenticado(
    credenciais: HTTPAuthorizationCredentials | None,
):
    """Valida o token no Supabase Auth sem confiar em dados do navegador."""
    if not credenciais or credenciais.scheme.lower() != "bearer":
        return None
    try:
        return AuthService(get_settings()).usuario_atual(credenciais.credentials)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada. Entre novamente.") from exc


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> ChatResponse:
    settings = get_settings()
    repositorio = ClienteRepository(settings)
    usuario = obter_usuario_autenticado(credenciais)

    if usuario:
        # The database relation, not a browser-provided id, determines the customer.
        cliente = repositorio.get_by_auth_user_id(usuario.id)
        if not cliente:
            raise HTTPException(
                status_code=404,
                detail="Nao encontramos um perfil de cliente para esta conta. Tente entrar novamente.",
            )
    elif settings.demo_mode:
        # Visitors can still try the product in DEMO_MODE.
        cliente = repositorio.get_by_id(payload.cliente_id or 1)
    else:
        raise HTTPException(status_code=401, detail="Faca login para usar o atendimento.")

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado nos dados disponiveis")

    ild = calcular_ild(cliente)
    perfil_real = classificar_perfil(ild)
    preferencias = cliente.get("preferencias") or {}
    personalizacao_ativa = preferencias.get("personalizacao_atendimento", True)
    historico_ativo = preferencias.get("salvar_historico", True)
    perfil_resposta = perfil_real if personalizacao_ativa else "intermediario"
    if settings.demo_mode:
        logger.info("Gerando resposta em modo demo")
        resposta, origem = gerar_resposta_demo(perfil_resposta, payload.mensagem, payload.modo_guiado), "demo"
    else:
        try:
            logger.info("Tentando gerar resposta com Groq")
            contexto = (
                AtendimentoService(settings).obter_contexto_recente(int(cliente["id"]))
                if usuario and historico_ativo
                else []
            )
            nome_prompt = cliente["nome"] if personalizacao_ativa else "cliente"
            ild_prompt = ild if personalizacao_ativa else 50
            prompt = criar_prompt(
                nome_prompt,
                ild_prompt,
                perfil_resposta,
                payload.mensagem,
                contexto,
                modo_guiado=payload.modo_guiado,
            )
            resposta = GroqService(settings).gerar_resposta(prompt, perfil_resposta)
            origem = "groq"
        except Exception:
            logger.exception("Falha ao gerar resposta com Groq; usando fallback")
            logger.info("Gerando resposta com fallback local")
            resposta, origem = gerar_resposta_fallback(
                perfil_resposta, payload.mensagem, payload.modo_guiado
            ), "fallback"

    # Historico so e associado a uma conta autenticada; visitantes do demo nao
    # podem gravar mensagens no perfil de outro cliente.
    if usuario and historico_ativo:
        AtendimentoService(settings).registrar_interacao(
            cliente_id=int(cliente["id"]),
            mensagem_cliente=payload.mensagem,
            resposta_assistente=resposta,
            origem_resposta=origem,
            perfil=perfil_real,
            ild=ild,
        )

    return ChatResponse(
        cliente_id=cliente["id"],
        nome=cliente["nome"],
        ild=ild,
        perfil=perfil_real,
        resposta=resposta,
        origem_resposta=origem,
    )
