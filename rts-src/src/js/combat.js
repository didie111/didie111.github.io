'use strict';
// ===================================================================
//  전투: 무기 발사, 투사체, 피해 계산, 스플래시, 특수 능력
// ===================================================================
const PROJ = {
  spine:  { speed: 12, color: '#b8e060' }, grenade: { speed: 10, color: '#ffcc55' },
  shell:  { speed: 22, color: '#ffe080' }, siege: { speed: 14, color: '#fff0a0' },
  missile:{ speed: 10, color: '#ffffff', trail: true }, laser: { speed: 40, color: '#ff4040' },
  glaive: { speed: 11, color: '#b0ff70' }, plasma: { speed: 9, color: '#a0d8ff' },
  spit:   { speed: 8, color: '#a0e040' }, particle: { speed: 9, color: '#80c0ff' },
  tentacle: { speed: 0, delay: 8 }, spore: { speed: 8, color: '#d0ff90' },
  neutron:{ speed: 12, color: '#60ffff' }, interceptor: { speed: 9, color: '#ffe000' },
  yamato: { speed: 9, color: '#ff8020' }, lock: { speed: 9, color: '#80ff80' },
};

function fireWeapon(src, t, w) {
  const from = src.inside || src;
  const hits = w.hits || 1;
  // 저지대 → 고지대 명중률 (원작: 약 50%)
  let miss = false;
  const range = src.range(w);
  if (!src.air && !t.airTarget && range > 40 && !src.inside) {
    if (heightAtPx(t.x, t.y) > heightAtPx(from.x, from.y) && Math.random() < 0.5) miss = true;
  }
  // 다크 스웜
  if (!t.airTarget && range > 40 && !w.splash && !w.line && underSwarm(t)) miss = true;
  SND.play(w.proj || w.fx || 'melee', from.x, from.y, src);
  if (w.suicide) {
    dealDamage(src, t, w, 1);
    fx('zsplat', t.x, t.y, { life: 14, size: 0.6 });
    killEntity(src, null, true);
    return;
  }
  if (w.line) { lurkerSpines(src, t, w); return; }
  if (w.proj === 'interceptor') {
    for (let k = 0; k < hits; k++) GAME.projectiles.push({ kind: 'interceptor', x: from.x, y: from.y, tgt: t, src, w, mult: 1, miss, delay: k * 3, hitsOne: true, ang: Math.random() * 6.28, t: 0 });
    return;
  }
  if (w.proj) {
    const p = PROJ[w.proj];
    const ang = Math.atan2(t.y - from.y, t.x - from.x);
    const ox = from.x + Math.cos(ang) * Math.min(from.r || 8, 14), oy = from.y + Math.sin(ang) * Math.min(from.r || 8, 14) - (src.air ? 0 : 3);
    const pr = { kind: w.proj, x: ox, y: oy, sx: ox, sy: oy, tgt: t, tx: t.x, ty: t.y, src, w, mult: 1, miss, hits, t: 0, delay: p.delay || 0, bounce: w.bounce || 0, hitList: [] };
    if (w.proj === 'siege' || w.proj === 'tentacle') pr.tgt = null; // 지점 공격
    GAME.projectiles.push(pr);
    if (w.proj === 'shell' || w.proj === 'siege') fx('muzzle', ox, oy, { life: 5, ang, size: w.proj === 'siege' ? 1.6 : 1 });
    if (w.proj === 'tentacle') fx('tentacle', t.x, t.y, { life: 14 });
    return;
  }
  // 즉발 무기
  const ang = Math.atan2(t.y - from.y, t.x - from.x);
  if (w.fx === 'flame') {
    fx('flame', from.x + Math.cos(ang) * 8, from.y + Math.sin(ang) * 8, { life: 10, ang });
    for (let k = 0; k < hits; k++) dealDamage(src, t, w, 1, miss);
    if (w.splash) splashAround(src, t, w);
    return;
  }
  if (w.fx === 'gun') { fx('muzzle', from.x + Math.cos(ang) * 9, from.y + Math.sin(ang) * 9 - 3, { life: 3, ang, size: 0.6 }); fx('hitspark', t.x + (Math.random() - 0.5) * t.r, t.y + (Math.random() - 0.5) * t.r, { life: 6, miss }); }
  else if (w.fx === 'laser') { fx('beam', from.x, from.y, { life: 5, x2: t.x, y2: t.y, color: src.race === 'P' ? '#ffd040' : '#ff5050' }); }
  else fx('slash', t.x, t.y, { life: 6, race: src.race });
  for (let k = 0; k < hits; k++) dealDamage(src, t, w, 1, miss);
}

function underSwarm(t) {
  for (const a of GAME.areas) if (a.kind === 'swarm' && dist(a.x, a.y, t.x, t.y) <= a.r) return true;
  return false;
}

