import logging
from datetime import datetime, timezone
from typing import Any

from app.core.supabase_client import get_supabase_data_client
from app.services.ild_service import calcular_ild, classificar_perfil


logger = logging.getLogger(__name__)


class SupabaseOperacaoRepository:
    """Fila e acoes do atendimento humano, acessadas somente pelo backend."""

    def __init__(self, url: str, key: str) -> None:
        self.client = get_supabase_data_client(url, key)

    @staticmethod
    def _enriquecer(solicitacao: dict[str, Any], cliente: dict[str, Any], ultima: str | None) -> dict[str, Any]:
        ild = calcular_ild(cliente)
        return {
            **solicitacao,
            "cliente_nome": cliente.get("nome") or f"Cliente {cliente['id']}",
            "ild": ild,
            "perfil": classificar_perfil(ild),
            "ultima_mensagem": ultima,
        }

    def listar(self, status: str | None = None, atendente_id: str | None = None) -> list[dict[str, Any]]:
        consulta = self.client.table("solicitacoes_atendimento").select("*")
        if status:
            consulta = consulta.eq("status", status)
        if atendente_id:
            consulta = consulta.eq("atendente_auth_user_id", atendente_id)
        solicitacoes = consulta.order("criada_em", desc=True).limit(200).execute().data or []
        if not solicitacoes:
            return []

        clientes = (
            self.client.table("clientes")
            .select("id,nome,acessos_app,chamadas_suporte,tempo_medio_tarefa,erros,tarefas_abandonadas")
            .in_("id", list({item["cliente_id"] for item in solicitacoes}))
            .execute()
        ).data or []
        clientes_por_id = {int(item["id"]): item for item in clientes}

        conversas_ids = list({item["conversa_id"] for item in solicitacoes})
        mensagens = (
            self.client.table("mensagens")
            .select("conversa_id,conteudo,created_at")
            .in_("conversa_id", conversas_ids)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        ultima_por_conversa: dict[int, str] = {}
        for mensagem in mensagens:
            ultima_por_conversa.setdefault(int(mensagem["conversa_id"]), mensagem["conteudo"])

        return [
            self._enriquecer(
                item,
                clientes_por_id.get(int(item["cliente_id"]), {"id": item["cliente_id"], "nome": "Cliente"}),
                ultima_por_conversa.get(int(item["conversa_id"])),
            )
            for item in solicitacoes
        ]

    def obter(self, solicitacao_id: int) -> dict[str, Any] | None:
        resposta = (
            self.client.table("solicitacoes_atendimento")
            .select("*")
            .eq("id", solicitacao_id)
            .limit(1)
            .execute()
        )
        if not resposta.data:
            return None
        solicitacao = resposta.data[0]
        cliente_resposta = (
            self.client.table("clientes")
            .select("id,nome,acessos_app,chamadas_suporte,tempo_medio_tarefa,erros,tarefas_abandonadas")
            .eq("id", solicitacao["cliente_id"])
            .limit(1)
            .execute()
        )
        cliente = cliente_resposta.data[0] if cliente_resposta.data else {"id": solicitacao["cliente_id"], "nome": "Cliente"}
        mensagens = (
            self.client.table("mensagens")
            .select("id,remetente,conteudo,origem_resposta,perfil_no_momento,ild_no_momento,created_at")
            .eq("conversa_id", solicitacao["conversa_id"])
            .order("created_at")
            .execute()
        ).data or []
        detalhe = self._enriquecer(solicitacao, cliente, mensagens[-1]["conteudo"] if mensagens else None)
        detalhe["mensagens"] = mensagens
        return detalhe

    def _registrar_evento(self, solicitacao_id: int, atendente_id: str, atendente_nome: str, tipo: str, detalhes: dict | None = None) -> None:
        try:
            self.client.table("atendimento_eventos").insert(
                {
                    "solicitacao_id": solicitacao_id,
                    "ator_auth_user_id": atendente_id,
                    "ator_nome": atendente_nome,
                    "tipo_evento": tipo,
                    "detalhes": detalhes or {},
                }
            ).execute()
        except Exception:
            logger.warning("Operacao concluida, mas a auditoria do atendimento falhou", exc_info=True)

    def assumir(self, solicitacao_id: int, atendente_id: str, atendente_nome: str) -> dict[str, Any] | None:
        agora = datetime.now(timezone.utc).isoformat()
        resposta = (
            self.client.table("solicitacoes_atendimento")
            .update(
                {
                    "status": "em_andamento",
                    "atendente_auth_user_id": atendente_id,
                    "atendente_nome": atendente_nome,
                    "assumida_em": agora,
                    "atualizada_em": agora,
                }
            )
            .eq("id", solicitacao_id)
            .eq("status", "aberta")
            .select("*")
            .execute()
        )
        if not resposta.data:
            return None
        self._registrar_evento(solicitacao_id, atendente_id, atendente_nome, "assumida")
        return resposta.data[0]

    def responder(self, solicitacao_id: int, atendente_id: str, atendente_nome: str, mensagem: str) -> bool:
        solicitacao = self.obter(solicitacao_id)
        if not solicitacao or solicitacao["status"] != "em_andamento" or str(solicitacao.get("atendente_auth_user_id")) != atendente_id:
            return False
        agora = datetime.now(timezone.utc).isoformat()
        self.client.table("mensagens").insert(
            {
                "conversa_id": solicitacao["conversa_id"],
                "remetente": "atendente",
                "conteudo": mensagem,
                "origem_resposta": "humano",
                "perfil_no_momento": solicitacao["perfil"],
                "ild_no_momento": solicitacao["ild"],
            }
        ).execute()
        (
            self.client.table("solicitacoes_atendimento")
            .update({"ultima_resposta_em": agora, "atualizada_em": agora})
            .eq("id", solicitacao_id)
            .eq("atendente_auth_user_id", atendente_id)
            .execute()
        )
        try:
            self.client.table("notificacoes").insert(
                {
                    "cliente_id": solicitacao["cliente_id"],
                    "tipo": "atendimento",
                    "titulo": "Nova resposta do atendente",
                    "mensagem": mensagem[:500],
                    "link": "historico.html",
                    "metadados": {"protocolo": solicitacao.get("protocolo")},
                }
            ).execute()
        except Exception:
            logger.warning("Resposta salva, mas a notificacao ao cliente falhou", exc_info=True)
        self._registrar_evento(solicitacao_id, atendente_id, atendente_nome, "resposta")
        return True

    def concluir(self, solicitacao_id: int, atendente_id: str, atendente_nome: str) -> bool:
        solicitacao = self.obter(solicitacao_id)
        if not solicitacao or solicitacao["status"] != "em_andamento" or str(solicitacao.get("atendente_auth_user_id")) != atendente_id:
            return False
        agora = datetime.now(timezone.utc).isoformat()
        resposta = (
            self.client.table("solicitacoes_atendimento")
            .update({"status": "concluida", "resolvida_em": agora, "atualizada_em": agora})
            .eq("id", solicitacao_id)
            .eq("status", "em_andamento")
            .eq("atendente_auth_user_id", atendente_id)
            .select("id")
            .execute()
        )
        if not resposta.data:
            return False
        (
            self.client.table("conversas")
            .update({"status": "encerrada", "encerrada_em": agora})
            .eq("id", solicitacao["conversa_id"])
            .execute()
        )
        try:
            self.client.table("notificacoes").insert(
                {
                    "cliente_id": solicitacao["cliente_id"],
                    "tipo": "atendimento",
                    "titulo": "Atendimento concluido",
                    "mensagem": f"O protocolo {solicitacao.get('protocolo') or solicitacao_id} foi concluido.",
                    "link": "historico.html",
                }
            ).execute()
        except Exception:
            logger.warning("Atendimento concluido, mas a notificacao falhou", exc_info=True)
        self._registrar_evento(solicitacao_id, atendente_id, atendente_nome, "concluida")
        return True
