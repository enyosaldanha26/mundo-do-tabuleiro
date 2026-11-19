import { AI_DIFFICULTIES, COLOR_MAP, DEFAULT_AI_NAMES, PHASES } from './engine/constants.js';
import {
  chooseColorAfterTen,
  createMatchState,
  finalizeDispute,
  getLegalTileIds,
  playTile,
  playerHasRequiredColor,
  startNextRound,
} from './engine/gameState.js';
import { chooseAIColorAfterTen, chooseAILowestTile, chooseAITile } from './engine/ai.js';
import { sound } from './audio/sound.js';
import { getColorSymbolSvg, getManualHtml } from './ui/symbols.js';
import { renderImparWordmark, renderTileSvg } from './ui/tile2d.js';
import { OnlineRoomManager } from './net/onlineRoom.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Impar2DApp {
  constructor() {
    this.mode = 'solo';
    this.onlineTab = 'create';
    this.playerCount = 4;
    this.difficulty = 'tatico';
    this.state = null;
    this.viewerIndex = 0;
    this.busy = false;
    this.soundMuted = false;
    this.sidePanelMode = null;
    this.disputeReveal = null;
    this.toastTimer = null;
    this._lastArenaCount = 0;
    this._roomMembers = [];
    this._roomHasPassword = false;
    this._lastAnimatedPenaltyKey = null;
    this._lastOpenedPhaseKey = null;

    this.online = new OnlineRoomManager({
      onRoomUpdate: (members) => {
        this._roomMembers = members;
        this._renderWaitingRoom();
      },
      onGuestAction: (guestIdx, msg) => this._handleGuestAction(guestIdx, msg),
      onStateSync: (msg) => this._handleGuestStateSync(msg),
      onGuestDisconnectedInMatch: (guestIdx, name) => this._handleGuestDisconnectInMatch(guestIdx, name),
      onHostDisconnected: () => this._handleHostDisconnected(),
      onHostReturnedLobby: () => this._handleHostReturnedLobby(),
      onError: (errMsg) => this._setOnlineStatus(errMsg, 'error'),
    });

    this._cacheDom();
    this._renderWordmarks();
    this._bindLobby();
    this._bindWaitingRoom();
    this._bindHud();
    this._checkInviteLink();
  }

  _cacheDom() {
    this.el = {
      lobbyScreen: document.getElementById('lobby-screen'),
      lobbyConfigPanel: document.getElementById('lobby-config-panel'),
      waitingRoomPanel: document.getElementById('waiting-room-panel'),
      waitingWordmark: document.getElementById('waiting-wordmark'),
      roomLockBadge: document.getElementById('room-lock-badge'),
      waitingRoomCode: document.getElementById('waiting-room-code'),
      waitingPlayersLabel: document.getElementById('waiting-players-label'),
      waitingPlayersList: document.getElementById('waiting-players-list'),
      waitingHostOptions: document.getElementById('waiting-host-options'),
      waitingBotDiff: document.getElementById('waiting-bot-diff'),
      waitingGuestMsg: document.getElementById('waiting-guest-msg'),
      chkFillBots: document.getElementById('chk-fill-bots'),
      btnStartOnline: document.getElementById('btn-start-online'),
      gameShell: document.getElementById('game-shell'),
      lobbyWordmark: document.getElementById('lobby-wordmark'),
      hudWordmark: document.getElementById('hud-wordmark'),
      modeSelect: document.getElementById('mode-select'),
      onlineActionSection: document.getElementById('online-action-section'),
      onlineTabSelect: document.getElementById('online-tab-select'),
      onlineCreateFields: document.getElementById('online-create-fields'),
      onlineJoinFields: document.getElementById('online-join-fields'),
      onlineCreatePass: document.getElementById('online-create-pass'),
      onlineJoinCode: document.getElementById('online-join-code'),
      onlineJoinPass: document.getElementById('online-join-pass'),
      onlineStatus: document.getElementById('online-status'),
      countSection: document.getElementById('count-section'),
      countSelect: document.getElementById('count-select'),
      diffSelect: document.getElementById('diff-select'),
      difficultySection: document.getElementById('difficulty-section'),
      namesLabel: document.getElementById('names-label'),
      namesContainer: document.getElementById('player-names-container'),
      btnStartMatch: document.getElementById('btn-start-match'),
      hudRound: document.getElementById('hud-round'),
      hudDispute: document.getElementById('hud-dispute'),
      hudBag: document.getElementById('hud-bag'),
      hudRemovedWrap: document.getElementById('hud-removed-wrap'),
      reqColorPill: document.getElementById('hud-required-color'),
      reqColorDot: document.getElementById('req-color-dot'),
      reqColorText: document.getElementById('req-color-text'),
      oppTop: document.getElementById('opponents-top'),
      oppLeft: document.getElementById('opponents-left'),
      oppRight: document.getElementById('opponents-right'),
      centerArena: document.getElementById('center-arena'),
      arenaPlays: document.getElementById('arena-plays'),
      arenaDiscard: document.getElementById('arena-discard'),
      arenaNotice: document.getElementById('arena-notice'),
      humanZone: document.getElementById('human-zone'),
      humanTurnText: document.getElementById('human-turn-text'),
      hoverPill: document.getElementById('hover-pill'),
      humanScoreArea: document.getElementById('human-score-area'),
      humanHand: document.getElementById('human-hand'),
      disputeToast: document.getElementById('dispute-toast'),
      sidePanel: document.getElementById('side-panel'),
      btnLog: document.getElementById('btn-toggle-log'),
      btnSound: document.getElementById('btn-toggle-sound'),
      modalBackdrop: document.getElementById('modal-backdrop'),
      modalCard: document.getElementById('modal-card'),
    };
  }

  _renderWordmarks() {
    this.el.lobbyWordmark.innerHTML = renderImparWordmark(38);
    this.el.waitingWordmark.innerHTML = renderImparWordmark(34);
    this.el.hudWordmark.innerHTML = renderImparWordmark(22);
  }

  _bindLobby() {
    this.el.modeSelect.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      this.mode = btn.dataset.mode;
      this._updateSegmented(this.el.modeSelect, btn);
      this._syncLobbyModeUI();
      this._renderNameInputs();
    });

    this.el.onlineTabSelect.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-online-tab]');
      if (!btn) return;
      this.onlineTab = btn.dataset.onlineTab;
      this._updateSegmented(this.el.onlineTabSelect, btn);
      this._syncLobbyModeUI();
    });

    this.el.countSelect.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-count]');
      if (!btn) return;
      this.playerCount = Number(btn.dataset.count);
      this._updateSegmented(this.el.countSelect, btn);
      this._renderNameInputs();
    });

    this.el.diffSelect.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-diff]');
      if (!btn) return;
      this.difficulty = btn.dataset.diff;
      this._updateSegmented(this.el.diffSelect, btn);
    });

    document.getElementById('btn-lobby-manual').addEventListener('click', () => this._openManual());
    this.el.btnStartMatch.addEventListener('click', () => this._handleLobbyPrimaryAction());
  }

  _syncLobbyModeUI() {
    const isOnline = this.mode === 'online';
    const isCreate = isOnline && this.onlineTab === 'create';
    const isJoin = isOnline && this.onlineTab === 'join';

    this.el.onlineActionSection.classList.toggle('hidden', !isOnline);
    this.el.onlineCreateFields.classList.toggle('hidden', !isCreate);
    this.el.onlineJoinFields.classList.toggle('hidden', !isJoin);
    this.el.countSection.classList.toggle('hidden', isJoin);
    this.el.difficultySection.classList.toggle('hidden', !(this.mode === 'solo' || isCreate));
    this._clearOnlineStatus();

    if (isCreate) {
      this.el.btnStartMatch.textContent = 'Criar Sala';
    } else if (isJoin) {
      this.el.btnStartMatch.textContent = 'Entrar na Sala';
    } else {
      this.el.btnStartMatch.textContent = 'Iniciar Partida';
    }
  }

  _bindWaitingRoom() {
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      if (!this.online.roomCode) return;
      navigator.clipboard?.writeText(this.online.roomCode).catch(() => {});
      this._showToast(`Código ${this.online.roomCode} copiado!`);
    });

    document.getElementById('btn-copy-link').addEventListener('click', () => {
      if (!this.online.roomCode) return;
      const url = new URL(window.location.href);
      url.searchParams.set('sala', this.online.roomCode);
      navigator.clipboard?.writeText(url.toString()).catch(() => {});
      this._showToast('Link da sala copiado!');
    });

    this.el.chkFillBots.addEventListener('change', () => this._renderWaitingRoom());

    document.getElementById('btn-leave-room').addEventListener('click', () => {
      this.online.destroy();
      this._leaveWaitingRoom();
    });

    this.el.btnStartOnline.addEventListener('click', () => this._startOnlineMatchAsHost());
  }

  _checkInviteLink() {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('sala') || '').trim().toUpperCase();
    if (!code) return;
    this.mode = 'online';
    this.onlineTab = 'join';
    const modeBtn = this.el.modeSelect.querySelector('[data-mode="online"]');
    const tabBtn = this.el.onlineTabSelect.querySelector('[data-online-tab="join"]');
    if (modeBtn) this._updateSegmented(this.el.modeSelect, modeBtn);
    if (tabBtn) this._updateSegmented(this.el.onlineTabSelect, tabBtn);
    this.el.onlineJoinCode.value = code;
    this._syncLobbyModeUI();
    this._renderNameInputs();
  }

  _setOnlineStatus(msg, kind = 'error') {
    this.el.onlineStatus.textContent = msg;
    this.el.onlineStatus.className = `online-status ${kind === 'info' ? 'info' : ''}`;
  }

  _clearOnlineStatus() {
    this.el.onlineStatus.classList.add('hidden');
  }

  _updateSegmented(container, selectedBtn) {
    container.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('selected'));
    selectedBtn.classList.add('selected');
  }

  _renderNameInputs() {
    if (this.mode === 'solo' || this.mode === 'online') {
      this.el.namesLabel.textContent = 'Seu Nome';
      const current = document.getElementById('human-name-input')?.value || 'Você';
      this.el.namesContainer.innerHTML = `<input type="text" class="text-input" id="human-name-input" value="${this._esc(current)}" maxlength="16" placeholder="Seu nome" />`;
    } else {
      this.el.namesLabel.textContent = `Nomes dos ${this.playerCount} Jogadores`;
      let html = '';
      for (let i = 0; i < this.playerCount; i++) {
        html += `<input type="text" class="text-input local-name-input" value="Jogador ${i + 1}" maxlength="14" placeholder="Jogador ${i + 1}" />`;
      }
      this.el.namesContainer.innerHTML = html;
    }
  }

  _bindHud() {
    this.el.btnLog.addEventListener('click', () => {
      this.sidePanelMode = this.sidePanelMode === 'log' ? null : 'log';
      this._renderSidePanel();
    });

    document.getElementById('btn-open-manual').addEventListener('click', () => this._openManual());

    this.el.btnSound.addEventListener('click', () => {
      this.soundMuted = !this.soundMuted;
      sound.setMuted(this.soundMuted);
      this.el.btnSound.textContent = this.soundMuted ? 'Mudo' : 'Som';
      this.el.btnSound.classList.toggle('active', !this.soundMuted);
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
      if (this.mode === 'online') {
        this.online.destroy();
        this._leaveWaitingRoom();
      }
      this.state = null;
      this.busy = false;
      this.disputeReveal = null;
      this.sidePanelMode = null;
      this._renderSidePanel();
      this.el.gameShell.classList.add('hidden');
      this.el.lobbyScreen.classList.remove('hidden');
    });
  }

  async _handleLobbyPrimaryAction() {
    if (this.mode !== 'online') {
      this._startNewMatch();
      return;
    }

    const myName = (document.getElementById('human-name-input')?.value || '').trim() || 'Jogador';
    this.el.btnStartMatch.disabled = true;

    try {
      if (this.onlineTab === 'create') {
        this._setOnlineStatus('Criando sala online...', 'info');
        const pass = this.el.onlineCreatePass.value || '';
        const info = await this.online.createRoom({
          hostName: myName,
          maxPlayers: this.playerCount,
          password: pass,
        });
        this._roomHasPassword = info.hasPassword;
        this._roomMembers = info.members;
        this._enterWaitingRoom();
      } else {
        this._setOnlineStatus('Conectando à sala...', 'info');
        const code = this.el.onlineJoinCode.value.trim().toUpperCase();
        const pass = this.el.onlineJoinPass.value || '';
        const info = await this.online.joinRoom({
          roomCode: code,
          playerName: myName,
          password: pass,
        });
        this.playerCount = info.maxPlayers;
        this._roomHasPassword = info.hasPassword;
        this._roomMembers = info.members;
        this._enterWaitingRoom();
      }
    } catch (err) {
      this._setOnlineStatus(err.message || 'Erro ao conectar.', 'error');
    } finally {
      this.el.btnStartMatch.disabled = false;
    }
  }

  _enterWaitingRoom() {
    this._clearOnlineStatus();
    this.el.lobbyConfigPanel.classList.add('hidden');
    this.el.waitingRoomPanel.classList.remove('hidden');
    this._renderWaitingRoom();
  }

  _leaveWaitingRoom() {
    this.el.waitingRoomPanel.classList.add('hidden');
    this.el.lobbyConfigPanel.classList.remove('hidden');
    this._clearOnlineStatus();
  }

  _renderWaitingRoom() {
    const isHost = this.online.role === 'host';
    const maxP = this.online.maxPlayers || this.playerCount;
    const members = this._roomMembers || [];

    this.el.waitingRoomCode.textContent = this.online.roomCode || '-----';
    this.el.roomLockBadge.textContent = this._roomHasPassword ? '🔒 Com senha' : '🔓 Sem senha';
    this.el.waitingPlayersLabel.textContent = `Jogadores na Sala (${members.length}/${maxP})`;
    this.el.waitingBotDiff.textContent = AI_DIFFICULTIES[this.difficulty]?.name || 'Tático';

    this.el.waitingHostOptions.classList.toggle('hidden', !isHost || members.length >= maxP);
    this.el.btnStartOnline.classList.toggle('hidden', !isHost);
    this.el.waitingGuestMsg.classList.toggle('hidden', isHost);

    const fillBots = this.el.chkFillBots.checked;
    this.el.btnStartOnline.disabled = !(members.length >= maxP || (fillBots && members.length >= 1));

    let html = '';
    for (let i = 0; i < maxP; i++) {
      const m = members[i];
      if (m) {
        html += `<div class="waiting-slot"><span>${this._esc(m.name)}</span><span style="font-size:11.5px;color:#0284c7;">${m.isHost ? 'Anfitrião' : 'Conectado'}</span></div>`;
      } else if (isHost && fillBots) {
        html += `<div class="waiting-slot empty"><span>${this._esc(DEFAULT_AI_NAMES[i] || `Bot ${i + 1}`)} (IA)</span><span>Automático</span></div>`;
      } else {
        html += `<div class="waiting-slot empty"><span>Aguardando jogador...</span><span>Vaga aberta</span></div>`;
      }
    }
    this.el.waitingPlayersList.innerHTML = html;
  }

  _startOnlineMatchAsHost() {
    if (this.online.role !== 'host') return;
    const maxP = this.online.maxPlayers;
    const members = this._roomMembers;
    const fillBots = this.el.chkFillBots.checked;
    if (members.length < maxP && !fillBots) return;

    const players = [];
    for (let i = 0; i < maxP; i++) {
      const m = members[i];
      if (m) {
        players.push({ name: m.name, isHuman: true });
      } else {
        players.push({
          name: DEFAULT_AI_NAMES[i] || `IA ${i + 1}`,
          isHuman: false,
          difficulty: this.difficulty,
        });
      }
    }

    const randomStarter = Math.floor(Math.random() * players.length);
    this.state = createMatchState({
      players,
      startingPlayerIndex: randomStarter,
      useParOuImpar: false,
    });
    this.viewerIndex = 0;
    this.busy = false;
    this.disputeReveal = null;

    this.el.lobbyScreen.classList.add('hidden');
    this.el.gameShell.classList.remove('hidden');

    sound.playDeal();
    this._renderAll();
    this._advanceTurnLoop();
  }

  _startNewMatch() {
    let players = [];
    if (this.mode === 'solo') {
      const humanName = (document.getElementById('human-name-input')?.value || '').trim() || 'Você';
      players.push({ name: humanName, isHuman: true });
      for (let i = 0; i < this.playerCount - 1; i++) {
        players.push({
          name: DEFAULT_AI_NAMES[i],
          isHuman: false,
          difficulty: this.difficulty,
        });
      }
    } else {
      const inputs = [...document.querySelectorAll('.local-name-input')];
      players = inputs.map((inp, idx) => ({
        name: inp.value.trim() || `Jogador ${idx + 1}`,
        isHuman: true,
      }));
    }

    const randomStarter = Math.floor(Math.random() * players.length);
    this.state = createMatchState({
      players,
      startingPlayerIndex: randomStarter,
      useParOuImpar: false,
    });
    this.viewerIndex = 0;
    this.busy = false;

    this.el.lobbyScreen.classList.add('hidden');
    this.el.gameShell.classList.remove('hidden');

    sound.playDeal();
    this._renderAll();
    this._advanceTurnLoop();
  }

  _openParOuImparModal() {
    const p0 = this.state.players[0].name;
    const p1 = this.state.players[1].name;
    this._showModal(`
      <h2 style="margin-top:0;">Par ou Ímpar — Jogador Inicial</h2>
      <p style="color:#475569;font-size:14px;">Quem vencer a disputa de Par ou Ímpar começa a 1ª rodada! Escolha sua opção e os dedos:</p>
      <div class="form-section">
        <span class="form-label">Escolha de ${this._esc(p0)}</span>
        <div class="segmented" id="poi-parity">
          <button class="seg-btn selected" data-val="par">Par</button>
          <button class="seg-btn" data-val="impar">Ímpar</button>
        </div>
      </div>
      <div class="form-section">
        <span class="form-label">Dedos (0 a 5)</span>
        <div class="segmented" id="poi-num">
          ${[0, 1, 2, 3, 4, 5].map((n) => `<button class="seg-btn ${n === 1 ? 'selected' : ''}" data-n="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div id="poi-result" style="min-height:24px;font-weight:800;color:#0284c7;"></div>
      <div class="btn-row">
        <button class="primary-btn" id="btn-poi-roll">Sortear!</button>
      </div>
    `);

    let chosenParity = 'par';
    let chosenNum = 1;

    document.getElementById('poi-parity').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-val]');
      if (!btn) return;
      chosenParity = btn.dataset.val;
      this._updateSegmented(document.getElementById('poi-parity'), btn);
    });

    document.getElementById('poi-num').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-n]');
      if (!btn) return;
      chosenNum = Number(btn.dataset.n);
      this._updateSegmented(document.getElementById('poi-num'), btn);
    });

    document.getElementById('btn-poi-roll').addEventListener('click', async () => {
      const btnRoll = document.getElementById('btn-poi-roll');
      btnRoll.disabled = true;
      const otherNum = Math.floor(Math.random() * 6);
      const sum = chosenNum + otherNum;
      const isEven = sum % 2 === 0;
      const p0Wins = (chosenParity === 'par' && isEven) || (chosenParity === 'impar' && !isEven);
      const starterIndex = p0Wins ? 0 : Math.floor(Math.random() * (this.state.playerCount - 1)) + 1;

      this.state.currentDispute.leaderIndex = starterIndex;
      this.state.currentDispute.turnIndex = starterIndex;
      this.state.phase = PHASES.PLAY_TILE;

      document.getElementById('poi-result').textContent =
        `${p0} (${chosenNum}) + ${p1} (${otherNum}) = ${sum} (${isEven ? 'PAR' : 'ÍMPAR'}). ${this.state.players[starterIndex].name} começa!`;
      sound.playTenSpecial();

      await sleep(1250);
      this._hideModal();
      this._renderAll();
      this._advanceTurnLoop();
    });
  }

  _renderAll() {
    if (!this.state) return;
    const s = this.state;
    this.el.gameShell.dataset.players = String(s.playerCount);

    // Topbar
    this.el.hudRound.textContent = `${s.round}/${s.totalRounds}`;
    this.el.hudDispute.textContent = `${s.disputeNumber}/${s.totalDisputesPerRound}`;
    this.el.hudBag.textContent = `${s.bagTiles.length}`;

    if (s.removedColor) {
      const rc = COLOR_MAP[s.removedColor];
      this.el.hudRemovedWrap.classList.remove('hidden');
      this.el.hudRemovedWrap.innerHTML = `<span class="label">Removida:</span> <span style="color:${rc.hex}">${rc.name}</span>`;
    } else {
      this.el.hudRemovedWrap.classList.add('hidden');
    }

    const req = s.currentDispute.requiredColor;
    if (this.disputeReveal) {
      this.el.reqColorDot.style.background = '#10b981';
      this.el.reqColorText.textContent = 'Resultado da Disputa';
      this.el.reqColorPill.style.borderColor = '#10b981';
      this.el.reqColorPill.style.background = '#ecfdf5';
      this.el.centerArena.style.borderColor = '#cbd5e1';
      this.el.centerArena.style.borderStyle = 'solid';
    } else if (req && COLOR_MAP[req]) {
      const c = COLOR_MAP[req];
      this.el.reqColorDot.style.background = c.hex;
      this.el.reqColorText.textContent = s.currentDispute.forcedByTen
        ? `Efeito do 10: ${c.name}`
        : `Seguir: ${c.name}`;
      this.el.reqColorPill.style.borderColor = c.hex;
      this.el.reqColorPill.style.background = `${c.hex}16`;
      this.el.centerArena.style.borderColor = c.hex;
      this.el.centerArena.style.borderStyle = 'solid';
    } else {
      this.el.reqColorDot.style.background = '#94a3b8';
      this.el.reqColorText.textContent = 'Cor livre (1ª jogada)';
      this.el.reqColorPill.style.borderColor = 'var(--border)';
      this.el.reqColorPill.style.background = 'var(--bg)';
      this.el.centerArena.style.borderColor = 'var(--border-strong)';
      this.el.centerArena.style.borderStyle = 'dashed';
    }

    // Oponentes distribuídos em sentido horário
    this._renderOpponents();

    // Arena Central (durante a revelação em 3 etapas, mantém todas as peças da disputa visíveis!)
    this.el.arenaDiscard.textContent = `Descarte oculto: ${s.discardPile.length}`;
    const reveal = this.disputeReveal;
    const arenaPlaysList = reveal ? reveal.data.plays : s.currentDispute.plays;
    const showWin = reveal && (reveal.step === 'winner' || reveal.step === 'penalty');
    const showPen = reveal && reveal.step === 'penalty';

    if (arenaPlaysList.length === 0) {
      this._lastArenaCount = 0;
      this.el.arenaPlays.innerHTML = `<span class="arena-empty">Aguardando primeira jogada da disputa...</span>`;
    } else {
      const prevCount = this._lastArenaCount;
      this.el.arenaPlays.innerHTML = arenaPlaysList
        .map((play, idx) => {
          const pName = s.players[play.playerIndex].name;
          const isWinTile = showWin && play.tile.id === reveal.data.winningTile.id;
          const isPenTile = showPen && reveal.data.penaltyTile && play.tile.id === reveal.data.penaltyTile.id;
          const slotClasses = ['played-slot'];
          if (idx >= prevCount) slotClasses.push('slot-enter');
          if (isWinTile) slotClasses.push('slot-winner');
          if (isPenTile) slotClasses.push('slot-penalty');

          const badges = [];
          if (isWinTile) badges.push('<span class="slot-tag win">Venceu</span>');
          if (isPenTile) badges.push('<span class="slot-tag pen">Menor • Pegou</span>');

          return `
            <div class="${slotClasses.join(' ')}">
              ${renderTileSvg(play.tile, 'front', 'md')}
              <span class="played-who">${idx + 1}º • ${this._esc(pName)}</span>
              ${badges.length ? `<div style="display:flex;gap:4px;">${badges.join('')}</div>` : ''}
            </div>
          `;
        })
        .join('');
      this._lastArenaCount = arenaPlaysList.length;
    }

    if (reveal && reveal.step === 'winner') {
      const winner = s.players[reveal.data.winnerIndex];
      const winVal = reveal.data.winningTile.value;
      this.el.arenaNotice.innerHTML = `🏆 <strong>${this._esc(winner.name)}</strong> venceu a disputa com a peça <strong>${winVal}</strong>!`;
      this.el.arenaNotice.classList.remove('hidden');
      this.el.centerArena.style.borderColor = '#10b981';
      this.el.centerArena.style.borderStyle = 'solid';
    } else if (reveal && reveal.step === 'penalty' && reveal.data.penaltyTile) {
      const winner = s.players[reveal.data.winnerIndex];
      const winVal = reveal.data.winningTile.value;
      const pen = reveal.data.penaltyTile;
      const penColor = COLOR_MAP[pen.color].name;
      this.el.arenaNotice.innerHTML = `🏆 <strong>${this._esc(winner.name)}</strong> venceu com <strong>${winVal}</strong> e vai pegar a peça de menor valor: <strong>${pen.value} (${penColor})</strong>.`;
      this.el.arenaNotice.classList.remove('hidden');
      this.el.centerArena.style.borderColor = '#10b981';
      this.el.centerArena.style.borderStyle = 'solid';
    } else {
      this.el.arenaNotice.classList.add('hidden');
    }

    // Mão do jogador humano
    this._renderHumanZone();
    this._renderSidePanel();

    if (this.mode === 'online' && this.online.role === 'host') {
      this.online.broadcastGameState(this.state, {
        disputeReveal: this.disputeReveal,
        toast: this._pendingOnlineToast || null,
      });
      this._pendingOnlineToast = null;
    }
  }

  _renderOpponents() {
    const s = this.state;
    this.el.oppTop.innerHTML = '';
    this.el.oppLeft.innerHTML = '';
    this.el.oppRight.innerHTML = '';

    // Mapeamento horário por nº de jogadores
    const seatSlotMap = {
      3: { 1: 'top', 2: 'top' },
      4: { 1: 'left', 2: 'top', 3: 'right' },
      5: { 1: 'left', 2: 'top', 3: 'top', 4: 'right' },
      6: { 1: 'left', 2: 'top', 3: 'top', 4: 'top', 5: 'right' },
    }[s.playerCount];

    for (let offset = 1; offset < s.playerCount; offset++) {
      const pIdx = (this.viewerIndex + offset) % s.playerCount;
      const p = s.players[pIdx];
      const isTurn = !this.disputeReveal && s.phase === PHASES.PLAY_TILE && s.currentDispute.turnIndex === pIdx;

      const card = document.createElement('div');
      card.className = `seat-card ${isTurn ? 'active-turn' : ''}`;
      card.dataset.playerIndex = String(pIdx);

      const pendingPenaltyId = this.disputeReveal?.data?.penaltyTile?.id;
      const visiblePenalties = pendingPenaltyId
        ? p.penaltyTiles.filter((t) => t.id !== pendingPenaltyId)
        : p.penaltyTiles;

      const handHtml = p.hand.map((t) => renderTileSvg(t, 'front', 'opp')).join('');
      const penTilesHtml =
        visiblePenalties.length > 0
          ? visiblePenalties.map((t) => renderTileSvg(t, 'back', 'sm')).join('')
          : '<span class="pen-empty">Nenhuma peça</span>';
      const penHtml = `<div class="opp-penalties"><span>Pontos (${visiblePenalties.length}):</span>${penTilesHtml}</div>`;

      card.innerHTML = `
        <div class="seat-header">
          <div class="seat-name">
            <span>${this._esc(p.name)}</span>
            ${isTurn ? '<span class="turn-badge">Vez</span>' : ''}
          </div>
          <div class="seat-score">Rodada: <strong>?</strong> • Total: <strong>${p.totalScore}</strong></div>
        </div>
        <div class="opp-hand">${handHtml || '<span style="font-size:12px;color:#94a3b8;">Sem peças</span>'}</div>
        ${penHtml}
      `;

      const slot = seatSlotMap[offset];
      if (slot === 'left') this.el.oppLeft.appendChild(card);
      else if (slot === 'right') this.el.oppRight.appendChild(card);
      else this.el.oppTop.appendChild(card);
    }
  }

  _renderHumanZone() {
    const s = this.state;
    const viewer = s.players[this.viewerIndex];
    const turnPlayer = s.players[s.currentDispute.turnIndex];
    const isHumanTurn =
      !this.busy &&
      s.phase === PHASES.PLAY_TILE &&
      turnPlayer.isHuman &&
      s.currentDispute.turnIndex === this.viewerIndex;

    const req = s.currentDispute.requiredColor;
    this.el.humanZone.classList.toggle('your-turn', isHumanTurn);

    if (this.disputeReveal) {
      this.el.humanTurnText.textContent = 'Disputa encerrada! Confira o resultado na arena...';
    } else if (s.phase === PHASES.PLAY_TILE) {
      if (isHumanTurn) {
        if (!req) {
          this.el.humanTurnText.innerHTML = `Sua vez, <strong>${this._esc(viewer.name)}</strong>! Jogue qualquer peça para abrir a disputa.`;
        } else if (playerHasRequiredColor(s, this.viewerIndex)) {
          this.el.humanTurnText.innerHTML = `Sua vez! Jogue uma peça <strong style="color:${COLOR_MAP[req].hex}">${COLOR_MAP[req].name}</strong>.`;
        } else {
          this.el.humanTurnText.innerHTML = `Você não tem <strong>${COLOR_MAP[req].name}</strong> — jogue qualquer peça!`;
        }
      } else {
        this.el.humanTurnText.textContent = `Vez de ${turnPlayer.name}...`;
      }
    } else if (s.phase === PHASES.CHOOSE_COLOR_10) {
      this.el.humanTurnText.textContent = `${turnPlayer.name} jogou um 10 e está escolhendo a cor...`;
    } else if (s.phase === PHASES.CHOOSE_LOWEST_TILE) {
      this.el.humanTurnText.textContent = `${s.players[s.currentDispute.pendingWinnerIndex].name} escolhe a peça de menor valor...`;
    }

    const pendingPenaltyId = this.disputeReveal?.data?.penaltyTile?.id;
    const visibleViewerPenalties = pendingPenaltyId
      ? viewer.penaltyTiles.filter((t) => t.id !== pendingPenaltyId)
      : viewer.penaltyTiles;
    const roundPts = visibleViewerPenalties.reduce((sum, t) => sum + t.value, 0);
    const penMini = visibleViewerPenalties.map((t) => renderTileSvg(t, 'front', 'sm')).join('');
    this.el.humanScoreArea.innerHTML = `
      <span style="font-size:12.5px;color:var(--text-muted);">
        ${this._esc(viewer.name)}: <strong style="color:var(--text)">${roundPts}</strong> pts (Total <strong style="color:var(--text)">${viewer.totalScore + roundPts}</strong>)
      </span>
      ${penMini}
    `;

    const legalSet = new Set(isHumanTurn ? getLegalTileIds(s, this.viewerIndex) : []);
    this.el.humanHand.innerHTML = '';

    viewer.hand.forEach((tile) => {
      const isLegal = legalSet.has(tile.id);
      const btn = document.createElement('button');
      btn.className = `hand-tile-btn ${isHumanTurn ? (isLegal ? 'legal' : 'illegal') : 'waiting'}`;
      btn.innerHTML = renderTileSvg(tile, 'back', 'hand');

      btn.addEventListener('mouseenter', () => {
        const c = COLOR_MAP[tile.color];
        const parityStr = tile.parity === 'even' ? 'Par (2, 4, 6, 8 ou 10)' : 'Ímpar (1, 3, 5, 7 ou 9)';
        this.el.hoverPill.innerHTML = `<span class="color-dot" style="width:10px;height:10px;background:${c.hex};vertical-align:middle;margin-right:6px;"></span><strong>${c.name}</strong> • ${parityStr}`;
        if (isHumanTurn && isLegal) sound.playHoverTick();
      });

      btn.addEventListener('mouseleave', () => {
        this.el.hoverPill.textContent = 'Passe o mouse sobre uma peça para ver cor e paridade';
      });

      if (isHumanTurn && isLegal) {
        btn.addEventListener('click', () => this._handleHumanTileClick(tile.id));
      }

      this.el.humanHand.appendChild(btn);
    });
  }

  async _handleHumanTileClick(tileId) {
    if (this.busy || !this.state || this.state.phase !== PHASES.PLAY_TILE) return;
    if (this.state.currentDispute.turnIndex !== this.viewerIndex) return;

    this.busy = true;

    if (this.mode === 'online' && this.online.role === 'guest') {
      sound.playTileClack(1.0);
      this.online.sendToHost({ type: 'PLAY_TILE', tileId });
      return;
    }

    await this._executePlayTile(this.viewerIndex, tileId);
  }

  async _executePlayTile(playerIdx, tileId) {
    this.busy = true;
    const result = playTile(this.state, playerIdx, tileId);
    sound.playTileClack(1.0);

    if (result.action === 'DISPUTE_FINISHED' || result.action === 'ROUND_END' || result.action === 'GAME_OVER') {
      await this._afterDisputeFinalized(result);
      return;
    }

    this._renderAll();
    await this._handlePlayOutcome(result);
  }

  async _handlePlayOutcome(result) {
    if (result.action === 'NEED_COLOR_10') {
      sound.playTenSpecial();
      if (this.state.players[result.playerIndex].isHuman) {
        if (this.mode === 'online' && result.playerIndex !== this.viewerIndex) {
          // Aguarda o convidado escolher a cor da Peça 10 via rede
          this._renderAll();
          return;
        }
        this._openChooseTenColorModal(result.playerIndex);
        return;
      }
      await sleep(700);
      const aiColor = chooseAIColorAfterTen(this.state, result.playerIndex);
      chooseColorAfterTen(this.state, result.playerIndex, aiColor);
      const msg = `${this.state.players[result.playerIndex].name} jogou 10 e definiu ${COLOR_MAP[aiColor].name}!`;
      this._pendingOnlineToast = msg;
      this._showToast(msg);
      this._renderAll();
      await sleep(650);
      this.busy = false;
      this._advanceTurnLoop();
      return;
    }

    if (result.action === 'NEXT_TURN') {
      await sleep(550);
      this.busy = false;
      this._advanceTurnLoop();
      return;
    }

    if (result.action === 'NEED_LOWEST_CHOICE') {
      const preData = {
        winnerIndex: result.winnerIndex,
        winningTile: result.winningTile,
        penaltyTile: null,
        plays: [...this.state.currentDispute.plays],
      };
      this.disputeReveal = { step: 'all', data: preData };
      this._renderAll();
      await sleep(1100);

      this.disputeReveal = { step: 'winner', data: preData };
      sound.playHoverTick();
      this._renderAll();
      await sleep(1265);

      if (this.state.players[result.winnerIndex].isHuman) {
        if (this.mode === 'online' && result.winnerIndex !== this.viewerIndex) {
          // Limpa disputeReveal para o convidado escolher no modal
          this.disputeReveal = null;
          this._renderAll();
          return;
        }
        this._openChooseLowestTileModal(result);
        return;
      }
      const pickedId = chooseAILowestTile(this.state);
      const finalRes = finalizeDispute(this.state, pickedId);
      await this._afterDisputeFinalized(finalRes, true);
      return;
    }

    if (result.action === 'DISPUTE_FINISHED' || result.action === 'ROUND_END' || result.action === 'GAME_OVER') {
      await this._afterDisputeFinalized(result, false);
    }
  }

  async _afterDisputeFinalized(res, skipPreSteps = false) {
    const last = this.state.lastDisputeResult;
    if (last) {
      const winner = this.state.players[last.winnerIndex];

      if (!skipPreSteps) {
        // Etapa 1: Última peça entra normalmente, sem nenhuma marcação
        this.disputeReveal = { step: 'all', data: last };
        this._renderAll();
        await sleep(1150);

        // Etapa 2: Marca a peça que venceu a disputa
        this.disputeReveal = { step: 'winner', data: last };
        sound.playHoverTick();
        this._renderAll();
        await sleep(1325);
      }

      // Etapa 3: Marca a peça de menor valor que o vencedor vai pegar
      this.disputeReveal = { step: 'penalty', data: last };
      sound.playDisputeCollect(winner.isHuman && last.winnerIndex === 0);
      this._renderAll();
      await sleep(2020);

      // Etapa 4: Anima a peça voando da arena até o vencedor
      await this._animatePenaltyTileToWinner(last);

      this.disputeReveal = null;
    }

    this._renderAll();
    await sleep(350);

    if (res.action === 'ROUND_END') {
      this._openRoundSummaryModal(false);
      this.busy = false;
      return;
    }

    if (res.action === 'GAME_OVER') {
      sound.playVictory();
      this._openRoundSummaryModal(true);
      this.busy = false;
      return;
    }

    this.busy = false;
    this._advanceTurnLoop();
  }

  async _advanceTurnLoop() {
    if (!this.state || this.state.phase !== PHASES.PLAY_TILE) return;

    const turnIdx = this.state.currentDispute.turnIndex;
    const turnPlayer = this.state.players[turnIdx];

    if (this.mode === 'local' && turnPlayer.isHuman && turnIdx !== this.viewerIndex) {
      this._openPassDeviceModal(turnIdx);
      return;
    }

    if (this.mode === 'online' && turnPlayer.isHuman && turnIdx !== this.viewerIndex) {
      // Turno de um jogador convidado conectado online
      this._renderAll();
      return;
    }

    if (turnPlayer.isHuman) {
      this._renderAll();
      return;
    }

    this.busy = true;
    this._renderAll();
    await sleep(700);
    if (!this.state) return;

    const chosenId = chooseAITile(this.state, turnIdx);
    const result = playTile(this.state, turnIdx, chosenId);
    sound.playTileClack(0.95 + Math.random() * 0.14);
    if (result.action !== 'DISPUTE_FINISHED' && result.action !== 'ROUND_END' && result.action !== 'GAME_OVER') {
      this._renderAll();
    }

    await this._handlePlayOutcome(result);
  }

  async _animatePenaltyTileToWinner(last) {
    const penSlot = this.el.arenaPlays.querySelector('.played-slot.slot-penalty');
    const penSvg = penSlot?.querySelector('.tile-svg');
    if (!penSvg) return;

    const isViewerWinner = last.winnerIndex === this.viewerIndex;
    const targetEl = isViewerWinner
      ? this.el.humanScoreArea
      : document.querySelector(`.seat-card[data-player-index="${last.winnerIndex}"] .opp-penalties`) ||
        document.querySelector(`.seat-card[data-player-index="${last.winnerIndex}"]`);
    if (!targetEl) return;

    const startRect = penSvg.getBoundingClientRect();
    const anchorEl = isViewerWinner
      ? targetEl.lastElementChild || targetEl
      : targetEl.querySelector('.pen-empty') || targetEl.lastElementChild || targetEl;
    const endRect = anchorEl.getBoundingClientRect();

    // Esmaece as peças descartadas na arena
    this.el.arenaPlays.querySelectorAll('.played-slot').forEach((slot) => {
      if (slot !== penSlot) slot.classList.add('discard-fade');
    });
    penSvg.style.opacity = '0';

    const flyer = document.createElement('div');
    flyer.className = 'flying-tile';
    flyer.style.left = `${startRect.left}px`;
    flyer.style.top = `${startRect.top}px`;
    flyer.style.width = `${startRect.width}px`;
    flyer.style.height = `${startRect.height}px`;
    flyer.innerHTML = renderTileSvg(last.penaltyTile, isViewerWinner ? 'front' : 'back', 'md');
    document.body.appendChild(flyer);

    // Força reflow antes de aplicar o destino da transição
    flyer.getBoundingClientRect();

    const destCenterX = isViewerWinner
      ? endRect.right + 14
      : endRect.left + endRect.width / 2;
    const destCenterY = endRect.top + endRect.height / 2;

    const targetX = destCenterX - (startRect.left + startRect.width / 2);
    const targetY = destCenterY - (startRect.top + startRect.height / 2);
    flyer.style.transform = `translate(${targetX}px, ${targetY}px) scale(0.52)`;
    flyer.style.opacity = '0.92';

    await sleep(640);
    flyer.remove();
  }

  _openChooseTenColorModal(playerIndex) {
    const buttonsHtml = this.state.activeColors
      .map((cid) => {
        const c = COLOR_MAP[cid];
        return `
          <button class="color-choice-btn" data-color="${cid}" style="background:${c.hex};">
            ${getColorSymbolSvg(cid, 34, '#FFFFFF')}
            <span>${c.name}</span>
          </button>
        `;
      })
      .join('');

    this._showModal(`
      <div class="modal-header-row">
        <h2>Peça 10 — Poder Especial</h2>
        <button class="icon-btn" id="btn-toggle-minimize" title="Expandir ou compactar janela">Expandir</button>
      </div>
      <p class="modal-desc" style="color:#475569;font-size:14px;margin:10px 0 0 0;">Você deve escolher a próxima cor a ser seguida:</p>
      <div class="color-picker-grid">${buttonsHtml}</div>
    `, { minimized: true });
    this._bindMinimizeButton();

    this.el.modalCard.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cid = btn.dataset.color;
        this._hideModal();
        if (this.mode === 'online' && this.online.role === 'guest') {
          sound.playTileClack(1.2);
          this.online.sendToHost({ type: 'CHOOSE_COLOR_10', colorId: cid });
          return;
        }
        chooseColorAfterTen(this.state, playerIndex, cid);
        sound.playTileClack(1.2);
        const msg = `${this.state.players[playerIndex].name} definiu a próxima cor: ${COLOR_MAP[cid].name}`;
        this._pendingOnlineToast = msg;
        this._showToast(msg);
        this._renderAll();
        await sleep(500);
        this.busy = false;
        this._advanceTurnLoop();
      });
    });
  }

  _openChooseLowestTileModal(res) {
    const cardsHtml = res.lowestCandidates
      .map(
        (t) => `
          <button class="pick-tile-btn" data-pick="${t.id}">
            ${renderTileSvg(t, 'front', 'lg')}
          </button>
        `
      )
      .join('');

    this._showModal(`
      <div class="modal-header-row">
        <h2>Empate no Menor Valor</h2>
        <button class="icon-btn" id="btn-toggle-minimize" title="Expandir ou compactar janela">Expandir</button>
      </div>
      <p class="modal-desc" style="color:#475569;font-size:14px;margin:10px 0 0 0;">Você venceu a disputa com <strong>${res.winningTile.value}</strong>. Escolha qual das peças de menor valor deseja pegar:</p>
      <div class="tile-picker-grid">${cardsHtml}</div>
    `, { minimized: true });
    this._bindMinimizeButton();

    this.el.modalCard.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pickedId = btn.dataset.pick;
        this._hideModal();
        if (this.mode === 'online' && this.online.role === 'guest') {
          this.online.sendToHost({ type: 'CHOOSE_LOWEST_TILE', tileId: pickedId });
          return;
        }
        const finalRes = finalizeDispute(this.state, pickedId);
        await this._afterDisputeFinalized(finalRes, true);
      });
    });
  }

  _openPassDeviceModal(nextIdx) {
    const nextName = this.state.players[nextIdx].name;
    this._showModal(`
      <div style="text-align:center;padding:12px 0;">
        <h2 style="margin-top:0;">Passe o Computador</h2>
        <p style="color:#475569;font-size:15px;">Agora é a vez de <strong style="color:#0284c7;">${this._esc(nextName)}</strong>.</p>
        <p style="color:#64748b;font-size:13px;">Garanta que os outros jogadores não estejam olhando para a tela.</p>
        <div class="btn-row" style="justify-content:center;">
          <button class="primary-btn" id="btn-reveal-turn" style="max-width:260px;">Sou ${this._esc(nextName)} — Jogar</button>
        </div>
      </div>
    `);
    document.getElementById('btn-reveal-turn').addEventListener('click', () => {
      this._hideModal();
      this.viewerIndex = nextIdx;
      this._renderAll();
    });
  }

  _openRoundSummaryModal(isGameOver) {
    const s = this.state;
    const sorted = [...s.players].sort((a, b) => {
      if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
      const aLast = a.roundScores[a.roundScores.length - 1] ?? 0;
      const bLast = b.roundScores[b.roundScores.length - 1] ?? 0;
      return aLast - bLast;
    });

    const rowsHtml = sorted
      .map((p) => {
        const isWin = isGameOver && s.winners.includes(p.index);
        return `
          <tr class="${isWin ? 'winner-row' : ''}">
            <td><strong>${this._esc(p.name)}</strong> ${isWin ? '🏆' : ''}</td>
            <td>${p.roundScores[0] ?? '-'}</td>
            <td>${p.roundScores[1] ?? '-'}</td>
            <td>${p.roundScores[2] ?? '-'}</td>
            <td><strong>${p.totalScore}</strong></td>
          </tr>
        `;
      })
      .join('');

    const title = isGameOver
      ? `Fim de Jogo — Vitória de ${s.winners.map((i) => this._esc(s.players[i].name)).join(' e ')}!`
      : `Fim da Rodada ${s.round} de ${s.totalRounds}`;

    const subtitle = isGameOver
      ? 'Menor pontuação total vence! (Desempate: menor pontuação na 3ª rodada).'
      : `Todas as peças retornam à bolsa. <strong>${this._esc(s.players[s.lastRoundSummary.nextStarterIndex].name)}</strong> inicia a Rodada ${s.round + 1}.`;

    const isGuest = this.mode === 'online' && this.online.role === 'guest';
    const actionButtonsHtml = isGuest
      ? isGameOver
        ? `<button class="secondary-btn" id="btn-back-lobby">Sair da Sala</button>
           <span style="font-size:13px;color:#64748b;align-self:center;">Aguardando o anfitrião iniciar nova partida...</span>`
        : `<span style="font-size:13.5px;color:#64748b;align-self:center;">Aguardando o anfitrião iniciar a Rodada ${s.round + 1}...</span>`
      : isGameOver
        ? `<button class="secondary-btn" id="btn-back-lobby">Menu</button>
           <button class="primary-btn" id="btn-play-again">Jogar Novamente</button>`
        : `<button class="primary-btn" id="btn-next-round">Iniciar Rodada ${s.round + 1}</button>`;

    this._showModal(`
      <h2 style="margin-top:0;">${title}</h2>
      <p style="color:#475569;font-size:14px;">${subtitle}</p>
      <table class="score-table">
        <thead><tr><th>Jogador</th><th>R1</th><th>R2</th><th>R3</th><th>Total</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="btn-row">${actionButtonsHtml}</div>
    `);

    if (isGameOver) {
      document.getElementById('btn-back-lobby')?.addEventListener('click', () => {
        this._hideModal();
        document.getElementById('btn-back-menu').click();
      });
      document.getElementById('btn-play-again')?.addEventListener('click', () => {
        this._hideModal();
        if (this.mode === 'online' && this.online.role === 'host') {
          this._startOnlineMatchAsHost();
        } else {
          this._startNewMatch();
        }
      });
    } else if (!isGuest) {
      document.getElementById('btn-next-round')?.addEventListener('click', () => {
        this._hideModal();
        startNextRound(this.state);
        sound.playDeal();
        this._renderAll();
        this._advanceTurnLoop();
      });
    }
  }

  _openManual() {
    this._showModal(getManualHtml());
    document.getElementById('btn-close-manual').addEventListener('click', () => this._hideModal());
  }

  _renderSidePanel() {
    this.el.btnLog.classList.toggle('active', this.sidePanelMode === 'log');

    if (this.sidePanelMode !== 'log' || !this.state) {
      this.el.sidePanel.classList.add('hidden');
      return;
    }

    this.el.sidePanel.classList.remove('hidden');

    const latest = this.state.log[0];
    const lastHandLogs = latest
      ? this.state.log
          .filter((l) => l.round === latest.round && l.dispute === latest.dispute)
          .slice()
          .reverse()
      : [];

    const items = lastHandLogs
      .map((l) => `<div class="log-item"><strong>[R${l.round}•D${l.dispute}]</strong> ${this._esc(l.message)}</div>`)
      .join('');
    this.el.sidePanel.innerHTML = `<h3>Última Mão Jogada</h3><div class="log-list">${items || '<div class="log-item">Nenhuma jogada ainda.</div>'}</div>`;
  }

  _showToast(msg) {
    this.el.disputeToast.textContent = msg;
    this.el.disputeToast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.disputeToast.classList.add('hidden'), 3200);
  }

  _positionMinimizedModal(isMinimized) {
    if (!isMinimized) {
      this.el.modalCard.style.marginTop = '';
      return;
    }
    const arenaRect = this.el.centerArena.getBoundingClientRect();
    const humanRect = this.el.humanZone.getBoundingClientRect();
    const cardHeight = this.el.modalCard.offsetHeight || 132;
    const maxTop = Math.max(80, humanRect.top - cardHeight - 10);
    const idealTop = Math.min(Math.round(arenaRect.bottom + 12), maxTop);
    this.el.modalCard.style.marginTop = `${Math.max(80, idealTop)}px`;
  }

  _bindMinimizeButton() {
    const btn = document.getElementById('btn-toggle-minimize');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isMin = this.el.modalBackdrop.classList.toggle('minimized');
      btn.textContent = isMin ? 'Expandir' : 'Compactar';
      this._positionMinimizedModal(isMin);
    });
  }

  _showModal(html, { minimized = false } = {}) {
    this.el.modalBackdrop.classList.toggle('minimized', minimized);
    this.el.modalCard.innerHTML = html;
    this.el.modalBackdrop.classList.remove('hidden');
    this._positionMinimizedModal(minimized);
  }

  _hideModal() {
    this.el.modalBackdrop.classList.remove('minimized');
    this.el.modalCard.style.marginTop = '';
    this.el.modalBackdrop.classList.add('hidden');
  }

  async _handleGuestAction(guestIdx, msg) {
    if (!this.state || this.online.role !== 'host') return;
    if (msg.type === 'PLAY_TILE') {
      if (this.state.phase !== PHASES.PLAY_TILE || this.state.currentDispute.turnIndex !== guestIdx) return;
      try {
        await this._executePlayTile(guestIdx, msg.tileId);
      } catch (e) {
        // Ignora jogada inválida
      }
      return;
    }

    if (msg.type === 'CHOOSE_COLOR_10') {
      if (this.state.phase !== PHASES.CHOOSE_COLOR_10) return;
      const lastPlay = this.state.currentDispute.plays[this.state.currentDispute.plays.length - 1];
      if (!lastPlay || lastPlay.playerIndex !== guestIdx) return;
      chooseColorAfterTen(this.state, guestIdx, msg.colorId);
      sound.playTileClack(1.2);
      const toastMsg = `${this.state.players[guestIdx].name} jogou 10 e definiu ${COLOR_MAP[msg.colorId].name}!`;
      this._pendingOnlineToast = toastMsg;
      this._showToast(toastMsg);
      this._renderAll();
      await sleep(500);
      this.busy = false;
      this._advanceTurnLoop();
      return;
    }

    if (msg.type === 'CHOOSE_LOWEST_TILE') {
      if (this.state.phase !== PHASES.CHOOSE_LOWEST_TILE) return;
      if (this.state.currentDispute.pendingWinnerIndex !== guestIdx) return;
      const finalRes = finalizeDispute(this.state, msg.tileId);
      await this._afterDisputeFinalized(finalRes, true);
    }
  }

  async _handleGuestStateSync(msg) {
    const firstEnter = !this.state;
    const prevPlaysLen = this.state?.currentDispute?.plays?.length || 0;
    const s = msg.state;

    this.mode = 'online';
    this.state = s;
    this.viewerIndex = this.online.myIndex;
    this.disputeReveal = s.disputeReveal || null;
    this.busy = false;

    if (firstEnter) {
      this.el.lobbyScreen.classList.add('hidden');
      this.el.gameShell.classList.remove('hidden');
      this._hideModal();
      sound.playDeal();
    }

    if (msg.toast) {
      this._showToast(msg.toast);
    }

    const newPlaysLen = s.currentDispute?.plays?.length || 0;
    if (!this.disputeReveal && newPlaysLen > prevPlaysLen) {
      sound.playTileClack(0.98);
    }

    this._renderAll();

    // Se entrou na etapa 3 de revelação da disputa, dispara a animação de voo no convidado após o mesmo intervalo
    if (this.disputeReveal?.step === 'penalty' && this.disputeReveal?.data?.penaltyTile) {
      const penKey = `R${s.round}_D${this.disputeReveal.data.disputeNumber}_${this.disputeReveal.data.penaltyTile.id}`;
      if (this._lastAnimatedPenaltyKey !== penKey) {
        this._lastAnimatedPenaltyKey = penKey;
        sound.playDisputeCollect(this.disputeReveal.data.winnerIndex === this.viewerIndex);
        setTimeout(() => {
          if (this.disputeReveal?.step === 'penalty') {
            this._animatePenaltyTileToWinner(this.disputeReveal.data);
          }
        }, 1900);
      }
    }

    // Abre modais interativos apenas quando o turno/ação for deste convidado (ou fim de rodada/jogo)
    const phaseKey = `${s.round}_${s.disputeNumber}_${s.phase}_${s.currentDispute?.plays?.length || 0}`;
    if (s.phase === PHASES.CHOOSE_COLOR_10) {
      const lastPlay = s.currentDispute.plays[s.currentDispute.plays.length - 1];
      if (lastPlay && lastPlay.playerIndex === this.viewerIndex && this._lastOpenedPhaseKey !== phaseKey) {
        this._lastOpenedPhaseKey = phaseKey;
        sound.playTenSpecial();
        this._openChooseTenColorModal(this.viewerIndex);
      }
    } else if (s.phase === PHASES.CHOOSE_LOWEST_TILE) {
      if (
        !this.disputeReveal &&
        s.currentDispute.pendingWinnerIndex === this.viewerIndex &&
        this._lastOpenedPhaseKey !== phaseKey
      ) {
        this._lastOpenedPhaseKey = phaseKey;
        const winPlay = s.currentDispute.plays.reduce((a, b) => (b.tile.value >= a.tile.value ? b : a));
        this._openChooseLowestTileModal({
          winnerIndex: s.currentDispute.pendingWinnerIndex,
          winningTile: winPlay.tile,
          lowestCandidates: s.currentDispute.lowestCandidates,
        });
      }
    } else if (s.phase === PHASES.ROUND_END && this._lastOpenedPhaseKey !== phaseKey) {
      this._lastOpenedPhaseKey = phaseKey;
      this._openRoundSummaryModal(false);
    } else if (s.phase === PHASES.GAME_OVER && this._lastOpenedPhaseKey !== phaseKey) {
      this._lastOpenedPhaseKey = phaseKey;
      sound.playVictory();
      this._openRoundSummaryModal(true);
    } else if (s.phase === PHASES.PLAY_TILE) {
      if (!this.el.modalBackdrop.classList.contains('hidden')) {
        this._hideModal();
      }
    }
  }

  _handleGuestDisconnectInMatch(guestIdx, name) {
    if (!this.state) return;
    const p = this.state.players[guestIdx];
    if (!p) return;
    p.isHuman = false;
    p.difficulty = this.difficulty || 'tatico';
    const msg = `${name} desconectou — a IA assumiu o lugar.`;
    this._pendingOnlineToast = msg;
    this._showToast(msg);
    this._renderAll();
    if (this.state.phase === PHASES.PLAY_TILE && this.state.currentDispute.turnIndex === guestIdx) {
      this.busy = false;
      this._advanceTurnLoop();
    }
  }

  _handleHostDisconnected() {
    this._showModal(`
      <h2 style="margin-top:0;">Sala Encerrada</h2>
      <p style="color:#475569;font-size:14px;">O anfitrião fechou a sala ou perdeu a conexão.</p>
      <div class="btn-row">
        <button class="primary-btn" id="btn-host-lost-ok">Voltar ao Menu</button>
      </div>
    `);
    document.getElementById('btn-host-lost-ok').addEventListener('click', () => {
      this._hideModal();
      document.getElementById('btn-back-menu').click();
    });
  }

  _handleHostReturnedLobby() {
    this.state = null;
    this.el.gameShell.classList.add('hidden');
    this.el.lobbyScreen.classList.remove('hidden');
    this._enterWaitingRoom();
  }

  _esc(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__impar2D = new Impar2DApp();
});
