// Relay Stack - Three.js scene, tap input, route animation, UI wiring.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { parseLevel, simulate, solve, starsFor } from './logic.js';
import { LEVELS, WORLDS } from './levels.js';
import { mountStyles } from './styles.js';

mountStyles();

const SAVE_KEY = 'relay-stack-2027:v1';
const STEP_TIME = 0.2;   // seconds per tile while the ball runs
const BALL_R = 0.2;
const CAP_H = 0.14;      // height of the 3D keycap under each rotatable arrow
const ANG = [Math.PI, Math.PI / 2, 0, -Math.PI / 2]; // arrow yaw for N, E, S, W
const REASON = {
  edge: 'The ball rolled off the edge of the grid.',
  void: 'The ball dropped into an empty space.',
  height: 'A step of two levels or more. The ball cannot climb or fall that far.',
  loop: 'The ball looped back onto a tile it already crossed.',
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---------- save ----------
const save = loadSave();
save.settings.sfx ??= true;
save.settings.music ??= true;
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.v === 1) return s;
  } catch { /* corrupt save */ }
  return { v: 1, unlocked: 1, best: {}, settings: { sfx: true, music: true, shadows: true } };
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage blocked */ }
}

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = save.settings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d16);
scene.fog = new THREE.Fog(0x0a0d16, 22, 46);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(0, 12, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = 1.3;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

scene.add(new THREE.HemisphereLight(0xb7c9ff, 0x1a1020, 0.7));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(-7, 14, 8);
sun.castShadow = save.settings.shadows;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x64a8ff, 1.0);
rim.position.set(9, 6, -9);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: 0x0c1020, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.4;
ground.receiveShadow = true;
scene.add(ground);

// ---------- procedural textures and materials ----------
function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const stoneTex = canvasTexture(256, (g, s) => {
  g.fillStyle = '#3a4663';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${Math.random() * 0.07})` : `rgba(0,0,0,${Math.random() * 0.25})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, s - 4, s - 4);
});

const M = {
  stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.55, metalness: 0.2 }),
  rot: new THREE.MeshStandardMaterial({ color: 0x7d4f2e, roughness: 0.32, metalness: 0.55 }),
  // glossy amber keycap on every rotatable tile: it dips when tapped and lifts on hover
  cap: new THREE.MeshPhysicalMaterial({ color: 0xc27a3f, roughness: 0.28, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  start: new THREE.MeshStandardMaterial({ color: 0x1fb8a6, emissive: 0x0b4a42, emissiveIntensity: 0.9, roughness: 0.35 }),
  exit: new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xff9f1c, emissiveIntensity: 0.7, roughness: 0.25 }),
  arrowFixed: new THREE.MeshStandardMaterial({ color: 0xdbe6ff, emissive: 0x223355, emissiveIntensity: 0.35, side: THREE.DoubleSide }),
  arrowRot: new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff8a00, emissiveIntensity: 0.9, side: THREE.DoubleSide }),
  arrowBad: new THREE.MeshStandardMaterial({ color: 0xff3d6e, emissive: 0xff1f55, emissiveIntensity: 1.3, side: THREE.DoubleSide }),
  ring: new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xffc857, emissiveIntensity: 1.5 }),
  ball: new THREE.MeshPhysicalMaterial({ color: 0xe9f7ff, metalness: 0.2, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
  plinth: new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.8, metalness: 0.3 }),
};

const ARROW_GEO = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.34);
  s.lineTo(0.22, -0.14);
  s.lineTo(0.06, -0.1);
  s.lineTo(0.06, -0.32);
  s.lineTo(-0.06, -0.32);
  s.lineTo(-0.06, -0.1);
  s.lineTo(-0.22, -0.14);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(Math.PI / 2); // lie flat, tip toward +Z
  return g;
})();
const RING_GEO = new THREE.TorusGeometry(0.3, 0.03, 12, 56);
const BALL_GEO = new THREE.SphereGeometry(BALL_R, 64, 48);
const CAP_GEO = new RoundedBoxGeometry(0.62, CAP_H, 0.62, 3, 0.04);

