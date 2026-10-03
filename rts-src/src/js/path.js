'use strict';
// ===================================================================
//  길찾기(A*, 8방향) + 공간 해시
// ===================================================================
const PF = (() => {
  const N = MAP_W * MAP_H;
  const prefixWidth = MAP_W + 1, terrainPrefix = new Uint32Array((MAP_W + 1) * (MAP_H + 1));
  let terrainFrame = false, terrainDirty = true;
  function terrainRectEmpty(x0, y0, x1, y1) {
    if (!terrainFrame || x0 < 0 || y0 < 0 || x1 >= MAP_W || y1 >= MAP_H) return false;
    if (terrainDirty) {
      terrainPrefix.fill(0);
      for (let y = 0; y < MAP_H; y++) {
        let row = 0;
        for (let x = 0; x < MAP_W; x++) {
          const i = y * MAP_W + x;
          row += MAP.walk[i] !== 1 || MAP.occ[i] !== 0 ? 1 : 0;
          terrainPrefix[(y + 1) * prefixWidth + x + 1] = terrainPrefix[y * prefixWidth + x + 1] + row;
        }
      }
      terrainDirty = false;
    }
    return terrainPrefix[(y1+1)*prefixWidth+x1+1] - terrainPrefix[y0*prefixWidth+x1+1] -
      terrainPrefix[(y1+1)*prefixWidth+x0] + terrainPrefix[y0*prefixWidth+x0] === 0;
  }
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

  function find(sx, sy, gx, gy, ignoreId, avoid, maxNodes = 9000) {
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
      if (++nodes > Math.min(9000, maxNodes)) break;
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

  // 물리 보정과 동일한 원-타일 충돌 판정. 모서리에 접한 유닛도 바깥쪽으로 이동할 수 있다.
  function positionClear(x, y, r, ignoreId) {
    if (x - r < 0 || y - r < 0 || x + r > MAP_W * TILE || y + r > MAP_H * TILE) return false;
    if (terrainRectEmpty(tileOf(x-r), tileOf(y-r), tileOf(x+r), tileOf(y+r))) return true;
    for (let ty = tileOf(y - r); ty <= tileOf(y + r); ty++) for (let tx = tileOf(x - r); tx <= tileOf(x + r); tx++) {
      if (passable(tx, ty, ignoreId)) continue;
      const [left, top, right, bottom] = groundObstacleRect(tx, ty);
      const qx = Math.max(left, Math.min(x, right));
      const qy = Math.max(top, Math.min(y, bottom));
      if ((x - qx) ** 2 + (y - qy) ** 2 < (r - 0.001) ** 2) return false;
    }
    return true;
  }
  function lineClear(x0, y0, x1, y1, r, ignoreId) {
    // Most movement steps cross only open tiles. Test that small rectangle once
    // before sampling the swept circle; keep the original corner checks near walls.
    const left = Math.min(x0, x1) - r, right = Math.max(x0, x1) + r,
      top = Math.min(y0, y1) - r, bottom = Math.max(y0, y1) + r;
    if (left < 0 || top < 0 || right > MAP_W * TILE || bottom > MAP_H * TILE) return false;
    const tx0 = tileOf(left), tx1 = tileOf(right), ty0 = tileOf(top), ty1 = tileOf(bottom);
    // Long visibility-graph edges in open terrain need four prefix lookups, not
    // hundreds of swept-circle samples. Near any blocker, use the exact existing checks.
    if (terrainRectEmpty(tx0, ty0, tx1, ty1)) return true;
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= 64) {
      let open = true;
      for (let y = ty0; y <= ty1 && open; y++) for (let x = tx0; x <= tx1; x++)
        if (!passable(x, y, ignoreId)) { open = false; break; }
      if (open) return true;
    }
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      if (!positionClear(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, ignoreId)) return false;
    }
    return true;
  }

  // 월드 좌표 경로 (스무딩 포함)
  function worldPath(x0, y0, x1, y1, r, ignoreId, obstacles, maxNodes = 9000) {
    const tiles = find(Math.floor(x0 / TILE), Math.floor(y0 / TILE), Math.floor(x1 / TILE), Math.floor(y1 / TILE), ignoreId, obstacles && obstacles.cells, maxNodes);
    if (!tiles) return null;
    const pts = tiles.map(([x, y]) => [x * TILE + 16, y * TILE + 16]);
    const last = tiles[tiles.length - 1];
    if (last[0] === Math.floor(x1 / TILE) && last[1] === Math.floor(y1 / TILE)) pts[pts.length - 1] = [x1, y1];
    // string pulling
    const out = [];
    let ax = x0, ay = y0, i = 0;
    const rr = Math.max(3, r * 0.75);
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && (!lineClear(ax, ay, pts[j][0], pts[j][1], rr, ignoreId) || obstacles && !unitsClear(ax, ay, pts[j][0], pts[j][1], r, obstacles.units))) j--;
      out.push(pts[j]);
      ax = pts[j][0]; ay = pts[j][1];
      i = j + 1;
    }
    return out;
  }

  function goalBlocker(x, y, r, units, group, owner, mover = null) {
    // UM_FixCollision state 2 checks the actual body AND its move target against
    // our destination. A shared-goal mover can occupy it before its order ends.
    return units.find(u => {
      if (u === mover || mover && !canGroundCollide(mover, u)) return false;
      if (!groundCollider(u) || u.groundRecovery || Math.hypot(u.x - x, u.y - y) >= (r + u.r) * .85 + .1) return false;
      const o = u.orders[0];
      if (!collisionMover(u) && (!o || ['hold', 'stop'].includes(o.t) || collisionFixed(u))) return true;
      return o && ['move', 'amove', 'patrol'].includes(o.t) &&
        Number.isFinite(o.x) && Number.isFinite(o.y) && Math.hypot(o.x - x, o.y - y) < (r + u.r) * .85;
    }) || null;
  }

  function unitPath(x0, y0, x1, y1, r, obstacles, group, owner, requireGoal = false, maxWork = Infinity) {
    const available = budget, allowance = Math.min(budget, maxWork);
    budget = allowance;
    try {
      const completeCoarse = () => {
        const p = worldPath(x0, y0, x1, y1, r, 0, obstacles, requireGoal ? Math.max(0, budget) : 9000);
        if (!p?.length || Math.hypot(p.at(-1)[0] - x1, p.at(-1)[1] - y1) >= 1) return null;
        let ax = x0, ay = y0;
        const valid = p.every(([bx, by]) => {
          const clear = lineClear(ax, ay, bx, by, Math.max(3, r * .75), 0) && unitsClear(ax, ay, bx, by, r, obstacles.units);
          ax = bx; ay = by; return clear;
        });
        return valid ? p : null;
      };
      // In a large attacking crowd, try the cheap tile route before building
      // a visibility graph around many bodies. Every segment is still checked.
      if (requireGoal && Number.isFinite(maxWork)) {
        const coarse = completeCoarse();
        if (coarse) return coarse;
        if (budget <= 0) return null;
      }
      const escape = circlePath(x0, y0, x1, y1, r, obstacles);
      if (escape) return escape;
      const fine = localPath(x0, y0, x1, y1, r, obstacles, goalBlocker(x1, y1, r, obstacles.units, group, owner));
      // A melee border choice needs a complete route. A partial local path can
      // end before a wall's corner even when the coarse route reaches that side.
      // Ordinary movement/recovery keeps its existing short partial paths.
      if (fine && (!requireGoal || Math.hypot(fine.at(-1)[0] - x1, fine.at(-1)[1] - y1) < .01)) return fine;
      if (requireGoal && budget <= 0) return null;
      return completeCoarse();
    } finally {
      // Keep the global tick budget accurate after a bounded attack search.
      budget = available - allowance + budget;
    }
  }

  function compactPath(points) {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const a = out[out.length - 1], b = points[i], c = points[i + 1],
        ax = b[0] - a[0], ay = b[1] - a[1], bx = c[0] - b[0], by = c[1] - b[1];
      // Keep every corner and reversal. Collinear grid points describe a single
      // verified segment, not a series of places where a worker should brake.
      if (Math.abs(ax * by - ay * bx) > 1e-7 || ax * bx + ay * by < 0) out.push(b);
    }
    out.push(points[points.length - 1]);
    if (points.goalBlocker) out.goalBlocker = points.goalBlocker;
    return out;
  }

  // 가까운 정지 유닛 사이에서 잠깐 목표의 반대 방향으로 나가야 하는 경우,
  // 격자 경로의 '목표에 더 가까운 부분 경로'만 반복하면 탈출하지 못한다.
  // 원 둘레의 안전한 점을 연결해 목표까지 도달하는 경로를 찾는다.
  function circlePath(x0, y0, x1, y1, r, obstacles) {
    if (!obstacles.units.length) return null;
    // 먼 목적지로 재분산할 때도 정지한 이웃을 움직이지 않고 가까운 둘레를 경유한다.
    // 경로 전체는 모든 정지 몸체로 검사하고 둘레 후보만 가까운 16기에 제한한다.
    const rr = Math.max(3, r * 0.75), units = obstacles.units;
    const clear = (a, b) => lineClear(...a, ...b, rr, 0) && unitsClear(...a, ...b, r, units);
    const goal = [x1, y1];
    if (!positionClear(x1, y1, rr, 0) || !unitsClear(x1, y1, x1, y1, r, units)) return null;
    if (clear([x0, y0], goal)) return [goal];
    const points = [[x0, y0], goal];
    const nearest = units.slice().sort((a, b) => (a.x - x0) ** 2 + (a.y - y0) ** 2 - (b.x - x0) ** 2 - (b.y - y0) ** 2).slice(0, 16);
    for (const u of nearest) {
      const radius = ((r + u.r) * 0.85 + 0.2) / Math.cos(Math.PI / 16);
      const bearing = Math.atan2(y0 - u.y, x0 - u.x);
      for (let i = 0; i < 16; i++) {
        const a = bearing + i * Math.PI / 8, x = u.x + Math.cos(a) * radius, y = u.y + Math.sin(a) * radius;
        if (positionClear(x, y, rr, 0) && unitsClear(x, y, x, y, r, units)) points.push([x, y]);
      }
    }
    const costs = points.map(() => Infinity), previous = points.map(() => -1), closed = new Set();
    costs[0] = 0;
    for (let count = 0; count < points.length; count++) {
      let cur = -1, score = Infinity;
      for (let i = 0; i < points.length; i++) {
        const f = costs[i] + Math.hypot(points[i][0] - x1, points[i][1] - y1);
        if (!closed.has(i) && f < score) { cur = i; score = f; }
      }
      if (cur < 0) break;
      if (cur === 1) {
        const out = []; for (let i = 1; i > 0; i = previous[i]) out.push(points[i]);
        return out.reverse();
      }
      closed.add(cur); budget--;
      for (let i = 1; i < points.length; i++) {
        if (closed.has(i)) continue;
        const cost = costs[cur] + Math.hypot(points[cur][0] - points[i][0], points[cur][1] - points[i][1]);
        if (cost >= costs[i]) continue;
        // Count tested graph edges as work too, not just visited vertices.
        // Otherwise hundreds of bodies can each test a complete visibility graph.
        if (--budget <= 0) return null;
        if (clear(points[cur], points[i])) { costs[i] = cost; previous[i] = cur; }
      }
    }
    return null;
  }

  // 정체 구간에서는 실제 원형 유닛 사이의 틈을 8px 간격으로 찾는다.
  // 기존 32px 타일 마스크가 통과 가능한 틈까지 막는 경우를 피한다.
  function localPath(x0, y0, x1, y1, r, obstacles, occupiedGoal) {
    const step = 8, limit = 16, width = limit * 2 + 1;
    const key = (x, y) => (y + limit) * width + x + limit;
    const units = indexUnits(obstacles.units.filter(u => (u.x - x0) ** 2 + (u.y - y0) ** 2 < (250 + u.r + r) ** 2));
    const rr = Math.max(3, r * 0.75), start = key(0, 0);
    const scores = new Map([[start, 0]]), parents = new Map(), nodes = new Map();
    const queue = [], closed = new Set();
    function add(n) {
      let lo = 0, hi = queue.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (queue[mid].f < n.f) lo = mid + 1; else hi = mid; }
      queue.splice(lo, 0, n); nodes.set(n.k, n);
    }
    const heuristic = (x, y) => Math.hypot(x1 - x0 - x * step, y1 - y0 - y * step);
    add({ x: 0, y: 0, k: start, g: 0, f: heuristic(0, 0) });
    let best = start, bestH = heuristic(0, 0), reached = false, count = 0;
    while (queue.length && count < 600 && count < budget) {
      const n = queue.shift(); if (closed.has(n.k)) continue;
      closed.add(n.k); count++;
      const px = x0 + n.x * step, py = y0 + n.y * step, h = heuristic(n.x, n.y);
      if (h < bestH) { bestH = h; best = n.k; }
      if (h < 16 && lineClear(px, py, x1, y1, rr, 0) && unitsClear(px, py, x1, y1, r, units)) { best = n.k; reached = true; break; }
      for (let d = 0; d < 8; d++) {
        const nx = n.x + DX[d], ny = n.y + DY[d];
        if (Math.abs(nx) > limit || Math.abs(ny) > limit) continue;
        const k = key(nx, ny), gx = x0 + nx * step, gy = y0 + ny * step;
        if (closed.has(k) || !lineClear(px, py, gx, gy, rr, 0) || !unitsClear(px, py, gx, gy, r, units)) continue;
        const ng = n.g + COST[d] * step;
        if (scores.has(k) && scores.get(k) <= ng) continue;
        scores.set(k, ng); parents.set(k, n.k); add({ x: nx, y: ny, k, g: ng, f: ng + heuristic(nx, ny) });
      }
    }
    budget -= count;
    const out = [];
    for (let k = best; k !== start && k !== undefined; k = parents.get(k)) { const n = nodes.get(k); out.push([x0 + n.x * step, y0 + n.y * step]); }
    out.reverse(); if (reached) out.push([x1, y1]);
    // OpenBW pathfinder_find_next_short_path / path_progress는 막힌 목적지를
    // 탐색으로 얻은 도달 가능한 끝점으로 조정한다. 현재 원형·8px 탐색 모델에
    // 적용하되 정지 몸체가 실제 목표를 점유한 경우만 허용한다.
    if (!reached && occupiedGoal && Math.abs(x1 - x0) <= limit * step && Math.abs(y1 - y0) <= limit * step) {
      if (!out.length) out.push([x0, y0]);
      out.goalBlocker = occupiedGoal;
    }
    return out.length ? compactPath(out) : null;
  }

  function unitsClear(x0, y0, x1, y1, r, units, mover = null) {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
    const blocked = u => {
      if (u.dead || u.hidden || u.burrowed || u.noCollide || u.type === 'larva') return false;
      if (mover && !canGroundCollide(mover, u)) return false;
      const ox = u.x - x0, oy = u.y - y0, min = (r + u.r) * 0.85 + 0.1;
      if (len2 > 0 && ox * ox + oy * oy < min * min && ox * dx + oy * dy <= 0) return false;
      const t = len2 ? Math.max(0, Math.min(1, (ox * dx + oy * dy) / len2)) : 0;
      return (ox - dx * t) ** 2 + (oy - dy * t) ** 2 < min * min;
    };
    if (units.spatialIndex) {
      const index = units.spatialIndex, pad = (r + index.maxR) * .85 + .1,
        tx0 = Math.floor((Math.min(x0, x1) - pad) / 64), tx1 = Math.floor((Math.max(x0, x1) + pad) / 64),
        ty0 = Math.floor((Math.min(y0, y1) - pad) / 64), ty1 = Math.floor((Math.max(y0, y1) + pad) / 64);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const cell = index.cells.get(ty * 128 + tx);
        if (cell) for (const u of cell) if (blocked(u)) return false;
      }
    } else {
      for (const u of units) if (blocked(u)) return false;
    }
    return true;
  }
  function indexUnits(units) {
    if (units.length <= 32) return units;
    const cells = new Map(); let maxR = 0;
    for (const u of units) {
      const key = Math.floor(u.y / 64) * 128 + Math.floor(u.x / 64);
      let cell = cells.get(key); if (!cell) cells.set(key, cell = []); cell.push(u);
      maxR = Math.max(maxR, u.r);
    }
    units.spatialIndex = {cells, maxR}; return units;
  }
  function unitObstacles(mover, includeMoving) {
    const units = GAME.entities.filter(u => canGroundCollide(mover, u) && (includeMoving || !collisionMover(u)));
    const cells = new Set();
    for (const u of units) {
      const radius = (u.r + mover.r) * 0.85 + 2;
      for (let ty = Math.max(0, tileOf(u.y - radius)); ty <= Math.min(MAP_H - 1, tileOf(u.y + radius)); ty++)
        for (let tx = Math.max(0, tileOf(u.x - radius)); tx <= Math.min(MAP_W - 1, tileOf(u.x + radius)); tx++)
          if (Math.hypot(Math.max(0, Math.abs(tx * TILE + TILE / 2 - u.x) - TILE / 2), Math.max(0, Math.abs(ty * TILE + TILE / 2 - u.y) - TILE / 2)) < radius) cells.add(tIdx(tx, ty));
    }
    cells.delete(tIdx(tileOf(mover.x), tileOf(mover.y)));
    return { cells, units: indexUnits(units) };
  }
  return {
    find, worldPath, lineClear, positionClear, localPath, unitPath, nearestPassable, passable, unitsClear, unitObstacles, goalBlocker, compactPath,
    resetBudget() { budget = 24000; terrainFrame = false; },
    beginTick() { budget = 24000; terrainFrame = true; terrainDirty = true; },
    endTick() { terrainFrame = false; }, invalidateTerrain() { terrainDirty = true; },
    get budget() { return budget; },
  };
})();

