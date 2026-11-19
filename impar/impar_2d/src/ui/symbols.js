import { COLOR_MAP } from '../engine/constants.js';

/**
 * Retorna um SVG inline limpo representando o símbolo oficial de uma cor.
 */
export function getColorSymbolSvg(colorId, size = 18, fill = '#ffffff') {
  const sym = COLOR_MAP[colorId]?.symbol;
  switch (sym) {
    case 'pentagon':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"><polygon points="12,2 22,9.5 18.2,21 5.8,21 2,9.5"/></svg>`;
    case 'cross':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"><polygon points="6,3 12,9 18,3 21,6 15,12 21,18 18,21 12,15 6,21 3,18 9,12 3,6"/></svg>`;
    case 'diamond':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"><polygon points="12,2 22,12 12,22 2,12"/></svg>`;
    case 'semicircle':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"><path d="M16,3 A9,9 0 1,0 16,21 Z"/></svg>`;
    case 'star':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"><polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/></svg>`;
    default:
      return '';
  }
}

export function getManualHtml() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <h2 style="margin:0;font-size:22px;">Manual Oficial — ÍMPAR</h2>
      <button class="icon-btn" id="btn-close-manual">Fechar</button>
    </div>
    <div class="manual-content">
      <h4>Objetivo e Visão Geral</h4>
      <p>O objetivo de <strong>Ímpar</strong> é terminar com <strong>menos pontos</strong> após <strong>3 rodadas</strong>. Quem jogar a maior peça de cada disputa vence a disputa e acumula pontos (o que é desvantajoso). Durante toda a partida, <strong>você só vê o verso das suas próprias peças</strong> (cor, símbolo e formato Par/Ímpar), enquanto vê a <strong>frente</strong> (números) das peças dos oponentes.</p>

      <h4>Componentes e Preparação (3 a 6 jogadores)</h4>
      <ul>
        <li><strong>50 peças</strong> numeradas de 1 a 10 em 5 cores: Azul (Pentágono), Amarelo (Cruz), Verde (Losango), Rosa (Meia-Lua) e Preto (Estrela).</li>
        <li><strong>Formato</strong>: Números <strong>Pares (2, 4, 6, 8, 10)</strong> são <strong>Quadrados</strong>; números <strong>Ímpares (1, 3, 5, 7, 9)</strong> são <strong>Triângulos</strong>.</li>
        <li><strong>3 jogadores</strong>: 1 cor é removida (40 peças), 12 por jogador, 4 ficam ocultas na bolsa.</li>
        <li><strong>4 jogadores</strong>: 12 por jogador, 2 na bolsa. <strong>5 jogadores</strong>: 10 por jogador. <strong>6 jogadores</strong>: 8 por jogador, 2 na bolsa.</li>
      </ul>

      <h4>A Disputa</h4>
      <ul>
        <li>O primeiro jogador escolhe uma peça sua (olhando apenas o verso) e a joga no centro com o valor virado para cima.</li>
        <li>Em sentido horário, cada jogador deve jogar uma peça <strong>seguindo a cor da última peça jogada</strong> (a menos que tenha sido jogado um 10).</li>
        <li>Se você <strong>não tiver peças daquela cor</strong>, pode jogar qualquer outra peça, <strong>mudando assim a cor</strong> a ser seguida pelo próximo jogador.</li>
      </ul>

      <h4>Peça 10 (Efeito Especial)</h4>
      <p>As peças de número <strong>10</strong> possuem borda colorida e fundo branco. Quem jogar um 10 pode <strong>escolher qualquer cor</strong> para o próximo jogador seguir (exceto se o 10 for a última jogada da disputa).</p>

      <h4>Vencendo uma Disputa e Pontuação</h4>
      <ul>
        <li>Vence quem jogou a peça de <strong>maior valor</strong>, independentemente da cor. Em caso de empate no maior valor, vence quem jogou <strong>por último</strong>.</li>
        <li>O vencedor pega a peça de <strong>menor valor</strong> entre as jogadas na mesa e a coloca à sua frente como pontuação. Em caso de empate no menor valor, o vencedor escolhe qual pegar.</li>
        <li>As demais peças são descartadas com o <strong>verso para cima</strong> e não podem ser consultadas.</li>
        <li>O vencedor da disputa inicia a próxima disputa. Ao fim da rodada, todas as peças voltam para a bolsa e quem ganhou a última disputa inicia a nova rodada.</li>
      </ul>

      <h4>Fim de Jogo</h4>
      <p>Após 3 rodadas, somam-se os pontos. O jogador com <strong>menos pontos</strong> vence! Em caso de empate, vence quem marcou menos pontos na 3ª rodada.</p>
    </div>
  `;
}
