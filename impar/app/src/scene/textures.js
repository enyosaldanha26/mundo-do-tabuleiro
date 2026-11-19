import * as THREE from 'three';
import { COLOR_MAP } from '../engine/constants.js';

const textureCache = new Map();
const bumpCache = new Map();

/**
 * Desenha o símbolo oficial da cor em torno de (cx, cy) com raio r.
 */
export function drawSymbolPath(ctx, symbol, cx, cy, r) {
  ctx.beginPath();
  switch (symbol) {
    case 'pentagon': {
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'diamond': {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      break;
    }
    case 'semicircle': {
      // Semicírculo voltado para a esquerda (reta vertical à direita), fiel ao Ativo 14/25
      const offsetX = r * 0.25;
      ctx.arc(cx + offsetX, cy, r * 0.95, Math.PI / 2, (3 * Math.PI) / 2, false);
      ctx.closePath();
      break;
    }
    case 'star': {
      const innerR = r * 0.42;
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : innerR;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'cross': {
      // Cruz inclinada 45 graus (X espesso, fiel ao Ativo 60/61)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      const arm = r * 0.95;
      const thick = r * 0.36;
      ctx.moveTo(-thick, -arm);
      ctx.lineTo(thick, -arm);
      ctx.lineTo(thick, -thick);
      ctx.lineTo(arm, -thick);
      ctx.lineTo(arm, thick);
      ctx.lineTo(thick, thick);
      ctx.lineTo(thick, arm);
      ctx.lineTo(-thick, arm);
      ctx.lineTo(-thick, thick);
      ctx.lineTo(-arm, thick);
      ctx.lineTo(-arm, -thick);
      ctx.lineTo(-thick, -thick);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
  }
  ctx.fill();
}

function drawTileNumber(ctx, value, cx, cy, fontSize, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${fontSize}px "Segoe UI", "Montserrat", "Arial Black", sans-serif`;
  // Leve ajuste óptico para '10'
  if (value === 10) {
    ctx.letterSpacing = '-4px';
  }
  ctx.fillText(String(value), cx, cy);
  ctx.restore();
}

/**
 * Gera ou recupera a textura CanvasTexture da face frontal ou traseira de uma peça.
 * @param {object} params
 * @param {string} params.color
 * @param {number|null} params.value - null para verso ou máscara oculta
 * @param {'even'|'odd'} params.parity
 * @param {'front'|'back'|'masked'} params.faceType
 */
export function getTileTexture({ color, value, parity, faceType }) {
  const key = `${faceType}_${color}_${parity}_${value ?? 'x'}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const col = COLOR_MAP[color];
  const isTenFront = faceType === 'front' && value === 10;

  // Fundo principal
  if (isTenFront) {
    ctx.fillStyle = '#F7F8FA';
    ctx.fillRect(0, 0, size, size);
    // Borda grossa colorida como no manual e Ativo 14(2)/38(2)
    const border = 34;
    ctx.strokeStyle = col.hex;
    ctx.lineWidth = border * 2;
    ctx.strokeRect(0, 0, size, size);
  } else {
    // Gradiente sutil de acrílico polido
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, col.lightHex);
    grad.addColorStop(0.22, col.hex);
    grad.addColorStop(1, col.darkHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Vinheta/brilho sutil nas bordas para realismo 3D
  const sheen = ctx.createRadialGradient(size * 0.3, size * 0.25, size * 0.05, size * 0.5, size * 0.5, size * 0.78);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  const inkColor = isTenFront ? col.hex : '#FFFFFF';
  ctx.fillStyle = inkColor;

  if (faceType === 'front' && value != null) {
    if (parity === 'even') {
      const fontSize = value === 10 ? 225 : 265;
      drawTileNumber(ctx, value, size * 0.48, size * 0.49, fontSize, inkColor);
      drawSymbolPath(ctx, col.symbol, size * 0.80, size * 0.80, 44);
    } else {
      // Triângulo: centro visual fica mais abaixo (y ~ 0.64)
      drawTileNumber(ctx, value, size * 0.49, size * 0.63, 210, inkColor);
      drawSymbolPath(ctx, col.symbol, size * 0.73, size * 0.83, 35);
    }
  } else if (faceType === 'back') {
    if (parity === 'even') {
      drawSymbolPath(ctx, col.symbol, size * 0.5, size * 0.43, 108);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(size * 0.34, size * 0.68, size * 0.32, 34);
    } else {
      drawSymbolPath(ctx, col.symbol, size * 0.5, size * 0.60, 74);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(size * 0.35, size * 0.80, size * 0.30, 30);
    }
  } else if (faceType === 'masked') {
    // Face frontal oculta (anti-trapaça para peças na mão do jogador humano)
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    if (parity === 'even') {
      drawSymbolPath(ctx, col.symbol, size * 0.5, size * 0.5, 90);
    } else {
      drawSymbolPath(ctx, col.symbol, size * 0.5, size * 0.65, 65);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Gera um bump map sutil de baixo-relevo para o número/símbolo da peça.
 */
export function getTileBumpTexture({ color, value, parity, faceType }) {
  const key = `bump_${faceType}_${color}_${parity}_${value ?? 'x'}`;
  if (bumpCache.has(key)) return bumpCache.get(key);

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#E0E0E0';
  ctx.fillRect(0, 0, size, size);

  if (faceType === 'front' && value != null) {
    ctx.fillStyle = '#888888';
    if (parity === 'even') {
      drawTileNumber(ctx, value, size * 0.48, size * 0.49, value === 10 ? 112 : 132, '#888888');
      drawSymbolPath(ctx, COLOR_MAP[color].symbol, size * 0.80, size * 0.80, 22);
    } else {
      drawTileNumber(ctx, value, size * 0.49, size * 0.63, 105, '#888888');
      drawSymbolPath(ctx, COLOR_MAP[color].symbol, size * 0.73, size * 0.83, 17);
    }
  } else if (faceType === 'back') {
    ctx.fillStyle = '#888888';
    if (parity === 'even') {
      drawSymbolPath(ctx, COLOR_MAP[color].symbol, size * 0.5, size * 0.43, 54);
      ctx.fillRect(size * 0.34, size * 0.68, size * 0.32, 17);
    } else {
      drawSymbolPath(ctx, COLOR_MAP[color].symbol, size * 0.5, size * 0.60, 37);
      ctx.fillRect(size * 0.35, size * 0.80, size * 0.30, 15);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  bumpCache.set(key, tex);
  return tex;
}

/**
 * Textura procedural de feltro (baize) de mesa de jogos premium.
 */
export function createFeltTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#15322B';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Marca d'água sutil no centro da mesa
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Textura procedural de madeira nobre (nogueira escura) para a borda da mesa.
 */
export function createWoodTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#332016';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    const wave = Math.sin(y * 0.05) * 10 + Math.sin(y * 0.17) * 5;
    const shade = Math.floor(wave + (Math.random() - 0.5) * 10);
    ctx.fillStyle = `rgb(${54 + shade}, ${33 + Math.floor(shade * 0.7)}, ${22 + Math.floor(shade * 0.5)})`;
    ctx.fillRect(0, y, size, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
