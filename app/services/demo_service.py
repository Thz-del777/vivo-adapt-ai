from app.services.fallback_service import gerar_resposta_fallback


def gerar_resposta_demo(perfil: str, mensagem: str, modo_guiado: bool = False) -> str:
    return gerar_resposta_fallback(perfil, mensagem, modo_guiado)
