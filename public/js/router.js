const router = (() => {
  const _history = [];

  const routes = {
    splash:             () => auth.renderSplash(),
    home:               () => homeScreen.render(),
    'home-clt':         () => homeScreenCLT.render(),
    slot:               () => slotScreen.render(),
    // Operação — cada sub-estado tem rota própria
    checkin:            () => operacao.renderCheckin(),
    'em-atividade':     () => operacao.renderAtivo(),
    pausa:              () => operacao.renderPausa(),
    pausado:            () => operacao.renderPausado(),
    resume:             () => operacao.renderPausado(), // compat
    checkout:           () => operacao.renderCheckout(),
    encerrado:          () => operacao.renderEncerrado(),
    operacao:           () => operacao.renderPorStatus(), // dispatch automático
    // Solicitações
    'solicitacoes-nova':  () => solicitacoes.renderNova(),
    'solicitacoes-lista': () => solicitacoes.renderLista(),
    'sol-realocacao':     () => solicitacoes.renderRealocacao(),
    'sol-reforco':        () => solicitacoes.renderReforco(),
    'sol-bateria':        () => solicitacoes.renderBateria(),
    'sol-ocorrencia':     () => solicitacoes.renderOcorrencia(),
    // Outros
    vendas:             () => vendas.render(),
    mapa:               () => mapa.render(),
    historico:          () => historico.render(),
    ranking:            () => ranking.render(),
    calculadora:        () => calculadora.render(),
    academy:            () => academy.render(),
    // CLT
    'turno-ativo':      () => turnoCLT.render(),
    'historico-clt':    () => historicoCLT.render(),
  };

  return {
    go(screen, pushHistory = true) {
      // Interceptação CLT (Fase 8)
      const user = state.get('promotor');
      if (user && user.eh_clt) {
        if (screen === 'home') screen = 'home-clt';
        if (screen === 'historico') screen = 'historico-clt';
      }

      // Limpar listeners de GPS/timer da tela anterior
      const gpsUnsub   = state.get('_gpsUnsub');
      const timerUnsub = state.get('_timerUnsub');
      if (typeof gpsUnsub   === 'function') { gpsUnsub();   state.set('_gpsUnsub', null); }
      if (typeof timerUnsub === 'function') { timerUnsub(); state.set('_timerUnsub', null); }

      const fn = routes[screen];
      if (!fn) { console.warn('Rota não encontrada:', screen); return; }
      
      state.set('currentScreen', screen);
      
      if (pushHistory) {
        history.pushState({ screen }, '', '#' + screen);
      }

      fn();
      window.scrollTo(0, 0);
    },
    back() {
      window.history.back();
    },
    replace(screen) {
      state.set('currentScreen', screen);
      history.replaceState({ screen }, '', '#' + screen);
      const fn = routes[screen];
      if (fn) fn();
    }
  };
})();

// ── Navegação nativa (botão voltar do celular) ───────────────────────────────
window.addEventListener('popstate', (e) => {
  const screen = e.state?.screen || 'home';
  router.go(screen, false);
});

window.addEventListener('load', () => {
  // ── PWA: captura prompt de instalação ────────────────────────────────────
  window.__pwaPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__pwaPrompt = e;
    console.log('[PWA] beforeinstallprompt capturado');
    // Mostra botão se a tela de login estiver visível
    var wrap = document.getElementById('pwa-install-wrap');
    if (wrap) wrap.style.display = 'block';
  });

  // ── iOS: detecta Safari sem beforeinstallprompt ───────────────────────
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    // Mostra instrução iOS assim que a tela de login renderizar
    setTimeout(() => {
      var wrap = document.getElementById('pwa-ios-wrap');
      if (wrap) wrap.style.display = 'block';
    }, 500);
  }

  // ── Service Worker (Sessão 4) ──────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    const swPath = '/sw.js';
    navigator.serviceWorker.register(swPath, { updateViaCache: 'none', scope: '/' })
      .then((reg) => {
        window.__swReg = reg;
        reg.addEventListener('updatefound', () => {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              _mostrarBannerAtualizacao(reg);
            }
          });
        });
      })
      .catch(() => {});
  }
  ui.initNetworkListeners();
  auth.init();
});
