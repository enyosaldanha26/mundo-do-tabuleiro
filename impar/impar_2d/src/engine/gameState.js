import { COLORS, COLOR_MAP, PLAYER_CONFIG, PHASES, TOTAL_ROUNDS } from './constants.js';

/**
 * Embaralha um array in-place usando Fisher-Yates.
 * @template T
 * @param {T[]} arr
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Cria o conjunto completo de peças para a partida.
 * Em 3 jogadores, uma cor aleatória (ou especificada) é removida.
 * @param {string[]} activeColorIds
 */
export function createDeck(activeColorIds) {
  const deck = [];
  for (const colorId of activeColorIds) {
    for (let value = 1; value <= 10; value++) {
      deck.push({
        id: `${colorId}_${value}`,
        color: colorId,
        value,
        parity: value % 2 === 0 ? 'even' : 'odd',
      });
    }
  }
  return deck;
}

/**
 * Ordena a mão do jogador por cor e por formato (ímpar/par) mantendo valores ocultos aleatórios dentro da mesma cor+paridade.
 * @param {Array} hand
 * @param {string[]} colorOrder
 */
export function sortHandByColor(hand, colorOrder) {
  const orderIndex = Object.fromEntries(colorOrder.map((c, idx) => [c, idx]));
  // Agrupa por cor e paridade para não vazar a ordem numérica real!
  const grouped = new Map();
  for (const tile of hand) {
    const key = `${orderIndex[tile.color] ?? 99}_${tile.parity}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(tile);
  }
  const sortedKeys = [...grouped.keys()].sort();
  const result = [];
  for (const key of sortedKeys) {
    result.push(...shuffle(grouped.get(key)));
  }
  return result;
}

/**
 * Cria o estado inicial de uma partida de Ímpar.
 * @param {object} options
 * @param {Array<{name: string, isHuman: boolean, difficulty?: string}>} options.players
 * @param {string} [options.removedColor3P] - Cor removida em partidas de 3 jogadores
 * @param {number} [options.startingPlayerIndex] - Índice do jogador inicial da Rodada 1
 * @param {boolean} [options.useParOuImpar] - Se começa com disputa de Par ou Ímpar
 */
export function createMatchState(options) {
  const { players, removedColor3P = null, startingPlayerIndex = 0, useParOuImpar = false } = options;
  const count = players.length;
  if (count < 3 || count > 6) {
    throw new Error(`Número inválido de jogadores: ${count}. Ímpar suporta de 3 a 6 jogadores.`);
  }

  const config = PLAYER_CONFIG[count];
  let activeColors = COLORS.map((c) => c.id);
  let removedColor = null;

  if (count === 3) {
    removedColor =
      removedColor3P && COLOR_MAP[removedColor3P]
        ? removedColor3P
        : activeColors[Math.floor(Math.random() * activeColors.length)];
    activeColors = activeColors.filter((c) => c !== removedColor);
  }

  const state = {
    playerCount: count,
    activeColors,
    removedColor,
    tilesPerPlayer: config.tilesPerPlayer,
    undistributedCount: config.undistributed,
    round: 1,
    totalRounds: TOTAL_ROUNDS,
    disputeNumber: 1,
    totalDisputesPerRound: config.tilesPerPlayer,
    players: players.map((p, idx) => ({
      index: idx,
      name: p.name,
      isHuman: Boolean(p.isHuman),
      difficulty: p.difficulty || 'tatico',
      hand: [],
      penaltyTiles: [],
      roundScores: [], // pontos por rodada já concluída
      totalScore: 0,
    })),
    bagTiles: [],
    discardPile: [],
    currentDispute: {
      leaderIndex: startingPlayerIndex,
      turnIndex: startingPlayerIndex,
      plays: [], // { playerIndex, tile, chosenNextColor? }
      requiredColor: null,
      forcedByTen: false,
      lastPlayedWasTen: false,
      pendingWinnerIndex: null,
      lowestCandidates: [],
    },
    lastDisputeResult: null,
    phase: useParOuImpar ? PHASES.PAR_OU_IMPAR : PHASES.PLAY_TILE,
    log: [],
    winners: [],
  };

  dealRound(state, startingPlayerIndex);
  return state;
}

/**
 * Distribui peças da bolsa para uma nova rodada.
 */
export function dealRound(state, leaderIndex) {
  const deck = shuffle(createDeck(state.activeColors));
  const perPlayer = state.tilesPerPlayer;

  for (let i = 0; i < state.playerCount; i++) {
    const rawHand = deck.slice(i * perPlayer, (i + 1) * perPlayer);
    state.players[i].hand = sortHandByColor(rawHand, state.activeColors);
    state.players[i].penaltyTiles = [];
  }

  state.bagTiles = deck.slice(state.playerCount * perPlayer);
  state.discardPile = [];
  state.disputeNumber = 1;
  state.lastDisputeResult = null;
  state.currentDispute = {
    leaderIndex,
    turnIndex: leaderIndex,
    plays: [],
    requiredColor: null,
    forcedByTen: false,
    lastPlayedWasTen: false,
    pendingWinnerIndex: null,
    lowestCandidates: [],
  };

  if (state.phase !== PHASES.PAR_OU_IMPAR) {
    state.phase = PHASES.PLAY_TILE;
  }

  addLog(
    state,
    `Rodada ${state.round}/${state.totalRounds} iniciada. ${state.players[leaderIndex].name} começa a primeira disputa.`
  );
}

export function addLog(state, message) {
  state.log.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    round: state.round,
    dispute: state.disputeNumber,
    message,
  });
  if (state.log.length > 60) state.log.length = 60;
}

/**
 * Retorna os IDs das peças legais que o jogador da vez pode jogar.
 */
export function getLegalTileIds(state, playerIndex = state.currentDispute.turnIndex) {
  const player = state.players[playerIndex];
  if (!player || player.hand.length === 0) return [];

  const reqColor = state.currentDispute.requiredColor;
  if (!reqColor) {
    return player.hand.map((t) => t.id);
  }

  const matching = player.hand.filter((t) => t.color === reqColor);
  if (matching.length > 0) {
    return matching.map((t) => t.id);
  }

  // Não tem a cor pedida -> pode jogar qualquer peça
  return player.hand.map((t) => t.id);
}

/**
 * Verifica se o jogador tem ao menos uma peça da cor exigida.
 */
export function playerHasRequiredColor(state, playerIndex = state.currentDispute.turnIndex) {
  const reqColor = state.currentDispute.requiredColor;
  if (!reqColor) return true;
  return state.players[playerIndex].hand.some((t) => t.color === reqColor);
}

/**
 * Executa a jogada de uma peça pelo jogador atual.
 * Retorna metadados sobre o que aconteceu para animações e UI.
 */
export function playTile(state, playerIndex, tileId) {
  if (state.phase !== PHASES.PLAY_TILE) {
    throw new Error(`Não é possível jogar peça na fase ${state.phase}`);
  }
  if (playerIndex !== state.currentDispute.turnIndex) {
    throw new Error(`Não é a vez do jogador ${playerIndex}`);
  }

  const legalIds = getLegalTileIds(state, playerIndex);
  if (!legalIds.includes(tileId)) {
    throw new Error(`Jogada ilegal: peça ${tileId}`);
  }

  const player = state.players[playerIndex];
  const tileIdx = player.hand.findIndex((t) => t.id === tileId);
  const [tile] = player.hand.splice(tileIdx, 1);

  const playEntry = {
    playerIndex,
    tile,
    playOrder: state.currentDispute.plays.length,
    chosenNextColor: null,
  };
  state.currentDispute.plays.push(playEntry);

  const isLastPlayOfDispute = state.currentDispute.plays.length === state.playerCount;
  const colorName = COLOR_MAP[tile.color].name;

  addLog(state, `${player.name} jogou ${tile.value} (${colorName}).`);

  // Regra da Peça 10: escolhe a cor para o próximo jogador, exceto se for a última jogada da disputa.
  if (tile.value === 10 && !isLastPlayOfDispute) {
    state.currentDispute.lastPlayedWasTen = true;
    state.phase = PHASES.CHOOSE_COLOR_10;
    return {
      action: 'NEED_COLOR_10',
      playerIndex,
      tile,
      isLastPlayOfDispute,
    };
  }

  // Cor normal a seguir: a cor da última peça jogada
  if (!isLastPlayOfDispute) {
    state.currentDispute.requiredColor = tile.color;
    state.currentDispute.forcedByTen = false;
    state.currentDispute.lastPlayedWasTen = false;
    state.currentDispute.turnIndex = (playerIndex + 1) % state.playerCount;
    return {
      action: 'NEXT_TURN',
      playerIndex,
      tile,
      nextTurnIndex: state.currentDispute.turnIndex,
      requiredColor: tile.color,
    };
  }

  // Última jogada da disputa -> preparar resolução
  return prepareDisputeResolution(state);
}

/**
 * Define a cor escolhida após jogar uma peça 10.
 */
export function chooseColorAfterTen(state, playerIndex, colorId) {
  if (state.phase !== PHASES.CHOOSE_COLOR_10) {
    throw new Error(`Fase inválida para escolher cor do 10: ${state.phase}`);
  }
  const lastPlay = state.currentDispute.plays[state.currentDispute.plays.length - 1];
  if (!lastPlay || lastPlay.playerIndex !== playerIndex) {
    throw new Error('Jogador incorreto tentando escolher cor do 10.');
  }
  if (!state.activeColors.includes(colorId)) {
    throw new Error(`Cor inativa ou inválida: ${colorId}`);
  }

  lastPlay.chosenNextColor = colorId;
  state.currentDispute.requiredColor = colorId;
  state.currentDispute.forcedByTen = true;
  state.currentDispute.turnIndex = (playerIndex + 1) % state.playerCount;
  state.phase = PHASES.PLAY_TILE;

  addLog(
    state,
    `${state.players[playerIndex].name} usou o efeito do 10 e definiu ${COLOR_MAP[colorId].name} como a próxima cor.`
  );

  return {
    action: 'COLOR_10_CHOSEN',
    playerIndex,
    chosenColor: colorId,
    nextTurnIndex: state.currentDispute.turnIndex,
  };
}

/**
 * Determina o vencedor da disputa atual e verifica se há empate no menor valor.
 */
function prepareDisputeResolution(state) {
  const plays = state.currentDispute.plays;

  // Maior valor vence; empate -> quem jogou por último (>=)
  let winningPlay = plays[0];
  for (const p of plays) {
    if (p.tile.value >= winningPlay.tile.value) {
      winningPlay = p;
    }
  }

  const minVal = Math.min(...plays.map((p) => p.tile.value));
  const lowestPlays = plays.filter((p) => p.tile.value === minVal);

  state.currentDispute.pendingWinnerIndex = winningPlay.playerIndex;
  state.currentDispute.lowestCandidates = lowestPlays.map((p) => p.tile);

  if (lowestPlays.length > 1) {
    state.phase = PHASES.CHOOSE_LOWEST_TILE;
    addLog(
      state,
      `${state.players[winningPlay.playerIndex].name} venceu a disputa com ${winningPlay.tile.value} e deve escolher uma peça de menor valor (${minVal}).`
    );
    return {
      action: 'NEED_LOWEST_CHOICE',
      winnerIndex: winningPlay.playerIndex,
      winningTile: winningPlay.tile,
      lowestCandidates: lowestPlays.map((p) => p.tile),
    };
  }

  return finalizeDispute(state, lowestPlays[0].tile.id);
}

/**
 * Conclui a disputa atribuindo a peça de menor valor ao vencedor e descartando as demais.
 */
export function finalizeDispute(state, chosenLowestTileId) {
  const winnerIndex = state.currentDispute.pendingWinnerIndex;
  const plays = state.currentDispute.plays;
  const chosenPlay = plays.find((p) => p.tile.id === chosenLowestTileId);

  if (!chosenPlay) {
    throw new Error(`Peça de menor valor inválida: ${chosenLowestTileId}`);
  }

  const winner = state.players[winnerIndex];
  const penaltyTile = chosenPlay.tile;
  const discardedTiles = plays.filter((p) => p.tile.id !== penaltyTile.id).map((p) => p.tile);

  winner.penaltyTiles.push(penaltyTile);
  state.discardPile.push(...discardedTiles);

  const highestTile = plays.reduce((acc, p) => (p.tile.value >= acc.value ? p.tile : acc), plays[0].tile);

  state.lastDisputeResult = {
    disputeNumber: state.disputeNumber,
    winnerIndex,
    winningTile: highestTile,
    penaltyTile,
    discardedTiles,
    plays: [...plays],
  };

  addLog(
    state,
    `${winner.name} venceu a disputa (${highestTile.value}) e recebeu ${penaltyTile.value} (${COLOR_MAP[penaltyTile.color].name}) como pontuação.`
  );

  // Verifica fim da rodada
  const allEmpty = state.players.every((p) => p.hand.length === 0);
  if (allEmpty) {
    return finishRound(state, winnerIndex);
  }

  // Próxima disputa na mesma rodada
  state.disputeNumber += 1;
  state.currentDispute = {
    leaderIndex: winnerIndex,
    turnIndex: winnerIndex,
    plays: [],
    requiredColor: null,
    forcedByTen: false,
    lastPlayedWasTen: false,
    pendingWinnerIndex: null,
    lowestCandidates: [],
  };
  state.phase = PHASES.PLAY_TILE;

  return {
    action: 'DISPUTE_FINISHED',
    winnerIndex,
    penaltyTile,
    discardedTiles,
    nextLeaderIndex: winnerIndex,
  };
}

/**
 * Soma os pontos da rodada e verifica se o jogo terminou (3 rodadas).
 */
function finishRound(state, lastDisputeWinnerIndex) {
  const roundSummary = state.players.map((p) => {
    const pts = p.penaltyTiles.reduce((sum, t) => sum + t.value, 0);
    p.roundScores.push(pts);
    p.totalScore = p.roundScores.reduce((sum, s) => sum + s, 0);
    return {
      playerIndex: p.index,
      name: p.name,
      roundPoints: pts,
      totalScore: p.totalScore,
      penaltyTiles: [...p.penaltyTiles],
    };
  });

  state.lastRoundSummary = {
    round: state.round,
    nextStarterIndex: lastDisputeWinnerIndex,
    scores: roundSummary,
  };

  addLog(state, `Fim da Rodada ${state.round}! Pontos registrados.`);

  if (state.round >= state.totalRounds) {
    state.phase = PHASES.GAME_OVER;
    state.winners = computeMatchWinners(state.players);
    const names = state.winners.map((idx) => state.players[idx].name).join(' e ');
    addLog(state, `Fim de Jogo! Vitória de ${names}!`);
    return {
      action: 'GAME_OVER',
      roundSummary,
      winners: state.winners,
    };
  }

  state.phase = PHASES.ROUND_END;
  return {
    action: 'ROUND_END',
    roundSummary,
    nextStarterIndex: lastDisputeWinnerIndex,
  };
}

/**
 * Avança para a próxima rodada após a tela de resumo da rodada.
 */
export function startNextRound(state) {
  if (state.phase !== PHASES.ROUND_END) {
    throw new Error(`Não é possível iniciar próxima rodada na fase ${state.phase}`);
  }
  const nextStarter = state.lastRoundSummary.nextStarterIndex;
  state.round += 1;
  state.phase = PHASES.PLAY_TILE;
  dealRound(state, nextStarter);
  return state;
}

/**
 * Calcula o(s) vencedor(es) ao final das 3 rodadas.
 * Menor pontuação total vence; desempate pela menor pontuação na última rodada.
 */
export function computeMatchWinners(players) {
  const minTotal = Math.min(...players.map((p) => p.totalScore));
  const tiedTotal = players.filter((p) => p.totalScore === minTotal);
  if (tiedTotal.length === 1) return [tiedTotal[0].index];

  const minLastRound = Math.min(...tiedTotal.map((p) => p.roundScores[p.roundScores.length - 1] ?? 0));
  return tiedTotal
    .filter((p) => (p.roundScores[p.roundScores.length - 1] ?? 0) === minLastRound)
    .map((p) => p.index);
}