// 피해 적용 (원작 공식: 보호막 → 방어력 차감 → 크기 보정, 최소 0.5)
function dealDamage(src, t, w, mult, miss) {
  if (!t || t.dead || t.hidden) return;
  if (miss) { fx('miss', t.x, t.y - 6, { life: 10 }); return; }
  let dmg = (src ? src.weaponDmg(w) : w.dmg) * (mult || 1);
  const spell = w.type === 'spell';
  if (t.matrixHp > 0) {
    const a = Math.min(t.matrixHp, dmg); t.matrixHp -= a; dmg -= a;
    fx('matrixhit', t.x, t.y, { life: 6 });
    if (dmg <= 0) { t.hp = Math.max(1, t.hp - 0.5); t.onAttacked(src); return; }
  }
  if (t.sh > 0) {
    const sd = spell ? dmg : dmg - t.shArmor;
    if (sd <= t.sh) { t.sh -= Math.max(sd, 0.5); dmg = 0; fx('shield', t.x, t.y, { life: 6, r: t.r }); }
    else { dmg = sd - t.sh; t.sh = 0; }
  }
  if (dmg > 0) {
    const size = t.isBuilding ? 'large' : t.def.size;
    let hd = spell ? dmg : (dmg - t.armor) * DMG_MULT[w.type][size];
    hd = Math.max(0.5, hd);
    t.hitT = 3;
    t.takeRaw(hd, src);
  }
  if (!t.dead) t.onAttacked(src);
}

function splashAround(src, t, w) {
  const r = w.splash;
  for (const e of SH.query(t.x, t.y, r[2] + 30)) {
    if (e === t || e.dead || e.hidden || e.airTarget !== t.airTarget) continue;
    if (!isEnemy(src.owner, e.owner)) continue;
    const d = Math.max(0, dist(e.x, e.y, t.x, t.y) - e.r);
    const m = d <= r[0] ? 1 : d <= r[1] ? 0.5 : d <= r[2] ? 0.25 : 0;
    if (m) for (let k = 0; k < (w.hits || 1); k++) dealDamage(src, e, w, m);
  }
}

// 지점 스플래시 (시즈 탱크 / 마인 / 커세어)
function splashDamage(src, x, y, w, attacker, friendly, air) {
  const r = w.splash;
  for (const e of SH.query(x, y, r[2] + 30)) {
    if (e.dead || e.hidden || e === attacker) continue;
    if (!!e.airTarget !== !!air) continue;
    if (e.def.resource) continue;
    if (!friendly && !isEnemy(attacker.owner, e.owner)) continue;
    if (e.type === 'spider_mine' && e.owner === attacker.owner) continue;
    const d = Math.max(0, (e.isBuilding ? edgeDistPt(e, x, y) : dist(e.x, e.y, x, y) - e.r));
    const m = d <= r[0] ? 1 : d <= r[1] ? 0.5 : d <= r[2] ? 0.25 : 0;
    if (m) dealDamage(attacker.dead ? null : attacker, e, w, m);
  }
}

function lurkerSpines(src, t, w) {
  const ang = Math.atan2(t.y - src.y, t.x - src.x);
  const len = src.range(w) + 16;
  const x1 = src.x + Math.cos(ang) * len, y1 = src.y + Math.sin(ang) * len;
  fx('spines', src.x, src.y, { life: 16, ang, len });
  for (const e of SH.query((src.x + x1) / 2, (src.y + y1) / 2, len / 2 + 30)) {
    if (e.dead || e.hidden || e.airTarget || !isEnemy(src.owner, e.owner)) continue;
    // 선분과 거리
    const px = e.x - src.x, py = e.y - src.y;
    const along = px * Math.cos(ang) + py * Math.sin(ang);
    if (along < -10 || along > len) continue;
    const perp = Math.abs(-px * Math.sin(ang) + py * Math.cos(ang));
    if (perp <= 20 + e.r * 0.5) dealDamage(src, e, w, 1);
  }
}

