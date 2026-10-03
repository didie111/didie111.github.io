'use strict';
// ===================================================================
//  게임 월드 상태 / 공용 헬퍼
// ===================================================================
const GAME = {
  tick: 0, entities: [], byId: new Map(), nextId: 1,
  players: [], projectiles: [], effects: [], decals: [], areas: [],
  vis: [new Uint8Array(MAP_W * MAP_H), new Uint8Array(MAP_W * MAP_H)],
  explored: [new Uint8Array(MAP_W * MAP_H), new Uint8Array(MAP_W * MAP_H)],
  ghosts: [new Map(), new Map()],
  control: PLAYER, revealAll: false, aiOn: [false, true], over: false, paused: false,
  speed: 1, buildSpeed: 1, running: false, msgCooldown: {},
  recoveryRandState: 42,
};

function newPlayer(race, idx) {
  return { idx, race, min: 50, gas: 0, used: 0, max: 0, tech: {}, upg: {}, researching: {}, kills: 0, lost: 0 };
}

function P(owner) { return GAME.players[owner]; }
function isEnemy(a, b) { return a !== b && a !== NEUTRAL && b !== NEUTRAL; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function hx(e) { return e.hw !== undefined ? e.hw : e.r; }
function hy(e) { return e.hh !== undefined ? e.hh : e.r; }
function edgeDist(a, b) {
  const dx = Math.max(0, Math.abs(a.x - b.x) - hx(a) - hx(b));
  const dy = Math.max(0, Math.abs(a.y - b.y) - hy(a) - hy(b));
  return Math.hypot(dx, dy);
}
function edgeDistPt(a, x, y) {
  const dx = Math.max(0, Math.abs(a.x - x) - hx(a));
  const dy = Math.max(0, Math.abs(a.y - y) - hy(a));
  return Math.hypot(dx, dy);
}
function bodyBox(e) {
  const size = e.def && e.def.collision;
  return size ? {x: e.x, y: e.y, hw: size[0], hh: size[1]} : e;
}
function depotReturnDistance(worker, depot) {
  // All three workers have 11px DAT extents; their movement circles remain unchanged.
  return edgeDist({x: worker.x, y: worker.y, hw: 11, hh: 11}, bodyBox(depot));
}
function activeResourceDepot(e, owner) {
  return e && !e.dead && e.owner === owner && e.isBuilding && e.def.townHall &&
    (e.done || e.def.larvaHall && e.morph) && !e.lifted && !(e.liftT > 0);
}
function hasTech(owner, id) { return !!P(owner).tech[id]; }
function upgLevel(owner, id) { return P(owner).upg[id] || 0; }

// 요구 건물 보유 여부 (레어/하이브는 해처리로도 인정)
function hasBuilding(owner, type) {
  for (const e of GAME.entities) {
    if (e.dead || e.owner !== owner || !e.isBuilding || !e.done || e.lifted) continue;
    if (e.def.addonOf && !GAME.entities.some(b => !b.dead && b.done && !b.lifted && b.owner === owner && b.type === e.def.addonOf && e.tx0 === b.tx0 + b.def.w && e.ty0 === b.ty0 + b.def.h - 2)) continue;
    if (e.type === type) return true;
    if (e.def.counts && e.def.counts.includes(type)) return true;
  }
  return false;
}
function reqMet(owner, req) {
  if (!req) return true;
  for (const r of req) if (r && !hasBuilding(owner, r)) return false;
  return true;
}
function missingReq(owner, req) {
  if (!req) return null;
  for (const r of req) if (r && !hasBuilding(owner, r)) return r;
  return null;
}
function canAfford(owner, cost) { const p = P(owner); return p.min >= cost[0] && p.gas >= cost[1]; }
function pay(owner, cost) { const p = P(owner); p.min -= cost[0]; p.gas -= cost[1]; }
function refund(owner, cost, f) { const p = P(owner); f = f === undefined ? 1 : f; p.min += Math.floor(cost[0] * f); p.gas += Math.floor(cost[1] * f); }

// 에러/알림 메시지 (소유자가 현재 조종 중인 플레이어일 때만 표시)
function notify(owner, key, text, sound) {
  if (owner !== GAME.control) return;
  const now = GAME.tick;
  if (GAME.msgCooldown[key] && now - GAME.msgCooldown[key] < 36) return;
  GAME.msgCooldown[key] = now;
  if (typeof UI !== 'undefined') UI.message(text);
  if (sound && typeof SND !== 'undefined') SND.play(sound);
}
function costFail(owner, cost) {
  const p = P(owner);
  if (p.min < cost[0]) { notify(owner, 'min', '미네랄이 부족합니다.', 'err'); return true; }
  if (p.gas < cost[1]) { notify(owner, 'gas', '베스핀 가스가 부족합니다.', 'err'); return true; }
  return false;
}
function supplyFailMsg(owner) {
  const r = P(owner).race;
  const t = r === 'T' ? '서플라이 디팟을 더 지어야 합니다.' : r === 'Z' ? '오버로드가 더 필요합니다.' : '파일런을 더 소환해야 합니다.';
  notify(owner, 'sup', t, 'err');
}
function supplyOk(owner, s) {
  const p = P(owner);
  if (s <= 0) return true;
  return p.used + s <= Math.min(MAX_SUPPLY, p.max) + 1e-6;
}

// ---------------- 엔티티 생성 ----------------
function addEntity(e) { GAME.entities.push(e); GAME.byId.set(e.id, e); return e; }

function createUnit(type, owner, x, y) {
  const e = new Entity(type, owner, x, y);
  addEntity(e);
  return e;
}

function createBuilding(type, owner, tx, ty, done) {
  const d = BUILDINGS[type];
  const e = new Entity(type, owner, (tx + d.w / 2) * TILE, (ty + d.h / 2) * TILE);
  e.tx0 = tx; e.ty0 = ty;
  e.done = done !== false;
  if (!e.done) { e.prog = 0; e.hp = Math.max(1, e.maxHp * 0.1); e.sh = e.maxSh * 0.1; }
  occupy(e, true);
  addEntity(e);
  return e;
}
function occupy(e, on) {
  PF.invalidateTerrain();
  const d = e.def;
  for (let y = e.ty0; y < e.ty0 + d.h; y++) for (let x = e.tx0; x < e.tx0 + d.w; x++) {
    if (!inMap(x, y)) continue;
    const i = tIdx(x, y);
    if (on) MAP.occ[i] = e.id; else if (MAP.occ[i] === e.id) MAP.occ[i] = 0;
  }
}

// 건물 배치 가능 검사
function canPlace(type, tx, ty, owner, builder, quiet) {
  const d = BUILDINGS[type];
  const fail = (msg) => { if (!quiet) notify(owner, 'place', msg, 'err'); return false; };
  if (tx < 0 || ty < 0 || tx + d.w > MAP_W || ty + d.h > MAP_H) return fail('그곳에는 건설할 수 없습니다.');
  if (d.onGeyser) {
    const g = GAME.entities.find(e => !e.dead && e.type === 'geyser' && e.tx0 === tx && e.ty0 === ty && !e.refinery);
    if (!g) return fail('베스핀 간헐천 위에만 건설할 수 있습니다.');
    return true;
  }
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
    const i = tIdx(x, y);
    if (!MAP.buildable[i] || MAP.occ[i]) return fail('그곳에는 건설할 수 없습니다.');
    if (!GAME.explored[owner][i] && !GAME.revealAll) return fail('탐색되지 않은 지역입니다.');
    if (d.race === 'Z' && !d.noCreepNeeded && !MAP.creep[i]) return fail('크립 위에만 건설할 수 있습니다.');
    if (d.race !== 'Z' && MAP.creep[i]) return fail('크립 위에는 건설할 수 없습니다.');
  }
  if (d.race === 'P' && !d.noPower && !isPowered(owner, (tx + d.w / 2) * TILE, (ty + d.h / 2) * TILE)) return fail('파일런의 전력장 안에 소환해야 합니다.');
  if (d.townHall) {
    for (const e of GAME.entities) {
      if (e.dead || !(e.type === 'mineral' || e.type === 'geyser')) continue;
      const dx = Math.max(0, e.tx0 - (tx + d.w), tx - (e.tx0 + e.def.w));
      const dy = Math.max(0, e.ty0 - (ty + d.h), ty - (e.ty0 + e.def.h));
      if (dx < 3 && dy < 3) return fail('자원과 너무 가깝습니다.');
    }
  }
  // 적 유닛이 있으면 불가
  const x0 = tx * TILE, y0 = ty * TILE, x1 = x0 + d.w * TILE, y1 = y0 + d.h * TILE;
  for (const e of SH.query((x0 + x1) / 2, (y0 + y1) / 2, d.w * 24)) {
    if (e.dead || e.isBuilding || e.air || e.hidden || e === builder || e.burrowed && e.owner === owner) continue;
    if (e.x + e.r > x0 && e.x - e.r < x1 && e.y + e.r > y0 && e.y - e.r < y1) {
      if (e.owner !== owner) return fail('유닛이 길을 막고 있습니다.');
    }
  }
  return true;
}

