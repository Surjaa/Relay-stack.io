// Builds the 1000-level campaign into levels.js.
// Each level is made route-first: a random self-avoiding path from start to exit is laid down,
// its arrows point along it, a few path arrows are turned away (rotatable), and the rest of the
// grid gets decoy arrows and voids. The solver then computes the exact minimum taps (par).
// Difficulty ramps with the level number: bigger grids, longer routes, more heights, more turns.
// Run once from the project folder in Command Prompt:  node tools/gen-levels.mjs
import { writeFileSync } from 'node:fs';
import { DX, DY, parseLevel, simulate, solve } from '../logic.js';
import { LEVELS as ALL_SAVED } from "../levels.js";
const EXISTING = ALL_SAVED.slice(0, 10); // the hand-checked opening levels seed the campaign

const TOTAL = 1000;
const MAX_ROTATABLE = 10; // the solver tries 4^R combinations (offline only), so R stays bounded

const WORLDS = [
  ['Shallows', 'Short routes. Learn the rules.'],
  ['Foundry', 'Heights start to matter.'],
  ['Cistern', 'Longer runs through the water works.'],
  ['Overpass', 'Routes cross over themselves.'],
  ['Gantry', 'Many turns, few shortcuts.'],
  ['Catacomb', 'Dead ends everywhere.'],
  ['Spire', 'Tall stacks, tight climbs.'],
  ['Monsoon', 'Long runs. Plan the whole route.'],
  ['Glasswork', 'Almost every arrow has to move.'],
  ['The Core', 'The last relays of the vault.'],
];
const HINTS = [
  'Turn the arrow toward the exit.',
  'Each step can rise or drop one level.',
  'Trace the route from the start before you tap.',
  'Some arrows never move. Work around them.',
  'Count the taps. Every turn costs one.',
  'Two routes look alike. Only one reaches the exit.',
  'Height changes hide the route. Read them carefully.',
  'Long run, many turns. Plan the whole route first.',
  'Check every dead end before you commit.',
  'The shortest path is not always the cheapest.',
  'Start at the back of the route and work forward.',
  'Look for the tile that only one arrow can reach.',
];
const NAME_A = ['Quiet', 'Iron', 'Glass', 'Ember', 'Tide', 'Stone', 'Velvet', 'Cobalt', 'Copper', 'Silent', 'Rapid', 'Hollow', 'Amber', 'Frost', 'Night', 'Storm', 'Brass', 'Sable', 'Lumen', 'Orbit'];
const NAME_B = ['Reach', 'Bend', 'Ladder', 'Weave', 'Shaft', 'Span', 'Gate', 'Run', 'Choke', 'Loop', 'Drift', 'Stair', 'Spindle', 'Crossing', 'Hatch', 'Relay', 'Gallery', 'Spiral', 'Vault', 'Turn'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random self-avoiding walk of exactly `len` cells, or null.
function walkPath(W, H, len, r) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let x = Math.floor(r() * W);
    let y = Math.floor(r() * H);
    const used = new Set([y * W + x]);
    const path = [[x, y]];
    while (path.length < len) {
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !used.has(ny * W + nx)) opts.push([nx, ny]);
      }
      if (!opts.length) break;
      [x, y] = opts[Math.floor(r() * opts.length)];
      used.add(y * W + x);
      path.push([x, y]);
    }
    if (path.length === len) return path;
  }
  return null;
}

