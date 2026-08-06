def gerar_resposta_fallback(perfil: str, mensagem: str) -> str:
    assunto_fatura = any(termo in mensagem.lower() for termo in ("fatura", "segunda via", "boleto", "conta"))
    if perfil == "iniciante":
        if assunto_fatura:
            return "Claro, vou te ajudar passo a passo. Abra o app Vivo, toque em ‘Fatura’ e depois em ‘Segunda via’. Se preferir, posso explicar cada tela."
        return "Claro, vou te ajudar passo a passo. No app Vivo, procure a opção relacionada ao que você precisa. Se quiser, me diga o que aparece na sua tela."
    if perfil == "intermediario":
        return "Você pode resolver isso pelo app Vivo. Acesse o menu, escolha a opção correspondente e siga as instruções exibidas. Posso detalhar o caminho se precisar."
    return "No app Vivo, acesse o menu da sua conta e selecione a opção correspondente. Se preferir, descreva o que deseja concluir e envio o atalho mais direto."
