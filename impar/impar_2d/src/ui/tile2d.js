import { COLOR_MAP } from '../engine/constants.js';

function symbolSvgPath(symbol, cx, cy, r, fill) {
  switch (symbol) {
    case 'pentagon': {
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" />`;
    }
    case 'diamond': {
      const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
      return `<polygon points="${pts}" fill="${fill}" />`;
    }
    case 'semicircle': {
      const ox = cx + r * 0.25;
      const rad = r * 0.92;
      return `<path d="M ${ox.toFixed(1)} ${(cy - rad).toFixed(1)} A ${rad.toFixed(1)} ${rad.toFixed(1)} 0 1 0 ${ox.toFixed(1)} ${(cy + rad).toFixed(1)} Z" fill="${fill}" />`;
    }
    case 'star': {
      const pts = [];
      const inner = r * 0.42;
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" />`;
    }
    case 'cross': {
      const arm = r * 0.92;
      const t = r * 0.35;
      const d = `M ${-t} ${-arm} H ${t} V ${-t} H ${arm} V ${t} H ${t} V ${arm} H ${-t} V ${t} H ${-arm} V ${-t} H ${-t} Z`;
      return `<g transform="translate(${cx},${cy}) rotate(45)"><path d="${d}" fill="${fill}" /></g>`;
    }
    default:
      return '';
  }
}

/**
 * Renderiza o SVG minimalista 2D de uma peça de Ímpar (frente ou verso).
 * @param {object} tile - { id, color, value, parity }
 * @param {'front'|'back'} face
 * @param {'sm'|'md'|'lg'} [size='md']
 */
export function renderTileSvg(tile, face = 'front', size = 'md') {
  const col = COLOR_MAP[tile.color];
  const fill = col.hex;
  const isEven = tile.parity === 'even';
  const isTenFront = face === 'front' && tile.value === 10;

  if (isEven) {
    const bg = isTenFront ? '#FFFFFF' : fill;
    const ink = isTenFront ? fill : '#FFFFFF';
    const border = isTenFront
      ? `<rect x="4" y="4" width="92" height="92" rx="12" fill="none" stroke="${fill}" stroke-width="8" />`
      : '';

    let inner = '';
    if (face === 'front') {
      const fontSize = tile.value === 10 ? 44 : 52;
      inner = `
        <text x="48" y="54" text-anchor="middle" dominant-baseline="central"
              fill="${ink}" font-family="'Segoe UI', system-ui, sans-serif"
              font-weight="900" font-size="${fontSize}" letter-spacing="${tile.value === 10 ? '-2' : '0'}">${tile.value}</text>
        ${symbolSvgPath(col.symbol, 80, 80, 9.5, ink)}
      `;
    } else {
      inner = `
        ${symbolSvgPath(col.symbol, 50, 42, 20, '#FFFFFF')}
        <rect x="33" y="68" width="34" height="7" rx="2.5" fill="#FFFFFF" />
      `;
    }

    return `
      <svg class="tile-svg tile-even tile-${size}" viewBox="0 0 100 100" aria-hidden="true">
        <rect x="1" y="1" width="98" height="98" rx="14" fill="${bg}" />
        ${border}
        ${inner}
      </svg>
    `;
  }

  // Peça Ímpar (Triângulo equilátero com vértices suaves)
  const triPath = 'M 56 5 L 107 93 L 5 93 Z';
  let inner = '';
  if (face === 'front') {
    inner = `
      <text x="55" y="64" text-anchor="middle" dominant-baseline="central"
            fill="#FFFFFF" font-family="'Segoe UI', system-ui, sans-serif"
            font-weight="900" font-size="42">${tile.value}</text>
      ${symbolSvgPath(col.symbol, 80, 82, 7.5, '#FFFFFF')}
    `;
  } else {
    inner = `
      ${symbolSvgPath(col.symbol, 56, 58, 15, '#FFFFFF')}
      <rect x="39" y="78" width="34" height="6.5" rx="2.5" fill="#FFFFFF" />
    `;
  }

  return `
    <svg class="tile-svg tile-odd tile-${size}" viewBox="0 0 112 100" aria-hidden="true">
      <path d="${triPath}" fill="${fill}" stroke="${fill}" stroke-width="6" stroke-linejoin="round" />
      ${inner}
    </svg>
  `;
}

/**
 * Palavra-marca SVG minimalista ÍMPAR inspirada na capa oficial.
 */
export function renderImparWordmark(height = 32) {
  return `
    <svg height="${height}" viewBox="0 0 210 52" fill="none" aria-label="ÍMPAR">
      <!-- Í -->
      <polygon points="16,4 28,4 22,12 12,12" fill="#00AEEF" />
      <rect x="10" y="15" width="12" height="33" rx="2" fill="#00AEEF" />
      <!-- M -->
      <path d="M29 48 V15 H40 L50 32 L60 15 H71 V48 H60 V31 L50 46 L40 31 V48 Z" fill="#00AEEF" />
      <!-- P -->
      <path d="M80 48 V15 H97 C106 15 111 20 111 27 C111 34 106 39 97 39 H91 V48 H80 Z M91 30 H96 C99 30 101 29 101 27 C101 25 99 24 96 24 H91 V30 Z" fill="#18181F" />
      <!-- A geométrico (chevron sem barra, igual à capa!) -->
      <polygon points="134,14 155,48 142,48 134,33 126,48 113,48" fill="#18181F" />
      <!-- R -->
      <path d="M161 48 V15 H179 C188 15 193 20 193 26.5 C193 31.5 190 35 185 36.8 L195 48 H182 L173.5 38 H172 V48 H161 Z M172 29.5 H177.5 C180.5 29.5 182.5 28.2 182.5 26.5 C182.5 24.8 180.5 23.5 177.5 23.5 H172 V29.5 Z" fill="#18181F" />
    </svg>
  `;
}
