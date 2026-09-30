'use strict';
// ===================================================================
//  명령 API (UI / AI 공용) + 시뮬레이션 틱
// ===================================================================
function cmdTrain(b, type) {
  const d = UNITS[type];
  if (!b || b.dead || !b.done || b.lifted || b.morph) return false;
  if (!(b.def.produces || []).includes(type)) return false;
  const miss = missingReq(b.owner, d.req);
  if (miss) { notify(b.owner, 'req', BUILDINGS[miss].name + ' 이(가) 필요합니다.', 'err'); return false; }
  if (b.queue.length >= 5) { notify(b.owner, 'q', '생산 대기열이 가득 찼습니다.', 'err'); return false; }
  if (costFail(b.owner, d.cost)) return false;
  if (!b.queue.length && !supplyOk(b.owner, d.supply)) { supplyFailMsg(b.owner); return false; }
  pay(b.owner, d.cost);
  b.queue.push({ kind: 'unit', type, prog: 0, total: d.time, started: false });
  return true;
}

function techCost(owner, id) {
  const t = TECH[id];
  if (!t.lv) return t.cost;
  const l = upgLevel(owner, id);
  return [t.cost[0] + t.inc[0] * l, t.cost[1] + t.inc[1] * l];
}
function techAvailable(owner, id) {
  const t = TECH[id], p = P(owner);
  if (t.lv) { const l = upgLevel(owner, id); if (l >= t.lv) return false; }
  else if (p.tech[id]) return false;
  if (p.researching[id]) return false;
  return true;
}
function techReq(owner, id) {
  const t = TECH[id];
  if (!t.req) return null;
  if (t.lv) { const r = t.req[upgLevel(owner, id)]; return r && !hasBuilding(owner, r) ? r : null; }
  return missingReq(owner, t.req);
}
function cmdResearch(b, id) {
  if (!b || b.dead || !b.done || b.queue.length || b.lifted || b.morph) { if (b && b.queue.length) notify(b.owner, 'q', '이미 연구 중입니다.', 'err'); return false; }
  if (!techAvailable(b.owner, id)) return false;
  const miss = techReq(b.owner, id);
  if (miss) { notify(b.owner, 'req', BUILDINGS[miss].name + ' 이(가) 필요합니다.', 'err'); return false; }
  const cost = techCost(b.owner, id);
  if (costFail(b.owner, cost)) return false;
  pay(b.owner, cost);
  const t = TECH[id];
  const time = t.lv ? t.time + 480 * upgLevel(b.owner, id) : t.time;
  b.queue.push({ kind: 'tech', type: id, prog: 0, total: time, started: true, cost });
  P(b.owner).researching[id] = true;
  return true;
}
function cmdCancelQueue(b, idx) {
  const q = b.queue[idx];
  if (!q) return;
  b.queue.splice(idx, 1);
  if (q.kind === 'unit') refund(b.owner, UNITS[q.type].cost);
  else { refund(b.owner, q.cost); delete P(b.owner).researching[q.type]; }
}
function cmdCancelConstruction(b) {
  if (b.done) {
    if (b.morph) { refund(b.owner, BUILDINGS[b.morph.to].cost, 0.75); b.morph = null; }
    return;
  }
  refund(b.owner, b.def.cost, 0.75);
  const x = b.x, y = b.y;
  if (b.race === 'Z') {
    killEntity(b, null, true);
    const dr = createUnit('drone', b.owner, x, y + b.hh);
    UI.selection = [dr];
  } else killEntity(b, null);
}
function cmdMorphLarva(larvae, type) {
  const d = UNITS[type];
  let n = 0;
  for (const l of larvae) {
    if (l.dead || l.type !== 'larva') continue;
    const miss = missingReq(l.owner, d.req);
    if (miss) { notify(l.owner, 'req', BUILDINGS[miss].name + ' 이(가) 필요합니다.', 'err'); break; }
    if (costFail(l.owner, d.cost)) break;
    const sup = d.pair ? d.supply * 2 : d.supply;
    if (!supplyOk(l.owner, sup)) { supplyFailMsg(l.owner); break; }
    pay(l.owner, d.cost);
    const egg = createUnit('egg', l.owner, l.x, l.y);
    egg.morphTo = type; egg.prog = 0; egg.total = d.time; egg.hatch = l.hatch;
    const si = UI.selection.indexOf(l); if (si >= 0) UI.selection[si] = egg;
    removeEntity(l);
    recomputeSupply();
    n++;
  }
  if (n) SND.play('zmorph');
  return n > 0;
}
function cmdBuildingMorph(b, to) {
  const d = BUILDINGS[to];
  if (b.morph || b.queue.length || !b.done) return false;
  const s = Object.values(SPELLS).find(s => s.morph === to);
  const miss = missingReq(b.owner, s && s.req);
  if (miss) { notify(b.owner, 'req', BUILDINGS[miss].name + ' 이(가) 필요합니다.', 'err'); return false; }
  if (costFail(b.owner, d.cost)) return false;
  pay(b.owner, d.cost);
  b.morph = { to, prog: 0, total: d.time };
  return true;
}

