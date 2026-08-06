from datetime import datetime, timedelta, timezone
from typing import Any


def identificar_dispositivo(user_agent: str | None) -> dict[str, str]:
    agente = user_agent or ""
    if "Edg/" in agente:
        navegador = "Microsoft Edge"
    elif "Firefox/" in agente:
        navegador = "Mozilla Firefox"
    elif "Chrome/" in agente or "CriOS/" in agente:
        navegador = "Google Chrome"
    elif "Safari/" in agente:
        navegador = "Safari"
    else:
        navegador = "Navegador desconhecido"

    if "Android" in agente:
        sistema = "Android"
    elif "iPhone" in agente or "iPad" in agente:
        sistema = "iOS"
    elif "Windows" in agente:
        sistema = "Windows"
    elif "Mac OS" in agente or "Macintosh" in agente:
        sistema = "macOS"
    elif "Linux" in agente:
        sistema = "Linux"
    else:
        sistema = "Sistema desconhecido"

    tipo = "celular" if any(valor in agente for valor in ("Mobile", "Android", "iPhone")) else "computador"
    return {"navegador": navegador, "sistema": sistema, "tipo_dispositivo": tipo}


class SupabaseSessaoRepository:
    """Controle complementar de dispositivos, sem IP nem user-agent bruto."""

    def __init__(self, url: str, key: str) -> None:
        from supabase import create_client

        self.client = create_client(url, key)

    def registrar(
        self, session_id: str, auth_user_id: str, user_agent: str | None = None
    ) -> dict[str, Any]:
        agora = datetime.now(timezone.utc).isoformat()
        dados = {
            "id": session_id,
            "auth_user_id": auth_user_id,
            **identificar_dispositivo(user_agent),
            "ultimo_acesso_em": agora,
            "atualizada_em": agora,
            "revogada_em": None,
        }
        resposta = self.client.table("sessoes_dispositivos").upsert(dados).execute()
        if not resposta.data:
            raise RuntimeError("Nao foi possivel registrar o dispositivo")
        return resposta.data[0]

    def validar_ou_registrar(self, session_id: str, auth_user_id: str) -> None:
        resposta = (
            self.client.table("sessoes_dispositivos")
            .select("id,auth_user_id,ultimo_acesso_em,revogada_em")
            .eq("id", session_id)
            .eq("auth_user_id", auth_user_id)
            .limit(1)
            .execute()
        )
        if not resposta.data:
            self.registrar(session_id, auth_user_id)
            return
        sessao = resposta.data[0]
        if sessao.get("revogada_em"):
            raise RuntimeError("Sessao revogada")
        ultimo = sessao.get("ultimo_acesso_em")
        if not ultimo:
            self._tocar(session_id)
            return
        try:
            instante = datetime.fromisoformat(str(ultimo).replace("Z", "+00:00"))
        except ValueError:
            self._tocar(session_id)
            return
        if datetime.now(timezone.utc) - instante > timedelta(minutes=5):
            self._tocar(session_id)

    def listar(self, auth_user_id: str) -> list[dict[str, Any]]:
        return (
            self.client.table("sessoes_dispositivos")
            .select("id,navegador,sistema,tipo_dispositivo,criada_em,ultimo_acesso_em,revogada_em")
            .eq("auth_user_id", auth_user_id)
            .is_("revogada_em", "null")
            .order("ultimo_acesso_em", desc=True)
            .execute()
        ).data or []

    def revogar(self, session_id: str, auth_user_id: str) -> bool:
        resposta = (
            self.client.table("sessoes_dispositivos")
            .update({"revogada_em": datetime.now(timezone.utc).isoformat()})
            .eq("id", session_id)
            .eq("auth_user_id", auth_user_id)
            .is_("revogada_em", "null")
            .execute()
        )
        return bool(resposta.data)

    def revogar_outras(self, auth_user_id: str, session_id_atual: str) -> int:
        resposta = (
            self.client.table("sessoes_dispositivos")
            .update({"revogada_em": datetime.now(timezone.utc).isoformat()})
            .eq("auth_user_id", auth_user_id)
            .neq("id", session_id_atual)
            .is_("revogada_em", "null")
            .execute()
        )
        return len(resposta.data or [])

    def revogar_todas(self, auth_user_id: str) -> int:
        resposta = (
            self.client.table("sessoes_dispositivos")
            .update({"revogada_em": datetime.now(timezone.utc).isoformat()})
            .eq("auth_user_id", auth_user_id)
            .is_("revogada_em", "null")
            .execute()
        )
        return len(resposta.data or [])

    def _tocar(self, session_id: str) -> None:
        agora = datetime.now(timezone.utc).isoformat()
        self.client.table("sessoes_dispositivos").update(
            {"ultimo_acesso_em": agora, "atualizada_em": agora}
        ).eq("id", session_id).execute()
