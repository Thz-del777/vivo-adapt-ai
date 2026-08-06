from app.services.fallback_service import gerar_resposta_fallback


def gerar_resposta_demo(perfil: str, mensagem: str) -> str:
    return gerar_resposta_fallback(perfil, mensagem)
