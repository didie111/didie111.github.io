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

function cmdTrainSelected(buildings, type) {
  const d = UNITS[type];
  const eligible = buildings.filter(b => !b.dead && b.done && !b.lifted && !b.morph &&
    (b.def.produces || []).includes(type) && b.queue.length < 5 &&
    (!d.addon || attachedAddon(b, d.addon)));
  // One click buys one unit. Repeated clicks distribute work among the selected producers.
  const work = b => b.queue.reduce((n, q) => n + q.total - q.prog, 0);
  eligible.sort((a, b) => work(a) - work(b) || a.id - b.id);
  if (!eligible.length) { if (buildings[0]) notify(buildings[0].owner, 'q', '생산 가능한 건물 또는 빈 대기열이 없습니다.', 'err'); return false; }
  return cmdTrain(eligible[0], type);
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
        if (t.type === 'mineral' || t.type === 'geyser') { u.issue({ t: 'gather', tgt: t, phase: 'go' }, queued); u.lastRes = t; fxKind = 'gather'; continue; }
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
// Hold/Stop은 명령 상태이며 몸체의 이동 능력을 없애지 않는다.
function collisionFixed(e) {
  return (e.isBuilding && !e.lifted) || e.type === 'tank_siege' ||
    e.sieging || !!e.xform || e.type === 'egg' || e.type === 'lurker_egg' ||
    e.burrowed || e.lockT > 0 || e.stasisT > 0 || e.maelstromT > 0 || (e.orders[0] && e.orders[0].t === 'nuke');
}
function groundCollider(e) {
  return !e.dead && !e.hidden && !e.air && !e.lifted && !e.isBuilding &&
    !e.noCollide && !e.burrowed && !e.def.mine && e.type !== 'larva';
}
function collisionMover(e) {
  const order = e.orders[0];
  return !collisionFixed(e) && !(order && (order.t === 'hold' || order.t === 'stop')) && e.moving;
}

function directionDifference(to, from) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// OpenBW update_unit_movement_values: bounded velocity turn, speed progression,
// then heading. The same integrator drives ordinary paths and MoveToLegal.
function groundMovement(e, x, y, limit = e.speed) {
  const dx = x - e.x, dy = y - e.y, distance = Math.hypot(dx, dy);
  const profile = e.lifted ? LIFT_MOTION : e.type === 'spider_mine' ? MINE_MOTION : GROUND_MOTION[e.type] || AIR_MOTION[e.type];
  if (!profile || !distance) { e.vx = 0; e.vy = 0; e.currentSpeed = 0; return; }
  const [acceleration, turn, halt, control] = profile, scripted = control === 2;
  const modifier = scripted ? 0 : (hasTech(e.owner, SPEED_UPGRADES[e.type]) ? 1 : 0) + (e.stimT > 0 ? 1 : 0) - (e.ensnareT > 0 ? 1 : 0);
  const motionScale = scripted ? 1 : modifier > 0 ? 2 : modifier < 0 ? .75 : 1;
  const desired = Math.atan2(dy, dx), headingTurn = turn * motionScale * Math.PI * 2 / 256,
    velocityTurn = scripted ? headingTurn : headingTurn / 2;
  const delta = directionDifference(desired, e.velocityDirection);
  e.velocityDirection += Math.max(-velocityTurn, Math.min(velocityTurn, delta));
  const headingError = directionDifference(desired, e.dir);
  if (scripted) {
    // Iscript's large-turn gate; animation strides still use the project's average speed.
    e.currentSpeed = Math.abs(headingError) >= Math.PI / 4 ? 0 : e.speed;
  } else {
    const a = acceleration * motionScale / 256, remainingTurn = Math.abs(directionDifference(desired, e.velocityDirection));
    let accelerate = remainingTurn < 1e-6 || distance >= 32 ||
      Math.ceil(remainingTurn * 2 / headingTurn) * e.currentSpeed * 1.5 <= distance;
    const haltDistance = motionScale === 1 && Math.abs(e.currentSpeed - e.def.speed) < 1e-6 ? halt / 256 : e.currentSpeed ** 2 / (2 * a);
    if (control === 0 && haltDistance >= distance) accelerate = false;
    e.currentSpeed = Math.max(0, Math.min(e.speed, e.currentSpeed + (accelerate ? a : -a)));
  }
  e.dir += Math.max(-headingTurn, Math.min(headingTurn, headingError));
  const step = Math.min(limit, e.currentSpeed, distance);
  if (step >= distance && step > 0) { e.vx = dx; e.vy = dy; }
  else { e.vx = Math.cos(e.velocityDirection) * step; e.vy = Math.sin(e.velocityDirection) * step; }
}

// 이동하는 쪽에서만 회피한다. 짧은 직선 후보를 검사하여 옆 공간을 찾고,
// 통과할 수 없는 길에서는 대기한다 (moveTo의 기존 stuck/재탐색 처리 유지).
function steerGround(e) {
  const speed = Math.hypot(e.vx, e.vy);
  if (!speed) return;
  const blockers = e.collisionNeighbors || SH.queryGround(e.x, e.y, e.r + speed * 6 + 24).filter(o => o !== e && groundCollider(o));
  const angle = Math.atan2(e.vy, e.vx), side = e.avoidSide || 1;
  const vectorSpeed = o => {
    if (o.speedVX !== o.vx || o.speedVY !== o.vy) {
      o.speedVX = o.vx; o.speedVY = o.vy; o.vectorSpeed = Math.hypot(o.vx, o.vy);
    }
    return o.vectorSpeed;
  };
  function clear(a, length) {
    const dx = Math.cos(a) * length, dy = Math.sin(a) * length;
    if (!PF.lineClear(e.x, e.y, e.x + dx, e.y + dy, Math.max(3, e.r * 0.75), 0)) return false;
    for (const o of blockers) {
      const ox = o.x - e.x, oy = o.y - e.y;
      const min = (e.r + o.r) * 0.85;
      const projection = (ox * dx + oy * dy) / (length * length || 1), originalT = projection < 0 ? 0 : projection > 1 ? 1 : projection;
      // A body outside our swept step needs no terrain prediction at all.
      if ((ox - dx * originalT) ** 2 + (oy - dy * originalT) ** 2 >= (min + 0.1) ** 2) continue;
      // 같은 방향으로 진행하는 유닛은 이번 프레임의 상대 이동으로 검사한다.
      // 앞 유닛이 떠날 현재 위치를 정지 장애물로 취급하면 뒤 유닛이 매번 옆으로 튄다.
      let rx = dx, ry = dy;
      const otherSpeed = vectorSpeed(o);
      if (!e.pathDynamic && length <= speed + 0.001 && collisionMover(o) && Math.abs(otherSpeed - speed) < 0.001 && otherSpeed > 0 &&
          (dx * o.vx + dy * o.vy) / (length * otherSpeed) > 0.97 &&
          PF.lineClear(o.x, o.y, o.x + o.vx, o.y + o.vy, Math.max(3, o.r * 0.75), 0)) {
        rx -= o.vx; ry -= o.vy;
      }
      const len2 = rx * rx + ry * ry;
      const dot = len2 ? (ox * rx + oy * ry) / len2 : 0, t = dot < 0 ? 0 : dot > 1 ? 1 : dot;
      if ((ox - rx * t) ** 2 + (oy - ry * t) ** 2 >= (min + 0.1) ** 2) continue;
      // 스폰/언버로우 등으로 이미 겹친 경우 바깥으로 탈출하는 이동 허용.
      if (ox * ox + oy * oy < (min + 0.1) ** 2 && ox * rx + oy * ry <= 0) continue;
      return false;
    }
    return true;
  }
  // 같은 속도로 앞에서 진행하는 병력만 먼저 따라간다. 고정 장애물 우회는 기존 경로를 유지한다.
  const look = Math.max(speed, e.r + speed * 6), ux = Math.cos(angle), uy = Math.sin(angle);
  const parallel = o => collisionMover(o) && Math.abs(vectorSpeed(o) - speed) < 0.001 && (ux * o.vx + uy * o.vy) / speed > 0.97;
  const follows = blockers.some(o => parallel(o) && (o.x - e.x) * ux + (o.y - e.y) * uy > 0);
  const fixedAhead = blockers.some(o => {
    if (parallel(o)) return false;
    const ox = o.x - e.x, oy = o.y - e.y, t = Math.max(0, Math.min(look, ox * ux + oy * uy));
    return Math.hypot(ox - ux * t, oy - uy * t) < (e.r + o.r) * 0.85 + 0.1;
  });
  if (!e.pathDynamic && follows && !fixedAhead && clear(angle, speed)) { e.blockedTicks = 0; e.collisionWait = 0; return; }
  // OpenBW UM_FollowPath: 접촉 직전에는 반·사분의 일 이동도 검사한다.
  // 한 틱의 전속력 이동이 막혔다고 즉시 옆으로 돌지 않고 남은 틈으로 접근한다.
  if (!clear(angle, speed)) {
    for (const fraction of [0.5, 0.25]) {
      const length = speed * fraction;
      if (!clear(angle, length)) continue;
      e.vx = ux * length; e.vy = uy * length;
      e.collisionWait = 0; return;
    }
    const movingAhead = blockers.some(o => {
      if (!collisionMover(o) || e.vx * o.vx + e.vy * o.vy <= 0) return false;
      const ox = o.x - e.x, oy = o.y - e.y;
      const t = Math.max(0, Math.min(speed, ox * ux + oy * uy));
      return ox * ux + oy * uy > 0 && Math.hypot(ox - ux * t, oy - uy * t) < (e.r + o.r) * 0.85 + 0.1;
    });
    // UM_WaitFree의 이동 중 몸체 대기와 25회 접촉 뒤 UM_RepathMovers 전환.
    if (movingAhead) {
      e.vx = 0; e.vy = 0; e.collisionWait = (e.collisionWait || 0) + 1;
      if (e.collisionWait >= 25) {
        e.collisionWait = 0; e.path = null; e.pathRetryAt = 0;
        e.unitPathUntil = GAME.tick + 120; e.repathMoversUntil = GAME.tick + 120;
      }
      return;
    }
  }
  e.collisionWait = 0;
  for (const length of e.pathDynamic ? [speed] : [look, speed]) {
    for (const turn of [0, side, -side, 2 * side, -2 * side, 3 * side, -3 * side, 4 * side, -4 * side]) {
      const a = angle + turn * Math.PI / 8;
      if (!clear(a, length)) continue;
      e.vx = Math.cos(a) * speed; e.vy = Math.sin(a) * speed;
      if (turn) e.moveWaypoint = [e.x + Math.cos(a) * length, e.y + Math.sin(a) * length];
      if (turn) e.avoidSide = Math.sign(turn);
      e.blockedTicks = turn ? (e.blockedTicks || 0) + 1 : 0;
      return;
    }
  }
  e.vx = 0; e.vy = 0;
  e.blockedTicks = (e.blockedTicks || 0) + 1;
}

// OpenBW lcg_rand의 수식·구간 변환. 겹침 복구용 상태만 사용하므로 원작의
// 다른 시스템까지 포함한 난수 소비 순서와 같다는 뜻은 아니다.
function recoveryRand(from, to) {
  GAME.recoveryRandState = (Math.imul(GAME.recoveryRandState, 22695477) + 1) >>> 0;
  const value = (GAME.recoveryRandState >>> 16) & 0x7fff;
  return from + ((value * (to - from + 1)) >> 15);
}

// CheckIllegal에서 기다리거나 탈출 지점을 정하고, MoveToLegal에서 그 지점으로
// 걸어간 다음 다시 검사한다. 명령 큐를 유지하고 정상 접근에서 대기 몸체에 양보를 요청하지 않는다.
function recoverGround(e, blockers) {
  const speed = e.speed;
  if (collisionFixed(e) || speed <= 0) { e.groundRecovery = null; return false; }
  const overlaps = blockers.filter(o => (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < ((e.r + o.r) * 0.85 - 1e-6) ** 2);
  let state = e.groundRecovery;
  if (!state && !overlaps.length) return false;
  if (!state) state = e.groundRecovery = { phase: 'check' };
  const requestedAngle = e.velocityDirection;
  e.vx = 0; e.vy = 0;
  const rr = Math.max(3, e.r * 0.75);
  // MoveToLegal follows its chosen short path without ordinary unit collision.
  // Only already-illegal bodies enter this state; ordinary approaches still
  // collide with Hold/Stop. Terrain and physically fixed bodies remain barriers.
  const fixedNew = blockers.filter(o => collisionFixed(o) && !overlaps.includes(o));
  const newlyBlocked = (x, y) => !PF.unitsClear(e.x, e.y, x, y, e.r, fixedNew);
  if (state.phase === 'move') {
    const dx = state.x - e.x, dy = state.y - e.y, distance = Math.hypot(dx, dy);
    if (distance > 1e-6) {
      groundMovement(e, state.x, state.y);
      const x = e.x + e.vx, y = e.y + e.vy;
      if (PF.lineClear(e.x, e.y, x, y, rr, 0) && !newlyBlocked(x, y)) {
        return true;
      }
      e.vx = 0; e.vy = 0; e.currentSpeed = 0;
      // Keep the chosen path while turning past a temporary sideways obstruction.
      if (PF.lineClear(e.x, e.y, state.x, state.y, rr, 0) && !newlyBlocked(state.x, state.y)) return true;
    }
    state.phase = 'check'; // 도착 또는 새 장애물: 다음 검사에서 탈출 지점을 다시 선택한다.
    return true;
  }
  if (!overlaps.length) { e.groundRecovery = null; return false; }
  const blocking = overlaps.reduce((a, b) => a.r >= b.r ? a : b);
  // UM_CheckIllegal: 움직이거나 CheckIllegal/MoveToLegal 중인 상대이면
  // 0..31 중 24 미만에서 기다린다. 전체 유닛의 속도나 고정 지속시간을 바꾸지 않는다.
  const otherMoving = !collisionFixed(blocking) && (blocking.groundRecovery || collisionMover(blocking));
  if (otherMoving && recoveryRand(0, 31) < 24) return true;
  const legal = (x, y) => PF.positionClear(x, y, rr, 0) && PF.lineClear(e.x, e.y, x, y, rr, 0) &&
    PF.unitsClear(x, y, x, y, e.r, blockers) && !newlyBlocked(x, y);
  // 원작의 확장 사각형 둘레에서 가장 가까운 유효 지점을 찾는 분기를 원형 몸체에 적용한다.
  let target = null, bestDistance = Infinity;
  if (!otherMoving) {
    const radius = (e.r + blocking.r) * 0.85 + 0.11;
    const bearing = e.x === blocking.x && e.y === blocking.y ? requestedAngle : Math.atan2(e.y - blocking.y, e.x - blocking.x);
    for (let i = 0; i < 16; i++) {
      const angle = bearing + i * Math.PI / 8, x = blocking.x + Math.cos(angle) * radius, y = blocking.y + Math.sin(angle) * radius;
      const distance = Math.hypot(x - e.x, y - e.y);
      if (distance < bestDistance - 1e-6 && legal(x, y)) { bestDistance = distance; target = [x, y]; }
    }
  }
  if (!target) {
    const base = requestedAngle + recoveryRand(-3, 3) * Math.PI / 8, length = recoveryRand(2, 4) * 4;
    let x = e.x + Math.cos(base) * length, y = e.y + Math.sin(base) * length;
    // OpenBW는 한 후보를 검사한 뒤 대체 후보로 넘어간다. 16방향 중 겹침이
    // 가장 빨리 줄어드는 방향을 고르면 군집이 즉시 바깥으로 퍼져 버린다.
    if (legal(x, y)) target = [x, y];
    else {
      const order = e.orders[0], goalX = order && Number.isFinite(order.x) ? order.x : e.x,
        goalY = order && Number.isFinite(order.y) ? order.y : e.y;
      if (Math.hypot(goalX - e.x, goalY - e.y) <= 32 || recoveryRand(0, 31) >= 24) {
        x = e.x + 16 * recoveryRand(-2, 2); y = e.y + 16 * recoveryRand(-2, 2);
      } else {
        const angle = Math.atan2(goalY - e.y, goalX - e.x) + recoveryRand(-1, 1) * Math.PI / 8,
          distance = 8 + recoveryRand(0, 2) * 4;
        x = e.x + Math.cos(angle) * distance; y = e.y + Math.sin(angle) * distance;
      }
      // 이동 가능한 몸체가 남은 대체 지점도 짧은 이동 후 다시 검사한다.
      // 복구 경로에서도 지형과 고정 몸체는 보호한다.
      const fixedBlocked = blockers.some(o => collisionFixed(o) && Math.hypot(x - o.x, y - o.y) < (e.r + o.r) * .85);
      if (Math.hypot(x - e.x, y - e.y) > 1e-6 && PF.positionClear(x, y, rr, 0) &&
          PF.lineClear(e.x, e.y, x, y, rr, 0) && !fixedBlocked && !newlyBlocked(x, y)) target = [x, y];
    }
  }
  if (target) { state.phase = 'move'; [state.x, state.y] = target; }
  return true;
}

function physics() {
  const ents = GAME.entities;
  // Orders can reveal/unload units, hatch eggs, or restore harvest collision in
  // this tick. Build the collision roster once from that current state.
  SH.prepareGround(ents);
  // 모든 겹침 상태를 먼저 표시해야 처리 순서와 무관하게 상대의 CheckIllegal을 볼 수 있다.
  for (const e of ents) {
    e.collisionNeighbors = null;
    if (!groundCollider(e)) { e.groundRecovery = null; continue; }
    const radius = e.r + Math.max(48, Math.hypot(e.vx, e.vy) * 6 + 24);
    e.collisionNeighbors = SH.queryGround(e.x, e.y, radius).filter(o => o !== e);
    if (collisionFixed(e)) { e.groundRecovery = null; continue; }
    if (!e.groundRecovery && e.collisionNeighbors.some(o =>
        (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < ((e.r + o.r) * .85 - 1e-6) ** 2)) e.groundRecovery = { phase: 'check' };
  }
  for (const e of ents) {
    e.collisionMoving = collisionMover(e);
    e.recovering = false;
    if (groundCollider(e) && e.collisionMoving && !e.groundRecovery) steerGround(e);
  }
  // 순차 충돌 검사: 먼저 움직인 상대의 현재 위치를 사용하며 새 겹침은 대기한다.
  // 공간 해시는 틱 시작 위치이므로 최대 이동량만큼 검색 여유를 확보한다.
  for (const e of ents) {
    if (e.dead || e.hidden) { e.currentSpeed = 0; continue; }
    if (collisionFixed(e)) { e.vx = 0; e.vy = 0; e.currentSpeed = 0; continue; }
    if (groundCollider(e)) {
      const blockers = e.collisionNeighbors;
      // A legal idle/ordinary body cannot acquire an overlap from ordinary
      // movement. Only a neighbor already executing illegal recovery can enter it.
      const needsRecovery = e.groundRecovery || blockers.some(o => o.recovering && o.moving &&
        (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < ((e.r + o.r) * .85 - 1e-6) ** 2);
      e.recovering = needsRecovery ? recoverGround(e, blockers) : false;
      if (!e.recovering) {
        if (!e.collisionMoving || !e.moving) { e.currentSpeed = 0; continue; }
        const length = Math.hypot(e.vx, e.vy), waypoint = e.moveWaypoint || [e.x + e.vx, e.y + e.vy];
        groundMovement(e, waypoint[0], waypoint[1], length);
        // 회피에서 놓친 접촉도 좌표를 밀지 않고 이번 틱의 이동을 기다린다.
        const movementClear = (vx, vy) => PF.lineClear(e.x, e.y, e.x + vx, e.y + vy, Math.max(3, e.r * .75), 0) && !blockers.some(o => {
          const ox = o.x - e.x, oy = o.y - e.y;
          // OpenBW의 실제 이동 충돌처럼 현재 몸체를 검사한다. 아직 적용되지
          // 않은 상대 속도를 미리 빼면 상대가 감속/재탐색할 때 새 겹침이 생긴다.
          const rx = vx, ry = vy;
          const rr = rx * rx + ry * ry;
          const t = rr ? Math.max(0, Math.min(1, (ox * rx + oy * ry) / rr)) : 0;
          return (ox - rx * t) ** 2 + (oy - ry * t) ** 2 < ((e.r + o.r) * 0.85 - 1e-6) ** 2;
        });
        if (!movementClear(e.vx, e.vy)) {
          // UM_SlideFree checks 1px steps along the selected free direction
          // when momentum still points into the body. Facing keeps turning.
          const dx = waypoint[0] - e.x, dy = waypoint[1] - e.y, d = Math.hypot(dx, dy),
            step = Math.min(1, length, e.currentSpeed, d), vx = dx / (d || 1) * step, vy = dy / (d || 1) * step;
          if (step > 0 && movementClear(vx, vy)) { e.vx = vx; e.vy = vy; }
          else { e.vx = 0; e.vy = 0; e.currentSpeed = 0; e.blockedTicks = (e.blockedTicks || 0) + 1; }
        }
      }
    } else if (e.lifted || e.type === 'spider_mine' || GROUND_MOTION[e.type] || AIR_MOTION[e.type]) {
      if (e.moving) {
        const length = Math.hypot(e.vx, e.vy), waypoint = e.moveWaypoint || [e.x + e.vx, e.y + e.vy];
        groundMovement(e, waypoint[0], waypoint[1], length);
      } else e.currentSpeed = 0;
    }
    e.x += e.vx; e.y += e.vy;
  }
  const buf = [];
  for (const e of ents) {
    if (e.dead || e.hidden || e.isBuilding || !e.air || e.moving) continue;
    buf.length = 0; SH.query(e.x, e.y, e.r + 30, buf);
    for (const o of buf) {
      if (o === e || !o.air || o.dead || o.hidden || o.isBuilding) continue;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01, m = (e.r + o.r) * 0.7;
      if (d < m) { const f = Math.min(0.6, (m - d) * 0.04); e.x += dx / d * f; e.y += dy / d * f; }
    }
  }
  for (const e of ents) {
    if (e.dead || e.hidden || collisionFixed(e)) continue;
    e.x = Math.max(8, Math.min(MAP_W * TILE - 8, e.x));
    e.y = Math.max(8, Math.min(MAP_H * TILE - 8, e.y));
    if (!e.air && !e.lifted) resolveTerrain(e);
  }
}
function resolveTerrain(e) {
  const r = Math.max(3, e.r * 0.75);
  if (PF.positionClear(e.x, e.y, r, 0)) return;
  const tx = tileOf(e.x), ty = tileOf(e.y);
  const [left, top, right, bottom] = groundObstacleRect(tx, ty);
  if (!groundPassable(tx, ty) && e.x >= left && e.x <= right && e.y >= top && e.y <= bottom) {
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
    const [l, t, rt, bt] = groundObstacleRect(x, y);
    const qx = Math.max(l, Math.min(e.x, rt)), qy = Math.max(t, Math.min(e.y, bt));
    const dx = e.x - qx, dy = e.y - qy, d = Math.hypot(dx, dy);
    if (d < r && d > 0.001) { e.x += dx / d * (r - d); e.y += dy / d * (r - d); }
  }
}

function gameTick() {
  GAME.tick++;
  PF.beginTick();
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
  PF.endTick();
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
