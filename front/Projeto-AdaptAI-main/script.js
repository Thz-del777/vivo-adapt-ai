// Ponto de entrada único: inicializarAplicacao() dispara todas as rotinas abaixo,
// cada uma protegida por uma checagem de elemento no início da própria função

function inicializarAplicacao() {
  // O login é a porta de entrada. Após autenticar ou optar por visitar, a
  // sessão temporária libera a navegação por todas as telas do produto.
  const paginasProtegidas = [
    'home', 'atendimento-texto', 'atendimento-voz', 'atendimento-hibrido',
    'libras', 'texto-simplificado', 'historico', 'perfil', 'dashboard',
    'configuracoes', 'permissoes', 'acessibilidade', 'central-de-ajuda',
    'sobre-adapt-ai', 'erro-atendimento', 'offline', 'conclusao',
    'resumo-atendimento', 'conectando', 'notificacoes', 'privacidade'
  ];
  const paginaAtual = document.body.dataset.page || new URL(window.location.href).pathname.split('/').pop().replace('.html', '');
  if (paginasProtegidas.includes(paginaAtual) && !sessionStorage.getItem('vivo-adaptai-sessao-autenticada')) {
    window.location.href = 'entrar.html';
    return;
  }

  // O painel é exclusivo da equipe Vivo. Mesmo digitando a URL diretamente,
  // clientes e visitantes voltam para o início sem acessar dados operacionais.
  if (paginaAtual === 'dashboard' && sessionStorage.getItem('vivo-adaptai-perfil') !== 'funcionario') {
    sessionStorage.setItem('vivo-adaptai-aviso-dashboard', '1');
    window.location.href = 'home.html';
    return;
  }

  inicializarTema();          // deve rodar antes dos componentes para evitar flash
  aplicarAcessibilidade(lerPreferenciasLocais());
  inicializarComponentesDinamicos();
  inicializarNotificacoes();
  inicializarPrivacidade();
  inicializarFluxoRecuperacao();
  inicializarNovaSenhaRecuperacao();
  inicializarSelectTema();    // conecta o <select> da página de configurações

  // Cada função abaixo só executa na página correspondente (guarda de elemento
  // no início da função); por isso é seguro chamá-las todas aqui.
  inicializarAvaliacao();
  if (paginaAtual === 'historico') {
    carregarHistoricoReal();
  }
  inicializarPerfil();
  inicializarSegurancaConta();
  inicializarPermissoes();
  inicializarConfiguracoes();
  inicializarModoAtendimentoPadrao();
  inicializarAcessibilidade();
  inicializarRecursosAcessiveis();
  inicializarLibras();
  inicializarTextosimplificado();
  inicializarCentralDeAjuda();
  inicializarSelecaoCards();
  inicializarAlteracaoModalidade();
  inicializarModoOffline();
  inicializarStatusConexaoGlobal();
  inicializarHibrido();
  inicializarForcaSenha();
  inicializarConectando();
  inicializarDashboard();
  inicializarReenvioCodigo();
  inicializarTelemetriaIld();

  if (sessionStorage.getItem('vivo-adaptai-aviso-dashboard') === '1') {
    sessionStorage.removeItem('vivo-adaptai-aviso-dashboard');
    mostrarToast({
      tipo: 'info',
      titulo: 'Área exclusiva',
      mensagem: 'O Dashboard da operação está disponível apenas para funcionários Vivo.'
    });
  }
}

// Tema claro/escuro: persiste em localStorage e sincroniza o botão do header com o select de configurações

const CHAVE_TEMA = "vivo-adaptai-tema";

function aplicarTema(tema) {
  const html = document.documentElement;
  if (tema === "escuro") {
    html.setAttribute("data-theme", "escuro");
  } else {
    html.removeAttribute("data-theme");
  }
  localStorage.setItem(CHAVE_TEMA, tema);
  sincronizarBotaoTema(tema);
  sincronizarSelectTema(tema);
}

function temaAtual() {
  return localStorage.getItem(CHAVE_TEMA) || "claro";
}

function inicializarTema() {
  // Aplica imediatamente o tema salvo (antes do DOMContentLoaded para evitar flash)
  aplicarTema(temaAtual());
}

function alternarTema() {
  const novoTema = temaAtual() === "escuro" ? "claro" : "escuro";
  aplicarTema(novoTema);
}

function sincronizarBotaoTema(tema) {
  // Atualiza o rótulo e o ícone do botão no cabeçalho
  const btn = document.getElementById("btnAlternarTema");
  if (!btn) return;
  if (tema === "escuro") {
    btn.innerHTML = '<i class="fa-solid fa-sun"></i><span>Tema claro</span>';
    btn.setAttribute("aria-label", "Mudar para tema claro");
  } else {
    btn.innerHTML = '<i class="fa-solid fa-moon"></i><span>Tema escuro</span>';
    btn.setAttribute("aria-label", "Mudar para tema escuro");
  }
}

function sincronizarSelectTema(tema) {
  const sel = document.getElementById("selectTema");
  if (sel) sel.value = tema;
}

function inicializarSelectTema() {
  // Conecta o <select> da página de configurações ao sistema de tema
  const sel = document.getElementById("selectTema");
  if (!sel) return;
  sel.value = temaAtual();
  sel.addEventListener("change", () => {
    aplicarTema(sel.value);
  });
}

// Aplica o tema salvo IMEDIATAMENTE, antes de qualquer renderização, para evitar flash
(function() {
  var temaSalvo = localStorage.getItem("vivo-adaptai-tema");
  if (temaSalvo === "escuro") {
    document.documentElement.setAttribute("data-theme", "escuro");
  }
})();

// Ponto de entrada único - evita listeners duplicados
document.addEventListener("DOMContentLoaded", async () => {
    const titulo = document.getElementById("tituloSaudacao");
    if (!titulo) return;

    const usuario = JSON.parse(sessionStorage.getItem("vivo-adaptai-usuario") || "{}");

    function primeiroNome(nomeCompleto) {
      return String(nomeCompleto || "").trim().split(/\s+/)[0] || "";
    }

    function aplicarNome(nomeCompleto) {
      const nome = primeiroNome(nomeCompleto);
      titulo.replaceChildren(
        document.createTextNode(nome ? `Olá, ${nome}!` : "Olá!"),
        document.createElement("br"),
        document.createTextNode("Como posso te ajudar hoje?")
      );
      if (!nome) return;
      document.querySelectorAll(".nome-perfil").forEach((elemento) => { elemento.textContent = nome; });
      document.querySelectorAll(".avatar-perfil").forEach((elemento) => { elemento.textContent = nome.charAt(0).toUpperCase(); });
    }

    aplicarNome(usuario.nome || usuario.name);

    const token = sessionStorage.getItem("vivo-adaptai-access-token");
    if (!token) return;
    try {
      const perfil = await requisitarApi("/perfil", { headers: { Authorization: `Bearer ${token}` } });
      aplicarNome(perfil.nome);
      sessionStorage.setItem("vivo-adaptai-usuario", JSON.stringify({ ...usuario, nome: perfil.nome }));
    } catch (_) {
      // A saudação local continua utilizável enquanto o perfil não responde.
    }
});

// mostrarToast({ tipo, titulo, mensagem, duracao, acaoTexto, aoAcionar })
// tipo: "sucesso" | "erro" | "aviso" | "info"

const ICONES_TOAST = {
  sucesso: "fa-solid fa-circle-check",
  erro: "fa-solid fa-circle-xmark",
  aviso: "fa-solid fa-triangle-exclamation",
  info: "fa-solid fa-circle-info"
};

function obterContainerToast() {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "false");
    document.body.appendChild(container);
  }
  return container;
}

function mostrarToast(opcoes) {
  const {
    tipo = "info",
    titulo = "",
    mensagem = "",
    duracao = 5000,
    acaoTexto = null,
    aoAcionar = null
  } = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});

  const container = obterContainerToast();

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  // Erros interrompem leitores de tela imediatamente (assertive); os demais
  // tipos apenas anunciam de forma educada, sem competir com a tarefa atual.
  toast.setAttribute("role", tipo === "erro" ? "alert" : "status");

  toast.innerHTML = `
    <span class="icone-toast" aria-hidden="true"><i class="${ICONES_TOAST[tipo] || ICONES_TOAST.info}"></i></span>
    <div class="corpo-toast">
      ${titulo ? `<p class="titulo-toast"></p>` : ""}
      ${mensagem ? `<p class="mensagem-toast"></p>` : ""}
      ${acaoTexto ? `<button type="button" class="acao-toast"></button>` : ""}
    </div>
    <button type="button" class="fechar-toast" aria-label="Fechar notificação"><i class="fa-solid fa-xmark"></i></button>
    <span class="barra-progresso-toast" style="animation-duration: ${duracao}ms;"></span>
  `;

  // Texto inserido via textContent (não innerHTML) para não abrir brecha de
  // HTML injection quando a mensagem vier de dados dinâmicos no futuro.
  if (titulo) toast.querySelector(".titulo-toast").textContent = titulo;
  if (mensagem) toast.querySelector(".mensagem-toast").textContent = mensagem;
  if (acaoTexto) toast.querySelector(".acao-toast").textContent = acaoTexto;

  container.appendChild(toast);

  // Pilha máxima de 3 toasts simultâneos: remove o mais antigo
  // imediatamente quando um novo excede o limite.
  const toastsAtivos = container.querySelectorAll(".toast:not(.esta-saindo)");
  if (toastsAtivos.length > 3) {
    const maisAntigo = toastsAtivos[0];
    maisAntigo.classList.add("esta-saindo");
    maisAntigo.addEventListener("animationend", () => maisAntigo.remove(), { once: true });
  }

  let removido = false;
  function remover() {
    if (removido) return;
    removido = true;
    toast.classList.add("esta-saindo");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }

  let temporizador = window.setTimeout(remover, duracao);

  // Pausa o auto-fechamento enquanto o usuário está com o mouse sobre o toast
  toast.addEventListener("mouseenter", () => {
    toast.classList.add("esta-pausado");
    window.clearTimeout(temporizador);
  });
  toast.addEventListener("mouseleave", () => {
    toast.classList.remove("esta-pausado");
    temporizador = window.setTimeout(remover, 1200);
  });

  toast.querySelector(".fechar-toast").addEventListener("click", remover);

  const botaoAcao = toast.querySelector(".acao-toast");
  if (botaoAcao) {
    botaoAcao.addEventListener("click", () => {
      if (typeof aoAcionar === "function") aoAcionar();
      remover();
    });
  }

  return { elemento: toast, remover };
}

// "Limpar conversa" (menu de 3 pontos): se adapta à modalidade atual sem mexer
// no estado interno de cada controlador (voz, Libras, texto simplificado)
function limparConversaAtual() {
  const corpoChat = document.getElementById("chatBody");

  if (corpoChat) {
    const itens = Array.from(corpoChat.querySelectorAll(".mensagem, .respostas-rapidas, .estado-erro-chat"));
    if (itens.length <= 1) {
      mostrarToast({ tipo: "info", titulo: "Nada para limpar", mensagem: "Esta conversa já está no início." });
      return;
    }

    // Preserva a primeira mensagem (saudação inicial do Mimo) e guarda os
    // demais elementos removidos, na ordem certa, para permitir "Desfazer".
    const removidos = [];
    itens.slice(1).forEach((el) => {
      removidos.push({ el, proximo: el.nextSibling });
      el.remove();
    });

    mostrarToast({
      tipo: "sucesso",
      titulo: "Conversa limpa",
      mensagem: "O histórico desta conversa foi apagado.",
      acaoTexto: "Desfazer",
      aoAcionar: () => {
        removidos.reverse().forEach(({ el, proximo }) => {
          corpoChat.insertBefore(el, proximo);
        });
      }
    });
    return;
  }

  // Atendimento por voz: reseta a transcrição e o status para o estado inicial
  const transcricaoVoz = document.getElementById("voiceTranscriptText");
  if (transcricaoVoz) {
    const tituloVoz = document.getElementById("voiceStatusTitle");
    const dicaVoz = document.getElementById("voiceStatusHint");
    transcricaoVoz.textContent = "Aguardando você falar...";
    transcricaoVoz.classList.add("esta-aguardando-usuario");
    if (tituloVoz) tituloVoz.textContent = "Como posso ajudar você hoje?";
    if (dicaVoz) dicaVoz.textContent = "Toque no microfone quando estiver pronto.";
    mostrarToast({ tipo: "sucesso", titulo: "Transcrição limpa", mensagem: "A transcrição foi reiniciada." });
    return;
  }

  // Libras e Texto simplificado não têm um histórico de texto para apagar
  mostrarToast({ tipo: "info", titulo: "Nada para limpar", mensagem: "Esta modalidade não possui histórico de texto." });
}

// Confirma visualmente a modalidade escolhida antes de navegar
function inicializarSelecaoCards() {
  const cartoes = document.querySelectorAll(".cartao-dashboard");
  if (!cartoes.length) return;

  cartoes.forEach((cartao) => {
    cartao.addEventListener("click", (evento) => {
      if (cartao.classList.contains("esta-selecionado")) return; // evita duplo clique

      evento.preventDefault();
      const destino = document.body.dataset.page === "home"
        ? obterDestinoModoAtendimentoPadrao()
        : cartao.getAttribute("href");

      cartoes.forEach((c) => c.classList.remove("esta-selecionado"));
      cartao.classList.add("esta-selecionado");

      window.setTimeout(() => {
        if (destino === "perguntar") abrirSeletorModalidade("texto");
        else if (destino) window.location.href = destino;
      }, 380);
    });
  });
}

// Alterar modalidade: seletor com confirmação antes de trocar de página,
// mantendo o histórico da conversa
const MODALIDADES_ATENDIMENTO = [
  {
    id: "texto",
    rotulo: "Texto",
    descricao: "Converse por mensagens de texto. Ideal para quem prefere ler e digitar.",
    href: "atendimento-texto.html",
    icone: "fa-solid fa-language"
  },
  {
    id: "voz",
    rotulo: "Voz",
    descricao: "Converse por mensagens de voz. Ideal para quem prefere ouvir e falar.",
    href: "atendimento-voz.html",
    icone: "fa-solid fa-waveform-lines"
  },
  {
    id: "hibrido",
    rotulo: "Hibrido",
    descricao: "Use texto e voz lado a lado durante o mesmo atendimento.",
    href: "atendimento-hibrido.html",
    icone: "fa-solid fa-table-columns"
  },
  {
    id: "simplificado",
    rotulo: "Texto simplificado",
    descricao: "Receba perguntas por etapas, com opcoes grandes e linguagem direta.",
    href: "texto-simplificado.html",
    icone: "fa-solid fa-list-check"
  },
  {
    id: "libras",
    rotulo: "Libras",
    descricao: "Acompanhe o atendimento com interpretacao visual em Libras.",
    href: "libras.html",
    icone: "fa-solid fa-hands"
  }
];
/* Nota: "Off-line" foi removido desta lista — offline é um estado de
   conectividade detectado automaticamente (ver inicializarStatusConexaoGlobal),
   não uma modalidade que o usuário escolhe. "Sem preferência" também não
   entra aqui: o modal de "Alterar modalidade" lista as 5 modalidades acima.
   O link "Sem preferência" no rodapé segue navegando direto para home.html,
   sem passar pelo modal de confirmação. */

function normalizarCaminhoAtual() {
  const arquivo = window.location.pathname.split("/").pop() || "home.html";
  return arquivo.toLowerCase();
}

function obterModalidadeAtual() {
  const arquivoAtual = normalizarCaminhoAtual();
  return MODALIDADES_ATENDIMENTO.find((modalidade) => modalidade.href.toLowerCase() === arquivoAtual) || MODALIDADES_ATENDIMENTO[0];
}

function obterModalidadePorHref(href) {
  if (!href) return obterModalidadeAtual();
  const arquivo = href.split("#")[0].split("?")[0].split("/").pop().toLowerCase();
  return MODALIDADES_ATENDIMENTO.find((modalidade) => modalidade.href.toLowerCase() === arquivo) || obterModalidadeAtual();
}

function criarDialogoAlteracaoModalidade() {
  let dialogo = document.getElementById("modalAlterarModalidade");
  if (dialogo) return dialogo;

  dialogo = document.createElement("div");
  dialogo.id = "modalAlterarModalidade";
  dialogo.className = "modalidade-modal";
  dialogo.setAttribute("role", "dialog");
  dialogo.setAttribute("aria-modal", "true");
  dialogo.setAttribute("aria-labelledby", "tituloModalidade");
  dialogo.setAttribute("aria-hidden", "true");

  dialogo.innerHTML = `
    <div class="modalidade-modal__painel">
      <div class="modalidade-modal__topo">
        <button type="button" class="modalidade-modal__voltar" data-modalidade-cancelar>
          <i class="fa-solid fa-arrow-left"></i>
          <span>Voltar</span>
        </button>
        <img src="Imagens/Perfil-Mimo.png" alt="Mimo" class="modalidade-modal__mimo">
      </div>

      <div class="modalidade-modal__cabecalho">
        <h2 id="tituloModalidade">Alterar modalidade</h2>
        <p>Escolha a modalidade que melhor se adapta ao seu momento.</p>
        <p>Sua preferencia sera aplicada imediatamente apos a confirmacao.</p>
      </div>

      <div class="modalidade-modal__grade" role="radiogroup" aria-label="Modalidades de atendimento"></div>

      <div class="modalidade-modal__aviso">
        <span class="modalidade-modal__aviso-icone"><i class="fa-solid fa-circle-info"></i></span>
        <div>
          <strong>Importante</strong>
          <p>Voce pode trocar de modalidade a qualquer momento. O historico da conversa sera mantido e adaptado para a nova forma de comunicacao.</p>
        </div>
      </div>

      <div class="modalidade-modal__acoes">
        <button type="button" class="botao botao-contorno" data-modalidade-cancelar>Cancelar</button>
        <button type="button" class="botao botao-principal" data-modalidade-confirmar>
          Confirmar alteracao
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `;

  const grade = dialogo.querySelector(".modalidade-modal__grade");
  MODALIDADES_ATENDIMENTO.forEach((modalidade) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "cartao-modalidade";
    botao.dataset.modalidadeId = modalidade.id;
    botao.dataset.modalidadeHref = modalidade.href;
    botao.setAttribute("role", "radio");
    botao.setAttribute("aria-checked", "false");
    botao.innerHTML = `
      <span class="cartao-modalidade__check" aria-hidden="true"><i class="fa-solid fa-circle"></i></span>
      <span class="cartao-modalidade__icone"><i class="${modalidade.icone}"></i></span>
      <strong></strong>
      <p></p>
      <span class="cartao-modalidade__atual"><i class="fa-solid fa-circle-check"></i> Modalidade atual</span>
    `;
    botao.querySelector("strong").textContent = modalidade.rotulo;
    botao.querySelector("p").textContent = modalidade.descricao;
    grade.appendChild(botao);
  });

  document.body.appendChild(dialogo);
  return dialogo;
}

let elementoComFocoAntesDoModal = null;

function tratarFocoPresoSeletorModalidade(evento) {
  if (evento.key !== "Tab") return;
  const dialogo = document.getElementById("modalAlterarModalidade");
  if (!dialogo) return;

  const focaveis = Array.from(
    dialogo.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")
  ).filter((el) => el.offsetParent !== null);
  if (focaveis.length === 0) return;

  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];

  if (evento.shiftKey && document.activeElement === primeiro) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primeiro.focus();
  }
}

function abrirSeletorModalidade(modalidadeInicial) {
  const dialogo = criarDialogoAlteracaoModalidade();
  const atual = obterModalidadeAtual();
  let selecionada = modalidadeInicial || atual;
  const cartoes = Array.from(dialogo.querySelectorAll(".cartao-modalidade"));
  const confirmar = dialogo.querySelector("[data-modalidade-confirmar]");

  // Guarda o elemento que tinha foco antes de abrir, para devolver o foco
  // a ele ao fechar (padrão de acessibilidade para diálogos modais).
  elementoComFocoAntesDoModal = document.activeElement;

  function atualizarSelecao() {
    cartoes.forEach((cartao) => {
      const estaSelecionado = cartao.dataset.modalidadeId === selecionada.id;
      const ehAtual = cartao.dataset.modalidadeId === atual.id;
      cartao.classList.toggle("esta-selecionado", estaSelecionado);
      cartao.classList.toggle("modalidade-atual", ehAtual);
      cartao.setAttribute("aria-checked", String(estaSelecionado));
    });
    confirmar.disabled = false;
  }

  cartoes.forEach((cartao) => {
    cartao.onclick = () => {
      selecionada = MODALIDADES_ATENDIMENTO.find((modalidade) => modalidade.id === cartao.dataset.modalidadeId) || atual;
      atualizarSelecao();
    };
  });

  dialogo.querySelectorAll("[data-modalidade-cancelar]").forEach((botao) => {
    botao.onclick = fecharSeletorModalidade;
  });

  confirmar.onclick = () => {
    if (selecionada.href === atual.href) {
      fecharSeletorModalidade();
      mostrarToast({
        tipo: "info",
        titulo: "Modalidade mantida",
        mensagem: "Voce ja esta usando esta modalidade."
      });
      return;
    }

    sessionStorage.setItem("vivo-adaptai-modalidade", selecionada.id);
    window.location.href = selecionada.href;
  };

  dialogo.onclick = (evento) => {
    if (evento.target === dialogo) fecharSeletorModalidade();
  };

  document.addEventListener("keydown", tratarEscapeSeletorModalidade);
  document.addEventListener("keydown", tratarFocoPresoSeletorModalidade);
  dialogo.classList.add("esta-aberto");
  dialogo.setAttribute("aria-hidden", "false");
  atualizarSelecao();
  dialogo.querySelector(".cartao-modalidade.esta-selecionado")?.focus();
}

function tratarEscapeSeletorModalidade(evento) {
  if (evento.key === "Escape") fecharSeletorModalidade();
}

function fecharSeletorModalidade() {
  const dialogo = document.getElementById("modalAlterarModalidade");
  if (!dialogo) return;
  dialogo.classList.remove("esta-aberto");
  dialogo.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", tratarEscapeSeletorModalidade);
  document.removeEventListener("keydown", tratarFocoPresoSeletorModalidade);
  elementoComFocoAntesDoModal?.focus();
  elementoComFocoAntesDoModal = null;
}

function inicializarAlteracaoModalidade() {
  // ":not(.botao-modo-tracejado)" exclui o link "Sem preferência" — ele não é
  // uma troca de modalidade (não precisa de confirmação), é uma saída do
  // fluxo, então navega direto para home.html sem abrir o modal.
  const botoesModo = document.querySelectorAll(".alternador-modo .botao-modo[href]:not(.botao-modo-tracejado)");
  botoesModo.forEach((botao) => {
    botao.addEventListener("click", (evento) => {
      evento.preventDefault();
      abrirSeletorModalidade(obterModalidadePorHref(botao.getAttribute("href")));
    });
  });
}

function inicializarModoOffline() {
  const paginaOffline = document.querySelector("[data-page='offline']");
  if (!paginaOffline) return;

  const btnTentarNovamente = document.getElementById("btnOfflineTentarNovamente");
  const statusOffline = document.getElementById("statusOfflineConexao");

  function atualizarEstadoConexao() {
    const estaOnline = navigator.onLine;
    if (statusOffline) {
      statusOffline.textContent = estaOnline ? "Conexão restabelecida" : "Sem conexão";
      statusOffline.classList.toggle("esta-online", estaOnline);
    }
    return estaOnline;
  }

  btnTentarNovamente?.addEventListener("click", () => {
    if (atualizarEstadoConexao()) {
      window.location.href = "atendimento-texto.html";
      return;
    }

    mostrarToast({
      tipo: "aviso",
      titulo: "Ainda sem conexão",
      mensagem: "Verifique sua internet e tente novamente em alguns instantes."
    });
  });

  window.addEventListener("online", () => {
    atualizarEstadoConexao();
    mostrarToast({
      tipo: "sucesso",
      titulo: "Conexão restabelecida",
      mensagem: "Você já pode voltar ao atendimento.",
      acaoTexto: "Continuar",
      aoAcionar: () => {
        window.location.href = "atendimento-texto.html";
      }
    });
  });
  window.addEventListener("offline", atualizarEstadoConexao);
  atualizarEstadoConexao();
}

// Roda em todas as páginas, diferente de inicializarModoOffline (só em offline.html):
// avisa por toast quando a conexão cai/volta, sem navegar, para preservar o atendimento em andamento
function inicializarStatusConexaoGlobal() {
  // Na própria página offline.html o feedback já é tratado via
  // inicializarModoOffline (status inline + toast de reconexão com CTA
  // para retomar o atendimento); evitamos duplicar o aviso aqui.
  if (document.querySelector("[data-page='offline']")) return;

  window.addEventListener("offline", () => {
    mostrarToast({
      tipo: "aviso",
      titulo: "Você está sem conexão",
      mensagem: "Verifique sua internet. O que você já digitou continua salvo.",
      acaoTexto: "Ver orientacoes",
      aoAcionar: () => {
        window.location.href = "offline.html";
      }
    });
  });

  window.addEventListener("online", () => {
    mostrarToast({
      tipo: "sucesso",
      titulo: "Conexão restabelecida",
      mensagem: "Você já pode continuar de onde parou."
    });
  });
}

// Listeners globais usados em várias páginas

function limparSessaoLocal() {
  sessionStorage.removeItem("vivo-adaptai-sessao-autenticada");
  sessionStorage.removeItem("vivo-adaptai-perfil");
  sessionStorage.removeItem("vivo-adaptai-cliente-id");
  sessionStorage.removeItem(CHAVE_TOKEN_ACESSO);
  sessionStorage.removeItem(CHAVE_TOKEN_RENOVACAO);
  sessionStorage.removeItem(CHAVE_USUARIO);
  sessionStorage.removeItem(CHAVE_SESSAO_EVENTO_ILD);
  sessionStorage.removeItem(CHAVE_ACESSO_ILD_CONFIRMADO);
}

// Inicializa listeners em elementos injetados via Web Components
function inicializarComponentesDinamicos() {
  // Menu de perfil (dropdown) — reutilizável em todas as páginas
  const profileMenuTrigger = document.getElementById("profileMenuTrigger");
  const profileMenuPanel = document.getElementById("profileMenuPanel");

  if (profileMenuTrigger && profileMenuPanel) {
    // Remove listeners antigos para evitar duplicidade
    const novoTrigger = profileMenuTrigger.cloneNode(true);
    profileMenuTrigger.parentNode.replaceChild(novoTrigger, profileMenuTrigger);

    novoTrigger.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const abrindo = !profileMenuPanel.classList.contains("esta-aberto");
      profileMenuPanel.classList.toggle("esta-aberto", abrindo);
      novoTrigger.setAttribute("aria-expanded", String(abrindo));
    });

    document.addEventListener("click", (evento) => {
      if (!profileMenuPanel.contains(evento.target) && !novoTrigger.contains(evento.target)) {
        profileMenuPanel.classList.remove("esta-aberto");
        novoTrigger.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        profileMenuPanel.classList.remove("esta-aberto");
        novoTrigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  const logoutLink = document.getElementById("logoutLink");
  logoutLink?.addEventListener("click", (evento) => {
    evento.preventDefault();
    limparSessaoLocal();
    window.location.href = "entrar.html";
  });

  // Menu de três pontos do chat (Resumir, Alterar modalidade, Acessibilidade,
  // Limpar conversa, Encerrar) — presente em todas as páginas de atendimento.
  // Reaproveita o mesmo padrão de dropdown do menu de perfil acima.
  const menuChatTrigger = document.getElementById("menuChatTrigger");
  const menuChatPanel = document.getElementById("menuChatPanel");

  if (menuChatTrigger && menuChatPanel) {
    const novoTriggerChat = menuChatTrigger.cloneNode(true);
    menuChatTrigger.parentNode.replaceChild(novoTriggerChat, menuChatTrigger);

    novoTriggerChat.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const abrindo = !menuChatPanel.classList.contains("esta-aberto");
      menuChatPanel.classList.toggle("esta-aberto", abrindo);
      novoTriggerChat.setAttribute("aria-expanded", String(abrindo));
    });

    document.addEventListener("click", (evento) => {
      if (!menuChatPanel.contains(evento.target) && !novoTriggerChat.contains(evento.target)) {
        menuChatPanel.classList.remove("esta-aberto");
        novoTriggerChat.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        menuChatPanel.classList.remove("esta-aberto");
        novoTriggerChat.setAttribute("aria-expanded", "false");
      }
    });

    // "Alterar modalidade" — leva o usuário até o seletor já existente no rodapé
    const btnAlterarModalidadeMenu = document.getElementById("btnAlterarModalidadeMenu");
    if (btnAlterarModalidadeMenu) {
      btnAlterarModalidadeMenu.addEventListener("click", () => {
        menuChatPanel.classList.remove("esta-aberto");
        novoTriggerChat.setAttribute("aria-expanded", "false");
        abrirSeletorModalidade(obterModalidadeAtual());
      });
    }

    // "Limpar conversa" — apaga o histórico visível preservando a saudação inicial
    const btnLimparConversaMenu = document.getElementById("btnLimparConversaMenu");
    if (btnLimparConversaMenu) {
      btnLimparConversaMenu.addEventListener("click", () => {
        menuChatPanel.classList.remove("esta-aberto");
        novoTriggerChat.setAttribute("aria-expanded", "false");
        limparConversaAtual();
      });
    }

    // "Encerrar atendimento" — reaproveita o botão "Encerrar" já existente na página
    const btnEncerrarMenu = document.getElementById("btnEncerrarMenu");
    if (btnEncerrarMenu) {
      btnEncerrarMenu.addEventListener("click", () => {
        menuChatPanel.classList.remove("esta-aberto");
        novoTriggerChat.setAttribute("aria-expanded", "false");
        const btnOriginal = document.getElementById("btnEncerrarAtendimento");
        if (btnOriginal) btnOriginal.click();
      });
    }
  }

  // Toggle da sidebar — reutilizável em páginas logadas
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const appSidebar = document.getElementById("appSidebar");

  if (sidebarToggleBtn && appSidebar) {
    const fecharSidebarMobile = () => {
      appSidebar.classList.add("esta-recolhido");
      document.body.classList.remove("sidebar-mobile-aberta");
      document.getElementById("sidebarToggleBtn")?.setAttribute("aria-expanded", "false");
    };
    const abrirSidebarMobile = () => {
      appSidebar.classList.remove("esta-recolhido");
      document.body.classList.add("sidebar-mobile-aberta");
      document.getElementById("sidebarToggleBtn")?.setAttribute("aria-expanded", "true");
    };

    // No mobile, a sidebar inicia recolhida por padrão
    const isMobile = window.matchMedia("(max-width: 48em)").matches;
    if (isMobile) {
      fecharSidebarMobile();
    }

    const novoSidebarBtn = sidebarToggleBtn.cloneNode(true);
    sidebarToggleBtn.parentNode.replaceChild(novoSidebarBtn, sidebarToggleBtn);

    novoSidebarBtn.addEventListener("click", (evento) => {
      evento.preventDefault();
      if (window.matchMedia("(max-width: 48em)").matches) {
        if (document.body.classList.contains("sidebar-mobile-aberta")) fecharSidebarMobile();
        else abrirSidebarMobile();
        return;
      }
      const estaRecolhido = appSidebar.classList.toggle("esta-recolhido");
      novoSidebarBtn.setAttribute("aria-expanded", String(!estaRecolhido));
    });

    document.getElementById("sidebarMobileClose")?.addEventListener("click", fecharSidebarMobile);
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && document.body.classList.contains("sidebar-mobile-aberta")) {
        fecharSidebarMobile();
      }
    });
    document.addEventListener("click", (evento) => {
      if (
        window.matchMedia("(max-width: 48em)").matches &&
        document.body.classList.contains("sidebar-mobile-aberta") &&
        !appSidebar.contains(evento.target) &&
        !novoSidebarBtn.contains(evento.target)
      ) {
        fecharSidebarMobile();
      }
    });

    // Ajusta o estado da sidebar ao redimensionar a janela
    window.addEventListener("resize", () => {
      const agoraéMobile = window.matchMedia("(max-width: 48em)").matches;
      if (!agoraéMobile) {
        // No desktop, garante que a sidebar esteja visível
        appSidebar.classList.remove("esta-recolhido");
        document.body.classList.remove("sidebar-mobile-aberta");
        novoSidebarBtn.setAttribute("aria-expanded", "true");
      }
    });
  }

  // Mostrar/ocultar senha — componente reutilizável em formulários
  document.querySelectorAll(".botao-alternar-senha").forEach((botao) => {
    botao.addEventListener("click", () => {
      const inputAlvo = document.getElementById(botao.dataset.target);
      if (!inputAlvo) return;

      const estaVisivel = inputAlvo.type === "text";
      inputAlvo.type = estaVisivel ? "password" : "text";

      botao.setAttribute("aria-pressed", String(!estaVisivel));
      botao.setAttribute("aria-label", estaVisivel ? "Mostrar senha" : "Ocultar senha");
      botao.innerHTML = estaVisivel
        ? '<i class="fa-solid fa-eye"></i>'
        : '<i class="fa-solid fa-eye-slash"></i>';
    });
  });
}