// ---------- board ----------
const board = new THREE.Group();
scene.add(board);
const ball = new THREE.Mesh(BALL_GEO, M.ball);
ball.castShadow = true;
board.add(ball);

let L = null;          // parsed level
let dirs = null;       // current arrow directions
let taps = 0;
let par = 0;
let levelIdx = 0;
let history = [];
let busy = false;
let walk = null;       // ball route animation
let fall = null;       // ball fall animation
let screen = 'menu';
let blocks = [];       // block mesh per cell (or null)
let arrows = [];       // arrow mesh per cell (or null)
let caps = [];         // keycap mesh per rotatable cell (or null)
let cellGroup = [];    // group per cell: block, keycap, arrow, ring. Rises in on level start.
let ringMesh = null;
let glow = null;
let blockGeos = [];
let particles = null;
let winPending = false; // true between reaching the exit and showing the win card
let introT = 2;         // seconds since the level started (>= 2 means the intro is done)
let hovered = -1;       // rotatable cell under the pointer
let shake = 0;

const wx = (x) => x - (L.W - 1) / 2;
const wz = (y) => y - (L.H - 1) / 2;
const blockTop = (i) => (L.cells[i].h + 1) * 0.5;
const topOf = (i) => blockTop(i) + (L.cells[i].k === 'r' ? CAP_H : 0); // walking surface
const cellXY = (i) => ({ x: i % L.W, y: (i / L.W) | 0 });

function clearBoard() {
  for (const child of [...board.children]) {
    if (child !== ball) board.remove(child);
  }
  for (const g of blockGeos) g.dispose();
  blockGeos = [];
  blocks = [];
  arrows = [];
  caps = [];
  cellGroup = [];
  ringMesh = null;
  glow = null;
  hovered = -1;
}

function buildBoard() {
  clearBoard();
  const W = L.W, H = L.H;
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(W + 0.5, 0.4, H + 0.5, 4, 0.14), M.plinth);
  plinth.position.set(0, -0.2, 0);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  board.add(plinth);

  const s = cellXY(L.start);
  for (let i = 0; i < L.cells.length; i++) {
    const c = L.cells[i];
    if (c.void) continue;
    const { x, y } = cellXY(i);
    const top = blockTop(i);
    const isRot = c.k === 'r';

    const group = new THREE.Group();
    group.position.set(wx(x), -1.5, wz(y)); // starts sunk; the intro raises it
    group.userData = {
      cell: i, blockTop: top, rot: isRot, press: 1, lift: 0, hover: false,
      delay: Math.hypot(x - s.x, y - s.y) * 0.05, cap: null, arrow: null,
    };
    cellGroup[i] = group;

    const geo = new RoundedBoxGeometry(0.92, top, 0.92, 3, 0.06);
    blockGeos.push(geo);
    const mat = i === L.start ? M.start : c.k === 'e' ? M.exit : isRot ? M.rot : M.stone;
    const block = new THREE.Mesh(geo, mat);
    block.position.set(0, top / 2, 0);
    block.castShadow = true;
    block.receiveShadow = true;
    block.userData.cell = i;
    group.add(block);
    blocks[i] = block;

    if (c.k === 'e') {
      ringMesh = new THREE.Mesh(RING_GEO, M.ring);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(0, top + 0.03, 0);
      group.add(ringMesh);
      glow = new THREE.PointLight(0xffc857, 2.4, 6, 2);
      glow.position.set(0, top + 1.4, 0);
      group.add(glow);
      arrows[i] = null;
      caps[i] = null;
    } else {
      if (isRot) {
        const cap = new THREE.Mesh(CAP_GEO, M.cap);
        cap.position.set(0, top + CAP_H / 2, 0);
        cap.castShadow = true;
        cap.userData.cell = i;
        group.add(cap);
        caps[i] = cap;
        group.userData.cap = cap;
      } else {
        caps[i] = null;
      }
      const arrow = new THREE.Mesh(ARROW_GEO, isRot ? M.arrowRot : M.arrowFixed);
      arrow.position.set(0, top + (isRot ? CAP_H : 0) + 0.012, 0);
      arrow.rotation.y = ANG[dirs[i]];
      arrow.userData.cell = i;
      arrow.userData.target = arrow.rotation.y;
      group.add(arrow);
      arrows[i] = arrow;
      group.userData.arrow = arrow;
    }
    board.add(group);
  }
  board.add(ball);
  introT = 0;
}

