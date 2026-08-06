import hashlib
import re

import httpx


class SenhaInseguraError(ValueError):
    pass


class PasswordSecurityService:
    """Valida força local e consulta senhas vazadas por k-anonimato."""

    def validar(self, senha: str) -> None:
        problemas = []
        if len(senha) < 12:
            problemas.append("pelo menos 12 caracteres")
        if not re.search(r"[a-z]", senha):
            problemas.append("uma letra minuscula")
        if not re.search(r"[A-Z]", senha):
            problemas.append("uma letra maiuscula")
        if not re.search(r"\d", senha):
            problemas.append("um numero")
        if not re.search(r"[^A-Za-z0-9]", senha):
            problemas.append("um simbolo")
        if problemas:
            raise SenhaInseguraError("Use " + ", ".join(problemas) + ".")

        digest = hashlib.sha1(senha.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
        prefixo, sufixo = digest[:5], digest[5:]
        try:
            resposta = httpx.get(
                f"https://api.pwnedpasswords.com/range/{prefixo}",
                headers={"Add-Padding": "true", "User-Agent": "Vivo-AdaptAI-password-security"},
                timeout=5.0,
            )
            resposta.raise_for_status()
        except httpx.HTTPError:
            # A indisponibilidade externa nao bloqueia a conta; as regras locais
            # e o Supabase Auth continuam validando a senha.
            return
        for linha in resposta.text.splitlines():
            hash_sufixo, _, ocorrencias = linha.partition(":")
            if hash_sufixo == sufixo and int(ocorrencias or 0) > 0:
                raise SenhaInseguraError(
                    "Esta senha apareceu em vazamentos conhecidos. Escolha uma senha nova e exclusiva."
                )