// index.html: modal "Conhecer o Mimo", botão "Iniciar Atendimento"

// Modal "Conhecer o Mimo" — exibe informações sobre o assistente
const modalMimo = document.getElementById("modalMimo");
const modalOpenBtn = document.getElementById("modalOpenBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");

if (modalMimo && modalOpenBtn && modalCloseBtn) {
  modalOpenBtn.addEventListener("click", (evento) => {
    evento.preventDefault();
    modalMimo.style.display = "flex";
    document.body.style.overflow = "hidden";
  });

  modalCloseBtn.addEventListener("click", () => {
    modalMimo.style.display = "none";
    document.body.style.overflow = "";
  });

  window.addEventListener("click", (evento) => {
    if (evento.target === modalMimo) {
      modalMimo.style.display = "none";
      document.body.style.overflow = "";
    }
  });

  // Esc fecha o modal.
  window.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && modalMimo.style.display === "flex") {
      modalMimo.style.display = "none";
      document.body.style.overflow = "";
      modalOpenBtn.focus();
    }
  });
}

// Botões do modal "Conhecer o Mimo"
const modalBackBtn = document.getElementById("modalBackBtn");
const modalContinueBtn = document.getElementById("modalContinueBtn");

if (modalBackBtn && modalMimo) {
  modalBackBtn.addEventListener("click", () => {
    modalMimo.style.display = "none";
    document.body.style.overflow = "";
  });
}

if (modalContinueBtn) {
  modalContinueBtn.addEventListener("click", () => {
    window.location.href = "entrar.html";
  });
}

// Link "Continuar sem escolher uma preferência" — mesmo destino do botão acima.
// Antes a checagem usava `document.body.classList.contains('pagina-inicial')`
// para restringir o handler a index.html, mas essa classe (agora renomeada
// para .tema-destaque) também é aplicada a várias páginas internas logadas
// (ver style.css) — por isso a checagem usa o container da tela institucional
// (.destaque-inicial) em vez do body inteiro.
const linkContinuarSemPreferencia = document.querySelector('.destaque-inicial .link-acao[href="#"]');
if (linkContinuarSemPreferencia) {
  linkContinuarSemPreferencia.addEventListener('click', (evento) => {
    evento.preventDefault();
    window.location.href = 'entrar.html';
  });
}

// Botão "Iniciar Atendimento" — vai direto para o atendimento (texto),
// mesmo destino sem login usado pelos quatro cartões de modalidade em
// index.html. Unifica a regra de acesso: nenhum dos pontos de entrada de
// atendimento em index.html exige autenticação (F2 do plano de correção).
const btnIniciarAtendimento = document.getElementById("btnIniciarAtendimento");
if (btnIniciarAtendimento) {
  btnIniciarAtendimento.addEventListener("click", () => {
    window.location.href = "atendimento-texto.html";
  });
}

// conectando.html: 0–8s silencioso, >8s mostra mensagem (aria-live polite),
// >30s oferece "tentar novamente"/"voltar"; conclusão simulada em ~9.5s
function inicializarConectando() {
  const pagina = document.querySelector("[data-page='conectando']");
  if (!pagina) return;

  const titulo = document.querySelector(".conectando-titulo");
  const texto = document.querySelector(".conectando-texto");
  const alternativas = document.getElementById("conectandoAlternativas");
  const btnTentarNovamente = document.getElementById("btnConectandoTentarNovamente");

  let timers = [];

  function limparTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  function iniciarConexao() {
    limparTimers();
    if (titulo) titulo.hidden = false;
    if (texto) texto.hidden = false;
    alternativas.hidden = true;

    // >8s: revela a mensagem "Conectando ao sistema…"
    // >30s: revela as alternativas ("tentar novamente" / "voltar")
    timers.push(window.setTimeout(() => {
      alternativas.hidden = false;
    }, 30000));

    // Conclusão simulada da conexão — segue para a porta de entrada.
    timers.push(window.setTimeout(() => {
      limparTimers();
      window.location.href = "entrar.html";
    }, 9500));
  }

  btnTentarNovamente?.addEventListener("click", iniciarConexao);

  iniciarConexao();
}

// entrar.html, cadastro.html: simulação de login/registro

// Estado de carregamento do botão de envio — alterna aria-busy/disabled e o
// spinner visual (.esta-carregando). Uso previsto para quando a chamada real
// de API for integrada (ex.: definirCarregamentoBotao(botao, true) antes do
// fetch e definirCarregamentoBotao(botao, false) no retorno).
function definirCarregamentoBotao(botao, carregando) {
  if (!botao) return;
  botao.classList.toggle("esta-carregando", carregando);
  botao.disabled = carregando;
  botao.setAttribute("aria-busy", carregando ? "true" : "false");
}

// Exibe/oculta o alerta de erro no topo do formulário (.alerta-formulario).
// Uso previsto para respostas de erro da API (ex.: credenciais inválidas).
function exibirErroFormulario(container, mensagem) {
  if (!container) return;
  container.querySelector("span").textContent = mensagem;
  container.hidden = false;
}

function ocultarErroFormulario(container) {
  if (!container) return;
  container.hidden = true;
}

// Autenticação real via FastAPI e Supabase Auth.
const CHAVE_TOKEN_ACESSO = "vivo-adaptai-access-token";
const CHAVE_TOKEN_RENOVACAO = "vivo-adaptai-refresh-token";
const CHAVE_USUARIO = "vivo-adaptai-usuario";

async function requisitarApi(caminho, opcoes = {}) {
  const controlador = new AbortController();
  // O primeiro acesso ao Render pode levar alguns segundos para acordar o
  // servidor. Local continua rápido; em produção esperamos sem cancelar a ação.
  const timeoutEmMs = /(^https?:\/\/(127\.0\.0\.1|localhost))/.test(API_BASE_URL)
    ? 12000
    : 45000;
  const timeout = window.setTimeout(() => controlador.abort(), timeoutEmMs);
  try {
    const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
      ...opcoes,
      headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) },
      signal: controlador.signal
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.detail || "Não foi possível concluir a solicitação.");
    return corpo;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new Error("O atendimento está iniciando. Aguarde alguns segundos e tente novamente.");
    }
    if (erro instanceof TypeError) {
      throw new Error("Não foi possível conectar ao atendimento. Verifique sua internet e tente novamente.");
    }
    throw erro;
  } finally {
    window.clearTimeout(timeout);
  }
}

function salvarSessaoAutenticada(sessao, nome = "") {
  sessionStorage.setItem("vivo-adaptai-sessao-autenticada", "1");
  sessionStorage.setItem(CHAVE_TOKEN_ACESSO, sessao.access_token);
  sessionStorage.setItem(CHAVE_TOKEN_RENOVACAO, sessao.refresh_token);
  sessionStorage.setItem(CHAVE_USUARIO, JSON.stringify({ ...sessao.user, nome }));
  sessionStorage.setItem("vivo-adaptai-perfil", sessao.user.papel === "funcionario" ? "funcionario" : "cliente");
  sessionStorage.setItem("vivo-adaptai-cliente-id", "1");
  sessionStorage.setItem(CHAVE_SESSAO_EVENTO_ILD, criarChaveEventoIld());
  sessionStorage.removeItem(CHAVE_ACESSO_ILD_CONFIRMADO);
}

function mensagemErroAutenticacao(erro) {
  if (erro.name === "AbortError") return "A conexão demorou demais. Tente novamente.";
  if (!navigator.onLine) return "Você está sem conexão com a internet.";
  return erro.message || "Não foi possível concluir a solicitação.";
}

document.querySelectorAll(".formulario-autenticacao").forEach((form) => {
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const isRegister = form.id === "registroForm";
    const botaoEnviar = form.querySelector("button[type='submit']");
    const erroFormulario = form.querySelector(".alerta-formulario");
    const campoEmail = form.querySelector(isRegister ? "#email" : "#emailEntrar");
    const campoSenha = form.querySelector(isRegister ? "#senha" : "#senhaEntrar");
    const email = campoEmail?.value.trim().toLowerCase() || "";
    const senha = campoSenha?.value || "";
    ocultarErroFormulario(erroFormulario);

    if (isRegister) {
      const campoConfirmar = form.querySelector("#confirmarSenha");
      if (campoSenha && campoConfirmar && campoSenha.value !== campoConfirmar.value) {
        exibirErroFormulario(erroFormulario, "As senhas não coincidem. Verifique e tente novamente.");
        campoConfirmar.closest(".grupo-formulario")?.classList.add("tem-erro");
        campoConfirmar.focus();
        return;
      }
      campoConfirmar?.closest(".grupo-formulario")?.classList.remove("tem-erro");
    }

    if (!navigator.onLine) {
      exibirErroFormulario(erroFormulario, "Erro de rede: verifique sua conexão e tente novamente.");
      return;
    }

    definirCarregamentoBotao(botaoEnviar, true);
    try {
      const resposta = isRegister
        ? await requisitarApi("/auth/signup", {
            method: "POST",
            body: JSON.stringify({
              email,
              senha,
              nome: form.querySelector("#nomeCompleto")?.value.trim() || undefined,
              avaliacao_inicial: {
                uso_aplicativos: form.querySelector("input[name='usoAplicativos']:checked")?.value,
                autonomia_duvidas: form.querySelector("input[name='autonomiaDuvidas']:checked")?.value,
                conclusao_tarefas: form.querySelector("input[name='conclusaoTarefas']:checked")?.value
              }
            })
          })
        : await requisitarApi("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, senha })
          });

      if (isRegister && !resposta.session) {
        mostrarToast({ tipo: "sucesso", titulo: "Conta criada", mensagem: resposta.mensagem });
        window.setTimeout(() => { window.location.href = "entrar.html"; }, 1800);
        return;
      }

      const sessao = isRegister ? resposta.session : resposta;
      salvarSessaoAutenticada(sessao, isRegister ? form.querySelector("#nomeCompleto")?.value.trim() : "");
      mostrarToast({
        tipo: "sucesso",
        titulo: isRegister ? "Conta criada!" : "Login realizado!",
        mensagem: "Redirecionando para o início..."
      });
      const destinoAposLogin = sessionStorage.getItem('vivo-adaptai-retorno-login') || 'home.html';
      sessionStorage.removeItem('vivo-adaptai-retorno-login');
      window.setTimeout(() => { window.location.href = destinoAposLogin; }, 700);
    } catch (erro) {
      exibirErroFormulario(erroFormulario, mensagemErroAutenticacao(erro));
    } finally {
      definirCarregamentoBotao(botaoEnviar, false);
    }
  });
});

// A pessoa pode utilizar a demonstração sem conta. A opção cria somente uma
// sessão temporária neste navegador, com as mesmas permissões de navegação.
document.getElementById('linkContinuarVisitante')?.addEventListener('click', () => {
  sessionStorage.setItem('vivo-adaptai-sessao-autenticada', 'visitante');
  sessionStorage.setItem('vivo-adaptai-perfil', 'visitante');
  sessionStorage.setItem('vivo-adaptai-cliente-id', '1');
});

// Indicador de força de senha
function inicializarForcaSenha() {
  const campoSenha = document.getElementById("senha");
  const indicador = document.getElementById("indicadorForcaSenha");
  const texto = document.getElementById("indicadorForcaSenhaTexto");
  if (!campoSenha || !indicador || !texto) return;

  function calcularForca(valor) {
    if (!valor) return null;
    let pontos = 0;
    if (valor.length >= 12) pontos += 2;
    if (/[A-Z]/.test(valor) && /[a-z]/.test(valor)) pontos++;
    if (/\d/.test(valor)) pontos++;
    if (/[^A-Za-z0-9]/.test(valor)) pontos++;

    if (pontos <= 1) return "fraca";
    if (pontos <= 3) return "media";
    return "forte";
  }

  campoSenha.addEventListener("input", () => {
    const forca = calcularForca(campoSenha.value);

    indicador.classList.remove("indicador-forca-senha--fraca", "indicador-forca-senha--media", "indicador-forca-senha--forte");

    if (!forca) {
      indicador.hidden = true;
      texto.textContent = "";
      return;
    }

    indicador.hidden = false;
    indicador.classList.add(`indicador-forca-senha--${forca}`);
    texto.textContent = forca === "fraca" ? "Senha fraca" : forca === "media" ? "Senha média" : "Senha forte";
  });
}

// esqueci-senha.html: fluxo de etapas, indicadores, inputs de código

// Gerenciamento do fluxo de recuperação de senha
function inicializarFluxoRecuperacaoLegado() {
  const formStep1 = document.getElementById("formStep1");
  const formStep2 = document.getElementById("formStep2");
  const formStep3 = document.getElementById("formStep3");

  if (formStep1) {
    formStep1.addEventListener("submit", (e) => {
      e.preventDefault();
      const erroFormulario = document.getElementById("formStep1Error");
      ocultarErroFormulario(erroFormulario);

      if (!navigator.onLine) {
        exibirErroFormulario(erroFormulario, "Erro de rede: verifique sua conexão e tente novamente.");
        return;
      }

      definirCarregamentoBotao(document.getElementById("formStep1SubmitBtn"), true);
      avancarParaEtapa(2);
    });
  }

  if (formStep2) {
    formStep2.addEventListener("submit", (e) => {
      e.preventDefault();
      const erroFormulario = document.getElementById("formStep2Error");
      ocultarErroFormulario(erroFormulario);

      if (!navigator.onLine) {
        exibirErroFormulario(erroFormulario, "Erro de rede: verifique sua conexão e tente novamente.");
        return;
      }

      definirCarregamentoBotao(document.getElementById("formStep2SubmitBtn"), true);
      avancarParaEtapa(3);
    });

    // Auto-focus em inputs de código
    const inputsCodigo = document.querySelectorAll(".input-codigo");
    inputsCodigo.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        if (e.target.value && index < inputsCodigo.length - 1) {
          inputsCodigo[index + 1].focus();
        }
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !e.target.value && index > 0) {
          inputsCodigo[index - 1].focus();
        }
      });
    });
  }

  if (formStep3) {
    formStep3.addEventListener("submit", (e) => {
      e.preventDefault();
      const campoNovaSenha = document.getElementById("novaSenha");
      const campoConfirmarNovaSenha = document.getElementById("confirmarNovaSenha");
      const erroFormulario = document.getElementById("formStep3Error");
      ocultarErroFormulario(erroFormulario);

      if (campoNovaSenha.value !== campoConfirmarNovaSenha.value) {
        campoConfirmarNovaSenha.setCustomValidity("As senhas não coincidem.");
        campoConfirmarNovaSenha.reportValidity();
        return;
      }
      campoConfirmarNovaSenha.setCustomValidity("");

      if (!navigator.onLine) {
        exibirErroFormulario(erroFormulario, "Erro de rede: verifique sua conexão e tente novamente.");
        return;
      }

      definirCarregamentoBotao(document.getElementById("formStep3SubmitBtn"), true);
      exibirSucessoFinal();
    });
  }
}

function inicializarFluxoRecuperacao() {
  const formulario = document.getElementById("formStep1");
  if (!formulario) return;

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const erro = document.getElementById("formStep1Error");
    const email = document.getElementById("emailRecuperacao")?.value.trim().toLowerCase();
    ocultarErroFormulario(erro);

    if (!email) {
      exibirErroFormulario(erro, "Informe seu e-mail para continuar.");
      return;
    }

    const botao = document.getElementById("formStep1SubmitBtn");
    definirCarregamentoBotao(botao, true);
    try {
      const resposta = await requisitarApi("/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      document.getElementById("recoveryStage1").style.display = "none";
      document.getElementById("recoveryStage2").style.display = "block";
      document.getElementById("step1").classList.remove("esta-ativo");
      document.getElementById("step1").classList.add("concluido");
      document.getElementById("step2").classList.add("esta-ativo");
      document.getElementById("recoverySubtitle").textContent = "Abra o link enviado para definir uma nova senha.";
      document.getElementById("recoveryConfirmationMessage").textContent = resposta.mensagem;
    } catch (falha) {
      exibirErroFormulario(erro, mensagemErroAutenticacao(falha));
    } finally {
      definirCarregamentoBotao(botao, false);
    }
  });
}

function inicializarNovaSenhaRecuperacao() {
  const formulario = document.getElementById("formNovaSenhaRecuperacao");
  if (!formulario) return;

  const parametros = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = parametros.get("access_token");
  const erro = document.getElementById("novaSenhaErro");
  const aviso = document.getElementById("novaSenhaAviso");
  const botao = document.getElementById("novaSenhaSalvar");
  const senha = document.getElementById("novaSenhaRecuperacao");
  const confirmar = document.getElementById("confirmarNovaSenhaRecuperacao");

  if (!token) {
    exibirErroFormulario(erro, "Este link é inválido ou expirou. Solicite uma nova recuperação.");
    botao.disabled = true;
    return;
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarErroFormulario(erro);
    if (senha.value !== confirmar.value) {
      exibirErroFormulario(erro, "As senhas não coincidem.");
      confirmar.focus();
      return;
    }
    if (
      senha.value.length < 12 ||
      !/[a-z]/.test(senha.value) ||
      !/[A-Z]/.test(senha.value) ||
      !/\d/.test(senha.value) ||
      !/[^A-Za-z0-9]/.test(senha.value)
    ) {
      exibirErroFormulario(erro, "Use 12 ou mais caracteres, com letra maiúscula, minúscula, número e símbolo.");
      senha.focus();
      return;
    }

    definirCarregamentoBotao(botao, true);
    try {
      const resposta = await requisitarApi("/auth/password/reset", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senha: senha.value })
      });
      aviso.textContent = resposta.mensagem + " Você já pode entrar.";
      aviso.hidden = false;
      formulario.hidden = true;
      window.history.replaceState({}, document.title, "nova-senha.html");
    } catch (falha) {
      exibirErroFormulario(erro, mensagemErroAutenticacao(falha));
    } finally {
      definirCarregamentoBotao(botao, false);
    }
  });
}

function avancarParaEtapa(etapa) {
  document.querySelectorAll(".estagio-recuperacao").forEach(el => el.style.display = "none");
  document.getElementById(`recoveryStage${etapa}`).style.display = "block";

  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");

  if (etapa === 2) {
    step1.classList.remove("esta-ativo");
    step1.classList.add("concluido");
    step2.classList.add("esta-ativo");
    document.getElementById("recoverySubtitle").textContent = "Insira o código enviado para o seu e-mail.";
  } else if (etapa === 3) {
    step2.classList.remove("esta-ativo");
    step2.classList.add("concluido");
    step3.classList.add("esta-ativo");
    document.getElementById("recoverySubtitle").textContent = "Escolha uma senha forte e segura.";
  }
}

function exibirSucessoFinal() {
  document.querySelectorAll(".estagio-recuperacao").forEach(el => el.style.display = "none");
  document.getElementById("recoverySuccess").style.display = "block";

  document.querySelector(".indicador-passos").style.display = "none";
  document.getElementById("recoveryTitle").style.display = "none";
  document.getElementById("recoverySubtitle").style.display = "none";
  document.getElementById("recoveryHelpBox").style.display = "none";
  document.getElementById("recoveryFooter").style.display = "none";
}

// home.html: compositor de mensagens, redireciona para atendimento

// Compositor de mensagens — permite enviar mensagem ou redirecionar para atendimento
const homeChatComposerForm = document.getElementById("chatComposerForm");
const homeChatComposerInput = document.getElementById("chatComposerInput");
const CHAVE_MENSAGEM_PENDENTE = "vivo-adaptai-mensagem-pendente";
const CHAVE_CLIENTE_API = "vivo-adaptai-cliente-id";
const CHAVE_MODO_GUIADO = "vivo-adaptai-modo-guiado";
const API_BASE_URL = (
  document.querySelector('meta[name="vivo-adaptai-api-url"]')?.getAttribute("content") ||
  window.VIVO_ADAPTAI_API_URL ||
  "https://vivo-adapt-ai.onrender.com"
).replace(/\/$/, "");

// Acorda o servidor hospedado antes da primeira interação. A falha é
// silenciosa: cada ação ainda mostra uma mensagem amigável se necessário.
if (!/(^https?:\/\/(127\.0\.0\.1|localhost))/.test(API_BASE_URL)) {
  window.fetch(`${API_BASE_URL}/health`, { method: "GET" }).catch(() => null);
}

// Evolucao continua do ILD. Todas as interacoes relevantes sao registradas,
// mas somente sinais de habilidade (acesso, conclusao, erro, abandono e pedido
// de suporte) alteram a pontuacao. A telemetria nunca bloqueia a navegacao.
const CHAVE_SESSAO_EVENTO_ILD = "vivo-adaptai-evento-sessao-ild";
const CHAVE_ACESSO_ILD_CONFIRMADO = "vivo-adaptai-acesso-ild-confirmado";

function criarChaveEventoIld() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function paginaAtualIld() {
  return document.body.dataset.page || window.location.pathname.split("/").pop()?.replace(".html", "") || "inicio";
}