function updateProjectiles() {
  const out = [];
  for (const p of GAME.projectiles) {
    p.t++;
    if (p.delay > 0) { p.delay--; if (p.kind === 'interceptor' && p.src && !p.src.dead) { p.x = p.src.x; p.y = p.src.y; } out.push(p); continue; }
    const def = PROJ[p.kind] || { speed: 10 };
    if (p.kind === 'tentacle') {
      if (p.tgt === null) { const tt = findUnitAt(p.tx, p.ty, p.src); if (tt) dealDamage(p.src, tt, p.w, 1, p.miss); }
      continue;
    }
    if (p.tgt && !p.tgt.dead && !p.tgt.hidden) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    let spd = def.speed;
    if (p.kind === 'interceptor') {
      // 캐리어 인터셉터: 궤도를 돌며 공격 후 복귀
      p.ang += 0.25;
      const ox = Math.cos(p.ang) * 18, oy = Math.sin(p.ang) * 18;
      const dx = p.tx + ox - p.x, dy = p.ty + oy - p.y, d = Math.hypot(dx, dy);
      if (d < 20 && !p.fired) {
        p.fired = true;
        if (p.tgt && !p.tgt.dead) { dealDamage(p.src && !p.src.dead ? p.src : null, p.tgt, p.w, 1, false); fx('beam', p.x, p.y, { life: 3, x2: p.tgt.x, y2: p.tgt.y, color: '#ffe000' }); }
      }
      if (p.fired) {
        if (!p.src || p.src.dead) continue;
        const bx = p.src.x - p.x, by = p.src.y - p.y, bd = Math.hypot(bx, by);
        if (bd < 10) continue;
        p.x += bx / bd * spd; p.y += by / bd * spd; p.dir = Math.atan2(by, bx);
      } else { p.x += dx / (d || 1) * Math.min(spd, d); p.y += dy / (d || 1) * Math.min(spd, d); p.dir = Math.atan2(dy, dx); }
      if (p.t < 200) out.push(p);
      continue;
    }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (def.trail && p.t % 2 === 0) fx('smoke', p.x, p.y, { life: 10 });
    if (d <= spd) {
      p.x = p.tx; p.y = p.ty;
      onProjectileHit(p);
      continue;
    }
    p.x += dx / d * spd; p.y += dy / d * spd; p.dir = Math.atan2(dy, dx);
    out.push(p);
  }
  GAME.projectiles = out;
}

function findUnitAt(x, y, src) {
  let best = null, bd = 1e9;
  for (const e of SH.query(x, y, 24)) {
    if (e.dead || e.hidden || !isEnemy(src.owner, e.owner) || e.airTarget) continue;
    const d = edgeDistPt(e, x, y);
    if (d < 6 && d < bd) { bd = d; best = e; }
  }
  return best;
}

function onProjectileHit(p) {
  const w = p.w, src = p.src && !p.src.dead ? p.src : null;
  switch (p.kind) {
    case 'siege':
      fx('explode', p.x, p.y, { life: 14, size: 1.2 });
      if (!p.miss) splashDamage(src, p.x, p.y, w, p.src, true, false); else fx('miss', p.x, p.y, { life: 10 });
      SND.play('boom', p.x, p.y);
      return;
    case 'neutron':
      fx('explode', p.x, p.y, { life: 8, size: 0.5, color: '#60ffff' });
      if (p.tgt && !p.tgt.dead) { dealDamage(src, p.tgt, w, 1); splashDamage(src, p.x, p.y, w, p.src, false, true); }
      return;
    case 'glaive': {
      const t = p.tgt;
      if (t && !t.dead) { dealDamage(src, t, w, p.mult, p.miss); fx('hitspark', t.x, t.y, { life: 6, color: '#b0ff70' }); p.hitList.push(t); }
      if (p.bounce > 1 && p.src) {
        let nx = null, bd = 1e9;
        for (const e of SH.query(p.x, p.y, 96)) {
          if (e.dead || e.hidden || p.hitList.includes(e) || !isEnemy(p.src.owner, e.owner)) continue;
          if (!targetableBy(e, p.src.owner)) continue;
          const d = dist(e.x, e.y, p.x, p.y);
          if (d < 96 && d < bd) { bd = d; nx = e; }
        }
        if (nx) GAME.projectiles.push(Object.assign({}, p, { tgt: nx, tx: nx.x, ty: nx.y, bounce: p.bounce - 1, mult: p.mult / 3, t: 0, miss: false }));
      }
      return;
    }
    case 'yamato':
      fx('explode', p.x, p.y, { life: 20, size: 2, color: '#ff8020' });
      if (p.tgt && !p.tgt.dead) dealDamage(src, p.tgt, { dmg: 260, type: 'explosive' }, 1);
      SND.play('bigboom', p.x, p.y);
      return;
    case 'lock':
      if (p.tgt && !p.tgt.dead) { p.tgt.lockT = 1300; p.tgt.orders = []; p.tgt.tgt = null; fx('lockfx', p.tgt.x, p.tgt.y, { life: 20 }); }
      return;
    default: {
      const t = p.tgt;
      if (!t || t.dead) return;
      for (let k = 0; k < (p.hits || 1); k++) dealDamage(src, t, w, p.mult || 1, p.miss);
      const col = PROJ[p.kind] && PROJ[p.kind].color;
      if (p.kind === 'missile' || p.kind === 'grenade' || p.kind === 'shell' || p.kind === 'plasma') fx('explode', t.x, t.y, { life: 8, size: p.kind === 'plasma' ? 0.5 : 0.6, color: p.kind === 'plasma' ? '#a0d8ff' : undefined });
      else fx('hitspark', t.x, t.y, { life: 6, color: col });
      if (w.splash && p.kind !== 'neutron') splashAround(p.src || t, t, w);
    }
  }
}

