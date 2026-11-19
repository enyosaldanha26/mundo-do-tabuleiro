import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLOR_MAP, PHASES } from '../engine/constants.js';
import { createFeltTexture, createWoodTexture } from './textures.js';
import { createTileMesh, maskTileMeshFront, revealTileMeshFront, setTileVisualHighlight } from './tileMesh.js';

const SEAT_ANGLES_BY_COUNT = {
  3: [0, (128 * Math.PI) / 180, (232 * Math.PI) / 180],
  4: [0, (104 * Math.PI) / 180, Math.PI, (256 * Math.PI) / 180],
  5: [0, (86 * Math.PI) / 180, (146 * Math.PI) / 180, (214 * Math.PI) / 180, (274 * Math.PI) / 180],
  6: [0, (74 * Math.PI) / 180, (126 * Math.PI) / 180, Math.PI, (234 * Math.PI) / 180, (286 * Math.PI) / 180],
};

const CAMERA_PRESETS = {
  overview: { pos: new THREE.Vector3(0, 11.1, 13.5), target: new THREE.Vector3(0, 0.15, 0.8) },
  hand: { pos: new THREE.Vector3(0, 5.6, 11.4), target: new THREE.Vector3(0, 0.4, 3.1) },
  opponents: { pos: new THREE.Vector3(0, 7.8, 9.6), target: new THREE.Vector3(0, 0.5, -2.6) },
  center: { pos: new THREE.Vector3(0, 8.2, 4.6), target: new THREE.Vector3(0, 0.1, 0) },
};

