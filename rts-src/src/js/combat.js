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
  yamato: { speed: 9, color: '#ff8020' }, lock: { speed: 9, color: '#80ff80' }, scarab: { speed: 16, color: '#ffe090' },
};

function fireWeapon(src, t, w) {
  const from = src.inside || src;
  const hits = src.type === 'carrier' ? src.ammo : (w.hits || 1);
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
    if (w.splash) splashDamage(src, t.x, t.y, w, src, !!w.friendly, !!t.airTarget, t);
    else dealDamage(src, t, w, 1);
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
    pr.primary = t;
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
    if (w.splash && !miss) splashAround(src, t, w);
    return;
  }
  if (w.fx === 'gun') { fx('muzzle', from.x + Math.cos(ang) * 9, from.y + Math.sin(ang) * 9 - 3, { life: 3, ang, size: 0.6 }); fx('hitspark', t.x + (Math.random() - 0.5) * t.r, t.y + (Math.random() - 0.5) * t.r, { life: 6, miss }); }
  else if (w.fx === 'laser') { fx('beam', from.x, from.y, { life: 5, x2: t.x, y2: t.y, color: src.race === 'P' ? '#ffd040' : '#ff5050' }); }
  else fx('slash', t.x, t.y, { life: 6, race: src.race });
  for (let k = 0; k < hits; k++) dealDamage(src, t, w, 1, miss);
  if (w.splash && !miss) splashAround(src, t, w);
}

function underWeb(t) { return GAME.areas.some(a => a.kind === 'web' && dist(a.x, a.y, t.x, t.y) <= a.r); }

function underSwarm(t) {
  for (const a of GAME.areas) if (a.kind === 'swarm' && dist(a.x, a.y, t.x, t.y) <= a.r) return true;
  return false;
}

function addAcidSpore(e) {
  if (!e.acidTimers) {
    e.acidTimers = new Array(9).fill(0);
    for (let i = 0; i < (e.acidSpores || 0); i++) e.acidTimers[i] = e.acidT || 1200;
  }
  let oldest = 0;
  for (let i = 1; i < 9; i++) if (e.acidTimers[i] < e.acidTimers[oldest]) oldest = i;
  e.acidTimers[oldest] = 1200;
  e.acidSpores = e.acidTimers.filter(t => t > 0).length; e.acidT = 1200;
}

// 피해 적용 (원작 공식: 보호막 → 방어력 차감 → 크기 보정, 최소 0.5)
function dealDamage(src, t, w, mult, miss) {
  if (!t || t.dead || t.hidden || t.stasisT > 0) return;
  if (src && src.hallucination) return;
  if (miss) { fx('miss', t.x, t.y - 6, { life: 10 }); return; }
  let dmg = (src ? src.weaponDmg(w) : w.dmg) * (mult ?? 1);
  const spell = w.type === 'spell';
  if (t.hallucination) dmg *= 2;
  if (dmg <= 0) return;
  dmg = Math.max(.5, dmg + (t.acidSpores || 0));
  if (t.matrixHp > 0) {
    const a = Math.min(t.matrixHp, dmg); t.matrixHp -= a; dmg -= a;
    fx('matrixhit', t.x, t.y, { life: 6 });
  }
  let shieldDamage = 0;
  if (t.sh >= 1) {
    if (!spell) dmg = dmg > t.shArmor ? dmg - t.shArmor : .5;
    shieldDamage = Math.min(t.sh, dmg); t.sh -= shieldDamage; dmg -= shieldDamage;
    if (shieldDamage) fx('shield', t.x, t.y, { life: 6, r: t.r });
  }
  const size = t.isBuilding ? 'large' : t.def.size;
  let hd = spell ? dmg : Math.max(0, dmg - t.armor) * DMG_MULT[w.type][size];
  // The HP floor applies only if this hit did not deal shield damage.
  if (!shieldDamage) hd = Math.max(.5, hd);
  if (hd > 0) {
    t.hitT = 3;
    t.takeRaw(hd, src);
  }
  if (!t.dead && !w.noRetaliate) t.onAttacked(src);
}

