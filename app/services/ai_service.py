import logging
from functools import lru_cache
from typing import Any

from app.core.config import Settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=2)
def _get_groq_client(api_key: str) -> Any:
    from groq import Groq

    return Groq(api_key=api_key, timeout=20.0, max_retries=1)


class GroqService:
    """Cliente Groq chamado apenas pelo backend."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def gerar_resposta(self, prompt: str, perfil: str) -> str:
        if not self.settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY nao configurada")

        from groq import NotFoundError

        client = _get_groq_client(self.settings.groq_api_key)
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