function nomeElementoIld(elemento) {
  if (!(elemento instanceof Element)) return "pagina";
  const alvo = elemento.closest("button, a, input, select, textarea, [role='button']") || elemento;
  return String(alvo.id || alvo.getAttribute("name") || alvo.getAttribute("aria-label") || alvo.textContent || alvo.tagName)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function registrarEventoIld(tipoEvento, opcoes = {}) {
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  if (!token) return null;

  const eventoChave = opcoes.eventoChave || criarChaveEventoIld();
  try {
    const resposta = await fetch(`${API_BASE_URL}/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        evento_chave: eventoChave,
        tipo_evento: tipoEvento,
        nome_tarefa: opcoes.nomeTarefa || null,
        duracao_segundos: Number.isFinite(opcoes.duracaoSegundos)
          ? Math.max(0, Math.min(86400, Math.round(opcoes.duracaoSegundos)))
          : null,
        detalhes: {
          pagina: paginaAtualIld(),
          ...(opcoes.detalhes || {})
        }
      }),
      keepalive: Boolean(opcoes.keepalive)
    });
    if (!resposta.ok) return null;
    const resultado = await resposta.json();
    sessionStorage.setItem("vivo-adaptai-ild-atual", String(resultado.ild));
    sessionStorage.setItem("vivo-adaptai-perfil-ild", resultado.perfil);
    return resultado;
  } catch (_) {
    return null;
  }
}

function inicializarTelemetriaIld() {
  if (!sessionStorage.getItem(CHAVE_TOKEN_ACESSO)) return;

  const pagina = paginaAtualIld();
  const paginasAtendimento = new Set([
    "atendimento-texto", "atendimento-voz", "atendimento-hibrido", "libras", "texto-simplificado"
  ]);
  const tarefa = {
    nome: paginasAtendimento.has(pagina) ? "atendimento" : `formulario_${pagina}`,
    inicio: Date.now(),
    iniciada: false,
    concluida: false
  };

  let chaveAcesso = sessionStorage.getItem(CHAVE_SESSAO_EVENTO_ILD);
  if (!chaveAcesso) {
    chaveAcesso = criarChaveEventoIld();
    sessionStorage.setItem(CHAVE_SESSAO_EVENTO_ILD, chaveAcesso);
  }
  if (!sessionStorage.getItem(CHAVE_ACESSO_ILD_CONFIRMADO)) {
    registrarEventoIld("acesso_app", {
      eventoChave: chaveAcesso,
      detalhes: { origem: "sessao_autenticada" },
      keepalive: true
    }).then((resultado) => {
      if (resultado) sessionStorage.setItem(CHAVE_ACESSO_ILD_CONFIRMADO, "1");
    });
  }

  function iniciarTarefa(origem) {
    if (tarefa.iniciada || tarefa.concluida) return;
    tarefa.iniciada = true;
    tarefa.inicio = Date.now();
    registrarEventoIld("tarefa_iniciada", {
      nomeTarefa: tarefa.nome,
      detalhes: { origem }
    });
  }

  function concluirTarefa(origem) {
    if (tarefa.concluida) return;
    if (!tarefa.iniciada) iniciarTarefa(origem);
    tarefa.concluida = true;
    registrarEventoIld("tarefa_concluida", {
      nomeTarefa: tarefa.nome,
      duracaoSegundos: (Date.now() - tarefa.inicio) / 1000,
      detalhes: { origem },
      keepalive: true
    });
  }

  document.addEventListener("click", (evento) => {
    const alvo = evento.target instanceof Element
      ? evento.target.closest("button, a, [role='button']")
      : null;
    if (!alvo) return;
    const elemento = nomeElementoIld(alvo);
    registrarEventoIld("acao", { detalhes: { origem: "clique", elemento } });

    const texto = elemento.toLocaleLowerCase("pt-BR");
    if (/outro tipo de ajuda|falar com (um )?atendente|suporte humano/.test(texto)) {
      registrarEventoIld("pedido_suporte", {
        nomeTarefa: "solicitar_ajuda",
        detalhes: { origem: "clique", elemento }
      });
    }

    if (paginasAtendimento.has(pagina)) iniciarTarefa("interacao_atendimento");
    if (/^btnencerrar/i.test(alvo.id) || texto === "encerrar" || texto === "encerrar atendimento") {
      concluirTarefa("encerrar_atendimento");
    }
  }, { capture: true });

  document.addEventListener("change", (evento) => {
    const elemento = nomeElementoIld(evento.target);
    registrarEventoIld("acao", { detalhes: { origem: "alteracao", elemento } });
    if (evento.target instanceof Element && evento.target.closest("form")) iniciarTarefa("preenchimento_formulario");
  }, { capture: true });

  document.addEventListener("submit", (evento) => {
    const formulario = evento.target instanceof Element ? evento.target.closest("form") : null;
    registrarEventoIld("acao", {
      detalhes: { origem: "envio_formulario", elemento: nomeElementoIld(formulario) }
    });
    if (formulario && !formulario.matches("#chatComposerForm, #chatForm, #librasForm, #simplificadoForm")) {
      concluirTarefa("envio_formulario");
    } else if (paginasAtendimento.has(pagina)) {
      iniciarTarefa("mensagem_atendimento");
    }
  }, { capture: true });

  if (pagina === "erro-atendimento") {
    registrarEventoIld("erro", {
      nomeTarefa: "atendimento",
      detalhes: { origem: "tela_erro" }
    });
  }

  window.addEventListener("error", (evento) => {
    if (evento.filename && !evento.filename.startsWith(window.location.origin)) return;
    registrarEventoIld("erro", {
      nomeTarefa: tarefa.iniciada ? tarefa.nome : null,
      detalhes: { origem: "erro_interface" },
      keepalive: true
    });
  });

  window.addEventListener("unhandledrejection", () => {
    registrarEventoIld("erro", {
      nomeTarefa: tarefa.iniciada ? tarefa.nome : null,
      detalhes: { origem: "falha_assincrona" },
      keepalive: true
    });
  });

  window.addEventListener("pagehide", () => {
    if (!tarefa.iniciada || tarefa.concluida) return;
    registrarEventoIld("tarefa_abandonada", {
      nomeTarefa: tarefa.nome,
      duracaoSegundos: (Date.now() - tarefa.inicio) / 1000,
      detalhes: { origem: "saida_da_pagina" },
      keepalive: true
    });
  });
}

function obterClienteApiId() {
  const idSalvo = Number(sessionStorage.getItem(CHAVE_CLIENTE_API));
  return Number.isInteger(idSalvo) && idSalvo > 0 ? idSalvo : 1;
}

function modoGuiadoAtivo() {
  return sessionStorage.getItem(CHAVE_MODO_GUIADO) === "true";
}

async function solicitarRespostaDoMimo(mensagem, opcoes = {}) {
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  const modoGuiado = opcoes.modoGuiado ?? modoGuiadoAtivo();
  const resposta = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    // Com login, o backend encontra o cliente pelo token, sem aceitar um ID escolhido pelo navegador.
    body: JSON.stringify(token
      ? { mensagem, modo_guiado: modoGuiado }
      : { cliente_id: obterClienteApiId(), mensagem, modo_guiado: modoGuiado })
  });

  if (!resposta.ok) throw new Error(`API respondeu com status ${resposta.status}`);
  return resposta.json();
}

let encerramentoAtendimentoEmCurso = false;

async function encerrarAtendimentoAtual({ confirmar = false } = {}) {
  if (encerramentoAtendimentoEmCurso) return;
  const confirmacaoSalva = localStorage.getItem('vivo-adaptai-confirmar-encerramento');
  const deveConfirmar = confirmar || confirmacaoSalva !== 'false';
  if (deveConfirmar && !window.confirm('Tem certeza que deseja encerrar o atendimento?')) return;

  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  if (!token) {
    window.location.href = 'conclusao.html';
    return;
  }

  encerramentoAtendimentoEmCurso = true;
  const botoes = document.querySelectorAll(
    '#btnEncerrarAtendimento, #btnEncerrarMenu, #btnEncerrarMenuTexto, #btnEncerrarMenuVoz, #btnFinalizar'
  );
  botoes.forEach((botao) => {
    botao.dataset.estadoDesabilitadoAntes = String(botao.disabled);
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
  });

  try {
    const resultado = await requisitarApi('/conversas/atual/encerrar', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resultado.conversa_id) {
      sessionStorage.setItem('vivo-adaptai-ultima-conversa-encerrada', String(resultado.conversa_id));
    }
    window.location.href = 'conclusao.html';
  } catch (erro) {
    encerramentoAtendimentoEmCurso = false;
    botoes.forEach((botao) => {
      botao.disabled = botao.dataset.estadoDesabilitadoAntes === 'true';
      botao.removeAttribute('aria-busy');
      delete botao.dataset.estadoDesabilitadoAntes;
    });
    mostrarToast({
      tipo: 'erro',
      titulo: 'Atendimento ainda aberto',
      mensagem: mensagemErroAutenticacao(erro)
    });
  }
}

// Este bloco é exclusivo da Home (compositor que apenas inicia o atendimento).
// Em atendimento-texto.html o elemento #chatBody já existe e o envio de
// mensagens é tratado pela Seção 7 — por isso este listener não deve rodar lá,
// senão a mensagem é adicionada ao chat E a página redireciona para si mesma,
// recarregando e apagando a conversa.
if (homeChatComposerForm && homeChatComposerInput && !document.getElementById("chatBody") && !document.getElementById("librasBody") && !document.getElementById("simplificadoBody")) {
  homeChatComposerForm.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const texto = homeChatComposerInput.value.trim();
    // Guarda o texto digitado para que atendimento-texto.html possa exibi-lo
    // como a primeira mensagem do usuário, em vez de descartá-lo no redirecionamento.
    if (texto) {
      sessionStorage.setItem(CHAVE_MENSAGEM_PENDENTE, texto);
    }
    window.location.href = "atendimento-texto.html";
  });

  document.querySelectorAll(".botao-resposta").forEach((botao) => {
    botao.addEventListener("click", () => {
      window.location.href = "atendimento-texto.html";
    });
  });
}

// atendimento-texto.html: chat com simulação de mensagens, encerramento de atendimento

const chatBody = document.getElementById("chatBody");
const btnEncerrarAtendimento = document.getElementById("btnEncerrarAtendimento");

// Compositor de mensagens — declarar aqui para evitar ReferenceError global
// (na Seção 6 foram renomeadas para homeChatComposerForm/Input para evitar colisão
// com esta página, que usa os mesmos IDs #chatComposerForm / #chatComposerInput)
const chatComposerForm = document.getElementById("chatComposerForm");
const chatComposerInput = document.getElementById("chatComposerInput");

// Encerramento de atendimento — redireciona para conclusão
// NOTA: As páginas de Libras e Texto Simplificado registram seus próprios
// listeners específicos (com confirm ou lógica extra). Para evitar conflito,
// só registramos o handler genérico quando NÃO estamos nessas páginas.
const isLibrasPage = !!document.getElementById('librasBody');
const isSimplificadoPage = !!document.getElementById('simplificadoBody');
const isVozPage = !!document.getElementById('voiceBody');
const chatPageEspecifica = isLibrasPage || isSimplificadoPage || isVozPage;

function atualizarInterfaceModoGuiado() {
  const ativo = modoGuiadoAtivo();
  const botao = document.getElementById("btnModoGuiado");
  const faixa = document.getElementById("faixaModoGuiado");
  if (botao) {
    botao.classList.toggle("esta-ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
    botao.innerHTML = ativo
      ? '<i class="fa-solid fa-route"></i><span>Passo a passo ativado</span><small>Desativar</small>'
      : '<i class="fa-solid fa-route"></i><span>Guiar passo a passo</span><small>Uma ação por vez</small>';
  }
  if (faixa) faixa.hidden = !ativo;
}

if (chatBody) {
  const envelope = chatBody.closest(".estrutura-chat")?.querySelector(".envelope-compositor-chat");
  if (envelope && !document.getElementById("btnModoGuiado")) {
    const painel = document.createElement("section");
    painel.className = "painel-modo-guiado";
    painel.setAttribute("aria-label", "Modo de orientação");
    painel.innerHTML = `
      <button type="button" class="botao-modo-guiado" id="btnModoGuiado" aria-pressed="false"></button>
      <div class="faixa-modo-guiado" id="faixaModoGuiado" hidden>
        <i class="fa-solid fa-circle-info"></i>
        <span>O Mimo mostrará somente uma ação por vez. Use “Consegui” ou “Não consegui” para continuar.</span>
      </div>
    `;
    envelope.insertBefore(painel, envelope.firstChild);
    painel.querySelector("#btnModoGuiado").addEventListener("click", () => {
      const novoEstado = !modoGuiadoAtivo();
      sessionStorage.setItem(CHAVE_MODO_GUIADO, String(novoEstado));
      atualizarInterfaceModoGuiado();
      mostrarToast({
        tipo: "sucesso",
        titulo: novoEstado ? "Passo a passo ativado" : "Passo a passo desativado",
        mensagem: novoEstado ? "Agora o Mimo explicará uma ação de cada vez." : "O Mimo voltou ao atendimento normal."
      });
    });
    atualizarInterfaceModoGuiado();
  }
}

if (btnEncerrarAtendimento && !chatPageEspecifica) {
  btnEncerrarAtendimento.addEventListener("click", () => {
    encerrarAtendimentoAtual();
  });
}

// Respostas simuladas do Mimo, mapeadas às respostas rápidas do atendimento;
// mensagens digitadas livremente recebem uma resposta padrão de continuidade.
const RESPOSTAS_ROBO = {
  "minha internet não funciona": "Entendi! Vamos verificar alguns pontos para resolver isso. Você já tentou reiniciar o seu modem?",
  "quero conhecer os planos": "Ótimo! Temos planos de internet, móvel e combos. Posso te mostrar as opções disponíveis para a sua região.",
  "preciso de outro tipo de ajuda": "Sem problemas! Me conta com suas palavras o que você precisa e eu te encaminho para o time certo."
};

function respostaPadraoRobo(texto) {
  const chave = texto.trim().toLowerCase();
  return RESPOSTAS_ROBO[chave] || "Recebi sua mensagem! Estou verificando e já te retorno com mais detalhes.";
}

// Adiciona mensagem do usuário ao chat com estado inicial "enviando".
// Retorna o elemento criado para permitir atualizar seu estado depois.
function adicionarMensagemUsuario(texto) {
  if (!texto.trim() || !chatBody) return null;

  const mensagem = document.createElement("div");
  mensagem.className = "mensagem mensagem-usuario";
  mensagem.innerHTML = `
    <div class="balao balao-usuario">
      <p></p>
    </div>
    <span class="horario-mensagem">
      <span class="texto-horario">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <i class="fa-solid fa-clock icone-status-enviando" aria-label="Enviando"></i>
    </span>
  `;
  mensagem.querySelector("p").textContent = texto;
  mensagem.dataset.texto = texto;

  chatBody.appendChild(mensagem);
  chatBody.scrollTop = chatBody.scrollHeight;
  return mensagem;
}

// Atualiza o ícone/estado de uma mensagem do usuário: "enviando", "entregue" ou "erro".
function atualizarStatusMensagemUsuario(mensagemEl, status) {
  if (!mensagemEl) return;
  const horario = mensagemEl.querySelector(".horario-mensagem");
  const iconeAntigo = horario.querySelector("i");
  iconeAntigo?.remove();
  horario.querySelector(".acao-tentar-novamente")?.remove();
  mensagemEl.classList.remove("mensagem-com-erro");

  if (status === "enviando") {
    horario.insertAdjacentHTML("beforeend", `<i class="fa-solid fa-clock icone-status-enviando" aria-label="Enviando"></i>`);
  } else if (status === "entregue") {
    horario.insertAdjacentHTML("beforeend", `<i class="fa-solid fa-check-double" aria-label="Entregue"></i>`);
  } else if (status === "erro") {
    mensagemEl.classList.add("mensagem-com-erro");
    horario.insertAdjacentHTML("beforeend", `
      <i class="fa-solid fa-triangle-exclamation icone-status-erro" aria-label="Erro ao enviar"></i>
      <button type="button" class="acao-tentar-novamente">Tentar novamente</button>
    `);
    horario.querySelector(".acao-tentar-novamente").addEventListener("click", () => {
      enviarMensagemChat(mensagemEl.dataset.texto, mensagemEl);
    });
  }
}

// Mostra/oculta o indicador "Mimo está digitando…".
let elementoDigitando = null;
function exibirDigitando() {
  if (!chatBody || elementoDigitando) return;
  elementoDigitando = document.createElement("div");
  elementoDigitando.className = "mensagem mensagem-robo";
  elementoDigitando.setAttribute("aria-label", "Mimo está digitando");
  elementoDigitando.innerHTML = `
    <div class="balao balao-robo balao-digitando">
      <span class="ponto-digitando"></span>
      <span class="ponto-digitando"></span>
      <span class="ponto-digitando"></span>
    </div>
  `;
  chatBody.appendChild(elementoDigitando);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function ocultarDigitando() {
  elementoDigitando?.remove();
  elementoDigitando = null;
}

// Adiciona a resposta do Mimo ao chat.
function adicionarMensagemRobo(texto) {
  if (!chatBody) return;
  const mensagem = document.createElement("div");
  mensagem.className = "mensagem mensagem-robo";
  mensagem.innerHTML = `
    <div class="balao balao-robo">
      <p></p>
    </div>
    <span class="horario-mensagem">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  `;
  mensagem.querySelector("p").textContent = texto;
  if (modoGuiadoAtivo()) {
    const acoes = document.createElement("div");
    acoes.className = "acoes-passo-guiado";
    acoes.innerHTML = `
      <button type="button" class="acao-passo-guiado acao-consegui"><i class="fa-solid fa-check"></i> Consegui</button>
      <button type="button" class="acao-passo-guiado acao-nao-consegui"><i class="fa-solid fa-life-ring"></i> Não consegui</button>
    `;
    acoes.querySelector(".acao-consegui").addEventListener("click", () => {
      acoes.querySelectorAll("button").forEach((botao) => { botao.disabled = true; });
      enviarMensagemChat("Consegui concluir esta etapa. Qual é a próxima ação?");
    });
    acoes.querySelector(".acao-nao-consegui").addEventListener("click", () => {
      acoes.querySelectorAll("button").forEach((botao) => { botao.disabled = true; });
      enviarMensagemChat("Não consegui concluir esta etapa. Explique de outra forma, com uma ação ainda mais simples.");
    });
    mensagem.querySelector(".balao-robo").appendChild(acoes);
  }
  chatBody.appendChild(mensagem);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Orquestra o ciclo completo de envio: enviando → entregue/erro → digitando → resposta.
// Recebe opcionalmente o elemento de uma mensagem já existente (fluxo de retry).
async function enviarMensagemChat(texto, mensagemExistente) {
  const mensagemEl = mensagemExistente || adicionarMensagemUsuario(texto);
  if (!mensagemEl) return;

  atualizarStatusMensagemUsuario(mensagemEl, "enviando");

  try {
    if (!navigator.onLine) throw new Error("Sem conexão com a internet");
    const dados = await solicitarRespostaDoMimo(texto);
    atualizarStatusMensagemUsuario(mensagemEl, "entregue");
    exibirDigitando();

    window.setTimeout(() => {
      ocultarDigitando();
      adicionarMensagemRobo(dados.resposta);
    }, 450);
  } catch (erro) {
    console.error("Falha ao consultar o atendimento", erro);
    ocultarDigitando();
    atualizarStatusMensagemUsuario(mensagemEl, "erro");
    mostrarToast({
      tipo: "erro",
      titulo: "Não foi possível falar com o Mimo",
      mensagem: "Verifique se o atendimento está disponível e tente novamente."
    });
  }
}

// Se o usuário digitou uma mensagem no compositor da Home antes de ser
// redirecionado para cá (ver Seção 6), exibe-a agora como primeira mensagem.
if (chatBody) {
  const mensagemPendente = sessionStorage.getItem(CHAVE_MENSAGEM_PENDENTE);
  if (mensagemPendente) {
    enviarMensagemChat(mensagemPendente);
    sessionStorage.removeItem(CHAVE_MENSAGEM_PENDENTE);
  }
}

// Formulário de chat — adiciona mensagens ou redireciona
if (chatComposerForm && chatComposerInput && chatBody) {
  chatComposerForm.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const texto = chatComposerInput.value;
    if (!texto.trim()) return;
    enviarMensagemChat(texto);
    chatComposerInput.value = "";
    chatComposerInput.focus();
  });

  document.querySelectorAll(".botao-resposta:not(.botao-sugestao-erro)").forEach((botao) => {
    botao.addEventListener("click", () => {
      enviarMensagemChat(botao.textContent.trim());
    });
  });
}

// atendimento-voz.html: simulação de estados de voz, toggle entre voz e digitação

// Simulação de estados de voz — Ouvindo → Processando → Respondendo
const voiceMicBtn = document.getElementById("voiceMicBtn");
const voiceStatusTitle = document.getElementById("voiceStatusTitle");
const voiceStatusHint = document.getElementById("voiceStatusHint");
const voiceTranscriptText = document.getElementById("voiceTranscriptText");
const voiceMimo = document.getElementById("voiceMimo");

// Referências dos timers da simulação de voz — permitem cancelar (clearTimeout)
// um ciclo anterior ainda pendente ao iniciar um novo, evitando que dois ciclos
// concorrentes sobrescrevam o estado da tela fora de ordem.
let voiceListeningTimer1 = null;
let voiceListeningTimer2 = null;

function usoMicrofonePermitido() {
  return localStorage.getItem('vivo-adaptai-permissao-usar_microfone') === 'true';
}

if (voiceMicBtn) {
  voiceMicBtn.addEventListener("click", () => {
    if (!usoMicrofonePermitido()) {
      mostrarToast({
        tipo: "info",
        titulo: "Microfone desativado",
        mensagem: "Ative o microfone em Permissões antes de iniciar o atendimento por voz."
      });
      window.setTimeout(() => { window.location.href = "permissoes.html"; }, 900);
      return;
    }
    const estaAtivo = voiceMicBtn.classList.toggle("esta-ouvindo");
    voiceMicBtn.setAttribute("aria-pressed", String(estaAtivo));

    // Cancela qualquer timer de um ciclo anterior antes de iniciar/encerrar o atual
    clearTimeout(voiceListeningTimer1);
    clearTimeout(voiceListeningTimer2);

    if (estaAtivo) {
      voiceStatusTitle.textContent = "Ouvindo você...";
      voiceStatusHint.textContent = "Fale agora, o Mimo está escutando.";
      voiceTranscriptText.textContent = "...";
      voiceTranscriptText.classList.remove("esta-aguardando-usuario");
      voiceMimo.classList.add("esta-ouvindo");

      voiceListeningTimer1 = setTimeout(() => {
        if (!voiceMicBtn.classList.contains("esta-ouvindo")) return;
        voiceStatusTitle.textContent = "Processando...";
        voiceStatusHint.textContent = "Só um instante, o Mimo está pensando.";
        voiceTranscriptText.textContent = "Minha internet está lenta hoje.";
        voiceMimo.classList.remove("esta-ouvindo");
        voiceMimo.classList.add("esta-processando");

        voiceListeningTimer2 = setTimeout(() => {
          if (!voiceMicBtn.classList.contains("esta-ouvindo")) return;
          voiceStatusTitle.textContent = "Respondendo...";
          voiceStatusHint.textContent = "O Mimo está falando com você.";
          voiceMimo.classList.remove("esta-processando");
          voiceMimo.classList.add("esta-respondendo");
        }, 1800);
      }, 2500);

    } else {
      voiceStatusTitle.textContent = "Como posso ajudar você hoje?";
      voiceStatusHint.textContent = "Toque no microfone quando estiver pronto.";
      voiceTranscriptText.textContent = "Aguardando você falar...";
      voiceTranscriptText.classList.add("esta-aguardando-usuario");
      voiceMimo.classList.remove("esta-ouvindo", "esta-processando", "esta-respondendo");
    }
  });
}

// Reconhecimento de voz real. O listener em captura substitui a simulação.
let reconhecimentoVozAtual = null;

function iniciarReconhecimentoVoz({ aoIniciar, aoTranscrever, aoFinalizar, aoEncerrar, aoErro }) {
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconhecimento) {
    mostrarToast({ tipo: "aviso", titulo: "Voz indisponível", mensagem: "Use o Chrome para falar com o Mimo ou escolha a opção de digitar." });
    return null;
  }
  reconhecimentoVozAtual?.abort?.();
  const reconhecimento = new Reconhecimento();
  reconhecimento.lang = "pt-BR";
  reconhecimento.continuous = false;
  reconhecimento.interimResults = true;
  reconhecimento.maxAlternatives = 1;
  let textoFinal = "";
  reconhecimento.onstart = () => {
    localStorage.setItem('vivo-adaptai-permissao-usar_microfone', 'true');
    aoIniciar?.();
  };
  reconhecimento.onresult = (evento) => {
    let parcial = "";
    for (let indice = evento.resultIndex; indice < evento.results.length; indice += 1) {
      const trecho = evento.results[indice][0].transcript;
      if (evento.results[indice].isFinal) textoFinal += `${trecho} `;
      else parcial += trecho;
    }
    const transcricao = `${textoFinal}${parcial}`.trim();
    aoTranscrever?.(transcricao);
    if (textoFinal.trim()) aoFinalizar?.(textoFinal.trim());
  };
  reconhecimento.onerror = (evento) => {
    const mensagens = {
      "not-allowed": "Permita o microfone nas configurações do navegador e tente novamente.",
      "service-not-allowed": "O reconhecimento de voz foi bloqueado pelo navegador.",
      "no-speech": "Não consegui ouvir sua voz. Aproxime-se do microfone e tente novamente.",
      "audio-capture": "Nenhum microfone foi encontrado neste dispositivo.",
      "network": "O reconhecimento de voz precisa de conexão com a internet."
    };
    const mensagem = mensagens[evento.error] || "Não foi possível usar o microfone agora.";
    aoErro?.(mensagem);
    mostrarToast({ tipo: "aviso", titulo: "Não consegui ouvir", mensagem });
  };
  reconhecimento.onend = () => {
    if (reconhecimentoVozAtual === reconhecimento) reconhecimentoVozAtual = null;
    aoEncerrar?.(textoFinal.trim());
  };
  reconhecimentoVozAtual = reconhecimento;
  try { reconhecimento.start(); }
  catch (_) {
    reconhecimentoVozAtual = null;
    mostrarToast({ tipo: "aviso", titulo: "Microfone ocupado", mensagem: "Aguarde um instante e tente novamente." });
    return null;
  }
  return reconhecimento;
}

if (voiceMicBtn) {
  voiceMicBtn.addEventListener("click", (evento) => {
    evento.preventDefault();
    evento.stopImmediatePropagation();
    if (reconhecimentoVozAtual) { reconhecimentoVozAtual.stop(); return; }
    let mensagemEnviada = false;
    iniciarReconhecimentoVoz({
      aoIniciar: () => {
        voiceMicBtn.classList.add("esta-ouvindo");
        voiceMicBtn.setAttribute("aria-pressed", "true");
        voiceStatusTitle.textContent = "Ouvindo você...";
        voiceStatusHint.textContent = "Fale agora. Toque novamente para parar.";
        voiceTranscriptText.textContent = "...";
        voiceTranscriptText.classList.remove("esta-aguardando-usuario");
        voiceMimo.classList.add("esta-ouvindo");
      },
      aoTranscrever: (texto) => { if (texto) voiceTranscriptText.textContent = texto; },
      aoFinalizar: async (texto) => {
        if (!texto || mensagemEnviada) return;
        mensagemEnviada = true;
        voiceStatusTitle.textContent = "Processando...";
        voiceStatusHint.textContent = "Só um instante, o Mimo está preparando a resposta.";
        voiceMimo.classList.remove("esta-ouvindo");
        voiceMimo.classList.add("esta-processando");
        try {
          const resultado = await solicitarRespostaDoMimo(texto);
          const resposta = resultado.resposta || "Não consegui preparar uma resposta agora.";
          voiceTranscriptText.textContent = resposta;
          voiceStatusTitle.textContent = "Respondendo...";
          voiceStatusHint.textContent = "Toque no microfone para falar novamente.";
          voiceMimo.classList.remove("esta-processando");
          voiceMimo.classList.add("esta-respondendo");
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const fala = new SpeechSynthesisUtterance(resposta);
            fala.lang = "pt-BR";
            fala.rate = .95;
            window.speechSynthesis.speak(fala);
          }
        } catch (_) {
          voiceStatusTitle.textContent = "Não consegui responder";
          voiceStatusHint.textContent = "Tente novamente ou escolha a opção de digitar.";
          voiceMimo.classList.remove("esta-processando");
        }
      },
      aoErro: () => {
        voiceStatusTitle.textContent = "Microfone não disponível";
        voiceStatusHint.textContent = "Tente novamente ou digite sua mensagem.";
      },
      aoEncerrar: () => {
        voiceMicBtn.classList.remove("esta-ouvindo");
        voiceMicBtn.setAttribute("aria-pressed", "false");
        voiceMimo.classList.remove("esta-ouvindo");
      }
    });
  }, { capture: true });
}

document.querySelectorAll(".microfone-compositor").forEach((botao) => {
  botao.setAttribute("aria-label", "Falar mensagem");
  const formulario = botao.closest("form") || botao.closest(".compositor");
  const entrada = formulario?.querySelector(".entrada-compositor, input[type='text'], textarea");
  if (!entrada) return;
  entrada.dataset.placeholderOriginal ||= entrada.placeholder;
  botao.addEventListener("click", (evento) => {
    evento.preventDefault();
    evento.stopImmediatePropagation();
    if (reconhecimentoVozAtual) { reconhecimentoVozAtual.stop(); return; }
    iniciarReconhecimentoVoz({
      aoIniciar: () => {
        botao.classList.add("esta-ouvindo");
        botao.setAttribute("aria-pressed", "true");
        entrada.placeholder = "Ouvindo... fale sua mensagem";
      },
      aoTranscrever: (texto) => { entrada.value = texto; },
      aoFinalizar: (texto) => { entrada.value = texto; entrada.focus(); },
      aoEncerrar: () => {
        botao.classList.remove("esta-ouvindo");
        botao.setAttribute("aria-pressed", "false");
        entrada.placeholder = entrada.dataset.placeholderOriginal;
      }
    });
  }, { capture: true });
});

// Toggle entre modo de voz e digitação
const voiceTypeToggle = document.getElementById("voiceTypeToggle");
const voiceTextFallback = document.getElementById("voiceTextFallback");

if (voiceTypeToggle && voiceTextFallback) {
  voiceTypeToggle.addEventListener("click", () => {
    const estaDigitando = voiceTextFallback.classList.toggle("esta-aberto");
    voiceTypeToggle.setAttribute("aria-pressed", String(estaDigitando));
    voiceTypeToggle.querySelector("span").textContent = estaDigitando 
      ? "Voltar para o modo de voz" 
      : "Digitar em vez de falar";
    
    if (estaDigitando) {
      document.getElementById("voiceComposerInput")?.focus();
    }
  });
}

// Formulário de fallback de digitação (atendimento-voz.html)
const voiceComposerForm = document.getElementById("voiceComposerForm");
const voiceComposerInput = document.getElementById("voiceComposerInput");
let voiceResponseTimer = null;

if (voiceComposerForm && voiceComposerInput) {
  voiceComposerForm.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const texto = voiceComposerInput.value.trim();
    if (!texto) return;

    // Cancela uma resposta simulada anterior ainda pendente
    clearTimeout(voiceResponseTimer);

    // Atualiza a transcrição com a mensagem do usuário
    if (voiceTranscriptText) {
      voiceTranscriptText.textContent = texto;
      voiceTranscriptText.classList.remove("esta-aguardando-usuario");
    }
    if (voiceStatusTitle) voiceStatusTitle.textContent = "Processando...";
    if (voiceStatusHint) voiceStatusHint.textContent = "Só um instante, o Mimo está pensando.";
    voiceComposerInput.value = "";

    // Simula resposta do Mimo após um tempo
    voiceResponseTimer = setTimeout(() => {
      if (voiceTranscriptText) {
        voiceTranscriptText.textContent = "Obrigado pela informação. Vou verificar isso para você.";
      }
      if (voiceStatusTitle) voiceStatusTitle.textContent = "Respondendo...";
      if (voiceStatusHint) voiceStatusHint.textContent = "O Mimo está falando com você.";
      voiceComposerForm.reset();
    }, 1500);
  });
}

// atendimento-hibrido.html: texto e voz lado a lado. Envio de mensagens e
// simulação de voz já funcionam sozinhos, pois reaproveitam os mesmos ids
// (#chatBody, #chatComposerForm, #voiceMicBtn) tratados nas seções de texto e voz.
// Aqui tratamos só o que existe em duplicidade na página híbrida: os dois menus
// de três pontos (um por painel), já que o listener genérico assume um único
// #menuChatTrigger por página.
function inicializarHibrido() {
  const paginaHibrida = document.querySelector(".paineis-hibrido");
  if (!paginaHibrida) return; // não está na página de Modo Híbrido

  function configurarMenuPainel(sufixo) {
    const trigger = document.getElementById(`menuChatTrigger${sufixo}`);
    const painel = document.getElementById(`menuChatPanel${sufixo}`);
    if (!trigger || !painel) return;

    trigger.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const abrindo = !painel.classList.contains("esta-aberto");

      // Fecha o menu do outro painel, se estiver aberto
      document.querySelectorAll(".paineis-hibrido .painel-menu-chat.esta-aberto").forEach((outro) => {
        if (outro !== painel) {
          outro.classList.remove("esta-aberto");
          outro.parentElement.querySelector(".botao-icone")?.setAttribute("aria-expanded", "false");
        }
      });

      painel.classList.toggle("esta-aberto", abrindo);
      trigger.setAttribute("aria-expanded", String(abrindo));
    });

    document.addEventListener("click", (evento) => {
      if (!painel.contains(evento.target) && !trigger.contains(evento.target)) {
        painel.classList.remove("esta-aberto");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        painel.classList.remove("esta-aberto");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    // "Alterar modalidade" — leva o usuário até o seletor já existente no rodapé
    const btnAlterarModalidade = document.getElementById(`btnAlterarModalidadeMenu${sufixo}`);
    if (btnAlterarModalidade) {
      btnAlterarModalidade.addEventListener("click", () => {
        painel.classList.remove("esta-aberto");
        trigger.setAttribute("aria-expanded", "false");
        abrirSeletorModalidade(obterModalidadeAtual());
      });
    }

    // "Limpar conversa" — cada painel limpa apenas o seu próprio histórico
    const btnLimpar = document.getElementById(`btnLimparConversaMenu${sufixo}`);
    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => {
        painel.classList.remove("esta-aberto");
        trigger.setAttribute("aria-expanded", "false");

        if (sufixo === "Texto") {
          limparConversaAtual();
        } else if (voiceTranscriptText) {
          voiceTranscriptText.textContent = "Aguardando você falar...";
          voiceTranscriptText.classList.add("esta-aguardando-usuario");
          if (voiceStatusTitle) voiceStatusTitle.textContent = "Como posso ajudar você hoje?";
          if (voiceStatusHint) voiceStatusHint.textContent = "Toque no microfone quando estiver pronto.";
          mostrarToast({ tipo: "sucesso", titulo: "Transcrição limpa", mensagem: "A transcrição foi reiniciada." });
        }
      });
    }

    // "Encerrar atendimento" — mesmo destino usado pelo botão "Encerrar" das demais páginas
    const btnEncerrar = document.getElementById(`btnEncerrarMenu${sufixo}`);
    if (btnEncerrar) {
      btnEncerrar.addEventListener("click", () => {
        encerrarAtendimentoAtual();
      });
    }
  }

  configurarMenuPainel("Texto");
  configurarMenuPainel("Voz");
}

// conclusao.html, historico.html: avaliação, atalhos de navegação, listagem de atendimentos

// Formulário de avaliação (conclusao.html) — simula o envio da nota e do
// comentário. Sem backend nesta fase: substituir pelo POST real quando a
// integração existir (ex.: POST /api/atendimentos/{id}/avaliacao).
function inicializarAvaliacao() {
  const formAvaliacao = document.getElementById("formAvaliacao");
  if (!formAvaliacao) return; // só executa dentro de conclusao.html

  const statusAvaliacao = document.getElementById("statusAvaliacao");
  const btnEnviar = document.getElementById("btnEnviarAvaliacao");
  const btnPular = document.getElementById("btnPularAvaliacao");

  formAvaliacao.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (btnEnviar.disabled) return;

    btnEnviar.disabled = true;
    if (btnPular) btnPular.disabled = true;
    statusAvaliacao.textContent = "Enviando avaliação...";
    statusAvaliacao.className = "status-perfil esta-salvando";

    // Simulação local — substituir por chamada real ao backend no futuro.
    setTimeout(() => {
      statusAvaliacao.textContent = "Obrigado pelo seu feedback!";
      statusAvaliacao.className = "status-perfil esta-sucesso";

      // Trava o formulário para não permitir reenvio duplicado
      formAvaliacao.querySelectorAll("input, textarea, button").forEach((campo) => {
        campo.disabled = true;
      });

      setTimeout(() => {
        window.location.href = "home.html";
      }, 1500);
    }, 1000);
  });
}

// Fonte única de dados do histórico (historico.html)
// Fonte mockada — a estrutura foi desenhada para que, na integração futura,
// baste trocar esta constante por dados vindos da API (ex.: GET /api/conversas),
// mantendo renderizarListaConversas() e inicializarSelecaoHistorico() como estão.
let CONVERSAS_HISTORICO = [
  {
    id: 1,
    titulo: 'Internet residencial não funciona',
    preview: 'Você: Minha internet parou de funcionar desde ontem à noite,...',
    modalidade: 'Texto',
    modalidadeIcone: 'fa-solid fa-comment-dots',
    data: 'Hoje às 14:32',
    duracao: '12 min',
    status: 'Concluído',
    statusClasse: 'status-concluido',
    statusIcone: 'fa-solid fa-circle',
    cor: 'roxo',
    icone: 'fa-solid fa-wifi',
    ultimaMensagem: 'Você: Minha internet parou de funcionar desde ontem à noite. Já reiniciei o roteador e não resolveu.',
    mensagemHora: '14:32',
    resumo: 'Você relatou instabilidade na sua internet. O Mimo está verificando sua conexão e os equipamentos associados.'
  },
  {
    id: 2,
    titulo: 'Entender minha conta',
    preview: 'Mimo: Claro! Vou te explicar os detalhes da sua conta de forma...',
    modalidade: 'Voz',
    modalidadeIcone: 'fa-solid fa-microphone',
    data: 'Ontem às 10:15',
    duracao: '8 min',
    status: 'Concluído',
    statusClasse: 'status-concluido',
    statusIcone: 'fa-solid fa-circle-check',
    cor: 'rosa',
    icone: 'fa-regular fa-user',
    ultimaMensagem: 'Mimo: Claro! Vou te explicar os detalhes da sua conta de forma simples e clara.',
    mensagemHora: '10:15',
    resumo: 'Você pediu para entender os itens da sua fatura. O Mimo explicou cada cobrança detalhadamente.'
  },
  {
    id: 3,
    titulo: 'Planos disponíveis',
    preview: 'Você: Quais são os planos disponíveis para internet?',
    modalidade: 'Texto simplificado',
    modalidadeIcone: 'fa-solid fa-list-check',
    data: '08/07/2025',
    duracao: '5 min',
    status: 'Concluído',
    statusClasse: 'status-concluido',
    statusIcone: 'fa-solid fa-circle-check',
    cor: 'verde',
    icone: 'fa-solid fa-layer-group',
    ultimaMensagem: 'Você: Quais são os planos disponíveis para internet?',
    mensagemHora: '09:00',
    resumo: 'Consulta sobre planos disponíveis para internet residencial. O Mimo apresentou as opções atuais.'
  },
  {
    id: 4,
    titulo: '2ª via da conta',
    preview: 'Mimo: Vou te mostrar o passo a passo para emitir a 2ª via...',
    modalidade: 'Libras',
    modalidadeIcone: 'fa-solid fa-hands-asl-interpreting',
    data: '05/07/2025',
    duracao: '15 min',
    status: 'Concluído',
    statusClasse: 'status-concluido',
    statusIcone: 'fa-solid fa-circle-check',
    cor: 'azul',
    icone: 'fa-solid fa-hands-asl-interpreting',
    ultimaMensagem: 'Mimo: Vou te mostrar o passo a passo para emitir a 2ª via da sua fatura.',
    mensagemHora: '16:45',
    resumo: 'Solicitação de segunda via da fatura. O Mimo orientou o processo via aplicativo com acessibilidade.'
  },
  {
    id: 5,
    titulo: 'Mudança de plano',
    preview: 'Você: Quero mudar meu plano atual para um com mais dados.',
    modalidade: 'Texto',
    modalidadeIcone: 'fa-solid fa-comment-dots',
    data: '01/07/2025',
    duracao: '10 min',
    status: 'Concluído',
    statusClasse: 'status-concluido',
    statusIcone: 'fa-solid fa-circle-check',
    cor: 'roxo',
    icone: 'fa-solid fa-mobile-screen',
    ultimaMensagem: 'Você: Quero mudar meu plano atual para um com mais dados.',
    mensagemHora: '11:20',
    resumo: 'Você solicitou mudança de plano móvel para um com mais dados de internet. O Mimo ajudou na comparação.'
  },
  {
    id: 6,
    titulo: 'Outros assuntos',
    preview: 'Mimo: Entendi! Como posso te ajudar hoje?',
    modalidade: 'Texto',
    modalidadeIcone: 'fa-solid fa-comment-dots',
    data: '28/06/2025',
    duracao: '7 min',
    status: 'Concluído',
    statusClasse: 'status-concluido',
    statusIcone: 'fa-solid fa-circle-check',
    cor: 'amarelo',
    icone: 'fa-regular fa-circle-question',
    ultimaMensagem: 'Mimo: Entendi! Como posso te ajudar hoje?',
    mensagemHora: '08:30',
    resumo: 'Conversa inicial de boas-vindas. O Mimo se apresentou e ofereceu ajuda geral.'
  }
];

// Renderiza os cards de conversa em #listaConversas a partir de CONVERSAS_HISTORICO.
// O layout/markup gerado é idêntico ao que existia fixo no HTML — apenas a origem
// dos dados mudou, preparando a troca futura por uma resposta de API.
function escaparTextoHistorico(valor) {
  return String(valor || '').replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[caractere]);
}

function formatarDataHistorico(dataIso) {
  if (!dataIso) return 'Sem data';
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return 'Sem data';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function converterConversaDoBackend(conversa) {
  const ultima = conversa.ultima_mensagem;
  const conteudo = ultima?.conteudo || 'Conversa iniciada';
  const remetente = ultima?.remetente === 'assistente' ? 'Mimo' : 'Voce';
  const aberta = conversa.status === 'aberta';
  const titulo = conteudo.length > 58 ? `${conteudo.slice(0, 58)}...` : conteudo;

  return {
    id: conversa.id,
    titulo,
    preview: `${remetente}: ${conteudo}`,
    modalidade: conversa.canal === 'telefone' ? 'Voz' : 'Texto',
    modalidadeIcone: conversa.canal === 'telefone' ? 'fa-solid fa-microphone' : 'fa-solid fa-comment-dots',
    data: formatarDataHistorico(conversa.iniciada_em),
    duracao: aberta ? 'Em andamento' : 'Encerrada',
    status: aberta ? 'Em andamento' : 'Concluida',
    statusClasse: aberta ? 'status-andamento' : 'status-concluido',
    statusIcone: 'fa-solid fa-circle',
    cor: aberta ? 'roxo' : 'verde',
    icone: 'fa-solid fa-comment-dots',
    ultimaMensagem: `${remetente}: ${conteudo}`,
    mensagemHora: formatarDataHistorico(ultima?.created_at || conversa.iniciada_em),
    resumo: ultima?.origem_resposta
      ? `Resposta gerada no modo ${ultima.origem_resposta}.`
      : 'Atendimento registrado no Vivo AdaptAI.'
  };
}

function exibirEstadoVazioHistorico(mensagem) {
  const vazio = document.querySelector('.vazio-historico');
  const lista = document.getElementById('listaConversas');
  const painel = document.getElementById('painelDetalhes');
  if (vazio) {
    const texto = vazio.querySelector('p');
    if (texto) texto.textContent = mensagem;
    vazio.style.display = 'block';
  }
  if (lista) lista.style.display = 'none';
  if (painel) painel.style.display = 'none';
}

async function carregarHistoricoReal() {
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  if (!token) {
    exibirEstadoVazioHistorico('Entre na sua conta para ver o historico de atendimentos.');
    return;
  }

  try {
    const conversas = await requisitarApi('/conversas', {
      headers: { Authorization: `Bearer ${token}` }
    });
    CONVERSAS_HISTORICO = conversas.map(converterConversaDoBackend);
    if (!CONVERSAS_HISTORICO.length) {
      exibirEstadoVazioHistorico('Voce ainda nao possui conversas registradas.');
      return;
    }

    renderizarListaConversas();
    inicializarFiltrosHistorico();
    inicializarSelecaoHistorico();
  } catch (erro) {
    console.warn('Falha ao carregar historico:', erro);
    exibirEstadoVazioHistorico('Nao foi possivel carregar seu historico agora. Tente novamente em instantes.');
  }
}

function renderizarListaConversas() {
  const lista = document.getElementById('listaConversas');
  if (!lista) return; // só executa dentro de historico.html

  lista.innerHTML = CONVERSAS_HISTORICO.map((conversa, indice) => `
    <article class="card-conversa${indice === 0 ? ' card-conversa-ativa' : ''}" data-conversa="${conversa.id}">
      <div class="icone-conversa icone-conversa-${conversa.cor}">
        <i class="${conversa.icone}"></i>
      </div>
      <div class="corpo-conversa">
        <h3 class="titulo-conversa">${escaparTextoHistorico(conversa.titulo)}</h3>
        <p class="preview-conversa">${escaparTextoHistorico(conversa.preview)}</p>
        <div class="rodape-conversa">
          <span class="tag-modalidade-conversa"><i class="${conversa.modalidadeIcone}"></i> ${escaparTextoHistorico(conversa.modalidade)}</span>
          <span class="data-conversa">${escaparTextoHistorico(conversa.data)}</span>
          <span class="status-conversa ${conversa.statusClasse}"><i class="${conversa.statusIcone}"></i> ${escaparTextoHistorico(conversa.status)}</span>
        </div>
      </div>
      <i class="fa-solid fa-chevron-right seta-conversa"></i>
    </article>
  `).join('');
}

// Filtros de histórico (historico.html) — nova estrutura mestre-detalhe
function inicializarFiltrosHistorico() {
  const filtroModalidade = document.getElementById('filtroModalidade');
  const filtroPeriodo = document.getElementById('filtroPeriodo');
  const cards = document.querySelectorAll('.card-conversa');
  if ((!filtroModalidade && !filtroPeriodo) || !cards.length) return;

  function aplicarFiltros() {
    const modalidade = filtroModalidade?.value || 'todas';
    const periodo = filtroPeriodo?.value || 'todos';
    const termoBusca = (document.getElementById('buscaHistoricoInput')?.value || '').trim().toLowerCase();
    // Consulta o DOM no momento da filtragem (não a lista capturada na inicialização),
    // para refletir corretamente conversas excluídas em tempo real (ver btnExcluirConversa).
    const cardsAtuais = document.querySelectorAll('.card-conversa');

    cardsAtuais.forEach((card) => {
      const tag = card.querySelector('.tag-modalidade-conversa')?.textContent.trim().toLowerCase() || '';
      const data = card.querySelector('.data-conversa')?.textContent.trim().toLowerCase() || '';
      const titulo = card.querySelector('.titulo-conversa')?.textContent.toLowerCase() || '';
      const preview = card.querySelector('.preview-conversa')?.textContent.toLowerCase() || '';

      let matchModalidade = true;
      if (modalidade !== 'todas') {
        const mapaModalidade = {
          'texto': 'texto',
          'voz': 'voz',
          'texto-simplificado': 'texto simplificado',
          'libras': 'libras'
        };
        matchModalidade = tag.includes(mapaModalidade[modalidade] || modalidade);
      }

      let matchPeriodo = true;
      if (periodo !== 'todos') {
        if (periodo === 'hoje') {
          matchPeriodo = data.includes('hoje');
        } else if (periodo === 'esta-semana') {
          matchPeriodo = data.includes('hoje') || data.includes('ontem');
        } else if (periodo === 'este-mes') {
          // Mostra tudo com data recente (inclui datas do mês atual)
          matchPeriodo = true;
        } else if (periodo === 'anterior') {
          // Mostra apenas datas mais antigas
          matchPeriodo = !data.includes('hoje') && !data.includes('ontem');
        }
      }

      let matchBusca = true;
      if (termoBusca) {
        matchBusca = titulo.includes(termoBusca) || preview.includes(termoBusca);
      }

      card.style.display = (matchModalidade && matchPeriodo && matchBusca) ? '' : 'none';
    });

    // Mostra/oculta estado vazio
    const visiveis = [...cardsAtuais].filter((c) => c.style.display !== 'none');
    const vazio = document.querySelector('.vazio-historico');
    const lista = document.getElementById('listaConversas');
    if (vazio) {
      vazio.style.display = visiveis.length === 0 ? 'block' : 'none';
    }
    if (lista) {
      lista.style.display = visiveis.length === 0 ? 'none' : '';
    }
  }

  if (filtroModalidade) filtroModalidade.addEventListener('change', aplicarFiltros);
  if (filtroPeriodo) filtroPeriodo.addEventListener('change', aplicarFiltros);

  const campoBusca = document.getElementById('buscaHistoricoInput');
  if (campoBusca) campoBusca.addEventListener('input', aplicarFiltros);
}

// Seleção de conversa e painel de detalhes
function inicializarSelecaoHistorico() {
  const cards = document.querySelectorAll('.card-conversa');
  if (!cards.length) return;

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.conversa);
      const dados = CONVERSAS_HISTORICO.find((conversa) => conversa.id === id);
      if (!dados) return;

      // Remove ativa de todos
      cards.forEach((c) => c.classList.remove('card-conversa-ativa'));
      card.classList.add('card-conversa-ativa');

      // Atualiza painel de detalhes
      const painel = document.getElementById('painelDetalhes');
      if (!painel) return;

      // Atualiza ícone
      const iconeDetalhes = painel.querySelector('.icone-detalhes');
      if (iconeDetalhes) {
        iconeDetalhes.className = 'icone-detalhes icone-detalhes-' + dados.cor;
        iconeDetalhes.innerHTML = '<i class="' + dados.icone + '"></i>';
      }

      // Atualiza título
      const tituloEl = document.getElementById('detalhesTitulo');
      if (tituloEl) tituloEl.textContent = dados.titulo;

      // Atualiza status do cabeçalho
      const statusEl = document.getElementById('detalhesStatus');
      if (statusEl) {
        statusEl.className = 'status-conversa ' + dados.statusClasse;
        statusEl.innerHTML = '<i class="' + dados.statusIcone + '"></i> ' + dados.status;
      }

      // Atualiza campos
      const modalidadeEl = document.getElementById('detalhesModalidade');
      if (modalidadeEl) modalidadeEl.textContent = dados.modalidade;

      const dataEl = document.getElementById('detalhesData');
      if (dataEl) dataEl.textContent = dados.data;

      const duracaoEl = document.getElementById('detalhesDuracao');
      if (duracaoEl) duracaoEl.textContent = dados.duracao;

      // Atualiza status na linha
      const statusLinhaEl = document.getElementById('detalhesStatusLinha');
      if (statusLinhaEl) {
        statusLinhaEl.className = 'detalhe-valor ' + dados.statusClasse;
        statusLinhaEl.innerHTML = '<i class="' + dados.statusIcone + '"></i> ' + dados.status;
      }

      // Atualiza última mensagem
      const mensagemEl = painel.querySelector('.detalhe-mensagem p');
      if (mensagemEl) mensagemEl.textContent = dados.ultimaMensagem;

      const mensagemHoraEl = painel.querySelector('.detalhe-mensagem-hora');
      if (mensagemHoraEl) mensagemHoraEl.textContent = dados.mensagemHora;

      // Atualiza resumo
      const resumoEl = painel.querySelector('.detalhe-resumo');
      if (resumoEl) resumoEl.textContent = dados.resumo;
    });
  });

  // Seleciona a primeira conversa por padrão para popular o painel de detalhes
  // (o primeiro card já nasce com .card-conversa-ativa via renderizarListaConversas)
  cards[0]?.dispatchEvent(new Event('click'));

  // Botão "Continuar conversa"
  const btnContinuar = document.getElementById('btnContinuarConversa');
  if (btnContinuar) {
    btnContinuar.addEventListener('click', () => {
      const cardAtiva = document.querySelector('.card-conversa-ativa');
      if (cardAtiva) {
        const id = Number(cardAtiva.dataset.conversa);
        const dados = CONVERSAS_HISTORICO.find((conversa) => conversa.id === id);
        if (dados && dados.modalidade.toLowerCase() === 'libras') {
          window.location.href = 'libras.html';
        } else if (dados && dados.modalidade.toLowerCase() === 'voz') {
          window.location.href = 'atendimento-voz.html';
        } else {
          window.location.href = 'atendimento-texto.html';
        }
      }
    });
  }

  // Botão "Excluir conversa"
  const btnExcluir = document.getElementById('btnExcluirConversa');
  if (btnExcluir) {
    btnExcluir.addEventListener('click', () => {
      mostrarToast({
        tipo: 'info',
        titulo: 'Em breve',
        mensagem: 'A exclusao de conversas ainda nao esta disponivel.'
      });
      return;

      const cardAtiva = document.querySelector('.card-conversa-ativa');
      if (cardAtiva) {
        if (confirm('Tem certeza que deseja excluir esta conversa?')) {
          cardAtiva.remove();
          // Seleciona a primeira conversa restante
          const proxima = document.querySelector('.card-conversa');
          if (proxima) {
            proxima.click();
          } else {
            const vazio = document.querySelector('.vazio-historico');
            if (vazio) vazio.style.display = 'block';
            const lista = document.getElementById('listaConversas');
            if (lista) lista.style.display = 'none';
          }
          mostrarToast({ tipo: 'sucesso', titulo: 'Conversa excluída', mensagem: 'A conversa foi removida do seu histórico.' });
        }
      }
    });
  }

  // Link "Ver resumo completo"
  const linkVerResumo = document.getElementById('linkVerResumo');
  if (linkVerResumo) {
    linkVerResumo.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarToast({ tipo: 'info', titulo: 'Resumo completo', mensagem: 'Resumo completo da conversa será exibido aqui.' });
    });
  }

  // Botão "Carregar mais conversas"
  const btnCarregarMais = document.getElementById('btnCarregarMais');
  if (btnCarregarMais) {
    btnCarregarMais.addEventListener('click', () => {
      mostrarToast({ tipo: 'info', titulo: 'Tudo em dia', mensagem: 'Não há mais conversas para carregar.' });
    });
  }
}

// perfil.html: estado "sujo" ao editar, troca de avatar, salvar/cancelar simulados

function inicializarPerfilLegado() {
  const formPerfil = document.getElementById("formPerfil");
  if (!formPerfil) return; // só executa dentro de perfil.html

  const btnSalvar = document.getElementById("btnSalvarPerfil");
  const btnCancelar = document.getElementById("btnCancelarPerfil");
  const statusPerfil = document.getElementById("statusPerfil");

  const nomeExibicao = document.getElementById("nomeExibicaoPerfil");
  const emailExibicao = document.getElementById("emailExibicaoPerfil");
  const campoNome = document.getElementById("perfilNome");
  const campoEmail = document.getElementById("perfilEmail");

  // Botões "Editar" que abrem o formulário de edição rápida
  const botoesEditar = document.querySelectorAll('.perfil-btn-editar[data-campo]');
  const contaInfo = document.querySelector('.perfil-conta-info');

  botoesEditar.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (formPerfil) {
        formPerfil.hidden = false;
        if (contaInfo) contaInfo.style.display = 'none';
        // Foca no campo correspondente
        const campo = btn.getAttribute('data-campo');
        if (campo === 'nome' && campoNome) campoNome.focus();
        else if (campo === 'email' && campoEmail) campoEmail.focus();
        else if (campo === 'telefone') {
          const tel = document.getElementById('perfilTelefone');
          if (tel) tel.focus();
        }
        atualizarEstadoSujo();
      }
    });
  });

  // Guarda os valores originais para permitir "Cancelar" e detectar o dirty state
  const valoresIniciais = new FormData(formPerfil);

  function formularioEstaSujo() {
    const atuais = new FormData(formPerfil);
    for (const [nome, valor] of atuais.entries()) {
      if (valoresIniciais.get(nome) !== valor) return true;
    }
    return false;
  }

  function atualizarEstadoSujo() {
    const sujo = formularioEstaSujo();
    btnSalvar.disabled = !sujo;
    if (sujo) {
      statusPerfil.textContent = "Você tem alterações não salvas.";
      statusPerfil.className = "status-perfil esta-sujo";
    } else {
      statusPerfil.textContent = "";
      statusPerfil.className = "status-perfil";
    }
  }

  formPerfil.addEventListener("input", atualizarEstadoSujo);
  formPerfil.addEventListener("change", atualizarEstadoSujo);

  // Cancelar — restaura os valores originais dos campos e oculta o formulário
  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      for (const [nome, valor] of valoresIniciais.entries()) {
        const campo = formPerfil.elements.namedItem(nome);
        if (!campo) continue;
        if (campo instanceof RadioNodeList) {
          campo.forEach((el) => { el.checked = el.value === valor; });
        } else if (campo.type === "checkbox") {
          campo.checked = valor === "on";
        } else {
          campo.value = valor;
        }
      }
      atualizarEstadoSujo();
      // Oculta o formulário de edição e mostra a visualização
      if (formPerfil) formPerfil.hidden = true;
      if (contaInfo) contaInfo.style.display = 'flex';
      if (nomeExibicao && campoNome) nomeExibicao.textContent = campoNome.value;
      if (emailExibicao && campoEmail) emailExibicao.textContent = campoEmail.value;
    });
  }

  // Salvar — simula chamada à API (dirty → salvando → sucesso/erro)
  formPerfil.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (btnSalvar.disabled) return;

    btnSalvar.disabled = true;
    btnCancelar.disabled = true;
    statusPerfil.textContent = "Salvando alterações...";
    statusPerfil.className = "status-perfil esta-salvando";

    // Simulação local — substituir por chamada real, ex.: PUT /api/usuario/perfil
    setTimeout(() => {
      btnCancelar.disabled = false;
      statusPerfil.textContent = "Alterações salvas com sucesso!";
      statusPerfil.className = "status-perfil esta-sucesso";

      if (nomeExibicao && campoNome) nomeExibicao.textContent = campoNome.value;
      if (emailExibicao && campoEmail) emailExibicao.textContent = campoEmail.value;

      // Atualiza os valores "originais" após salvar
      const novos = new FormData(formPerfil);
      for (const [nome, valor] of novos.entries()) {
        valoresIniciais.set(nome, valor);
      }

      // Oculta o formulário e atualiza a visualização
      if (nomeExibicao && campoNome) nomeExibicao.textContent = campoNome.value;
      if (emailExibicao && campoEmail) emailExibicao.textContent = campoEmail.value;
      if (formPerfil) formPerfil.hidden = true;
      if (contaInfo) contaInfo.style.display = 'flex';
    }, 1200);
  });

  // Alterar avatar — pré-visualização local (client-side apenas)
  const btnEditarAvatar = document.getElementById("btnEditarAvatarConta");
  const inputAvatar = document.getElementById("perfilAvatarInput");
  const iniciaisAvatar = document.getElementById("iniciaisAvatarConta");
  const fotoAvatar = document.getElementById("fotoAvatarConta");

  if (btnEditarAvatar && inputAvatar) {
    btnEditarAvatar.addEventListener("click", () => inputAvatar.click());

    inputAvatar.addEventListener("change", () => {
      const arquivo = inputAvatar.files && inputAvatar.files[0];
      if (!arquivo) return;

      const leitor = new FileReader();
      leitor.onload = (evento) => {
        fotoAvatar.src = evento.target.result;
        fotoAvatar.hidden = false;
        if (iniciaisAvatar) iniciaisAvatar.hidden = true;
      };
      leitor.readAsDataURL(arquivo);
    });
  }
}

// Perfil conectado ao backend: consulta e salva somente dados da própria conta.
function inicializarPerfil() {
  const formPerfil = document.getElementById("formPerfil");
  if (!formPerfil) return;

  const botaoSalvar = document.getElementById("btnSalvarPerfil");
  const botaoCancelar = document.getElementById("btnCancelarPerfil");
  const status = document.getElementById("statusPerfil");
  const contaInfo = document.querySelector(".perfil-conta-info");
  const campoNome = document.getElementById("perfilNome");
  const campoTelefone = document.getElementById("perfilTelefone");
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  let valoresIniciais = { nome: "", telefone: "" };

  const definirTexto = (id, valor) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  };

  function preencherPerfil(dados) {
    const telefone = dados.telefone || "";
    valoresIniciais = { nome: dados.nome || "", telefone };
    campoNome.value = valoresIniciais.nome;
    campoTelefone.value = telefone;
    document.getElementById("perfilEmail").value = dados.email || "";
    definirTexto("nomeExibicaoPerfil", dados.nome || "Não informado");
    definirTexto("emailExibicaoPerfil", dados.email || "Não informado");
    definirTexto("telefoneExibicaoPerfil", telefone || "Não informado");
    definirTexto("iniciaisAvatarConta", (dados.nome || "V").trim().slice(0, 1).toUpperCase());

    const explicacao = {
      iniciante: "Passo a passo, com explicações simples",
      intermediario: "Explicações claras, no seu ritmo",
      avancado: "Respostas diretas e mais objetivas"
    };
    definirTexto("perfilAtendimentoAtual", explicacao[dados.perfil] || "Atendimento personalizado");
    definirTexto(
      "perfilIldDescricao",
      "Seu atendimento é adaptado continuamente. Hoje, o Mimo usa uma comunicação " +
        (dados.perfil === "iniciante" ? "mais guiada." : dados.perfil === "avancado" ? "mais objetiva." : "clara e equilibrada.")
    );
  }

  function houveAlteracao() {
    return campoNome.value.trim() !== valoresIniciais.nome || campoTelefone.value.trim() !== valoresIniciais.telefone;
  }

  function atualizarEstado() {
    const alterado = houveAlteracao();
    botaoSalvar.disabled = !alterado;
    if (alterado) {
      status.textContent = "Você tem alterações não salvas.";
      status.className = "status-perfil esta-sujo";
    } else {
      status.textContent = "";
      status.className = "status-perfil";
    }
  }

  async function carregarPerfil() {
    if (!token) {
      status.textContent = "Entre na sua conta para ver seu perfil.";
      status.className = "status-perfil esta-erro";
      return;
    }
    try {
      const dados = await requisitarApi("/perfil", { headers: { Authorization: `Bearer ${token}` } });
      preencherPerfil(dados);
    } catch (erro) {
      status.textContent = mensagemErroAutenticacao(erro);
      status.className = "status-perfil esta-erro";
    }
  }

  document.querySelectorAll(".perfil-btn-editar[data-campo]").forEach((botao) => {
    botao.addEventListener("click", () => {
      formPerfil.hidden = false;
      contaInfo.style.display = "none";
      const campo = botao.dataset.campo === "telefone" ? campoTelefone : campoNome;
      campo.focus();
      atualizarEstado();
    });
  });

  formPerfil.addEventListener("input", atualizarEstado);
  botaoCancelar.addEventListener("click", () => {
    campoNome.value = valoresIniciais.nome;
    campoTelefone.value = valoresIniciais.telefone;
    formPerfil.hidden = true;
    contaInfo.style.display = "flex";
    atualizarEstado();
  });

  formPerfil.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!houveAlteracao()) return;

    botaoSalvar.disabled = true;
    botaoCancelar.disabled = true;
    status.textContent = "Salvando alterações...";
    status.className = "status-perfil esta-salvando";
    try {
      const dados = await requisitarApi("/perfil", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome: campoNome.value.trim(), telefone: campoTelefone.value.trim() || null })
      });
      preencherPerfil(dados);
      const usuario = JSON.parse(sessionStorage.getItem(CHAVE_USUARIO) || "{}");
      sessionStorage.setItem(CHAVE_USUARIO, JSON.stringify({ ...usuario, nome: dados.nome }));
      status.textContent = "Alterações salvas com sucesso!";
      status.className = "status-perfil esta-sucesso";
      formPerfil.hidden = true;
      contaInfo.style.display = "flex";
    } catch (erro) {
      status.textContent = mensagemErroAutenticacao(erro);
      status.className = "status-perfil esta-erro";
    } finally {
      botaoCancelar.disabled = false;
      atualizarEstado();
    }
  });

  carregarPerfil();
}

function inicializarSegurancaConta() {
  const formulario = document.getElementById('formAlterarSenhaPerfil');
  const lista = document.getElementById('listaDispositivosPerfil');
  if (!formulario || !lista) return;

  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  const novaSenha = document.getElementById('novaSenhaPerfil');
  const confirmarSenha = document.getElementById('confirmarNovaSenhaPerfil');
  const status = document.getElementById('statusAlterarSenha');
  const botaoOutros = document.getElementById('btnRevogarOutrosDispositivos');
  const botaoSairTodos = document.getElementById('perfilLogoutAll');

  const regras = {
    length: senha => senha.length >= 12,
    upper: senha => /[A-Z]/.test(senha),
    lower: senha => /[a-z]/.test(senha),
    number: senha => /\d/.test(senha),
    symbol: senha => /[^A-Za-z0-9]/.test(senha)
  };
  const todasRegrasValidas = senha => Object.values(regras).every(regra => regra(senha));
  const cabecalhos = () => ({ Authorization: `Bearer ${token}` });
  const sairLocalmente = mensagem => {
    mostrarToast({ tipo: 'sucesso', titulo: 'Segurança atualizada', mensagem });
    window.setTimeout(() => { limparSessaoLocal(); window.location.href = 'entrar.html'; }, 900);
  };

  function atualizarRegras() {
    const valor = novaSenha.value;
    Object.entries(regras).forEach(([nome, validar]) => {
      document.querySelector(`[data-password-rule="${nome}"]`)?.classList.toggle('esta-valida', validar(valor));
    });
  }

  document.querySelectorAll('[data-toggle-security-password]').forEach(botao => {
    botao.addEventListener('click', () => {
      const campo = botao.closest('.seguranca-campo-senha')?.querySelector('input');
      if (!campo) return;
      campo.type = campo.type === 'password' ? 'text' : 'password';
      botao.innerHTML = `<i class="fa-regular fa-eye${campo.type === 'password' ? '' : '-slash'}"></i>`;
      botao.setAttribute('aria-label', campo.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
    });
  });
  novaSenha.addEventListener('input', atualizarRegras);

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const senhaAtual = document.getElementById('senhaAtualPerfil').value;
    if (!todasRegrasValidas(novaSenha.value)) {
      status.textContent = 'A nova senha ainda não atende a todos os requisitos.';
      status.className = 'seguranca-form-status esta-erro';
      novaSenha.focus();
      return;
    }
    if (novaSenha.value !== confirmarSenha.value) {
      status.textContent = 'A confirmação não corresponde à nova senha.';
      status.className = 'seguranca-form-status esta-erro';
      confirmarSenha.focus();
      return;
    }
    const botao = document.getElementById('btnAlterarSenhaPerfil');
    definirCarregamentoBotao(botao, true);
    status.textContent = 'Verificando e alterando sua senha...';
    status.className = 'seguranca-form-status esta-salvando';
    try {
      const resultado = await requisitarApi('/auth/password/change', {
        method: 'POST', headers: cabecalhos(),
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha.value })
      });
      formulario.reset();
      atualizarRegras();
      sairLocalmente(resultado.mensagem);
    } catch (erro) {
      status.textContent = erro.message || 'Não foi possível alterar a senha.';
      status.className = 'seguranca-form-status esta-erro';
      definirCarregamentoBotao(botao, false);
    }
  });

  const formatarDataSessao = valor => {
    if (!valor) return 'Data indisponível';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
  };

  function renderizarDispositivos(sessoes) {
    if (!sessoes.length) {
      lista.innerHTML = '<div class="seguranca-dispositivo-vazio"><i class="fa-solid fa-laptop"></i><span>Nenhum dispositivo ativo encontrado.</span></div>';
      return;
    }
    lista.innerHTML = sessoes.map(sessao => {
      const icone = sessao.tipo_dispositivo === 'celular' ? 'fa-mobile-screen-button' : 'fa-laptop';
      return `<article class="seguranca-dispositivo ${sessao.atual ? 'esta-atual' : ''}">
        <span class="seguranca-dispositivo-icone"><i class="fa-solid ${icone}"></i></span>
        <div><div class="seguranca-dispositivo-nome"><strong>${escaparTextoHistorico(sessao.navegador)}</strong>${sessao.atual ? '<span>Este dispositivo</span>' : ''}</div><p>${escaparTextoHistorico(sessao.sistema)} · Último acesso ${formatarDataSessao(sessao.ultimo_acesso_em)}</p></div>
        <button type="button" class="botao botao-contorno botao-pequeno" data-revoke-session="${escaparTextoHistorico(sessao.id)}" data-current-session="${sessao.atual}">${sessao.atual ? 'Sair daqui' : 'Remover acesso'}</button>
      </article>`;
    }).join('');
  }

  async function carregarDispositivos() {
    if (!token) {
      lista.innerHTML = '<div class="seguranca-dispositivo-vazio"><i class="fa-solid fa-lock"></i><span>Faça login para ver seus dispositivos.</span></div>';
      formulario.querySelectorAll('input,button').forEach(item => item.disabled = true);
      botaoOutros.disabled = true;
      return;
    }
    try {
      const resultado = await requisitarApi('/auth/sessions', { headers: cabecalhos() });
      renderizarDispositivos(resultado.sessoes);
      botaoOutros.disabled = resultado.sessoes.filter(sessao => !sessao.atual).length === 0;
    } catch (erro) {
      lista.innerHTML = `<div class="seguranca-dispositivo-vazio"><i class="fa-solid fa-triangle-exclamation"></i><span>${escaparTextoHistorico(erro.message || 'Não foi possível carregar.')}</span></div>`;
    }
  }

  lista.addEventListener('click', async evento => {
    const botao = evento.target.closest('[data-revoke-session]');
    if (!botao) return;
    if (botao.dataset.confirmar !== '1') {
      botao.dataset.confirmar = '1';
      botao.textContent = 'Confirmar remoção';
      window.setTimeout(() => { if (botao.isConnected) { botao.dataset.confirmar = ''; botao.textContent = botao.dataset.currentSession === 'true' ? 'Sair daqui' : 'Remover acesso'; } }, 5000);
      return;
    }
    definirCarregamentoBotao(botao, true);
    try {
      const resultado = await requisitarApi(`/auth/sessions/${botao.dataset.revokeSession}`, { method: 'DELETE', headers: cabecalhos() });
      if (botao.dataset.currentSession === 'true') sairLocalmente(resultado.mensagem);
      else { mostrarToast({ tipo: 'sucesso', titulo: 'Acesso removido', mensagem: resultado.mensagem }); await carregarDispositivos(); }
    } catch (erro) {
      mostrarToast({ tipo: 'erro', titulo: 'Acesso não removido', mensagem: erro.message });
      definirCarregamentoBotao(botao, false);
    }
  });

  botaoOutros.addEventListener('click', async () => {
    if (botaoOutros.dataset.confirmar !== '1') {
      botaoOutros.dataset.confirmar = '1';
      botaoOutros.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar remoção';
      window.setTimeout(() => { botaoOutros.dataset.confirmar = ''; botaoOutros.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Remover outros'; }, 5000);
      return;
    }
    definirCarregamentoBotao(botaoOutros, true);
    try {
      const resultado = await requisitarApi('/auth/sessions/revoke-others', { method: 'POST', headers: cabecalhos() });
      mostrarToast({ tipo: 'sucesso', titulo: 'Outros acessos removidos', mensagem: resultado.mensagem });
      await carregarDispositivos();
    } catch (erro) {
      mostrarToast({ tipo: 'erro', titulo: 'Não foi possível remover', mensagem: erro.message });
    } finally {
      botaoOutros.dataset.confirmar = '';
      botaoOutros.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Remover outros';
      definirCarregamentoBotao(botaoOutros, false);
    }
  });

  botaoSairTodos?.addEventListener('click', async () => {
    if (botaoSairTodos.dataset.confirmar !== '1') {
      botaoSairTodos.dataset.confirmar = '1';
      botaoSairTodos.innerHTML = 'Confirmar saída <i class="fa-solid fa-check"></i>';
      window.setTimeout(() => { botaoSairTodos.dataset.confirmar = ''; botaoSairTodos.innerHTML = 'Sair da conta <i class="fa-solid fa-arrow-right-from-bracket"></i>'; }, 5000);
      return;
    }
    definirCarregamentoBotao(botaoSairTodos, true);
    try {
      const resultado = await requisitarApi('/privacidade/sessoes/revogar', { method: 'POST', headers: cabecalhos() });
      sairLocalmente(resultado.mensagem);
    } catch (erro) {
      mostrarToast({ tipo: 'erro', titulo: 'Não foi possível sair', mensagem: erro.message });
      definirCarregamentoBotao(botaoSairTodos, false);
    }
  });

  carregarDispositivos();
}

// permissoes.html: toggles, estados e botão restaurar padrões

function inicializarPermissoesLegado() {
  const secao = document.querySelector('.secao-permissoes');
  if (!secao) return; // só executa dentro de permissões.html

  const toggleDadosUso = document.getElementById('toggle-dados-uso');
  const toggleNotificacoes = document.getElementById('toggle-notificacoes');
  const estadoDadosUso = document.getElementById('estado-dados-uso');
  const estadoNotificacoes = document.getElementById('estado-notificacoes');
  const btnRestaurar = document.getElementById('btnRestaurarPadroes');

  // Atualiza o estado visual dos toggles
  function atualizarEstadoToggle(checkbox, estadoEl) {
    if (checkbox.checked) {
      estadoEl.className = 'permissao-estado permissao-estado-permitido';
      estadoEl.innerHTML = '<i class="fa-solid fa-check-circle"></i> Permitido';
    } else {
      estadoEl.className = 'permissao-estado permissao-estado-opcional';
      estadoEl.innerHTML = 'Opcional';
    }
  }

  // Lista de eventos para salvamento automático
  if (toggleDadosUso && estadoDadosUso) {
    toggleDadosUso.addEventListener('change', () => {
      atualizarEstadoToggle(toggleDadosUso, estadoDadosUso);
    });
    // Inicializa estado
    atualizarEstadoToggle(toggleDadosUso, estadoDadosUso);
  }

  if (toggleNotificacoes && estadoNotificacoes) {
    toggleNotificacoes.addEventListener('change', () => {
      atualizarEstadoToggle(toggleNotificacoes, estadoNotificacoes);
    });
    // Inicializa estado
    atualizarEstadoToggle(toggleNotificacoes, estadoNotificacoes);
  }

  // Restaurar padrões
  if (btnRestaurar) {
    btnRestaurar.addEventListener('click', () => {
      // Padrões: Dados de uso = desligado, Notificações = ligado
      if (toggleDadosUso) {
        toggleDadosUso.checked = false;
        atualizarEstadoToggle(toggleDadosUso, estadoDadosUso);
      }
      if (toggleNotificacoes) {
        toggleNotificacoes.checked = true;
        atualizarEstadoToggle(toggleNotificacoes, estadoNotificacoes);
      }

      // Feedback visual
      btnRestaurar.textContent = 'Padrões restaurados!';
      setTimeout(() => {
        btnRestaurar.innerHTML = '<i class="fa-solid fa-arrow-rotate-left"></i> Restaurar padrões';
      }, 1500);
    });
  }
}

// configuracoes.html: selects de idioma/tema/modo, toggles de confirmação e notificações

function inicializarPermissoes() {
  const secao = document.querySelector('.secao-permissoes');
  if (!secao) return;

  const permissoes = {
    personalizacao_atendimento: { toggle: document.getElementById('toggle-perfil'), estado: document.getElementById('estado-perfil'), padrao: true },
    salvar_historico: { toggle: document.getElementById('toggle-historico'), estado: document.getElementById('estado-historico'), padrao: true },
    usar_microfone: { toggle: document.getElementById('toggle-microfone'), estado: document.getElementById('estado-microfone'), padrao: false, dispositivo: 'microphone' },
    usar_camera: { toggle: document.getElementById('toggle-camera'), estado: document.getElementById('estado-camera'), padrao: false, dispositivo: 'camera' },
    dados_uso_anonimos: { toggle: document.getElementById('toggle-dados-uso'), estado: document.getElementById('estado-dados-uso'), padrao: false },
    notificacoes_app: { toggle: document.getElementById('toggle-notificacoes'), estado: document.getElementById('estado-notificacoes'), padrao: true, dispositivo: 'notifications' }
  };
  const btnRestaurar = document.getElementById('btnRestaurarPadroes');
  const status = document.getElementById('statusSalvamentoPermissoes');
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  const prefixoLocal = 'vivo-adaptai-permissao-';
  let valoresAtuais = {};
  let timerStatus = null;

  const informarStatus = (mensagem, tipo = 'neutro') => {
    if (!status) return;
    window.clearTimeout(timerStatus);
    status.dataset.estado = tipo;
    const icone = tipo === 'salvando' ? 'fa-spinner fa-spin' : tipo === 'erro' ? 'fa-triangle-exclamation' : 'fa-check';
    status.innerHTML = `<i class="fa-solid ${icone}" aria-hidden="true"></i> ${mensagem}`;
    if (tipo === 'sucesso') {
      timerStatus = window.setTimeout(() => {
        status.dataset.estado = 'neutro';
        status.innerHTML = '<i class="fa-solid fa-lock" aria-hidden="true"></i> Suas alterações são salvas automaticamente.';
      }, 3500);
    }
  };

  const salvarLocalmente = (chave, valor) => localStorage.setItem(`${prefixoLocal}${chave}`, String(valor));
  const lerLocais = () => Object.fromEntries(Object.entries(permissoes).map(([chave, item]) => {
    const salvo = localStorage.getItem(`${prefixoLocal}${chave}`);
    return [chave, salvo === null ? item.padrao : salvo === 'true'];
  }));

  const atualizarEstadoToggle = (item, textoAtivo = 'Permitido', textoInativo = 'Desativado') => {
    if (!item.toggle || !item.estado) return;
    if (item.toggle.checked) {
      item.estado.className = 'permissao-estado permissao-estado-permitido';
      item.estado.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${textoAtivo}`;
    } else {
      item.estado.className = 'permissao-estado permissao-estado-opcional';
      item.estado.textContent = textoInativo;
    }
  };

  const estadoNavegador = async (tipo) => {
    if (tipo === 'notifications') {
      if (!('Notification' in window)) return 'indisponivel';
      return Notification.permission;
    }
    if (!navigator.permissions?.query) return 'desconhecido';
    try {
      return (await navigator.permissions.query({ name: tipo })).state;
    } catch (_) {
      return 'desconhecido';
    }
  };

  const atualizarEstadoDispositivo = async (item) => {
    if (!item?.dispositivo || !item.toggle || !item.estado) return;
    if (!item.toggle.checked) {
      atualizarEstadoToggle(item);
      return;
    }
    const estado = await estadoNavegador(item.dispositivo);
    const rotulos = {
      granted: ['permissao-estado-permitido', '<i class="fa-solid fa-check-circle"></i> Permitido'],
      denied: ['permissao-estado-negado', '<i class="fa-solid fa-ban"></i> Bloqueado no navegador'],
      prompt: ['permissao-estado-pendente', '<i class="fa-solid fa-circle-question"></i> Aguardando autorização'],
      default: ['permissao-estado-pendente', '<i class="fa-solid fa-circle-info"></i> Ativo no AdaptAI'],
      indisponivel: ['permissao-estado-negado', '<i class="fa-solid fa-ban"></i> Indisponível']
    };
    const [classe, conteudo] = rotulos[estado] || rotulos.default;
    item.estado.className = `permissao-estado ${classe}`;
    item.estado.innerHTML = conteudo;
  };

  const aplicar = async (preferencias) => {
    valoresAtuais = { ...lerLocais(), ...preferencias };
    for (const [chave, item] of Object.entries(permissoes)) {
      if (!item.toggle) continue;
      item.toggle.checked = Boolean(valoresAtuais[chave]);
      salvarLocalmente(chave, item.toggle.checked);
      if (item.dispositivo) await atualizarEstadoDispositivo(item);
      else atualizarEstadoToggle(item);
    }
  };

  const solicitarDispositivo = async (tipo) => {
    if (tipo === 'notifications') {
      if (!('Notification' in window)) throw new Error('Este navegador não oferece notificações.');
      if (await Notification.requestPermission() !== 'granted') throw new Error('As notificações foram bloqueadas no navegador.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não oferece acesso a este recurso.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: tipo === 'microphone', video: tipo === 'camera' });
    stream.getTracks().forEach((track) => track.stop());
  };

  const persistir = async (chave, valor) => {
    valoresAtuais = { ...valoresAtuais, [chave]: valor };
    salvarLocalmente(chave, valor);
    if (!token) return valoresAtuais;
    return salvarPreferencia({ [chave]: valor });
  };

  Object.values(permissoes).forEach((item) => { if (item.toggle) item.toggle.disabled = true; });
  informarStatus('Carregando suas permissões...', 'salvando');
  const carregamento = token ? requisitarApi('/preferencias', { headers: obterCabecalhoAutorizado() }) : Promise.resolve(lerLocais());
  carregamento.then(async (preferencias) => {
    await aplicar(preferencias);
    informarStatus(token ? 'Permissões sincronizadas com sua conta.' : 'Permissões salvas neste dispositivo.', 'sucesso');
  }).catch(async () => {
    await aplicar(lerLocais());
    informarStatus('Usando as permissões deste dispositivo.', 'erro');
    mostrarToast({ tipo: 'aviso', titulo: 'Modo local', mensagem: 'Não foi possível sincronizar suas permissões agora.' });
  }).finally(() => Object.values(permissoes).forEach((item) => { if (item.toggle) item.toggle.disabled = false; }));

  Object.entries(permissoes).forEach(([chave, item]) => {
    if (!item.toggle) return;
    item.toggle.addEventListener('change', async () => {
      const anterior = Boolean(valoresAtuais[chave]);
      const novoValor = item.toggle.checked;
      item.toggle.disabled = true;
      informarStatus(novoValor && item.dispositivo ? 'Aguardando autorização do navegador...' : 'Salvando alteração...', 'salvando');
      try {
        if (novoValor && item.dispositivo) await solicitarDispositivo(item.dispositivo);
        await persistir(chave, novoValor);
        if (item.dispositivo) await atualizarEstadoDispositivo(item);
        else atualizarEstadoToggle(item);
        informarStatus(token ? 'Alteração salva na sua conta.' : 'Alteração salva neste dispositivo.', 'sucesso');
      } catch (erro) {
        item.toggle.checked = anterior;
        salvarLocalmente(chave, anterior);
        valoresAtuais = { ...valoresAtuais, [chave]: anterior };
        if (item.dispositivo) await atualizarEstadoDispositivo(item);
        else atualizarEstadoToggle(item);
        informarStatus('A alteração não foi concluída.', 'erro');
        mostrarToast({ tipo: 'aviso', titulo: 'Permissão não concedida', mensagem: erro.message || 'Revise as configurações do navegador e tente novamente.' });
      } finally {
        item.toggle.disabled = false;
      }
    });
  });

  const abrirDialogo = (dialogo) => {
    if (!dialogo) return;
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', '');
  };
  const fecharDialogo = (dialogo) => {
    if (!dialogo) return;
    if (typeof dialogo.close === 'function') dialogo.close();
    else dialogo.removeAttribute('open');
  };
  const modalEntenda = document.getElementById('modalEntendaPermissoes');
  const modalPrivacidade = document.getElementById('modalPoliticaPrivacidade');
  document.getElementById('btnEntendaCadaPermissao')?.addEventListener('click', () => abrirDialogo(modalEntenda));
  document.getElementById('btnPoliticaPrivacidade')?.addEventListener('click', () => abrirDialogo(modalPrivacidade));
  document.querySelectorAll('.modal-permissoes [data-fechar-dialogo]').forEach((botao) => {
    botao.addEventListener('click', () => fecharDialogo(botao.closest('dialog')));
  });
  document.querySelectorAll('.modal-permissoes').forEach((dialogo) => {
    dialogo.addEventListener('click', (evento) => { if (evento.target === dialogo) fecharDialogo(dialogo); });
  });

  btnRestaurar?.addEventListener('click', async () => {
    btnRestaurar.disabled = true;
    informarStatus('Restaurando os padrões...', 'salvando');
    const padroes = Object.fromEntries(Object.entries(permissoes).map(([chave, item]) => [chave, item.padrao]));
    try {
      for (const [chave, valor] of Object.entries(padroes)) salvarLocalmente(chave, valor);
      if (token) await salvarPreferencia(padroes);
      await aplicar(padroes);
      informarStatus('Permissões padrão restauradas.', 'sucesso');
    } catch (erro) {
      informarStatus('Não foi possível restaurar os padrões.', 'erro');
      mostrarToast({ tipo: 'erro', titulo: 'Falha ao restaurar', mensagem: mensagemErroAutenticacao(erro) });
    } finally {
      btnRestaurar.disabled = false;
    }
  });
}

function inicializarConfiguracoesLegado() {
  const secao = document.querySelector('.secao-configuracoes');
  if (!secao) return; // só executa dentro de configuracoes.html

  // Referências dos elementos
  const selectIdioma = document.getElementById('selectIdioma');
  const selectTema = document.getElementById('selectTema');
  const selectModoAtendimento = document.getElementById('modoAtendimentoSelect');

  const toggleConfirmarEncerramento = document.getElementById('confirmarEncerramentoToggle');
  const estadoConfirmarEncerramento = document.getElementById('estadoConfirmarEncerramento');

  const toggleNotifResumo = document.getElementById('notifResumoToggle');
  const estadoNotifResumo = document.getElementById('estadoNotifResumo');

  const toggleNotifNovidades = document.getElementById('notifNovidadesToggle');
  const estadoNotifNovidades = document.getElementById('estadoNotifNovidades');

  // Chaves de localStorage para persistência
  const CHAVE_IDIOMA = 'vivo-adaptai-idioma';
  const CHAVE_TEMA = 'vivo-adaptai-tema'; // já usado pelo sistema de tema
  const CHAVE_MODO_ATENDIMENTO = 'vivo-adaptai-modo-atendimento';
  const CHAVE_CONFIRMAR_ENCERRAMENTO = 'vivo-adaptai-confirmar-encerramento';
  const CHAVE_NOTIF_RESUMO = 'vivo-adaptai-notif-resumo';
  const CHAVE_NOTIF_NOVIDADES = 'vivo-adaptai-notif-novidades';

  // Inicializa valores salvos
  function carregarValoresSalvos() {
    // Idioma
    if (selectIdioma) {
      const idiomaSalvo = localStorage.getItem(CHAVE_IDIOMA) || 'pt-br';
      selectIdioma.value = idiomaSalvo;
    }
    // Tema - sincroniza com o sistema de tema existente
    if (selectTema) {
      selectTema.value = temaAtual();
    }
    // Modo de atendimento
    if (selectModoAtendimento) {
      const modoSalvo = localStorage.getItem(CHAVE_MODO_ATENDIMENTO) || 'texto';
      selectModoAtendimento.value = modoSalvo;
    }
    // Toggles
    if (toggleConfirmarEncerramento) {
      const salvo = localStorage.getItem(CHAVE_CONFIRMAR_ENCERRAMENTO);
      toggleConfirmarEncerramento.checked = salvo !== 'false'; // default true
      atualizarEstadoToggleConfirmar();
    }
    if (toggleNotifResumo) {
      const salvo = localStorage.getItem(CHAVE_NOTIF_RESUMO);
      toggleNotifResumo.checked = salvo !== 'false'; // default true
      atualizarEstadoNotifResumo();
    }
    if (toggleNotifNovidades) {
      const salvo = localStorage.getItem(CHAVE_NOTIF_NOVIDADES);
      toggleNotifNovidades.checked = salvo === 'true'; // default false
      atualizarEstadoNotifNovidades();
    }
  }

  // Atualiza estado visual do toggle "Confirmar antes de encerrar"
  function atualizarEstadoToggleConfirmar() {
    if (!toggleConfirmarEncerramento || !estadoConfirmarEncerramento) return;
    if (toggleConfirmarEncerramento.checked) {
      estadoConfirmarEncerramento.className = 'configuracao-estado configuracao-estado-ativo';
      estadoConfirmarEncerramento.innerHTML = '<i class="fa-solid fa-check-circle"></i> Ativado';
    } else {
      estadoConfirmarEncerramento.className = 'configuracao-estado configuracao-estado-inativo';
      estadoConfirmarEncerramento.innerHTML = 'Desativado';
    }
  }

  // Atualiza estado visual do toggle "Resumo por e-mail"
  function atualizarEstadoNotifResumo() {
    if (!toggleNotifResumo || !estadoNotifResumo) return;
    if (toggleNotifResumo.checked) {
      estadoNotifResumo.className = 'configuracao-estado configuracao-estado-ativo';
      estadoNotifResumo.innerHTML = '<i class="fa-solid fa-check-circle"></i> Ativado';
    } else {
      estadoNotifResumo.className = 'configuracao-estado configuracao-estado-inativo';
      estadoNotifResumo.innerHTML = 'Desativado';
    }
  }

  // Atualiza estado visual do toggle "Novidades"
  function atualizarEstadoNotifNovidades() {
    if (!toggleNotifNovidades || !estadoNotifNovidades) return;
    if (toggleNotifNovidades.checked) {
      estadoNotifNovidades.className = 'configuracao-estado configuracao-estado-ativo';
      estadoNotifNovidades.innerHTML = '<i class="fa-solid fa-check-circle"></i> Ativado';
    } else {
      estadoNotifNovidades.className = 'configuracao-estado configuracao-estado-inativo';
      estadoNotifNovidades.innerHTML = 'Desativado';
    }
  }

  // Salva no localStorage e mostra toast de confirmação
  function salvarEConfirmar(chave, valor, mensagemSucesso) {
    localStorage.setItem(chave, valor);
    mostrarToast({
      tipo: 'sucesso',
      titulo: 'Salvo',
      mensagem: mensagemSucesso,
      duracao: 3000
    });
  }

  // Event listeners para selects
  if (selectIdioma) {
    selectIdioma.addEventListener('change', () => {
      salvarEConfirmar(CHAVE_IDIOMA, selectIdioma.value, `Idioma alterado para ${selectIdioma.options[selectIdioma.selectedIndex].text}.`);
    });
  }

  if (selectTema) {
    // O sistema de tema já lida com a mudança via inicializarSelectTema()
    // Apenas sincronizamos o valor ao carregar
    selectTema.addEventListener('change', () => {
      // Aplica o tema via função existente
      aplicarTema(selectTema.value);
    });
  }

  if (selectModoAtendimento) {
    selectModoAtendimento.addEventListener('change', () => {
      const textoOpcao = selectModoAtendimento.options[selectModoAtendimento.selectedIndex].text;
      salvarEConfirmar(CHAVE_MODO_ATENDIMENTO, selectModoAtendimento.value, `Modo de atendimento padrão alterado para ${textoOpcao}.`);
    });
  }

  // Event listeners para toggles
  if (toggleConfirmarEncerramento) {
    toggleConfirmarEncerramento.addEventListener('change', () => {
      atualizarEstadoToggleConfirmar();
      salvarEConfirmar(
        CHAVE_CONFIRMAR_ENCERRAMENTO,
        String(toggleConfirmarEncerramento.checked),
        toggleConfirmarEncerramento.checked
          ? 'Confirmação antes de encerrar ativada.'
          : 'Confirmação antes de encerrar desativada.'
      );
    });
  }

  if (toggleNotifResumo) {
    toggleNotifResumo.addEventListener('change', () => {
      atualizarEstadoNotifResumo();
      salvarEConfirmar(
        CHAVE_NOTIF_RESUMO,
        String(toggleNotifResumo.checked),
        toggleNotifResumo.checked
          ? 'Resumo do atendimento por e-mail ativado.'
          : 'Resumo do atendimento por e-mail desativado.'
      );
    });
  }

  if (toggleNotifNovidades) {
    toggleNotifNovidades.addEventListener('change', () => {
      atualizarEstadoNotifNovidades();
      salvarEConfirmar(
        CHAVE_NOTIF_NOVIDADES,
        String(toggleNotifNovidades.checked),
        toggleNotifNovidades.checked
          ? 'Notificações de novidades ativadas.'
          : 'Notificações de novidades desativadas.'
      );
    });
  }

  // Carrega valores ao inicializar
  carregarValoresSalvos();
}

// Preferências reais: são associadas à conta para acompanhar a pessoa em
// qualquer dispositivo. O armazenamento local continua somente como apoio
// visual imediato para o tema.
function obterCabecalhoAutorizado() {
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let filaSalvamentoPreferencias = Promise.resolve();

async function salvarPreferencia(alteracao) {
  const operacao = filaSalvamentoPreferencias.then(() => requisitarApi('/preferencias', {
    method: 'PATCH',
    headers: obterCabecalhoAutorizado(),
    body: JSON.stringify(alteracao)
  }));
  filaSalvamentoPreferencias = operacao.catch(() => {});
  return operacao;
}

const CHAVES_PREFERENCIAS_LOCAIS = {
  idioma: 'vivo-adaptai-idioma',
  tema: 'vivo-adaptai-tema',
  modo_atendimento: 'vivo-adaptai-modo-atendimento',
  confirmar_encerramento: 'vivo-adaptai-confirmar-encerramento',
  notificacoes_resumo: 'vivo-adaptai-notif-resumo',
  notificacoes_novidades: 'vivo-adaptai-notif-novidades',
  tamanho_texto: 'vivo-adaptai-acessibilidade-tamanho-texto',
  alto_contraste: 'vivo-adaptai-acessibilidade-alto-contraste',
  paleta_cores: 'vivo-adaptai-acessibilidade-paleta-cores',
  espacamento_ampliado: 'vivo-adaptai-acessibilidade-espacamento',
  leitura_voz_alta: 'vivo-adaptai-acessibilidade-audio',
  libras: 'vivo-adaptai-acessibilidade-libras',
  comandos_voz: 'vivo-adaptai-acessibilidade-comandos-voz',
  personalizacao_atendimento: 'vivo-adaptai-permissao-personalizacao_atendimento',
  salvar_historico: 'vivo-adaptai-permissao-salvar_historico',
  usar_microfone: 'vivo-adaptai-permissao-usar_microfone',
  usar_camera: 'vivo-adaptai-permissao-usar_camera',
  dados_uso_anonimos: 'vivo-adaptai-permissao-dados_uso_anonimos',
  notificacoes_app: 'vivo-adaptai-permissao-notificacoes_app'
};

const PADROES_PREFERENCIAS_GERAIS = {
  idioma: 'pt-br',
  tema: 'claro',
  modo_atendimento: 'texto',
  confirmar_encerramento: true,
  notificacoes_resumo: true,
  notificacoes_novidades: false,
  tamanho_texto: 2,
  alto_contraste: false,
  paleta_cores: 'padrao',
  espacamento_ampliado: false,
  leitura_voz_alta: true,
  libras: false,
  comandos_voz: false,
  personalizacao_atendimento: true,
  salvar_historico: true,
  usar_microfone: false,
  usar_camera: false,
  dados_uso_anonimos: false,
  notificacoes_app: true
};

function persistirPreferenciasLocais(preferencias) {
  Object.entries(CHAVES_PREFERENCIAS_LOCAIS).forEach(([chave, chaveLocal]) => {
    if (preferencias[chave] !== undefined) localStorage.setItem(chaveLocal, String(preferencias[chave]));
  });
}

function lerPreferenciasLocais() {
  const preferencias = { ...PADROES_PREFERENCIAS_GERAIS };
  Object.entries(CHAVES_PREFERENCIAS_LOCAIS).forEach(([chave, chaveLocal]) => {
    const valor = localStorage.getItem(chaveLocal);
    if (valor === null) return;
    if (typeof PADROES_PREFERENCIAS_GERAIS[chave] === 'boolean') preferencias[chave] = valor === 'true';
    else if (typeof PADROES_PREFERENCIAS_GERAIS[chave] === 'number') preferencias[chave] = Number(valor);
    else preferencias[chave] = valor;
  });
  return preferencias;
}

function obterDestinoModoAtendimentoPadrao() {
  const modo = localStorage.getItem(CHAVES_PREFERENCIAS_LOCAIS.modo_atendimento) || 'texto';
  return {
    texto: 'atendimento-texto.html',
    voz: 'atendimento-voz.html',
    hibrido: 'atendimento-hibrido.html',
    'texto-simplificado': 'texto-simplificado.html',
    libras: 'libras.html',
    perguntar: 'perguntar'
  }[modo] || 'atendimento-texto.html';
}

function inicializarModoAtendimentoPadrao() {
  document.querySelectorAll('app-sidebar a[href="atendimento-texto.html"]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      const destino = obterDestinoModoAtendimentoPadrao();
      if (destino === 'atendimento-texto.html') return;
      evento.preventDefault();
      if (destino === 'perguntar') abrirSeletorModalidade('texto');
      else window.location.href = destino;
    });
  });
}

function exibirEstadoConfiguracao(toggle, estado, ativo) {
  if (!toggle || !estado) return;
  estado.className = ativo ? 'configuracao-estado configuracao-estado-ativo' : 'configuracao-estado configuracao-estado-inativo';
  estado.innerHTML = ativo ? '<i class="fa-solid fa-check-circle"></i> Ativado' : 'Desativado';
}

function inicializarConfiguracoes() {
  const secao = document.querySelector('.secao-configuracoes');
  if (!secao) return;
  const campos = {
    idioma: document.getElementById('selectIdioma'),
    tema: document.getElementById('selectTema'),
    modo_atendimento: document.getElementById('modoAtendimentoSelect'),
    confirmar_encerramento: document.getElementById('confirmarEncerramentoToggle'),
    notificacoes_resumo: document.getElementById('notifResumoToggle'),
    notificacoes_novidades: document.getElementById('notifNovidadesToggle')
  };
  const estados = {
    confirmar_encerramento: document.getElementById('estadoConfirmarEncerramento'),
    notificacoes_resumo: document.getElementById('estadoNotifResumo'),
    notificacoes_novidades: document.getElementById('estadoNotifNovidades')
  };
  const statusSalvamento = document.getElementById('statusSalvamentoConfiguracoes');
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  let preferenciasAtuais = lerPreferenciasLocais();
  let timerStatus = null;

  const informarStatus = (mensagem, tipo = 'neutro') => {
    if (!statusSalvamento) return;
    window.clearTimeout(timerStatus);
    statusSalvamento.dataset.estado = tipo;
    const icone = tipo === 'salvando' ? 'fa-spinner fa-spin' : tipo === 'erro' ? 'fa-triangle-exclamation' : 'fa-check';
    statusSalvamento.innerHTML = `<i class="fa-solid ${icone}" aria-hidden="true"></i> ${mensagem}`;
    if (tipo === 'sucesso') {
      timerStatus = window.setTimeout(() => {
        statusSalvamento.dataset.estado = 'neutro';
        statusSalvamento.innerHTML = '<i class="fa-solid fa-lock" aria-hidden="true"></i> Suas alterações são salvas automaticamente.';
      }, 3500);
    }
  };

  const aplicar = (preferencias) => {
    const normalizadas = { ...PADROES_PREFERENCIAS_GERAIS, ...preferencias };
    if (normalizadas.idioma === 'en') normalizadas.idioma = 'pt-br';
    Object.entries(campos).forEach(([chave, campo]) => {
      if (!campo || normalizadas[chave] === undefined) return;
      if (campo.type === 'checkbox') campo.checked = Boolean(normalizadas[chave]);
      else campo.value = normalizadas[chave];
    });
    aplicarTema(normalizadas.tema);
    Object.entries(estados).forEach(([chave, estado]) => exibirEstadoConfiguracao(campos[chave], estado, campos[chave]?.checked));
    preferenciasAtuais = normalizadas;
    persistirPreferenciasLocais(normalizadas);
  };

  Object.values(campos).forEach((campo) => { if (campo) campo.disabled = true; });
  informarStatus('Carregando suas preferências...', 'salvando');
  const carregamento = token
    ? requisitarApi('/preferencias', { headers: obterCabecalhoAutorizado() })
    : Promise.resolve(lerPreferenciasLocais());
  carregamento
    .then((preferencias) => {
      aplicar(preferencias);
      informarStatus(token ? 'Preferências sincronizadas com sua conta.' : 'Preferências salvas neste dispositivo.', 'sucesso');
    })
    .catch(() => {
      aplicar(lerPreferenciasLocais());
      informarStatus('Usando as preferências deste dispositivo.', 'erro');
      mostrarToast({ tipo: 'aviso', titulo: 'Modo local', mensagem: 'Não foi possível sincronizar com sua conta agora.' });
    })
    .finally(() => Object.values(campos).forEach((campo) => { if (campo) campo.disabled = false; }));

  Object.entries(campos).forEach(([chave, campo]) => {
    if (!campo) return;
    campo.addEventListener('change', async () => {
      const valor = campo.type === 'checkbox' ? campo.checked : campo.value;
      const valorAnterior = preferenciasAtuais[chave];
      preferenciasAtuais = { ...preferenciasAtuais, [chave]: valor };
      persistirPreferenciasLocais(preferenciasAtuais);
      if (chave === 'tema') aplicarTema(valor);
      exibirEstadoConfiguracao(campo, estados[chave], valor);
      informarStatus(token ? 'Salvando alteração...' : 'Salvando neste dispositivo...', 'salvando');
      campo.disabled = true;

      if (!token) {
        campo.disabled = false;
        informarStatus('Preferência salva neste dispositivo.', 'sucesso');
        return;
      }
      try {
        const salvas = await salvarPreferencia({ [chave]: valor });
        preferenciasAtuais = { ...preferenciasAtuais, [chave]: salvas[chave] };
        persistirPreferenciasLocais(preferenciasAtuais);
        informarStatus('Alteração salva na sua conta.', 'sucesso');
      } catch (erro) {
        preferenciasAtuais = { ...preferenciasAtuais, [chave]: valorAnterior };
        persistirPreferenciasLocais(preferenciasAtuais);
        if (campo.type === 'checkbox') campo.checked = Boolean(valorAnterior);
        else campo.value = valorAnterior;
        if (chave === 'tema') aplicarTema(valorAnterior);
        exibirEstadoConfiguracao(campo, estados[chave], valorAnterior);
        informarStatus('A alteração não foi salva.', 'erro');
        mostrarToast({ tipo: 'erro', titulo: 'Não foi possível salvar', mensagem: mensagemErroAutenticacao(erro) });
      } finally {
        campo.disabled = false;
      }
    });
  });
}

function aplicarAcessibilidade(preferencias) {
  const raiz = document.documentElement;
  if (preferencias.tamanho_texto !== undefined) {
    const tamanho = Math.min(3, Math.max(1, Number(preferencias.tamanho_texto) || 2));
    raiz.dataset.tamanhoTexto = String(tamanho);
  }
  if (preferencias.alto_contraste !== undefined) raiz.dataset.altoContraste = String(Boolean(preferencias.alto_contraste));
  if (preferencias.paleta_cores !== undefined) {
    const paletas = ['padrao', 'protanopia', 'deuteranopia', 'tritanopia', 'monocromatica'];
    raiz.dataset.paletaCores = paletas.includes(preferencias.paleta_cores) ? preferencias.paleta_cores : 'padrao';
  }
  if (preferencias.espacamento_ampliado !== undefined) raiz.dataset.espacamentoAmpliado = String(Boolean(preferencias.espacamento_ampliado));
}

function obterPreferenciasAcessibilidade() {
  const locais = lerPreferenciasLocais();
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  if (!token) return Promise.resolve(locais);
  return requisitarApi('/preferencias', { headers: obterCabecalhoAutorizado() })
    .then((remotas) => ({ ...locais, ...remotas }))
    .catch(() => locais);
}

function atualizarRotuloTamanhoTexto(valor) {
  const rotulo = document.getElementById('labelTamanhoTexto');
  if (rotulo) rotulo.textContent = ({ 1: 'Menor', 2: 'Normal', 3: 'Maior' })[Number(valor)] || 'Normal';
}

function informarStatusAcessibilidade(mensagem, estado = 'sucesso') {
  const status = document.getElementById('statusAcessibilidade');
  if (!status) return;
  status.dataset.estado = estado;
  const icone = estado === 'salvando' ? 'fa-spinner fa-spin' : estado === 'aviso' ? 'fa-triangle-exclamation' : 'fa-circle-check';
  status.innerHTML = `<i class="fa-solid ${icone}" aria-hidden="true"></i> ${mensagem}`;
}

function inicializarAcessibilidade() {
  if (document.body.dataset.page !== 'acessibilidade') return;
  const campos = {
    tamanho_texto: document.getElementById('rangeTexto'),
    alto_contraste: document.getElementById('checkContraste'),
    paleta_cores: document.getElementById('selectPaletaCores'),
    espacamento_ampliado: document.getElementById('checkEspacamento'),
    leitura_voz_alta: document.getElementById('checkAudio'),
    libras: document.getElementById('checkLibras'),
    comandos_voz: document.getElementById('checkComandosVoz')
  };
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  let preferenciasAtuais = lerPreferenciasLocais();

  const preencherCampos = (preferencias) => {
    preferenciasAtuais = { ...PADROES_PREFERENCIAS_GERAIS, ...preferencias };
    Object.entries(campos).forEach(([chave, campo]) => {
      if (!campo || preferenciasAtuais[chave] === undefined) return;
      if (campo.type === 'range' || campo.tagName === 'SELECT') campo.value = preferenciasAtuais[chave];
      else campo.checked = Boolean(preferenciasAtuais[chave]);
    });
    atualizarRotuloTamanhoTexto(preferenciasAtuais.tamanho_texto);
    aplicarAcessibilidade(preferenciasAtuais);
  };

  preencherCampos(preferenciasAtuais);
  informarStatusAcessibilidade('Carregando suas preferências...', 'salvando');
  obterPreferenciasAcessibilidade().then((preferencias) => {
    persistirPreferenciasLocais(preferencias);
    preencherCampos(preferencias);
    informarStatusAcessibilidade(token ? 'Preferências sincronizadas com sua conta.' : 'Preferências salvas neste dispositivo.');
  });

  campos.tamanho_texto?.addEventListener('input', () => {
    atualizarRotuloTamanhoTexto(campos.tamanho_texto.value);
    aplicarAcessibilidade({ tamanho_texto: Number(campos.tamanho_texto.value) });
  });

  Object.entries(campos).forEach(([chave, campo]) => {
    if (!campo) return;
    campo.addEventListener('change', async () => {
      const valor = campo.type === 'range' ? Number(campo.value) : campo.tagName === 'SELECT' ? campo.value : campo.checked;
      preferenciasAtuais = { ...preferenciasAtuais, [chave]: valor };
      persistirPreferenciasLocais(preferenciasAtuais);
      aplicarAcessibilidade(preferenciasAtuais);
      atualizarRotuloTamanhoTexto(preferenciasAtuais.tamanho_texto);
      renderizarRecursosAcessiveis(preferenciasAtuais);
      if (chave === 'libras') valor ? ativarTradutorLibras() : desativarTradutorLibras();
      informarStatusAcessibilidade(token ? 'Salvando na sua conta...' : 'Preferência aplicada neste dispositivo.', token ? 'salvando' : 'sucesso');

      if (!token) return;
      try {
        await salvarPreferencia({ [chave]: valor });
        informarStatusAcessibilidade('Preferência salva na sua conta.');
      }
      catch (_) {
        informarStatusAcessibilidade('Aplicada neste dispositivo; a sincronização será tentada novamente.', 'aviso');
      }
    });
  });
}

let leitorDePaginaAtivo = false;

function textoParaLeitura() {
  const conteudo = document.querySelector('main, .conteudo-principal-app, .pagina-chat') || document.body;
  const copia = conteudo.cloneNode(true);
  copia.querySelectorAll('button, input, select, textarea, nav, .recursos-acessiveis').forEach((elemento) => elemento.remove());
  return copia.innerText.replace(/\s+/g, ' ').trim().slice(0, 6000);
}

function pararLeituraDaPagina() {
  window.speechSynthesis?.cancel();
  leitorDePaginaAtivo = false;
  const botao = document.getElementById('btnLerPagina');
  if (botao) {
    botao.innerHTML = '<i class="fa-solid fa-volume-high"></i><span>Ouvir página</span>';
    botao.setAttribute('aria-pressed', 'false');
  }
}

function lerPaginaEmVozAlta() {
  if (!('speechSynthesis' in window)) {
    mostrarToast({ tipo: 'aviso', titulo: 'Leitura não disponível', mensagem: 'Este navegador não oferece leitura em voz alta.' });
    return;
  }
  if (leitorDePaginaAtivo) { pararLeituraDaPagina(); return; }
  const texto = textoParaLeitura();
  if (!texto) return;
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = 'pt-BR';
  fala.rate = 0.95;
  fala.onend = pararLeituraDaPagina;
  fala.onerror = pararLeituraDaPagina;
  leitorDePaginaAtivo = true;
  const botao = document.getElementById('btnLerPagina');
  if (botao) {
    botao.innerHTML = '<i class="fa-solid fa-stop"></i><span>Parar leitura</span>';
    botao.setAttribute('aria-pressed', 'true');
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(fala);
}

function ativarTradutorLibras() {
  const widgetExistente = document.getElementById('vlibras-plugin');
  if (widgetExistente) return;
  const estrutura = document.createElement('div');
  estrutura.id = 'vlibras-plugin';
  estrutura.innerHTML = '<div vw class="enabled"><div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div></div>';
  document.body.appendChild(estrutura);
  const script = document.createElement('script');
  script.id = 'vlibras-script';
  script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
  script.async = true;
  script.onload = () => {
    try { new window.VLibras.Widget('https://vlibras.gov.br/app'); }
    catch (_) { estrutura.remove(); }
  };
  script.onerror = () => estrutura.remove();
  document.body.appendChild(script);
}

function desativarTradutorLibras() {
  document.getElementById('vlibras-plugin')?.remove();
  document.getElementById('vlibras-script')?.remove();
  document.querySelectorAll('[vw], [vw-access-button], [vw-plugin-wrapper]').forEach((elemento) => elemento.remove());
}

function executarComandoDeVoz(comando) {
  const texto = comando.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (texto.includes('parar') || texto.includes('cancelar leitura')) { pararLeituraDaPagina(); return; }
  if (texto.includes('ler') || texto.includes('ouvir pagina')) { lerPaginaEmVozAlta(); return; }
  const destinos = [
    ['inicio', 'home.html'], ['pagina inicial', 'home.html'], ['atendimento', 'atendimento-texto.html'],
    ['conversar', 'atendimento-texto.html'], ['acessibilidade', 'acessibilidade.html'],
    ['configuracoes', 'configuracoes.html'], ['libras', 'libras.html'], ['historico', 'historico.html']
  ];
  const encontrado = destinos.find(([palavra]) => texto.includes(palavra));
  if (encontrado) { window.location.href = encontrado[1]; return; }
  mostrarToast({ tipo: 'info', titulo: 'Comando não reconhecido', mensagem: 'Tente dizer: início, atendimento, Libras, ler página ou parar leitura.' });
}

function iniciarComandosDeVoz() {
  if (!usoMicrofonePermitido()) {
    mostrarToast({ tipo: 'info', titulo: 'Microfone desativado', mensagem: 'Ative o microfone na página de Permissões para usar comandos de voz.' });
    return;
  }
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconhecimento) {
    mostrarToast({ tipo: 'aviso', titulo: 'Comandos de voz indisponíveis', mensagem: 'Use Chrome ou Edge para utilizar este recurso.' });
    return;
  }
  const reconhecimento = new Reconhecimento();
  reconhecimento.lang = 'pt-BR';
  reconhecimento.interimResults = false;
  reconhecimento.maxAlternatives = 1;
  reconhecimento.onresult = (evento) => executarComandoDeVoz(evento.results[0][0].transcript);
  reconhecimento.onerror = () => mostrarToast({ tipo: 'aviso', titulo: 'Não foi possível ouvir', mensagem: 'Verifique a permissão do microfone e tente novamente.' });
  reconhecimento.start();
}

function renderizarRecursosAcessiveis(preferencias) {
  document.querySelector('.recursos-acessiveis')?.remove();
  pararLeituraDaPagina();
  if (!preferencias.leitura_voz_alta && !preferencias.comandos_voz) return;
  const painel = document.createElement('div');
  painel.className = 'recursos-acessiveis';
  painel.setAttribute('role', 'group');
  painel.setAttribute('aria-label', 'Recursos de acessibilidade');
  if (preferencias.leitura_voz_alta) {
    painel.innerHTML += '<button type="button" class="botao-recurso-acessivel" id="btnLerPagina" aria-pressed="false"><i class="fa-solid fa-volume-high" aria-hidden="true"></i><span>Ouvir página</span></button>';
  }
  if (preferencias.comandos_voz) {
    painel.innerHTML += '<button type="button" class="botao-recurso-acessivel" id="btnComandoVoz"><i class="fa-solid fa-microphone" aria-hidden="true"></i><span>Comando de voz</span></button>';
  }
  document.body.appendChild(painel);
  document.getElementById('btnLerPagina')?.addEventListener('click', lerPaginaEmVozAlta);
  document.getElementById('btnComandoVoz')?.addEventListener('click', iniciarComandosDeVoz);
}

function inicializarRecursosAcessiveis() {
  if (!document.body.dataset.page) return;
  obterPreferenciasAcessibilidade().then((preferencias) => {
    persistirPreferenciasLocais(preferencias);
    aplicarTema(preferencias.tema || temaAtual());
    aplicarAcessibilidade(preferencias);
    const paginaExigeLibras = document.body.dataset.page === 'libras';
    (preferencias.libras || paginaExigeLibras) ? ativarTradutorLibras() : desativarTradutorLibras();
    renderizarRecursosAcessiveis(preferencias);
  });
}

// dashboard.html: estados carregando/vazio/erro com dados simulados; filtrar, exportar, detalhar, limpar filtros
function inicializarDashboardLegado() {
  const pagina = document.querySelector("[data-page='dashboard']");
  if (!pagina) return;

  const elCarregando = document.getElementById("dashboardCarregando");
  const elVazio = document.getElementById("dashboardVazio");
  const elErro = document.getElementById("dashboardErro");
  const elConteudo = document.getElementById("dashboardConteudo");
  const seletorPeriodo = document.getElementById("dashboardPeriodo");
  const btnLimparFiltros = document.getElementById("btnDashboardLimparFiltros");
  const btnAtualizar = document.getElementById("btnDashboardAtualizar");
  const btnExportar = document.getElementById("btnDashboardExportar");
  const btnTentarNovamente = document.getElementById("btnDashboardTentarNovamente");

  function mostrarEstado(estado) {
    elCarregando.hidden = estado !== "carregando";
    elVazio.hidden = estado !== "vazio";
    elErro.hidden = estado !== "erro";
    elConteudo.hidden = estado !== "conteudo";
  }

  // Carrega os indicadores para o período selecionado. Sempre passa pelo
  // estado "carregando"; o período "personalizado" não tem dados simulados
  // definidos e resulta no estado "vazio"; sem conexão resulta em "erro".
  function carregarDashboard() {
    mostrarEstado("carregando");

    window.setTimeout(() => {
      if (!navigator.onLine) {
        mostrarEstado("erro");
        return;
      }

      if (seletorPeriodo.value === "personalizado") {
        mostrarEstado("vazio");
        return;
      }

      mostrarEstado("conteudo");
    }, 700);
  }

  seletorPeriodo?.addEventListener("change", carregarDashboard);

  btnLimparFiltros?.addEventListener("click", () => {
    seletorPeriodo.value = "7d";
    carregarDashboard();
    mostrarToast({ tipo: "info", titulo: "Filtros limpos", mensagem: "Mostrando o período padrão (últimos 7 dias)." });
  });

  btnAtualizar?.addEventListener("click", carregarDashboard);
  btnTentarNovamente?.addEventListener("click", carregarDashboard);

  btnExportar?.addEventListener("click", () => {
    mostrarToast({ tipo: "sucesso", titulo: "Relatório exportado", mensagem: "O resumo do período foi exportado (dados simulados)." });
  });

  // "Detalhar" — cada gráfico funciona como atalho para o histórico.
  document.querySelectorAll(".cartao-grafico__titulo").forEach((titulo) => {
    titulo.style.cursor = "pointer";
    titulo.addEventListener("click", () => {
      window.location.href = "historico.html";
    });
  });

  carregarDashboard();
}

// Página de Libras (libras.html)

function inicializarLibrasLegado() {
  const corpoLibras = document.getElementById('librasBody');
  if (!corpoLibras) return; // não está na página de Libras

  // Elementos
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnRepeat = document.getElementById('btnRepeat');
  const speedSelect = document.getElementById('speedSelect');
  const btnLegenda = document.getElementById('btnLegenda');
  const btnTelaCheia = document.getElementById('btnTelaCheia');
  const legendaTexto = document.getElementById('legendaTexto');
  const statusOverlay = document.querySelector('.overlay-status .status-texto');
  const chatComposerForm = document.getElementById('chatComposerForm');
  const chatComposerInput = document.getElementById('chatComposerInput');
  const botoesResposta = document.querySelectorAll('.botao-resposta');
  const btnEncerrar = document.getElementById('btnEncerrarAtendimento');
  const videoInterprete = document.getElementById('videoInterprete');

  // Estado da simulação
  let isPlaying = true;
  let isLegendaAtiva = true;
  let speed = 1.0;
  let timer = null;
  let indiceMensagem = 0;

  const mensagens = [
    "Olá! Como posso ajudar você hoje?",
    "Entendi! Vamos verificar alguns pontos.",
    "Você já tentou reiniciar o modem?",
    "Pode me informar seu número de telefone?",
    "Estou verificando o problema...",
    "Concluído! Sua internet deve voltar em breve."
  ];
  const intervalos = [3000, 2500, 3500, 2000, 4000, 3000]; // ms

  function atualizarLegenda(texto) {
    if (isLegendaAtiva) {
      legendaTexto.textContent = texto;
    } else {
      legendaTexto.textContent = '[Legenda desativada]';
    }
  }

  function proximaMensagem() {
    if (!isPlaying) return;
    const msg = mensagens[indiceMensagem % mensagens.length];
    atualizarLegenda(msg);
    if (statusOverlay) {
      statusOverlay.textContent = 'Interpretando...';
    }
    const tempo = intervalos[indiceMensagem % intervalos.length] / speed;
    indiceMensagem++;
    timer = setTimeout(proximaMensagem, tempo);
  }

  function iniciarSimulacao() {
    if (timer) clearTimeout(timer);
    isPlaying = true;
    btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
    if (statusOverlay) statusOverlay.textContent = 'Interpretando...';
    proximaMensagem();
  }

  function pausarSimulacao() {
    isPlaying = false;
    if (timer) clearTimeout(timer);
    btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    if (statusOverlay) statusOverlay.textContent = 'Pausado';
  }

  // Play/Pause
  btnPlayPause.addEventListener('click', function() {
    if (isPlaying) {
      pausarSimulacao();
    } else {
      iniciarSimulacao();
    }
  });

  // Repetir
  btnRepeat.addEventListener('click', function() {
    indiceMensagem = 0;
    if (timer) clearTimeout(timer);
    if (isPlaying) {
      iniciarSimulacao();
    } else {
      const msg = mensagens[0];
      atualizarLegenda(msg);
    }
  });

  // Velocidade
  speedSelect.addEventListener('change', function() {
    speed = parseFloat(this.value);
    if (isPlaying) {
      if (timer) clearTimeout(timer);
      proximaMensagem();
    }
  });

  // Legenda toggle
  btnLegenda.addEventListener('click', function() {
    isLegendaAtiva = !isLegendaAtiva;
    this.classList.toggle('esta-ativo');
    if (isLegendaAtiva) {
      this.innerHTML = '<i class="fa-solid fa-closed-captioning"></i> <span>Legenda</span>';
      if (indiceMensagem > 0) {
        const msg = mensagens[(indiceMensagem - 1) % mensagens.length];
        atualizarLegenda(msg);
      } else {
        atualizarLegenda(mensagens[0]);
      }
    } else {
      this.innerHTML = '<i class="fa-solid fa-closed-captioning"></i> <span>Legenda</span>';
      atualizarLegenda('[Legenda desativada]');
    }
  });

  // Tela cheia (simulação)
  btnTelaCheia.addEventListener('click', function() {
    if (videoInterprete.requestFullscreen) {
      videoInterprete.requestFullscreen().catch(() => {
        mostrarToast({ tipo: "erro", mensagem: "Função de tela cheia não disponível." });
      });
    } else {
      mostrarToast({ tipo: "info", mensagem: "Função de tela cheia simulada." });
    }
  });

  // Enviar mensagem do usuário
  function adicionarMensagemUsuario(texto) {
    if (!texto.trim()) return;
    // Exibe a mensagem do usuário na legenda
    legendaTexto.textContent = 'Você: ' + texto;
    // Resposta simulada do Mimo
    setTimeout(() => {
      const respostas = [
        "Entendi! Vou verificar isso para você.",
        "Obrigado pela informação. Aguarde um momento.",
        "Vou te ajudar com isso."
      ];
      const resposta = respostas[Math.floor(Math.random() * respostas.length)];
      legendaTexto.textContent = 'Mimo: ' + resposta;
      // Se a simulação estiver rodando, pausa e reinicia após a resposta do Mimo
      if (isPlaying) {
        pausarSimulacao();
        // Reinicia a simulação após 3s
        setTimeout(() => {
          iniciarSimulacao();
        }, 3000);
      }
    }, 1500);
  }

  chatComposerForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const texto = chatComposerInput.value.trim();
    if (texto) {
      adicionarMensagemUsuario(texto);
      chatComposerInput.value = '';
    }
  });

  // Respostas rápidas
  botoesResposta.forEach(function(btn) {
    btn.addEventListener('click', function() {
      const texto = this.textContent.trim();
      adicionarMensagemUsuario(texto);
    });
  });

  // Encerrar atendimento
  btnEncerrar.addEventListener('click', function() {
    encerrarAtendimentoAtual();
  });

  // Iniciar simulação automaticamente
  iniciarSimulacao();

  // Limpar timer ao sair da página
  window.addEventListener('beforeunload', function() {
    if (timer) clearTimeout(timer);
  });
}