// ---------------- 공간 해시 ----------------
const SH = (() => {
  const CS = 64, GW = Math.ceil(MAP_W * TILE / CS), GH = Math.ceil(MAP_H * TILE / CS);
  const cells = Array.from({ length: GW * GH }, () => []);
  const ownerMask = new Uint8Array(GW * GH);
  const ground = Array.from({ length: GW * GH }, () => []), active = [], activeGround = [];
  function clear() {
    for (const c of active) c.length = 0; active.length = 0;
    for (const c of activeGround) c.length = 0; activeGround.length = 0;
  }
  function insert(e) {
    const cx = Math.max(0, Math.min(GW - 1, (e.x / CS) | 0)), cy = Math.max(0, Math.min(GH - 1, (e.y / CS) | 0));
    const i = cy * GW + cx, c = cells[i];
    if (!c.length) { active.push(c); ownerMask[i] = 0; } c.push(e);
    ownerMask[i] |= 1 << e.owner; e.shCell = i;
    // Include harvest/burrow bodies too: an order can restore their collision
    // after insertion in this same tick. Callers check their current state.
    if (!e.isBuilding && !e.air && !e.def.mine && e.type !== 'larva') {
      const g = ground[i]; if (!g.length) activeGround.push(g); g.push(e);
    }
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
  function queryEnemy(x, y, r, owner, out) {
    out = out || []; if (owner === NEUTRAL) return out;
    const enemy = owner === PLAYER ? ENEMY : PLAYER,
      x0 = Math.max(0, ((x - r - 64) / CS) | 0), x1 = Math.min(GW - 1, ((x + r + 64) / CS) | 0),
      y0 = Math.max(0, ((y - r - 64) / CS) | 0), y1 = Math.min(GH - 1, ((y + r + 64) / CS) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const i = cy * GW + cx; if (!(ownerMask[i] & (1 << enemy))) continue;
      for (const e of cells[i]) if (e.owner === enemy) out.push(e);
    }
    return out;
  }
  function ownerChanged(e) {
    const cell = cells[e.shCell]; if (!cell || !cell.includes(e)) return;
    let mask = 0; for (const u of cell) mask |= 1 << u.owner; ownerMask[e.shCell] = mask;
  }
  function queryGround(x, y, r, out) {
    out = out || [];
    const x0 = Math.max(0, Math.floor((x - r) / CS)), x1 = Math.min(GW - 1, Math.floor((x + r) / CS)),
      y0 = Math.max(0, Math.floor((y - r) / CS)), y1 = Math.min(GH - 1, Math.floor((y + r) / CS));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = ground[cy * GW + cx];
      for (const e of c) if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r * r) out.push(e);
    }
    return out;
  }
  function prepareGround(entities) {
    for (const c of activeGround) c.length = 0; activeGround.length = 0;
    for (const e of entities) {
      if (!groundCollider(e)) continue;
      const cx = Math.max(0, Math.min(GW - 1, Math.floor(e.x / CS))), cy = Math.max(0, Math.min(GH - 1, Math.floor(e.y / CS))), c = ground[cy * GW + cx];
      if (!c.length) activeGround.push(c); c.push(e);
    }
  }
  return { clear, insert, query, queryEnemy, ownerChanged, queryGround, prepareGround };
})();
