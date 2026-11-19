/**
 * Constantes oficiais do jogo Ímpar (baseadas no manual oficial e peças físicas).
 */

export const TOTAL_ROUNDS = 3;

export const COLORS = [
  {
    id: 'azul',
    name: 'Azul',
    hex: '#00AEEF',
    darkHex: '#007FB2',
    lightHex: '#5CD3FF',
    symbol: 'pentagon',
    symbolLabel: 'Pentágono',
  },
  {
    id: 'amarelo',
    name: 'Amarelo',
    hex: '#FCB040',
    darkHex: '#C87D14',
    lightHex: '#FFD07A',
    symbol: 'cross',
    symbolLabel: 'Cruz',
  },
  {
    id: 'verde',
    name: 'Verde',
    hex: '#39B54A',
    darkHex: '#247E31',
    lightHex: '#6FE07E',
    symbol: 'diamond',
    symbolLabel: 'Losango',
  },
  {
    id: 'rosa',
    name: 'Rosa',
    hex: '#EC008C',
    darkHex: '#A60062',
    lightHex: '#FF5CB8',
    symbol: 'semicircle',
    symbolLabel: 'Meia-Lua',
  },
  {
    id: 'preto',
    name: 'Preto',
    hex: '#191920',
    darkHex: '#0B0B0F',
    lightHex: '#3A3A46',
    symbol: 'star',
    symbolLabel: 'Estrela',
  },
];

export const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.id, c]));

export const PLAYER_CONFIG = {
  3: { tilesPerPlayer: 12, undistributed: 4, activeColorCount: 4 },
  4: { tilesPerPlayer: 12, undistributed: 2, activeColorCount: 5 },
  5: { tilesPerPlayer: 10, undistributed: 0, activeColorCount: 5 },
  6: { tilesPerPlayer: 8, undistributed: 2, activeColorCount: 5 },
};

export const AI_DIFFICULTIES = {
  casual: { id: 'casual', name: 'Casual', description: 'Joga de forma espontânea, ideal para aprender.' },
  tatico: { id: 'tatico', name: 'Tático', description: 'Analisa as peças visíveis na mesa e evita riscos altos.' },
  mestre: { id: 'mestre', name: 'Mestre', description: 'Dedução probabilística completa, contagem e blefe com o 10.' },
};

export const DEFAULT_AI_NAMES = ['Raquel', 'Pedro', 'Júlia', 'Bernardo', 'Lucas', 'Marina'];

export const PHASES = {
  IDLE: 'IDLE',
  PAR_OU_IMPAR: 'PAR_OU_IMPAR',
  PLAY_TILE: 'PLAY_TILE',
  CHOOSE_COLOR_10: 'CHOOSE_COLOR_10',
  RESOLVE_DISPUTE: 'RESOLVE_DISPUTE',
  CHOOSE_LOWEST_TILE: 'CHOOSE_LOWEST_TILE',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER',
};