function setArrowTarget(i) {
  const a = arrows[i];
  if (!a) return;
  let delta = ANG[dirs[i]] - a.rotation.y;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // shortest turn
  a.userData.target = a.rotation.y + delta;
}

function placeBall(i) {
  const { x, y } = cellXY(i);
  ball.position.set(wx(x), topOf(i) + BALL_R, wz(y));
  ball.scale.setScalar(1);
}

function frameCamera() {
  const dist = Math.max(L.W, L.H) * 1.1 + 5;
  camera.position.set(0, dist * 0.95, dist * 0.7);
  controls.target.set(0, 0.6, 0);
  controls.minDistance = dist * 0.5;
  controls.maxDistance = dist * 1.8;
  controls.update();
}

// ---------- game flow ----------
function loadLevel(idx) {
  levelIdx = idx;
  const def = LEVELS[idx];
  L = parseLevel(def);
  par = def.par ?? solve(L)?.cost ?? 0; // par is precomputed by tools/gen-levels.mjs
  dirs = L.initDirs.slice();
  taps = 0;
  history = [];
  busy = false;
  walk = null;
  fall = null;
  buildBoard();
  placeBall(L.start);
  frameCamera();
  updateHud();
  $('#hud-title').textContent = `${def.id}. ${def.name}`;
  $('#hud-hint').textContent = def.hint;
}

function updateHud() {
  $('#hud-taps').textContent = taps;
  $('#hud-par').textContent = par;
}

function tap(i) {
  if (busy || screen !== 'game' || !L.cells[i] || L.cells[i].k !== 'r') return;
  history.push({ dirs: dirs.slice(), taps });
  dirs[i] = (dirs[i] + 1) % 4;
  taps++;
  setArrowTarget(i);
  if (cellGroup[i]) cellGroup[i].userData.press = 0; // keycap dips
  updateHud();
  sfx('tap');
}

// Stops any route run in progress and returns the ball to the start tile.
function cancelRun() {
  walk = null;
  fall = null;
  busy = false;
  setArrowsGlow(false);
  placeBall(L.start);
}

function undo() {
  if (screen !== 'game' || winPending) return;
  cancelRun();
  if (!history.length) {
    toast('Nothing to undo.');
    return;
  }
  const h = history.pop();
  dirs = h.dirs;
  taps = h.taps;
  for (let i = 0; i < L.cells.length; i++) setArrowTarget(i);
  updateHud();
  sfx('undo');
  toast('Undone.');
}

function resetPuzzle() {
  if (screen !== 'game' || winPending) return;
  cancelRun();
  dirs = L.initDirs.slice();
  taps = 0;
  history = [];
  for (let i = 0; i < L.cells.length; i++) setArrowTarget(i);
  updateHud();
  sfx('reset');
  toast('Arrows reset to the start.');
}

function run() {
  if (busy || screen !== 'game') return;
  const r = simulate(L, dirs);
  busy = true;
  const waypoints = r.path.map((i) => ({ i }));
  if (!r.ok && r.target) waypoints.push({ x: r.target.x, y: r.target.y, ghost: true });
  walk = { wp: waypoints, seg: 0, t: 0, res: r, last: r.path[r.path.length - 1] };
  sfx('run');
  setArrowsGlow(true);
}