function candidate(id, r) {
  const t = (id - 1) / (TOTAL - 1);
  const W = Math.min(11, 5 + Math.round(t * 6) + (r() < 0.3 ? 1 : 0));
  const H = Math.max(4, Math.min(11, 5 + Math.round(t * 5) + (r() < 0.3 ? -1 : 0)));
  const maxH = Math.min(4, 1 + Math.floor(t * 4 + r() * 1.5));
  const pathLen = Math.min(Math.floor(W * H * 0.6), Math.max(4, Math.round(4 + t * 46 + (r() * 8 - 4))));
  const R = Math.min(MAX_ROTATABLE - 1, pathLen - 1, 1 + Math.floor(t * 9 + r() * 2));
  // later worlds add rotatable decoys: extra turnable arrows that open false routes
  const decoyR = t > 0.35 ? Math.floor(r() * (1 + t * 3)) : 0;
  const voidChance = 0.08 + 0.2 * t;

  const path = walkPath(W, H, pathLen, r);
  if (!path) return null;

  // heights along the route: each step changes by at most one
  const hs = [Math.floor(r() * (maxH + 1))];
  for (let i = 1; i < pathLen; i++) {
    const cur = hs[i - 1];
    const opts = [-1, 0, 1].map((d) => cur + d).filter((h) => h >= 0 && h <= maxH);
    hs.push(opts[Math.floor(r() * opts.length)]);
  }

  const tokens = new Array(W * H).fill('..');
  const onPath = new Set();
  const turnable = [];
  for (let i = 0; i < pathLen; i++) {
    const [x, y] = path[i];
    const idx = y * W + x;
    onPath.add(idx);
    if (i === pathLen - 1) {
      tokens[idx] = `${hs[i]}e0`;
      continue;
    }
    const [nx, ny] = path[i + 1];
    const dir = DX.findIndex((_, d) => DX[d] === nx - x && DY[d] === ny - y);
    tokens[idx] = `${hs[i]}f${dir}`;
    turnable.push({ idx, dir });
  }
  // turn some route arrows away from the exit; the player must rotate them back
  for (let k = turnable.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [turnable[k], turnable[j]] = [turnable[j], turnable[k]];
  }
  for (let k = 0; k < R && k < turnable.length; k++) {
    const { idx, dir } = turnable[k];
    const wrong = (dir + 1 + Math.floor(r() * 3)) % 4;
    tokens[idx] = `${hs[path.findIndex(([px, py]) => py * W + px === idx)]}r${wrong}`;
  }
  // decoys: every other cell is either void or a fixed arrow that leads somewhere else
  for (let i = 0; i < W * H; i++) {
    if (onPath.has(i)) continue;
    if (r() < voidChance) continue;
    tokens[i] = `${Math.floor(r() * (maxH + 1))}f${Math.floor(r() * 4)}`;
  }
  // rotatable decoys, placed on floor cells next to the route so they tempt a wrong turn
  let placed = 0;
  for (let i = 0; i < W * H && placed < decoyR; i++) {
    if (onPath.has(i) || tokens[i] === '..' || r() > 0.15) continue;
    const dir0 = Math.floor(r() * 4);
    tokens[i] = `${tokens[i][0]}r${dir0}`;
    placed++;
  }

  const rows = [];
  for (let y = 0; y < H; y++) rows.push(tokens.slice(y * W, y * W + W).join(' '));
  return { rows, start: path[0] };
}

function build(id) {
  const t = (id - 1) / (TOTAL - 1);
  const worldIdx = Math.min(WORLDS.length - 1, Math.floor((id - 1) / 100));
  for (let attempt = 0; attempt < 500; attempt++) {
    const r = rng(id * 7919 + attempt * 104729);
    const c = candidate(id, r);
    if (!c) continue;
    const name = `${NAME_A[Math.floor(r() * NAME_A.length)]} ${NAME_B[Math.floor(r() * NAME_B.length)]}`;
    const def = { id, name, hint: HINTS[id % HINTS.length], start: c.start, rows: c.rows };
    let L;
    try { L = parseLevel(def); } catch { continue; }
    if (L.rot.length > MAX_ROTATABLE) continue;
    const sol = solve(L);
    // difficulty gate: later levels must need more taps, so decoy shortcuts cannot make them easy
    const minPar = Math.max(1, Math.floor(t * 14));
    if (!sol || sol.cost < minPar || !simulate(L, sol.dirs).ok) continue;
    return { ...def, par: sol.cost, world: worldIdx, t };
  }
  throw new Error(`could not build level ${id}`);
}

const out = [];
for (let id = 1; id <= TOTAL; id++) {
  if (id <= EXISTING.length) {
    const def = EXISTING[id - 1];
    const sol = solve(parseLevel(def));
    out.push({ ...def, par: sol.cost, world: 0 });
    continue;
  }
  out.push(build(id));
  if (id % 100 === 0) console.log(`built ${id}/${TOTAL}`);
}

const q = (s) => JSON.stringify(s);
const body = out.map((d) =>
  `  { id: ${d.id}, name: ${q(d.name)}, hint: ${q(d.hint)}, start: [${d.start[0]}, ${d.start[1]}], par: ${d.par}, rows: [${d.rows.map(q).join(', ')}] },`
).join('\n');
const worlds = WORLDS.map(([name, blurb], i) => `  { name: ${q(name)}, blurb: ${q(blurb)}, from: ${i * 100 + 1}, to: ${i * 100 + 100} },`).join('\n');

const file = `// Relay Stack - campaign data: 1000 levels in 10 worlds.
// Token: "<height><kind><dir>", ".." = void. kind: f = fixed arrow, r = rotatable arrow (tap to turn clockwise), e = exit.
// dir: 0=N 1=E 2=S 3=W. "par" is the exact minimum number of taps, computed by the solver (tools/gen-levels.mjs).
export const WORLDS = [
${worlds}
];

export const LEVELS = [
${body}
];
`;
writeFileSync(new URL('../levels.js', import.meta.url), file);
// independent check: re-parse every level from its saved rows and re-solve
for (const d of out) {
  const s2 = solve(parseLevel({ id: d.id, name: d.name, hint: d.hint, start: d.start, rows: d.rows }));
  if (!s2 || s2.cost !== d.par || d.par < 1) throw new Error('level ' + d.id + ' failed verification');
}
const pars = out.map((d) => d.par);
console.log(`wrote ${out.length} levels, par min ${Math.min(...pars)} max ${Math.max(...pars)}`);
