def gerar_resposta_fallback(perfil: str, mensagem: str, modo_guiado: bool = False) -> str:
    mensagem_normalizada = mensagem.lower()
    assunto_fatura = any(termo in mensagem_normalizada for termo in ("fatura", "segunda via", "boleto", "conta"))
    if modo_guiado:
        if "não consegui" in mensagem_normalizada or "nao consegui" in mensagem_normalizada:
            return "Tudo bem, vamos tentar de outro jeito. Olhe para a tela e me diga quais palavras ou botões aparecem nela."
        if "consegui" in mensagem_normalizada:
            return "Ótimo. Agora procure na tela a opção relacionada ao que você quer resolver. Você encontrou essa opção?"
        if assunto_fatura:
            return "Vamos fazer uma etapa por vez. Primeiro, abra o aplicativo da Vivo no seu celular. Você conseguiu abrir?"
        return "Vamos fazer uma etapa por vez. Primeiro, abra o aplicativo da Vivo no seu celular. Você conseguiu abrir?"
    if perfil == "iniciante":
        if assunto_fatura:
            return "Claro, vou te ajudar passo a passo. Abra o app Vivo, toque em ‘Fatura’ e depois em ‘Segunda via’. Se preferir, posso explicar cada tela."
        return "Claro, vou te ajudar passo a passo. No app Vivo, procure a opção relacionada ao que você precisa. Se quiser, me diga o que aparece na sua tela."
    if perfil == "intermediario":
        return "Você pode resolver isso pelo app Vivo. Acesse o menu, escolha a opção correspondente e siga as instruções exibidas. Posso detalhar o caminho se precisar."
    return "No app Vivo, acesse o menu da sua conta e selecione a opção correspondente. Se preferir, descreva o que deseja concluir e envio o atalho mais direto."