// 즉시 발동 능력
function cmdInstant(units, s) {
  const S = SPELLS[s];
  let any = false;
  for (const u of units) {
    if (u.dead) continue;
    const sp = u.def.spells || [];
    const has = sp.includes(s) || (s === 'unsiege' && u.type === 'tank_siege') || (s === 'unburrow' && u.burrowed) || (s === 'land' && u.lifted);
    if (!has && !(s === 'unburrow' || s === 'burrow') ) continue;
    if (!spellTechOk(u, s)) { notify(u.owner, 'tech', '먼저 연구가 필요합니다.', 'err'); continue; }
    switch (s) {
      case 'stim':
        if (u.hp <= 10) continue;
        u.hp -= 10; u.stimT = 170; any = true; break;
      case 'siege':
        if (u.type !== 'tank' || u.xform) continue;
        u.orders = []; u.tgt = null; u.path = null; u.xform = { to: 'tank_siege', t: 40 }; u.sieging = true; any = true; break;
      case 'unsiege':
        if (u.type !== 'tank_siege' || u.xform) continue;
        u.orders = []; u.tgt = null; u.xform = { to: 'tank', t: 40 }; u.sieging = true; any = true; break;
      case 'burrow':
        if (u.burrowed || u.air || !(u.def.spells || []).includes('burrow')) continue;
        if (u.type !== 'lurker' && !hasTech(u.owner, 'burrow_t')) { notify(u.owner, 'tech', '버로우 연구가 필요합니다.', 'err'); continue; }
        u.orders = []; u.tgt = null; u.path = null; u.burrowed = true; u.noCollide = true; fx('dust', u.x, u.y, { life: 12 }); any = true; break;
      case 'unburrow':
        if (!u.burrowed || u.def.mine) continue;
        u.burrowed = false; u.noCollide = false; u.tgt = null; fx('dust', u.x, u.y, { life: 12 }); any = true; break;
      case 'cloak':
        if (u.cloaked) { u.cloaked = false; any = true; break; }
        if (u.energy < 25) { notify(u.owner, 'energy', '에너지가 부족합니다.', 'err'); continue; }
        u.energy -= 25; u.cloaked = true; any = true; break;
      case 'lift':
        if (!u.isBuilding || !u.def.canLift || u.lifted || !u.done || u.queue.length || u.cargo.length) continue;
        occupy(u, false); u.liftT = 20; u.orders = []; any = true; break;
      case 'lurker_morph': {
        if (u.type !== 'hydra') continue;
        if (!hasBuilding(u.owner, 'lair')) { notify(u.owner, 'req', '레어가 필요합니다.', 'err'); continue; }
        if (costFail(u.owner, S.cost)) break;
        if (!supplyOk(u.owner, 1)) { supplyFailMsg(u.owner); break; }
        pay(u.owner, S.cost);
        const egg = createUnit('lurker_egg', u.owner, u.x, u.y);
        egg.morphTo = 'lurker'; egg.prog = 0; egg.total = UNITS.lurker.time;
        const si = UI.selection.indexOf(u); if (si >= 0) UI.selection[si] = egg;
        removeEntity(u); any = true; break;
      }
    }
  }
  return any;
}
function spellTechOk(u, s) {
  const S = SPELLS[s];
  if (!S) return true;
  if (S.techBy) { const t = S.techBy[u.type]; return !t || hasTech(u.owner, t); }
  if (S.techFree && S.techFree.includes(u.type)) return true;
  if (S.tech) return hasTech(u.owner, S.tech);
  if (S.req) return reqMet(u.owner, S.req);
  return true;
}

// 여러 유닛에게 명령
function commandUnits(units, order, queued) {
  const movers = units.filter(u => !u.dead && (!u.isBuilding || u.lifted));
  if (order.t === 'move' || order.t === 'amove' || order.t === 'patrol') {
    const g = GROUP_ID++;
    // 대형 유지: 그룹 중심이 목적지와 멀면 상대 위치 유지 (원작의 뭉치기 동작 보완)
    let cx = 0, cy = 0;
    for (const u of movers) { cx += u.x; cy += u.y; }
    cx /= movers.length || 1; cy /= movers.length || 1;
    let spread = 0;
    for (const u of movers) spread = Math.max(spread, dist(u.x, u.y, cx, cy));
    const keepForm = movers.length > 1 && spread < 160 && dist(cx, cy, order.x, order.y) > spread * 2 + 64;
    for (const u of movers) {
      const o = Object.assign({}, order, { group: g, gsize: movers.length });
      if (keepForm) {
        const nx = order.x + (u.x - cx), ny = order.y + (u.y - cy);
        if (u.air || groundPassable(tileOf(nx), tileOf(ny))) { o.x = nx; o.y = ny; }
      }
      if (order.t === 'patrol') { o.ox = u.x; o.oy = u.y; }
      u.issue(o, queued);
    }
    return;
  }
  for (const u of movers) u.issue(Object.assign({}, order), queued);
}