function abrirPainelTradutorLibras() {
  ativarTradutorLibras();
  let tentativas = 0;
  const aguardar = window.setInterval(() => {
    const botao = document.querySelector('[vw-access-button]');
    if (botao) {
      botao.click();
      window.clearInterval(aguardar);
    }
    tentativas += 1;
    if (tentativas >= 20) {
      window.clearInterval(aguardar);
      mostrarToast({ tipo: 'aviso', titulo: 'Tradutor indisponível', mensagem: 'Verifique sua conexão e atualize a página para tentar novamente.' });
    }
  }, 300);
}

// Atendimento em Libras: texto é sempre a fonte principal da conversa e o
// VLibras traduz a resposta atual do Mimo quando a pessoa abre o tradutor.
function inicializarLibras() {
  const corpo = document.getElementById('librasBody');
  if (!corpo) return;
  const legenda = document.getElementById('legendaTexto');
  const transcricao = document.getElementById('librasTranscricao');
  const status = document.getElementById('statusTraducaoLibras');
  const btnTradutor = document.getElementById('btnAbrirTradutorLibras');
  const btnRepetir = document.getElementById('btnRepeat');
  const btnLegenda = document.getElementById('btnLegenda');
  const btnTelaCheia = document.getElementById('btnTelaCheia');
  const formulario = document.getElementById('chatComposerForm');
  const entrada = document.getElementById('chatComposerInput');
  const encerrar = document.getElementById('btnEncerrarAtendimento');
  const btnComoUsar = document.getElementById('btnComoUsarLibras');
  const estadoTradutor = document.getElementById('estadoTradutorLibras');
  const painelTraducao = document.querySelector('.painel-traducao-libras');
  let legendaVisivel = true;

  function atualizarEstadoTradutor(estado, texto) {
    if (!estadoTradutor) return;
    estadoTradutor.dataset.estado = estado;
    estadoTradutor.lastChild.textContent = ` ${texto}`;
  }

  function verificarTradutor() {
    let tentativas = 0;
    const temporizador = window.setInterval(() => {
      const pronto = Boolean(document.querySelector('[vw-access-button]'));
      tentativas += 1;
      if (pronto) {
        window.clearInterval(temporizador);
        atualizarEstadoTradutor('pronto', 'Tradutor disponível');
      } else if (tentativas >= 40) {
        window.clearInterval(temporizador);
        atualizarEstadoTradutor('indisponivel', 'Tradutor indisponível');
      }
    }, 300);
  }

  function selecionarTexto(elemento) {
    if (!elemento || !window.getSelection) return;
    const selecao = window.getSelection();
    const intervalo = document.createRange();
    intervalo.selectNodeContents(elemento);
    selecao.removeAllRanges();
    selecao.addRange(intervalo);
    elemento.classList.add('aguardando-traducao');
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => elemento.classList.remove('aguardando-traducao'), 3500);
  }

  function traduzirMensagem(elementoTexto) {
    selecionarTexto(elementoTexto);
    abrirPainelTradutorLibras();
    if (status) status.textContent = 'Resposta selecionada. Use o avatar do VLibras para acompanhar a tradução.';
    atualizarEstadoTradutor('ativo', 'Tradução solicitada');
  }

  function mostrarMensagem(remetente, texto) {
    const prefixo = remetente === 'mimo' ? 'Mimo' : 'Você';
    if (legendaVisivel) legenda.textContent = `${prefixo}: ${texto}`;
    if (transcricao) {
      const item = document.createElement('article');
      item.className = `mensagem-libras mensagem-libras--${remetente}`;
      const titulo = document.createElement('strong');
      titulo.textContent = prefixo;
      const conteudo = document.createElement('p');
      conteudo.textContent = texto;
      item.append(titulo, conteudo);
      if (remetente === 'mimo') {
        const acoes = document.createElement('div');
        acoes.className = 'acoes-mensagem-libras';
        const traduzir = document.createElement('button');
        traduzir.type = 'button';
        traduzir.className = 'acao-mensagem-libras acao-traduzir-libras';
        traduzir.innerHTML = '<i class="fa-solid fa-hands" aria-hidden="true"></i> Traduzir em Libras';
        traduzir.addEventListener('click', () => traduzirMensagem(conteudo));
        const copiar = document.createElement('button');
        copiar.type = 'button';
        copiar.className = 'acao-mensagem-libras';
        copiar.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i> Copiar texto';
        copiar.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(texto);
            copiar.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Copiado';
            window.setTimeout(() => { copiar.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i> Copiar texto'; }, 1800);
          } catch (_) {
            mostrarToast({ tipo: 'aviso', mensagem: 'Não foi possível copiar automaticamente.' });
          }
        });
        acoes.append(traduzir, copiar);
        item.appendChild(acoes);
      }
      transcricao.appendChild(item);
      transcricao.scrollTop = transcricao.scrollHeight;
    }
    if (status) status.textContent = remetente === 'mimo' ? 'Nova resposta disponível para tradução em Libras.' : 'Mensagem enviada ao Mimo.';
  }

  async function enviar(texto) {
    const mensagem = texto.trim();
    if (!mensagem) return;
    mostrarMensagem('usuario', mensagem);
    entrada.value = '';
    entrada.disabled = true;
    formulario?.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Mimo está preparando uma resposta em texto e Libras.';
    try {
      const resposta = await solicitarRespostaDoMimo(mensagem);
      mostrarMensagem('mimo', resposta.resposta || 'Não consegui preparar uma resposta agora.');
      if (status) status.textContent = 'Resposta pronta. Escolha “Traduzir em Libras” para abrir o intérprete.';
    } catch (_) {
      mostrarMensagem('mimo', 'Não foi possível conectar agora. Você pode tentar novamente ou escolher uma das opções de ajuda.');
      if (status) status.textContent = 'Não foi possível traduzir esta resposta no momento.';
    } finally {
      entrada.disabled = false;
      formulario?.removeAttribute('aria-busy');
      entrada.focus();
    }
  }

  btnTradutor?.addEventListener('click', abrirPainelTradutorLibras);
  btnRepetir?.addEventListener('click', abrirPainelTradutorLibras);
  btnComoUsar?.addEventListener('click', () => {
    painelTraducao?.classList.toggle('mostrar-passos');
    document.querySelector('.passos-libras')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (status) status.textContent = 'Envie sua dúvida, aguarde a resposta e escolha “Traduzir em Libras”.';
  });
  btnLegenda?.addEventListener('click', () => {
    legendaVisivel = !legendaVisivel;
    legenda.parentElement.hidden = !legendaVisivel;
    btnLegenda.classList.toggle('esta-ativo', legendaVisivel);
  });
  btnTelaCheia?.addEventListener('click', () => document.getElementById('videoInterprete')?.requestFullscreen?.());
  formulario?.addEventListener('submit', (evento) => { evento.preventDefault(); enviar(entrada.value); });
  document.querySelectorAll('#librasRespostasRapidas .botao-resposta').forEach((botao) => botao.addEventListener('click', () => enviar(botao.textContent.trim())));
  encerrar?.addEventListener('click', () => { encerrarAtendimentoAtual(); });

  mostrarMensagem('mimo', 'Olá! Escreva sua dúvida ou escolha uma opção. Cada resposta ficará visível em texto e poderá ser traduzida para Libras.');
  if (status) status.textContent = 'Atendimento visual pronto. Você controla quando abrir o tradutor em Libras.';
  verificarTradutor();
}

