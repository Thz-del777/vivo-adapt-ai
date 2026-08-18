from datetime import datetime, timezone
import logging
import secrets
from typing import Any

from app.repositories.supabase_conversa_repository import SupabaseConversaRepository
from app.core.supabase_client import get_supabase_data_client


logger = logging.getLogger(__name__)


class SupabaseSolicitacaoRepository:
    """Registra pedidos de atendimento humano vinculados ao cliente autenticado."""

    def __init__(self, url: str, key: str) -> None:
        self.client = get_supabase_data_client(url, key)
        self.conversas = SupabaseConversaRepository(url, key)

    def criar(self, cliente_id: int, assunto: str, descricao: str) -> dict[str, Any]:
        conversa = self.conversas.obter_ou_criar_conversa_aberta(cliente_id)
        protocolo = f"VA-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}"
        criada = (
            self.client.table("solicitacoes_atendimento")
            .insert(
                {
                    "cliente_id": cliente_id,
                    "conversa_id": int(conversa["id"]),
                    "tipo": assunto,
                    "descricao": descricao,
                    "status": "aberta",
                    "protocolo": protocolo,
                }
            )
            .execute()
        )
        if not criada.data:
            raise RuntimeError("Nao foi possivel registrar a solicitacao")

        try:
            self.client.table("notificacoes").insert(
                {
                    "cliente_id": cliente_id,
                    "tipo": "atendimento",
                    "titulo": "Atendimento humano solicitado",
                    "mensagem": f"Recebemos seu pedido. Acompanhe pelo protocolo {protocolo}.",
                    "link": "central-de-ajuda.html",
                    "metadados": {"protocolo": protocolo},
                }
            ).execute()
        except Exception:
            logger.warning("Solicitacao criada, mas a notificacao falhou", exc_info=True)

        try:
            self.conversas.registrar_mensagem(
                int(conversa["id"]),
                "sistema",
                f"Atendimento humano solicitado. Protocolo: {protocolo}",
            )
            (
                self.client.table("conversas")
                .update({"status": "transferida"})
                .eq("id", int(conversa["id"]))
                .eq("cliente_id", cliente_id)
                .execute()
            )
        except Exception:
            # A solicitacao ja existe; nao falhar evita que uma nova tentativa
            # do usuario crie outro protocolo para o mesmo pedido.
            logger.warning(
                "Solicitacao %s criada, mas a conversa nao foi atualizada.",
                protocolo,
                exc_info=True,
            )
        return criada.data[0]