function splashAround(src, t, w) {
  const r = w.splash;
  for (const e of SH.query(t.x, t.y, r[2] + 96)) {
    if (e === t || e === src || e.dead || e.hidden || e.def.resource || (!w.splashBoth && !!e.airTarget !== !!t.airTarget)) continue;
    if (!isEnemy(src.owner, e.owner)) continue;
    const d = edgeDistPt(e, t.x, t.y);
    const m = !w.airSplash && d <= r[0] ? 1 : e.burrowed ? 0 : d <= r[1] ? 0.5 : d <= r[2] ? 0.25 : 0;
    if (m) for (let k = 0; k < (w.hits || 1); k++) dealDamage(src, e, w, m);
  }
}

// 지점 스플래시 (시즈 탱크 / 마인 / 커세어)
function splashDamage(src, x, y, w, attacker, friendly, air, primary = null) {
  const r = w.splash;
  for (const e of SH.query(x, y, r[2] + 96)) {
    if (e.dead || e.hidden || e === attacker) continue;
    if (!!e.airTarget !== !!air) continue;
    if (e.def.resource) continue;
    if (!friendly && e !== primary && !isEnemy(attacker.owner, e.owner)) continue;
    const d = edgeDistPt(e, x, y);
    const m = (air && e === primary) || (!air && d <= r[0]) ? (d <= r[2] ? 1 : 0) : e.burrowed ? 0 : d <= r[1] ? .5 : d <= r[2] ? .25 : 0;
    if (m) for (let k = 0; k < (w.hits || 1); k++) dealDamage(src || attacker, e, w, m);
  }
}