// Página de Texto Simplificado (texto-simplificado.html)

function inicializarTextosimplificado() {
  const corpo = document.getElementById('simplificadoBody');
  if (!corpo) return; // não está na página de texto simplificado

  // Elementos
  const passoNumero = document.getElementById('passoNumero');
  const passoTotal = document.getElementById('passoTotal');
  const passoBarras = document.getElementById('passoBarras');
  const passoPergunta = document.getElementById('passoPergunta');
  const opcoesContainer = document.getElementById('opcoesContainer');
  const btnContinuar = document.getElementById('btnContinuar');
  const passoResultado = document.getElementById('passoResultado');
  const textoResultado = document.getElementById('textoResultado');
  const btnFinalizar = document.getElementById('btnFinalizar');
  const btnEncerrar = document.getElementById('btnEncerrarAtendimento');
  const chatComposerForm = document.getElementById('chatComposerForm');
  const chatComposerInput = document.getElementById('chatComposerInput');

  // Estado
  let etapaAtual = 0;
  let opcaoSelecionada = null;
  let historicoRespostas = {};

  // Definição do fluxo de etapas (uma pergunta por vez)
  const etapas = [
    {
      pergunta: 'Como podemos ajudar você hoje?',
      opcoes: [
        { valor: 'internet', rotulo: 'Problemas com internet', icone: 'fa-solid fa-wifi' },
        { valor: 'fatura', rotulo: 'Dúvidas sobre fatura', icone: 'fa-regular fa-file-lines' },
        { valor: 'planos', rotulo: 'Alterar plano', icone: 'fa-solid fa-tag' }
      ]
    },
    {
      pergunta: 'Qual é o problema exatamente?',
      opcoes: [
        { valor: 'lenta', rotulo: 'Conexão muito lenta', icone: 'fa-solid fa-gauge-high' },
        { valor: 'cai', rotulo: 'Sinal cai frequentemente', icone: 'fa-solid fa-signal' },
        { valor: 'modem', rotulo: 'Modem não liga', icone: 'fa-solid fa-router' }
      ],
      condicao: (respostas) => respostas['etapa0'] === 'internet'
    },
    {
      pergunta: 'Qual é o problema exatamente?',
      opcoes: [
        { valor: 'atraso', rotulo: 'Boleto com vencimento atrasado', icone: 'fa-regular fa-calendar-xmark' },
        { valor: 'valores', rotulo: 'Dúvida sobre valores cobrados', icone: 'fa-regular fa-circle-question' },
        { valor: 'reenvio', rotulo: 'Solicitar segunda via', icone: 'fa-regular fa-file' }
      ],
      condicao: (respostas) => respostas['etapa0'] === 'fatura'
    },
    {
      pergunta: 'Qual é o problema exatamente?',
      opcoes: [
        { valor: 'mais-dados', rotulo: 'Quero mais dados móveis', icone: 'fa-solid fa-database' },
        { valor: 'fibra', rotulo: 'Quero contratar fibra ótica', icone: 'fa-solid fa-tower-broadcast' },
        { valor: 'combo', rotulo: 'Quero um plano combo', icone: 'fa-solid fa-layer-group' }
      ],
      condicao: (respostas) => respostas['etapa0'] === 'planos'
    }
  ];

  // Função para atualizar a etapa
  function atualizarEtapa(indice) {
    // Filtra etapas com base nas respostas
    const etapaFiltrada = etapas.filter((e, idx) => {
      if (idx === 0) return true;
      if (!e.condicao) return true;
      return e.condicao(historicoRespostas);
    });

    const etapa = etapaFiltrada[indice];
    if (!etapa) {
      // Fim do fluxo: exibir resultado
      exibirResultado();
      return;
    }

    // Atualiza indicador
    const total = etapaFiltrada.length;
    passoNumero.textContent = indice + 1;
    passoTotal.textContent = total;

    // Atualiza barras
    const barras = passoBarras.querySelectorAll('.barra-passo');
    barras.forEach((barra, i) => {
      barra.classList.toggle('ativa', i <= indice);
    });

    // Atualiza pergunta
    passoPergunta.textContent = etapa.pergunta;

    // Atualiza opções
    opcoesContainer.innerHTML = '';
    etapa.opcoes.forEach((opcao) => {
      const btn = document.createElement('button');
      btn.className = 'opcao-simplificada';
      btn.dataset.valor = opcao.valor;
      btn.innerHTML = `<i class="${opcao.icone}"></i><span>${opcao.rotulo}</span>`;
      btn.addEventListener('click', () => selecionarOpcao(btn, opcao.valor));
      opcoesContainer.appendChild(btn);
    });

    // Reseta seleção
    opcaoSelecionada = null;
    btnContinuar.disabled = true;
    passoResultado.style.display = 'none';

    // Scroll para o topo do conteúdo
    corpo.scrollTop = 0;
  }

  // Selecionar opção
  function selecionarOpcao(btn, valor) {
    // Remove seleção anterior
    document.querySelectorAll('.opcao-simplificada').forEach(el => el.classList.remove('selecionada'));
    btn.classList.add('selecionada');
    opcaoSelecionada = valor;
    btnContinuar.disabled = false;
  }

  // Avançar para a próxima etapa
  function avancarEtapa() {
    if (opcaoSelecionada === null) return;

    // Salva resposta
    historicoRespostas[`etapa${etapaAtual}`] = opcaoSelecionada;

    // Próxima etapa
    etapaAtual++;
    atualizarEtapa(etapaAtual);
  }

  // Exibir resultado final
  function exibirResultado() {
    opcoesContainer.innerHTML = '';
    btnContinuar.style.display = 'none';
    passoPergunta.style.display = 'none';

    let mensagem = 'Sua solicitação foi encaminhada com sucesso.';
    if (historicoRespostas['etapa0'] === 'internet') {
      mensagem = 'Vamos reiniciar seu modem remotamente. Aguarde 2 minutos e teste novamente. Se o problema persistir, falaremos com um especialista.';
    } else if (historicoRespostas['etapa0'] === 'fatura') {
      mensagem = 'Iremos enviar a segunda via da sua fatura para o e-mail cadastrado em até 5 minutos.';
    } else if (historicoRespostas['etapa0'] === 'planos') {
      mensagem = 'Um especialista em planos entrará em contato com você em breve para oferecer as melhores opções.';
    }

    textoResultado.textContent = mensagem;
    passoResultado.style.display = 'flex';
  }

  // Finalizar atendimento
  function finalizarAtendimento() {
    encerrarAtendimentoAtual();
  }

  // Eventos dos botões
  btnContinuar.addEventListener('click', avancarEtapa);
  btnFinalizar.addEventListener('click', finalizarAtendimento);

  btnEncerrar.addEventListener('click', function() {
    encerrarAtendimentoAtual();
  });

  // Compositor (fallback para mensagem livre)
  chatComposerForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const texto = chatComposerInput.value.trim();
    if (texto) {
      // Simula resposta do Mimo
      mostrarToast({ tipo: 'sucesso', titulo: 'Mensagem enviada', mensagem: 'Em breve um especialista responderá.' });
      chatComposerInput.value = '';
    }
  });

  // Inicializa com a primeira etapa
  atualizarEtapa(0);
}

