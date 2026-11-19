import * as THREE from 'three';
import { COLOR_MAP } from '../engine/constants.js';
import { getTileTexture, getTileBumpTexture } from './textures.js';

let cachedSquareGeom = null;
let cachedTriangleGeom = null;
const sideMaterialCache = new Map();

/**
 * Constrói uma geometria extrudada com chanfros suaves e divide em 3 grupos de material:
 * 0 = Frente (+Z), 1 = Verso (-Z), 2 = Laterais e Chanfros.
 */
function buildBeveledTileGeometry(shape, bounds, depth = 0.17, bevel = 0.024) {
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  });

  // Centraliza no eixo Z
  geom.translate(0, 0, -depth / 2);

  const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
  const pos = nonIndexed.attributes.position;
  const norm = nonIndexed.attributes.normal;
  const uv = nonIndexed.attributes.uv;

  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;

  nonIndexed.clearGroups();
  const faceTypes = new Int8Array(pos.count / 3);

  for (let t = 0; t < faceTypes.length; t++) {
    const i0 = t * 3;
    const nz = (norm.getZ(i0) + norm.getZ(i0 + 1) + norm.getZ(i0 + 2)) / 3;

    if (nz > 0.92) {
      faceTypes[t] = 0; // Frente (+Z)
      for (let k = 0; k < 3; k++) {
        const idx = i0 + k;
        const u = (pos.getX(idx) - bounds.minX) / spanX;
        const v = (pos.getY(idx) - bounds.minY) / spanY;
        uv.setXY(idx, u, v);
      }
    } else if (nz < -0.92) {
      faceTypes[t] = 1; // Verso (-Z)
      for (let k = 0; k < 3; k++) {
        const idx = i0 + k;
        const u = 1 - (pos.getX(idx) - bounds.minX) / spanX;
        const v = (pos.getY(idx) - bounds.minY) / spanY;
        uv.setXY(idx, u, v);
      }
    } else {
      faceTypes[t] = 2; // Lateral / Chanfro
    }
  }

  uv.needsUpdate = true;

  // Agrupa triângulos contíguos por materialIndex
  let runStart = 0;
  let currentMat = faceTypes[0];
  for (let t = 1; t < faceTypes.length; t++) {
    if (faceTypes[t] !== currentMat) {
      nonIndexed.addGroup(runStart * 3, (t - runStart) * 3, currentMat);
      runStart = t;
      currentMat = faceTypes[t];
    }
  }
  nonIndexed.addGroup(runStart * 3, (faceTypes.length - runStart) * 3, currentMat);

  return nonIndexed;
}

export function getSquareTileGeometry() {
  if (cachedSquareGeom) return cachedSquareGeom;

  const half = 0.45;
  const r = 0.075;
  const shape = new THREE.Shape();
  shape.moveTo(-half + r, -half);
  shape.lineTo(half - r, -half);
  shape.quadraticCurveTo(half, -half, half, -half + r);
  shape.lineTo(half, half - r);
  shape.quadraticCurveTo(half, half, half - r, half);
  shape.lineTo(-half + r, half);
  shape.quadraticCurveTo(-half, half, -half, half - r);
  shape.lineTo(-half, -half + r);
  shape.quadraticCurveTo(-half, -half, -half + r, -half);

  cachedSquareGeom = buildBeveledTileGeometry(shape, {
    minX: -half,
    maxX: half,
    minY: -half,
    maxY: half,
  });
  return cachedSquareGeom;
}

export function getTriangleTileGeometry() {
  if (cachedTriangleGeom) return cachedTriangleGeom;

  // Triângulo equilátero com cantos levemente arredondados
  const ax = 0, ay = 0.56;
  const bx = 0.53, by = -0.358;
  const cx = -0.53, cy = -0.358;

  const roundCorner = (pPrev, pCurr, pNext, radius) => {
    const v1 = new THREE.Vector2(pPrev[0] - pCurr[0], pPrev[1] - pCurr[1]).normalize().multiplyScalar(radius);
    const v2 = new THREE.Vector2(pNext[0] - pCurr[0], pNext[1] - pCurr[1]).normalize().multiplyScalar(radius);
    return {
      inPt: [pCurr[0] + v1.x, pCurr[1] + v1.y],
      ctrl: pCurr,
      outPt: [pCurr[0] + v2.x, pCurr[1] + v2.y],
    };
  };

  const r = 0.055;
  const cTop = roundCorner([cx, cy], [ax, ay], [bx, by], r);
  const cRight = roundCorner([ax, ay], [bx, by], [cx, cy], r);
  const cLeft = roundCorner([bx, by], [cx, cy], [ax, ay], r);

  const shape = new THREE.Shape();
  shape.moveTo(cTop.outPt[0], cTop.outPt[1]);
  shape.lineTo(cRight.inPt[0], cRight.inPt[1]);
  shape.quadraticCurveTo(cRight.ctrl[0], cRight.ctrl[1], cRight.outPt[0], cRight.outPt[1]);
  shape.lineTo(cLeft.inPt[0], cLeft.inPt[1]);
  shape.quadraticCurveTo(cLeft.ctrl[0], cLeft.ctrl[1], cLeft.outPt[0], cLeft.outPt[1]);
  shape.lineTo(cTop.inPt[0], cTop.inPt[1]);
  shape.quadraticCurveTo(cTop.ctrl[0], cTop.ctrl[1], cTop.outPt[0], cTop.outPt[1]);

  cachedTriangleGeom = buildBeveledTileGeometry(shape, {
    minX: cx,
    maxX: bx,
    minY: cy,
    maxY: ay,
  });
  return cachedTriangleGeom;
}

