const app = document.querySelector(".app");
const viewButtons = document.querySelectorAll("[data-view]");
const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll(".nav button");
const themeToggle = document.querySelector("#themeToggle");
const accessibilityQuick = document.querySelector("#accessibilityQuick");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const conversation = document.querySelector("#conversation");
const warmupBtn = document.querySelector("#warmupBtn");
const finishChat = document.querySelector("#finishChat");
const skipMode = document.querySelector("#skipMode");
const chatMimo = document.querySelector("#chatMimo");
const modeButtons = document.querySelectorAll(".mode");
const stateButtons = document.querySelectorAll("[data-mimo]");
const mimoShowcase = document.querySelector("#mimoShowcase");
const largeText = document.querySelector("#largeText");
const contrastToggle = document.querySelector("#contrastToggle");
const reduceMotion = document.querySelector("#reduceMotion");
const helpButton = document.querySelector("#helpButton");
const helpDrawer = document.querySelector("#helpDrawer");
const helpClose = document.querySelector("#helpClose");
const loginOpen = document.querySelector("#loginOpen");
const loginModal = document.querySelector("#loginModal");
const loginClose = document.querySelector("#loginClose");
const loginForm = document.querySelector("#loginForm");
const historyList = document.querySelector("#historyList");
const summaryTitle = document.querySelector("#summaryTitle");
const summaryText = document.querySelector("#summaryText");
const barChart = document.querySelector("#barChart");
const dashboardFilter = document.querySelector("#dashboardFilter");
const toastRegion = document.querySelector("#toastRegion");

const mimoAssets = {
  welcome: "./assets/drive-designs/aparencia-mimo.png",
  neutral: "./assets/drive-designs/aparencia-mimo.png",
  listening: "./assets/drive-designs/aparencia-mimo.png",
  processing: "./assets/drive-designs/aparencia-mimo.png",
  responding: "./assets/drive-designs/aparencia-mimo.png",
  done: "./assets/drive-designs/aparencia-mimo.png",
  error: "./assets/drive-designs/aparencia-mimo.png",
};

const state = {
  mode: "texto",
  messages: [
    {
      title: "Primeiro atendimento",
      mode: "Texto",
      status: "Em andamento",
      summary: "O atendimento foi iniciado em modo texto com fallback local disponível.",
    },
    {
      title: "Conta e consumo",
      mode: "Texto simplificado",
      status: "Concluído",
      summary: "Resumo simulado com explicação em etapas sobre leitura de conta.",
    },
    {
      title: "Acessibilidade",
      mode: "Libras",
      status: "Salvo",
      summary: "Preferências de legenda, Libras e fonte maior registradas em modo demo.",
    },
  ],
};

const modeReplies = {
  texto: "Perfeito. Vou responder por texto, com etapas claras e objetivas.",
  voz: "Modo voz ativado. Posso transcrever a conversa e manter legendas durante todo o atendimento.",
  simples: "Texto simplificado ativado. Vou explicar uma coisa por vez, com frases curtas.",
  libras: "Libras ativado. Vou manter legenda e reservar uma área visual para orientação.",
  adaptavel: "Modo adaptável ativado. Vou sugerir o melhor formato conforme sua necessidade.",
};

const modeLabels = {
  texto: "Texto",
  voz: "Voz",
  simples: "Texto simplificado",
  libras: "Libras",
  adaptavel: "Adaptável",
};

