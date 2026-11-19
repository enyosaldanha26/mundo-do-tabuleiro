/**
 * Catálogo de jogos do portal Mundo do Tabuleiro (mundodotabuleiro.com.br).
 *
 * COMO ADICIONAR UM NOVO JOGO:
 * 1. Copie a pasta do seu jogo web para dentro da pasta do projeto (ex.: ./meu_jogo/).
 * 2. Adicione um novo objeto neste array `window.MUNDO_GAMES` seguindo o modelo abaixo.
 *    Cada jogo pode informar seus próprios `authors` (criação solo ou em parceria).
 *    O card, o palco em tela cheia e as regras rápidas aparecem automaticamente!
 */
window.MUNDO_GAMES = [
  {
    id: 'impar',
    title: 'ÍMPAR',
    tagline: 'Estratégia e dedução às cegas — quem fizer menos pontos vence!',
    description:
      'Você só vê o verso das suas próprias peças (cor, símbolo e formato Par/Ímpar) enquanto enxerga os números dos rivais. Deduza o que tem na mão e fuja dos pontos!',
    authors: 'Ênyo Saldanha & Eurico Cunha',
    players: '3 a 5 jogadores',
    playersNote: 'até 6 na edição 3D',
    duration: '25 min',
    age: '14+',
    tags: ['Estratégia', 'Dedução', 'Salas Online'],
    highlight: 'Multijogador Online',
    accentColor: '#2B6CB0',
    cover: {
      type: 'box',
      src: './impar/impar_2d/assets/capa.jpg',
      alt: 'Caixa oficial do jogo ÍMPAR'
    },
    manualPdf: './impar/impar_manual/impar_manual.pdf',
    editions: [
      {
        id: '2d',
        label: '2D + Online',
        badge: 'Salas Online & IA',
        url: './impar/impar_2d/index.html'
      },
      {
        id: '3d',
        label: 'Mesa 3D',
        badge: '3 a 6 jog. · 3D',
        url: './impar/app/index.html'
      }
    ],
    quickRules: [
      {
        title: 'Objetivo',
        text: 'Termine as <strong>3 rodadas</strong> com <strong>menos pontos</strong>. Durante toda a partida, você vê apenas o <strong>verso</strong> das suas próprias peças, mas vê a <strong>frente</strong> (números) das peças dos adversários.'
      },
      {
        title: 'Peças & Formatos',
        items: [
          '<strong>50 peças</strong> numeradas de 1 a 10 em 5 cores: Azul (Pentágono), Amarelo (Cruz), Verde (Losango), Rosa (Meia-Lua) e Preto (Estrela).',
          '<strong>Pares (2, 4, 6, 8, 10)</strong> têm formato <strong>Quadrado</strong>; <strong>Ímpares (1, 3, 5, 7, 9)</strong> têm formato <strong>Triângulo</strong>.'
        ]
      },
      {
        title: 'A Disputa',
        items: [
          'Em sentido horário, jogue uma peça <strong>seguindo a cor da última peça jogada</strong> na mesa.',
          'Se não tiver nenhuma peça daquela cor, pode jogar qualquer peça — <strong>mudando a cor</strong> para o próximo jogador.'
        ]
      },
      {
        title: 'Peça 10 (Efeito Especial)',
        text: 'As peças de número <strong>10</strong> têm borda colorida e fundo branco. Quem jogar um 10 pode <strong>escolher qualquer cor</strong> para o próximo jogador seguir (exceto na última jogada da disputa).'
      },
      {
        title: 'Pontuação & Vitória',
        items: [
          'Vence a disputa quem jogou o <strong>maior valor</strong> (em empate, vence quem jogou por último).',
          'O vencedor pega a peça de <strong>menor valor</strong> da mesa e a guarda como pontos negativos (quanto menos, melhor!).',
          'Quem tiver <strong>menos pontos</strong> após 3 rodadas vence (desempate: menos pontos na 3ª rodada).'
        ]
      }
    ]
  },
  {
    id: 'zero-two-five',
    title: 'Zero Two Five',
    tagline: 'Pedra, Papel, Tesoura... na medida certa!',
    description:
      'Um jogo de vazas com naipes de Pedra, Papel e Tesoura onde vencer demais atrapalha: conquiste exatamente 0, 2 ou 5 disputas na rodada para pontuar!',
    authors: 'Ênyo Saldanha & Eurico Cunha',
    players: '3 a 5 jogadores',
    duration: '30 min',
    age: '14+',
    tags: ['Cartas', 'Vazas', 'Básico & Avançado'],
    highlight: 'Modo Básico & Avançado',
    accentColor: '#C8553D',
    cover: {
      type: 'product',
      src: './zero_two_five/zero%20two%20five%20capa.png',
      alt: 'Caixa e componentes oficiais do jogo Zero Two Five'
    },
    manualPdf: './zero_two_five/zero_two_five_manual/zero_two_five_manual.pdf',
    editions: [
      {
        id: 'web',
        label: 'Versão Web',
        badge: 'Básico & Avançado',
        url: './zero_two_five/index.html'
      }
    ],
    quickRules: [
      {
        title: 'Objetivo',
        text: 'Vença exatamente <strong>0</strong>, <strong>2</strong> ou <strong>5</strong> disputas em uma rodada para ganhar a ficha de pontuação correspondente. O primeiro a juntar <strong>3 fichas</strong> (ou quem tiver mais fichas após <strong>5 rodadas</strong>) vence!'
      },
      {
        title: 'Preparação',
        items: [
          '<strong>3 jogadores:</strong> cartas 1–12 de cada naipe (36 cartas).',
          '<strong>4 jogadores:</strong> cartas 1–16 de cada naipe (48 cartas).',
          '<strong>5 jogadores:</strong> cartas 1–20 de cada naipe (60 cartas).',
          'Cada jogador recebe 12 cartas. Quem tiver <strong>Pedra 1</strong> inicia a 1ª disputa!'
        ]
      },
      {
        title: 'Hierarquia dos Naipes',
        suitsTriangle: [
          { id: 'rock', label: '✊ Pedra (0)', verb: 'quebra' },
          { id: 'scissors', label: '✌️ Tesoura (2)', verb: 'corta' },
          { id: 'paper', label: '🖐️ Papel (5)', verb: 'embrulha' }
        ]
      },
      {
        title: 'Resolvendo a Disputa',
        items: [
          'Você <strong>deve seguir o naipe</strong> da carta inicial se tiver na mão; caso contrário, joga qualquer carta.',
          '<strong>1 naipe na mesa:</strong> maior número vence.',
          '<strong>2 naipes na mesa:</strong> maior número do naipe mais forte vence.',
          '<strong>3 naipes na mesa:</strong> <strong>EMPATE!</strong> Ninguém vence, cartas são descartadas e quem colocou o 3º naipe primeiro inicia a próxima!'
        ]
      },
      {
        title: 'Modo Avançado (Palpites)',
        text: 'A rodada passa a ter <strong>11 disputas</strong> e, antes de jogar em qualquer disputa, você deve baixar 1 carta virada para cima como seu <strong>Palpite</strong> (Pedra = 0, Tesoura = 2, Papel = 5). Você só ganha a ficha se acertar exatamente a quantidade do seu palpite!'
      }
    ]
  }
];