// 우클릭 스마트 명령
function smartCommand(units, x, y, target, queued) {
  const owner = units[0] ? units[0].owner : GAME.control;
  if (target && target.dead) target = null;
  let fxKind = 'move';
  // 건물: 집결 지점
  const blds = units.filter(u => u.isBuilding && !u.lifted);
  for (const b of blds) {
    if (b.def.produces || b.def.larvaHall) { b.rally = target && target !== b ? { tgt: target, x: target.x, y: target.y } : { x, y }; fxKind = 'rally'; }
    else if (b.def.bunker && b.cargo.length) { }
  }
  const us = units.filter(u => !u.isBuilding || u.lifted);
  if (!us.length) { if (fxKind === 'rally') UI.clickFx(x, y, 'rally'); return; }
  const plain = [];
  for (const u of us) {
    if (u.type === 'larva' || u.type === 'egg' || u.type === 'lurker_egg') continue;
    if (u.lifted) { u.issue({ t: 'move', x, y }, queued); continue; }
    if (target && target !== u) {
      const t = target;
      if (isEnemy(owner, t.owner)) {
        if (u.canAttack && u.weaponVs(t)) { u.issue({ t: 'attack', tgt: t }, queued); fxKind = 'attack'; continue; }
        plain.push(u); continue;
      }
      if (u.isWorker) {
        if (t.type === 'mineral') { u.issue({ t: 'gather', tgt: t, phase: 'go' }, queued); u.lastRes = t; fxKind = 'gather'; continue; }
        if (t.def.onGeyser && t.owner === u.owner && t.done) { u.issue({ t: 'gather', tgt: t, phase: 'go' }, queued); u.lastRes = t; fxKind = 'gather'; continue; }
        if (t.def.townHall && t.owner === u.owner && u.carry > 0) { u.issue({ t: 'ret' }, queued); continue; }
        if (u.race === 'T' && t.owner === u.owner && t.isBuilding && !t.done && t.race === 'T') { u.issue({ t: 'construct', tgt: t }, queued); continue; }
        if (u.race === 'T' && t.owner === u.owner && t.done && t.hp < t.maxHp && (t.isBuilding || t.def.mech)) { u.issue({ t: 'repair', tgt: t }, queued); continue; }
      }
      if (t.owner === u.owner && t.def.cargo && canLoad(t, u)) { u.issue({ t: 'load', tgt: t }, queued); continue; }
      if (u.def.cargo && t.owner === u.owner && canLoad(u, t)) { u.issue({ t: 'pickup', tgt: t }, queued); continue; }
      if (t.owner === u.owner && !t.isBuilding) { u.issue({ t: 'follow', tgt: t }, queued); continue; }
    }
    plain.push(u);
  }
  if (plain.length) commandUnits(plain, { t: 'move', x, y }, queued);
  UI.clickFx(x, y, fxKind);
}