// Reenviar código na recuperação de senha (apenas esqueci-senha.html)
function inicializarReenvioCodigo() {
  const reenviarCodigo = document.querySelector('.reenviar-codigo .link-acao');
  if (!reenviarCodigo) return;

  reenviarCodigo.addEventListener('click', (e) => {
    e.preventDefault();
    reenviarCodigo.textContent = 'Código reenviado!';
    reenviarCodigo.style.pointerEvents = 'none';
    setTimeout(() => {
      reenviarCodigo.textContent = 'Reenviar código';
      reenviarCodigo.style.pointerEvents = '';
    }, 3000);
  });
}

// central-de-ajuda.html: acordeão de FAQ, chips de sugestão, filtro de busca
function inicializarCentralDeAjudaLegado() {
  const listaFaq = document.getElementById('listaFaq');
  if (!listaFaq) return; // só executa dentro de central-de-ajuda.html

  const itensFaq = Array.from(listaFaq.querySelectorAll('.faq-item'));
  const buscaInput = document.getElementById('buscaAjudaInput');
  const chips = document.querySelectorAll('#chipsSugestaoAjuda .chip-filtro');

  // Acordeão: abre um item e fecha os demais
  itensFaq.forEach((item) => {
    const botaoPergunta = item.querySelector('.faq-pergunta');
    if (!botaoPergunta) return;

    botaoPergunta.addEventListener('click', () => {
      const jaEstaAberto = item.classList.contains('esta-aberto');

      itensFaq.forEach((outroItem) => {
        outroItem.classList.remove('esta-aberto');
        outroItem.querySelector('.faq-pergunta')?.setAttribute('aria-expanded', 'false');
      });

      if (!jaEstaAberto) {
        item.classList.add('esta-aberto');
        botaoPergunta.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Filtra as perguntas frequentes pelo texto digitado na busca
  function filtrarPerguntas(termo) {
    const termoNormalizado = termo.trim().toLowerCase();

    itensFaq.forEach((item) => {
      const textoItem = item.textContent.toLowerCase();
      const corresponde = termoNormalizado === '' || textoItem.includes(termoNormalizado);
      item.classList.toggle('faq-sem-resultado', !corresponde);
    });
  }

  if (buscaInput) {
    buscaInput.addEventListener('input', () => filtrarPerguntas(buscaInput.value));
  }

  // Chips de sugestão preenchem a busca e aplicam o filtro
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((outroChip) => outroChip.classList.remove('esta-ativo'));
      chip.classList.add('esta-ativo');

      if (buscaInput) {
        buscaInput.value = chip.textContent.trim();
        buscaInput.focus();
      }
      filtrarPerguntas(chip.textContent.trim());
    });
  });
}

function inicializarCentralDeAjuda() {
  const pagina = document.querySelector('.secao-central-ajuda');
  const listaFaq = document.getElementById('listaFaq');
  if (!pagina || !listaFaq) return;

  const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const busca = document.getElementById('buscaAjudaInput');
  const btnLimpar = document.getElementById('btnLimparBuscaAjuda');
  const chips = [...document.querySelectorAll('#chipsSugestaoAjuda .chip-filtro')];
  const faqs = [...listaFaq.querySelectorAll('.faq-item')];
  const tutoriaisCards = [...document.querySelectorAll('.ajuda-tutorial-card')];
  const semResultados = document.getElementById('ajudaSemResultados');
  const contadorResultados = document.getElementById('contadorResultadosAjuda');
  const badgePerfil = document.getElementById('ajudaPerfilBadge');
  const modalTutorial = document.getElementById('modalTutorialAjuda');
  const modalAtendente = document.getElementById('modalAtendenteAjuda');
  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  let perfilAjuda = 'intermediario';
  let tutorialAtual = null;

  const tutoriais = {
    fatura: {
      titulo: 'Segunda via da fatura',
      resumo: 'Encontre sua conta e escolha a melhor forma de pagamento.',
      assunto: 'segunda via da minha fatura',
      passos: {
        iniciante: ['Abra o aplicativo ou o site da Vivo e procure por Minha Vivo.', 'Entre com seu CPF ou e-mail e sua senha.', 'Toque em Faturas e escolha a conta que está em aberto.', 'Selecione Segunda via ou Copiar código. Confira o valor antes de pagar.'],
        intermediario: ['Acesse Minha Vivo e entre na sua conta.', 'Abra Faturas, escolha a conta e selecione Segunda via.', 'Copie o código ou baixe o PDF depois de conferir o valor.'],
        avancado: ['Em Minha Vivo, abra Faturas e selecione a conta.', 'Copie o código de pagamento ou baixe o PDF.']
      }
    },
    internet: {
      titulo: 'Internet e Wi-Fi',
      resumo: 'Faça verificações simples antes de alterar qualquer configuração.',
      assunto: 'minha internet ou meu Wi-Fi',
      passos: {
        iniciante: ['Veja se o roteador está ligado e se alguma luz vermelha está acesa.', 'Confira, sem puxar, se os cabos estão firmes.', 'Desligue o roteador da tomada, espere 30 segundos e ligue novamente.', 'Aguarde até 3 minutos. Se não voltar, continue com o Mimo para fazermos o diagnóstico.'],
        intermediario: ['Confira as luzes e os cabos do roteador.', 'Reinicie o equipamento e aguarde até 3 minutos.', 'Teste outro aparelho. Se o problema continuar, fale com o Mimo.'],
        avancado: ['Valide LEDs, cabeamento e reinicie o roteador.', 'Teste outro dispositivo e prossiga para o diagnóstico se a falha persistir.']
      }
    },
    conta: {
      titulo: 'Conta e segurança',
      resumo: 'Recupere seu acesso sem compartilhar dados confidenciais.',
      assunto: 'acesso à minha conta Vivo AdaptAI',
      passos: {
        iniciante: ['Na tela de login, toque em Esqueci minha senha.', 'Digite o mesmo e-mail usado no cadastro.', 'Abra o e-mail enviado pelo Vivo AdaptAI e toque no link.', 'Crie uma senha nova. Não envie essa senha nem o código para ninguém.'],
        intermediario: ['Use Esqueci minha senha na tela de login.', 'Informe o e-mail do cadastro e abra o link recebido.', 'Defina uma nova senha segura e exclusiva.'],
        avancado: ['Solicite a redefinição na tela de login.', 'Abra o link recebido e crie uma senha nova e exclusiva.']
      }
    },
    acessibilidade: {
      titulo: 'Recursos de acessibilidade',
      resumo: 'Ajuste a interface para ler, ouvir ou interagir com mais conforto.',
      assunto: 'configurações de acessibilidade',
      passos: {
        iniciante: ['Abra Acessibilidade no menu.', 'Escolha o que deseja ajustar: texto, contraste, espaçamento, leitura em voz alta ou Libras.', 'Ative uma opção por vez e veja como a página fica.', 'As mudanças são salvas automaticamente. Você pode voltar ao padrão quando quiser.'],
        intermediario: ['Abra Acessibilidade no menu.', 'Ajuste texto, contraste, espaçamento, voz ou Libras.', 'Teste as opções e mantenha as que facilitarem seu uso.'],
        avancado: ['Abra Acessibilidade e ajuste os recursos desejados.', 'As preferências são aplicadas e salvas automaticamente.']
      }
    }
  };

  const abrirDialogo = (dialogo) => {
    if (!dialogo) return;
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', '');
  };
  const fecharDialogo = (dialogo) => {
    if (!dialogo) return;
    if (typeof dialogo.close === 'function') dialogo.close();
    else dialogo.removeAttribute('open');
  };

  const aplicarPerfil = (perfil) => {
    perfilAjuda = ['iniciante', 'intermediario', 'avancado'].includes(perfil) ? perfil : 'intermediario';
    const rotulos = { iniciante: 'Passo a passo detalhado', intermediario: 'Orientações objetivas', avancado: 'Respostas diretas' };
    if (badgePerfil) badgePerfil.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${rotulos[perfilAjuda]}`;
    faqs.forEach((item) => {
      const resposta = item.querySelector('[data-resposta-base]');
      if (!resposta) return;
      const base = resposta.dataset.respostaBase;
      resposta.textContent = perfilAjuda === 'iniciante' ? `Vamos por partes. ${base}` : base;
    });
  };

  if (token) {
    requisitarApi('/perfil', { headers: obterCabecalhoAutorizado() })
      .then((dados) => aplicarPerfil(dados.perfil))
      .catch(() => aplicarPerfil('intermediario'));
  } else aplicarPerfil('intermediario');

  const filtrar = (termo = '') => {
    const partes = normalizar(termo).split(/\s+/).filter(Boolean);
    const corresponde = (texto) => partes.length === 0 || partes.some((parte) => normalizar(texto).includes(parte));
    let total = 0;
    faqs.forEach((item) => {
      const visivel = corresponde(`${item.dataset.termos || ''} ${item.textContent}`);
      item.classList.toggle('faq-sem-resultado', !visivel);
      if (visivel) total += 1;
    });
    tutoriaisCards.forEach((card) => {
      const visivel = corresponde(`${card.dataset.termos || ''} ${card.textContent}`);
      card.hidden = !visivel;
      if (visivel) total += 1;
    });
    if (semResultados) semResultados.hidden = total > 0;
    if (contadorResultados) contadorResultados.textContent = partes.length ? `${total} resultado${total === 1 ? '' : 's'}` : 'Conteúdo disponível';
    if (btnLimpar) btnLimpar.hidden = !termo;
  };

  const selecionarTermo = (termo, chipAtivo = null) => {
    if (busca) busca.value = termo;
    chips.forEach((chip) => chip.classList.toggle('esta-ativo', chip === chipAtivo));
    filtrar(termo);
    busca?.focus();
  };
  busca?.addEventListener('input', () => {
    chips.forEach((chip) => chip.classList.remove('esta-ativo'));
    filtrar(busca.value);
  });
  btnLimpar?.addEventListener('click', () => selecionarTermo(''));
  chips.forEach((chip) => chip.addEventListener('click', () => selecionarTermo(chip.dataset.termo || chip.textContent, chip)));
  document.querySelectorAll('[data-filtrar-ajuda]').forEach((botao) => botao.addEventListener('click', () => selecionarTermo(botao.dataset.filtrarAjuda)));
  document.getElementById('btnVerTodasFaq')?.addEventListener('click', () => selecionarTermo(''));

  faqs.forEach((item) => {
    const botao = item.querySelector('.faq-pergunta');
    botao?.addEventListener('click', () => {
      const abrir = !item.classList.contains('esta-aberto');
      faqs.forEach((outro) => {
        outro.classList.remove('esta-aberto');
        outro.querySelector('.faq-pergunta')?.setAttribute('aria-expanded', 'false');
      });
      if (abrir) {
        item.classList.add('esta-aberto');
        botao.setAttribute('aria-expanded', 'true');
      }
    });
  });

  const iniciarComMimo = (assunto) => {
    sessionStorage.setItem(CHAVE_MENSAGEM_PENDENTE, `Preciso de ajuda com ${assunto}.`);
    window.location.href = 'atendimento-texto.html';
  };
  document.querySelectorAll('[data-iniciar-ajuda]').forEach((botao) => botao.addEventListener('click', () => iniciarComMimo(botao.dataset.iniciarAjuda)));

  tutoriaisCards.forEach((card) => card.addEventListener('click', () => {
    tutorialAtual = tutoriais[card.dataset.tutorial];
    if (!tutorialAtual || !modalTutorial) return;
    document.getElementById('tutorialAjudaTitulo').textContent = tutorialAtual.titulo;
    document.getElementById('tutorialAjudaResumo').textContent = tutorialAtual.resumo;
    document.getElementById('tutorialAjudaPassos').innerHTML = tutorialAtual.passos[perfilAjuda].map((passo, indice) => `<li><span>${indice + 1}</span><p>${passo}</p></li>`).join('');
    abrirDialogo(modalTutorial);
  }));
  document.getElementById('btnTutorialFalarMimo')?.addEventListener('click', () => iniciarComMimo(tutorialAtual?.assunto || 'este assunto'));

  const abrirAtendente = () => {
    if (!token) {
      sessionStorage.setItem('vivo-adaptai-retorno-login', 'central-de-ajuda.html');
      mostrarToast({ tipo: 'info', titulo: 'Entre para gerar um protocolo', mensagem: 'O atendimento humano precisa ser vinculado à sua conta.' });
      window.setTimeout(() => { window.location.href = 'entrar.html'; }, 1200);
      return;
    }
    abrirDialogo(modalAtendente);
  };
  document.querySelectorAll('[data-chamar-humano]').forEach((botao) => botao.addEventListener('click', abrirAtendente));

  document.querySelectorAll('.modal-ajuda [data-fechar-ajuda]').forEach((botao) => botao.addEventListener('click', () => fecharDialogo(botao.closest('dialog'))));
  document.querySelectorAll('.modal-ajuda').forEach((dialogo) => dialogo.addEventListener('click', (evento) => { if (evento.target === dialogo) fecharDialogo(dialogo); }));

  const formAtendente = document.getElementById('formAtendenteAjuda');
  const descricao = document.getElementById('descricaoAtendenteAjuda');
  const contadorDescricao = document.getElementById('contadorDescricaoAjuda');
  descricao?.addEventListener('input', () => { if (contadorDescricao) contadorDescricao.textContent = `${descricao.value.length}/1000`; });
  formAtendente?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const assunto = document.getElementById('assuntoAtendenteAjuda')?.value;
    const texto = descricao?.value.trim();
    const botao = document.getElementById('btnEnviarSolicitacaoAjuda');
    const status = document.getElementById('statusSolicitacaoAjuda');
    if (!assunto || !texto || texto.length < 10) return;
    definirCarregamentoBotao(botao, true);
    if (status) status.textContent = 'Registrando sua solicitação...';
    try {
      const resultado = await requisitarApi('/ajuda/solicitacoes', {
        method: 'POST',
        headers: obterCabecalhoAutorizado(),
        body: JSON.stringify({ assunto, descricao: texto })
      });
      if (status) {
        status.className = 'status-ajuda-solicitacao esta-sucesso';
        status.innerHTML = `<i class="fa-solid fa-circle-check"></i><strong>Solicitação registrada</strong><span>Protocolo ${resultado.protocolo}</span>`;
      }
      formAtendente.querySelectorAll('select, textarea').forEach((campo) => { campo.disabled = true; });
      botao.hidden = true;
    } catch (erro) {
      if (status) {
        status.className = 'status-ajuda-solicitacao esta-erro';
        status.textContent = mensagemErroAutenticacao(erro);
      }
    } finally {
      definirCarregamentoBotao(botao, false);
    }
  });

  filtrar('');
}

function inicializarDashboard() {
  const pagina = document.querySelector("[data-page='dashboard']");
  if (!pagina) return;
  const porId = (id) => document.getElementById(id);
  const lista = porId('operacaoLista');
  const carregando = porId('operacaoCarregando');
  const erro = porId('operacaoErro');
  const vazio = porId('operacaoVazio');
  const busca = porId('operacaoBusca');
  const filtroStatus = porId('operacaoFiltroStatus');
  const somenteMeus = porId('operacaoSomenteMeus');
  const detalheInicial = porId('operacaoDetalheInicial');
  const detalheConteudo = porId('operacaoDetalheConteudo');
  const resposta = porId('operacaoResposta');
  const formulario = porId('operacaoFormularioResposta');
  const btnAssumir = porId('operacaoAssumir');
  const btnConcluir = porId('operacaoConcluir');
  const usuario = JSON.parse(sessionStorage.getItem(CHAVE_USUARIO) || '{}');
  let atendimentos = [];
  let selecionadoId = null;

  const escapar = (valor = '') => String(valor).replace(/[&<>'"]/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[caractere]));
  const normalizar = (valor = '') => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const dataHora = (valor) => valor ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)) : '';
  const statusTexto = { aberta: 'Aguardando', em_andamento: 'Em andamento', concluida: 'Concluído', cancelada: 'Cancelado' };
  const tipoTexto = { fatura: 'Fatura', internet_wifi: 'Internet e Wi-Fi', conta: 'Conta', acessibilidade: 'Acessibilidade', atendimento: 'Atendimento', outro: 'Outro assunto' };

  const mostrarEstado = (estado) => {
    carregando.hidden = estado !== 'carregando';
    erro.hidden = estado !== 'erro';
    lista.hidden = estado !== 'lista';
    vazio.hidden = estado !== 'vazio';
  };
  const filtrados = () => {
    const termo = normalizar(busca.value.trim());
    return atendimentos.filter((item) => !termo || normalizar(`${item.cliente_nome} ${item.protocolo || ''} ${item.tipo} ${item.descricao || ''}`).includes(termo));
  };
  const renderizarFila = () => {
    const itens = filtrados();
    porId('operacaoContadorFila').textContent = `${itens.length} solicitaç${itens.length === 1 ? 'ão' : 'ões'}`;
    if (!itens.length) { mostrarEstado('vazio'); return; }
    lista.innerHTML = itens.map((item) => `<button type="button" role="option" aria-selected="${item.id === selecionadoId}" class="operacao-item ${item.id === selecionadoId ? 'esta-selecionado' : ''}" data-operacao-id="${item.id}">
      <span class="operacao-item-topo"><span class="status-operacao status-${item.status}">${statusTexto[item.status]}</span><time>${escapar(dataHora(item.criada_em))}</time></span>
      <strong>${escapar(item.cliente_nome)}</strong><span class="operacao-item-assunto">${escapar(tipoTexto[item.tipo] || item.tipo)} · ${escapar(item.protocolo || `#${item.id}`)}</span>
      <p>${escapar(item.ultima_mensagem || item.descricao || 'Sem mensagem')}</p>
      <span class="operacao-item-rodape"><span class="perfil-operacao perfil-${item.perfil}">ILD ${item.ild} · ${item.perfil}</span><span>${item.atendente_nome ? escapar(item.atendente_nome) : 'Sem responsável'}</span></span>
    </button>`).join('');
    mostrarEstado('lista');
  };
  const carregarFila = async () => {
    mostrarEstado('carregando');
    const parametros = new URLSearchParams();
    if (filtroStatus.value) parametros.set('status', filtroStatus.value);
    if (somenteMeus.checked) parametros.set('somente_meus', 'true');
    try {
      const dados = await requisitarApi(`/operacao/atendimentos?${parametros}`, { headers: obterCabecalhoAutorizado() });
      atendimentos = dados.solicitacoes || [];
      porId('operacaoKpiAbertas').textContent = dados.abertas;
      porId('operacaoKpiAndamento').textContent = dados.em_andamento;
      porId('operacaoKpiMinhas').textContent = dados.minhas;
      porId('operacaoKpiConcluidas').textContent = dados.concluidas;
      renderizarFila();
    } catch (falha) {
      mostrarEstado('erro');
      if (/exclusiva|funcion/i.test(falha.message)) mostrarToast({ tipo: 'erro', titulo: 'Acesso restrito', mensagem: falha.message });
    }
  };
  const renderizarMensagens = (mensagens) => {
    const area = porId('operacaoMensagens');
    area.innerHTML = mensagens.length ? mensagens.map((mensagem) => `<article class="mensagem-operacao remetente-${mensagem.remetente}"><span>${mensagem.remetente === 'cliente' ? 'Cliente' : mensagem.remetente === 'atendente' ? 'Atendente' : 'Mimo'}</span><p>${escapar(mensagem.conteudo)}</p><time>${escapar(dataHora(mensagem.created_at))}</time></article>`).join('') : '<p class="operacao-sem-mensagens">Ainda não há mensagens nesta conversa.</p>';
    area.scrollTop = area.scrollHeight;
  };
  const renderizarDetalhe = (detalhe) => {
    detalheInicial.hidden = true;
    detalheConteudo.hidden = false;
    porId('operacaoClienteNome').textContent = detalhe.cliente_nome;
    porId('operacaoClienteInicial').textContent = detalhe.cliente_nome.charAt(0).toUpperCase();
    porId('operacaoProtocolo').textContent = detalhe.protocolo || `Solicitação #${detalhe.id}`;
    const status = porId('operacaoDetalheStatus'); status.textContent = statusTexto[detalhe.status]; status.className = `status-operacao status-${detalhe.status}`;
    porId('operacaoTipo').innerHTML = `<i class="fa-solid fa-tag"></i> ${escapar(tipoTexto[detalhe.tipo] || detalhe.tipo)}`;
    porId('operacaoIld').innerHTML = `<i class="fa-solid fa-chart-line"></i> ILD ${detalhe.ild} · ${escapar(detalhe.perfil)}`;
    porId('operacaoResponsavel').innerHTML = `<i class="fa-regular fa-user"></i> ${escapar(detalhe.atendente_nome || 'Sem responsável')}`;
    porId('operacaoDescricao').textContent = detalhe.descricao || 'O cliente não informou uma descrição.';
    renderizarMensagens(detalhe.mensagens || []);
    const responsavel = detalhe.atendente_auth_user_id === usuario.id;
    btnAssumir.hidden = detalhe.status !== 'aberta';
    formulario.hidden = detalhe.status !== 'em_andamento' || !responsavel;
    btnConcluir.hidden = detalhe.status !== 'em_andamento' || !responsavel;
    porId('operacaoAcoes').classList.toggle('sem-acoes', detalhe.status === 'concluida' || (detalhe.status === 'em_andamento' && !responsavel));
    porId('operacaoDetalhe').classList.add('esta-aberto-mobile');
  };
  const carregarDetalhe = async (id) => {
    selecionadoId = id; renderizarFila();
    try { renderizarDetalhe(await requisitarApi(`/operacao/atendimentos/${id}`, { headers: obterCabecalhoAutorizado() })); }
    catch (falha) { mostrarToast({ tipo: 'erro', titulo: 'Não foi possível abrir', mensagem: mensagemErroAutenticacao(falha) }); }
  };

  lista.addEventListener('click', (evento) => { const item = evento.target.closest('[data-operacao-id]'); if (item) carregarDetalhe(Number(item.dataset.operacaoId)); });
  busca.addEventListener('input', renderizarFila);
  filtroStatus.addEventListener('change', carregarFila);
  somenteMeus.addEventListener('change', carregarFila);
  porId('operacaoAtualizar').addEventListener('click', carregarFila);
  porId('operacaoTentarNovamente').addEventListener('click', carregarFila);
  porId('operacaoVoltarFila').addEventListener('click', () => porId('operacaoDetalhe').classList.remove('esta-aberto-mobile'));
  resposta.addEventListener('input', () => { porId('operacaoRespostaContador').textContent = `${resposta.value.length}/2000`; });
  btnAssumir.addEventListener('click', async () => {
    definirCarregamentoBotao(btnAssumir, true, 'Assumindo...');
    try { await requisitarApi(`/operacao/atendimentos/${selecionadoId}/assumir`, { method: 'PATCH', headers: obterCabecalhoAutorizado() }); mostrarToast({ tipo: 'sucesso', titulo: 'Atendimento assumido', mensagem: 'Você já pode responder ao cliente.' }); await carregarFila(); await carregarDetalhe(selecionadoId); }
    catch (falha) { mostrarToast({ tipo: 'erro', titulo: 'Não foi possível assumir', mensagem: mensagemErroAutenticacao(falha) }); }
    finally { definirCarregamentoBotao(btnAssumir, false); }
  });
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault(); const mensagem = resposta.value.trim(); if (!mensagem) { resposta.focus(); return; }
    const botao = formulario.querySelector('[type="submit"]'); definirCarregamentoBotao(botao, true, 'Enviando...');
    try { await requisitarApi(`/operacao/atendimentos/${selecionadoId}/respostas`, { method: 'POST', headers: obterCabecalhoAutorizado(), body: JSON.stringify({ mensagem }) }); resposta.value = ''; resposta.dispatchEvent(new Event('input')); mostrarToast({ tipo: 'sucesso', titulo: 'Resposta enviada', mensagem: 'O cliente recebeu uma notificação.' }); await carregarFila(); await carregarDetalhe(selecionadoId); }
    catch (falha) { mostrarToast({ tipo: 'erro', titulo: 'Não foi possível enviar', mensagem: mensagemErroAutenticacao(falha) }); }
    finally { definirCarregamentoBotao(botao, false); }
  });
  btnConcluir.addEventListener('click', async () => {
    if (btnConcluir.dataset.confirmar !== '1') { btnConcluir.dataset.confirmar = '1'; btnConcluir.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar conclusão'; window.setTimeout(() => { btnConcluir.dataset.confirmar = ''; btnConcluir.innerHTML = '<i class="fa-regular fa-circle-check"></i> Concluir atendimento'; }, 5000); return; }
    definirCarregamentoBotao(btnConcluir, true, 'Concluindo...');
    try { await requisitarApi(`/operacao/atendimentos/${selecionadoId}/concluir`, { method: 'PATCH', headers: obterCabecalhoAutorizado() }); mostrarToast({ tipo: 'sucesso', titulo: 'Atendimento concluído', mensagem: 'O histórico e o cliente foram atualizados.' }); await carregarFila(); await carregarDetalhe(selecionadoId); }
    catch (falha) { mostrarToast({ tipo: 'erro', titulo: 'Não foi possível concluir', mensagem: mensagemErroAutenticacao(falha) }); }
    finally { definirCarregamentoBotao(btnConcluir, false); }
  });
  carregarFila();
}