function lurkerSpines(src, t, w) {
  const ang = Math.atan2(t.y - src.y, t.x - src.x);
  const len = src.range(w) + 16;
  const x1 = src.x + Math.cos(ang) * len, y1 = src.y + Math.sin(ang) * len;
  fx('spines', src.x, src.y, { life: 16, ang, len });
  for (const e of SH.query((src.x + x1) / 2, (src.y + y1) / 2, len / 2 + 96)) {
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
  const out = [], current = GAME.projectiles;
  GAME.projectiles = out;
  for (const p of current) {
    p.t++;
    if (p.delay > 0) { p.delay--; if (p.kind === 'interceptor' && p.src && !p.src.dead) { p.x = p.src.x; p.y = p.src.y; } out.push(p); continue; }
    const def = PROJ[p.kind] || { speed: 10 };
    if (p.kind === 'tentacle') {
      if (p.tgt === null) { const tt = p.primary && !p.primary.dead && !p.primary.hidden && edgeDistPt(p.primary, p.tx, p.ty) < 6 ? p.primary : findUnitAt(p.tx, p.ty, p.src); if (tt) dealDamage(p.src, tt, p.w, 1, p.miss); }
      continue;
    }
    if (p.tgt && !p.tgt.dead && !p.tgt.hidden) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    let spd = def.speed;
    if (p.kind === 'scarab') {
      // OpenBW ScarabAttack: ground pursuit, seven initial no-collision frames, 90-frame lifetime.
      if (p.t > 90 || !p.tgt || p.tgt.dead || p.tgt.hidden) continue;
      if (edgeDistPt(p.tgt, p.x, p.y) <= 10) { onProjectileHit(p); continue; }
      const near = p.t <= 7 ? [] : SH.queryGround(p.x, p.y, 200).filter(e => e !== p.src && e !== p.tgt);
      const ignore = p.tgt.isBuilding ? p.tgt.id : 0;
      const clear = (x, y) => PF.lineClear(p.x, p.y, x, y, 3, ignore) && PF.unitsClear(p.x, p.y, x, y, 3, near);
      let x = p.tx, y = p.ty;
      if (!clear(x, y)) {
        if (!p.path || !p.path.length || p.t >= p.repathAt) {
          p.path = PF.localPath(p.x, p.y, x, y, 3, {units:near,cells:new Set()}, null);
          p.repathAt = p.t + 12;
        }
        while (p.path?.length && dist(p.x,p.y,p.path[0][0],p.path[0][1]) < .01) p.path.shift();
        if (!p.path?.length) { out.push(p); continue; }
        [x, y] = p.path[0];
      } else p.path = null;
      const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx,dy), step = Math.min(spd,d);
      const nx = p.x + dx / (d || 1) * step, ny = p.y + dy / (d || 1) * step;
      if (clear(nx, ny)) { p.x=nx; p.y=ny; p.dir=Math.atan2(dy,dx); } else p.path=null;
      out.push(p); continue;
    }
    if (p.kind === 'interceptor') {
      // 캐리어 인터셉터: 궤도를 돌며 공격 후 복귀
      p.ang += 0.25;
      const ox = Math.cos(p.ang) * 18, oy = Math.sin(p.ang) * 18;
      const dx = p.tx + ox - p.x, dy = p.ty + oy - p.y, d = Math.hypot(dx, dy);
      if (!p.src || p.src.dead || !p.tgt || p.tgt.dead || p.tgt.hidden) continue;
      if (d < 20 && !p.fired) {
        p.fired = true;
        if (p.tgt && !p.tgt.dead) { dealDamage(p.src, p.tgt, p.w, 1, p.miss); fx('beam', p.x, p.y, { life: 3, x2: p.tgt.x, y2: p.tgt.y, color: '#ffe000' }); }
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
  const w = p.w, src = p.src || null;
  if (p.emp) {
    for (const e of SH.query(p.x, p.y, 100)) if (!e.dead && !e.hidden && e !== p.src && !(e.stasisT > 0) && dist(e.x, e.y, p.x, p.y) <= 64 + e.r) { e.sh = 0; e.energy = 0; }
    fx('empfx', p.x, p.y, { life: 20 }); return;
  }
  switch (p.kind) {
    case 'siege':
      fx('explode', p.x, p.y, { life: 14, size: 1.2 });
      if (!p.miss) splashDamage(src, p.x, p.y, w, p.src, true, false, p.primary); else fx('miss', p.x, p.y, { life: 10 });
      SND.play('boom', p.x, p.y);
      return;
    case 'neutron':
      fx('explode', p.x, p.y, { life: 8, size: 0.5, color: '#60ffff' });
      if (!p.miss && p.tgt && !p.tgt.dead) splashDamage(src, p.x, p.y, w, p.src, false, true, p.tgt);
      return;
    case 'scarab':
      if (p.src && !p.miss) splashDamage(src, p.x, p.y, w, p.src, false, false, p.tgt);
      fx('explode', p.x, p.y, { life: 12, size: 1 }); return;
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
      if (w.splash && !p.miss) splashAround(p.src || t, t, w);
      if (w.acid && !p.miss) for (const e of SH.query(t.x, t.y, 80)) {
        if (!e.dead && !e.hidden && !(e.stasisT > 0) && e.airTarget && (e === t || isEnemy(p.src.owner, e.owner)) && dist(e.x, e.y, t.x, t.y) <= 48 + e.r) addAcidSpore(e);
      }
    }
  }
}

// ---------------- 지속 효과 영역 ----------------
function updateAreas() {
  const out = [];
  for (const a of GAME.areas) {
    a.t++;
    if (a.kind === 'nuke') {
      if (a.t <= 320 && (!a.src || a.src.dead || a.src.lockT > 0 || a.src.stasisT > 0 || a.src.maelstromT > 0 || !a.src.orders[0] || a.src.orders[0].t !== 'nuke')) continue;
      if (a.t === 320) a.src.nextOrder();
      if (a.t === a.life) {
        for (const e of SH.query(a.x, a.y, 352)) {
          if (e.dead || e.hidden || e.def.resource || e.stasisT > 0) continue;
          const d = edgeDistPt(e, a.x, a.y), mult = d <= 128 ? 1 : d <= 192 ? 0.5 : d <= 256 ? 0.25 : 0;
          if (mult) dealDamage(a.src || null, e, { dmg: Math.max(500, (e.maxHp + e.maxSh) * 2 / 3), type: 'explosive' }, mult);
        }
        fx('explode', a.x, a.y, { life: 48, size: 6 }); SND.play('bigboom', a.x, a.y);
      }
    }
    if (a.kind === 'storm' && a.t % 8 === 0) {
      const st = GAME.tick;
      for (const e of SH.query(a.x, a.y, a.r + 30)) {
        if (e.dead || e.hidden || e.isBuilding) continue;
        if (dist(e.x, e.y, a.x, a.y) > a.r + e.r * 0.5) continue;
        if ((e.stormNextAt || 0) > st) continue;
        e.stormNextAt = st + 8;
        dealDamage(a.src || null, e, { dmg: 14, type: 'spell' }, 1);
      }
    }
    if (a.t < a.life) out.push(a);
  }
  GAME.areas = out;
}

// ---------------- 특수 능력 시전 ----------------
function castSpell(c, s, tgt, x, y) {
  const S = SPELLS[s];
  if (!S || c.dead || c.hidden || c.hallucination || c.lockT > 0 || c.stasisT > 0 || c.maelstromT > 0 || !(c.def.spells || []).includes(s) || !spellTechOk(c, s)) return false;
  if (S.target === 'unit' && (!tgt || tgt.dead || tgt.hidden || tgt.stasisT > 0 || !targetableBy(tgt, c.owner))) return false;
  if (S.target === 'point' && (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= MAP_W * TILE || y >= MAP_H * TILE)) return false;
  if (s === 'lockdown' && (!tgt.def.mech || tgt.isBuilding)) return false;
  if (s === 'consume' && (tgt === c || tgt.owner !== c.owner || tgt.race !== 'Z' || tgt.isBuilding)) return false;
  if (s === 'feedback' && (!tgt.maxEnergy || tgt.isBuilding)) return false;
  if (s === 'mind_control' && (!isEnemy(c.owner, tgt.owner) || tgt.isBuilding || tgt.type === 'larva' || tgt.type === 'egg')) return false;
  if (s === 'spawn_broodlings' && (tgt.isBuilding || tgt.airTarget || ['probe', 'reaver', 'archon', 'dark_archon', 'spider_mine'].includes(tgt.type))) return false;
  if (['optic_flare','parasite','hallucination'].includes(s) && (tgt.isBuilding || tgt.type === 'larva' || tgt.type === 'egg')) return false;
  if (s === 'recharge' && (tgt.owner !== c.owner || !tgt.maxSh || tgt.isBuilding || tgt.hallucination)) return false;
  let silo;
  if (s === 'nuclear_strike') {
    silo = GAME.entities.find(b => !b.dead && b.owner === c.owner && b.type === 'nuclear_silo' && b.nukeReady && hasBuilding(c.owner, 'nuclear_silo') && GAME.entities.some(cc => !cc.dead && !cc.lifted && cc.owner === c.owner && attachedAddon(cc, 'nuclear_silo') === b));
    if (!silo) return false;
  }
  if (s === 'infest' && (tgt.type !== 'cc' || !tgt.done || tgt.lifted || !isEnemy(c.owner, tgt.owner) || tgt.hp > tgt.maxHp / 2 || tgt.cargo.length)) return false;
  const tx = tgt ? tgt.x : x, ty = tgt ? tgt.y : y;
  if (S.range && dist(c.x, c.y, tx, ty) > S.range * TILE + (tgt ? tgt.r : 0) + c.r) return false;
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
        if (e.def.resource || e.stasisT > 0) continue;
        e.plagueT = 600; e.onAttacked(c);
      }
      fx('plaguefx', x, y, { life: 30 });
      break;
    case 'emp':
      GAME.projectiles.push({ kind: 'plasma', x: c.x, y: c.y, tx: x, ty: y, tgt: null, src: c, w: { dmg: 0, type: 'spell' }, t: 0, delay: 0, emp: true });
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
      if (tgt) { tgt.irrT = 0; tgt.plagueT = 0; tgt.lockT = 0; tgt.ensnareT = 0; tgt.blinded = false; tgt.parasiteOwner = undefined; tgt.acidSpores = 0; tgt.acidT = 0; tgt.acidTimers = null; fx('cast', tgt.x, tgt.y, { life: 12, color: '#ffffff' }); }
      break;
    case 'consume':
      if (tgt && tgt.owner === c.owner && tgt.race === 'Z' && !tgt.isBuilding && tgt !== c) { killEntity(tgt, null); c.energy = Math.min(c.maxEnergy, c.energy + 50); }
      break;
    case 'scan':
      GAME.areas.push({ kind: 'scan', x, y, r: 10 * TILE, t: 0, life: 262, owner: c.owner });
      SND.play('scan', x, y);
      break;
    case 'parasite': tgt.parasiteOwner = c.owner; break;
    case 'optic_flare': tgt.blinded = true; tgt.detCache = null; break;
    case 'recharge': tgt.issue({ t: 'recharge', tgt: c }); break;
    case 'hallucination':
      for (let k = 0; k < 2; k++) { const h = createUnit(tgt.type, c.owner, tgt.x + (k ? 16 : -16), tgt.y); h.hallucination = true; h.energy = 0; h.lifeT = 1800; h.ammo = tgt.ammo; }
      break;
    case 'nuclear_strike':
      silo.nukeReady = false; c.issue({ t: 'nuke' });
      GAME.areas.push({ kind: 'nuke', x, y, r: 256, t: 0, life: 360, src: c, owner: c.owner });
      if (typeof UI !== 'undefined') UI.message('핵 공격이 감지되었습니다!'); break;
    case 'ensnare':
    case 'maelstrom':
    case 'stasis':
      for (const e of SH.query(x, y, 100)) {
        if (e.dead || e.hidden || e.isBuilding || e === c || e.stasisT > 0 || dist(e.x, e.y, x, y) > 48 + e.r) continue;
        if (s === 'ensnare') { e.ensnareT = 900; e.detCache = null; }
        else if (s === 'stasis') { e.stasisT = 900; e.vx = e.vy = 0; }
        else if (e.def.bio) { e.maelstromT = 180; e.vx = e.vy = 0; }
      }
      fx('cast', x, y, { life: 20, color: s === 'ensnare' ? '#20dd60' : '#6080ff' }); break;
    case 'spawn_broodlings': {
      const bx = tgt.x, by = tgt.y; killEntity(tgt, c);
      for (let k = 0; k < 2; k++) { const b = createUnit('broodling', c.owner, bx + (k ? 8 : -8), by); b.lifeT = 1800; }
      break;
    }
    case 'infest':
      for (const q of tgt.queue) if (q.kind === 'tech') delete P(tgt.owner).researching[q.type];
      tgt.queue = []; tgt.owner = c.owner; SH.ownerChanged(tgt); tgt.type = 'infested_cc'; tgt.def = BUILDINGS.infested_cc; tgt.race = 'Z'; tgt.hp = tgt.maxHp; tgt.orders = []; break;
    case 'feedback': { const dmg = tgt.energy; tgt.energy = 0; dealDamage(c, tgt, { dmg, type: 'spell' }, 1); break; }
    case 'mind_control':
      tgt.owner = c.owner; SH.ownerChanged(tgt); tgt.issue({ t: 'stop' }); tgt.detCache = null; tgt.parasiteOwner = undefined; c.sh = 0; recomputeSupply(); break;
    case 'disruption_web': GAME.areas.push({ kind: 'web', x, y, r: 64, t: 0, life: 360, owner: c.owner }); break;
    case 'recall':
      for (const e of [...GAME.entities]) {
        if (e.dead || e.hidden || e.isBuilding || e === c || e.owner !== c.owner || e.stasisT > 0 || dist(e.x, e.y, x, y) > 64) continue;
        const spot = e.airTarget ? [c.x + Math.random() * 32 - 16, c.y + Math.random() * 32 - 16] : findUnloadSpot(c, e);
        if (spot) { e.x = spot[0]; e.y = spot[1]; e.issue({ t: 'stop' }); }
      }
      break;
  }
  return true;
}
