from app.core.config import Settings


class GroqService:
    """Cliente Groq chamado apenas pelo backend."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def gerar_resposta(self, prompt: str, perfil: str) -> str:
        if not self.settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY nao configurada")

        from groq import Groq

        client = Groq(api_key=self.settings.groq_api_key)
        limites_por_perfil = {
            "iniciante": 180,
            "intermediario": 240,
            "avancado": 300,
        }
        resposta = client.chat.completions.create(
            model=self.settings.groq_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Voce e Mimo, assistente da Vivo AdaptAI. "
                        "Responda em portugues do Brasil de forma clara, acolhedora e adaptada ao perfil do cliente."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_completion_tokens=limites_por_perfil.get(perfil, 240),
        )
        conteudo = resposta.choices[0].message.content if resposta.choices else None
        if not conteudo:
            raise RuntimeError("Groq retornou uma resposta vazia")
        return conteudo.strip()
