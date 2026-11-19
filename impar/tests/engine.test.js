import { PHASES } from '../app/src/engine/constants.js';
import {
  chooseColorAfterTen,
  createMatchState,
  finalizeDispute,
  getLegalTileIds,
  playTile,
  startNextRound,
} from '../app/src/engine/gameState.js';
import { chooseAIColorAfterTen, chooseAILowestTile, chooseAITile } from '../app/src/engine/ai.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`Falha na asserção: ${msg}`);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} | Esperado: ${expected}, Obtido: ${actual}`);
  }
}

export function runAllEngineTests() {
  const results = [];
  const test = (name, fn) => {
    fn();
    results.push({ name, ok: true });
  };

  test('Preparação para 3, 4, 5 e 6 jogadores segue tabela oficial', () => {
    const cfg = [
      { n: 3, per: 12, bag: 4, colors: 4 },
      { n: 4, per: 12, bag: 2, colors: 5 },
      { n: 5, per: 10, bag: 0, colors: 5 },
      { n: 6, per: 8, bag: 2, colors: 5 },
    ];
    for (const c of cfg) {
      const players = Array.from({ length: c.n }, (_, i) => ({ name: `P${i}`, isHuman: i === 0 }));
      const s = createMatchState({ players });
      assertEqual(s.activeColors.length, c.colors, `${c.n}J cores`);
      assertEqual(s.bagTiles.length, c.bag, `${c.n}J bolsa`);
      for (const p of s.players) {
        assertEqual(p.hand.length, c.per, `${c.n}J peças por jogador`);
      }
    }
  });

  test('Seguir cor obrigatória e mudar cor quando não possui', () => {
    const players = [0, 1, 2, 3].map((i) => ({ name: `P${i}`, isHuman: false }));
    const s = createMatchState({ players });
    // Mãos controladas
    s.players[0].hand = [{ id: 'azul_8', color: 'azul', value: 8, parity: 'even' }];
    s.players[1].hand = [
      { id: 'azul_2', color: 'azul', value: 2, parity: 'even' },
      { id: 'rosa_9', color: 'rosa', value: 9, parity: 'odd' },
    ];
    s.players[2].hand = [{ id: 'verde_5', color: 'verde', value: 5, parity: 'odd' }];
    s.players[3].hand = [
      { id: 'verde_4', color: 'verde', value: 4, parity: 'even' },
      { id: 'preto_1', color: 'preto', value: 1, parity: 'odd' },
    ];

    playTile(s, 0, 'azul_8');
    // Jogador 1 tem azul -> só azul_2 é legal
    const legalP1 = getLegalTileIds(s, 1);
    assertEqual(legalP1.length, 1, 'P1 só pode seguir azul');
    assertEqual(legalP1[0], 'azul_2', 'P1 legal tile');
    playTile(s, 1, 'azul_2');

    // Jogador 2 não tem azul -> pode jogar verde_5 e muda a cor para verde!
    const r2 = playTile(s, 2, 'verde_5');
    assertEqual(r2.requiredColor, 'verde', 'P2 mudou a cor para verde');

    // Jogador 3 deve seguir verde
    const legalP3 = getLegalTileIds(s, 3);
    assertEqual(legalP3.length, 1, 'P3 deve seguir verde');
    assertEqual(legalP3[0], 'verde_4', 'P3 legal tile verde_4');
  });

  test('Peça 10 escolhe cor, exceto se for a última jogada da disputa', () => {
    const players = [0, 1, 2].map((i) => ({ name: `P${i}`, isHuman: false }));
    const s = createMatchState({ players, removedColor3P: 'preto' });
    s.players[0].hand = [{ id: 'azul_10', color: 'azul', value: 10, parity: 'even' }];
    s.players[1].hand = [{ id: 'rosa_3', color: 'rosa', value: 3, parity: 'odd' }];
    s.players[2].hand = [{ id: 'verde_10', color: 'verde', value: 10, parity: 'even' }];

    const r0 = playTile(s, 0, 'azul_10');
    assertEqual(r0.action, 'NEED_COLOR_10', '10 no início exige escolha de cor');
    chooseColorAfterTen(s, 0, 'rosa');
    assertEqual(s.currentDispute.requiredColor, 'rosa', 'Cor escolhida foi rosa');

    playTile(s, 1, 'rosa_3');
    // P2 joga 10 como última jogada -> NÃO pede escolha de cor, resolve disputa direto!
    const r2 = playTile(s, 2, 'verde_10');
    assertEqual(r2.action, 'ROUND_END', '10 por último resolve disputa e termina rodada de 1 carta');
    // Empate no 10: quem jogou por último (P2) vence! Menor peça é rosa_3 (3 pts)
    assertEqual(s.players[2].roundScores[0], 3, 'P2 venceu empate de 10 e pegou 3 pts');
  });

  test('Empate no maior valor vence o último; empate no menor valor pede escolha', () => {
    const players = [0, 1, 2, 3].map((i) => ({ name: `P${i}`, isHuman: false }));
    const s = createMatchState({ players });
    s.players[0].hand = [
      { id: 'azul_9', color: 'azul', value: 9, parity: 'odd' },
      { id: 'azul_4', color: 'azul', value: 4, parity: 'even' },
    ];
    s.players[1].hand = [
      { id: 'azul_3', color: 'azul', value: 3, parity: 'odd' },
      { id: 'azul_6', color: 'azul', value: 6, parity: 'even' },
    ];
    s.players[2].hand = [
      { id: 'amarelo_3', color: 'amarelo', value: 3, parity: 'odd' },
      { id: 'amarelo_5', color: 'amarelo', value: 5, parity: 'odd' },
    ];
    s.players[3].hand = [
      { id: 'amarelo_9', color: 'amarelo', value: 9, parity: 'odd' },
      { id: 'amarelo_2', color: 'amarelo', value: 2, parity: 'even' },
    ];

    playTile(s, 0, 'azul_9');
    playTile(s, 1, 'azul_3');
    playTile(s, 2, 'amarelo_3');
    const r3 = playTile(s, 3, 'amarelo_9');
    assertEqual(r3.action, 'NEED_LOWEST_CHOICE', 'Empate de 3 exige escolha');
    assertEqual(r3.winnerIndex, 3, 'P3 venceu empate de 9 por jogar por último');
    assertEqual(r3.lowestCandidates.length, 2, 'Dois 3 na mesa');

    const fin = finalizeDispute(s, 'amarelo_3');
    assertEqual(fin.action, 'DISPUTE_FINISHED', 'Disputa finalizada');
    assertEqual(s.players[3].penaltyTiles[0].id, 'amarelo_3', 'P3 pegou amarelo_3');
    assertEqual(s.discardPile.length, 3, '3 peças descartadas');
    assertEqual(s.currentDispute.leaderIndex, 3, 'Vencedor lidera próxima disputa');
  });

  test('Simulação completa de partida 4J por 3 rodadas com IA honesta', () => {
    for (const diff of ['casual', 'tatico', 'mestre']) {
      const players = [0, 1, 2, 3].map((i) => ({ name: `IA${i}`, isHuman: false, difficulty: diff }));
      const s = createMatchState({ players });
      let guard = 0;

      while (s.phase !== PHASES.GAME_OVER && guard < 1000) {
        guard++;
        if (s.phase === PHASES.PLAY_TILE) {
          const turn = s.currentDispute.turnIndex;
          const tileId = chooseAITile(s, turn);
          playTile(s, turn, tileId);
        } else if (s.phase === PHASES.CHOOSE_COLOR_10) {
          const lastPlay = s.currentDispute.plays[s.currentDispute.plays.length - 1];
          const col = chooseAIColorAfterTen(s, lastPlay.playerIndex);
          chooseColorAfterTen(s, lastPlay.playerIndex, col);
        } else if (s.phase === PHASES.CHOOSE_LOWEST_TILE) {
          const pick = chooseAILowestTile(s);
          finalizeDispute(s, pick);
        } else if (s.phase === PHASES.ROUND_END) {
          startNextRound(s);
        }
      }

      assertEqual(s.phase, PHASES.GAME_OVER, `Partida completa (${diff}) terminou`);
      assertEqual(s.round, 3, `Partida (${diff}) teve 3 rodadas`);
      assert(s.winners.length >= 1, `Partida (${diff}) tem vencedor`);
      for (const p of s.players) {
        assertEqual(p.roundScores.length, 3, `Cada jogador tem 3 pontuações de rodada`);
      }
    }
  });

  return results;
}
