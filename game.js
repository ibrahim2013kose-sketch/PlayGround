(() => {
  'use strict';

  /* ------------------------------------------------------------------
   * KÜP DÜNYASI — a compact voxel sandbox.
   * World, textures, meshes and audio are generated locally; there are
   * no runtime network dependencies.
   * ------------------------------------------------------------------ */

  const WORLD_X = 64;
  const WORLD_Z = 64;
  const WORLD_Y = 44;
  const CHUNK = 16;
  const SEA_LEVEL = 5;
  const WATER_Y = 5.62;
  const EYE_HEIGHT = 1.62;
  const PLAYER_RADIUS = 0.31;
  const PLAYER_HEIGHT = 1.79;
  const DEFAULT_SEED = 20260814;
  const SAVE_KEY = 'kup-dunyasi-save-v1';
  const SOUND_KEY = 'kup-dunyasi-sound-v1';
  const MAX_TARGET_DISTANCE = 6.4;

  const isTouch = Boolean(
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    ('ontouchstart' in window && navigator.maxTouchPoints > 0)
  );
  document.body.classList.toggle('touch', isTouch);

  const $ = (selector) => document.querySelector(selector);
  const dom = {
    world: $('#world'),
    menu: $('#menu'),
    menuKicker: $('#menu-kicker'),
    menuTitle: $('#menu-title'),
    menuDesc: $('#menu-desc'),
    menuEdition: $('.edition'),
    playBtn: $('#play-btn'),
    playLabel: $('#play-label'),
    coords: $('#coords'),
    compassDir: $('#compass-dir'),
    compassDeg: $('#compass-deg'),
    targetPill: $('#target-pill'),
    targetName: $('#target-name'),
    targetAction: $('.target-action'),
    toast: $('#toast'),
    hotbar: $('#hotbar'),
    blockLabel: $('#block-label'),
    blockLabelNum: $('#block-label-num'),
    blockLabelName: $('#block-label-name'),
    soundBtn: $('#sound-btn'),
    soundLabel: $('#sound-label'),
    soundIcon: $('#sound-icon'),
    resetBtn: $('#reset-btn'),
    controlNote: $('#control-note'),
    joystick: $('#joystick'),
    joystickKnob: $('#joystick-knob'),
    btnJump: $('#btn-jump'),
    btnBreak: $('#btn-break'),
    btnPlace: $('#btn-place')
  };

  const PALETTE = [1, 2, 3, 4, 5, 6, 7, 8];

  const BLOCKS = {
    1: { name: 'Çim', iconName: 'Çim Bloğu', top: 0, side: 1, bottom: 2, color: 0x74b84b, particle: 0x6eae46 },
    2: { name: 'Toprak', iconName: 'Toprak Bloğu', top: 2, side: 2, bottom: 2, color: 0x8b5f3a, particle: 0x805431 },
    3: { name: 'Taş', iconName: 'Taş Bloğu', top: 3, side: 3, bottom: 3, color: 0x969b93, particle: 0x858a82 },
    4: { name: 'Kütük', iconName: 'Meşe Kütüğü', top: 5, side: 4, bottom: 5, color: 0x7c5a34, particle: 0x70502d },
    5: { name: 'Yaprak', iconName: 'Yaprak Bloğu', top: 6, side: 6, bottom: 6, color: 0x4a913f, particle: 0x3f8236 },
    6: { name: 'Tuğla', iconName: 'Tuğla Bloğu', top: 7, side: 7, bottom: 7, color: 0xb25640, particle: 0xa94d39 },
    7: { name: 'Altın', iconName: 'Altın Bloğu', top: 8, side: 8, bottom: 8, color: 0xf2c44c, particle: 0xe9b83a },
    8: { name: 'Cam', iconName: 'Cam Bloğu', top: 9, side: 9, bottom: 9, color: 0xbfe8ef, particle: 0xc8eff3, transparent: true },
    9: { name: 'Kum', iconName: 'Kum Bloğu', top: 10, side: 10, bottom: 10, color: 0xd8c187, particle: 0xd2bb7c }
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const blockIndex = (x, y, z) => x + WORLD_X * (z + WORLD_Z * y);
  const inWorld = (x, y, z) => x >= 0 && x < WORLD_X && y >= 0 && y < WORLD_Y && z >= 0 && z < WORLD_Z;
  const inHorizontalWorld = (x, z) => x >= 0 && x < WORLD_X && z >= 0 && z < WORLD_Z;

  /* ------------------------------------------------------------------
   * Pixel-art texture atlas
   * ------------------------------------------------------------------ */

  const ATLAS_TILE = 16;
  const ATLAS_COLS = 4;
  const ATLAS_SIZE = ATLAS_TILE * ATLAS_COLS;
  let atlasCanvas;
  let atlasTexture;

  function hexToRgb(hex) {
    let value = hex.replace('#', '');
    if (value.length === 3) value = value.split('').map((char) => char + char).join('');
    const number = parseInt(value, 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  }

  function rgbCss(rgb) {
    return `rgb(${clamp(Math.round(rgb[0]), 0, 255)},${clamp(Math.round(rgb[1]), 0, 255)},${clamp(Math.round(rgb[2]), 0, 255)})`;
  }

  function shifted(rgb, amount) {
    return rgbCss([rgb[0] + amount, rgb[1] + amount, rgb[2] + amount]);
  }

  function createAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const context = canvas.getContext('2d');
    const random = mulberry32(81374);

    const tileOrigin = (tile) => [(tile % ATLAS_COLS) * ATLAS_TILE, Math.floor(tile / ATLAS_COLS) * ATLAS_TILE];
    const pixel = (tile, x, y, color) => {
      const [ox, oy] = tileOrigin(tile);
      context.fillStyle = color;
      context.fillRect(ox + x, oy + y, 1, 1);
    };
    const fillTile = (tile, color) => {
      const [ox, oy] = tileOrigin(tile);
      context.fillStyle = color;
      context.fillRect(ox, oy, ATLAS_TILE, ATLAS_TILE);
    };
    const noiseTile = (tile, base, variance, special) => {
      const [ox, oy] = tileOrigin(tile);
      const baseRgb = hexToRgb(base);
      for (let y = 0; y < ATLAS_TILE; y += 1) {
        for (let x = 0; x < ATLAS_TILE; x += 1) {
          let delta = Math.floor((random() - 0.5) * variance);
          if (special && random() < 0.035) delta -= Math.floor(variance * 0.8);
          context.fillStyle = shifted(baseRgb, delta);
          context.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    };

    // 0 — Grass top
    noiseTile(0, '#608d45', 26);
    for (let i = 0; i < 12; i += 1) {
      const x = Math.floor(random() * 14);
      const y = Math.floor(random() * 14);
      pixel(0, x, y, random() > 0.5 ? '#78a955' : '#466a33');
      pixel(0, x + 1, y, random() > 0.5 ? '#6d9c4e' : '#4e7538');
    }

    // 1 — Grass side
    noiseTile(1, '#8a633d', 25, true);
    for (let x = 0; x < 16; x += 1) {
      const edge = 3 + (random() > 0.5 ? 1 : 0) + (random() > 0.78 ? 1 : 0);
      for (let y = 0; y < edge; y += 1) {
        const green = ['#5a8f42', '#65a04c', '#4c7535', '#6fa453'][Math.floor(random() * 4)];
        pixel(1, x, y, green);
      }
      if (random() > 0.38) pixel(1, x, edge, '#436b2f');
      if (random() > 0.78) pixel(1, x, edge + 1, '#3a5c2a');
    }

    // 2 — Dirt
    noiseTile(2, '#8a633d', 32, true);
    for (let i = 0; i < 9; i += 1) {
      const x = Math.floor(random() * 15);
      const y = Math.floor(random() * 15);
      pixel(2, x, y, random() > 0.5 ? '#6e4b2d' : '#9f764c');
    }

    // 3 — Stone
    noiseTile(3, '#929891', 28, true);
    for (let i = 0; i < 7; i += 1) {
      const x = Math.floor(random() * 14);
      const y = Math.floor(random() * 14);
      pixel(3, x, y, '#777d76');
      pixel(3, x + 1, y + (random() > 0.5 ? 0 : 1), '#7f857e');
    }
    for (let i = 0; i < 4; i += 1) {
      const x = Math.floor(random() * 12) + 1;
      const y = Math.floor(random() * 11) + 2;
      pixel(3, x, y, '#6c726b');
      if (random() > 0.4) pixel(3, x + 1, y + 1, '#6c726b');
    }

    // 4 — Log side
    noiseTile(4, '#74512f', 18);
    for (let x = 1; x < 15; x += 3) {
      for (let y = 0; y < 16; y += 1) {
        if (random() > 0.28) pixel(4, x, y, random() > 0.5 ? '#5f4026' : '#674529');
      }
    }
    for (let y = 1; y < 15; y += 4) {
      const x = 3 + Math.floor(random() * 9);
      pixel(4, x, y, '#4f351f');
      pixel(4, x + 1, y, '#4f351f');
    }

    // 5 — Log top
    fillTile(5, '#aa8151');
    for (let y = 1; y < 15; y += 1) {
      for (let x = 1; x < 15; x += 1) {
        const distance = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2);
        const ring = Math.floor(distance) % 3;
        const color = ring === 0 ? '#8e693f' : ring === 1 ? '#b88e5c' : '#c39b68';
        if (random() > 0.11) pixel(5, x, y, color);
      }
    }
    for (let x = 6; x <= 9; x += 1) pixel(5, x, 7, '#79542f');

    // 6 — Leaves (alpha cut-out)
    const leafColors = ['#3f6b35', '#4a7a3d', '#578a49', '#355a2d', '#60934f'];
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        if (random() < 0.11) continue;
        pixel(6, x, y, leafColors[Math.floor(random() * leafColors.length)]);
      }
    }
    for (let i = 0; i < 8; i += 1) {
      const x = Math.floor(random() * 15);
      const y = Math.floor(random() * 15);
      pixel(6, x, y, '#6e9b58');
    }

    // 7 — Bricks
    fillTile(7, '#a34f3b');
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        context.fillStyle = shifted(hexToRgb('#a34f3b'), Math.floor((random() - 0.5) * 25));
        context.fillRect(tileOrigin(7)[0] + x, tileOrigin(7)[1] + y, 1, 1);
      }
    }
    for (let x = 0; x < 16; x += 1) {
      for (const y of [3, 7, 11, 15]) pixel(7, x, y, '#d0a17d');
    }
    for (let y = 0; y < 16; y += 1) {
      if (y < 3 || (y > 3 && y < 7) || (y > 7 && y < 11) || y > 11) {
        const offset = y < 3 || (y > 7 && y < 11) ? 4 : 0;
        pixel(7, 4 + offset, y, '#d0a17d');
        pixel(7, 12 + offset - (offset ? 4 : 0), y, '#d0a17d');
      }
    }

    // 8 — Gold
    noiseTile(8, '#efbf45', 24);
    for (let x = 1; x < 15; x += 1) {
      pixel(8, x, 1, '#ffdb72');
      pixel(8, x, 14, '#b78223');
    }
    for (let y = 1; y < 15; y += 1) {
      pixel(8, 1, y, '#ffd96b');
      pixel(8, 14, y, '#b78223');
    }
    for (let i = 0; i < 5; i += 1) {
      const x = 3 + Math.floor(random() * 9);
      const y = 3 + Math.floor(random() * 9);
      pixel(8, x, y, '#fff0a8');
      pixel(8, x + 1, y, '#f8d35c');
    }

    // 9 — Glass
    context.clearRect(tileOrigin(9)[0], tileOrigin(9)[1], 16, 16);
    context.fillStyle = 'rgba(177,228,240,0.14)';
    context.fillRect(tileOrigin(9)[0], tileOrigin(9)[1], 16, 16);
    for (let i = 0; i < 16; i += 1) {
      pixel(9, i, 0, i % 4 === 0 ? '#e6fbff' : '#b9edf4');
      pixel(9, i, 15, i % 5 === 0 ? '#d7f7fc' : '#9ed9e4');
      pixel(9, 0, i, i % 4 === 0 ? '#e6fbff' : '#b9edf4');
      pixel(9, 15, i, i % 5 === 0 ? '#d7f7fc' : '#9ed9e4');
    }
    for (let i = 0; i < 6; i += 1) {
      pixel(9, 3 + i, 10 - i, 'rgba(237,255,255,0.9)');
      if (i < 3) pixel(9, 4 + i, 10 - i, 'rgba(220,250,255,0.55)');
    }
    pixel(9, 5, 4, '#f4ffff');
    pixel(9, 11, 3, '#e9ffff');

    // 10 — Sand
    noiseTile(10, '#d8c184', 24, true);
    for (let i = 0; i < 12; i += 1) {
      const x = Math.floor(random() * 15);
      const y = Math.floor(random() * 15);
      pixel(10, x, y, random() > 0.5 ? '#c2a96f' : '#e9d69a');
    }

    // 11 — Planks (unused, keeps the atlas visually complete)
    noiseTile(11, '#ad8050', 17);
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x += 1) pixel(11, x, y, '#7e5835');
      pixel(11, Math.floor(random() * 12) + 2, y + 2, '#956c43');
    }

    // 12 — Red flower (transparent cut-out)
    context.clearRect(tileOrigin(12)[0], tileOrigin(12)[1], 16, 16);
    for (let y = 7; y < 16; y += 1) pixel(12, 7, y, y < 11 ? '#4f8e3b' : '#3e7531');
    pixel(12, 6, 11, '#5d9d46');
    pixel(12, 5, 10, '#5d9d46');
    pixel(12, 8, 12, '#5d9d46');
    pixel(12, 9, 11, '#5d9d46');
    for (const [x, y] of [[7, 4], [6, 5], [8, 5], [9, 6], [5, 6], [6, 7], [8, 7], [7, 8]]) pixel(12, x, y, '#d94e44');
    pixel(12, 7, 6, '#f2b34b');
    pixel(12, 6, 6, '#b63733');
    pixel(12, 8, 6, '#b63733');
    pixel(12, 7, 5, '#f47b63');

    // 13 — Yellow flower (transparent cut-out)
    context.clearRect(tileOrigin(13)[0], tileOrigin(13)[1], 16, 16);
    for (let y = 8; y < 16; y += 1) pixel(13, 8, y, y < 12 ? '#4f8e3b' : '#3e7531');
    pixel(13, 7, 12, '#5d9d46');
    pixel(13, 6, 11, '#5d9d46');
    pixel(13, 9, 13, '#5d9d46');
    pixel(13, 10, 12, '#5d9d46');
    for (const [x, y] of [[8, 4], [7, 5], [9, 5], [10, 6], [6, 6], [7, 7], [9, 7], [8, 8]]) pixel(13, x, y, '#f0cc47');
    pixel(13, 8, 6, '#b57f24');
    pixel(13, 7, 6, '#f7e271');
    pixel(13, 9, 6, '#f7e271');

    // 14 — Tall grass (transparent cut-out)
    context.clearRect(tileOrigin(14)[0], tileOrigin(14)[1], 16, 16);
    const grassBlades = [[3, 10, 16, '#6baa4d'], [5, 7, 16, '#5d9941'], [7, 11, 16, '#77b85a'], [9, 8, 16, '#568f3b'], [11, 12, 16, '#6baa4d'], [13, 9, 16, '#4d8435']];
    for (const [x, start, end, color] of grassBlades) {
      for (let y = start; y < end; y += 1) pixel(14, x, y, color);
      if (start + 1 < 16) pixel(14, x - 1, start + 2, color);
      if (start + 3 < 16) pixel(14, x + 1, start + 4, color);
    }

    return canvas;
  }

  function makeAtlasTexture() {
    const texture = new THREE.CanvasTexture(atlasCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
    return texture;
  }

  function drawFaceTexture(context, tile, points, shade) {
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    const sx = col * ATLAS_TILE;
    const sy = row * ATLAS_TILE;
    const p0 = points[0];
    const p1 = points[1];
    const p3 = points[3];

    context.save();
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    context.lineTo(points[1][0], points[1][1]);
    context.lineTo(points[2][0], points[2][1]);
    context.lineTo(points[3][0], points[3][1]);
    context.closePath();
    context.clip();
    context.setTransform(
      (p1[0] - p0[0]) / ATLAS_TILE,
      (p1[1] - p0[1]) / ATLAS_TILE,
      (p3[0] - p0[0]) / ATLAS_TILE,
      (p3[1] - p0[1]) / ATLAS_TILE,
      p0[0],
      p0[1]
    );
    context.drawImage(atlasCanvas, sx, sy, ATLAS_TILE, ATLAS_TILE, 0, 0, ATLAS_TILE, ATLAS_TILE);
    context.restore();

    if (shade) {
      context.save();
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      context.lineTo(points[1][0], points[1][1]);
      context.lineTo(points[2][0], points[2][1]);
      context.lineTo(points[3][0], points[3][1]);
      context.closePath();
      context.fillStyle = shade;
      context.fill();
      context.restore();
    }
  }

  function makeBlockIcon(type) {
    const definition = BLOCKS[type];
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;

    const cx = 24;
    const topY = 3.5;
    const halfW = 18;
    const halfH = 9;
    const depth = 21;
    const left = [cx - halfW, topY + halfH];
    const top = [cx, topY];
    const right = [cx + halfW, topY + halfH];
    const center = [cx, topY + halfH * 2];
    const bottomLeft = [cx - halfW, topY + halfH + depth];
    const bottomCenter = [cx, topY + halfH * 2 + depth];
    const bottomRight = [cx + halfW, topY + halfH + depth];

    drawFaceTexture(context, definition.top, [left, top, right, center], null);
    drawFaceTexture(context, definition.side, [left, center, bottomCenter, bottomLeft], 'rgba(8, 20, 17, 0.29)');
    drawFaceTexture(context, definition.side, [center, right, bottomRight, bottomCenter], 'rgba(4, 13, 12, 0.13)');

    context.strokeStyle = 'rgba(9, 23, 17, 0.36)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left[0] + 0.5, left[1] + 0.5);
    context.lineTo(center[0] + 0.5, center[1] + 0.5);
    context.lineTo(right[0] - 0.5, right[1] + 0.5);
    context.stroke();

    return canvas.toDataURL('image/png');
  }

  /* ------------------------------------------------------------------
   * World data
   * ------------------------------------------------------------------ */

  const world = new Uint8Array(WORLD_X * WORLD_Y * WORLD_Z);
  const heightMap = new Int16Array(WORLD_X * WORLD_Z);
  const edits = new Map();
  const dirtyChunks = new Set();
  const chunks = new Map();
  const floraByChunk = new Map();
  const particles = [];
  const state = {
    started: false,
    paused: true,
    menuOpen: true,
    startedOnce: false,
    selectedType: 1,
    currentTarget: null,
    flying: false,
    onGround: false,
    jumpHeld: false,
    soundOn: true,
    yaw: 0,
    pitch: -0.055,
    bobPhase: 0,
    underwater: false,
    lastStep: 0,
    lastHudUpdate: 0,
    targetKey: '',
    resetArmed: false
  };
  const player = {
    x: 32.5,
    y: 10,
    z: 43.5,
    vx: 0,
    vy: 0,
    vz: 0
  };
  const keys = Object.create(null);
  const touchMove = { x: 0, y: 0, active: false, pointerId: null };
  const lookTouch = { active: false, pointerId: null, x: 0, y: 0 };
  let currentSeed = DEFAULT_SEED;
  let terrainSeed = DEFAULT_SEED;
  let saveTimer = 0;
  let toastTimer = 0;
  let labelTimer = 0;
  let walkTime = 0;
  let nextFootstep = 0;

  /* ------------------------------------------------------------------
   * Procedural island
   * ------------------------------------------------------------------ */

  function hash2(x, z, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function valueNoise(x, z, seed) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz, seed);
    const b = hash2(ix + 1, iz, seed);
    const c = hash2(ix, iz + 1, seed);
    const d = hash2(ix + 1, iz + 1, seed);
    return (a + (b - a) * ux) * (1 - uz) + (c + (d - c) * ux) * uz;
  }

  function fbm(x, z, seed) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let octave = 0; octave < 4; octave += 1) {
      value += valueNoise(x * frequency + octave * 17.31, z * frequency - octave * 9.73, seed + octave * 101) * amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return value;
  }

  function terrainHeight(x, z) {
    const dx = x - 32;
    const dz = z - 32;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const coast = (fbm(x * 0.075 + 31, z * 0.075 - 17, terrainSeed + 71) - 0.5) * 7.5;
    const island = 1 - smoothstep(18.5, 29.2, distance + coast);
    const broad = fbm(x * 0.052 + 5.3, z * 0.052 - 2.7, terrainSeed);
    const detail = fbm(x * 0.155 - 8.1, z * 0.155 + 12.8, terrainSeed + 31);
    let height = 2.7 + island * (2.7 + broad * 7.6 + detail * 1.5);

    // Flatten the starting glade so the player always begins on solid ground.
    const spawnDistance = Math.hypot(x - 32, z - 43);
    const glade = 1 - smoothstep(4.0, 8.5, spawnDistance);
    height = height * (1 - glade * 0.84) + 9.2 * glade * 0.84;

    return clamp(Math.round(height), 1, WORLD_Y - 16);
  }

  function generateHeightMap() {
    for (let z = 0; z < WORLD_Z; z += 1) {
      for (let x = 0; x < WORLD_X; x += 1) {
        heightMap[x + z * WORLD_X] = terrainHeight(x, z);
      }
    }
  }

  function isAir(x, y, z) {
    return inWorld(x, y, z) && world[blockIndex(x, y, z)] === 0;
  }

  function rawSet(x, y, z, type) {
    if (!inWorld(x, y, z)) return;
    world[blockIndex(x, y, z)] = type;
  }

  function generateTerrain() {
    for (let z = 0; z < WORLD_Z; z += 1) {
      for (let x = 0; x < WORLD_X; x += 1) {
        const height = heightMap[x + z * WORLD_X];
        const left = heightMap[(x > 0 ? x - 1 : x) + z * WORLD_X];
        const right = heightMap[(x < WORLD_X - 1 ? x + 1 : x) + z * WORLD_X];
        const back = heightMap[x + (z > 0 ? z - 1 : z) * WORLD_X];
        const front = heightMap[x + (z < WORLD_Z - 1 ? z + 1 : z) * WORLD_X];
        const slope = Math.max(Math.abs(height - left), Math.abs(height - right), Math.abs(height - back), Math.abs(height - front));

        for (let y = 0; y <= height; y += 1) {
          let type = 3;
          if (y === height) {
            if (height <= SEA_LEVEL + 1) {
              type = 9;
            } else if (slope >= 3 && height > SEA_LEVEL + 3) {
              type = 3;
            } else {
              type = 1;
            }
          } else if (y >= height - 3) {
            type = 2;
          }
          rawSet(x, y, z, type);
        }
      }
    }
  }

  function carvePath() {
    const random = mulberry32((terrainSeed ^ 0x2f6a1d3b) >>> 0);
    for (let z = 42; z >= 26; z -= 1) {
      const wave = Math.sin((z - 26) * 0.34) * 1.55 + Math.sin((z - 26) * 0.13) * 0.7;
      const centerX = Math.round(32 + wave);
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx !== 0 && random() > 0.42) continue;
        const x = centerX + dx;
        if (!inHorizontalWorld(x, z)) continue;
        const ground = heightMap[x + z * WORLD_X];
        const topIndex = blockIndex(x, ground, z);
        if (world[topIndex] === 1) world[topIndex] = 2;
      }
    }
  }

  function placeTree(x, z, trunkHeight, leafSeed) {
    const ground = heightMap[x + z * WORLD_X];
    if (ground < SEA_LEVEL + 2 || ground >= WORLD_Y - 12) return false;
    if (world[blockIndex(x, ground, z)] !== 1) return false;
    const random = mulberry32(leafSeed);
    const top = ground + trunkHeight;
    if (top + 2 >= WORLD_Y) return false;

    for (let y = ground + 1; y <= top; y += 1) {
      if (!isAir(x, y, z)) return false;
    }

    for (let y = ground + 1; y <= top; y += 1) {
      rawSet(x, y, z, 4);
    }

    for (let dy = -2; dy <= 1; dy += 1) {
      const radius = dy === 1 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dy === -2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 4 && random() < 0.28) continue;
          const px = x + dx;
          const py = top + dy;
          const pz = z + dz;
          if (isAir(px, py, pz)) rawSet(px, py, pz, 5);
        }
      }
    }

    if (isAir(x, top + 1, z)) rawSet(x, top + 1, z, 5);
    return true;
  }

  function placeRock(x, z, random) {
    const ground = heightMap[x + z * WORLD_X];
    if (ground < SEA_LEVEL + 1 || ground > WORLD_Y - 8) return;
    const width = random() > 0.55 ? 3 : 2;
    const depth = random() > 0.5 ? 2 : 3;
    for (let dz = 0; dz < depth; dz += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        if (Math.abs(dx - (width - 1) / 2) + Math.abs(dz - (depth - 1) / 2) > 1.6) continue;
        const px = x + dx;
        const pz = z + dz;
        if (!inHorizontalWorld(px, pz)) continue;
        const gy = heightMap[px + pz * WORLD_X];
        if (Math.abs(gy - ground) > 1) continue;
        rawSet(px, ground + 1, pz, 3);
        if (random() > 0.4) rawSet(px, ground + 2, pz, 3);
        if (random() > 0.85) rawSet(px, ground + 3, pz, 3);
      }
    }
  }

  function generateDecorations() {
    const random = mulberry32((terrainSeed ^ 0x9e3779b9) >>> 0);
    const placed = [];
    const treeSites = [
      [20, 28, 6],
      [44, 28, 6],
      [24, 23, 7],
      [41, 49, 6]
    ];

    for (const [x, z, height] of treeSites) {
      if (Math.hypot(x - 32, z - 43) < 15.5) continue;
      if (placeTree(x, z, height, random() * 1e9)) placed.push([x, z]);
    }

    let attempts = 0;
    while (placed.length < 16 && attempts < 180) {
      attempts += 1;
      const x = 5 + Math.floor(random() * (WORLD_X - 10));
      const z = 5 + Math.floor(random() * (WORLD_Z - 10));
      const ground = heightMap[x + z * WORLD_X];
      if (ground < SEA_LEVEL + 2) continue;
      if (Math.hypot(x - 32, z - 43) < 15.8) continue;
      if (Math.hypot(x - 32, z - 32) > 28) continue;
      if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.2)) continue;
      if (placeTree(x, z, 4 + Math.floor(random() * 4), random() * 1e9)) {
        placed.push([x, z]);
      }
    }

    for (let i = 0; i < 7; i += 1) {
      const x = 6 + Math.floor(random() * (WORLD_X - 12));
      const z = 6 + Math.floor(random() * (WORLD_Z - 12));
      if (Math.hypot(x - 32, z - 43) < 14) continue;
      if (Math.hypot(x - 32, z - 32) > 27) continue;
      placeRock(x, z, random);
    }

    generateFlora();
  }

  function generateFlora() {
    floraByChunk.clear();
    const random = mulberry32((terrainSeed ^ 0x51ed270b) >>> 0);
    for (let attempt = 0; attempt < 520; attempt += 1) {
      const x = 2 + Math.floor(random() * (WORLD_X - 4));
      const z = 2 + Math.floor(random() * (WORLD_Z - 4));
      if (Math.hypot(x - 32, z - 43) < 2.3) continue;
      const ground = heightMap[x + z * WORLD_X];
      if (world[blockIndex(x, ground, z)] !== 1) continue;
      if (!isAir(x, ground + 1, z)) continue;
      let tile = 14;
      if (random() < 0.19) tile = 12;
      else if (random() < 0.25) tile = 13;
      const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
      if (!floraByChunk.has(key)) floraByChunk.set(key, []);
      floraByChunk.get(key).push({
        x,
        y: ground + 1,
        z,
        tile,
        scale: 0.62 + random() * 0.42,
        rotation: random() * Math.PI * 2
      });
    }
  }

  function generateWorld(seed, keepEdits) {
    currentSeed = seed >>> 0;
    terrainSeed = currentSeed;
    world.fill(0);
    if (!keepEdits) edits.clear();
    generateHeightMap();
    generateTerrain();
    carvePath();
    generateDecorations();

    if (keepEdits) {
      edits.forEach((type, index) => {
        if (index >= 0 && index < world.length) world[index] = type;
      });
    }

    rebuildAllChunks();
  }

  function applyWorldEdit(index, type) {
    if (index < 0 || index >= world.length) return;
    world[index] = type;
    edits.set(index, type);
    scheduleSave();
  }

  /* ------------------------------------------------------------------
   * Scene
   * ------------------------------------------------------------------ */

  let scene;
  let camera;
  let renderer;
  let sky;
  let water;
  let waterUniforms;
  let blockMaterial;
  let glassMaterial;
  let outline;
  let dirLight;
  let hemiLight;
  let cloudGroup;
  const clouds = [];
  const useShadows = !isTouch;
  const clock = new THREE.Clock();
  let elapsed = 0;
  let menuOrbitAngle = 0.84;

  function initRenderer() {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = useShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x9bd2ea, 1);
    renderer.domElement.id = 'game-canvas';
    renderer.domElement.setAttribute('aria-label', 'Küp Dünyası 3B oyun alanı');
    dom.world.appendChild(renderer.domElement);
  }

  function initScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xb9dce8, 0.0068);

    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.08, 420);
    camera.rotation.order = 'YXZ';
    camera.position.set(58, 18, 49);

    hemiLight = new THREE.HemisphereLight(0xdff7ff, 0x637b4d, 0.64);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xfff4dd, 0.86);
    dirLight.position.set(66, 52, 58);
    dirLight.target.position.set(32, 8, 32);
    if (useShadows) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(1536, 1536);
      dirLight.shadow.camera.left = -48;
      dirLight.shadow.camera.right = 48;
      dirLight.shadow.camera.top = 48;
      dirLight.shadow.camera.bottom = -48;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 145;
      dirLight.shadow.bias = -0.00035;
      dirLight.shadow.normalBias = 0.025;
    }
    scene.add(dirLight);
    scene.add(dirLight.target);

    const skyGeometry = new THREE.SphereGeometry(300, 32, 20);
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(0.55, 0.62, 0.40).normalize() }
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDirection;
        uniform vec3 uSunDirection;
        void main() {
          vec3 dir = normalize(vDirection);
          vec3 horizon = vec3(0.79, 0.90, 0.94);
          vec3 zenith = vec3(0.28, 0.65, 0.90);
          float h = smoothstep(-0.10, 0.72, dir.y);
          vec3 color = mix(horizon, zenith, h);
          color = mix(vec3(0.91, 0.95, 0.88), color, smoothstep(-0.12, 0.08, dir.y));
          float sun = max(dot(dir, uSunDirection), 0.0);
          color += vec3(1.0, 0.73, 0.38) * pow(sun, 10.0) * 0.11;
          color += vec3(1.0, 0.94, 0.70) * pow(sun, 260.0) * 1.45;
          color += vec3(1.0, 0.97, 0.87) * pow(sun, 1600.0) * 2.2;
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.frustumCulled = false;
    scene.add(sky);

    blockMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      alphaTest: 0.45,
      side: THREE.DoubleSide
    });
    glassMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const watermarkGeometry = new THREE.PlaneGeometry(300, 300, 96, 96);
    watermarkGeometry.rotateX(-Math.PI / 2);
    waterUniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uShallow: { value: new THREE.Color(0x5fc4d6) },
      uDeep: { value: new THREE.Color(0x267fa2) },
      uFog: { value: new THREE.Color(0xb9dce8) }
    };
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPosition;
        varying float vWave;
        void main() {
          vec3 p = position;
          float wave = sin(p.x * 0.22 + uTime * 0.72) * 0.045
                     + sin(p.z * 0.31 - uTime * 0.57) * 0.035
                     + sin((p.x + p.z) * 0.09 + uTime * 0.41) * 0.055;
          p.y += wave;
          vec4 worldPosition = modelMatrix * vec4(p, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWave = wave;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uFog;
        varying vec3 vWorldPosition;
        varying float vWave;
        void main() {
          vec3 viewDirection = normalize(uCamPos - vWorldPosition);
          float facing = clamp(viewDirection.y, 0.0, 1.0);
          float shimmer = sin(vWorldPosition.x * 0.7 + uTime * 1.1) * sin(vWorldPosition.z * 0.8 - uTime * 0.8);
          vec3 color = mix(uDeep, uShallow, 0.45 + vWave * 3.0 + shimmer * 0.06);
          color += vec3(0.24, 0.45, 0.47) * pow(1.0 - facing, 2.0) * 0.38;
          color += vec3(0.36, 0.52, 0.48) * max(shimmer, 0.0) * 0.08;
          float distanceToCamera = length(uCamPos - vWorldPosition);
          float fogAmount = 1.0 - exp(-pow(distanceToCamera * 0.0072, 2.0));
          color = mix(color, uFog, clamp(fogAmount, 0.0, 0.9));
          float alpha = 0.67 + max(shimmer, 0.0) * 0.05;
          gl_FragColor = vec4(color, alpha);
        }
      `
    });
    water = new THREE.Mesh(watermarkGeometry, waterMaterial);
    water.position.set(WORLD_X / 2, WATER_Y, WORLD_Z / 2);
    water.receiveShadow = false;
    scene.add(water);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xf7ffe8,
      transparent: true,
      opacity: 0.86,
      depthTest: true
    });
    const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    outline = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    outline.visible = false;
    outline.renderOrder = 4;
    scene.add(outline);

    cloudGroup = new THREE.Group();
    const cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: true
    });
    const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cloudRandom = mulberry32(44221);
    for (let i = 0; i < 13; i += 1) {
      const cluster = new THREE.Group();
      const pieces = 2 + Math.floor(cloudRandom() * 4);
      for (let piece = 0; piece < pieces; piece += 1) {
        const mesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        mesh.scale.set(3 + cloudRandom() * 6, 0.9 + cloudRandom() * 0.8, 2 + cloudRandom() * 4);
        mesh.position.set((cloudRandom() - 0.5) * 8, (cloudRandom() - 0.5) * 0.9, (cloudRandom() - 0.5) * 5);
        cluster.add(mesh);
      }
      cluster.position.set(
        32 + (cloudRandom() - 0.5) * 160,
        31 + cloudRandom() * 13,
        32 + (cloudRandom() - 0.5) * 160
      );
      cluster.userData.speed = 0.35 + cloudRandom() * 0.55;
      cloudGroup.add(cluster);
      clouds.push(cluster);
    }
    scene.add(cloudGroup);
  }

  /* ------------------------------------------------------------------
   * Chunk meshing (face culling + ambient occlusion)
   * ------------------------------------------------------------------ */

  const FACES = [
    { n: [1, 0, 0], vertices: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], tile: 'side' },
    { n: [-1, 0, 0], vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], tile: 'side' },
    { n: [0, 1, 0], vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tile: 'top' },
    { n: [0, -1, 0], vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], tile: 'bottom' },
    { n: [0, 0, 1], vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], tile: 'side' },
    { n: [0, 0, -1], vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], tile: 'side' }
  ];

  function blockAt(x, y, z) {
    if (!inWorld(x, y, z)) return 0;
    return world[blockIndex(x, y, z)];
  }

  function isOccluder(type) {
    return type !== 0 && type !== 8;
  }

  function faceIsVisible(currentType, neighborType) {
    if (neighborType === 0) return true;
    if (neighborType === 8 && currentType !== 8) return true;
    return false;
  }

  function createGeometry(data) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setIndex(data.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  function pushFace(data, x, y, z, face, type, localX, localZ) {
    const definition = BLOCKS[type];
    const tile = definition[face.tile];
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    const inset = 0.35 / ATLAS_SIZE;
    const u0 = col / ATLAS_COLS + inset;
    const u1 = (col + 1) / ATLAS_COLS - inset;
    const v1 = 1 - (row / ATLAS_COLS + inset);
    const v0 = 1 - ((row + 1) / ATLAS_COLS - inset);
    const base = data.positions.length / 3;
    const normal = face.n;
    const neighborX = x + normal[0];
    const neighborY = y + normal[1];
    const neighborZ = z + normal[2];
    const axes = normal[0] !== 0 ? [1, 2] : normal[1] !== 0 ? [0, 2] : [0, 1];
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

    for (let i = 0; i < 4; i += 1) {
      const vertex = face.vertices[i];
      const signU = vertex[axes[0]] === 1 ? 1 : -1;
      const signV = vertex[axes[1]] === 1 ? 1 : -1;
      const offsetU = [0, 0, 0];
      const offsetV = [0, 0, 0];
      offsetU[axes[0]] = signU;
      offsetV[axes[1]] = signV;
      const side1 = isOccluder(blockAt(neighborX + offsetU[0], neighborY + offsetU[1], neighborZ + offsetU[2])) ? 1 : 0;
      const side2 = isOccluder(blockAt(neighborX + offsetV[0], neighborY + offsetV[1], neighborZ + offsetV[2])) ? 1 : 0;
      const corner = isOccluder(
        blockAt(
          neighborX + offsetU[0] + offsetV[0],
          neighborY + offsetU[1] + offsetV[1],
          neighborZ + offsetU[2] + offsetV[2]
        )
      ) ? 1 : 0;
      const ao = side1 && side2 ? 0.42 : 1 - (side1 + side2 + corner) * 0.16;

      data.positions.push(localX + vertex[0], y + vertex[1], localZ + vertex[2]);
      data.normals.push(normal[0], normal[1], normal[2]);
      data.uvs.push(uvs[i][0], uvs[i][1]);
      data.colors.push(ao, ao, ao);
    }

    data.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function pushPlant(data, plant, startX, startZ) {
    const tile = plant.tile;
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    const inset = 0.35 / ATLAS_SIZE;
    const u0 = col / ATLAS_COLS + inset;
    const u1 = (col + 1) / ATLAS_COLS - inset;
    const v1 = 1 - (row / ATLAS_COLS + inset);
    const v0 = 1 - ((row + 1) / ATLAS_COLS - inset);
    const cx = plant.x + 0.5 - startX;
    const cz = plant.z + 0.5 - startZ;
    const height = plant.scale * 1.08;
    const halfWidth = plant.scale * 0.43;
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

    for (let side = 0; side < 2; side += 1) {
      const angle = plant.rotation + side * Math.PI * 0.5;
      const dx = Math.cos(angle) * halfWidth;
      const dz = Math.sin(angle) * halfWidth;
      const base = data.positions.length / 3;
      const x0 = cx - dx;
      const z0 = cz - dz;
      const x1 = cx + dx;
      const z1 = cz + dz;
      const points = [
        [x0, plant.y, z0],
        [x1, plant.y, z1],
        [x1, plant.y + height, z1],
        [x0, plant.y + height, z0]
      ];
      for (let i = 0; i < 4; i += 1) {
        data.positions.push(points[i][0], points[i][1], points[i][2]);
        data.normals.push(0, 1, 0);
        data.uvs.push(uvs[i][0], uvs[i][1]);
        data.colors.push(0.92, 0.94, 0.88);
      }
      data.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  function buildChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const previous = chunks.get(key);
    if (previous) {
      for (const mesh of previous) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
    }

    const solid = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const glass = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const plants = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const startX = cx * CHUNK;
    const startZ = cz * CHUNK;
    const endX = Math.min(startX + CHUNK, WORLD_X);
    const endZ = Math.min(startZ + CHUNK, WORLD_Z);

    for (let y = 0; y < WORLD_Y; y += 1) {
      for (let z = startZ; z < endZ; z += 1) {
        for (let x = startX; x < endX; x += 1) {
          const type = world[blockIndex(x, y, z)];
          if (type === 0) continue;
          const definition = BLOCKS[type];
          if (!definition) continue;
          const target = definition.transparent ? glass : solid;
          for (const face of FACES) {
            const neighbor = blockAt(x + face.n[0], y + face.n[1], z + face.n[2]);
            if (!faceIsVisible(type, neighbor)) continue;
            pushFace(target, x, y, z, face, type, x - startX, z - startZ);
          }
        }
      }
    }

    const flora = floraByChunk.get(`${cx},${cz}`);
    if (flora) {
      for (const plant of flora) {
        if (blockAt(plant.x, plant.y, plant.z) === 0 && blockAt(plant.x, plant.y - 1, plant.z) === 1) {
          pushPlant(plants, plant, startX, startZ);
        }
      }
    }

    const meshes = [];
    if (solid.indices.length) {
      const geometry = createGeometry(solid);
      const mesh = new THREE.Mesh(geometry, blockMaterial);
      mesh.position.set(startX, 0, startZ);
      mesh.castShadow = useShadows;
      mesh.receiveShadow = useShadows;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      meshes.push(mesh);
    }
    if (glass.indices.length) {
      const geometry = createGeometry(glass);
      const mesh = new THREE.Mesh(geometry, glassMaterial);
      mesh.position.set(startX, 0, startZ);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 1;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      meshes.push(mesh);
    }
    if (plants.indices.length) {
      const geometry = createGeometry(plants);
      const mesh = new THREE.Mesh(geometry, blockMaterial);
      mesh.position.set(startX, 0, startZ);
      mesh.castShadow = false;
      mesh.receiveShadow = useShadows;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      meshes.push(mesh);
    }

    chunks.set(key, meshes);
  }

  function markChunkDirty(x, z) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    dirtyChunks.add(`${cx},${cz}`);
    if (x % CHUNK === 0) dirtyChunks.add(`${cx - 1},${cz}`);
    if (x % CHUNK === CHUNK - 1) dirtyChunks.add(`${cx + 1},${cz}`);
    if (z % CHUNK === 0) dirtyChunks.add(`${cx},${cz - 1}`);
    if (z % CHUNK === CHUNK - 1) dirtyChunks.add(`${cx},${cz + 1}`);
  }

  function flushDirtyChunks() {
    if (!dirtyChunks.size) return;
    for (const key of dirtyChunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx >= 0 && cz >= 0 && cx < WORLD_X / CHUNK && cz < WORLD_Z / CHUNK) buildChunk(cx, cz);
    }
    dirtyChunks.clear();
  }

  function rebuildAllChunks() {
    for (const [, meshes] of chunks) {
      for (const mesh of meshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    chunks.clear();
    dirtyChunks.clear();
    for (let cz = 0; cz < WORLD_Z / CHUNK; cz += 1) {
      for (let cx = 0; cx < WORLD_X / CHUNK; cx += 1) buildChunk(cx, cz);
    }
  }

  function setWorldBlock(x, y, z, type) {
    if (!inWorld(x, y, z)) return false;
    const index = blockIndex(x, y, z);
    if (world[index] === type) return false;
    world[index] = type;
    applyWorldEdit(index, type);
    markChunkDirty(x, z);
    return true;
  }

  /* ------------------------------------------------------------------
   * Particles
   * ------------------------------------------------------------------ */

  const particleGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  const particleMaterials = new Map();
  let particleRandomSeed = 17;

  function particleMaterial(color) {
    if (!particleMaterials.has(color)) {
      particleMaterials.set(color, new THREE.MeshLambertMaterial({ color }));
    }
    return particleMaterials.get(color);
  }

  function spawnBlockParticles(x, y, z, type, amount) {
    const definition = BLOCKS[type];
    if (!definition) return;
    const random = mulberry32((particleRandomSeed += 977));
    for (let i = 0; i < amount; i += 1) {
      const material = particleMaterial(definition.particle);
      const mesh = new THREE.Mesh(particleGeometry, material);
      mesh.position.set(
        x + 0.18 + random() * 0.64,
        y + 0.18 + random() * 0.64,
        z + 0.18 + random() * 0.64
      );
      const scale = 0.55 + random() * 0.9;
      mesh.scale.setScalar(scale);
      mesh.rotation.set(random() * 3, random() * 3, random() * 3);
      mesh.castShadow = false;
      scene.add(mesh);
      particles.push({
        mesh,
        vx: (random() - 0.5) * 4.2,
        vy: 1.8 + random() * 3.7,
        vz: (random() - 0.5) * 4.2,
        rx: (random() - 0.5) * 8,
        ry: (random() - 0.5) * 8,
        life: 0.5 + random() * 0.55,
        maxLife: 1
      });
    }
    if (particles.length > 150) {
      const excess = particles.length - 150;
      for (let i = 0; i < excess; i += 1) {
        const particle = particles.shift();
        scene.remove(particle.mesh);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        scene.remove(particle.mesh);
        particles.splice(i, 1);
        continue;
      }
      particle.vy -= 18 * dt;
      particle.mesh.position.x += particle.vx * dt;
      particle.mesh.position.y += particle.vy * dt;
      particle.mesh.position.z += particle.vz * dt;
      particle.mesh.rotation.x += particle.rx * dt;
      particle.mesh.rotation.y += particle.ry * dt;
      particle.mesh.scale.multiplyScalar(0.996);
    }
  }

  /* ------------------------------------------------------------------
   * Tiny procedural sound engine
   * ------------------------------------------------------------------ */

  class SoundEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = true;
    }

    init() {
      if (this.context) {
        if (this.context.state === 'suspended') this.context.resume();
        return;
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.24;
      this.master.connect(this.context.destination);
    }

    setEnabled(value) {
      this.enabled = value;
      if (value) this.init();
    }

    tone(frequency, duration, type, volume, endFrequency) {
      if (!this.enabled) return;
      this.init();
      if (!this.context) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type || 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    }

    noise(duration, cutoff, volume) {
      if (!this.enabled) return;
      this.init();
      if (!this.context) return;
      const now = this.context.currentTime;
      const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
      source.stop(now + duration + 0.02);
    }

    breakBlock(type) {
      this.noise(0.11, type === 8 ? 2400 : 900, 0.16);
      this.tone(130, 0.08, 'triangle', 0.045, 76);
    }

    placeBlock() {
      this.tone(250, 0.055, 'square', 0.035, 320);
      this.tone(390, 0.075, 'sine', 0.03, 470);
      this.noise(0.045, 1400, 0.055);
    }

    jump() {
      this.tone(230, 0.1, 'sine', 0.032, 430);
    }

    step() {
      this.noise(0.045, 380 + Math.random() * 200, 0.03);
    }

    select() {
      this.tone(620, 0.035, 'sine', 0.023, 740);
    }
  }

  const sfx = new SoundEngine();

  /* ------------------------------------------------------------------
   * Persistence
   * ------------------------------------------------------------------ */

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistWorld, 650);
  }

  function persistWorld() {
    try {
      const payload = {
        version: 1,
        seed: currentSeed,
        edits: Array.from(edits.entries())
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Private mode or a full storage quota should never interrupt play.
    }
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || !Number.isFinite(payload.seed)) return;
      currentSeed = payload.seed >>> 0;
      edits.clear();
      if (Array.isArray(payload.edits)) {
        for (const entry of payload.edits) {
          if (!Array.isArray(entry) || entry.length !== 2) continue;
          const index = Number(entry[0]);
          const type = Number(entry[1]);
          if (Number.isInteger(index) && index >= 0 && index < world.length && Number.isInteger(type) && type >= 0 && type <= 9) {
            edits.set(index, type);
          }
        }
      }
    } catch (error) {
      // Ignore invalid or unavailable saves.
    }
  }

  /* ------------------------------------------------------------------
   * Interface
   * ------------------------------------------------------------------ */

  function buildHotbar() {
    dom.hotbar.innerHTML = '';
    PALETTE.forEach((type, index) => {
      const definition = BLOCKS[type];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `slot${index === 0 ? ' active' : ''}`;
      button.dataset.type = String(type);
      button.setAttribute('aria-label', `${index + 1}. blok: ${definition.name}`);
      button.innerHTML = `<span class="slot-key">${index + 1}</span><span class="slot-icon"></span>`;
      button.querySelector('.slot-icon').style.backgroundImage = `url("${makeBlockIcon(type)}")`;
      button.addEventListener('click', () => selectBlock(type, true));
      dom.hotbar.appendChild(button);
    });
  }

  function selectBlock(type, announce) {
    if (!BLOCKS[type]) return;
    state.selectedType = type;
    for (const slot of dom.hotbar.querySelectorAll('.slot')) {
      slot.classList.toggle('active', Number(slot.dataset.type) === type);
    }
    if (announce) {
      sfx.select();
      showBlockLabel();
    }
  }

  function showBlockLabel() {
    const definition = BLOCKS[state.selectedType];
    const index = PALETTE.indexOf(state.selectedType);
    dom.blockLabelNum.textContent = String(index + 1).padStart(2, '0');
    dom.blockLabelName.textContent = definition.iconName;
    dom.blockLabel.classList.add('show');
    window.clearTimeout(labelTimer);
    labelTimer = window.setTimeout(() => dom.blockLabel.classList.remove('show'), 1500);
  }

  function showToast(message, duration) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.remove('show'), duration || 1900);
  }

  function updateSoundButton() {
    dom.soundBtn.setAttribute('aria-pressed', String(state.soundOn));
    dom.soundLabel.textContent = state.soundOn ? 'SES AÇIK' : 'SES KAPALI';
    dom.soundIcon.textContent = state.soundOn ? '◖))' : '◖×';
  }

  function setMenuCopy(paused) {
    if (paused) {
      dom.menuKicker.textContent = 'DÜNYA SENİ BEKLİYOR';
      dom.menuTitle.innerHTML = 'MOLA<br><span>ZAMANI</span>';
      dom.menuDesc.textContent = 'Devam etmek için aşağıdaki butona tıkla. İlerlemen otomatik olarak kaydedildi.';
      dom.menuEdition.textContent = 'OTOMATİK KAYIT AKTİF';
      dom.playLabel.textContent = 'DEVAM ET';
    } else {
      dom.menuKicker.textContent = 'BLOK BLOK BİR DÜNYA';
      dom.menuTitle.innerHTML = 'KÜP<br><span>DÜNYASI</span>';
      dom.menuDesc.textContent = 'Kendi adanı keşfet. Dağları kaz, ağaçları devir ve hayalindeki dünyayı blok blok inşa et.';
      dom.menuEdition.textContent = isTouch ? 'DOKUNMATİK SÜRÜM' : 'YAZ TATİLİ SÜRÜMÜ';
      dom.playLabel.textContent = isTouch ? 'DOKUNARAK OYNA' : 'DÜNYAYA GİR';
    }
    dom.controlNote.textContent = isTouch ? 'DOKUNMATİK KONTROLLER' : 'FARE + KLAVYE';
  }

  function openMenu() {
    if (!state.started) return;
    state.menuOpen = true;
    state.paused = true;
    state.jumpHeld = false;
    clearKeys();
    document.body.classList.add('menu-open');
    setMenuCopy(true);
    dom.resetBtn.textContent = 'YENİ DÜNYA';
    state.resetArmed = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function closeMenu() {
    state.menuOpen = false;
    state.paused = false;
    document.body.classList.remove('menu-open');
  }

  function startGame(skipPointerLock) {
    sfx.init();
    if (!state.started) {
      state.started = true;
      state.startedOnce = true;
      respawn();
      document.body.classList.add('playing');
      showToast(isTouch ? 'Joystick ile yürü, ekranı sürükleyerek etrafa bak.' : 'WASD ile yürü · Boşluk ile zıpla · F ile uç.', 2600);
      showBlockLabel();
    } else {
      showToast('Kaldığın yerden devam ediyorsun.', 1300);
    }
    closeMenu();
    state.paused = false;
    if (!isTouch && !skipPointerLock) {
      const canvas = renderer.domElement;
      if (document.pointerLockElement !== canvas) {
        const request = canvas.requestPointerLock();
        if (request && typeof request.catch === 'function') request.catch(() => {});
      }
    }
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    sfx.setEnabled(state.soundOn);
    updateSoundButton();
    try {
      localStorage.setItem(SOUND_KEY, state.soundOn ? '1' : '0');
    } catch (error) {
      // No-op.
    }
    if (state.soundOn) sfx.select();
    showToast(state.soundOn ? 'Ses açıldı.' : 'Ses kapatıldı.', 1200);
  }

  function disarmReset() {
    state.resetArmed = false;
    dom.resetBtn.textContent = 'YENİ DÜNYA';
    dom.resetBtn.classList.remove('armed');
  }

  function armOrResetWorld() {
    if (!state.resetArmed) {
      state.resetArmed = true;
      dom.resetBtn.textContent = 'EMİN MİSİN?';
      dom.resetBtn.classList.add('armed');
      window.setTimeout(() => {
        if (state.resetArmed) disarmReset();
      }, 3200);
      return;
    }
    disarmReset();
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      // No-op.
    }
    edits.clear();
    const newSeed = ((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    generateWorld(newSeed, false);
    respawn();
    persistWorld();
    showToast('Yeni ada hazır. İyi inşa etmeler!', 2200);
  }

  /* ------------------------------------------------------------------
   * Target selection
   * ------------------------------------------------------------------ */

  function raycastVoxel(origin, direction, maxDistance) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);
    const deltaX = stepX === 0 ? Infinity : Math.abs(1 / direction.x);
    const deltaY = stepY === 0 ? Infinity : Math.abs(1 / direction.y);
    const deltaZ = stepZ === 0 ? Infinity : Math.abs(1 / direction.z);
    let maxX = stepX === 0 ? Infinity : stepX > 0 ? (x + 1 - origin.x) / direction.x : (x - origin.x) / direction.x;
    let maxY = stepY === 0 ? Infinity : stepY > 0 ? (y + 1 - origin.y) / direction.y : (y - origin.y) / direction.y;
    let maxZ = stepZ === 0 ? Infinity : stepZ > 0 ? (z + 1 - origin.z) / direction.z : (z - origin.z) / direction.z;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    for (let i = 0; i < 160; i += 1) {
      if (inWorld(x, y, z)) {
        const type = world[blockIndex(x, y, z)];
        if (type !== 0) {
          return { x, y, z, type, nx, ny, nz };
        }
      }
      if (maxX < maxY && maxX < maxZ) {
        if (maxX > maxDistance) break;
        x += stepX;
        maxX += deltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (maxY < maxZ) {
        if (maxY > maxDistance) break;
        y += stepY;
        maxY += deltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        if (maxZ > maxDistance) break;
        z += stepZ;
        maxZ += deltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  function clearTarget() {
    state.currentTarget = null;
    state.targetKey = '';
    outline.visible = false;
    dom.targetPill.classList.remove('show');
  }

  function updateTargeting() {
    if (!state.started || state.paused || state.menuOpen) {
      clearTarget();
      return;
    }
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const hit = raycastVoxel(camera.position, direction, MAX_TARGET_DISTANCE);
    state.currentTarget = hit;
    if (!hit) {
      clearTarget();
      return;
    }

    outline.visible = true;
    outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    const key = `${hit.x},${hit.y},${hit.z},${hit.type}`;
    if (key !== state.targetKey) {
      state.targetKey = key;
      dom.targetName.textContent = BLOCKS[hit.type] ? BLOCKS[hit.type].iconName : 'Blok';
      dom.targetPill.classList.add('show');
    }
  }

  function breakTargetBlock() {
    const hit = state.currentTarget;
    if (!hit || !state.started || state.paused) return;
    if (hit.y <= 0) {
      showToast('Dünyanın temel katmanı kırılamaz.', 1400);
      return;
    }
    const brokenType = hit.type;
    if (setWorldBlock(hit.x, hit.y, hit.z, 0)) {
      spawnBlockParticles(hit.x, hit.y, hit.z, brokenType, 11);
      sfx.breakBlock(brokenType);
      clearTarget();
    }
  }

  function blockIntersectsPlayer(x, y, z) {
    const pMinX = player.x - PLAYER_RADIUS;
    const pMaxX = player.x + PLAYER_RADIUS;
    const pMinY = player.y;
    const pMaxY = player.y + PLAYER_HEIGHT;
    const pMinZ = player.z - PLAYER_RADIUS;
    const pMaxZ = player.z + PLAYER_RADIUS;
    return (
      x + 1 > pMinX + 0.015 &&
      x < pMaxX - 0.015 &&
      y + 1 > pMinY + 0.015 &&
      y < pMaxY - 0.015 &&
      z + 1 > pMinZ + 0.015 &&
      z < pMaxZ - 0.015
    );
  }

  function placeSelectedBlock() {
    const hit = state.currentTarget;
    if (!hit || !state.started || state.paused) return;
    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;
    if (!inWorld(x, y, z)) return;
    if (world[blockIndex(x, y, z)] !== 0) return;
    if (blockIntersectsPlayer(x, y, z)) {
      showToast('Buraya blok koyamazsın.', 1100);
      return;
    }
    if (setWorldBlock(x, y, z, state.selectedType)) {
      spawnBlockParticles(x, y, z, state.selectedType, 4);
      sfx.placeBlock();
    }
  }

  /* ------------------------------------------------------------------
   * Player movement & camera
   * ------------------------------------------------------------------ */

  function collidesAt(x, y, z) {
    if (x - PLAYER_RADIUS < 0 || x + PLAYER_RADIUS > WORLD_X || z - PLAYER_RADIUS < 0 || z + PLAYER_RADIUS > WORLD_Z) return true;
    if (y < 0 || y + PLAYER_HEIGHT > WORLD_Y) return true;
    const minX = Math.floor(x - PLAYER_RADIUS + 0.001);
    const maxX = Math.floor(x + PLAYER_RADIUS - 0.001);
    const minY = Math.floor(y + 0.001);
    const maxY = Math.floor(y + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(z - PLAYER_RADIUS + 0.001);
    const maxZ = Math.floor(z + PLAYER_RADIUS - 0.001);
    for (let by = minY; by <= maxY; by += 1) {
      for (let bz = minZ; bz <= maxZ; bz += 1) {
        for (let bx = minX; bx <= maxX; bx += 1) {
          if (!inWorld(bx, by, bz)) return true;
          if (world[blockIndex(bx, by, bz)] !== 0) return true;
        }
      }
    }
    return false;
  }

  function moveAxis(axis, amount, canStep) {
    if (!amount) return;
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.18));
    const increment = amount / steps;
    let stepped = false;
    for (let i = 0; i < steps; i += 1) {
      const previous = player[axis];
      player[axis] += increment;
      if (!collidesAt(player.x, player.y, player.z)) continue;

      if (axis !== 'y' && canStep && !state.flying && !stepped) {
        const oldY = player.y;
        player.y += 1.015;
        if (!collidesAt(player.x, player.y, player.z)) {
          stepped = true;
          continue;
        }
        player.y = oldY;
      }

      player[axis] = previous;
      if (axis === 'y') {
        if (increment < 0) state.onGround = true;
        player.vy = 0;
      } else if (axis === 'x') {
        player.vx = 0;
      } else {
        player.vz = 0;
      }
      break;
    }
  }

  function readMovementInput() {
    let x = 0;
    let y = 0;
    if (isTouch) {
      x = touchMove.x;
      y = touchMove.y;
      if (Math.hypot(x, y) < 0.12) {
        x = 0;
        y = 0;
      }
    } else {
      if (keys.KeyA) x -= 1;
      if (keys.KeyD) x += 1;
      if (keys.KeyW) y -= 1;
      if (keys.KeyS) y += 1;
    }
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y, length: Math.min(1, length) };
  }

  function updatePlayer(dt) {
    const movement = readMovementInput();
    const forwardX = -Math.sin(state.yaw);
    const forwardZ = -Math.cos(state.yaw);
    const rightX = Math.cos(state.yaw);
    const rightZ = -Math.sin(state.yaw);
    const wishX = forwardX * -movement.y + rightX * movement.x;
    const wishZ = forwardZ * -movement.y + rightZ * movement.x;
    const feetInWater = player.y < WATER_Y - 0.06;
    const sprinting = !state.flying && (keys.ShiftLeft || keys.ShiftRight) && movement.length > 0.25;
    const speed = state.flying ? 9.8 : feetInWater ? 3.7 : sprinting ? 8.1 : 5.15;
    const acceleration = state.flying ? 8.5 : state.onGround ? 14 : feetInWater ? 5.2 : 6.3;

    player.vx = damp(player.vx, wishX * speed, acceleration, dt);
    player.vz = damp(player.vz, wishZ * speed, acceleration, dt);

    if (state.flying) {
      const vertical = (state.jumpHeld ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
      player.vy = damp(player.vy, vertical * 8.2, 10, dt);
    } else if (feetInWater) {
      if (state.jumpHeld) player.vy = Math.min(player.vy + 19 * dt, 4.3);
      player.vy -= 5.4 * dt;
      player.vy = clamp(player.vy, -3.5, 4.6);
      player.vy *= Math.exp(-1.5 * dt);
    } else {
      if (state.jumpHeld && state.onGround) {
        player.vy = 8.65;
        state.onGround = false;
        sfx.jump();
      }
      player.vy -= 25.5 * dt;
      player.vy = Math.max(player.vy, -33);
    }

    const canStep = state.onGround && !state.flying;
    moveAxis('x', player.vx * dt, canStep);
    moveAxis('z', player.vz * dt, canStep);
    state.onGround = false;
    moveAxis('y', player.vy * dt, false);

    if (player.y < -8) {
      respawn();
      showToast('Suda çok derine daldın. Başlangıç noktasına döndün.', 2200);
      return;
    }

    const horizontalSpeed = Math.hypot(player.vx, player.vz);
    const movingOnGround = state.onGround && !state.flying && horizontalSpeed > 1.1;
    if (movingOnGround) {
      state.bobPhase += dt * (sprinting ? 14.8 : 10.8);
      if (elapsed > nextFootstep) {
        sfx.step();
        nextFootstep = elapsed + (sprinting ? 0.28 : 0.39);
      }
    }
  }

  function updatePlayerCamera(dt) {
    const horizontalSpeed = Math.hypot(player.vx, player.vz);
    const moving = state.onGround && !state.flying && horizontalSpeed > 0.8;
    const targetBob = moving ? Math.sin(state.bobPhase) * (horizontalSpeed > 6.4 ? 0.052 : 0.032) : 0;
    state.bobAmount = damp(state.bobAmount || 0, targetBob, 9, dt);
    const roll = moving ? Math.cos(state.bobPhase * 0.5) * 0.004 : 0;

    camera.position.set(player.x, player.y + EYE_HEIGHT + state.bobAmount, player.z);
    camera.rotation.set(state.pitch, state.yaw, roll, 'YXZ');

    const sprinting = (keys.ShiftLeft || keys.ShiftRight) && horizontalSpeed > 4.5;
    const targetFov = state.flying ? 75 : sprinting ? 77 : 72;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = damp(camera.fov, targetFov, 7, dt);
      camera.updateProjectionMatrix();
    }
  }

  function updateMenuCamera(dt) {
    const radius = 37.5;
    camera.position.set(
      32 + Math.cos(menuOrbitAngle) * radius,
      17.5 + Math.sin(elapsed * 0.16) * 1.3,
      32 + Math.sin(menuOrbitAngle) * radius
    );
    camera.lookAt(36, 8.1, 32);
    if (Math.abs(camera.fov - 52) > 0.01) {
      camera.fov = 52;
      camera.updateProjectionMatrix();
    }
  }

  function highestSolidAt(x, z) {
    for (let y = WORLD_Y - 1; y >= 0; y -= 1) {
      if (world[blockIndex(x, y, z)] !== 0) return y + 1;
    }
    return 1;
  }

  function respawn() {
    player.x = 32.5;
    player.z = 43.5;
    player.y = highestSolidAt(32, 43) + 0.002;
    for (let i = 0; i < 20 && collidesAt(player.x, player.y, player.z); i += 1) {
      player.y += 0.05;
    }
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    state.yaw = 0;
    state.pitch = -0.055;
    state.onGround = false;
    state.flying = false;
    state.jumpHeld = false;
    state.bobPhase = 0;
    state.bobAmount = 0;
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  }

  /* ------------------------------------------------------------------
   * Per-frame world effects
   * ------------------------------------------------------------------ */

  function updateWater(dt) {
    waterUniforms.uTime.value += dt;
    waterUniforms.uCamPos.value.copy(camera.position);
  }

  function updateClouds(dt) {
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 118) cloud.position.x = -54;
    }
  }

  function setUnderwater(active) {
    if (state.underwater === active) return;
    state.underwater = active;
    document.body.classList.toggle('underwater', active);
    scene.fog.color.setHex(active ? 0x2a7487 : 0xb9dce8);
    scene.fog.density = active ? 0.042 : 0.0068;
    hemiLight.intensity = active ? 0.48 : 0.64;
    dirLight.intensity = active ? 0.48 : 0.86;
    waterUniforms.uFog.value.setHex(active ? 0x2a7487 : 0xb9dce8);
  }

  function updateHud(force) {
    if (!force && elapsed - state.lastHudUpdate < 0.1) return;
    state.lastHudUpdate = elapsed;
    if (!state.started) return;
    dom.coords.textContent = `${Math.floor(player.x)} · ${Math.floor(player.y)} · ${Math.floor(player.z)}`;
    const heading = ((-state.yaw * 180) / Math.PI + 360) % 360;
    const directions = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
    const direction = directions[Math.round(heading / 45) % 8];
    dom.compassDir.textContent = direction;
    dom.compassDeg.textContent = `${Math.round(heading)}°`;
  }

  function updateEnvironment() {
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    setUnderwater(camera.position.y < WATER_Y - 0.02);
  }

  /* ------------------------------------------------------------------
   * Input
   * ------------------------------------------------------------------ */

  function clearKeys() {
    for (const key of Object.keys(keys)) delete keys[key];
    state.jumpHeld = false;
    touchMove.x = 0;
    touchMove.y = 0;
    touchMove.active = false;
    dom.joystickKnob.style.transform = 'translate(-50%, -50%)';
  }

  function toggleFlight() {
    state.flying = !state.flying;
    player.vy = 0;
    showToast(state.flying ? 'Uçuş modu açık · Boşluk: yukarı, Shift: aşağı' : 'Uçuş modu kapalı.', 1900);
  }

  function cycleBlock(direction) {
    const current = PALETTE.indexOf(state.selectedType);
    const next = (current + direction + PALETTE.length) % PALETTE.length;
    selectBlock(PALETTE[next], true);
  }

  function setupDesktopInput() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyM' && state.started) {
        toggleSound();
        return;
      }
      if (event.code === 'Enter' && state.menuOpen && state.started) {
        startGame();
        return;
      }
      if (!state.started || state.menuOpen) return;

      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
      if (event.repeat) {
        if (event.code === 'Space') state.jumpHeld = true;
        return;
      }

      switch (event.code) {
        case 'KeyW':
        case 'KeyA':
        case 'KeyS':
        case 'KeyD':
          keys[event.code] = true;
          break;
        case 'Space':
          state.jumpHeld = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys[event.code] = true;
          break;
        case 'KeyF':
          toggleFlight();
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7':
        case 'Digit8': {
          const index = Number(event.code.slice(-1)) - 1;
          selectBlock(PALETTE[index], true);
          break;
        }
        default:
          break;
      }
    });

    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') state.jumpHeld = false;
      if (event.code in keys) keys[event.code] = false;
    });

    window.addEventListener('blur', clearKeys);

    document.addEventListener('mousemove', (event) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      if (!state.started || state.paused) return;
      state.yaw -= event.movementX * 0.00215;
      state.pitch -= event.movementY * 0.00205;
      state.pitch = clamp(state.pitch, -1.49, 1.49);
    });

    document.addEventListener('mousedown', (event) => {
      if (isTouch || !state.started || state.paused || state.menuOpen) return;
      if (event.target !== renderer.domElement) return;
      if (document.pointerLockElement !== renderer.domElement) {
        if (event.button === 0) renderer.domElement.requestPointerLock();
        return;
      }
      if (event.button === 0) {
        breakTargetBlock();
      } else if (event.button === 2) {
        placeSelectedBlock();
      } else if (event.button === 1) {
        event.preventDefault();
        const hit = state.currentTarget;
        if (hit && PALETTE.includes(hit.type)) selectBlock(hit.type, true);
      }
    });

    document.addEventListener('contextmenu', (event) => {
      if (event.target === renderer.domElement) event.preventDefault();
    });

    window.addEventListener('wheel', (event) => {
      if (!state.started || state.paused || state.menuOpen) return;
      if (event.target !== renderer.domElement) return;
      event.preventDefault();
      cycleBlock(event.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === renderer.domElement) {
        if (state.menuOpen) {
          closeMenu();
          state.paused = false;
        }
      } else if (state.started && !state.menuOpen && !isTouch) {
        openMenu();
      }
    });

    document.addEventListener('pointerlockerror', () => {
      if (state.started && !state.menuOpen) {
        showToast('Fare kilidi başlatılamadı. Tekrar tıklayarak dene.', 2400);
      }
    });
  }

  function setupTouchInput() {
    const updateJoystick = (event) => {
      const rect = dom.joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const limit = rect.width * 0.34;
      const distance = Math.hypot(dx, dy);
      if (distance > limit) {
        dx = (dx / distance) * limit;
        dy = (dy / distance) * limit;
      }
      touchMove.x = dx / limit;
      touchMove.y = dy / limit;
      dom.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    dom.joystick.addEventListener('pointerdown', (event) => {
      if (!state.started || state.paused || state.menuOpen) return;
      event.preventDefault();
      touchMove.active = true;
      touchMove.pointerId = event.pointerId;
      dom.joystick.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });

    dom.joystick.addEventListener('pointermove', (event) => {
      if (!touchMove.active || event.pointerId !== touchMove.pointerId) return;
      event.preventDefault();
      updateJoystick(event);
    });

    const releaseJoystick = (event) => {
      if (event.pointerId !== touchMove.pointerId) return;
      touchMove.active = false;
      touchMove.pointerId = null;
      touchMove.x = 0;
      touchMove.y = 0;
      dom.joystickKnob.style.transform = 'translate(-50%, -50%)';
    };
    dom.joystick.addEventListener('pointerup', releaseJoystick);
    dom.joystick.addEventListener('pointercancel', releaseJoystick);
    dom.joystick.addEventListener('lostpointercapture', releaseJoystick);

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' || !state.started || state.paused || state.menuOpen) return;
      if (lookTouch.active) return;
      lookTouch.active = true;
      lookTouch.pointerId = event.pointerId;
      lookTouch.x = event.clientX;
      lookTouch.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!lookTouch.active || event.pointerId !== lookTouch.pointerId) return;
      const dx = event.clientX - lookTouch.x;
      const dy = event.clientY - lookTouch.y;
      lookTouch.x = event.clientX;
      lookTouch.y = event.clientY;
      state.yaw -= dx * 0.0044;
      state.pitch -= dy * 0.0042;
      state.pitch = clamp(state.pitch, -1.49, 1.49);
    });

    const releaseLook = (event) => {
      if (event.pointerId !== lookTouch.pointerId) return;
      lookTouch.active = false;
      lookTouch.pointerId = null;
    };
    canvas.addEventListener('pointerup', releaseLook);
    canvas.addEventListener('pointercancel', releaseLook);

    const pressAction = (button, action) => {
      button.addEventListener('pointerdown', (event) => {
        if (!state.started || state.paused || state.menuOpen) return;
        event.preventDefault();
        button.classList.add('pressed');
        action();
        window.setTimeout(() => button.classList.remove('pressed'), 110);
        if (navigator.vibrate) navigator.vibrate(7);
      });
    };

    pressAction(dom.btnBreak, breakTargetBlock);
    pressAction(dom.btnPlace, placeSelectedBlock);

    dom.btnJump.addEventListener('pointerdown', (event) => {
      if (!state.started || state.paused || state.menuOpen) return;
      event.preventDefault();
      state.jumpHeld = true;
      dom.btnJump.classList.add('pressed');
    });
    const releaseJump = () => {
      state.jumpHeld = false;
      dom.btnJump.classList.remove('pressed');
    };
    dom.btnJump.addEventListener('pointerup', releaseJump);
    dom.btnJump.addEventListener('pointercancel', releaseJump);
    dom.btnJump.addEventListener('lostpointercapture', releaseJump);
  }

  function setupInterface() {
    dom.playBtn.addEventListener('click', () => startGame(false));
    dom.soundBtn.addEventListener('click', toggleSound);
    dom.resetBtn.addEventListener('click', armOrResetWorld);
    setMenuCopy(false);
    updateSoundButton();

    try {
      const savedSound = localStorage.getItem(SOUND_KEY);
      if (savedSound === '0') {
        state.soundOn = false;
        sfx.enabled = false;
      }
    } catch (error) {
      // No-op.
    }
    updateSoundButton();
    dom.targetAction.textContent = isTouch ? 'KIR · KOY' : 'SOL TIK KIR · SAĞ TIK KOY';
    selectBlock(1, false);
  }

  function setupEvents() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('pagehide', persistWorld);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        persistWorld();
        clearKeys();
      }
    });
    if (!isTouch) setupDesktopInput();
    setupTouchInput();
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ------------------------------------------------------------------
   * Main loop
   * ------------------------------------------------------------------ */

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (state.started) {
      if (state.paused) {
        if (!state.menuOpen) state.paused = false;
      } else {
        updatePlayer(dt);
      }
      updatePlayerCamera(dt);
      updateHud(false);
      if (state.paused) clearTarget();
      else updateTargeting();
    } else {
      updateMenuCamera(dt);
    }

    if (state.started) updateEnvironment();
    else {
      sky.position.copy(camera.position);
      setUnderwater(false);
    }

    updateWater(dt);
    updateClouds(dt);
    updateParticles(dt);
    flushDirtyChunks();
    updateHud(false);
    renderer.render(scene, camera);
  }

  /* ------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------ */

  function init() {
    atlasCanvas = createAtlas();
    atlasTexture = makeAtlasTexture();
    initRenderer();
    initScene();
    loadSave();
    generateWorld(currentSeed, true);
    respawn();
    buildHotbar();
    setupInterface();
    setupEvents();
    updateHud(true);
    animate();
  }

  // A tiny debug/automation surface, useful for screenshot checks and for
  // tinkering in the console without exposing gameplay shortcuts in the UI.
  window.__VOXEL_GAME__ = {
    start: () => startGame(true),
    pause: openMenu,
    getState: () => ({
      started: state.started,
      paused: state.paused,
      menuOpen: state.menuOpen,
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: state.yaw,
      pitch: state.pitch,
      flying: state.flying,
      selectedType: state.selectedType,
      target: state.currentTarget,
      seed: currentSeed,
      chunks: chunks.size,
      edits: edits.size
    }),
    look: (yaw, pitch) => {
      state.yaw = yaw;
      state.pitch = clamp(pitch, -1.49, 1.49);
    },
    teleport: (x, y, z) => {
      player.x = x;
      player.y = y;
      player.z = z;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
    },
    select: (type) => selectBlock(type, true),
    breakTarget: breakTargetBlock,
    placeTarget: placeSelectedBlock,
    setBlock: (x, y, z, type) => {
      const changed = setWorldBlock(x, y, z, type);
      flushDirtyChunks();
      return changed;
    },
    flush: flushDirtyChunks,
    debug: () => ({ renderer, scene, camera, dirLight, hemiLight, water }),
    regenerate: (seed) => {
      generateWorld(seed === undefined ? ((Date.now() ^ 0x5f3759df) >>> 0) : seed, false);
      respawn();
      persistWorld();
    }
  };

  try {
    init();
  } catch (error) {
    console.error('Küp Dünyası could not start:', error);
    const message = document.createElement('p');
    message.style.cssText = 'position:fixed;inset:auto 20px 20px;z-index:99;color:#fff;background:#7c2d2d;padding:14px 18px;border-radius:8px;font:14px sans-serif';
    message.textContent = '3B sahne başlatılamadı. WebGL desteğini kontrol edip sayfayı yenile.';
    document.body.appendChild(message);
  }
})();
