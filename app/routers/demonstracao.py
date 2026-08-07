from fastapi import APIRouter

from app.models.schemas import (
    DemonstracaoIldItemResponse,
    DemonstracaoIldRequest,
    DemonstracaoIldResponse,
)
from app.services.demo_service import gerar_resposta_demo

router = APIRouter(prefix="/demonstracao", tags=["demonstracao"])


@router.post("/ild", response_model=DemonstracaoIldResponse)
def comparar_atendimento(payload: DemonstracaoIldRequest) -> DemonstracaoIldResponse:
    configuracoes = (
        (25, "iniciante", "Uma ação por vez, linguagem simples e confirmação"),
        (50, "intermediario", "Instruções claras, com detalhes moderados"),
        (85, "avancado", "Resposta curta, direta e orientada a atalhos"),
    )
    comparacoes = [
        DemonstracaoIldItemResponse(
            ild=ild,
            perfil=perfil,
            estilo=estilo,
            resposta=gerar_resposta_demo(perfil, payload.mensagem, modo_guiado=perfil == "iniciante"),
        )
        for ild, perfil, estilo in configuracoes
    ]
    return DemonstracaoIldResponse(mensagem=payload.mensagem, comparacoes=comparacoes)
