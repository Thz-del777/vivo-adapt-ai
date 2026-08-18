from typing import Any

from app.core.supabase_client import get_supabase_data_client


class SupabaseEventoRepository:
    """Registra telemetria do ILD somente pelo backend autenticado."""

    def __init__(self, url: str, key: str) -> None:
        self.client = get_supabase_data_client(url, key)

    def registrar(
        self,
        *,
        cliente_id: int,
        evento_chave: str,
        tipo_evento: str,
        nome_tarefa: str | None,
        duracao_segundos: int | None,
        detalhes: dict[str, Any],
    ) -> dict[str, Any]:
        resposta = self.client.rpc(
            "registrar_evento_digital",
            {
                "p_cliente_id": cliente_id,
                "p_evento_chave": evento_chave,
                "p_tipo_evento": tipo_evento,
                "p_nome_tarefa": nome_tarefa,
                "p_duracao_segundos": duracao_segundos,
                "p_detalhes": detalhes,
            },
        ).execute()
        if not resposta.data:
            raise RuntimeError("Evento digital nao foi registrado")
        dados = resposta.data[0] if isinstance(resposta.data, list) else resposta.data
        return dict(dados)
