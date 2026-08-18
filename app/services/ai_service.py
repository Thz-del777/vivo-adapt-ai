import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)


class GroqService:
    """Cliente Groq chamado apenas pelo backend."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def gerar_resposta(self, prompt: str, perfil: str) -> str:
        if not self.settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY nao configurada")

        from groq import Groq, NotFoundError

        client = Groq(api_key=self.settings.groq_api_key, timeout=20.0, max_retries=1)
        limites_por_perfil = {
            "iniciante": 180,
            "intermediario": 240,
            "avancado": 300,
        }
        parametros = {
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Voce e Mimo, assistente da Vivo AdaptAI. "
                        "Responda em portugues do Brasil de forma clara, acolhedora e adaptada ao perfil do cliente."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
            "max_completion_tokens": limites_por_perfil.get(perfil, 240),
        }
        try:
            resposta = client.chat.completions.create(
                model=self.settings.groq_model,
                **parametros,
            )
        except NotFoundError:
            modelo_alternativo = self.settings.groq_fallback_model
            if not modelo_alternativo or modelo_alternativo == self.settings.groq_model:
                raise
            logger.warning(
                "Modelo Groq configurado indisponivel; tentando modelo alternativo %s",
                modelo_alternativo,
            )
            resposta = client.chat.completions.create(
                model=modelo_alternativo,
                **parametros,
            )
        conteudo = resposta.choices[0].message.content if resposta.choices else None
        if not conteudo:
            raise RuntimeError("Groq retornou uma resposta vazia")
        return conteudo.strip()
