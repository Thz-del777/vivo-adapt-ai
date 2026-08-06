from typing import Any


class SupabaseClienteRepository:
    """Repositório opcional; erros são tratados pelo roteador com fallback local."""

    def __init__(self, url: str, key: str) -> None:
        from supabase import create_client

        self.client = create_client(url, key)

    def get_by_id(self, cliente_id: int) -> dict[str, Any] | None:
        response = self.client.table("clientes").select("*").eq("id", cliente_id).limit(1).execute()
        return response.data[0] if response.data else None

    def get_by_auth_user_id(self, auth_user_id: str) -> dict[str, Any] | None:
        """Obtem o cliente vinculado a conta criada no Supabase Auth."""
        response = (
            self.client.table("clientes")
            .select("*")
            .eq("auth_user_id", auth_user_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def salvar_avaliacao_inicial(
        self,
        auth_user_id: str,
        indicadores: dict[str, int],
        ild: int,
        perfil: str,
    ) -> dict[str, Any] | None:
        """Salva os indicadores base e registra o primeiro calculo do ILD."""
        response = (
            self.client.table("clientes")
            .update(indicadores)
            .eq("auth_user_id", auth_user_id)
            .execute()
        )
        if not response.data:
            return None

        cliente = response.data[0]
        self.client.table("historico_ild").insert(
            {
                "cliente_id": cliente["id"],
                "ild": ild,
                "perfil": perfil,
                "motivo_calculo": "avaliacao_inicial",
                "componentes_calculo": indicadores,
            }
        ).execute()
        return cliente

    def atualizar_perfil(
        self, auth_user_id: str, nome: str, telefone: str | None
    ) -> dict[str, Any] | None:
        """Atualiza apenas dados permitidos da conta dona do perfil."""
        dados = {"nome": nome, "telefone": telefone}
        response = (
            self.client.table("clientes")
            .update(dados)
            .eq("auth_user_id", auth_user_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def atualizar_preferencias(
        self, auth_user_id: str, preferencias: dict[str, Any]
    ) -> dict[str, Any] | None:
        response = (
            self.client.table("clientes")
            .update({"preferencias": preferencias})
            .eq("auth_user_id", auth_user_id)
            .select("id,auth_user_id,preferencias")
            .execute()
        )
        return response.data[0] if response.data else None
