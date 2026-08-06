"""Escolhe a fonte de clientes e garante fallback para o arquivo local."""

import logging
from typing import Any

from app.core.config import Settings
from app.repositories.json_cliente_repository import JsonClienteRepository
from app.repositories.supabase_cliente_repository import SupabaseClienteRepository

logger = logging.getLogger(__name__)


class ClienteRepository:
    def __init__(self, settings: Settings, json_repository: JsonClienteRepository | None = None) -> None:
        self.settings = settings
        self.json_repository = json_repository or JsonClienteRepository()

    def get_by_id(self, cliente_id: int) -> dict[str, Any] | None:
        if self.settings.use_supabase:
            if not self.settings.supabase_url or not self.settings.supabase_key:
                logger.warning("Supabase ativado sem credenciais; usando JSON local")
            else:
                try:
                    logger.info("Tentando buscar cliente no Supabase")
                    cliente = SupabaseClienteRepository(
                        self.settings.supabase_url, self.settings.supabase_key
                    ).get_by_id(cliente_id)
                    if cliente:
                        return cliente
                    logger.info("Cliente não encontrado no Supabase; usando JSON local como fallback")
                except Exception:
                    logger.exception("Falha ao consultar Supabase; usando JSON local")
        logger.info("Buscando cliente no JSON local")
        return self.json_repository.get_by_id(cliente_id)

    def get_by_auth_user_id(self, auth_user_id: str) -> dict[str, Any] | None:
        """Busca o cliente associado a uma conta autenticada no Supabase."""
        if not self.settings.supabase_url or not self.settings.supabase_key:
            logger.warning("Supabase nao configurado para localizar a conta autenticada")
            return None
        try:
            return SupabaseClienteRepository(
                self.settings.supabase_url, self.settings.supabase_key
            ).get_by_auth_user_id(auth_user_id)
        except Exception:
            logger.exception("Falha ao buscar cliente associado a conta autenticada")
            return None
