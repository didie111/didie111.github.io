'use strict';
// ===================================================================
//  맵 생성 — 128x128 타일, 180도 회전 대칭 1:1 맵
//  나(테란) 1시 방향 본진 / 적(저그) 7시 방향 본진
// ===================================================================
const TT = { LOW: 0, HIGH: 1, CLIFF: 2, WATER: 3, RAMP: 4, ROCK: 5 };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const MAP = {
  terr: new Uint8Array(MAP_W * MAP_H),
  walk: new Uint8Array(MAP_W * MAP_H),
  buildable: new Uint8Array(MAP_W * MAP_H),
  height: new Uint8Array(MAP_W * MAP_H),
  occ: new Int32Array(MAP_W * MAP_H),
  creep: new Uint8Array(MAP_W * MAP_H),
  variant: new Uint8Array(MAP_W * MAP_H),
  bases: [],
  starts: [],
  rng: null,
};

function tIdx(x, y) { return y * MAP_W + x; }
function inMap(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
function terrAt(x, y) { return inMap(x, y) ? MAP.terr[tIdx(x, y)] : TT.WATER; }

function generateMap(seed) {
  const rng = mulberry32(seed || 1998);
  MAP.rng = rng;
  const terr = MAP.terr;
  terr.fill(TT.LOW);
  MAP.occ.fill(0); MAP.creep.fill(0);
  for (let i = 0; i < terr.length; i++) MAP.variant[i] = (rng() * 256) | 0;

  const sym = (x, y) => [MAP_W - 1 - x, MAP_H - 1 - y];
  const blob = (cx, cy, r, s, fn) => {
    for (let y = Math.floor(cy - r * 1.3); y <= cy + r * 1.3; y++)
      for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.3; x++) {
        if (!inMap(x, y)) continue;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const a = Math.atan2(dy, dx);
        const rr = r * (1 + 0.1 * Math.sin(3 * a + s) + 0.06 * Math.sin(5 * a + 2 * s));
        if (dx * dx + dy * dy <= rr * rr) fn(x, y);
      }
  };
  const both = (fx) => { fx(false); fx(true); };
  const P = (x, y, m) => (m ? sym(x, y) : [x, y]);

  // --- 고지대 (본진, 중앙) ---
  both(m => { const [x, y] = P(106, 20, m); blob(x, y, 19, 1.3, (a, b) => terr[tIdx(a, b)] = TT.HIGH); });
  blob(64, 64, 9, 0.4, (a, b) => terr[tIdx(a, b)] = TT.HIGH);
  // 추가 언덕(3시/9시 쪽)
  both(m => { const [x, y] = P(76, 94, m); blob(x, y, 6, 2.1, (a, b) => terr[tIdx(a, b)] = TT.HIGH); });

  // --- 물 ---
  const lakes = [[74, 30, 5], [46, 56, 4.5], [100, 92, 6], [30, 64, 3.5]];
  for (const [lx, ly, lr] of lakes) both(m => { const [x, y] = P(lx, ly, m); blob(x, y, lr, lx * 0.1, (a, b) => { if (terr[tIdx(a, b)] === TT.LOW) terr[tIdx(a, b)] = TT.WATER; }); });

  // --- 절벽: 고지대 경계 ---
  const isHigh = (x, y) => inMap(x, y) && (terr[tIdx(x, y)] === TT.HIGH);
  const cliffs = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!isHigh(x, y)) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const t = terr[tIdx(nx, ny)];
      if (t !== TT.HIGH && t !== TT.CLIFF) { edge = true; break; }
    }
    if (edge) cliffs.push(tIdx(x, y));
  }
  for (const i of cliffs) terr[i] = TT.CLIFF;

  // --- 언덕길(램프) ---
  const ramps = [];
  const carveRamp = (cx, cy, ang) => {
    let px = cx, py = cy, hit = null;
    for (let s = 0; s < 40; s += 0.5) {
      px = cx + Math.cos(ang) * s; py = cy + Math.sin(ang) * s;
      const tx = Math.floor(px), ty = Math.floor(py);
      if (terrAt(tx, ty) === TT.CLIFF) { hit = [px, py]; break; }
    }
    if (!hit) return;
    ramps.push(hit);
    for (let y = Math.floor(hit[1] - 3); y <= hit[1] + 3; y++) for (let x = Math.floor(hit[0] - 3); x <= hit[0] + 3; x++) {
      if (!inMap(x, y)) continue;
      const d = Math.hypot(x + 0.5 - hit[0], y + 0.5 - hit[1]);
      if (d <= 2.2 && terr[tIdx(x, y)] === TT.CLIFF) terr[tIdx(x, y)] = TT.RAMP;
    }
    // 램프 바깥쪽 저지대 확보
    for (let s = 1; s < 5; s++) {
      const ox = hit[0] + Math.cos(ang) * s, oy = hit[1] + Math.sin(ang) * s;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = Math.floor(ox + dx), y = Math.floor(oy + dy);
        if (inMap(x, y) && (terr[tIdx(x, y)] === TT.WATER)) terr[tIdx(x, y)] = TT.LOW;
      }
    }
  };
  both(m => { const [x, y] = P(106, 20, m); carveRamp(x, y, m ? -Math.PI * 0.35 : Math.PI * 0.65); });
  carveRamp(64, 64, Math.PI * 0.25); carveRamp(64, 64, Math.PI * 1.25);
  carveRamp(64, 64, -Math.PI * 0.25); carveRamp(64, 64, Math.PI * 0.75);
  both(m => { const [x, y] = P(76, 94, m); carveRamp(x, y, m ? Math.PI * 0.5 : -Math.PI * 0.5); });

  // --- 기지 위치 (나 쪽 정의 → 대칭) ---
  const baseDefs = [
    { tx: 103, ty: 16, dir: -Math.PI / 4, kind: 'main' },
    { tx: 83, ty: 47, dir: 0, kind: 'natural' },
    { tx: 110, ty: 66, dir: 0, kind: 'third' },
    { tx: 58, ty: 11, dir: -Math.PI / 2, kind: 'fourth' },
  ];
  MAP.bases = [];
  for (const b of baseDefs) {
    MAP.bases.push({ tx: b.tx, ty: b.ty, dir: b.dir, kind: b.kind, side: 0 });
    MAP.bases.push({ tx: MAP_W - b.tx - 4, ty: MAP_H - b.ty - 3, dir: b.dir + Math.PI, kind: b.kind, side: 1 });
  }
  // 기지 주변 평탄화
  for (const b of MAP.bases) {
    const cx = b.tx + 2, cy = b.ty + 1.5;
    const want = terr[tIdx(b.tx + 2, b.ty + 1)] === TT.HIGH ? TT.HIGH : TT.LOW;
    for (let y = Math.floor(cy - 9); y <= cy + 9; y++) for (let x = Math.floor(cx - 9); x <= cx + 9; x++) {
      if (!inMap(x, y)) continue;
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 9.5) continue;
      const t = terr[tIdx(x, y)];
      if (want === TT.LOW && (t === TT.WATER)) terr[tIdx(x, y)] = TT.LOW;
    }
  }

  // --- 바위 장식 (통행 불가) ---
  const nearBase = (x, y, d) => MAP.bases.some(b => Math.hypot(b.tx + 2 - x, b.ty + 1.5 - y) < d);
  const nearRamp = (x, y, d) => ramps.some(r => Math.hypot(r[0] - x, r[1] - y) < d);
  for (let i = 0; i < 26; i++) {
    const x = 4 + Math.floor(rng() * 120), y = 4 + Math.floor(rng() * 120);
    const n = 1 + Math.floor(rng() * 3);
    both(m => {
      const [px, py] = P(x, y, m);
      if (nearBase(px, py, 13) || nearRamp(px, py, 7)) return;
      for (let k = 0; k < n; k++) {
        const qx = px + (k % 2), qy = py + (k >> 1);
        if (inMap(qx, qy) && terr[tIdx(qx, qy)] === TT.LOW) terr[tIdx(qx, qy)] = TT.ROCK;
      }
    });
  }

  // --- 통행/건설/높이 ---
  for (let i = 0; i < terr.length; i++) {
    const t = terr[i];
    MAP.walk[i] = (t === TT.LOW || t === TT.HIGH || t === TT.RAMP) ? 1 : 0;
    MAP.buildable[i] = (t === TT.LOW || t === TT.HIGH) ? 1 : 0;
    MAP.height[i] = (t === TT.HIGH || t === TT.CLIFF) ? 1 : 0;
  }
  // 램프 주변 1칸 건설 불가
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (terr[tIdx(x, y)] !== TT.RAMP) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(x + dx, y + dy)) MAP.buildable[tIdx(x + dx, y + dy)] = 0;
  }
  MAP.ramps = ramps;

  // 자원 배치 (나 쪽 계산 → 대칭 복제)
  MAP.resources = [];
  const tmpOcc = new Uint8Array(MAP_W * MAP_H);
  const free = (tx, ty, w, h, b) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
      if (!inMap(x, y) || !MAP.buildable[tIdx(x, y)] || tmpOcc[tIdx(x, y)]) return false;
      if (x >= b.tx - 1 && x < b.tx + 5 && y >= b.ty - 1 && y < b.ty + 4) return false;
    }
    return true;
  };
  const mark = (tx, ty, w, h) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) tmpOcc[tIdx(x, y)] = 1; };
  // 2x1 mineral footprints share an edge, including the bends. Independent
  // polar rounding left walkable tiles between fields and split the line.
  const mineralLines = {
    main: [[0, -6], [2, -6], [4, -6], [6, -6], [7, -5], [7, -4], [7, -3], [7, -2]],
    east: [[6, -3], [7, -2], [7, -1], [7, 0], [7, 1], [7, 2], [7, 3], [6, 4]],
    fourth: [[-5, -4], [-4, -5], [-2, -5], [0, -5], [2, -5], [4, -5], [6, -5], [7, -4]],
  };
  for (const b of MAP.bases.filter(b => b.side === 0)) {
    const cx = b.tx + 2, cy = b.ty + 1.5;
    const res = [];
    const line = mineralLines[b.kind] || mineralLines.east;
    for (const [dx, dy] of line) {
      const fx = b.tx + dx, fy = b.ty + dy;
      mark(fx, fy, 2, 1);
      res.push({ type: 'mineral', tx: fx, ty: fy, amount: 1500 });
    }
    for (const side of [1, -1]) {
      const ang = b.dir + side * 1.75;
      const gx = Math.round(cx + Math.cos(ang) * 7.5 - 2), gy = Math.round(cy + Math.sin(ang) * 7.5 - 1);
      if (free(gx, gy, 4, 2, b)) { mark(gx, gy, 4, 2); res.push({ type: 'geyser', tx: gx, ty: gy, amount: 5000 }); break; }
    }
    for (const r of res) {
      MAP.resources.push(r);
      const w = r.type === 'mineral' ? 2 : 4, h = r.type === 'mineral' ? 1 : 2;
      const mx = MAP_W - r.tx - w, my = MAP_H - r.ty - h;
      mark(mx, my, w, h);
      MAP.resources.push({ type: r.type, tx: mx, ty: my, amount: r.amount });
    }
  }
  MAP.starts = [MAP.bases.find(b => b.side === 0 && b.kind === 'main'), MAP.bases.find(b => b.side === 1 && b.kind === 'main')];
}

