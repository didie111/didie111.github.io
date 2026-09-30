'use strict';
// ===================================================================
//  적 AI — 저그 (일꾼 관리, 매크로, 테크, 방어, 러시 웨이브)
//  AI는 GAME.aiOn[owner] 가 true일 때만 동작 (테스트 패널에서 on/off)
// ===================================================================
const AI = (() => {
  const S = {};
  function st(o) {
    if (!S[o]) S[o] = { wave: 0, nextWave: 24 * 150, waveSize: 20, attacking: false, rally: null, lastBuild: 0, defendT: 0, target: null, aggression: 1 };
    return S[o];
  }
  const ARMY = (e) => !e.dead && !e.isBuilding && !e.isWorker && e.canAttack && !e.def.larva && !e.def.egg && e.type !== 'overlord';
  function mine(o) { return GAME.entities.filter(e => !e.dead && e.owner === o); }
  function hatches(o) { return GAME.entities.filter(e => !e.dead && e.owner === o && e.def.larvaHall); }
  function count(o, type, incl) {
    let n = 0;
    for (const e of GAME.entities) {
      if (e.dead || e.owner !== o) continue;
      if (e.type === type) n++;
      else if (incl && e.type === 'egg' && e.morphTo === type) n++;
      else if (incl && e.orders[0] && e.orders[0].t === 'build' && e.orders[0].bt === type) n++;
    }
    return n;
  }

  function update() {
    for (let o = 0; o < 2; o++) {
      if (!GAME.aiOn[o] || GAME.control === o && !GAME.aiWhileControl) continue;
      if (!GAME.players[o] || GAME.players[o].race !== 'Z') continue;
      if ((GAME.tick + o * 6) % 12 !== 0) continue;
      think(o);
    }
  }

  function think(o) {
    const s = st(o), p = P(o);
    const all = mine(o), hs = all.filter(e => e.def.larvaHall);
    if (!hs.length) return;
    const main = hs[0];
    const drones = all.filter(e => e.type === 'drone');
    const army = all.filter(ARMY);
    // --- 일꾼: 쉬는 드론 채취 ---
    for (const d of drones) {
      if (d.orders.length) continue;
      const halls = hs.slice().sort((a, b) => dist(a.x, a.y, d.x, d.y) - dist(b.x, b.y, d.x, d.y));
      for (const h of halls) {
        const m = findFreeMineral(h.x, h.y, d, null);
        if (m && dist(m.x, m.y, h.x, h.y) < 12 * TILE) { d.issue({ t: 'gather', tgt: m, phase: 'go' }); break; }
      }
    }
    // 가스 3마리
    const ext = all.find(e => e.type === 'extractor' && e.done);
    if (ext) {
      const onGas = drones.filter(d => d.orders[0] && d.orders[0].t === 'gather' && d.orders[0].tgt === ext).length;
      if (onGas < 3) { const d = drones.find(d => d.orders[0] && d.orders[0].t === 'gather' && d.orders[0].tgt && d.orders[0].tgt.type === 'mineral' && !d.carry); if (d) d.issue({ t: 'gather', tgt: ext, phase: 'go' }); }
    }
    // --- 건설 ---
    if (GAME.tick - s.lastBuild > 24 * 8) {
      const want = [];
      if (!count(o, 'pool', true)) want.push('pool');
      else if (!count(o, 'extractor', true) && drones.length >= 8) want.push('extractor');
      else if (!count(o, 'hydra_den', true) && hasBuilding(o, 'pool')) want.push('hydra_den');
      else if (!count(o, 'evo', true) && drones.length >= 12 && p.min > 200) want.push('evo');
      else if (count(o, 'creep_colony', true) + count(o, 'sunken') + count(o, 'spore') < 2 && hasBuilding(o, 'pool') && p.min > 250) want.push('creep_colony');
      for (const bt of want) {
        if (!canAfford(o, BUILDINGS[bt].cost)) break;
        const d = drones.find(d => !d.carry && (!d.orders[0] || d.orders[0].t === 'gather'));
        if (!d) break;
        const spot = bt === 'extractor' ? geyserSpot(o, main) : findBuildSpot(o, bt, main, d);
        if (spot) { d.issue({ t: 'build', bt, tx: spot[0], ty: spot[1] }); s.lastBuild = GAME.tick; }
        break;
      }
    }
    // 크립 콜로니 → 성큰
    for (const c of all) if (c.type === 'creep_colony' && c.done && !c.morph && hasBuilding(o, 'pool') && canAfford(o, BUILDINGS.sunken.cost)) cmdBuildingMorph(c, count(o, 'sunken') > 1 && hasBuilding(o, 'evo') ? 'spore' : 'sunken');
    // 연구
    const pool = all.find(e => e.type === 'pool' && e.done && !e.queue.length);
    if (pool && techAvailable(o, 'metabolic') && p.gas >= 100) cmdResearch(pool, 'metabolic');
    const den = all.find(e => e.type === 'hydra_den' && e.done && !e.queue.length);
    if (den) { for (const t of ['grooved', 'muscular']) if (techAvailable(o, t) && canAfford(o, TECH[t].cost)) { cmdResearch(den, t); break; } }
    const evo = all.find(e => e.type === 'evo' && e.done && !e.queue.length);
    if (evo && p.min > 300) for (const t of ['z_mis', 'z_car']) if (techAvailable(o, t) && !techReq(o, t) && canAfford(o, techCost(o, t))) { cmdResearch(evo, t); break; }
    // --- 라바 ---
    const larvae = all.filter(e => e.type === 'larva');
    for (const l of larvae) {
      const free = p.max - p.used;
      const ovEggs = count(o, 'overlord', true) - count(o, 'overlord');
      if (free < 3 + hs.length && ovEggs < 1 + (p.used > 40 ? 1 : 0) && p.max < MAX_SUPPLY) { if (!cmdMorphLarva([l], 'overlord')) break; continue; }
      const dWant = Math.min(20, hs.length * 7);
      if (drones.length + count(o, 'drone', true) - drones.length < dWant && count(o, 'drone', true) < dWant && Math.random() < 0.7) { if (cmdMorphLarva([l], 'drone')) continue; }
      if (hasBuilding(o, 'hydra_den') && p.gas >= 25 && Math.random() < 0.6) { if (cmdMorphLarva([l], 'hydra')) continue; }
      if (hasBuilding(o, 'pool')) { if (!cmdMorphLarva([l], 'zergling')) break; }
    }
    // --- 군대 ---
    const rally = s.rally || (s.rally = rallyPoint(o, main));
    // 방어: 기지 근처 적
    let threatE = null;
    for (const b of all) {
      if (!b.isBuilding) continue;
      for (const e of SH.query(b.x, b.y, 14 * TILE)) {
        if (e.dead || !isEnemy(o, e.owner) || e.hidden || !isVisibleTo(e, o)) continue;
        if (e.isBuilding && !e.canAttack) continue;
        threatE = e; break;
      }
      if (threatE) break;
    }
    if (threatE && !s.attacking) {
      for (const u of army) if (!u.tgt && (!u.orders[0] || u.orders[0].t !== 'attack')) u.issue({ t: 'amove', x: threatE.x, y: threatE.y });
      s.defendT = GAME.tick;
      return;
    }
    if (s.attacking) {
      const alive = army.filter(u => u.wave === s.wave);
      if (alive.length < 3) { s.attacking = false; for (const u of alive) u.issue({ t: 'move', x: rally[0], y: rally[1] }); }
      else {
        for (const u of alive) if (!u.orders.length) { const t = attackTarget(o, u); if (t) u.issue({ t: 'amove', x: t[0], y: t[1] }); }
      }
      return;
    }
    // 집결
    for (const u of army) if (!u.orders.length && !u.tgt && dist(u.x, u.y, rally[0], rally[1]) > 5 * TILE && GAME.tick - s.defendT > 24 * 5) u.issue({ t: 'amove', x: rally[0] + (Math.random() - 0.5) * 96, y: rally[1] + (Math.random() - 0.5) * 96 });
    const armySup = army.reduce((a, u) => a + (u.def.supply || 0), 0);
    if ((GAME.tick > s.nextWave && armySup >= 10) || armySup >= s.waveSize * s.aggression + 6) launchWave(o);
  }

  function launchWave(o) {
    const s = st(o);
    const army = mine(o).filter(ARMY);
    if (!army.length) return;
    s.wave++; s.attacking = true; s.nextWave = GAME.tick + 24 * 120; s.waveSize = Math.min(60, s.waveSize + 6);
    const t = attackTarget(o, army[0]);
    if (!t) { s.attacking = false; return; }
    for (const u of army) { u.wave = s.wave; u.issue({ t: 'amove', x: t[0], y: t[1] }); }
    if (isEnemy(o, GAME.control)) notify(GAME.control, 'wave', '적 병력이 접근하고 있습니다!', 'alert');
  }
  function attackTarget(o, u) {
    let best = null, bd = 1e9;
    for (const e of GAME.entities) {
      if (e.dead || !isEnemy(o, e.owner) || !e.isBuilding) continue;
      const known = isVisibleTo(e, o) || GAME.ghosts[o].has(e.id);
      if (!known) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d < bd) { bd = d; best = [e.x, e.y]; }
    }
    if (best) return best;
    const sb = MAP.starts[o === 0 ? 1 : 0];
    return sb ? [(sb.tx + 2) * TILE, (sb.ty + 1.5) * TILE] : null;
  }
  function rallyPoint(o, main) {
    const e = MAP.starts[o === 0 ? 1 : 0];
    const ex = e ? (e.tx + 2) * TILE : MAP_W * 16, ey = e ? (e.ty + 1.5) * TILE : MAP_H * 16;
    const a = Math.atan2(ey - main.y, ex - main.x);
    const x = main.x + Math.cos(a) * 9 * TILE, y = main.y + Math.sin(a) * 9 * TILE;
    const n = PF.nearestPassable(tileOf(x), tileOf(y), 6);
    return n ? [n[0] * TILE + 16, n[1] * TILE + 16] : [main.x, main.y + 96];
  }
  function geyserSpot(o, main) {
    let best = null, bd = 1e9;
    for (const g of GAME.entities) {
      if (g.dead || g.type !== 'geyser' || g.refinery) continue;
      const d = dist(g.x, g.y, main.x, main.y);
      if (d < bd && d < 14 * TILE) { bd = d; best = [g.tx0, g.ty0]; }
    }
    return best;
  }
  function findBuildSpot(o, bt, near, builder) {
    const d = BUILDINGS[bt];
    const cx = near.tx0 + 2, cy = near.ty0 + 1;
    // 자원 반대 방향 선호
    let rx = 0, ry = 0, n = 0;
    for (const m of GAME.entities) if (!m.dead && m.type === 'mineral' && dist(m.x, m.y, near.x, near.y) < 10 * TILE) { rx += m.x - near.x; ry += m.y - near.y; n++; }
    const ax = n ? -rx / n : 0, ay = n ? -ry / n : 0;
    let best = null, bs = 1e9;
    for (let r = 3; r < 12; r++) {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        if (!canPlace(bt, x, y, o, builder, true)) continue;
        // 주변 1칸 여유
        let ok = true;
        for (let yy = y - 1; yy <= y + d.h && ok; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) { if (!inMap(xx, yy)) { ok = false; break; } const oc = MAP.occ[tIdx(xx, yy)]; if (oc) { ok = false; break; } }
        if (!ok) continue;
        const sc = r * 10 - ((x - cx) * ax + (y - cy) * ay) / TILE * 2 + Math.random();
        if (sc < bs) { bs = sc; best = [x, y]; }
      }
      if (best) return best;
    }
    return best;
  }

  function onAttacked(e, src) {
    if (!src || e.dead || !GAME.aiOn[e.owner] || (GAME.control === e.owner && !GAME.aiWhileControl)) return;
    if (!isEnemy(e.owner, src.owner)) return;
    // 일꾼 공격받으면 주변 병력 호출
    for (const u of SH.query(e.x, e.y, 10 * TILE)) {
      if (u.owner !== e.owner || !ARMY(u) || u.tgt) continue;
      if (u.orders[0] && u.orders[0].t === 'amove' && st(e.owner).attacking && u.wave === st(e.owner).wave) continue;
      u.issue({ t: 'amove', x: src.x, y: src.y });
    }
  }
  function onBuilt(b) { }
  function onUnit(u) {
    if (!GAME.aiOn[u.owner]) return;
    const s = st(u.owner);
    if (ARMY(u) && s.rally && !u.orders.length) u.issue({ t: 'amove', x: s.rally[0] + (Math.random() - 0.5) * 80, y: s.rally[1] + (Math.random() - 0.5) * 80 });
  }
  function onDeath(e, killer) { }
  function forceWave(o) { launchWave(o); }
  function setAggression(o, v) { st(o).aggression = v; }
  function reset() { for (const k in S) delete S[k]; }
  return { update, onAttacked, onBuilt, onUnit, onDeath, forceWave, setAggression, reset, state: st };
})();
