import { getLegalTileIds } from './gameState.js';

/**
 * IA honesta para o jogo Ímpar.
 * Nunca lê o `.value` das próprias peças na mão: deduz probabilidades
 * observando as frentes visíveis dos oponentes, pontuações e jogadas da disputa.
 */

const EVEN_VALUES = [2, 4, 6, 8, 10];
const ODD_VALUES = [1, 3, 5, 7, 9];

/**
 * Estima os valores possíveis e o valor esperado de uma peça própria (sabendo apenas cor e paridade).
 */
function estimateOwnTile(state, aiIndex, tile, rememberedTileIds) {
  const pool = tile.parity === 'even' ? EVEN_VALUES : ODD_VALUES;
  const knownValues = new Set();

  // 1. O que está visível nas mãos dos oponentes
  for (let i = 0; i < state.playerCount; i++) {
    if (i === aiIndex) continue;
    for (const oppTile of state.players[i].hand) {
      if (oppTile.color === tile.color && oppTile.parity === tile.parity) {
        knownValues.add(oppTile.value);
      }
    }
  }

  // 2. Pontuação da rodada: própria (aberta para o dono) + memória das peças fechadas dos oponentes
  for (const pen of state.players[aiIndex].penaltyTiles) {
    if (pen.color === tile.color && pen.parity === tile.parity) {
      knownValues.add(pen.value);
    }
  }
  if (rememberedTileIds) {
    for (let i = 0; i < state.playerCount; i++) {
      if (i === aiIndex) continue;
      for (const pen of state.players[i].penaltyTiles) {
        if (rememberedTileIds.has(pen.id) && pen.color === tile.color && pen.parity === tile.parity) {
          knownValues.add(pen.value);
        }
      }
    }
  }

  // 3. O que já foi jogado na disputa atual
  for (const play of state.currentDispute.plays) {
    if (play.tile.color === tile.color && play.tile.parity === tile.parity) {
      knownValues.add(play.tile.value);
    }
  }

  // 4. Memória de cartas descartadas nesta rodada (usada por Tático/Mestre)
  if (rememberedTileIds) {
    for (const d of state.discardPile) {
      if (rememberedTileIds.has(d.id) && d.color === tile.color && d.parity === tile.parity) {
        knownValues.add(d.value);
      }
    }
  }

  const candidates = pool.filter((v) => !knownValues.has(v));
  const finalCandidates = candidates.length > 0 ? candidates : pool;
  const expected = finalCandidates.reduce((s, v) => s + v, 0) / finalCandidates.length;
  const probTen = finalCandidates.includes(10) ? 1 / finalCandidates.length : 0;

  return {
    candidates: finalCandidates,
    expected,
    minPossible: finalCandidates[0],
    maxPossible: finalCandidates[finalCandidates.length - 1],
    probTen,
  };
}

/**
 * Constrói o conjunto de IDs descartados que a IA consegue lembrar conforme sua dificuldade.
 */
function getRememberedDiscards(state, difficulty) {
  if (difficulty === 'casual') return null;
  const remembered = new Set();
  const chance = difficulty === 'mestre' ? 0.92 : 0.55;
  // Usa determinismo leve baseado no id + rodada para não oscilar a cada frame
  for (const d of state.discardPile) {
    let hash = 0;
    for (let i = 0; i < d.id.length; i++) hash = (hash * 31 + d.id.charCodeAt(i)) % 100;
    if (hash / 100 < chance) {
      remembered.add(d.id);
    }
  }
  return remembered;
}

/**
 * Escolhe qual peça a IA deve jogar.
 */