// ---------------- 시뮬레이션 ----------------
function physics() {
  const ents = GAME.entities;
  for (const e of ents) {
    if (e.dead || e.hidden) continue;
    if (e.isBuilding && !e.lifted) continue;
    e.x += e.vx; e.y += e.vy;
  }
  const buf = [];
  for (const e of ents) {
    if (e.dead || e.hidden || e.isBuilding) continue;
    if (e.air) {
      if (e.moving) continue;
      buf.length = 0; SH.query(e.x, e.y, e.r + 30, buf);
      for (const o of buf) {
        if (o === e || !o.air || o.dead || o.hidden || o.isBuilding) continue;
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01, m = (e.r + o.r) * 0.7;
        if (d < m) { const f = Math.min(0.6, (m - d) * 0.04); e.x += dx / d * f; e.y += dy / d * f; }
      }
      continue;
    }
    if (e.noCollide || e.burrowed || e.def.mine && e.burrowed) continue;
    buf.length = 0; SH.query(e.x, e.y, e.r + 24, buf);
    for (const o of buf) {
      if (o.id <= e.id || o.dead || o.hidden || o.air || o.isBuilding || o.noCollide || o.burrowed) continue;
      if (o.def.mine) continue;
      let dx = o.x - e.x, dy = o.y - e.y;
      let d = Math.hypot(dx, dy);
      const min = (e.r + o.r) * 0.85;
      if (d >= min) continue;
      if (d < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
      const ov = min - d;
      const me = mobility(e), mo = mobility(o);
      let we = mo / (me + mo || 1), wo = me / (me + mo || 1);
      const f = Math.min(ov, 3) * 0.5;
      e.x -= dx / d * f * we * 2; e.y -= dy / d * f * we * 2;
      o.x += dx / d * f * wo * 2; o.y += dy / d * f * wo * 2;
    }
  }
  for (const e of ents) {
    if (e.dead || e.hidden) continue;
    if (e.isBuilding && !e.lifted) continue;
    e.x = Math.max(8, Math.min(MAP_W * TILE - 8, e.x));
    e.y = Math.max(8, Math.min(MAP_H * TILE - 8, e.y));
    if (!e.air && !e.lifted) resolveTerrain(e);
  }
}
// 밀림 정도: 이동 중인 유닛이 대기 유닛을 밀어냄 (원작의 비켜주기)
function mobility(e) {
  if (e.type === 'tank_siege' || e.sieging || e.type === 'egg' || e.type === 'lurker_egg') return 0.02;
  if (e.orders.length && e.orders[0].t === 'hold') return 0.05;
  if (e.orders.length && e.orders[0].t === 'construct') return 0.1;
  if (e.tgt && !e.moving) return 0.25; // 공격 중
  if (e.moving) return 0.3;
  return 1; // 대기 → 잘 밀림
}
function resolveTerrain(e) {
  const r = Math.max(3, e.r * 0.75);
  const tx = tileOf(e.x), ty = tileOf(e.y);
  if (!groundPassable(tx, ty)) {
    const np = PF.nearestPassable(tx, ty, 8, 0);
    if (np) {
      const cx = np[0] * TILE + 16, cy = np[1] * TILE + 16;
      const dx = cx - e.x, dy = cy - e.y, d = Math.hypot(dx, dy);
      if (d > 40) { e.x = cx; e.y = cy; } else { e.x += dx / (d || 1) * Math.min(d, 4); e.y += dy / (d || 1) * Math.min(d, 4); }
    }
    return;
  }
  for (let y = tileOf(e.y - r); y <= tileOf(e.y + r); y++) for (let x = tileOf(e.x - r); x <= tileOf(e.x + r); x++) {
    if (groundPassable(x, y)) continue;
    const qx = Math.max(x * TILE, Math.min(e.x, x * TILE + TILE)), qy = Math.max(y * TILE, Math.min(e.y, y * TILE + TILE));
    const dx = e.x - qx, dy = e.y - qy, d = Math.hypot(dx, dy);
    if (d < r && d > 0.001) { e.x += dx / d * (r - d); e.y += dy / d * (r - d); }
  }
}

function gameTick() {
  GAME.tick++;
  PF.resetBudget();
  SH.clear();
  const ents = GAME.entities;
  GAME.detectors = [];
  for (const e of ents) {
    if (e.dead) continue;
    if (!e.hidden) SH.insert(e);
    if (e.def.detector && !e.hidden && e.done && !(e.lockT > 0) && !e.unpowered) GAME.detectors.push(e);
  }
  if (GAME.tick % 4 === 1) updateVision();
  if (GAME.tick % 12 === 0) updateCreep();
  for (let i = 0; i < ents.length; i++) ents[i].update();
  for (const e of GAME.entities) if (!e.isWorkerGathering()) e.noCollide = e.burrowed;
  physics();
  updateProjectiles();
  updateAreas();
  GAME.effects = GAME.effects.filter(f => { if (f.delay > 0) { f.delay--; return true; } return ++f.t < f.life; });
  if (GAME.tick % 24 === 0) GAME.decals = GAME.decals.filter(d => (d.t += 24) < d.life);
  if (GAME.tick % 24 === 0 || ents.some(e => e.dead)) GAME.entities = GAME.entities.filter(e => !e.dead);
  recomputeSupply();
  if (typeof AI !== 'undefined') AI.update();
  if (GAME.tick % 24 === 0) checkVictory();
}
Entity.prototype.isWorkerGathering = function () {
  if (!this.def.worker) return false;
  const o = this.orders[0];
  return !!(o && (o.t === 'gather' || o.t === 'ret') && this.noCollide);
};

function checkVictory() {
  if (GAME.over || GAME.sandbox) return;
  const cnt = [0, 0];
  for (const e of GAME.entities) if (!e.dead && e.isBuilding && e.owner < 2) cnt[e.owner]++;
  if (cnt[PLAYER] === 0) endGame(false);
  else if (cnt[ENEMY] === 0) endGame(true);
}