export class ImparTableScene {
  /**
   * @param {HTMLElement} container
   * @param {object} callbacks
   * @param {(tileId: string) => void} callbacks.onTileClick
   * @param {(tile: object|null) => void} callbacks.onTileHover
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.tileMeshes = new Map(); // tileId -> THREE.Group
    this.rackGroups = [];
    this.seatAnchors = []; // { playerIndex, worldPos }
    this.hoveredTileId = null;
    this.activeState = null;
    this.viewerIndex = 0;
    this.legalTileIds = new Set();
    this.interactive = false;
    this.idlePreview = true;
    this.bagBounce = 0;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-99, -99);
    this.clock = new THREE.Clock();
    this.cameraAnim = null;

    this._initRenderer();
    this._initScene();
    this._initLights();
    this._buildTableEnvironment();
    this._initControls();
    this._bindEvents();
    this._animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090d14');
    this.scene.fog = new THREE.FogExp2('#090d14', 0.022);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;

    this.camera = new THREE.PerspectiveCamera(
      40,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100
    );
    this.camera.position.copy(CAMERA_PRESETS.overview.pos);
  }

  _initLights() {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e1b18, 0.55);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.85);
    keyLight.position.set(5.5, 14, 7.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 32;
    const d = 10;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.65);
    rimLight.position.set(-8, 7, -9);
    this.scene.add(rimLight);
  }

  _buildTableEnvironment() {
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // Chão sutil abaixo da mesa
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#070a10',
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(35, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    floor.receiveShadow = true;
    this.worldGroup.add(floor);

    // Base de madeira externa da mesa
    const woodTex = createWoodTexture();
    const woodMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.45,
      metalness: 0.08,
    });
    const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(8.65, 8.35, 0.48, 64), woodMat);
    tableBase.position.y = -0.26;
    tableBase.receiveShadow = true;
    this.worldGroup.add(tableBase);

    // Aro elevado de madeira (borda acolchoada/madeira)
    const rimGeom = new THREE.TorusGeometry(8.25, 0.38, 20, 72);
    const rimMesh = new THREE.Mesh(rimGeom, woodMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.05;
    rimMesh.castShadow = true;
    rimMesh.receiveShadow = true;
    this.worldGroup.add(rimMesh);

    // Filete dourado interno
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#c9a45c',
      roughness: 0.28,
      metalness: 0.85,
    });
    const brassRing = new THREE.Mesh(new THREE.TorusGeometry(7.86, 0.035, 12, 72), brassMat);
    brassRing.rotation.x = Math.PI / 2;
    brassRing.position.y = 0.015;
    this.worldGroup.add(brassRing);

    // Superfície de feltro
    const feltTex = createFeltTexture();
    const feltMat = new THREE.MeshStandardMaterial({
      map: feltTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const felt = new THREE.Mesh(new THREE.CylinderGeometry(7.88, 7.88, 0.06, 64), feltMat);
    felt.position.y = -0.03;
    felt.receiveShadow = true;
    this.worldGroup.add(felt);

    // Anel luminoso da arena central (indica a cor exigida na disputa!)
    const arenaMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.28,
    });
    this.arenaRing = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.46, 64), arenaMat);
    this.arenaRing.rotation.x = -Math.PI / 2;
    this.arenaRing.position.y = 0.006;
    this.worldGroup.add(this.arenaRing);

    const arenaInnerMat = new THREE.MeshStandardMaterial({
      color: '#0f2721',
      roughness: 0.95,
      transparent: true,
      opacity: 0.65,
    });
    const arenaDisc = new THREE.Mesh(new THREE.CircleGeometry(2.35, 64), arenaInnerMat);
    arenaDisc.rotation.x = -Math.PI / 2;
    arenaDisc.position.y = 0.003;
    arenaDisc.receiveShadow = true;
    this.worldGroup.add(arenaDisc);

    // Bolsa de veludo 3D (canto superior esquerdo)
    this.velvetBag = this._createVelvetBag();
    this.velvetBag.position.set(-5.8, 0, -4.4);
    this.worldGroup.add(this.velvetBag);

    // Grupo dinâmico de suportes (racks) e peças
    this.racksContainer = new THREE.Group();
    this.worldGroup.add(this.racksContainer);

    this.tilesContainer = new THREE.Group();
    this.worldGroup.add(this.tilesContainer);
  }

  _createVelvetBag() {
    const bagGroup = new THREE.Group();
    const velvetMat = new THREE.MeshPhysicalMaterial({
      color: '#181822',
      roughness: 0.92,
      metalness: 0.02,
      sheen: 1.0,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color('#475569'),
    });

    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.55, 0.02),
      new THREE.Vector2(0.72, 0.28),
      new THREE.Vector2(0.68, 0.65),
      new THREE.Vector2(0.32, 0.92),
      new THREE.Vector2(0.45, 1.15),
      new THREE.Vector2(0.41, 1.18),
      new THREE.Vector2(0.27, 0.90),
    ];
    const bodyGeom = new THREE.LatheGeometry(pts, 28);
    const body = new THREE.Mesh(bodyGeom, velvetMat);
    body.castShadow = true;
    body.receiveShadow = true;
    bagGroup.add(body);

    const cordMat = new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.4, metalness: 0.6 });
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 10, 28), cordMat);
    cord.rotation.x = Math.PI / 2;
    cord.position.y = 0.91;
    cord.castShadow = true;
    bagGroup.add(cord);

    return bagGroup;
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(CAMERA_PRESETS.overview.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 6.5;
    this.controls.maxDistance = 17.5;
    // Limita ângulos para manter estética cinematográfica e impedir espiar por trás do suporte humano
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.16;
    this.controls.minAzimuthAngle = -0.82;
    this.controls.maxAzimuthAngle = 0.82;
    this.controls.update();
  }

  _bindEvents() {
    this._onResize = () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w <= 0 || h <= 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);

    const dom = this.renderer.domElement;
    this._onPointerMove = (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._updateHover();
    };

    this._onPointerDown = (e) => {
      this._downPos = { x: e.clientX, y: e.clientY };
    };

    this._onPointerUp = (e) => {
      if (!this._downPos) return;
      const dist = Math.hypot(e.clientX - this._downPos.x, e.clientY - this._downPos.y);
      if (dist > 8) return; // foi um arraste de câmera, não clique
      if (!this.interactive) return;

      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._updateHover();

      if (this.hoveredTileId && this.legalTileIds.has(this.hoveredTileId)) {
        this.callbacks.onTileClick?.(this.hoveredTileId);
      }
    };

    dom.addEventListener('pointermove', this._onPointerMove);
    dom.addEventListener('pointerdown', this._onPointerDown);
    dom.addEventListener('pointerup', this._onPointerUp);
  }

  _updateHover() {
    if (!this.interactive || !this.activeState) {
      if (this.hoveredTileId) {
        this.hoveredTileId = null;
        this.renderer.domElement.style.cursor = 'grab';
        this.callbacks.onTileHover?.(null);
        this._refreshTileHighlights();
      }
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const viewerHand = this.activeState.players[this.viewerIndex]?.hand || [];
    const candidateMeshes = [];
    for (const t of viewerHand) {
      const g = this.tileMeshes.get(t.id);
      if (g) candidateMeshes.push(g.userData.mesh);
    }

    const hits = this.raycaster.intersectObjects(candidateMeshes, false);
    let nextHover = null;
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      for (const [id, g] of this.tileMeshes.entries()) {
        if (g.userData.mesh === hitMesh) {
          nextHover = id;
          break;
        }
      }
    }

    if (nextHover !== this.hoveredTileId) {
      this.hoveredTileId = nextHover;
      const isLegal = nextHover && this.legalTileIds.has(nextHover);
      this.renderer.domElement.style.cursor = isLegal ? 'pointer' : 'grab';
      const tileObj = nextHover
        ? viewerHand.find((t) => t.id === nextHover) || null
        : null;
      this.callbacks.onTileHover?.(tileObj ? { ...tileObj, isLegal } : null);
      this._refreshTileHighlights();
    }
  }

  _refreshTileHighlights() {
    if (!this.activeState) return;
    const viewerHand = this.activeState.players[this.viewerIndex]?.hand || [];
    const isMyTurn =
      this.interactive &&
      this.activeState.phase === PHASES.PLAY_TILE &&
      this.activeState.currentDispute.turnIndex === this.viewerIndex;

    for (const t of viewerHand) {
      const g = this.tileMeshes.get(t.id);
      if (!g) continue;
      const isLegal = !isMyTurn || this.legalTileIds.has(t.id);
      const isHovered = this.hoveredTileId === t.id;
      setTileVisualHighlight(g, { isLegal, isHovered });
      g.userData.hoverFactor = isHovered && isLegal ? 1 : 0;
    }
  }

  setCameraPreset(presetName) {
    const preset = CAMERA_PRESETS[presetName];
    if (!preset) return;
    this.cameraAnim = {
      startPos: this.camera.position.clone(),
      endPos: preset.pos.clone(),
      startTarget: this.controls.target.clone(),
      endTarget: preset.target.clone(),
      progress: 0,
      duration: 0.65,
    };
  }

  triggerBagBounce() {
    this.bagBounce = 1.0;
  }

  setIdlePreview(enabled) {
    this.idlePreview = enabled;
    if (enabled) {
      this._buildPreviewTiles();
    }
  }

  _buildPreviewTiles() {
    this._clearTiles();
    this._clearRacks();
    const previewSpecs = [
      { id: 'p_azul_1', color: 'azul', value: 1, parity: 'odd', pos: [-1.8, 0.11, 0.5], rotY: 0.2 },
      { id: 'p_amarelo_3', color: 'amarelo', value: 3, parity: 'odd', pos: [-0.9, 0.11, -0.4], rotY: -0.15 },
      { id: 'p_preto_6', color: 'preto', value: 6, parity: 'even', pos: [0.0, 0.11, 0.45], rotY: 0.08 },
      { id: 'p_rosa_7', color: 'rosa', value: 7, parity: 'odd', pos: [0.95, 0.11, -0.35], rotY: -0.2 },
      { id: 'p_verde_10', color: 'verde', value: 10, parity: 'even', pos: [1.9, 0.11, 0.4], rotY: 0.12 },
    ];
    for (const spec of previewSpecs) {
      const g = createTileMesh(spec, true);
      g.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      g.rotation.set(-Math.PI / 2, 0, spec.rotY);
      g.userData.targetPos.copy(g.position);
      g.userData.targetQuat.copy(g.quaternion);
      this.tilesContainer.add(g);
      this.tileMeshes.set(spec.id, g);
    }
  }

  _clearTiles() {
    for (const g of this.tileMeshes.values()) {
      this.tilesContainer.remove(g);
    }
    this.tileMeshes.clear();
  }

  _clearRacks() {
    while (this.racksContainer.children.length > 0) {
      this.racksContainer.remove(this.racksContainer.children[0]);
    }
    this.rackGroups = [];
    this.seatAnchors = [];
  }

  _rebuildRacks(playerCount, viewerIndex) {
    this._clearRacks();
    const angles = SEAT_ANGLES_BY_COUNT[playerCount];

    for (let i = 0; i < playerCount; i++) {
      const relIdx = (i - viewerIndex + playerCount) % playerCount;
      const theta = angles[relIdx];
      const radius = relIdx === 0 ? 5.95 : 6.20;
      const cx = -Math.sin(theta) * radius;
      const cz = Math.cos(theta) * radius;
      const rotY = Math.PI - theta;

      const rackGroup = new THREE.Group();
      rackGroup.position.set(cx, 0, cz);
      rackGroup.rotation.y = rotY;

      this.racksContainer.add(rackGroup);
      this.rackGroups[i] = { group: rackGroup, theta, radius, rotY, relIdx };

      // Âncora de etiqueta HTML para cada jogador (posicionada acima dos oponentes; o jogador inferior usa o HUD inferior)
      const labelRadius = relIdx === 0 ? 7.25 : 7.35;
      this.seatAnchors.push({
        playerIndex: i,
        relIdx,
        worldPos: new THREE.Vector3(-Math.sin(theta) * labelRadius, 1.15, Math.cos(theta) * labelRadius),
      });
    }
  }

  /**
   * Sincroniza toda a cena 3D com o estado atual da partida, animando peças suavemente.
   */
  syncState(state, { viewerIndex = 0, legalTileIds = [], interactive = false, immediate = false } = {}) {
    this.idlePreview = false;
    const prevCount = this.activeState?.playerCount;
    const prevRound = this.activeState?.round;
    const prevViewer = this.viewerIndex;

    this.activeState = state;
    this.viewerIndex = viewerIndex;
    this.legalTileIds = new Set(legalTileIds);
    this.interactive = interactive;

    if (prevCount !== state.playerCount || prevViewer !== viewerIndex || this.rackGroups.length === 0) {
      this._rebuildRacks(state.playerCount, viewerIndex);
    }

    if (prevRound !== state.round) {
      // Nova rodada -> recria conjunto de peças a partir da bolsa para animação limpa
      this._clearTiles();
      this.triggerBagBounce();
    }

    // Atualiza cor do anel da arena central
    const reqColor = state.currentDispute.requiredColor;
    if (reqColor && COLOR_MAP[reqColor]) {
      this.arenaRing.material.color.set(COLOR_MAP[reqColor].hex);
      this.arenaRing.material.opacity = 0.72;
    } else {
      this.arenaRing.material.color.set('#94a3b8');
      this.arenaRing.material.opacity = 0.22;
    }

    const angles = SEAT_ANGLES_BY_COUNT[state.playerCount];
    const activeTileIds = new Set();

    const ensureTile = (tile, revealFront, spawnFromBag = false) => {
      activeTileIds.add(tile.id);
      let g = this.tileMeshes.get(tile.id);
      if (!g) {
        g = createTileMesh(tile, revealFront);
        if (spawnFromBag || prevRound !== state.round) {
          g.position.set(-5.8, 0.9, -4.4);
          g.scale.setScalar(0.35);
        }
        this.tilesContainer.add(g);
        this.tileMeshes.set(tile.id, g);
      } else if (revealFront && !g.userData.revealFront) {
        revealTileMeshFront(g);
      } else if (!revealFront && g.userData.revealFront) {
        maskTileMeshFront(g);
      }
      return g;
    };

    const setTarget = (g, pos, quat, scale = 1, arcHeight = 0.6, duration = 0.42) => {
      const ud = g.userData;
      if (immediate) {
        g.position.copy(pos);
        g.quaternion.copy(quat);
        g.scale.setScalar(scale);
        ud.targetPos.copy(pos);
        ud.targetQuat.copy(quat);
        ud.targetScale.setScalar(scale);
        ud.animProgress = 1;
        return;
      }

      if (ud.targetPos.distanceToSquared(pos) > 0.0004 || Math.abs(ud.targetQuat.angleTo(quat)) > 0.01) {
        ud.animStartPos = g.position.clone();
        ud.animStartQuat = g.quaternion.clone();
        ud.animStartScale = g.scale.x;
        ud.targetPos.copy(pos);
        ud.targetQuat.copy(quat);
        ud.targetScale.setScalar(scale);
        ud.arcHeight = arcHeight;
        ud.animDuration = duration;
        ud.animProgress = 0;
      }
    };

    const euler = new THREE.Euler();
    const tmpQuat = new THREE.Quaternion();

    // 1. Mãos dos jogadores
    for (let i = 0; i < state.playerCount; i++) {
      const player = state.players[i];
      const rack = this.rackGroups[i];
      const isViewer = i === viewerIndex;
      const handLen = player.hand.length;
      const spacing = isViewer ? Math.min(0.58, 5.8 / Math.max(1, handLen)) : Math.min(0.47, 4.8 / Math.max(1, handLen));
      const scale = isViewer ? 0.55 : 0.46;

      player.hand.forEach((tile, idx) => {
        // Jogador humano NÃO vê a frente das próprias peças (anti-trapaça), apenas o verso!
        const g = ensureTile(tile, !isViewer, true);
        const offsetFromCenter = idx - (handLen - 1) / 2;
        const localX = offsetFromCenter * spacing;
        // Leve arco natural acompanhando a mesa redonda; base perfeitamente apoiada no feltro (y = 0)
        const normT = handLen > 1 ? offsetFromCenter / ((handLen - 1) / 2) : 0;
        const localZ = -normT * normT * 0.22;
        const baseY = (tile.parity === 'even' ? 0.474 : 0.382) * scale;
        const localPos = new THREE.Vector3(localX, baseY, localZ);
        localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), rack.rotY);
        const worldPos = localPos.add(rack.group.position);

        // Peças em pé diretamente sobre a mesa
        euler.set(0, rack.rotY, 0, 'YXZ');
        tmpQuat.setFromEuler(euler);
        setTarget(g, worldPos, tmpQuat, scale, 0.8, 0.5);
      });
    }

    // 2. Peças jogadas na disputa atual (arena central)
    const plays = state.currentDispute.plays;
    plays.forEach((play, orderIdx) => {
      const relIdx = (play.playerIndex - viewerIndex + state.playerCount) % state.playerCount;
      const theta = angles[relIdx];
      const arenaR = 1.38;
      const pos = new THREE.Vector3(
        -Math.sin(theta) * arenaR,
        0.09 + orderIdx * 0.004,
        Math.cos(theta) * arenaR
      );
      const g = ensureTile(play.tile, true);
      // Deitada com a FRENTE (+Z) para cima (+Y) e número legível para o jogador humano
      euler.set(-Math.PI / 2, 0, 0, 'YXZ');
      tmpQuat.setFromEuler(euler);
      setTarget(g, pos, tmpQuat, 0.68, 1.35, 0.44);
    });

    // 3. Pilhas de pontuação (peças do jogador atual ficam abertas para ele; as dos oponentes ficam viradas para baixo)
    for (let i = 0; i < state.playerCount; i++) {
      const player = state.players[i];
      const isViewer = i === viewerIndex;
      const relIdx = (i - viewerIndex + state.playerCount) % state.playerCount;
      const theta = angles[relIdx];
      const rotY = Math.PI - theta;
      const baseR = relIdx === 0 ? 4.45 : 4.55;

      player.penaltyTiles.forEach((tile, pIdx) => {
        const g = ensureTile(tile, isViewer);
        const col = pIdx % 4;
        const row = Math.floor(pIdx / 4);
        const localOffset = new THREE.Vector3((col - 1.5) * 0.46, 0.06 + row * 0.10, -row * 0.14);
        localOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const pos = new THREE.Vector3(
          -Math.sin(theta) * baseR + localOffset.x,
          localOffset.y,
          Math.cos(theta) * baseR + localOffset.z
        );
        // Jogador vê suas próprias peças de pontuação (frente para cima); oponentes ficam fechadas (verso para cima)
        euler.set(isViewer ? -Math.PI / 2 : Math.PI / 2, isViewer ? 0 : Math.PI, 0, 'YXZ');
        tmpQuat.setFromEuler(euler);
        setTarget(g, pos, tmpQuat, 0.42, 0.9, 0.46);
      });
    }

    // 4. Pilha de descarte (verso para cima, oculta)
    state.discardPile.forEach((tile, dIdx) => {
      const g = ensureTile(tile, true);
      const stackOffsetY = 0.06 + dIdx * 0.035;
      const jitterX = Math.sin(dIdx * 2.1) * 0.06;
      const jitterZ = Math.cos(dIdx * 1.7) * 0.06;
      const pos = new THREE.Vector3(5.65 + jitterX, stackOffsetY, -4.35 + jitterZ);
      // Verso (-Z) virado para cima (+Y)!
      euler.set(Math.PI / 2, (dIdx * 0.35) % (Math.PI * 2), 0, 'YXZ');
      tmpQuat.setFromEuler(euler);
      setTarget(g, pos, tmpQuat, 0.44, 1.0, 0.45);
    });

    // Remove peças que não estão mais no estado (caso reset)
    for (const [id, g] of this.tileMeshes.entries()) {
      if (!activeTileIds.has(id)) {
        this.tilesContainer.remove(g);
        this.tileMeshes.delete(id);
      }
    }

    this._refreshTileHighlights();
  }

  /**
   * Projeta as posições das âncoras dos jogadores para coordenadas 2D de tela.
   */
  getProjectedSeatPositions() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return this.seatAnchors.map((a) => {
      const v = a.worldPos.clone().project(this.camera);
      return {
        playerIndex: a.playerIndex,
        relIdx: a.relIdx,
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        visible: v.z < 1,
      };
    });
  }

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.cameraAnim) {
      this.cameraAnim.progress += dt / this.cameraAnim.duration;
      const t = Math.min(1, this.cameraAnim.progress);
      const ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.cameraAnim.startPos, this.cameraAnim.endPos, ease);
      this.controls.target.lerpVectors(this.cameraAnim.startTarget, this.cameraAnim.endTarget, ease);
      if (t >= 1) this.cameraAnim = null;
    }

    if (this.idlePreview) {
      this.worldGroup.rotation.y = Math.sin(elapsed * 0.18) * 0.25;
      for (const g of this.tileMeshes.values()) {
        g.position.y = 0.14 + Math.sin(elapsed * 1.8 + g.position.x) * 0.04;
      }
    } else {
      this.worldGroup.rotation.y = THREE.MathUtils.lerp(this.worldGroup.rotation.y, 0, dt * 6);
    }

    if (this.bagBounce > 0) {
      this.bagBounce = Math.max(0, this.bagBounce - dt * 1.6);
      const s = 1 + Math.sin(this.bagBounce * Math.PI * 3) * 0.14 * this.bagBounce;
      this.velvetBag.scale.set(s, 1 / Math.sqrt(s), s);
    } else {
      this.velvetBag.scale.set(1, 1, 1);
    }

    // Anima todas as peças em direção ao alvo
    for (const g of this.tileMeshes.values()) {
      const ud = g.userData;
      if (ud.animProgress < 1 && ud.animStartPos) {
        ud.animProgress = Math.min(1, ud.animProgress + dt / ud.animDuration);
        const t = ud.animProgress;
        const ease = 1 - Math.pow(1 - t, 3);
        g.position.lerpVectors(ud.animStartPos, ud.targetPos, ease);
        g.position.y += Math.sin(t * Math.PI) * ud.arcHeight;
        g.quaternion.slerpQuaternions(ud.animStartQuat, ud.targetQuat, ease);
        const s = THREE.MathUtils.lerp(ud.animStartScale ?? 1, ud.targetScale.x, ease);
        g.scale.setScalar(s);
      } else if (!this.idlePreview) {
        // Hover suave na mão do jogador
        const hoverY = (ud.hoverFactor || 0) * 0.24;
        g.position.y = THREE.MathUtils.lerp(g.position.y, ud.targetPos.y + hoverY, dt * 14);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