export function chooseAITile(state, aiIndex) {
  const player = state.players[aiIndex];
  const legalIds = getLegalTileIds(state, aiIndex);
  if (legalIds.length === 1) return legalIds[0];

  const difficulty = player.difficulty || 'tatico';
  const legalTiles = player.hand.filter((t) => legalIds.includes(t.id));

  if (difficulty === 'casual') {
    // Casual: leve preferência por ímpares (menores) mas com bastante aleatoriedade
    const oddLegal = legalTiles.filter((t) => t.parity === 'odd');
    if (oddLegal.length > 0 && Math.random() < 0.65) {
      return oddLegal[Math.floor(Math.random() * oddLegal.length)].id;
    }
    return legalTiles[Math.floor(Math.random() * legalTiles.length)].id;
  }

  const remembered = getRememberedDiscards(state, difficulty);
  const plays = state.currentDispute.plays;
  const isFirst = plays.length === 0;
  const isLast = plays.length === state.playerCount - 1;
  const currentMax = isFirst ? 0 : Math.max(...plays.map((p) => p.tile.value));
  const currentMin = isFirst ? 10 : Math.min(...plays.map((p) => p.tile.value));

  // Avalia se há algum oponente que ainda joga depois com 10 ou 9 visível na cor provável
  const remainingPlayers = [];
  for (let offset = 1; offset < state.playerCount - plays.length; offset++) {
    remainingPlayers.push(state.players[(aiIndex + offset) % state.playerCount]);
  }

  let bestTile = legalTiles[0];
  let bestScore = -Infinity;

  for (const tile of legalTiles) {
    const est = estimateOwnTile(state, aiIndex, tile, remembered);
    let score = 0;

    if (isLast) {
      // Último a jogar: empatar ou superar currentMax faz vencer! (>= vence)
      const winProb =
        est.candidates.filter((v) => v >= currentMax).length / est.candidates.length;
      const expectedPenaltyIfWin = Math.min(currentMin, est.expected);
      // Evitar ganhar se a penalidade for alta; porém se currentMin for 1 ou 2, não é tão ruim
      score -= winProb * expectedPenaltyIfWin * 2.4;
      // Bônus se perder com certeza jogando algo potencialmente perigoso no futuro
      score += (1 - winProb) * est.expected * 0.8;
    } else if (isFirst) {
      // Primeiro a jogar: queremos evitar liderar com um 9/10 a menos que haja alguém depois com 10 nessa cor
      const oppHasTenInColor = remainingPlayers.some((op) =>
        op.hand.some((t) => t.color === tile.color && t.value === 10)
      );
      const oppHasLowInColor = remainingPlayers.some((op) =>
        op.hand.some((t) => t.color === tile.color && t.value <= 2)
      );

      score -= est.expected * 0.7;
      if (oppHasTenInColor) score += est.expected * 0.9; // Bom momento para queimar carta alta!
      if (oppHasLowInColor) score += 2.2; // Garante um descarte pequeno caso alguém vença
      if (est.probTen > 0.5 && oppHasTenInColor) score += 4.0;
    } else {
      // Meio da disputa
      const beatsCurrentProb =
        est.candidates.filter((v) => v >= currentMax).length / est.candidates.length;
      const oppAfterCanBeatTen = remainingPlayers.some((op) =>
        op.hand.some((t) => t.color === tile.color && t.value === 10)
      );
      const oppAfterMax = remainingPlayers.reduce((mx, op) => {
        const sameColor = op.hand.filter((t) => t.color === tile.color);
        if (sameColor.length === 0) return Math.max(mx, 10); // Pode jogar qualquer cor se não tiver
        return Math.max(mx, ...sameColor.map((t) => t.value));
      }, 0);

      // Se currentMax já é 9 ou 10, ótimo momento para queimar peças médias/altas sem vencer!
      if (currentMax >= 9 && est.maxPossible < currentMax) {
        score += est.expected * 1.4;
      } else {
        const likelyPenalty = Math.min(currentMin, est.expected);
        const rescueFactor = oppAfterMax >= est.expected ? 0.45 : 1.0;
        score -= beatsCurrentProb * likelyPenalty * 1.6 * rescueFactor;
        if (oppAfterCanBeatTen && est.expected >= 6) score += 2.5;
      }
    }

    // Leve ruído para variedade humana em Tático, mínimo em Mestre
    score += (Math.random() - 0.5) * (difficulty === 'mestre' ? 0.15 : 0.7);

    if (score > bestScore) {
      bestScore = score;
      bestTile = tile;
    }
  }

  return bestTile.id;
}

/**
 * Escolhe a cor após a IA jogar uma peça 10.
 */
export function chooseAIColorAfterTen(state, aiIndex) {
  const player = state.players[aiIndex];
  const difficulty = player.difficulty || 'tatico';
  const activeColors = state.activeColors;

  if (difficulty === 'casual') {
    return activeColors[Math.floor(Math.random() * activeColors.length)];
  }

  const plays = state.currentDispute.plays;
  const remainingPlayers = [];
  for (let offset = 1; offset < state.playerCount - plays.length; offset++) {
    remainingPlayers.push(state.players[(aiIndex + offset) % state.playerCount]);
  }
  const nextPlayer = remainingPlayers[0];

  let bestColor = activeColors[0];
  let bestScore = -Infinity;

  for (const colorId of activeColors) {
    let score = 0;

    // 1. Se algum jogador restante tem um 10 dessa cor (ou o próximo não tem a cor e tem um 10 de outra),
    // ele pode ultrapassar o nosso 10 e assumir a disputa!
    for (const op of remainingPlayers) {
      const hasColor = op.hand.some((t) => t.color === colorId);
      if (hasColor) {
        if (op.hand.some((t) => t.color === colorId && t.value === 10)) {
          score += 12; // Excelente! Outro 10 jogado depois vence!
        }
        const minVal = Math.min(...op.hand.filter((t) => t.color === colorId).map((t) => t.value));
        score += Math.max(0, 5 - minVal) * 1.4; // Se tiver 1 ou 2, baixa nossa penalidade se ganharmos
      } else if (op === nextPlayer) {
        // Próximo jogador não tem essa cor -> pode mudar de cor e possivelmente jogar um 10
        if (op.hand.some((t) => t.value === 10)) score += 6;
      }
    }

    // 2. Se sabemos que nós mesmos temos poucas peças altas dessa cor, ok; se temos outras dessa cor para queimar depois, leve bônus
    const ownCount = player.hand.filter((t) => t.color === colorId).length;
    score += ownCount * 0.3;

    if (score > bestScore) {
      bestScore = score;
      bestColor = colorId;
    }
  }

  return bestColor;
}

/**
 * Escolhe qual peça de menor valor pegar em caso de empate.
 */
export function chooseAILowestTile(state) {
  const candidates = state.currentDispute.lowestCandidates;
  return candidates[0].id;
}
