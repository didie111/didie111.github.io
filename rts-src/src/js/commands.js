'use strict';
// ===================================================================
//  명령 API (UI / AI 공용) + 시뮬레이션 틱
// ===================================================================
function cmdTrain(b, type) {
  const d = UNITS[type];
  if (!b || b.dead || !b.done || b.lifted || b.morph) return false;
  if (!(b.def.produces || []).includes(type)) return false;
  if (d.addon && !attachedAddon(b, d.addon)) { notify(b.owner, 'addon', BUILDINGS[d.addon].name + '이 이 생산 건물에 연결되어야 합니다.', 'err'); return false; }
  const miss = missingReq(b.owner, d.req);
  if (miss) { notify(b.owner, 'req', BUILDINGS[miss].name + ' 이(가) 필요합니다.', 'err'); return false; }
  if (b.queue.length >= 5) { notify(b.owner, 'q', '생산 대기열이 가득 찼습니다.', 'err'); return false; }
  if (costFail(b.owner, d.cost)) return false;
  if (!b.queue.length && !supplyOk(b.owner, d.supply)) { supplyFailMsg(b.owner); return false; }
  pay(b.owner, d.cost);
  b.queue.push({ kind: 'unit', type, prog: 0, total: d.time, started: false });
  return true;
}

function attachedAddon(b, type) {
  return GAME.entities.find(a => !a.dead && a.done && a.owner === b.owner && a.def.addonOf === b.type &&
    (!type || a.type === type) && !b.lifted && a.tx0 === b.tx0 + b.def.w && a.ty0 === b.ty0 + b.def.h - 2);
}
function cmdAddon(b, type) {
  const d = BUILDINGS[type];
  if (!b || b.dead || !b.done || b.lifted || b.liftT || b.queue.length || !(b.def.addons || []).includes(type)) return false;
  const tx = b.tx0 + b.def.w, ty = b.ty0 + b.def.h - 2;
  if (GAME.entities.some(a => !a.dead && a.def.addonOf === b.type && a.tx0 === tx && a.ty0 === ty)) return false;
  if (!reqMet(b.owner, d.req) || costFail(b.owner, d.cost) || !canPlace(type, tx, ty, b.owner, null)) return false;
  pay(b.owner, d.cost);
  const a = createBuilding(type, b.owner, tx, ty, false); a.parent = b;
  return true;
}
function ammoCapacity(u) {
  return u.type === 'carrier' ? (hasTech(u.owner, 'carrier_capacity') ? 8 : 4) : (hasTech(u.owner, 'reaver_capacity') ? 10 : 5);
}
function cmdAmmo(u) {
  if (u.dead || u.hidden || u.xform || u.hallucination || !u.def.ammo || u.ammoQueue && u.ammoQueue.length >= 5) return false;
  const queue = u.ammoQueue || (u.ammoQueue = []);
  if ((u.ammo || 0) + queue.length >= ammoCapacity(u)) return false;
  const cost = [u.type === 'carrier' ? 25 : 15, 0];
  if (costFail(u.owner, cost)) return false;
  pay(u.owner, cost); queue.push({ prog: 0, total: u.type === 'carrier' ? 300 : 105 }); return true;
}
function cmdMerge(units, type) {
  const from = type === 'archon' ? 'htemplar' : 'dtemplar';
  const pool = units.filter(u => !u.dead && !u.hidden && u.type === from && !u.xform);
  let any = false;
  while (pool.length >= 2) {
    const a = pool.shift(), index = pool.findIndex(b => b.owner === a.owner);
    if (index < 0) continue;
    const b = pool.splice(index, 1)[0];
    const merged = createUnit(type, a.owner, (a.x + b.x) / 2, (a.y + b.y) / 2);
    merged.xform = { to: type, t: 300 }; merged.energy = 0;
    if (typeof UI !== 'undefined') UI.selection = UI.selection.filter(u => u !== a && u !== b).concat(merged).slice(0, MAX_SELECT);
    removeEntity(a); removeEntity(b); any = true;
  }
  return any;
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
  if (b && b.def.addonOf && (!b.parent || b.parent.dead || !attachedAddon(b.parent, b.type))) return false;
  if (!b || !(b.def.research || []).includes(id)) return false;
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
  if (s === 'archon_merge' || s === 'dark_archon_merge') return cmdMerge(units, s === 'archon_merge' ? 'archon' : 'dark_archon');
  const S = SPELLS[s];
  let any = false;
  for (const u of units) {
    if (u.dead || u.hidden || u.lockT > 0 || u.stasisT > 0 || u.maelstromT > 0 || u.hallucination) continue;
    const sp = u.def.spells || [];
    const has = sp.includes(s) || (s === 'unsiege' && u.type === 'tank_siege') || (s === 'unburrow' && u.burrowed) || (s === 'land' && u.lifted);
    if (!has && !(s === 'unburrow' || s === 'burrow') ) continue;
    if (!spellTechOk(u, s)) { notify(u.owner, 'tech', '먼저 연구가 필요합니다.', 'err'); continue; }
    switch (s) {
      case 'arm_nuke':
        if (!u.done || u.nukeReady || u.nukeBuild || !hasBuilding(u.owner, 'nuclear_silo') || !supplyOk(u.owner, 8) || costFail(u.owner, S.cost)) continue;
        pay(u.owner, S.cost); u.nukeBuild = 1; any = true; break;
      case 'guardian_morph': case 'devourer_morph':
        if (u.type !== 'mutalisk' || u.xform || costFail(u.owner, S.cost)) continue;
        pay(u.owner, S.cost); u.orders = []; u.tgt = null; u.path = null;
        u.xform = { to: s === 'guardian_morph' ? 'guardian' : 'devourer', t: 600 }; any = true; break;
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
    // 스타1식 동일 목적지 명령. 자동 대형 유지/상대 좌표 목적지는 사용하지 않는다.
    for (const u of movers) {
      const o = Object.assign({}, order, { group: g, gsize: movers.length });
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
      if (t.type === 'shield_battery' && t.owner === u.owner && u.maxSh && !u.hallucination) { u.issue({ t: 'recharge', tgt: t }, queued); continue; }
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
// 완전 고정 상태는 속도 적용, 유닛 분리, 지형 보정 모두에서 제외한다.
function collisionFixed(e) {
  return (e.isBuilding && !e.lifted) || e.type === 'tank_siege' ||
    e.sieging || !!e.xform || e.type === 'egg' || e.type === 'lurker_egg' ||
    e.burrowed || e.lockT > 0 || e.stasisT > 0 || e.maelstromT > 0 || (e.orders[0] && e.orders[0].t === 'nuke');
}
function groundCollider(e) {
  return !e.dead && !e.hidden && !e.air && !e.lifted && !e.isBuilding &&
    !e.noCollide && !e.burrowed && !e.def.mine;
}
function collisionMover(e) {
  const order = e.orders[0];
  return !collisionFixed(e) && !(order && (order.t === 'hold' || order.t === 'stop')) && e.moving;
}

// 이동하는 쪽에서만 회피한다. 짧은 직선 후보를 검사하여 옆 공간을 찾고,
// 통과할 수 없는 길에서는 대기한다 (moveTo의 기존 stuck/재탐색 처리 유지).
function steerGround(e) {
  const speed = Math.hypot(e.vx, e.vy);
  if (!speed) return;
  const nearby = SH.query(e.x, e.y, e.r + speed * 6 + 24);
  const blockers = nearby.filter(o => o !== e && groundCollider(o));
  const angle = Math.atan2(e.vy, e.vx), side = e.avoidSide || 1;
  function clear(a, length) {
    const dx = Math.cos(a) * length, dy = Math.sin(a) * length;
    if (!PF.lineClear(e.x, e.y, e.x + dx, e.y + dy, Math.max(3, e.r * 0.75), 0)) return false;
    for (const o of blockers) {
      const ox = o.x - e.x, oy = o.y - e.y;
      const min = (e.r + o.r) * 0.85;
      const t = Math.max(0, Math.min(1, (ox * dx + oy * dy) / (length * length)));
      const closest = Math.hypot(ox - dx * t, oy - dy * t);
      if (closest >= min + 0.1) continue;
      // 스폰/언버로우 등으로 이미 겹친 경우 바깥으로 탈출하는 이동 허용.
      if (Math.hypot(ox, oy) < min + 0.1 && ox * dx + oy * dy <= 0) continue;
      return false;
    }
    return true;
  }
  for (const length of [Math.max(speed, e.r + speed * 6), speed]) {
    for (const turn of [0, side, -side, 2 * side, -2 * side, 3 * side, -3 * side, 4 * side, -4 * side]) {
      const a = angle + turn * Math.PI / 8;
      if (!clear(a, length)) continue;
      e.vx = Math.cos(a) * speed; e.vy = Math.sin(a) * speed;
      e.dir = a;
      if (turn) e.avoidSide = Math.sign(turn);
      e.blockedTicks = turn ? (e.blockedTicks || 0) + 1 : 0;
      return;
    }
  }
  e.vx = 0; e.vy = 0;
  e.blockedTicks = (e.blockedTicks || 0) + 1;
}

function physics() {
  const ents = GAME.entities;
  // 회피 결과가 0이어도 이동 시도 중인 유닛이 분리 보정을 부담한다.
  for (const e of ents) {
    e.collisionMoving = collisionMover(e);
    if (!e.dead && !e.hidden && groundCollider(e) && e.collisionMoving) steerGround(e);
  }
  for (const e of ents) {
    if (e.dead || e.hidden) continue;
    if (collisionFixed(e)) { e.vx = 0; e.vy = 0; continue; }
    if (groundCollider(e) && !e.collisionMoving) continue;
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
    if (!groundCollider(e)) continue;
    buf.length = 0; SH.query(e.x, e.y, e.r + 24, buf);
    for (const o of buf) {
      if (o.id <= e.id || !groundCollider(o)) continue;
      let dx = o.x - e.x, dy = o.y - e.y;
      let d = Math.hypot(dx, dy);
      const min = (e.r + o.r) * 0.85;
      if (d >= min) continue;
      const ov = min - d;
      if (d < 0.01) { dx = e.id % 2 ? 1 : -1; dy = 0; d = 1; }
      let me = e.collisionMoving ? 1 : 0, mo = o.collisionMoving ? 1 : 0;
      // 이미 겹친 대기 유닛의 예외적 겹침 해소. Hold/고정 상태는 그대로.
      if (!me && !mo) {
        me = !collisionFixed(e) && e.orders[0]?.t !== 'hold' ? 1 : 0;
        mo = !collisionFixed(o) && o.orders[0]?.t !== 'hold' ? 1 : 0;
      }
      const total = me + mo;
      if (!total) continue;
      e.x -= dx / d * ov * me / total; e.y -= dy / d * ov * me / total;
      o.x += dx / d * ov * mo / total; o.y += dy / d * ov * mo / total;
    }
  }
  for (const e of ents) {
    if (e.dead || e.hidden) continue;
    if (collisionFixed(e)) continue;
    e.x = Math.max(8, Math.min(MAP_W * TILE - 8, e.x));
    e.y = Math.max(8, Math.min(MAP_H * TILE - 8, e.y));
    if (!e.air && !e.lifted) resolveTerrain(e);
  }
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
    if (e.def.detector && !e.hidden && e.done && !e.blinded && !e.hallucination && !(e.lockT > 0) && !(e.stasisT > 0) && !e.unpowered) GAME.detectors.push(e);
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