// Central de privacidade: ações sensíveis sempre passam pelo backend autenticado.
function inicializarPrivacidade() {
  const conteudo = document.getElementById('privacyContent');
  if (!conteudo) return;

  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  const loginNecessario = document.getElementById('privacyLoginRequired');
  if (!token) {
    conteudo.hidden = true;
    loginNecessario.hidden = false;
    return;
  }

  const cabecalhos = () => ({ Authorization: `Bearer ${token}` });
  const controlesConsentimento = [...document.querySelectorAll('[data-privacy-consent]')];
  const statusConsentimento = document.getElementById('privacyConsentStatus');
  const mensagemErro = (erro) => erro?.message || 'Não foi possível concluir esta ação agora.';
  const abrirDialogoPrivacidade = (dialogo) => {
    if (!dialogo) return;
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', '');
  };
  const fecharDialogoPrivacidade = (dialogo) => {
    if (!dialogo) return;
    if (typeof dialogo.close === 'function') dialogo.close();
    else dialogo.removeAttribute('open');
  };
  const encerrarSessaoLocalDepois = (mensagem) => {
    mostrarToast({ tipo: 'sucesso', titulo: 'Concluído', mensagem });
    window.setTimeout(() => {
      limparSessaoLocal();
      window.location.href = 'entrar.html';
    }, 900);
  };

  async function carregarResumo() {
    try {
      const resumo = await requisitarApi('/privacidade', { headers: cabecalhos() });
      document.getElementById('privacyAccountSummary').textContent = `${resumo.nome} · ${resumo.email || 'conta protegida'}`;
      document.getElementById('privacyConversationsCount').textContent = resumo.totais.conversas;
      document.getElementById('privacyMessagesCount').textContent = resumo.totais.mensagens;
      document.getElementById('privacyEventsCount').textContent = resumo.totais.eventos_digitais;
      document.getElementById('privacyNotificationsCount').textContent = resumo.totais.notificacoes;
      document.getElementById('privacyPolicyVersion').textContent = resumo.versao_politica;
      document.getElementById('privacyPolicyUpdatedAt').textContent = resumo.atualizado_em;
      const escolhas = Object.fromEntries(resumo.consentimentos.map(item => [item.tipo, item.concedido]));
      controlesConsentimento.forEach(controle => {
        controle.checked = Boolean(escolhas[controle.dataset.privacyConsent]);
        controle.disabled = false;
      });
    } catch (erro) {
      document.getElementById('privacyAccountSummary').textContent = mensagemErro(erro);
      controlesConsentimento.forEach(controle => controle.disabled = true);
      mostrarToast({ tipo: 'erro', titulo: 'Privacidade indisponível', mensagem: mensagemErro(erro) });
    }
  }

  controlesConsentimento.forEach(controle => {
    controle.disabled = true;
    controle.addEventListener('change', async () => {
      const valorAnterior = !controle.checked;
      controle.disabled = true;
      statusConsentimento.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando sua escolha...';
      try {
        await requisitarApi('/privacidade/consentimentos', {
          method: 'PATCH', headers: cabecalhos(),
          body: JSON.stringify({ [controle.dataset.privacyConsent]: controle.checked })
        });
        statusConsentimento.innerHTML = '<i class="fa-solid fa-circle-check"></i> Escolha salva na sua conta.';
      } catch (erro) {
        controle.checked = valorAnterior;
        statusConsentimento.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Não foi possível salvar agora.';
        mostrarToast({ tipo: 'erro', titulo: 'Escolha não salva', mensagem: mensagemErro(erro) });
      } finally {
        controle.disabled = false;
      }
    });
  });

  document.getElementById('privacyDownloadButton')?.addEventListener('click', async (evento) => {
    const botao = evento.currentTarget;
    definirCarregamentoBotao(botao, true);
    try {
      const resposta = await fetch(`${API_BASE_URL}/privacidade/dados/download`, { headers: cabecalhos() });
      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(erro.detail || 'Não foi possível preparar o arquivo.');
      }
      const arquivo = await resposta.blob();
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vivo-adaptai-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      mostrarToast({ tipo: 'sucesso', titulo: 'Download iniciado', mensagem: 'Seu arquivo de dados foi preparado com segurança.' });
    } catch (erro) {
      mostrarToast({ tipo: 'erro', titulo: 'Download não realizado', mensagem: mensagemErro(erro) });
    } finally {
      definirCarregamentoBotao(botao, false);
    }
  });

  document.querySelectorAll('[data-open-privacy-dialog]').forEach(botao => {
    botao.addEventListener('click', () => abrirDialogoPrivacidade(document.getElementById(botao.dataset.openPrivacyDialog)));
  });
  document.querySelectorAll('[data-close-privacy-dialog]').forEach(botao => {
    botao.addEventListener('click', () => fecharDialogoPrivacidade(botao.closest('dialog')));
  });
  document.querySelectorAll('.privacidade-dialogo').forEach(dialogo => {
    dialogo.addEventListener('click', evento => { if (evento.target === dialogo) fecharDialogoPrivacidade(dialogo); });
  });

  document.getElementById('privacyClearHistoryForm')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const botao = document.getElementById('privacyClearHistoryConfirm');
    definirCarregamentoBotao(botao, true);
    try {
      const resultado = await requisitarApi('/privacidade/historico', {
        method: 'DELETE', headers: cabecalhos(),
        body: JSON.stringify({ confirmacao: document.getElementById('privacyClearHistoryConfirmation').value })
      });
      fecharDialogoPrivacidade(document.getElementById('privacyClearHistoryDialog'));
      evento.currentTarget.reset();
      mostrarToast({ tipo: 'sucesso', titulo: 'Histórico apagado', mensagem: resultado.mensagem });
      await carregarResumo();
    } catch (erro) {
      mostrarToast({ tipo: 'erro', titulo: 'Histórico não apagado', mensagem: mensagemErro(erro) });
    } finally {
      definirCarregamentoBotao(botao, false);
    }
  });

  document.getElementById('privacySessionsConfirm')?.addEventListener('click', async (evento) => {
    const botao = evento.currentTarget;
    definirCarregamentoBotao(botao, true);
    try {
      const resultado = await requisitarApi('/privacidade/sessoes/revogar', { method: 'POST', headers: cabecalhos() });
      fecharDialogoPrivacidade(document.getElementById('privacySessionsDialog'));
      encerrarSessaoLocalDepois(resultado.mensagem);
    } catch (erro) {
      mostrarToast({ tipo: 'erro', titulo: 'Sessões não revogadas', mensagem: mensagemErro(erro) });
      definirCarregamentoBotao(botao, false);
    }
  });

  document.getElementById('privacyDeleteAccountForm')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const botao = document.getElementById('privacyDeleteConfirm');
    definirCarregamentoBotao(botao, true);
    try {
      const resultado = await requisitarApi('/privacidade/conta', {
        method: 'DELETE', headers: cabecalhos(),
        body: JSON.stringify({
          senha: document.getElementById('privacyDeletePassword').value,
          confirmacao: document.getElementById('privacyDeleteConfirmation').value
        })
      });
      fecharDialogoPrivacidade(document.getElementById('privacyDeleteAccountDialog'));
      encerrarSessaoLocalDepois(resultado.mensagem);
    } catch (erro) {
      mostrarToast({ tipo: 'erro', titulo: 'Conta não excluída', mensagem: mensagemErro(erro) });
      definirCarregamentoBotao(botao, false);
    }
  });

  carregarResumo();
}