function getSideMaterial(colorId) {
  if (sideMaterialCache.has(colorId)) return sideMaterialCache.get(colorId);
  const col = COLOR_MAP[colorId];
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(col.hex),
    roughness: 0.24,
    metalness: 0.04,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
  });
  sideMaterialCache.set(colorId, mat);
  return mat;
}

function createFaceMaterial({ color, value, parity, faceType }) {
  const map = getTileTexture({ color, value, parity, faceType });
  const bumpMap = getTileBumpTexture({ color, value, parity, faceType });
  return new THREE.MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 0.008,
    roughness: 0.26,
    metalness: 0.02,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });
}

/**
 * Cria um objeto 3D completo de uma peça de Ímpar.
 * @param {object} tile - { id, color, value, parity }
 * @param {boolean} [revealFront=true] - false para mascarar o valor frontal (anti-trapaça na mão do jogador humano)
 */
export function createTileMesh(tile, revealFront = true) {
  const geom = tile.parity === 'even' ? getSquareTileGeometry() : getTriangleTileGeometry();

  const frontMat = createFaceMaterial({
    color: tile.color,
    value: revealFront ? tile.value : null,
    parity: tile.parity,
    faceType: revealFront ? 'front' : 'masked',
  });

  const backMat = createFaceMaterial({
    color: tile.color,
    value: null,
    parity: tile.parity,
    faceType: 'back',
  });

  const sideMat = getSideMaterial(tile.color);

  const mesh = new THREE.Mesh(geom, [frontMat, backMat, sideMat]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Wrapper Group para facilitar animações suaves de elevação/hover/pulso
  const group = new THREE.Group();
  group.add(mesh);

  group.userData = {
    tileId: tile.id,
    tileData: tile,
    mesh,
    revealFront,
    hoverFactor: 0,
    isLegal: true,
    interactive: false,
    targetPos: new THREE.Vector3(),
    targetQuat: new THREE.Quaternion(),
    targetScale: new THREE.Vector3(1, 1, 1),
    animStartPos: null,
    animStartQuat: null,
    animProgress: 1,
    animDuration: 0.42,
    arcHeight: 0,
  };

  return group;
}

/**
 * Atualiza a face frontal da peça para revelar o valor real (quando jogada na mesa).
 */
export function revealTileMeshFront(tileGroup) {
  const ud = tileGroup.userData;
  if (ud.revealFront) return;
  ud.revealFront = true;
  const tile = ud.tileData;
  const newFrontMat = createFaceMaterial({
    color: tile.color,
    value: tile.value,
    parity: tile.parity,
    faceType: 'front',
  });
  ud.mesh.material[0] = newFrontMat;
}

/**
 * Mascara a face frontal da peça (usado ao trocar jogador em Mesa Local).
 */
export function maskTileMeshFront(tileGroup) {
  const ud = tileGroup.userData;
  if (!ud.revealFront) return;
  ud.revealFront = false;
  const tile = ud.tileData;
  const newFrontMat = createFaceMaterial({
    color: tile.color,
    value: null,
    parity: tile.parity,
    faceType: 'masked',
  });
  ud.mesh.material[0] = newFrontMat;
}

/**
 * Ajusta o brilho/esmaecimento visual da peça conforme legalidade e hover.
 */
export function setTileVisualHighlight(tileGroup, { isLegal = true, isHovered = false, isSelected = false }) {
  const mesh = tileGroup.userData.mesh;
  const mats = mesh.material;

  const dimColor = isLegal ? 0xffffff : 0x5f646e;
  const emissiveHex = isSelected ? 0xffe066 : isHovered && isLegal ? 0x334455 : 0x000000;
  const emissiveIntensity = isSelected ? 0.35 : isHovered && isLegal ? 0.25 : 0;

  for (const m of mats) {
    if (!m.map) {
      // Lateral mantém a cor da peça, levemente escurecida se ilegal
      const base = new THREE.Color(COLOR_MAP[tileGroup.userData.tileData.color].hex);
      if (!isLegal) base.multiplyScalar(0.45);
      m.color.copy(base);
    } else {
      m.color.setHex(dimColor);
    }
    m.emissive.setHex(emissiveHex);
    m.emissiveIntensity = emissiveIntensity;
  }
}
