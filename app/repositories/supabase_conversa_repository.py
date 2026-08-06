from datetime import datetime, timezone
from typing import Any


class SupabaseConversaRepository:
    """Persistencia de conversas e mensagens, usada somente pelo backend."""

    def __init__(self, url: str, key: str) -> None:
        from supabase import create_client

        self.client = create_client(url, key)

    def obter_ou_criar_conversa_aberta(self, cliente_id: int) -> dict[str, Any]:
        existente = (
            self.client.table("conversas")
            .select("*")
            .eq("cliente_id", cliente_id)
            .eq("status", "aberta")
            .order("iniciada_em", desc=True)
            .limit(1)
            .execute()
        )
        if existente.data:
            return existente.data[0]

        criada = (
            self.client.table("conversas")
            .insert(
                {
                    "cliente_id": cliente_id,
                    "status": "aberta",
                    "canal": "web",
                    "iniciada_em": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )
        if not criada.data:
            raise RuntimeError("Nao foi possivel criar a conversa")
        return criada.data[0]

    def registrar_mensagem(
        self,
        conversa_id: int,
        remetente: str,
        conteudo: str,
        *,
        origem_resposta: str | None = None,
        perfil: str | None = None,
        ild: int | None = None,
    ) -> None:
        dados: dict[str, Any] = {
            "conversa_id": conversa_id,
            "remetente": remetente,
            "conteudo": conteudo,
        }
        if origem_resposta is not None:
            dados["origem_resposta"] = origem_resposta
        if perfil is not None:
            dados["perfil_no_momento"] = perfil
        if ild is not None:
            dados["ild_no_momento"] = ild
        self.client.table("mensagens").insert(dados).execute()

    def obter_mensagens_recentes_conversa_aberta(
        self, cliente_id: int, limite: int = 6
    ) -> list[dict[str, Any]]:
        conversa = (
            self.client.table("conversas")
            .select("id")
            .eq("cliente_id", cliente_id)
            .eq("status", "aberta")
            .order("iniciada_em", desc=True)
            .limit(1)
            .execute()
        )
        if not conversa.data:
            return []

        mensagens = (
            self.client.table("mensagens")
            .select("remetente,conteudo,created_at")
            .eq("conversa_id", conversa.data[0]["id"])
            .order("created_at", desc=True)
            .limit(limite)
            .execute()
        ).data
        return list(reversed(mensagens))

    def encerrar_conversas_abertas(self, cliente_id: int) -> list[dict[str, Any]]:
        """Encerra apenas conversas abertas pertencentes ao cliente informado."""
        encerradas = (
            self.client.table("conversas")
            .update(
                {
                    "status": "encerrada",
                    "encerrada_em": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("cliente_id", cliente_id)
            .eq("status", "aberta")
            .select("id,cliente_id,status,iniciada_em,encerrada_em")
            .execute()
        ).data
        return encerradas or []

    def listar_conversas_cliente(self, cliente_id: int, limite: int = 50) -> list[dict[str, Any]]:
        conversas = (
            self.client.table("conversas")
            .select("*")
            .eq("cliente_id", cliente_id)
            .order("iniciada_em", desc=True)
            .limit(limite)
            .execute()
        ).data
        if not conversas:
            return []

        ids = [conversa["id"] for conversa in conversas]
        mensagens = (
            self.client.table("mensagens")
            .select("*")
            .in_("conversa_id", ids)
            .order("created_at", desc=True)
            .execute()
        ).data
        ultima_por_conversa: dict[int, dict[str, Any]] = {}
        for mensagem in mensagens:
            ultima_por_conversa.setdefault(int(mensagem["conversa_id"]), mensagem)

        for conversa in conversas:
            conversa["ultima_mensagem"] = ultima_por_conversa.get(int(conversa["id"]))
        return conversas

    def obter_conversa_cliente(self, conversa_id: int, cliente_id: int) -> dict[str, Any] | None:
        conversa = (
            self.client.table("conversas")
            .select("*")
            .eq("id", conversa_id)
            .eq("cliente_id", cliente_id)
            .limit(1)
            .execute()
        )
        if not conversa.data:
            return None

        dados = conversa.data[0]
        dados["mensagens"] = (
            self.client.table("mensagens")
            .select("*")
            .eq("conversa_id", conversa_id)
            .order("created_at")
            .execute()
        ).data
        dados["ultima_mensagem"] = dados["mensagens"][-1] if dados["mensagens"] else None
        return dados