// `last` is the last cell the ball reached; a ghost step (the blocked target) hovers over it.
function waypointPos(p, last) {
  if (!p.ghost) {
    const { x, y } = cellXY(p.i);
    return { x: wx(x), z: wz(y), top: topOf(p.i) };
  }
  return { x: wx(p.x), z: wz(p.y), top: topOf(last) };
}

function updateWalk(dt) {
  if (!walk) return;
  walk.t += dt;
  const n = walk.wp.length - 1;
  while (walk.t >= STEP_TIME && walk.seg < n) {
    walk.t -= STEP_TIME;
    walk.seg++;
    const p = walk.wp[walk.seg];
    if (!p.ghost) sfx('step');
  }
  if (walk.seg >= n) {
    const done = walk;
    walk = null;
    const end = waypointPos(done.wp[n], done.last);
    ball.position.set(end.x, end.top + BALL_R, end.z);
    onWalkEnd(done);
    return;
  }
  const a = waypointPos(walk.wp[walk.seg], walk.last);
  const b = waypointPos(walk.wp[walk.seg + 1], walk.last);
  const f = walk.t / STEP_TIME;
  const hop = Math.sin(Math.PI * f) * 0.12;
  ball.position.set(a.x + (b.x - a.x) * f, a.top + (b.top - a.top) * f + BALL_R + hop, a.z + (b.z - a.z) * f);
  ball.rotation.x += dt * 6;
}

function onWalkEnd(done) {
  if (done.res.ok) {
    setArrowsGlow(false);
    win();
    return;
  }
  // failure: flash the arrow the ball was aiming at, then drop
  const tgt = done.res.target;
  if (tgt && tgt.x >= 0 && tgt.y >= 0 && tgt.x < L.W && tgt.y < L.H) {
    const ti = tgt.y * L.W + tgt.x;
    if (arrows[ti]) arrows[ti].material = M.arrowBad;
  }
  toast(REASON[done.res.reason] || 'The route does not reach the exit.');
  sfx('fail');
  fall = { t: 0, dur: 0.5 };
}

function setArrowsGlow(on) {
  for (let i = 0; i < arrows.length; i++) {
    const a = arrows[i];
    if (!a) continue;
    if (!on && a.material === M.arrowBad) a.material = L.cells[i].k === 'r' ? M.arrowRot : M.arrowFixed;
  }
}

function updateFall(dt) {
  if (!fall) return;
  fall.t += dt;
  const f = Math.min(1, fall.t / fall.dur);
  ball.scale.setScalar(Math.max(0.001, 1 - f));
  ball.position.y -= dt * (2 + f * 8);
  if (f < 1) return;
  fall = null;
  placeBall(L.start);
  busy = false;
  shake = 0.2;
  setArrowsGlow(false);
}

function win() {
  const stars = starsFor(taps, par);
  const prev = save.best[LEVELS[levelIdx].id];
  if (!prev || stars > prev.stars || (stars === prev.stars && taps < prev.taps)) {
    save.best[LEVELS[levelIdx].id] = { stars, taps };
  }
  const before = save.unlocked;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIdx + 2));
  if (save.unlocked > before) setTimeout(() => sfx('unlock'), 900);
  persist();
  sfx('win');
  burst();
  winPending = true;
  setTimeout(() => { winPending = false; showWin(stars); }, 900);
}

function continueIndex() {
  return Math.min(save.unlocked, LEVELS.length) - 1;
}

// ---------- UI ----------
const PANELS = ['menu', 'levels', 'howto', 'settings', 'pause', 'win'];

