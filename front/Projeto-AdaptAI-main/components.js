class AppHeader extends HTMLElement {
  connectedCallback() {
    const isAppPage = this.hasAttribute('app-page');
    const userName = this.getAttribute('user-name') || 'Arthur';
    const userInitial = this.getAttribute('user-initial') || userName.charAt(0).toUpperCase();
    const isFuncionario = sessionStorage.getItem('vivo-adaptai-perfil') === 'funcionario';
    
    this.innerHTML = `
      <header class="cabecalho">
        <div class="cabecalho-conteudo">
          <div class="logotipo">Vivo AdaptAI</div>
          <div class="acoes-cabecalho">
            <nav>
              <ul class="lista-navegacao">
                <li class="item-navegacao"><i class="fa-solid fa-universal-access"></i><a href="acessibilidade.html">Acessibilidade</a></li>
                <li class="item-navegacao">
                  <button id="btnAlternarTema" onclick="alternarTema()" aria-label="Mudar para tema escuro" style="background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;font-family:inherit;font-size:inherit;color:inherit;padding:0;">
                    <i class="fa-solid fa-moon"></i><span>Tema escuro</span>
                  </button>
                </li>
                <li class="item-navegacao"><i class="fa-solid fa-circle-question"></i><a href="central-de-ajuda.html">Ajuda</a></li>
                ${isAppPage ? `
                <li class="item-navegacao">
                  <i class="fa-solid fa-bars"></i>
                  <a href="#" id="sidebarToggleBtn" aria-controls="appSidebar" aria-expanded="false">Menu</a>
                </li>` : ''}
              </ul>
            </nav>

            ${isAppPage ? `
            <button class="botao-icone" id="notificationsTrigger" aria-label="Notificações" aria-haspopup="dialog" aria-expanded="false" aria-controls="notificationsPanel">
              <i class="fa-regular fa-bell"></i>
              <span class="contador-notificacoes" id="notificationsBadge" aria-label="0 notificações não lidas" hidden>0</span>
            </button>

            <section class="painel-notificacoes" id="notificationsPanel" role="dialog" aria-label="Notificações" hidden>
              <header class="painel-notificacoes-cabecalho">
                <div><strong>Notificações</strong><small id="notificationsSummary">Nenhum aviso novo</small><span class="realtime-status" id="notificationsRealtimeStatus"><i></i> Conectando...</span></div>
                <button type="button" class="acao-texto-notificacoes" id="notificationsReadAll">Marcar todas como lidas</button>
              </header>
              <div class="lista-notificacoes lista-notificacoes-resumida" id="notificationsList" aria-live="polite"></div>
              <div class="notificacoes-vazio" id="notificationsEmpty" hidden>
                <i class="fa-regular fa-bell-slash"></i><p>Você está em dia!</p><small>Os novos avisos aparecerão aqui.</small>
              </div>
              <a class="painel-notificacoes-rodape" href="notificacoes.html">Ver todas as notificações <i class="fa-solid fa-arrow-right"></i></a>
            </section>

            <div class="menu-perfil">
              <button class="gatilho-perfil" id="profileMenuTrigger" aria-haspopup="true" aria-expanded="false">
                <span class="avatar-perfil">${userInitial}</span>
                <span class="nome-perfil">${userName}</span>
                <i class="fa-solid fa-chevron-down"></i>
              </button>

              <div class="painel-perfil" id="profileMenuPanel" role="menu">
                <a href="perfil.html" class="item-perfil" role="menuitem"><i class="fa-regular fa-user"></i> Meu perfil</a>
                <a href="resumo-atendimento.html" class="item-perfil" role="menuitem"><i class="fa-regular fa-file-lines"></i> Histórico e resumo</a>
                <a href="sobre-adapt-ai.html" class="item-perfil" role="menuitem"><i class="fa-solid fa-circle-info"></i> Sobre o AdaptAI</a>
                <a href="central-de-ajuda.html" class="item-perfil" role="menuitem"><i class="fa-solid fa-circle-question"></i> Central de ajuda</a>
                <div class="divisor-perfil"></div>
                <a href="configuracoes.html" class="item-perfil" role="menuitem"><i class="fa-solid fa-gear"></i> Configurações</a>
                <a href="privacidade.html" class="item-perfil" role="menuitem"><i class="fa-solid fa-shield-halved"></i> Privacidade e dados</a>
                <div class="divisor-perfil"></div>
                <a href="#" class="item-perfil item-perfil-perigo" role="menuitem" id="logoutLink"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sair da conta</a>
              </div>
            </div>` : ''}
          </div>
        </div>
      </header>
    `;
  }
}

