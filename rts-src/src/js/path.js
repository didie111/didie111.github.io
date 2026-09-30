'use strict';
// ===================================================================
//  길찾기(A*, 8방향) + 공간 해시
// ===================================================================
const PF = (() => {
  const N = MAP_W * MAP_H;
  const g = new Float32Array(N), f = new Float32Array(N);
  const parent = new Int32Array(N);
  const openGen = new Uint32Array(N), closedGen = new Uint32Array(N);
  let gen = 1;
  // binary heap of indices
  let heap = new Int32Array(N + 8), hn = 0;
  const push = (i) => {
    let k = hn++; heap[k] = i;
    while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[heap[k]]) break; const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; }
  };
  const pop = () => {
    const top = heap[0]; hn--;
    if (hn > 0) {
      heap[0] = heap[hn]; let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1; let m = k;
        if (l < hn && f[heap[l]] < f[heap[m]]) m = l;
        if (r < hn && f[heap[r]] < f[heap[m]]) m = r;
        if (m === k) break; const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
      }
    }
    return top;
  };
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const COST = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];
  let budget = 0;

  function nearestPassable(tx, ty, maxR, ignoreId, avoid) {
    if (passable(tx, ty, ignoreId, avoid)) return [tx, ty];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (Math.abs(x - tx) !== r && Math.abs(y - ty) !== r) continue;
        if (!passable(x, y, ignoreId, avoid)) continue;
        const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) return best;
    }
    return null;
  }
  function passable(x, y, ignoreId, avoid) {
    if (!inMap(x, y)) return false;
    const i = tIdx(x, y);
    return MAP.walk[i] === 1 && (MAP.occ[i] === 0 || MAP.occ[i] === ignoreId) && !(avoid && avoid.has(i));
  }

  function find(sx, sy, gx, gy, ignoreId, avoid) {
    const st = nearestPassable(sx, sy, 4, ignoreId, avoid);
    const gl = nearestPassable(gx, gy, 12, ignoreId, avoid);
    if (!st || !gl) return null;
    [sx, sy] = st; [gx, gy] = gl;
    if (sx === gx && sy === gy) return [[gx, gy]];
    gen++; hn = 0;
    const s = tIdx(sx, sy), goal = tIdx(gx, gy);
    g[s] = 0; f[s] = oct(sx, sy, gx, gy); parent[s] = -1; openGen[s] = gen; push(s);
    let best = s, bestH = f[s], nodes = 0;
    while (hn > 0) {
      const cur = pop();
      if (closedGen[cur] === gen) continue;
      closedGen[cur] = gen;
      if (cur === goal) { best = cur; break; }
      if (++nodes > 9000) break;
      const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
      const h = oct(cx, cy, gx, gy);
      if (h < bestH) { bestH = h; best = cur; }
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (!passable(nx, ny, ignoreId, avoid)) continue;
        if (d >= 4 && (!passable(cx + DX[d], cy, ignoreId, avoid) || !passable(cx, cy + DY[d], ignoreId, avoid))) continue;
        const ni = tIdx(nx, ny);
        if (closedGen[ni] === gen) continue;
        const ng = g[cur] + COST[d];
        if (openGen[ni] === gen && ng >= g[ni]) continue;
        openGen[ni] = gen; g[ni] = ng; parent[ni] = cur;
        f[ni] = ng + oct(nx, ny, gx, gy) * 1.001;
        push(ni);
      }
    }
    budget -= nodes;
    const out = [];
    let c = best;
    while (c !== -1) { out.push([c % MAP_W, (c / MAP_W) | 0]); c = parent[c]; if (out.length > 5000) break; }
    out.reverse();
    return out;
  }
  function oct(ax, ay, bx, by) { const dx = Math.abs(ax - bx), dy = Math.abs(ay - by); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); }

  // 두 점(px) 사이 직선 통행 가능 여부 (반경 r 고려)
  function lineClear(x0, y0, x1, y1, r, ignoreId) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 8);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
        if (!passable(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE), ignoreId)) return false;
      }
    }
    return true;
  }

  // 월드 좌표 경로 (스무딩 포함)
  function worldPath(x0, y0, x1, y1, r, ignoreId, obstacles) {
    const tiles = find(Math.floor(x0 / TILE), Math.floor(y0 / TILE), Math.floor(x1 / TILE), Math.floor(y1 / TILE), ignoreId, obstacles && obstacles.cells);
    if (!tiles) return null;
    const pts = tiles.map(([x, y]) => [x * TILE + 16, y * TILE + 16]);
    const last = tiles[tiles.length - 1];
    if (last[0] === Math.floor(x1 / TILE) && last[1] === Math.floor(y1 / TILE)) pts[pts.length - 1] = [x1, y1];
    // string pulling
    const out = [];
    let ax = x0, ay = y0, i = 0;
    const rr = Math.max(4, r - 3);
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && (!lineClear(ax, ay, pts[j][0], pts[j][1], rr, ignoreId) || obstacles && !unitsClear(ax, ay, pts[j][0], pts[j][1], r, obstacles.units))) j--;
      out.push(pts[j]);
      ax = pts[j][0]; ay = pts[j][1];
      i = j + 1;
    }
    return out;
  }

  function unitsClear(x0, y0, x1, y1, r, units) {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
    for (const u of units) {
      if (u.dead || u.hidden || u.burrowed || u.noCollide) continue;
      const ox = u.x - x0, oy = u.y - y0, min = (r + u.r) * 0.85 + 1;
      if (Math.hypot(ox, oy) < min && ox * dx + oy * dy <= 0) continue;
      const t = len2 ? Math.max(0, Math.min(1, (ox * dx + oy * dy) / len2)) : 0;
      if (Math.hypot(ox - dx * t, oy - dy * t) < min) return false;
    }
    return true;
  }
  function unitObstacles(mover) {
    const units = GAME.entities.filter(u => u !== mover && groundCollider(u) && !collisionMover(u));
    const cells = new Set();
    for (const u of units) {
      const radius = (u.r + mover.r) * 0.85 + 2;
      for (let ty = Math.max(0, tileOf(u.y - radius)); ty <= Math.min(MAP_H - 1, tileOf(u.y + radius)); ty++)
        for (let tx = Math.max(0, tileOf(u.x - radius)); tx <= Math.min(MAP_W - 1, tileOf(u.x + radius)); tx++)
          if (Math.hypot(Math.max(0, Math.abs(tx * TILE + TILE / 2 - u.x) - TILE / 2), Math.max(0, Math.abs(ty * TILE + TILE / 2 - u.y) - TILE / 2)) < radius) cells.add(tIdx(tx, ty));
    }
    cells.delete(tIdx(tileOf(mover.x), tileOf(mover.y)));
    return { cells, units };
  }
  return {
    find, worldPath, lineClear, nearestPassable, passable, unitsClear, unitObstacles,
    resetBudget() { budget = 24000; }, get budget() { return budget; },
  };
})();

// ---------------- 공간 해시 ----------------
const SH = (() => {
  const CS = 64, GW = Math.ceil(MAP_W * TILE / CS), GH = Math.ceil(MAP_H * TILE / CS);
  const cells = Array.from({ length: GW * GH }, () => []);
  function clear() { for (const c of cells) c.length = 0; }
  function insert(e) {
    const cx = Math.max(0, Math.min(GW - 1, (e.x / CS) | 0)), cy = Math.max(0, Math.min(GH - 1, (e.y / CS) | 0));
    cells[cy * GW + cx].push(e);
  }
  function query(x, y, r, out) {
    out = out || [];
    const x0 = Math.max(0, ((x - r - 64) / CS) | 0), x1 = Math.min(GW - 1, ((x + r + 64) / CS) | 0);
    const y0 = Math.max(0, ((y - r - 64) / CS) | 0), y1 = Math.min(GH - 1, ((y + r + 64) / CS) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = cells[cy * GW + cx];
      for (let k = 0; k < c.length; k++) out.push(c[k]);
    }
    return out;
  }
  return { clear, insert, query };
})();