// ---- 쿼리 ----
function tileOf(px) { return Math.floor(px / TILE); }
function heightAtPx(x, y) {
  const tx = tileOf(x), ty = tileOf(y);
  if (!inMap(tx, ty)) return 0;
  return MAP.height[tIdx(tx, ty)];
}
function groundPassable(tx, ty) {
  if (!inMap(tx, ty)) return false;
  const i = tIdx(tx, ty);
  return MAP.walk[i] === 1 && MAP.occ[i] === 0;
}

// 파일런 전력장 (타원 반경 8x5 타일)
function isPowered(owner, cx, cy) {
  for (const e of GAME.entities) {
    if (e.dead || e.owner !== owner || e.type !== 'pylon' || !e.done) continue;
    const dx = (cx - e.x) / (8 * TILE), dy = (cy - e.y) / (5 * TILE);
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

// 크립 갱신 — 저그 크립 소스로부터 점진적으로 퍼짐
function updateCreep() {
  const c = MAP.creep;
  const want = new Uint8Array(MAP_W * MAP_H);
  for (const e of GAME.entities) {
    if (e.dead || !e.isBuilding) continue;
    const d = e.def;
    let r = 0;
    if (d.larvaHall) r = 10;
    else if (d.creepSource && e.done) r = 7;
    else if (e.race === 'Z' && e.done && !d.onGeyser) r = 2.5;
    if (!r) continue;
    e.creepR = Math.min(r, (e.creepR || 2) + 0.35);
    const cr = e.creepR;
    const cx = e.x / TILE, cy = e.y / TILE;
    for (let y = Math.floor(cy - cr - 1); y <= cy + cr + 1; y++) for (let x = Math.floor(cx - cr * 1.3 - 1); x <= cx + cr * 1.3 + 1; x++) {
      if (!inMap(x, y)) continue;
      const dx = (x + 0.5 - cx) / 1.3, dy = y + 0.5 - cy;
      const i = tIdx(x, y);
      const jitter = ((MAP.variant[i] & 15) / 15) * 1.2;
      if (dx * dx + dy * dy <= (cr - jitter) * (cr - jitter) && MAP.buildable[i]) want[i] = 1;
    }
  }
  for (let i = 0; i < c.length; i++) {
    if (want[i]) c[i] = 1;
    else if (c[i]) { if (MAP.variant[i] % 6 === GAME.tick % 6) c[i] = 0; }
  }
  for (const e of GAME.entities) if (e.isBuilding && !e.dead && e.race === 'Z' && !e.def.onGeyser) {
    for (let y = e.ty0; y < e.ty0 + e.def.h; y++) for (let x = e.tx0; x < e.tx0 + e.def.w; x++) c[tIdx(x, y)] = 1;
  }
}