// Central de notificações: sino global e página completa, sempre vinculados
// à sessão autenticada pelo backend.
function inicializarNotificacoes() {
  const gatilho = document.getElementById('notificationsTrigger');
  const painel = document.getElementById('notificationsPanel');
  const listaPainel = document.getElementById('notificationsList');
  const vazioPainel = document.getElementById('notificationsEmpty');
  const resumoPainel = document.getElementById('notificationsSummary');
  const badge = document.getElementById('notificationsBadge');
  const lerTodasPainel = document.getElementById('notificationsReadAll');
  const listaPagina = document.getElementById('notificationsPageList');
  const vazioPagina = document.getElementById('notificationsPageEmpty');
  const resumoPagina = document.getElementById('notificationsPageSummary');
  const lerTodasPagina = document.getElementById('notificationsPageReadAll');
  const statusRealtime = document.getElementById('notificationsRealtimeStatus');
  const statusRealtimePagina = document.getElementById('notificationsRealtimePageStatus');
  const filtros = [...document.querySelectorAll('[data-notification-filter]')];
  if (!gatilho && !listaPagina) return;

  const token = sessionStorage.getItem(CHAVE_TOKEN_ACESSO);
  let notificacoes = [];
  let naoLidas = 0;
  let filtroAtual = 'todas';
  let clienteRealtime = null;
  let canalRealtime = null;

  const escapar = (valor = '') => String(valor).replace(/[&<>'"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[caractere]));
  const icones = {
    sistema: 'fa-wand-magic-sparkles', atendimento: 'fa-comments', seguranca: 'fa-shield-halved',
    novidade: 'fa-star', lembrete: 'fa-clock'
  };
  const formatarData = (valor) => {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
  };
  const linkSeguro = (link) => typeof link === 'string' && /^[a-z0-9-]+\.html(?:[?#].*)?$/i.test(link) ? link : '';

  const atualizarResumo = () => {
    const texto = naoLidas === 0 ? 'Nenhum aviso novo' : `${naoLidas} não lida${naoLidas === 1 ? '' : 's'}`;
    if (resumoPainel) resumoPainel.textContent = texto;
    if (resumoPagina) resumoPagina.textContent = notificacoes.length
      ? `${notificacoes.length} aviso${notificacoes.length === 1 ? '' : 's'} · ${texto}`
      : 'Você está em dia.';
    if (badge) {
      badge.hidden = naoLidas === 0;
      badge.textContent = naoLidas > 99 ? '99+' : String(naoLidas);
      badge.setAttribute('aria-label', `${naoLidas} notificações não lidas`);
    }
    if (gatilho) gatilho.setAttribute('aria-label', naoLidas ? `Notificações, ${texto}` : 'Notificações');
    if (lerTodasPainel) lerTodasPainel.disabled = naoLidas === 0;
    if (lerTodasPagina) lerTodasPagina.disabled = naoLidas === 0;
  };

  const itemHtml = (item, compacto = false) => {
    const destino = linkSeguro(item.link);
    return `<article class="item-notificacao ${item.lida ? '' : 'nao-lida'}" data-notification-id="${item.id}">
      <span class="icone-notificacao tipo-${escapar(item.tipo)}"><i class="fa-solid ${icones[item.tipo] || 'fa-bell'}"></i></span>
      <button type="button" class="conteudo-notificacao" data-notification-open="${item.id}"${destino ? ` data-notification-link="${escapar(destino)}"` : ''}>
        <span class="titulo-notificacao">${escapar(item.titulo)}</span>
        <span class="mensagem-notificacao">${escapar(item.mensagem)}</span>
        <time datetime="${escapar(item.criada_em)}">${escapar(formatarData(item.criada_em))}</time>
      </button>
      ${compacto ? '' : `<button type="button" class="arquivar-notificacao" data-notification-archive="${item.id}" aria-label="Arquivar ${escapar(item.titulo)}"><i class="fa-solid fa-box-archive"></i></button>`}
    </article>`;
  };

  const filtradas = () => notificacoes.filter((item) => {
    if (filtroAtual === 'nao_lidas') return !item.lida;
    if (['atendimento', 'seguranca'].includes(filtroAtual)) return item.tipo === filtroAtual;
    return true;
  });

  const renderizar = () => {
    const resumo = notificacoes.slice(0, 5);
    if (listaPainel) listaPainel.innerHTML = resumo.map((item) => itemHtml(item, true)).join('');
    if (vazioPainel) vazioPainel.hidden = resumo.length > 0;
    const itensPagina = filtradas();
    if (listaPagina) listaPagina.innerHTML = itensPagina.map((item) => itemHtml(item)).join('');
    if (vazioPagina) vazioPagina.hidden = itensPagina.length > 0;
    atualizarResumo();
  };

  const mostrarAcessoNecessario = () => {
    const html = '<div class="notificacoes-login"><i class="fa-solid fa-lock"></i><strong>Entre para ver seus avisos</strong><p>Suas notificações ficam protegidas na sua conta.</p><a class="botao botao-principal" href="entrar.html">Fazer login</a></div>';
    if (listaPainel) listaPainel.innerHTML = html;
    if (listaPagina) listaPagina.innerHTML = html;
    if (vazioPainel) vazioPainel.hidden = true;
    if (vazioPagina) vazioPagina.hidden = true;
    if (resumoPagina) resumoPagina.textContent = 'Faça login para continuar.';
    if (lerTodasPainel) lerTodasPainel.hidden = true;
    if (lerTodasPagina) lerTodasPagina.hidden = true;
    [statusRealtime, statusRealtimePagina].forEach((elemento) => { if (elemento) elemento.hidden = true; });
  };

  const definirStatusRealtime = (estado, texto) => {
    [statusRealtime, statusRealtimePagina].forEach((elemento) => {
      if (!elemento) return;
      elemento.hidden = false;
      elemento.className = `realtime-status estado-${estado}`;
      elemento.innerHTML = `<i></i> ${texto}`;
    });
  };

  const carregarBibliotecaRealtime = () => {
    if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
    if (globalThis.__vivoSupabaseCarregando) return globalThis.__vivoSupabaseCarregando;
    globalThis.__vivoSupabaseCarregando = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/dist/umd/supabase.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(globalThis.supabase);
      script.onerror = () => reject(new Error('Não foi possível carregar o canal em tempo real.'));
      document.head.appendChild(script);
    });
    return globalThis.__vivoSupabaseCarregando;
  };

  const carregar = async () => {
    if (!token) { mostrarAcessoNecessario(); return; }
    try {
      const dados = await requisitarApi('/notificacoes', { headers: obterCabecalhoAutorizado() });
      notificacoes = dados.notificacoes || [];
      naoLidas = Number(dados.nao_lidas || 0);
      renderizar();
    } catch (erro) {
      if (resumoPagina) resumoPagina.textContent = 'Não foi possível atualizar agora.';
      if (listaPagina) listaPagina.innerHTML = '<div class="notificacoes-erro"><i class="fa-solid fa-triangle-exclamation"></i><p>Não conseguimos carregar seus avisos.</p><button type="button" class="botao botao-contorno" data-notification-retry>Tentar novamente</button></div>';
      if (listaPainel) listaPainel.innerHTML = '<div class="notificacoes-erro"><p>Não foi possível carregar agora.</p></div>';
    }
  };

  const marcarLida = async (id) => {
    const item = notificacoes.find((notificacao) => notificacao.id === id);
    if (!item || item.lida) return;
    await requisitarApi(`/notificacoes/${id}/ler`, { method: 'PATCH', headers: obterCabecalhoAutorizado() });
    item.lida = true;
    naoLidas = Math.max(0, naoLidas - 1);
    renderizar();
  };

  const iniciarRealtime = async () => {
    if (!token) return;
    definirStatusRealtime('conectando', 'Conectando em tempo real...');
    try {
      const [configuracao, biblioteca] = await Promise.all([
        requisitarApi('/notificacoes/realtime/config', { headers: obterCabecalhoAutorizado() }),
        carregarBibliotecaRealtime(),
      ]);
      const refreshToken = sessionStorage.getItem(CHAVE_TOKEN_RENOVACAO);
      const usuarioSessao = JSON.parse(sessionStorage.getItem(CHAVE_USUARIO) || '{}');
      if (!refreshToken || !usuarioSessao.id) throw new Error('Sessão incompleta para atualização em tempo real.');
      clienteRealtime = biblioteca.createClient(
        configuracao.supabase_url,
        configuracao.supabase_publishable_key,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
      );
      const sessao = await clienteRealtime.auth.setSession({ access_token: token, refresh_token: refreshToken });
      if (sessao.error) throw sessao.error;
      await clienteRealtime.realtime.setAuth(token);
      canalRealtime = clienteRealtime
        .channel(`notificacoes:${usuarioSessao.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'notificacoes', filter: `auth_user_id=eq.${usuarioSessao.id}`,
        }, async (evento) => {
          await carregar();
          if (evento.eventType === 'INSERT' && evento.new?.titulo) {
            mostrarToast({
              tipo: 'info',
              titulo: evento.new.titulo,
              mensagem: evento.new.mensagem || 'Você recebeu uma nova notificação.',
              acaoTexto: 'Ver',
              aoAcionar: () => { window.location.href = linkSeguro(evento.new.link) || 'notificacoes.html'; },
            });
          }
        })
        .subscribe((estado) => {
          if (estado === 'SUBSCRIBED') definirStatusRealtime('online', 'Atualização em tempo real ativa');
          else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') definirStatusRealtime('fallback', 'Reconectando · atualização automática ativa');
          else if (estado === 'CLOSED') definirStatusRealtime('fallback', 'Canal pausado · atualização automática ativa');
        });
    } catch (falha) {
      definirStatusRealtime('fallback', 'Atualização automática ativa');
    }
  };
  const marcarTodas = async () => {
    if (!token || naoLidas === 0) return;
    await requisitarApi('/notificacoes/ler-todas', { method: 'PATCH', headers: obterCabecalhoAutorizado() });
    notificacoes.forEach((item) => { item.lida = true; });
    naoLidas = 0;
    renderizar();
  };

  gatilho?.addEventListener('click', (evento) => {
    evento.stopPropagation();
    const abrir = painel?.hidden !== false;
    if (painel) painel.hidden = !abrir;
    gatilho.setAttribute('aria-expanded', String(abrir));
  });
  document.addEventListener('click', (evento) => {
    if (painel && !painel.hidden && !painel.contains(evento.target) && !gatilho?.contains(evento.target)) {
      painel.hidden = true;
      gatilho?.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && painel && !painel.hidden) {
      painel.hidden = true;
      gatilho?.setAttribute('aria-expanded', 'false');
      gatilho?.focus();
    }
  });
  document.addEventListener('click', async (evento) => {
    const abrir = evento.target.closest('[data-notification-open]');
    const arquivar = evento.target.closest('[data-notification-archive]');
    const tentar = evento.target.closest('[data-notification-retry]');
    if (tentar) { await carregar(); return; }
    if (abrir) {
      const id = Number(abrir.dataset.notificationOpen);
      try { await marcarLida(id); } catch (_) { /* A navegação continua mesmo sem sincronizar. */ }
      const destino = linkSeguro(abrir.dataset.notificationLink);
      if (destino) window.location.href = destino;
    }
    if (arquivar) {
      const id = Number(arquivar.dataset.notificationArchive);
      try {
        await requisitarApi(`/notificacoes/${id}`, { method: 'DELETE', headers: obterCabecalhoAutorizado() });
        const item = notificacoes.find((notificacao) => notificacao.id === id);
        if (item && !item.lida) naoLidas = Math.max(0, naoLidas - 1);
        notificacoes = notificacoes.filter((notificacao) => notificacao.id !== id);
        renderizar();
      } catch (erro) {
        mostrarToast({ tipo: 'erro', titulo: 'Não foi possível arquivar', mensagem: mensagemErroAutenticacao(erro) });
      }
    }
  });
  lerTodasPainel?.addEventListener('click', () => marcarTodas().catch(() => {}));
  lerTodasPagina?.addEventListener('click', () => marcarTodas().catch((erro) => mostrarToast({ tipo: 'erro', titulo: 'Não foi possível atualizar', mensagem: mensagemErroAutenticacao(erro) })));
  filtros.forEach((botao) => botao.addEventListener('click', () => {
    filtroAtual = botao.dataset.notificationFilter;
    filtros.forEach((outro) => outro.classList.toggle('esta-ativo', outro === botao));
    renderizar();
  }));

  carregar();
  iniciarRealtime();
  if (token) {
    window.addEventListener('focus', carregar);
    window.setInterval(() => { if (!document.hidden) carregar(); }, 60000);
    window.addEventListener('beforeunload', () => {
      if (clienteRealtime && canalRealtime) clienteRealtime.removeChannel(canalRealtime);
    });
  }
}

// Inicializa a interface depois que os componentes reutilizáveis já foram
// inseridos no documento. O teste de estado também cobre páginas carregadas
// dinamicamente ou por navegação de volta do navegador.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarAplicacao, { once: true });
} else {
  inicializarAplicacao();
}
