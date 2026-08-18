from datetime import datetime, timezone
from typing import Any

from app.core.supabase_client import get_supabase_data_client


TIPOS_CONSENTIMENTO = (
    "personalizacao",
    "historico",
    "dados_uso_anonimos",
    "comunicacoes",
)


class SupabasePrivacidadeRepository:
    """Operações de privacidade executadas somente pelo backend."""

    def __init__(self, url: str, key: str) -> None:
        self.client = get_supabase_data_client(url, key)

    def listar_consentimentos(self, cliente_id: int) -> list[dict[str, Any]]:
        return (
            self.client.table("consentimentos_privacidade")
            .select("tipo,concedido,versao_politica,atualizado_em")
            .eq("cliente_id", cliente_id)
            .order("tipo")
            .execute()
        ).data or []

    def salvar_consentimentos(
        self, cliente_id: int, consentimentos: dict[str, bool], versao: str = "1.0"
    ) -> list[dict[str, Any]]:
        agora = datetime.now(timezone.utc).isoformat()
        linhas = [
            {
                "cliente_id": cliente_id,
                "tipo": tipo,
                "concedido": bool(concedido),
                "versao_politica": versao,
                "origem": "central_privacidade",
                "atualizado_em": agora,
            }
            for tipo, concedido in consentimentos.items()
            if tipo in TIPOS_CONSENTIMENTO
        ]
        if linhas:
            self.client.table("consentimentos_privacidade").upsert(
                linhas, on_conflict="cliente_id,tipo"
            ).execute()
        return self.listar_consentimentos(cliente_id)

    def atualizar_preferencias_consentimento(
        self, auth_user_id: str, preferencias: dict[str, Any]
    ) -> None:
        self.client.table("clientes").update({"preferencias": preferencias}).eq(
            "auth_user_id", auth_user_id
        ).execute()

    def exportar_dados(self, cliente: dict[str, Any]) -> dict[str, Any]:
        cliente_id = int(cliente["id"])
        conversas = (
            self.client.table("conversas").select("*").eq("cliente_id", cliente_id).execute()
        ).data or []
        conversa_ids = [item["id"] for item in conversas]
        mensagens = self._listar_por_ids("mensagens", "conversa_id", conversa_ids)
        solicitacoes = (
            self.client.table("solicitacoes_atendimento")
            .select("*")
            .eq("cliente_id", cliente_id)
            .execute()
        ).data or []
        solicitacao_ids = [item["id"] for item in solicitacoes]

        return {
            "cliente": cliente,
            "conversas": conversas,
            "mensagens": mensagens,
            "eventos_digitais": self._listar_cliente("eventos_digitais", cliente_id),
            "historico_ild": self._listar_cliente("historico_ild", cliente_id),
            "solicitacoes_atendimento": solicitacoes,
            "atendimento_eventos": self._listar_por_ids(
                "atendimento_eventos", "solicitacao_id", solicitacao_ids
            ),
            "feedback_atendimento": self._listar_cliente("feedback_atendimento", cliente_id),
            "notificacoes": self._listar_cliente("notificacoes", cliente_id),
            "consentimentos": self.listar_consentimentos(cliente_id),
            "dispositivos": (
                self.client.table("sessoes_dispositivos")
                .select("navegador,sistema,tipo_dispositivo,criada_em,ultimo_acesso_em,revogada_em")
                .eq("auth_user_id", cliente.get("auth_user_id"))
                .execute()
            ).data
            or [],
        }

    def limpar_historico(self, cliente_id: int) -> dict[str, int]:
        conversas = (
            self.client.table("conversas").select("id").eq("cliente_id", cliente_id).execute()
        ).data or []
        conversa_ids = [item["id"] for item in conversas]
        solicitacoes = (
            self.client.table("solicitacoes_atendimento")
            .select("id")
            .eq("cliente_id", cliente_id)
            .execute()
        ).data or []
        solicitacao_ids = [item["id"] for item in solicitacoes]

        removidos = {
            "atendimento_eventos": self._excluir_por_ids(
                "atendimento_eventos", "solicitacao_id", solicitacao_ids
            ),
            "feedback_atendimento": self._excluir_cliente("feedback_atendimento", cliente_id),
            "solicitacoes_atendimento": self._excluir_cliente(
                "solicitacoes_atendimento", cliente_id
            ),
            "mensagens": self._excluir_por_ids("mensagens", "conversa_id", conversa_ids),
            "conversas": self._excluir_cliente("conversas", cliente_id),
        }
        self.client.table("clientes").update({"historico_atendimento": []}).eq(
            "id", cliente_id
        ).execute()
        return removidos

    def excluir_dados_conta(self, cliente_id: int) -> dict[str, int]:
        removidos = self.limpar_historico(cliente_id)
        for tabela in (
            "notificacoes",
            "eventos_digitais",
            "historico_ild",
            "consentimentos_privacidade",
        ):
            removidos[tabela] = self._excluir_cliente(tabela, cliente_id)
        resposta = self.client.table("clientes").delete().eq("id", cliente_id).execute()
        removidos["clientes"] = len(resposta.data or [])
        return removidos

    def _listar_cliente(self, tabela: str, cliente_id: int) -> list[dict[str, Any]]:
        return self.client.table(tabela).select("*").eq("cliente_id", cliente_id).execute().data or []

    def _listar_por_ids(self, tabela: str, coluna: str, ids: list[int]) -> list[dict[str, Any]]:
        if not ids:
            return []
        return self.client.table(tabela).select("*").in_(coluna, ids).execute().data or []

    def _excluir_cliente(self, tabela: str, cliente_id: int) -> int:
        resposta = self.client.table(tabela).delete().eq("cliente_id", cliente_id).execute()
        return len(resposta.data or [])

    def _excluir_por_ids(self, tabela: str, coluna: str, ids: list[int]) -> int:
        if not ids:
            return 0
        resposta = self.client.table(tabela).delete().in_(coluna, ids).execute()
        return len(resposta.data or [])