const replyRules = [
  {
    test: /internet|conex|wi-?fi|sinal|modem/i,
    reply:
      "Vamos resolver por etapas. Primeiro, confira se o modem está ligado e se as luzes de internet e Wi-Fi estão acesas. Se alguma estiver apagada, eu te mostro o próximo passo.",
    title: "Internet sem conexão",
  },
  {
    test: /conta|boleto|fatura|valor|cobran/i,
    reply:
      "Eu posso explicar sua conta em linguagem simples. Na demo, vou separar valor, vencimento, consumo e possíveis cobranças em blocos curtos.",
    title: "Explicação de conta",
  },
  {
    test: /plano|pacote|benef/i,
    reply:
      "Vou comparar opções com clareza: preço, internet, benefícios e observações importantes. Nada de letras miúdas escondidas.",
    title: "Consulta de planos",
  },
  {
    test: /libras|acess|legenda|fonte|contraste|voz/i,
    reply:
      "Recursos de acessibilidade disponíveis: fonte maior, alto contraste, legenda, Libras, leitura em voz alta e redução de movimento.",
    title: "Preferências de acessibilidade",
  },
];

const chartData = {
  day: [
    ["Texto", 68],
    ["Voz", 42],
    ["Simpl.", 55],
    ["Libras", 31],
    ["Adapt.", 49],
  ],
  week: [
    ["Texto", 78],
    ["Voz", 52],
    ["Simpl.", 63],
    ["Libras", 39],
    ["Adapt.", 58],
  ],
  month: [
    ["Texto", 82],
    ["Voz", 61],
    ["Simpl.", 68],
    ["Libras", 44],
    ["Adapt.", 64],
  ],
};

function setView(name) {
  views.forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  window.scrollTo({ top: 0, behavior: app.classList.contains("reduce-motion") ? "auto" : "smooth" });
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  toastRegion.appendChild(element);
  window.setTimeout(() => element.remove(), 3200);
}

function addMessage(text, type = "mimo") {
  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.innerHTML = type === "mimo" ? `<span>Mimo</span><p>${escapeHtml(text)}</p>` : `<p>${escapeHtml(text)}</p>`;
  conversation.appendChild(message);
  conversation.scrollTop = conversation.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMode(mode, announce = true) {
  state.mode = mode;
  modeButtons.forEach((item) => item.classList.toggle("active", item.dataset.mode === mode));
  chatMimo.src = mimoAssets.responding;
  if (announce) {
    addMessage(modeReplies[mode] || modeReplies.texto);
  }
  updateSummary(`Atendimento por ${modeLabels[mode] || "Texto"}`, modeReplies[mode] || modeReplies.texto);
}

function updateSummary(title, text) {
  summaryTitle.textContent = title;
  summaryText.textContent = text;
}

function pushHistory(title, summary, status = "Em andamento") {
  state.messages.unshift({
    title,
    mode: modeLabels[state.mode] || "Texto",
    status,
    summary,
  });
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = state.messages
    .map(
      (item) => `
        <article>
          <strong>${escapeHtml(item.title)} <small>${escapeHtml(item.status)}</small></strong>
          <p>${escapeHtml(item.summary)}</p>
          <small>Modalidade: ${escapeHtml(item.mode)}</small>
        </article>
      `,
    )
    .join("");
}

function getReply(text) {
  const match = replyRules.find((rule) => rule.test.test(text));
  if (match) return match;
  return {
    title: "Atendimento adaptável",
    reply:
      "Entendi. Vou tratar isso em modo demo, preservar sua mensagem e indicar o próximo passo com clareza. Se algum serviço externo falhar, continuo com fallback local.",
  };
}

function renderChart(period = "week") {
  barChart.innerHTML = chartData[period]
    .map(([label, value]) => `<span data-label="${label}" style="height: ${value}%"></span>`)
    .join("");
}

function openHelp() {
  helpDrawer.classList.add("open");
  helpDrawer.setAttribute("aria-hidden", "false");
}

function closeHelp() {
  helpDrawer.classList.remove("open");
  helpDrawer.setAttribute("aria-hidden", "true");
}

function openLogin() {
  loginModal.classList.add("open");
  loginModal.setAttribute("aria-hidden", "false");
}

function closeLogin() {
  loginModal.classList.remove("open");
  loginModal.setAttribute("aria-hidden", "true");
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.view;
    const startMode = button.dataset.startMode;
    if (name) setView(name);
    if (startMode) {
      window.setTimeout(() => setMode(startMode), 120);
    }
  });
});

