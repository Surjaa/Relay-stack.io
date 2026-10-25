// Relay Stack - pure rules (no rendering), testable in Node.
// Grid of stacked tiles. Each tile may hold an arrow. Tapping a rotatable (r) arrow turns it 90 degrees clockwise.
// The ball starts on the start tile and follows arrows. It can climb or drop at most one level per step.
// It wins on reaching the exit (e). It fails on: leaving the grid, hitting a void, a height jump > 1, or looping.

export const DX = [0, 1, 0, -1]; // 0=N 1=E 2=S 3=W
export const DY = [-1, 0, 1, 0];

// Level format: rows of tokens "<height><kind><dir>", void = "..".
// kind: f = fixed arrow, r = rotatable arrow, e = exit (dir ignored).
export function parseLevel(def) {
  const H = def.rows.length;
  const W = def.rows[0].trim().split(/\s+/).length;
  const cells = [];
  for (let y = 0; y < H; y++) {
    const toks = def.rows[y].trim().split(/\s+/);
    if (toks.length !== W) throw new Error(`${def.name}: row ${y} has ${toks.length} tiles, expected ${W}`);
    for (let x = 0; x < W; x++) {
      const t = toks[x];
      if (t === '..') {
        cells.push({ void: true, h: 0, k: '-', d: 0 });
      } else {
        if (!/^[0-4][fre][0-3]$/.test(t)) throw new Error(`${def.name}: bad token "${t}" at ${x},${y}`);
        cells.push({ void: false, h: +t[0], k: t[1], d: +t[2] });
      }
    }
  }
  const start = def.start[1] * W + def.start[0];
  const exit = cells.findIndex((c) => c.k === 'e');
  if (exit < 0) throw new Error(`${def.name}: no exit (e)`);
  if (cells[start].void || cells[start].k === 'e') throw new Error(`${def.name}: start must be an arrow tile`);
  const rot = [];
  cells.forEach((c, i) => { if (c.k === 'r') rot.push(i); });
  return { id: def.id, title: def.name, hint: def.hint || '', W, H, cells, start, exit, rot, initDirs: cells.map((c) => c.d) };
}

// Runs the ball with the given arrow directions. Returns path (cell indices) and, on failure, the intended target.
export function simulate(L, dirs) {
  const path = [L.start];
  const seen = new Uint8Array(L.cells.length);
  seen[L.start] = 1;
  let cur = L.start;
  for (;;) {
    if (cur === L.exit) return { ok: true, path, target: null, reason: null };
    const c = L.cells[cur];
    const d = dirs[cur];
    const x = cur % L.W;
    const y = (cur / L.W) | 0;
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) return { ok: false, path, target: { x: nx, y: ny }, reason: 'edge' };
    const ni = ny * L.W + nx;
    const nc = L.cells[ni];
    if (nc.void) return { ok: false, path, target: { x: nx, y: ny }, reason: 'void' };
    if (Math.abs(nc.h - c.h) > 1) return { ok: false, path, target: { x: nx, y: ny }, reason: 'height' };
    if (seen[ni]) return { ok: false, path, target: { x: nx, y: ny }, reason: 'loop' };
    seen[ni] = 1;
    cur = ni;
    path.push(ni);
  }
}

// Exact minimum number of taps (each tap = one 90-degree clockwise turn). Brute force over rotatable arrows.
export function solve(L) {
  const R = L.rot.length;
  const dirs = L.initDirs.slice();
  let best = null;
  const total = 4 ** R;
  for (let m = 0; m < total; m++) {
    let mm = m;
    let cost = 0;
    for (let k = 0; k < R; k++) {
      const r = mm & 3;
      mm >>= 2;
      const idx = L.rot[k];
      dirs[idx] = (L.initDirs[idx] + r) % 4;
      cost += r;
    }
    if (best && cost >= best.cost) continue;
    if (simulate(L, dirs).ok) best = { cost, dirs: dirs.slice() };
  }
  return best;
}

export function starsFor(taps, par) {
  if (taps <= par) return 3;
  if (taps <= par + 2) return 2;
  return 1;
}
