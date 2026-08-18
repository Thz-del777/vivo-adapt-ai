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
        limite = 512
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
            "max_completion_tokens": limite,
        }

        def completar(modelo: str, max_tokens: int = limite):
            opcoes = {**parametros, "max_completion_tokens": max_tokens}
            if modelo.startswith("openai/gpt-oss"):
                opcoes.update(reasoning_effort="low", reasoning_format="hidden")
            return client.chat.completions.create(model=modelo, **opcoes)

        try:
            modelo_usado = self.settings.groq_model
            resposta = completar(modelo_usado)
        except NotFoundError:
            modelo_alternativo = self.settings.groq_fallback_model
            if not modelo_alternativo or modelo_alternativo == self.settings.groq_model:
                raise
            logger.warning(
                "Modelo Groq configurado indisponivel; tentando modelo alternativo %s",
                modelo_alternativo,
            )
            modelo_usado = modelo_alternativo
            resposta = completar(modelo_usado)
        if resposta.choices and resposta.choices[0].finish_reason == "length":
            logger.warning("Resposta Groq atingiu o limite; repetindo com margem maior")
            resposta = completar(modelo_usado, 1024)
        conteudo = resposta.choices[0].message.content if resposta.choices else None
        if not conteudo:
            raise RuntimeError("Groq retornou uma resposta vazia")
        return conteudo.strip()