themeToggle.addEventListener("click", () => {
  const next = app.dataset.theme === "dark" ? "light" : "dark";
  app.dataset.theme = next;
  themeToggle.textContent = next === "dark" ? "Claro" : "Tema";
  toast(next === "dark" ? "Tema escuro ativado." : "Tema claro ativado.");
});

accessibilityQuick.addEventListener("click", () => setView("accessibility"));

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

skipMode.addEventListener("click", () => {
  setMode("adaptavel");
  toast("Você pode continuar sem definir preferência.");
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) {
    toast("Digite uma mensagem para iniciar o atendimento.");
    return;
  }

  addMessage(text, "user");
  messageInput.value = "";
  chatMimo.src = mimoAssets.processing;

  window.setTimeout(() => {
    const response = getReply(text);
    chatMimo.src = mimoAssets.responding;
    addMessage(response.reply);
    updateSummary(response.title, response.reply);
    pushHistory(response.title, response.reply);
  }, 650);
});

document.querySelectorAll(".quick-actions button").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.textContent.trim();
    messageInput.focus();
  });
});

warmupBtn.addEventListener("click", () => {
  chatMimo.src = mimoAssets.processing;
  toast("Verificando API, fallback local e modo demo...");
  window.setTimeout(() => {
    chatMimo.src = mimoAssets.done;
    toast("Sistema pronto. Se a API oscilar, o fallback local mantém a demo funcionando.");
  }, 1000);
});

finishChat.addEventListener("click", () => {
  chatMimo.src = mimoAssets.done;
  addMessage("Tudo certo! Seu atendimento foi concluído. A avaliação é opcional.");
  updateSummary("Atendimento concluído", "Resumo salvo em modo demo com assunto, modalidade, solução e próximos passos.");
  pushHistory("Atendimento concluído", "Resumo salvo em modo demo com assunto, modalidade, solução e próximos passos.", "Concluído");
  setView("history");
});

stateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    stateButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    mimoShowcase.src = mimoAssets[button.dataset.mimo];
  });
});

largeText.addEventListener("change", () => {
  app.classList.toggle("large-text", largeText.checked);
  toast(largeText.checked ? "Fonte maior ativada." : "Fonte padrão restaurada.");
});

contrastToggle.addEventListener("change", () => {
  app.classList.toggle("high-contrast", contrastToggle.checked);
  toast(contrastToggle.checked ? "Alto contraste ativado." : "Contraste padrão restaurado.");
});

reduceMotion.addEventListener("change", () => {
  app.classList.toggle("reduce-motion", reduceMotion.checked);
  toast(reduceMotion.checked ? "Movimento reduzido ativado." : "Movimento padrão restaurado.");
});

helpButton.addEventListener("click", openHelp);
helpClose.addEventListener("click", closeHelp);
helpDrawer.addEventListener("click", (event) => {
  if (event.target === helpDrawer) closeHelp();
});

document.querySelectorAll("[data-help-message]").forEach((button) => {
  button.addEventListener("click", () => {
    closeHelp();
    setView("chat");
    messageInput.value = button.dataset.helpMessage;
    messageInput.focus();
  });
});

loginOpen.addEventListener("click", openLogin);
loginClose.addEventListener("click", closeLogin);
loginModal.addEventListener("click", (event) => {
  if (event.target === loginModal) closeLogin();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  closeLogin();
  toast("Login opcional simulado. Preferências preservadas nesta demo.");
});

dashboardFilter.addEventListener("change", () => renderChart(dashboardFilter.value));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeHelp();
    closeLogin();
  }
});

renderHistory();
renderChart();

window.setTimeout(() => {
  toast("Vivo AdaptAI carregado com dados simulados e fallback local.");
}, 700);
