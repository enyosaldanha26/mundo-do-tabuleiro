import {
  AI_DIFFICULTIES,
  COLOR_MAP,
  DEFAULT_AI_NAMES,
  PHASES,
} from './engine/constants.js';
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
import { ImparTableScene } from './scene/tableScene.js';
import { sound } from './audio/sound.js';
import { getColorSymbolSvg, getManualHtml } from './ui/symbols.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ImparApp {
  constructor() {
    this.mode = 'solo'; // 'solo' | 'local'
    this.playerCount = 4;
    this.difficulty = 'tatico';
    this.state = null;
    this.viewerIndex = 0;
    this.busy = false;
    this.soundMuted = false;
    this.sidePanelMode = null; // null | 'tracker' | 'log'
    this.toastTimer = null;

    this._cacheDom();
    this._initScene();
    this._bindLobby();
    this._bindHud();
    this._startSeatLabelLoop();
  }

  _cacheDom() {
    this.el = {
      canvasContainer: document.getElementById('canvas-container'),
      topbar: document.getElementById('topbar'),
      hudRound: document.getElementById('hud-round'),
      hudDispute: document.getElementById('hud-dispute'),
      hudBag: document.getElementById('hud-bag'),
      hudRemovedWrap: document.getElementById('hud-removed-wrap'),
      reqColorPill: document.getElementById('hud-required-color'),
      reqColorDot: document.getElementById('req-color-dot'),
      reqColorText: document.getElementById('req-color-text'),
      seatLabels: document.getElementById('seat-labels'),
      disputeToast: document.getElementById('dispute-toast'),
      sidePanel: document.getElementById('side-panel'),
      bottomHud: document.getElementById('bottom-hud'),
      hoverTooltip: document.getElementById('hover-tooltip'),
      turnBanner: document.getElementById('turn-banner'),
      lobbyOverlay: document.getElementById('lobby-overlay'),
      modeSelect: document.getElementById('mode-select'),
      countSelect: document.getElementById('count-select'),
      diffSelect: document.getElementById('diff-select'),
      difficultySection: document.getElementById('difficulty-section'),
      namesLabel: document.getElementById('names-label'),
      namesContainer: document.getElementById('player-names-container'),
      chkParImpar: document.getElementById('chk-par-impar'),
      modalBackdrop: document.getElementById('modal-backdrop'),
      modalCard: document.getElementById('modal-card'),
      btnTracker: document.getElementById('btn-toggle-tracker'),
      btnLog: document.getElementById('btn-toggle-log'),
      btnSound: document.getElementById('btn-toggle-sound'),
    };
  }

  _initScene() {
    this.tableScene = new ImparTableScene(this.el.canvasContainer, {
      onTileClick: (tileId) => this._handleHumanTileClick(tileId),
      onTileHover: (tile) => this._handleTileHover(tile),
    });
    this.tableScene.setIdlePreview(true);
  }

  _bindLobby() {
    this.el.modeSelect.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      this.mode = btn.dataset.mode;
      this._updateSegmented(this.el.modeSelect, btn);
      this.el.difficultySection.classList.toggle('hidden', this.mode !== 'solo');
      this._renderNameInputs();
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
    document.getElementById('btn-start-match').addEventListener('click', () => this._startNewMatch());
  }

  _updateSegmented(container, selectedBtn) {
    container.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('selected'));
    selectedBtn.classList.add('selected');
  }

  _renderNameInputs() {
    if (this.mode === 'solo') {
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
    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => this.tableScene.setCameraPreset(btn.dataset.cam));
    });

    this.el.btnTracker.addEventListener('click', () => {
      this.sidePanelMode = this.sidePanelMode === 'tracker' ? null : 'tracker';
      this._renderSidePanel();
    });

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
    this.el.btnSound.classList.add('active');

    document.getElementById('btn-back-menu').addEventListener('click', () => {
      this.state = null;
      this.busy = false;
      this.sidePanelMode = null;
      this._renderSidePanel();
      this.el.topbar.classList.add('hidden');
      this.el.bottomHud.classList.add('hidden');
      this.el.seatLabels.innerHTML = '';
      this.el.lobbyOverlay.classList.remove('hidden');
      this.tableScene.setCameraPreset('overview');
      this.tableScene.setIdlePreview(true);
    });
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

    const useParImpar = this.el.chkParImpar.checked;
    this.state = createMatchState({
      players,
      startingPlayerIndex: 0,
      useParOuImpar: useParImpar,
    });
    this.viewerIndex = 0;
    this.busy = false;

    this.el.lobbyOverlay.classList.add('hidden');
    this.el.topbar.classList.remove('hidden');
    this.el.bottomHud.classList.remove('hidden');

    sound.playDeal();
    this.tableScene.setCameraPreset('overview');
    this._syncAll();

    if (useParImpar) {
      this._openParOuImparModal();
    } else {
      this._advanceTurnLoop();
    }
  }

  _openParOuImparModal() {
    const p0 = this.state.players[0].name;
    const p1 = this.state.players[1].name;
    this._showModal(`
      <h2 style="margin-top:0;">Par ou Ímpar — Jogador Inicial</h2>
      <p style="color:#cbd5e1;font-size:14px;">Conforme o manual, quem vencer a disputa de Par ou Ímpar inicia a 1ª rodada! Escolha sua opção e um número de dedos:</p>
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
      <div id="poi-result" style="min-height:24px;font-weight:700;color:#fbbf24;"></div>
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

      await sleep(1300);
      this._hideModal();
      this._syncAll();
      this._advanceTurnLoop();
    });
  }

  _syncAll() {
    if (!this.state) return;
    const s = this.state;

    // Top bar stats
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

    // Cor exigida
    const req = s.currentDispute.requiredColor;
    if (req && COLOR_MAP[req]) {
      const c = COLOR_MAP[req];
      this.el.reqColorDot.style.background = c.hex;
      this.el.reqColorDot.style.color = c.hex;
      this.el.reqColorText.textContent = s.currentDispute.forcedByTen
        ? `Efeito do 10: Seguir ${c.name}`
        : `Cor a seguir: ${c.name}`;
      this.el.reqColorPill.style.borderColor = c.hex;
    } else {
      this.el.reqColorDot.style.background = '#94a3b8';
      this.el.reqColorDot.style.color = '#94a3b8';
      this.el.reqColorText.textContent = 'Cor livre (1ª jogada)';
      this.el.reqColorPill.style.borderColor = 'rgba(255,255,255,0.12)';
    }

    // Banner inferior
    const turnPlayer = s.players[s.currentDispute.turnIndex];
    const isHumanTurn =
      !this.busy &&
      s.phase === PHASES.PLAY_TILE &&
      turnPlayer.isHuman &&
      s.currentDispute.turnIndex === this.viewerIndex;

    this.el.turnBanner.classList.toggle('your-turn', isHumanTurn);
    const viewerPlayer = s.players[this.viewerIndex];
    const viewerRoundPts = viewerPlayer.penaltyTiles.reduce((sum, t) => sum + t.value, 0);
    const viewerScoreChip = `<span style="color:#94a3b8;font-size:12.5px;border-left:1px solid rgba(255,255,255,0.14);padding-left:10px;">${this._esc(viewerPlayer.name)}: <strong>${viewerRoundPts}</strong> pts (Total <strong>${viewerPlayer.totalScore + viewerRoundPts}</strong>)</span>`;

    if (s.phase === PHASES.PLAY_TILE) {
      if (isHumanTurn) {
        if (!req) {
          this.el.turnBanner.innerHTML = `<span>Sua vez! Escolha qualquer peça para abrir a disputa.</span>${viewerScoreChip}`;
        } else if (playerHasRequiredColor(s, this.viewerIndex)) {
          this.el.turnBanner.innerHTML = `<span>Sua vez! Jogue uma peça <strong style="color:${COLOR_MAP[req].lightHex}">${COLOR_MAP[req].name}</strong>.</span>${viewerScoreChip}`;
        } else {
          this.el.turnBanner.innerHTML = `<span>Você não tem <strong>${COLOR_MAP[req].name}</strong> — jogue qualquer peça!</span>${viewerScoreChip}`;
        }
      } else {
        this.el.turnBanner.innerHTML = `<span>Vez de <strong>${this._esc(turnPlayer.name)}</strong>...</span>${viewerScoreChip}`;
      }
    } else if (s.phase === PHASES.CHOOSE_COLOR_10) {
      this.el.turnBanner.innerHTML = `<span>${this._esc(turnPlayer.name)} jogou um 10 e está escolhendo a cor...</span>${viewerScoreChip}`;
    } else if (s.phase === PHASES.CHOOSE_LOWEST_TILE) {
      this.el.turnBanner.innerHTML = `<span>${this._esc(s.players[s.currentDispute.pendingWinnerIndex].name)} venceu e escolhe a menor peça...</span>${viewerScoreChip}`;
    }

    const legalIds = isHumanTurn ? getLegalTileIds(s, this.viewerIndex) : [];
    this.tableScene.syncState(s, {
      viewerIndex: this.viewerIndex,
      legalTileIds: legalIds,
      interactive: isHumanTurn,
    });

    this._renderSidePanel();
  }

  _handleTileHover(tile) {
    if (!tile) {
      this.el.hoverTooltip.classList.add('hidden');
      return;
    }
    const c = COLOR_MAP[tile.color];
    const parityLabel = tile.parity === 'even' ? 'Par (2, 4, 6, 8 ou 10)' : 'Ímpar (1, 3, 5, 7 ou 9)';
    const status = tile.isLegal ? 'Clique para jogar' : `Precisa seguir ${COLOR_MAP[this.state.currentDispute.requiredColor]?.name}`;
    this.el.hoverTooltip.innerHTML = `
      <span class="color-dot" style="width:12px;height:12px;background:${c.hex};color:${c.hex}"></span>
      <span><strong>${c.name}</strong> • ${parityLabel}</span>
      <span style="color:#94a3b8">| ${status}</span>
    `;
    this.el.hoverTooltip.classList.remove('hidden');
    sound.playHoverTick();
  }

  async _handleHumanTileClick(tileId) {
    if (this.busy || !this.state || this.state.phase !== PHASES.PLAY_TILE) return;
    if (this.state.currentDispute.turnIndex !== this.viewerIndex) return;

    this.busy = true;
    this.el.hoverTooltip.classList.add('hidden');
    const result = playTile(this.state, this.viewerIndex, tileId);
    sound.playTileClack(1.0);
    this._syncAll();

    await this._handlePlayOutcome(result);
  }

  async _handlePlayOutcome(result) {
    if (result.action === 'NEED_COLOR_10') {
      sound.playTenSpecial();
      if (this.state.players[result.playerIndex].isHuman) {
        this._openChooseTenColorModal(result.playerIndex);
        return;
      }
      await sleep(750);
      const aiColor = chooseAIColorAfterTen(this.state, result.playerIndex);
      chooseColorAfterTen(this.state, result.playerIndex, aiColor);
      this._showToast(`${this.state.players[result.playerIndex].name} jogou 10 e exigiu: ${COLOR_MAP[aiColor].name}!`);
      this._syncAll();
      await sleep(700);
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
      await sleep(1100);
      if (this.state.players[result.winnerIndex].isHuman) {
        this._openChooseLowestTileModal(result);
        return;
      }
      const pickedId = chooseAILowestTile(this.state);
      const finalRes = finalizeDispute(this.state, pickedId);
      await this._afterDisputeFinalized(finalRes);
      return;
    }

    if (result.action === 'DISPUTE_FINISHED' || result.action === 'ROUND_END' || result.action === 'GAME_OVER') {
      await sleep(1150);
      await this._afterDisputeFinalized(result);
    }
  }

  async _afterDisputeFinalized(res) {
    const last = this.state.lastDisputeResult;
    if (last) {
      const winner = this.state.players[last.winnerIndex];
      const pen = last.penaltyTile;
      sound.playDisputeCollect(winner.isHuman && last.winnerIndex === 0);
      this._showToast(
        `${winner.name} venceu a disputa (${last.winningTile.value}) e marcou ${pen.value} pt${pen.value > 1 ? 's' : ''} (${COLOR_MAP[pen.color].name}).`
      );
    }
    this._syncAll();
    await sleep(950);

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

    // Modo Local (Passar o PC): troca o ponto de vista com tela de privacidade se mudou de jogador
    if (this.mode === 'local' && turnPlayer.isHuman && turnIdx !== this.viewerIndex) {
      this._openPassDeviceModal(turnIdx);
      return;
    }

    if (turnPlayer.isHuman) {
      this._syncAll();
      return;
    }

    // Turno da IA
    this.busy = true;
    this._syncAll();
    await sleep(750);
    if (!this.state) return;

    const chosenId = chooseAITile(this.state, turnIdx);
    const result = playTile(this.state, turnIdx, chosenId);
    sound.playTileClack(0.92 + Math.random() * 0.16);
    this._syncAll();

    await this._handlePlayOutcome(result);
  }

  _openChooseTenColorModal(playerIndex) {
    const buttonsHtml = this.state.activeColors
      .map((cid) => {
        const c = COLOR_MAP[cid];
        return `
          <button class="color-choice-btn" data-color="${cid}" style="background:${c.hex};">
            ${getColorSymbolSvg(cid, 36, '#FFFFFF')}
            <span>${c.name}</span>
          </button>
        `;
      })
      .join('');

    this._showModal(`
      <div class="modal-header-row">
        <h2>Peça 10 — Escolha a Próxima Cor!</h2>
        <button class="icon-btn" id="btn-toggle-minimize">Expandir</button>
      </div>
      <p class="modal-desc" style="color:#cbd5e1;font-size:14px;margin:10px 0 0 0;">Você jogou um <strong>10</strong>. Selecione qual cor o próximo jogador deverá seguir:</p>
      <div class="color-picker-grid">${buttonsHtml}</div>
    `, { minimized: true });
    this._bindMinimizeButton();

    this.el.modalCard.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cid = btn.dataset.color;
        this._hideModal();
        chooseColorAfterTen(this.state, playerIndex, cid);
        sound.playTileClack(1.2);
        this._showToast(`Você definiu a próxima cor: ${COLOR_MAP[cid].name}`);
        this._syncAll();
        await sleep(550);
        this.busy = false;
        this._advanceTurnLoop();
      });
    });
  }

  _openChooseLowestTileModal(res) {
    const cardsHtml = res.lowestCandidates
      .map((t) => {
        const c = COLOR_MAP[t.color];
        const isOdd = t.parity === 'odd';
        return `
          <button class="mini-tile-btn ${isOdd ? 'odd-shape' : ''}" data-pick="${t.id}" style="background:${c.hex};">
            <span>${t.value}</span>
            <span style="font-size:11px;font-weight:700;">${c.name}</span>
          </button>
        `;
      })
      .join('');

    this._showModal(`
      <div class="modal-header-row">
        <h2>Empate no Menor Valor!</h2>
        <button class="icon-btn" id="btn-toggle-minimize">Expandir</button>
      </div>
      <p class="modal-desc" style="color:#cbd5e1;font-size:14px;margin:10px 0 0 0;">Você venceu a disputa com <strong>${res.winningTile.value}</strong> e há mais de uma peça de menor valor. Escolha qual peça colocar na sua pontuação:</p>
      <div class="tile-picker-grid">${cardsHtml}</div>
    `, { minimized: true });
    this._bindMinimizeButton();

    this.el.modalCard.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pickedId = btn.dataset.pick;
        this._hideModal();
        const finalRes = finalizeDispute(this.state, pickedId);
        await this._afterDisputeFinalized(finalRes);
      });
    });
  }

  _openPassDeviceModal(nextIdx) {
    const nextName = this.state.players[nextIdx].name;
    this._showModal(`
      <div style="text-align:center;padding:14px 0;">
        <h2 style="margin-top:0;">Passe o Computador</h2>
        <p style="color:#cbd5e1;font-size:15px;">Agora é a vez de <strong style="color:#fbbf24;">${this._esc(nextName)}</strong>.</p>
        <p style="color:#94a3b8;font-size:13px;">Certifique-se de que os outros jogadores não estão olhando para a tela.</p>
        <div class="btn-row" style="justify-content:center;">
          <button class="primary-btn" id="btn-reveal-turn" style="max-width:280px;">Sou ${this._esc(nextName)} — Jogar</button>
        </div>
      </div>
    `);
    document.getElementById('btn-reveal-turn').addEventListener('click', () => {
      this._hideModal();
      this.viewerIndex = nextIdx;
      this._syncAll();
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
        const r1 = p.roundScores[0] ?? '-';
        const r2 = p.roundScores[1] ?? '-';
        const r3 = p.roundScores[2] ?? '-';
        return `
          <tr class="${isWin ? 'winner-row' : ''}">
            <td><strong>${this._esc(p.name)}</strong> ${isWin ? '🏆' : ''}</td>
            <td>${r1}</td>
            <td>${r2}</td>
            <td>${r3}</td>
            <td><strong>${p.totalScore}</strong></td>
          </tr>
        `;
      })
      .join('');

    const title = isGameOver
      ? `Fim de Jogo — Vitória de ${s.winners.map((i) => this._esc(s.players[i].name)).join(' e ')}!`
      : `Fim da Rodada ${s.round} de ${s.totalRounds}`;

    const subtitle = isGameOver
      ? 'Menor pontuação total vence! (Critério de desempate: menor pontuação na 3ª rodada).'
      : `Todas as peças retornam à bolsa. <strong>${this._esc(s.players[s.lastRoundSummary.nextStarterIndex].name)}</strong> venceu a última disputa e começará a Rodada ${s.round + 1}.`;

    this._showModal(`
      <h2 style="margin-top:0;">${title}</h2>
      <p style="color:#cbd5e1;font-size:14px;">${subtitle}</p>
      <table class="score-table">
        <thead>
          <tr><th>Jogador</th><th>R1</th><th>R2</th><th>R3</th><th>Total</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="btn-row">
        ${
          isGameOver
            ? `<button class="secondary-btn" id="btn-back-lobby">Voltar ao Menu</button>
               <button class="primary-btn" id="btn-play-again">Jogar Novamente</button>`
            : `<button class="primary-btn" id="btn-next-round">Iniciar Rodada ${s.round + 1}</button>`
        }
      </div>
    `);

    if (isGameOver) {
      document.getElementById('btn-back-lobby').addEventListener('click', () => {
        this._hideModal();
        document.getElementById('btn-back-menu').click();
      });
      document.getElementById('btn-play-again').addEventListener('click', () => {
        this._hideModal();
        this._startNewMatch();
      });
    } else {
      document.getElementById('btn-next-round').addEventListener('click', () => {
        this._hideModal();
        startNextRound(this.state);
        sound.playDeal();
        this._syncAll();
        this._advanceTurnLoop();
      });
    }
  }

  _openManual() {
    this._showModal(getManualHtml());
    document.getElementById('btn-close-manual').addEventListener('click', () => this._hideModal());
  }

  _renderSidePanel() {
    this.el.btnTracker.classList.toggle('active', this.sidePanelMode === 'tracker');
    this.el.btnLog.classList.toggle('active', this.sidePanelMode === 'log');

    if (!this.sidePanelMode || !this.state) {
      this.el.sidePanel.classList.add('hidden');
      return;
    }

    this.el.sidePanel.classList.remove('hidden');

    if (this.sidePanelMode === 'log') {
      const items = this.state.log
        .slice(0, 20)
        .map((l) => `<div class="log-item"><strong>[R${l.round}•D${l.dispute}]</strong> ${this._esc(l.message)}</div>`)
        .join('');
      this.el.sidePanel.innerHTML = `
        <h3>Histórico da Partida</h3>
        <div class="log-list">${items || '<div class="log-item">Nenhuma jogada ainda.</div>'}</div>
      `;
      return;
    }

    // Rastreador de peças VISÍVEIS (mãos dos oponentes + disputa atual + pontuações). Nunca revela descarte secreto!
    const seenHand = new Set();
    const seenTable = new Set();
    for (let i = 0; i < this.state.playerCount; i++) {
      if (i !== this.viewerIndex) {
        this.state.players[i].hand.forEach((t) => seenHand.add(t.id));
      } else {
        this.state.players[i].penaltyTiles.forEach((t) => seenTable.add(t.id));
      }
    }
    this.state.currentDispute.plays.forEach((p) => seenTable.add(p.tile.id));

    const rows = this.state.activeColors
      .map((cid) => {
        const c = COLOR_MAP[cid];
        const cells = [];
        for (let v = 1; v <= 10; v++) {
          const id = `${cid}_${v}`;
          const cls = seenHand.has(id) ? 'seen-hand' : seenTable.has(id) ? 'seen-table' : '';
          cells.push(`<div class="tracker-cell ${cls}">${v}</div>`);
        }
        return `
          <div class="tracker-row">
            <div class="tracker-row-title">
              <span class="color-dot" style="width:10px;height:10px;background:${c.hex};color:${c.hex}"></span>
              <span>${c.name}</span>
            </div>
            <div class="tracker-nums">${cells.join('')}</div>
          </div>
        `;
      })
      .join('');

    this.el.sidePanel.innerHTML = `
      <h3>Peças Visíveis na Mesa</h3>
      <p style="font-size:11.5px;color:#94a3b8;margin:0 0 10px 0;">
        Azul = nas mãos dos oponentes<br/>Amarelo = na mesa/pontuação<br/>Escuro = sua mão, bolsa ou descarte oculto
      </p>
      ${rows}
    `;
  }

  _showToast(msg) {
    this.el.disputeToast.textContent = msg;
    this.el.disputeToast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.disputeToast.classList.add('hidden');
    }, 3400);
  }

  _bindMinimizeButton() {
    const btn = document.getElementById('btn-toggle-minimize');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isMin = this.el.modalBackdrop.classList.toggle('minimized');
      btn.textContent = isMin ? 'Expandir' : 'Compactar';
    });
  }

  _showModal(html, { minimized = false } = {}) {
    this.el.modalBackdrop.classList.toggle('minimized', minimized);
    this.el.modalCard.innerHTML = html;
    this.el.modalBackdrop.classList.remove('hidden');
  }

  _hideModal() {
    this.el.modalBackdrop.classList.remove('minimized');
    this.el.modalBackdrop.classList.add('hidden');
  }

  _startSeatLabelLoop() {
    const updateLabels = () => {
      requestAnimationFrame(updateLabels);
      if (!this.state) return;

      const projected = this.tableScene.getProjectedSeatPositions();
      const s = this.state;

      if (this.el.seatLabels.childElementCount !== projected.length) {
        this.el.seatLabels.innerHTML = projected
          .map(() => `<div class="seat-badge"></div>`)
          .join('');
      }

      const children = this.el.seatLabels.children;
      projected.forEach((p, idx) => {
        const badge = children[idx];
        // O assento inferior (relIdx === 0) já exibe turno e pontos no banner inferior para evitar sobreposição
        if (!badge || !p.visible || p.relIdx === 0) {
          if (badge) badge.style.display = 'none';
          return;
        }
        const player = s.players[p.playerIndex];
        const roundPts = player.penaltyTiles.reduce((sum, t) => sum + t.value, 0);
        const isTurn = s.phase === PHASES.PLAY_TILE && s.currentDispute.turnIndex === p.playerIndex;
        badge.style.display = 'block';
        badge.style.left = `${p.x}px`;
        badge.style.top = `${p.y}px`;
        badge.className = `seat-badge ${isTurn ? 'active-turn' : ''}`;
        badge.innerHTML = `
          <div class="seat-name">
            <span>${this._esc(player.name)}</span>
            ${isTurn ? '<span class="turn-tag">Vez</span>' : ''}
          </div>
          <div class="seat-meta">
            <span>Rodada: <strong>?</strong></span>
            <span>Total: <strong>${player.totalScore}</strong></span>
          </div>
        `;
      });
    };
    requestAnimationFrame(updateLabels);
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
  window.__imparApp = new ImparApp();
});