class AppSidebar extends HTMLElement {
  connectedCallback() {
    const activePage = this.getAttribute('active-page');
    const isFuncionario = sessionStorage.getItem('vivo-adaptai-perfil') === 'funcionario';
    const isHome = activePage === 'home';
    
    this.innerHTML = `
      <aside class="barra-lateral" id="appSidebar">
        <div class="cabecalho-menu-mobile">
          <span>Navegação</span>
          <button type="button" id="sidebarMobileClose" aria-label="Fechar menu">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        ${isHome ? `<a href="home.html" class="marca-lateral-home" aria-label="Vivo AdaptAI, início"><img src="Imagens/vivo.svg" alt="Vivo"><span>AdaptAI</span></a>` : ''}
        <nav class="navegacao-lateral">
          <a href="home.html" class="link-lateral ${activePage === 'home' ? 'esta-ativo' : ''}"><i class="fa-solid fa-house"></i> Início</a>
          <a href="atendimento-texto.html" class="link-lateral ${activePage === 'atendimento' || activePage === 'texto-simplificado' || activePage === 'offline' ? 'esta-ativo' : ''}"><i class="fa-solid fa-comment-dots"></i> Novo atendimento</a>
          <a href="historico.html" class="link-lateral ${activePage === 'historico' ? 'esta-ativo' : ''}"><i class="fa-regular fa-clock"></i> Histórico</a>
          <a href="perfil.html" class="link-lateral ${activePage === 'perfil' ? 'esta-ativo' : ''}"><i class="fa-regular fa-user"></i> Meu perfil</a>
          ${isFuncionario ? `<a href="dashboard.html" class="link-lateral ${activePage === 'dashboard' ? 'esta-ativo' : ''}"><i class="fa-solid fa-chart-simple"></i> Dashboard da operação</a>` : ''}

          <div class="divisor-lateral"></div>

          ${isHome ? `<a href="sobre-adapt-ai.html" class="link-lateral"><i class="fa-solid fa-robot"></i> Conheça o Mimo</a>` : ''}
          <a href="configuracoes.html" class="link-lateral ${activePage === 'configuracoes' ? 'esta-ativo' : ''}"><i class="fa-solid fa-gear"></i> Configurações</a>
          <a href="permissoes.html" class="link-lateral ${activePage === 'permissoes' ? 'esta-ativo' : ''}"><i class="fa-solid fa-lock"></i> Permissões</a>
          <a href="privacidade.html" class="link-lateral ${activePage === 'privacidade' ? 'esta-ativo' : ''}"><i class="fa-solid fa-shield-halved"></i> Privacidade e dados</a>
          <a href="acessibilidade.html" class="link-lateral ${activePage === 'acessibilidade' ? 'esta-ativo' : ''}"><i class="fa-solid fa-universal-access"></i> Acessibilidade</a>
          <a href="central-de-ajuda.html" class="link-lateral ${activePage === 'central-de-ajuda' || activePage === 'sobre-adapt-ai' ? 'esta-ativo' : ''}"><i class="fa-solid fa-circle-question"></i> Central de ajuda</a>
        </nav>

        <div class="ajuda-lateral">
          <img src="Imagens/Mimo-Oi.png" alt="Mimo, assistente do Vivo AdaptAI">
          <p class="titulo-ajuda-lateral">Precisa de ajuda?</p>
          <p class="texto-ajuda-lateral">Converse com o Mimo e receba suporte sempre que precisar.</p>
          <a href="atendimento-texto.html" class="botao botao-contorno botao-ajuda-lateral">
            <i class="fa-solid fa-comment-dots"></i> Conversar com o Mimo
          </a>
        </div>
      </aside>
    `;
  }
}

customElements.define('app-header', AppHeader);
customElements.define('app-sidebar', AppSidebar);

// Nota: a sincronização visual do botão de tema (claro/escuro) é feita por
// inicializarTema() / sincronizarBotaoTema() em script.js, que roda depois
// deste arquivo e já cobre o botão renderizado por AppHeader — não é
// necessário duplicar essa lógica aqui.