// ---------------- 지속 효과 영역 ----------------
function updateAreas() {
  const out = [];
  for (const a of GAME.areas) {
    a.t++;
    if (a.kind === 'storm' && a.t % 8 === 0) {
      const st = GAME.tick;
      for (const e of SH.query(a.x, a.y, a.r + 30)) {
        if (e.dead || e.hidden || e.isBuilding) continue;
        if (dist(e.x, e.y, a.x, a.y) > a.r + e.r * 0.5) continue;
        if (e.stormAt === st) continue;
        e.stormAt = st;
        dealDamage(a.src && !a.src.dead ? a.src : null, e, { dmg: 14, type: 'spell' }, 1);
      }
    }
    if (a.t < a.life) out.push(a);
  }
  GAME.areas = out;
}

// ---------------- 특수 능력 시전 ----------------
function castSpell(c, s, tgt, x, y) {
  const S = SPELLS[s];
  if (S.energy && c.energy < S.energy) { notify(c.owner, 'energy', '에너지가 부족합니다.', 'err'); return false; }
  if (S.energy) c.energy -= S.energy;
  c.attackAnim = 8;
  switch (s) {
    case 'storm':
      GAME.areas.push({ kind: 'storm', x, y, r: 48, t: 0, life: 68, src: c, owner: c.owner });
      SND.play('storm', x, y);
      break;
    case 'dark_swarm':
      GAME.areas.push({ kind: 'swarm', x, y, r: 80, t: 0, life: 700, owner: c.owner });
      fx('cast', c.x, c.y, { life: 12, color: '#aa8844' });
      break;
    case 'plague':
      for (const e of SH.query(x, y, 80)) {
        if (e.dead || e.hidden || dist(e.x, e.y, x, y) > 48 + e.r) continue;
        if (e.def.resource) continue;
        e.plagueT = 600; e.onAttacked(c);
      }
      fx('plaguefx', x, y, { life: 30 });
      break;
    case 'emp':
      GAME.projectiles.push({ kind: 'plasma', x: c.x, y: c.y, tx: x, ty: y, tgt: null, src: c, w: { dmg: 0, type: 'spell' }, t: 0, delay: 0, emp: true });
      for (const e of SH.query(x, y, 100)) {
        if (e.dead || e === c || dist(e.x, e.y, x, y) > 64 + e.r) continue;
        e.sh = 0; if (e.maxEnergy) e.energy = 0;
      }
      fx('empfx', x, y, { life: 20 });
      break;
    case 'irradiate':
      if (tgt) { tgt.irrT = 600; tgt.irrSrc = c; tgt.onAttacked(c); fx('cast', tgt.x, tgt.y, { life: 16, color: '#50ff50' }); }
      break;
    case 'defensive_matrix':
      if (tgt) { tgt.matrixHp = 250; tgt.matrixT = 1000; fx('cast', tgt.x, tgt.y, { life: 16, color: '#80c0ff' }); }
      break;
    case 'yamato':
      if (tgt) GAME.projectiles.push({ kind: 'yamato', x: c.x, y: c.y, tx: tgt.x, ty: tgt.y, tgt, src: c, w: c.def.gw, t: 0, delay: 20 });
      fx('cast', c.x, c.y, { life: 20, color: '#ff8020' });
      break;
    case 'lockdown':
      if (tgt && tgt.def.mech) GAME.projectiles.push({ kind: 'lock', x: c.x, y: c.y, tx: tgt.x, ty: tgt.y, tgt, src: c, w: c.def.gw, t: 0, delay: 0 });
      else notify(c.owner, 'mech', '기계 유닛에게만 사용할 수 있습니다.', 'err');
      break;
    case 'restoration':
      if (tgt) { tgt.irrT = 0; tgt.plagueT = 0; tgt.lockT = 0; tgt.ensnareT = 0; fx('cast', tgt.x, tgt.y, { life: 12, color: '#ffffff' }); }
      break;
    case 'consume':
      if (tgt && tgt.owner === c.owner && tgt.race === 'Z' && !tgt.isBuilding && tgt !== c) { killEntity(tgt, null); c.energy = Math.min(c.maxEnergy, c.energy + 50); }
      break;
    case 'scan':
      GAME.areas.push({ kind: 'scan', x, y, r: 10 * TILE, t: 0, life: 262, owner: c.owner });
      SND.play('scan', x, y);
      break;
  }
  return true;
}
