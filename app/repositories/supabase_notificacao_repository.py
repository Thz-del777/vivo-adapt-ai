from datetime import datetime, timezone
from typing import Any

from app.core.supabase_client import get_supabase_data_client


class SupabaseNotificacaoRepository:
    """Persistencia de avisos pessoais, acessada somente pelo backend."""

    def __init__(self, url: str, key: str) -> None:
        self.client = get_supabase_data_client(url, key)

    def listar(self, cliente_id: int, limite: int = 50) -> list[dict[str, Any]]:
        return (
            self.client.table("notificacoes")
            .select("id,tipo,titulo,mensagem,link,lida,criada_em")
            .eq("cliente_id", cliente_id)
            .eq("arquivada", False)
            .order("criada_em", desc=True)
            .limit(limite)
            .execute()
        ).data or []

    def contar_nao_lidas(self, cliente_id: int) -> int:
        resposta = (
            self.client.table("notificacoes")
            .select("id", count="exact")
            .eq("cliente_id", cliente_id)
            .eq("arquivada", False)
            .eq("lida", False)
            .execute()
        )
        return int(resposta.count or 0)

    def marcar_lida(self, notificacao_id: int, cliente_id: int) -> bool:
        resposta = (
            self.client.table("notificacoes")
            .update({"lida": True, "lida_em": datetime.now(timezone.utc).isoformat()})
            .eq("id", notificacao_id)
            .eq("cliente_id", cliente_id)
            .eq("arquivada", False)
            .select("id")
            .execute()
        )
        return bool(resposta.data)

    def marcar_todas_lidas(self, cliente_id: int) -> None:
        (
            self.client.table("notificacoes")
            .update({"lida": True, "lida_em": datetime.now(timezone.utc).isoformat()})
            .eq("cliente_id", cliente_id)
            .eq("arquivada", False)
            .eq("lida", False)
            .execute()
        )

    def arquivar(self, notificacao_id: int, cliente_id: int) -> bool:
        resposta = (
            self.client.table("notificacoes")
            .update({"arquivada": True})
            .eq("id", notificacao_id)
            .eq("cliente_id", cliente_id)
            .select("id")
            .execute()
        )
        return bool(resposta.data)

    def criar(
        self,
        cliente_id: int,
        tipo: str,
        titulo: str,
        mensagem: str,
        link: str | None = None,
        metadados: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        resposta = (
            self.client.table("notificacoes")
            .insert(
                {
                    "cliente_id": cliente_id,
                    "tipo": tipo,
                    "titulo": titulo,
                    "mensagem": mensagem,
                    "link": link,
                    "metadados": metadados or {},
                }
            )
            .execute()
        )
        if not resposta.data:
            raise RuntimeError("Nao foi possivel criar a notificacao")
        return resposta.data[0]
