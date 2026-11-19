(function () {
  'use strict';

  const GAMES = Array.isArray(window.MUNDO_GAMES) ? window.MUNDO_GAMES : [];

  const el = {
    homeView: document.getElementById('home-view'),
    gamesGrid: document.getElementById('games-grid'),
    gamesCountPill: document.getElementById('games-count-pill'),

    stageView: document.getElementById('stage-view'),
    stageGameTitle: document.getElementById('stage-game-title'),
    stageEditions: document.getElementById('stage-editions'),
    stageQuickSwitch: document.getElementById('stage-quick-switch'),
    stageLoader: document.getElementById('stage-loader'),
    stageFileWarning: document.getElementById('stage-file-warning'),
    gameIframe: document.getElementById('game-iframe'),

    btnBackHome: document.getElementById('btn-back-home'),
    btnWarningBack: document.getElementById('btn-warning-back'),
    btnToggleRules: document.getElementById('btn-toggle-rules'),
    btnCloseRules: document.getElementById('btn-close-rules'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    fullscreenLabel: document.getElementById('fullscreen-label'),
    btnReloadGame: document.getElementById('btn-reload-game'),
    btnOpenExternal: document.getElementById('btn-open-external'),

    rulesBackdrop: document.getElementById('rules-backdrop'),
    rulesDrawer: document.getElementById('rules-drawer'),
    rulesGameName: document.getElementById('rules-game-name'),
    rulesGameAuthors: document.getElementById('rules-game-authors'),
    rulesBody: document.getElementById('rules-body'),
    rulesPdfLink: document.getElementById('rules-pdf-link')
  };

  let activeGame = null;
  let activeEdition = null;
  let activeRoomCode = '';
  let rulesOpen = false;
  let pseudoFullscreen = false;
  let defaultTitle = document.title;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderCoverMarkup(game) {
    const cover = game.cover || {};
    if (cover.type === 'collage') {
      const cards = cover.cards || [];
      const tokens = cover.tokens || [];
      return `
        <div class="art-stage art-stage--collage">
          <span class="art-badge">${escapeHtml(game.highlight || 'Jogo de Cartas')}</span>
          <div class="collage-fan" aria-hidden="true">
            ${cards[0] ? `<img src="${escapeHtml(cards[0])}" alt="" class="collage-card collage-card--left" loading="lazy" />` : ''}
            ${cards[1] ? `<img src="${escapeHtml(cards[1])}" alt="" class="collage-card collage-card--center" loading="lazy" />` : ''}
            ${cards[2] ? `<img src="${escapeHtml(cards[2])}" alt="" class="collage-card collage-card--right" loading="lazy" />` : ''}
            ${tokens[0] ? `<img src="${escapeHtml(tokens[0])}" alt="" class="collage-token collage-token--0" loading="lazy" />` : ''}
            ${tokens[1] ? `<img src="${escapeHtml(tokens[1])}" alt="" class="collage-token collage-token--2" loading="lazy" />` : ''}
            ${tokens[2] ? `<img src="${escapeHtml(tokens[2])}" alt="" class="collage-token collage-token--5" loading="lazy" />` : ''}
          </div>
          <span class="art-play-hint">▶ Abrir mesa</span>
        </div>
      `;
    }

    if (cover.type === 'product') {
      return `
        <div class="art-stage art-stage--product">
          <span class="art-badge">${escapeHtml(game.highlight || 'Jogo de Tabuleiro')}</span>
          <img
            src="${escapeHtml(cover.src || '')}"
            alt="${escapeHtml(cover.alt || game.title)}"
            class="art-product-img"
            loading="lazy"
          />
          <span class="art-play-hint">▶ Abrir mesa</span>
        </div>
      `;
    }

    return `
      <div class="art-stage art-stage--box">
        <span class="art-badge">${escapeHtml(game.highlight || 'Jogo de Tabuleiro')}</span>
        <img
          src="${escapeHtml(cover.src || '')}"
          alt="${escapeHtml(cover.alt || game.title)}"
          class="art-box-img"
          loading="lazy"
        />
        <span class="art-play-hint">▶ Abrir mesa</span>
      </div>
    `;
  }

  function renderCatalog() {
    if (!el.gamesGrid) return;

    if (el.gamesCountPill) {
      el.gamesCountPill.textContent =
        GAMES.length === 1 ? '1 jogo disponível' : `${GAMES.length} jogos disponíveis`;
    }

    el.gamesGrid.innerHTML = GAMES.map((game) => {
      const tagsHtml = (game.tags || [])
        .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
        .join('');

      const editionsHint =
        game.editions && game.editions.length > 1
          ? `<div class="game-card__editions-hint">Versões incluídas: ${game.editions
              .map((ed) => escapeHtml(ed.label))
              .join(' · ')}</div>`
          : '';

      return `
        <article class="game-card" data-game-id="${escapeHtml(game.id)}">
          <button
            type="button"
            class="game-card__art-btn"
            data-action="play"
            data-game="${escapeHtml(game.id)}"
            aria-label="Jogar ${escapeHtml(game.title)}"
          >
            ${renderCoverMarkup(game)}
          </button>

          <div class="game-card__body">
            <div class="game-card__tags">${tagsHtml}</div>
            <h3 class="game-card__title">${escapeHtml(game.title)}</h3>
            <p class="game-card__tagline">${escapeHtml(game.tagline)}</p>
            <p class="game-card__desc">${escapeHtml(game.description)}</p>

            <div class="game-card__meta">
              <span class="meta-item" title="Número de jogadores">👥 ${escapeHtml(game.players)}</span>
              <span class="meta-item" title="Duração média">⏱ ${escapeHtml(game.duration)}</span>
              <span class="meta-item" title="Idade recomendada">🎲 ${escapeHtml(game.age)}</span>
            </div>

            <div class="game-card__actions">
              <button
                type="button"
                class="btn btn--primary btn--grow"
                data-action="play"
                data-game="${escapeHtml(game.id)}"
              >
                <span aria-hidden="true">▶</span>
                <span>Jogar Agora</span>
              </button>
              <button
                type="button"
                class="btn btn--secondary"
                data-action="rules"
                data-game="${escapeHtml(game.id)}"
              >
                <span aria-hidden="true">📖</span>
                <span>Regras</span>
              </button>
            </div>
            ${editionsHint}
          </div>
        </article>
      `;
    }).join('');
  }

  function buildGameUrl(edition, roomCode) {
    if (!edition || !edition.url) return 'about:blank';
    if (!roomCode) return edition.url;
    const sep = edition.url.includes('?') ? '&' : '?';
    return `${edition.url}${sep}sala=${encodeURIComponent(roomCode)}`;
  }

  function renderEditionSwitcher(game, currentEdition) {
    if (!game.editions || game.editions.length <= 1) {
      el.stageEditions.classList.add('hidden');
      el.stageEditions.innerHTML = '';
      return;
    }

    el.stageEditions.classList.remove('hidden');
    el.stageEditions.innerHTML = game.editions
      .map(
        (ed) => `
          <button
            type="button"
            class="pill-tab ${ed.id === currentEdition.id ? 'active' : ''}"
            data-edition="${escapeHtml(ed.id)}"
            title="${escapeHtml(ed.badge || ed.label)}"
          >
            ${escapeHtml(ed.label)}
          </button>
        `
      )
      .join('');
  }

  function renderQuickSwitch(currentGame) {
    if (GAMES.length <= 1) {
      el.stageQuickSwitch.classList.add('hidden');
      return;
    }

    el.stageQuickSwitch.classList.remove('hidden');
    el.stageQuickSwitch.innerHTML = GAMES.map(
      (game) => `
        <button
          type="button"
          class="pill-tab ${game.id === currentGame.id ? 'active' : ''}"
          data-switch-game="${escapeHtml(game.id)}"
        >
          ${escapeHtml(game.title)}
        </button>
      `
    ).join('');
  }

  function renderQuickRules(game) {
    el.rulesGameName.textContent = game.title;
    if (el.rulesGameAuthors) {
      el.rulesGameAuthors.textContent = game.authors ? `Por ${game.authors}` : '';
      el.rulesGameAuthors.classList.toggle('hidden', !game.authors);
    }
    el.rulesPdfLink.href = game.manualPdf || '#';
    el.rulesPdfLink.classList.toggle('hidden', !game.manualPdf);

    const blocks = (game.quickRules || []).map((section) => {
      let bodyHtml = '';
      if (section.text) {
        bodyHtml = `<p>${section.text}</p>`;
      } else if (Array.isArray(section.items)) {
        bodyHtml = `<ul>${section.items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
      } else if (Array.isArray(section.suitsTriangle)) {
        const chips = section.suitsTriangle
          .map(
            (s) =>
              `<span class="suit-chip suit-chip--${escapeHtml(s.id)}">${escapeHtml(s.label)}</span> <span class="suit-verb">${escapeHtml(s.verb)}</span>`
          )
          .join(' ');
        const first = section.suitsTriangle[0];
        bodyHtml = `<div class="suits-triangle">${chips} <span class="suit-chip suit-chip--${escapeHtml(first.id)}">${escapeHtml(first.label)}</span></div>`;
      }

      return `
        <section class="rule-block">
          <h4>${escapeHtml(section.title)}</h4>
          ${bodyHtml}
        </section>
      `;
    });

    el.rulesBody.innerHTML = blocks.join('');
  }

  function setRulesOpen(open) {
    rulesOpen = Boolean(open);
    el.rulesDrawer.classList.toggle('is-open', rulesOpen);
    el.rulesDrawer.setAttribute('aria-hidden', rulesOpen ? 'false' : 'true');
    el.btnToggleRules.setAttribute('aria-expanded', rulesOpen ? 'true' : 'false');

    const isMobileOrTablet = window.innerWidth <= 1024;
    el.rulesBackdrop.classList.toggle('hidden', !(rulesOpen && isMobileOrTablet));
  }

  function syncHistory(game, edition, roomCode, replace = false) {
    if (window.location.protocol === 'file:') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('jogo');
    url.searchParams.delete('versao');
    url.searchParams.delete('sala');

    if (game) {
      url.searchParams.set('jogo', game.id);
      if (edition && game.editions && game.editions[0] && edition.id !== game.editions[0].id) {
        url.searchParams.set('versao', edition.id);
      }
      if (roomCode && game.id === 'impar' && edition && edition.id === '2d') {
        url.searchParams.set('sala', roomCode);
      }
    }

    const method = replace ? 'replaceState' : 'pushState';
    window.history[method](
      { jogo: game ? game.id : null, versao: edition ? edition.id : null, sala: roomCode || '' },
      '',
      url.toString()
    );
  }

  function loadEditionIntoFrame(game, edition, roomCode) {
    const targetUrl = buildGameUrl(edition, game.id === 'impar' && edition.id === '2d' ? roomCode : '');
    el.btnOpenExternal.href = targetUrl;

    if (window.location.protocol === 'file:') {
      el.stageLoader.classList.add('is-done');
      el.stageFileWarning.classList.remove('hidden');
      el.gameIframe.src = 'about:blank';
      return;
    }

    el.stageFileWarning.classList.add('hidden');
    el.stageLoader.classList.remove('is-done');
    el.gameIframe.src = targetUrl;
  }

  function openGame(gameId, options = {}) {
    const game = GAMES.find((g) => g.id === gameId);
    if (!game) return;

    const editions = game.editions || [];
    const requestedEdition = editions.find((e) => e.id === options.editionId);
    const edition = requestedEdition || editions[0];
    const roomCode = typeof options.roomCode === 'string' ? options.roomCode.trim().toUpperCase() : '';

    activeGame = game;
    activeEdition = edition;
    activeRoomCode = roomCode;

    el.stageGameTitle.textContent = game.title;
    document.title = `${game.title} — Mundo do Tabuleiro`;

    renderEditionSwitcher(game, edition);
    renderQuickSwitch(game);
    renderQuickRules(game);

    document.body.classList.add('stage-active');
    el.homeView.classList.add('hidden');
    el.stageView.classList.remove('hidden');

    setRulesOpen(Boolean(options.openRules));
    loadEditionIntoFrame(game, edition, roomCode);

    if (!options.skipHistory) {
      syncHistory(game, edition, roomCode, Boolean(options.replaceHistory));
    }
  }

  function closeGame(options = {}) {
    exitFullscreenIfActive();
    setRulesOpen(false);

    activeGame = null;
    activeEdition = null;
    activeRoomCode = '';

    el.gameIframe.src = 'about:blank';
    el.stageFileWarning.classList.add('hidden');
    el.stageView.classList.add('hidden');
    el.homeView.classList.remove('hidden');
    document.body.classList.remove('stage-active');
    document.title = defaultTitle;

    if (!options.skipHistory) {
      syncHistory(null, null, '', Boolean(options.replaceHistory));
    }
  }

  function updateFullscreenUI() {
    const isNativeFs = document.fullscreenElement === el.stageView;
    const isFs = isNativeFs || pseudoFullscreen;
    el.stageView.classList.toggle('is-pseudo-fullscreen', pseudoFullscreen && !isNativeFs);
    el.fullscreenLabel.textContent = isFs ? 'Sair da Tela Cheia' : 'Tela Cheia';
    el.btnFullscreen.setAttribute('aria-pressed', isFs ? 'true' : 'false');
  }

  function exitFullscreenIfActive() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (pseudoFullscreen) {
      pseudoFullscreen = false;
      updateFullscreenUI();
    }
  }

  async function toggleFullscreen() {
    const isNativeFs = document.fullscreenElement === el.stageView;
    if (isNativeFs) {
      await document.exitFullscreen().catch(() => {});
      return;
    }

    if (pseudoFullscreen) {
      pseudoFullscreen = false;
      updateFullscreenUI();
      return;
    }

    if (el.stageView.requestFullscreen) {
      try {
        await el.stageView.requestFullscreen();
        return;
      } catch {
        // Fallback para tela cheia via CSS se bloqueado pelo ambiente
      }
    }

    pseudoFullscreen = true;
    updateFullscreenUI();
  }

  function applyUrlRoute(replaceHistory = false) {
    const params = new URLSearchParams(window.location.search);
    const jogo = (params.get('jogo') || '').trim().toLowerCase();
    const versao = (params.get('versao') || '').trim().toLowerCase();
    const sala = (params.get('sala') || '').trim().toUpperCase();

    if (jogo && GAMES.some((g) => g.id === jogo)) {
      openGame(jogo, {
        editionId: versao || undefined,
        roomCode: sala,
        skipHistory: !replaceHistory,
        replaceHistory
      });
      return;
    }

    if (sala) {
      openGame('impar', {
        editionId: '2d',
        roomCode: sala,
        skipHistory: !replaceHistory,
        replaceHistory
      });
      return;
    }

    if (activeGame) {
      closeGame({ skipHistory: true });
    }
  }

  function bindEvents() {
    el.gamesGrid.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;
      const gameId = trigger.getAttribute('data-game');
      const action = trigger.getAttribute('data-action');
      openGame(gameId, { openRules: action === 'rules' });
    });

    el.stageEditions.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-edition]');
      if (!btn || !activeGame) return;
      const editionId = btn.getAttribute('data-edition');
      if (activeEdition && activeEdition.id === editionId) return;
      openGame(activeGame.id, {
        editionId,
        openRules: rulesOpen,
        roomCode: editionId === '2d' ? activeRoomCode : ''
      });
    });

    el.stageQuickSwitch.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-switch-game]');
      if (!btn) return;
      const gameId = btn.getAttribute('data-switch-game');
      if (activeGame && activeGame.id === gameId) return;
      openGame(gameId, { openRules: rulesOpen });
    });

    el.btnBackHome.addEventListener('click', () => closeGame());
    el.btnWarningBack.addEventListener('click', () => closeGame());

    el.btnToggleRules.addEventListener('click', () => setRulesOpen(!rulesOpen));
    el.btnCloseRules.addEventListener('click', () => setRulesOpen(false));
    el.rulesBackdrop.addEventListener('click', () => setRulesOpen(false));

    el.btnFullscreen.addEventListener('click', () => toggleFullscreen());

    el.btnReloadGame.addEventListener('click', () => {
      if (!activeGame || !activeEdition) return;
      loadEditionIntoFrame(activeGame, activeEdition, activeRoomCode);
    });

    el.gameIframe.addEventListener('load', () => {
      el.stageLoader.classList.add('is-done');
    });

    document.addEventListener('fullscreenchange', updateFullscreenUI);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && rulesOpen) {
        setRulesOpen(false);
      }
    });

    window.addEventListener('resize', () => {
      if (!rulesOpen) return;
      const isMobileOrTablet = window.innerWidth <= 1024;
      el.rulesBackdrop.classList.toggle('hidden', !isMobileOrTablet);
    });

    window.addEventListener('popstate', () => {
      applyUrlRoute(false);
    });
  }

  function init() {
    renderCatalog();
    bindEvents();
    applyUrlRoute(false);
  }

  init();
})();
