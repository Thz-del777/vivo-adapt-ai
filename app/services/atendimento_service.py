import logging

from app.core.config import Settings
from app.repositories.supabase_conversa_repository import SupabaseConversaRepository

logger = logging.getLogger(__name__)


class AtendimentoService:
    """Registra o atendimento sem tornar o banco um ponto unico de falha."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def registrar_interacao(
        self,
        *,
        cliente_id: int,
        mensagem_cliente: str,
        resposta_assistente: str,
        origem_resposta: str,
        perfil: str,
        ild: int,
    ) -> None:
        if not self.settings.use_supabase:
            return
        if not self.settings.supabase_url or not self.settings.supabase_key:
            logger.warning("Historico nao salvo: Supabase nao configurado")
            return

        try:
            repositorio = SupabaseConversaRepository(
                self.settings.supabase_url, self.settings.supabase_key
            )
            conversa = repositorio.obter_ou_criar_conversa_aberta(cliente_id)
            repositorio.registrar_mensagem(
                int(conversa["id"]),
                "cliente",
                mensagem_cliente,
                perfil=perfil,
                ild=ild,
            )
            repositorio.registrar_mensagem(
                int(conversa["id"]),
                "assistente",
                resposta_assistente,
                origem_resposta=origem_resposta,
                perfil=perfil,
                ild=ild,
            )
        except Exception:
            # O usuario recebe a resposta mesmo se o historico nao puder ser salvo.
            logger.exception("Falha ao salvar historico do atendimento")

    def obter_contexto_recente(self, cliente_id: int) -> list[dict[str, str]]:
        """Recupera apenas as ultimas mensagens da conversa aberta do cliente."""
        if not self.settings.use_supabase:
            return []
        if not self.settings.supabase_url or not self.settings.supabase_key:
            return []
        try:
            repositorio = SupabaseConversaRepository(
                self.settings.supabase_url, self.settings.supabase_key
            )
            return repositorio.obter_mensagens_recentes_conversa_aberta(cliente_id)
        except Exception:
            logger.exception("Falha ao recuperar contexto da conversa")
            return []