function nearestTownHall(owner, x, y) {
  let best = null, bd = 1e9;
  for (const e of GAME.entities) {
    if (!activeResourceDepot(e, owner)) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// 건물 주변 빈 자리 찾기 (유닛 스폰)
function findSpawnSpot(b, r, preferX, preferY) {
  const d = b.def;
  const tx0 = b.tx0 !== undefined ? b.tx0 : Math.floor(b.x / TILE), ty0 = b.ty0 !== undefined ? b.ty0 : Math.floor(b.y / TILE);
  const w = d.w || 1, h = d.h || 1;
  let best = null, bd = 1e9;
  for (let ring = 0; ring < 6; ring++) {
    for (let y = ty0 - 1 - ring; y <= ty0 + h + ring; y++) for (let x = tx0 - 1 - ring; x <= tx0 + w + ring; x++) {
      if (x >= tx0 - ring && x < tx0 + w + ring && y >= ty0 - ring && y < ty0 + h + ring) continue;
      if (!groundPassable(x, y)) continue;
      const px = x * TILE + 16, py = y * TILE + 16;
      let crowd = 0;
      for (const o of SH.query(px, py, 20)) if (!o.dead && !o.air && !o.isBuilding && dist(o.x, o.y, px, py) < 14) crowd++;
      const pref = preferX !== undefined ? dist(px, py, preferX, preferY) : (py < b.y ? 60 : 0) + Math.abs(px - b.x) * 0.3;
      const score = pref + crowd * 200;
      if (score < bd) { bd = score; best = [px + (Math.random() - 0.5) * 6, py + (Math.random() - 0.5) * 6]; }
    }
    if (best && bd < 200) break;
  }
  return best || [b.x, b.y + (h * 16) + 16];
}

// ---------------- 공급(인구수) ----------------
function recomputeSupply() {
  for (const p of GAME.players) { p.used = 0; p.max = 0; }
  for (const e of GAME.entities) {
    if (e.dead || e.owner > 1) continue;
    const p = GAME.players[e.owner], d = e.def;
    if (e.isBuilding) {
      if (e.nukeReady || e.nukeBuild) p.used += 8;
      if (e.done && d.provides) p.max += d.provides;
      if (e.done && e.queue.length && e.queue[0].started && e.queue[0].kind === 'unit') p.used += UNITS[e.queue[0].type].supply;
    } else {
      if (e.hallucination) continue;
      if (e.type === 'egg' || e.type === 'lurker_egg') { const md = UNITS[e.morphTo]; p.used += md.pair ? md.supply * 2 : md.supply; if (e.type === 'lurker_egg') p.used += 0; }
      else p.used += d.supply || 0;
      if (d.provides && e.done !== false) p.max += d.provides;
    }
  }
  for (const p of GAME.players) p.max = Math.min(p.max, MAX_SUPPLY);
}

// ---------------- 시야 ----------------
const CIRCLES = {};
function circleOffsets(r) {
  if (CIRCLES[r]) return CIRCLES[r];
  const out = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) out.push(x, y);
  return (CIRCLES[r] = out);
}
function revealCircle(vis, cx, cy, r, h) {
  const off = circleOffsets(r);
  for (let k = 0; k < off.length; k += 2) {
    const x = cx + off[k], y = cy + off[k + 1];
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    const i = y * MAP_W + x;
    vis[i] |= (MAP.height[i] <= h ? 3 : 2);
  }
}
function updateVision() {
  for (let p = 0; p < 2; p++) GAME.vis[p].fill(0);
  for (const e of GAME.entities) {
    if (e.dead || e.owner > 1 || e.hidden) continue;
    let sight = e.def.sight || 0;
    if (e.blinded) sight = 1;
    if (e.isBuilding && !e.done) sight = Math.min(sight, 5);
    if (e.burrowed && e.type !== 'lurker') sight = Math.min(sight, 4);
    if (!sight) continue;
    if (e.type === 'overlord' && hasTech(e.owner, 'ventral')) sight = 11;
    const h = (e.air || e.lifted) ? 2 : heightAtPx(e.x, e.y);
    revealCircle(GAME.vis[e.owner], tileOf(e.x), tileOf(e.y), sight, h);
    if (e.parasiteOwner !== undefined) revealCircle(GAME.vis[e.parasiteOwner], tileOf(e.x), tileOf(e.y), sight, h);
  }
  for (const a of GAME.areas) if (a.kind === 'scan') revealCircle(GAME.vis[a.owner], tileOf(a.x), tileOf(a.y), 10, 2);
  for (let p = 0; p < 2; p++) {
    const v = GAME.vis[p], ex = GAME.explored[p];
    for (let i = 0; i < v.length; i++) if (v[i] & 1) ex[i] = 1;
  }
  // 건물 잔상(안개 속 마지막 목격 정보)
  for (let p = 0; p < 2; p++) {
    const gh = GAME.ghosts[p], v = GAME.vis[p];
    for (const e of GAME.entities) {
      if (!e.isBuilding || e.owner === p || e.dead) continue;
      if (e.lifted) { gh.delete(e.id); continue; }
      const i = tIdx(tileOf(e.x), tileOf(e.y));
      if (v[i] & 1) gh.set(e.id, { id: e.id, type: e.type, owner: e.owner, x: e.x, y: e.y, done: e.done, tx0: e.tx0, ty0: e.ty0 });
    }
    for (const [id, g] of gh) {
      const e = GAME.byId.get(id);
      const i = tIdx(tileOf(g.x), tileOf(g.y));
      if ((!e || e.dead || e.lifted) && (v[i] & 1)) gh.delete(id);
      else if (e && e.type !== g.type && (v[i] & 1)) g.type = e.type;
    }
  }
  GAME.visionVersion = (GAME.visionVersion || 0) + 1;
}

// e 가 플레이어 p 에게 보이는가?
function isVisibleTo(e, p) {
  if (GAME.revealAll && p === GAME.control) return true;
  if (e.owner === p) return true;
  if (e.hidden) return false;
  if (e.owner === NEUTRAL) return !!(GAME.explored[p][tIdx(tileOf(e.x), tileOf(e.y))]);
  const i = tIdx(tileOf(e.x), tileOf(e.y));
  const v = GAME.vis[p][i];
  if (!(e.air || e.lifted ? (v & 2) : (v & 1))) return false;
  return true;
}
function isCloakedFor(e, p) {
  if (e.owner === p) return false;
  if (e.ensnareT > 0 || e.irrT > 0 || e.matrixHp > 0 || e.parasiteOwner === p) return false;
  // The aura roster changes only when entities are added/removed/transformed;
  // activity, owner and position are still checked at the call's current state.
  if (GAME.cloakerTick !== GAME.tick || GAME.cloakerEntities !== GAME.entities || GAME.cloakerLength !== GAME.entities.length) {
    GAME.cloakerTick = GAME.tick; GAME.cloakerEntities = GAME.entities; GAME.cloakerLength = GAME.entities.length;
    GAME.cloakers = GAME.entities.filter(a => a.def.cloakAura);
  }
  const aura = !e.isBuilding && e.type !== 'arbiter' && GAME.cloakers.some(a => !a.dead && !a.hidden && a.owner === e.owner && !(a.stasisT > 0) && dist(a.x, a.y, e.x, e.y) <= a.def.cloakAura);
  if (!(e.cloaked || e.def.permCloak || e.burrowed || aura)) return false;
  return !isDetectedBy(e, p);
}
function isDetectedBy(e, p) {
  if (e.detCache && e.detCache.t === GAME.tick) return e.detCache.v[p];
  const v = [false, false];
  for (let q = 0; q < 2; q++) {
    if (q === e.owner) { v[q] = true; continue; }
    for (const a of GAME.areas) if (a.kind === 'scan' && a.owner === q && dist(a.x, a.y, e.x, e.y) < 10 * TILE) v[q] = true;
    if (v[q]) continue;
    for (const d of GAME.detectors) {
      if (d.owner !== q && d.parasiteOwner !== q) continue;
      const r = (d.def.sight || 7) * TILE;
      if (Math.abs(d.x - e.x) < r && Math.abs(d.y - e.y) < r && dist(d.x, d.y, e.x, e.y) <= r) { v[q] = true; break; }
    }
  }
  e.detCache = { t: GAME.tick, v };
  return v[p];
}
// 타겟팅 가능 여부 (시야 + 탐지)
function targetableBy(e, p) {
  if (e.dead || e.hidden) return false;
  if (!isVisibleTo(e, p)) return false;
  if (isCloakedFor(e, p)) return false;
  return true;
}

// ---------------- 효과 ----------------
function fx(kind, x, y, opt) {
  const e = Object.assign({ kind, x, y, t: 0, life: 12 }, opt || {});
  GAME.effects.push(e);
  return e;
}