function go(name) {
  const prev = screen;
  if (name === 'pause' && prev === 'game') sfx('pause');
  if (name === 'game' && prev === 'pause') sfx('resume');
  duckMusic(name === 'game' || name === 'menu' || name === 'levels');
  screen = name;
  if (name !== 'game') setHover(-1);
  const inGame = name === 'game' || name === 'pause' || name === 'win';
  $('#hud').classList.toggle('d-none', !inGame);
  $('#runbar').classList.toggle('d-none', !inGame);
  controls.autoRotate = name === 'menu' || name === 'levels';
  controls.autoRotateSpeed = 0.5;
  for (const p of PANELS) $(`#panel-${p}`).classList.toggle('d-none', p !== name);
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z';
const starSvg = (on) => `<svg viewBox="0 0 24 24" class="rs-star ${on ? 'on' : ''}" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;

const starsIn = (from, to) => {
  let n = 0;
  for (let id = from; id <= to; id++) n += save.best[id]?.stars ?? 0;
  return n;
};

// Level select: one world (100 levels) at a time, with a tab per world.
function buildLevelGrid(world = Math.floor(continueIndex() / 100)) {
  $('#world-tabs').innerHTML = WORLDS.map((w, i) => {
    const open = save.unlocked >= w.from;
    return `<button class="btn btn-sm rs-tab ${i === world ? 'active' : ''}" data-world="${i}" ${open ? '' : 'disabled'}
      aria-label="World ${i + 1}, ${w.name}${open ? '' : ' (locked)'}">${i + 1}</button>`;
  }).join('');
  const W = WORLDS[world];
  const total = (W.to - W.from + 1) * 3;
  $('#world-info').innerHTML = `<div class="rs-kicker">World ${world + 1} &middot; ${W.name}</div>
    <div class="small text-secondary">${W.blurb} <span class="rs-count">${starsIn(W.from, W.to)} / ${total} stars</span></div>`;

  let html = '';
  for (let id = W.from; id <= W.to; id++) {
    const def = LEVELS[id - 1];
    const unlocked = def.id <= save.unlocked;
    const stars = save.best[def.id]?.stars ?? 0;
    html += `<div class="col">
      <button class="rs-level-card rs-btn ${unlocked ? '' : 'is-locked'}" data-level="${id - 1}" ${unlocked ? '' : 'disabled'}
        aria-label="Level ${def.id} ${def.name}${unlocked ? '' : ' (locked)'}" title="${def.name}">
        <span class="rs-level-num">${def.id}</span>
        <span class="rs-level-name d-none d-md-block text-truncate">${def.name}</span>
        <span class="rs-stars">${[1, 2, 3].map((n) => starSvg(n <= stars)).join('')}</span>
      </button></div>`;
  }
  $('#level-grid').innerHTML = html;
}

function showWin(stars) {
  for (let i = 0; i < stars; i++) setTimeout(() => sfx('star'), 200 + i * 220);
  $('#win-stars').innerHTML = [1, 2, 3].map((n) => starSvg(n <= stars)).join('');
  $('#win-taps').textContent = taps;
  $('#win-par').textContent = par;
  $('#btn-next').classList.toggle('d-none', levelIdx >= LEVELS.length - 1);
  busy = true;
  go('win');
}

function syncSettings() {
  $('#set-sfx').checked = save.settings.sfx;
  $('#set-music').checked = save.settings.music;
  $('#set-shadows').checked = save.settings.shadows;
}

function setShadows(on) {
  renderer.shadowMap.enabled = on;
  sun.castShadow = on;
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
}

// ---------- audio: every sound is synthesized in the browser (no files) ----------
let actx = null;
let noiseBuf = null;
let musicBus = null;
let musicTimer = null;
let musicStep = 0;

function ensureAudio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const len = Math.floor(actx.sampleRate * 0.5);
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      musicBus = actx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(actx.destination);
    } catch {
      actx = null;
      return;
    }
  }
  if (actx.state === 'suspended') actx.resume();
  if (save.settings.music) startMusic();
}

// One plucked or sustained tone with a short attack and a smooth decay.
function tone(freq, dur = 0.09, type = 'sine', vol = 0.06, when = 0, sweepTo = null, dest = null) {
  if (!save.settings.sfx || !actx) return;
  const t0 = actx.currentTime + when;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest || actx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

// Filtered noise burst for swishes and rolls.
function swish(dur = 0.12, freq = 1200, vol = 0.05, when = 0, sweepTo = null) {
  if (!save.settings.sfx || !actx || !noiseBuf) return;
  const t0 = actx.currentTime + when;
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t0);
  f.Q.value = 1.2;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(actx.destination);
  src.start(t0, Math.random() * 0.3);
  src.stop(t0 + dur + 0.02);
}

const SFX = {
  click: () => tone(880, 0.04, 'triangle', 0.035),
  hover: () => tone(1320, 0.03, 'sine', 0.012),
  tap: () => { tone(520, 0.07, 'triangle', 0.05); swish(0.09, 2200, 0.03, 0, 900); },
  undo: () => tone(420, 0.12, 'sine', 0.05, 0, 300),
  reset: () => { swish(0.25, 300, 0.05, 0, 1800); tone(520, 0.15, 'sine', 0.04, 0.12); },
  run: () => { swish(0.3, 400, 0.04, 0, 1600); tone(240, 0.25, 'triangle', 0.05, 0, 480); },
  step: () => tone(300 + Math.random() * 60, 0.05, 'sine', 0.03),
  fail: () => { tone(220, 0.35, 'sawtooth', 0.035, 0, 90); tone(160, 0.4, 'square', 0.02, 0.12, 70); },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.07, i * 0.1));
    tone(1318, 0.6, 'sine', 0.04, 0.45);
  },
  star: () => tone(1046, 0.18, 'sine', 0.06),
  unlock: () => [659, 784, 988].forEach((f, i) => tone(f, 0.16, 'triangle', 0.05, i * 0.07)),
  pause: () => tone(520, 0.18, 'sine', 0.05, 0, 260),
  resume: () => tone(260, 0.18, 'sine', 0.05, 0, 520),
};
const sfx = (n) => SFX[n]?.();

// Ambient loop: a soft plucked arpeggio over a slow four-chord loop.
const CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function playMusicBeat() {
  if (!actx || !save.settings.music) return;
  const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
  const note = chord[musicStep % chord.length] + (musicStep % 8 >= 4 ? 12 : 0);
  const t0 = actx.currentTime + 0.02;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(mtof(note), t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
  o.connect(g).connect(musicBus);
  o.start(t0);
  o.stop(t0 + 1.7);
  if (musicStep % 4 === 0) {
    const b = actx.createOscillator();
    const bg = actx.createGain();
    b.type = 'sine';
    b.frequency.setValueAtTime(mtof(chord[0] - 24), t0);
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.exponentialRampToValueAtTime(0.35, t0 + 0.1);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
    b.connect(bg).connect(musicBus);
    b.start(t0);
    b.stop(t0 + 3.7);
  }
  musicStep++;
}
function startMusic() {
  if (musicTimer || !actx) return;
  musicBus.gain.setTargetAtTime(0.1, actx.currentTime, 0.5);
  musicTimer = setInterval(playMusicBeat, 1000);
  playMusicBeat();
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
  if (actx) musicBus.gain.setTargetAtTime(0, actx.currentTime, 0.3);
}
function duckMusic(on) {
  if (actx && musicTimer) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.03, actx.currentTime, 0.3);
}

// ---------- confetti ----------
function burst() {
  const N = 140;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 0.4;
    pos[i * 3 + 1] = 2.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 4;
    vel[i * 3] = Math.cos(a) * s * 0.5;
    vel[i * 3 + 1] = 3 + Math.random() * 4;
    vel[i * 3 + 2] = Math.sin(a) * s * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffd166, size: 0.16, transparent: true, opacity: 1, depthWrite: false });
  disposeParticles();
  particles = new THREE.Points(geo, mat);
  particles.userData = { vel, life: 2.5 };
  scene.add(particles);
}
function disposeParticles() {
  if (!particles) return;
  scene.remove(particles);
  particles.geometry.dispose();
  particles.material.dispose();
  particles = null;
}
function updateParticles(dt) {
  if (!particles) return;
  const d = particles.userData;
  const p = particles.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    d.vel[i * 3 + 1] -= 9 * dt;
    p.array[i * 3] += d.vel[i * 3] * dt;
    p.array[i * 3 + 1] += d.vel[i * 3 + 1] * dt;
    p.array[i * 3 + 2] += d.vel[i * 3 + 2] * dt;
  }
  p.needsUpdate = true;
  d.life -= dt;
  particles.material.opacity = Math.max(0, d.life / 2.5);
  if (d.life <= 0) disposeParticles();
}

// ---------- picking (tap = click without drag; left drag orbits) ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

// Returns the cell under the pointer event, or -1.
function pickCell(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const targets = [...blocks.filter(Boolean), ...arrows.filter(Boolean), ...caps.filter(Boolean)];
  const hit = raycaster.intersectObjects(targets, false)[0];
  return hit ? hit.object.userData.cell : -1;
}

// Hover lifts the keycap under the pointer and shows a pointer cursor.
function setHover(c) {
  if (c === hovered) return;
  if (hovered >= 0 && cellGroup[hovered]) cellGroup[hovered].userData.hover = false;
  hovered = c;
  if (c >= 0 && cellGroup[c]) cellGroup[c].userData.hover = true;
  renderer.domElement.style.cursor = c >= 0 ? 'pointer' : '';
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  ensureAudio();
  downAt = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!L || screen !== 'game' || e.buttons) { setHover(-1); return; }
  const c = pickCell(e);
  setHover(c >= 0 && L.cells[c].k === 'r' ? c : -1);
});
renderer.domElement.addEventListener('pointerleave', () => setHover(-1));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || !L || screen !== 'game') { downAt = null; return; }
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 8) return;
  const c = pickCell(e);
  if (c >= 0) tap(c);
});

// ---------- render loop ----------
const clock = new THREE.Clock();
function update() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (screen === 'game') {
    updateWalk(dt);
    updateFall(dt);
  }

  // level intro: tiles rise from below, nearest the start first
  if (introT < 2) introT += dt;
  for (const g of cellGroup) {
    if (!g) continue;
    const u = g.userData;
    const k = Math.min(1, Math.max(0, (introT - u.delay) / 0.55));
    g.position.y = -1.5 * Math.pow(1 - k, 3);

    // keycap press (dip on tap) and hover lift
    if (u.press < 1) u.press = Math.min(1, u.press + dt / 0.28);
    u.lift += ((u.hover ? 0.06 : 0) - u.lift) * (1 - Math.exp(-dt * 14));
    const off = u.lift - 0.07 * Math.sin(Math.PI * u.press);
    if (u.cap) u.cap.position.y = u.blockTop + CAP_H / 2 + off;
    if (u.arrow) {
      const bob = u.arrow.material === M.arrowRot ? Math.sin(t * 3 + u.arrow.userData.cell) * 0.006 : 0;
      u.arrow.position.y = u.blockTop + (u.rot ? CAP_H : 0) + 0.012 + off + bob;
    }
  }

  for (let i = 0; i < arrows.length; i++) {
    const a = arrows[i];
    if (!a) continue;
    a.rotation.y += (a.userData.target - a.rotation.y) * (1 - Math.exp(-dt * 14));
  }
  if (ringMesh) ringMesh.material.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.5;
  if (glow) glow.intensity = 2.2 + Math.sin(t * 3) * 0.4;

  if (shake > 0) {
    shake -= dt;
    const amp = Math.max(0, shake) * 0.5;
    board.position.set((Math.random() - 0.5) * amp, 0, (Math.random() - 0.5) * amp);
  } else {
    board.position.set(0, 0, 0);
  }

  updateParticles(dt);
}

// An error thrown inside a frame stops three.js's render loop for good (the display freezes).
// Each part is guarded so one bad frame is reported on screen and rendering carries on.
const reported = new Set();
function reportError(e) {
  const msg = (e && (e.message || String(e))) || 'Unknown error';
  console.error(e);
  if (reported.has(msg)) return;
  reported.add(msg);
  toast('Something went wrong: ' + msg.slice(0, 140));
}
window.addEventListener('error', (e) => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason));

// If a frame ever throws mid-run, clear the run so the board is playable again.
function recover() {
  walk = null;
  fall = null;
  busy = false;
  try { setArrowsGlow(false); if (L) placeBall(L.start); } catch { /* board not ready */ }
}

function loop() {
  try { update(); } catch (e) { recover(); reportError(e); }
  try {
    controls.update();
    renderer.render(scene, camera);
  } catch (e) { reportError(e); }
}
renderer.setAnimationLoop(loop);

// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (e.repeat) return;
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); run(); }
  else if (e.code === 'KeyZ' || e.code === 'Backspace') { e.preventDefault(); undo(); }
  else if (e.code === 'KeyR') resetPuzzle();
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (screen === 'game') go('pause');
    else if (screen === 'pause') go('game');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ---------- buttons ----------
$('#btn-play').onclick = () => { ensureAudio(); loadLevel(continueIndex()); go('game'); };
$('#btn-levels').onclick = () => { buildLevelGrid(); go('levels'); };
$('#btn-howto').onclick = () => go('howto');
$('#btn-settings').onclick = () => { syncSettings(); go('settings'); };
$$('[data-back]').forEach((b) => { b.onclick = () => go(b.dataset.back); });

$('#world-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-world]');
  if (!b || b.disabled) return;
  buildLevelGrid(Number(b.dataset.world));
});
$('#level-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-level]');
  if (!b || b.disabled) return;
  ensureAudio();
  loadLevel(Number(b.dataset.level));
  go('game');
});

$('#btn-run').onclick = () => { ensureAudio(); run(); };
$('#btn-undo').onclick = undo;
$('#btn-reset').onclick = resetPuzzle;
$('#btn-pause').onclick = () => { if (screen === 'game') go('pause'); };
$('#btn-resume').onclick = () => go('game');
$('#btn-pause-restart').onclick = () => { loadLevel(levelIdx); go('game'); };
$('#btn-pause-levels').onclick = () => { buildLevelGrid(); go('levels'); };
$('#btn-pause-menu').onclick = () => go('menu');

$('#btn-next').onclick = () => { loadLevel(levelIdx + 1); go('game'); };
$('#btn-replay').onclick = () => { loadLevel(levelIdx); go('game'); };
$('#btn-win-levels').onclick = () => { buildLevelGrid(); go('levels'); };
$('#btn-win-menu').onclick = () => go('menu');

$('#set-sfx').onchange = (e) => { save.settings.sfx = e.target.checked; persist(); };
$('#set-music').onchange = (e) => {
  save.settings.music = e.target.checked;
  persist();
  if (e.target.checked) ensureAudio();
  else stopMusic();
};
$('#set-shadows').onchange = (e) => { save.settings.shadows = e.target.checked; setShadows(e.target.checked); persist(); };
$('#btn-erase').onclick = () => {
  if (!confirm('Reset all progress and stars?')) return;
  save.unlocked = 1;
  save.best = {};
  persist();
  buildLevelGrid(0);
  sfx('reset');
  toast('Progress reset');
};

// ---------- start: menu with a live backdrop ----------
loadLevel(continueIndex());
go('menu');

// Every button press gets a click (game events add their own sounds on top).
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('button')) sfx('click');
});

// Button feedback: a ripple from the press point, and a soft tick when the pointer enters a button.
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest?.('.btn, .rs-level-card');
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'rs-ripple';
  s.style.left = `${e.clientX - r.left}px`;
  s.style.top = `${e.clientY - r.top}px`;
  b.appendChild(s);
  setTimeout(() => s.remove(), 650);
});
let hoverBtn = null;
document.addEventListener('pointerover', (e) => {
  const b = e.target.closest?.('.btn, .rs-level-card, .rs-tab');
  if (b === hoverBtn) return;
  hoverBtn = b;
  if (b && !b.disabled && e.pointerType === 'mouse') sfx('hover');
});
