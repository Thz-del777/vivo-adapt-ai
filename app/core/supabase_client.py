from functools import lru_cache
from typing import Any


@lru_cache(maxsize=4)
def get_supabase_data_client(url: str, key: str) -> Any:
    """Reutiliza o cliente de dados em vez de abrir uma pilha HTTP por requisição."""
    from supabase import create_client

    return create_client(url, key)


@lru_cache(maxsize=4)
def get_supabase_auth_client(url: str, key: str) -> Any:
    """Mantém um cliente separado para Auth não alterar o token do cliente de dados."""
    from supabase import create_client

    return create_client(url, key)
