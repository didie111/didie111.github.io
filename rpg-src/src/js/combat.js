/* =========================================================
   COMBAT : 스킬 / 데미지 / 몬스터 AI / 보스 / 드랍 / 성장
   ========================================================= */

function skillById(id) { return SKILLS.find(s => s.id === id); }

function useSkill(id) {
  const p = S.player;
  if (p.dead) return;
  const sk = skillById(id);
  if (!sk) return;
  if ((p.cds[id] || 0) > 0) return;
  if (p.mp < sk.mp) { UI.toast('MP가 부족합니다!', 'warn'); return; }
  p.mp -= sk.mp;
  p.cds[id] = sk.cd;
  p.anim.atk = sk.anim || 0.34;
  p.anim.atkDur = sk.anim || 0.34;

  switch (sk.kind) {
    case 'heal': castHeal(p, sk); break;
    case 'buff': castBuff(p, sk); break;
    case 'aoe': castThunder(p, sk); break;
    case 'bolt': castBolt(p, sk); break;
    case 'arrow': castArrow(p, sk); break;
    default: castMelee(p, sk); break;
  }
  UI.refreshHud();
}

/* ---------- 전사: 근접 ---------- */
function castMelee(p, sk) {
  SFX.swing();
  const delay = (sk.anim || 0.34) * 0.32;
  setTimeout(() => {
    if (p.dead) return;
    spawnFx(sk.fx || 'slash', p.x + p.facing * 26, p.y - 44, { flip: p.facing });
    if (sk.both) spawnFx(sk.fx || 'slash', p.x - p.facing * 26, p.y - 44, { flip: -p.facing });
    const maxHits = sk.hits || 6;
    const x0 = sk.both ? p.x - sk.range : (p.facing > 0 ? p.x : p.x - sk.range);
    const x1 = sk.both ? p.x + sk.range : (p.facing > 0 ? p.x + sk.range : p.x);
    let hits = 0;
    S.monsters.forEach(m => {
      if (m.dead || hits >= maxHits) return;
      if (m.x + m.w / 2 > x0 && m.x - m.w / 2 < x1 && Math.abs((m.y - m.h / 2) - (p.y - 40)) < 84) {
        dealDamage(m, sk.dmg);
        hits++;
      }
    });
    UI.refreshHud();
  }, delay * 1000);
}

/* ---------- 궁수: 활 ---------- */
function castArrow(p, sk) {
  SFX.draw();
  const delay = (sk.anim || 0.4) * 0.45;
  setTimeout(() => {
    if (p.dead) return;
    SFX.release();
    const n = sk.arrows || 1;
    const spread = sk.spread || 0;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      spawnArrow(p, sk, a);
    }
    spawnFx('shootSpark', p.x + p.facing * 34, p.y - 46, { flip: p.facing });
  }, delay * 1000);
}

function spawnArrow(p, sk, angleDeg) {
  const big = sk.dmg > 2;
  const col = big ? '#ffd36b' : '#c9a06a';
  const g = gFromHTML(`<g>
    <ellipse cx="-16" cy="0" rx="20" ry="${big ? 5 : 3}" fill="${col}" opacity="0.3"/>
    <rect x="-18" y="-1.6" width="34" height="3.2" rx="1.6" fill="${col}"/>
    <path d="M16 0 l -8 -5.5 l 0 11 z" fill="#eef1ff"/>
    <path d="M-18 0 l 7 -5 l 0 10 z" fill="#ff8f6b"/>
  </g>`);
  LAYERS.fxLayer.appendChild(g);
  const rad = (angleDeg || 0) * Math.PI / 180;
  const spd = 880;
  S.projs.push({
    node: g, x: p.x + p.facing * 30, y: p.y - 46,
    vx: p.facing * spd * Math.cos(rad), vy: spd * Math.sin(rad) * 0.55,
    life: 1.2, dmg: sk.dmg, from: 'player', pierce: !!sk.pierce, hitIds: [],
    spin: true, facing: p.facing,
  });
}

/* ---------- 마법사: 마력탄 ---------- */
function castBolt(p, sk) {
  SFX.cast();
  const delay = (sk.anim || 0.42) * 0.5;
  setTimeout(() => {
    if (p.dead) return;
    const fire = sk.proj === 'fire';
    const g = gFromHTML(fire ? `<g>
        <circle r="26" fill="url(#glowR)"/>
        <circle r="12" fill="#ffb347"/><circle r="6.5" fill="#fff3c4"/>
        <path class="tail" d="M-10 0 q -18 -7 -30 0 q 18 7 30 0 z" fill="#ff8b3d" opacity="0.75"/>
      </g>` : `<g>
        <circle r="22" fill="url(#glowB)"/>
        <circle r="9" fill="#9fd8ff"/><circle r="4.5" fill="#ffffff"/>
        <path class="tail" d="M-8 0 q -16 -6 -26 0 q 16 6 26 0 z" fill="#6fb8ff" opacity="0.7"/>
      </g>`);
    LAYERS.fxLayer.appendChild(g);
    S.projs.push({
      node: g, x: p.x + p.facing * 26, y: p.y - 44, vx: p.facing * (fire ? 620 : 700), vy: 0,
      life: 1.6, dmg: sk.dmg, from: 'player', pierce: !!sk.pierce, hitIds: [], magic: true, facing: p.facing, r: 20,
    });
    spawnFx('castRune', p.x + p.facing * 30, p.y - 50, { flip: p.facing, fire });
  }, delay * 1000);
}

function castThunder(p, sk) {
  SFX.cast();
  spawnFx('castRune', p.x, p.y - 50, {});
  const targets = S.monsters.filter(m => !m.dead && Math.abs(m.x - p.x) < sk.range && Math.abs(m.y - p.y) < 260);
  for (let h = 0; h < (sk.hits || 3); h++) {
    setTimeout(() => {
      targets.forEach(m => {
        if (m.dead) return;
        spawnFx('thunder', m.x, m.y);
        dealDamage(m, sk.dmg * 0.85);
      });
      SFX.hit();
    }, 150 + h * 140);
  }
}

function castHeal(p, sk) {
  const amt = Math.round(p.maxHp * sk.heal);
  p.hp = Math.min(p.maxHp, p.hp + amt);
  spawnFx('heal', p.x, p.y);
  damageText(p.x, p.y - 90, '+' + amt, 'heal');
  SFX.buff();
}

function castBuff(p, sk) {
  p.buff = { ...sk.buff, t: sk.buff.dur };
  refreshStats(p);
  spawnFx('buff', p.x, p.y);
  damageText(p.x, p.y - 96, sk.name + '!', 'heal');
  SFX.buff();
  UI.toast(sk.name + ' 발동! (' + sk.buff.dur + '초)', 'gold');
}

function dealDamage(mon, mul, forceNoCrit) {
  const p = S.player;
  const st = stats(p);
  const crit = !forceNoCrit && Math.random() < st.crit;
  const variance = 0.85 + Math.random() * 0.3;
  let dmg = Math.max(1, Math.round((st.atk * mul * variance) - mon.def.def * 0.6));
  if (crit) dmg = Math.round(dmg * 1.9);
  mon.hp -= dmg;
  mon.hurt = 0.12;
  mon.aggro = 6;
  if (!mon.boss) { mon.vx = (mon.x < p.x ? -1 : 1) * 90; if (mon.onGround) mon.vy = -160; }
  damageText(mon.x + (Math.random() - .5) * 20, mon.y - mon.h - 10, dmg, crit ? 'crit' : 'normal');
  if (crit) SFX.crit(); else SFX.hit();
  spawnFx('hit', mon.x, mon.y - mon.h / 2);
  if (mon.boss) UI.updateBossBar(mon);
  if (mon.hp <= 0) killMonster(mon);
}

/* ---------------- 몬스터 사망 ---------------- */
function killMonster(mon) {
  if (mon.dead) return;
  mon.dead = true;
  const p = S.player;
  spawnFx('die', mon.x, mon.y);
  if (mon.boss) spawnFx('boom', mon.x, mon.y - 60);
  mon.node.style.transition = 'opacity .35s, transform .35s';
  mon.node.style.opacity = 0;
  setTimeout(() => mon.node.remove(), 400);

  gainExp(mon.def.exp);
  const meso = Math.floor(mon.def.meso[0] + Math.random() * (mon.def.meso[1] - mon.def.meso[0]));
  spawnDrop({ meso }, mon.x, mon.y - 20);
  (mon.def.drops || []).forEach(d => {
    if (Math.random() > d.p) return;
    if (d.equip) spawnDrop({ equip: makeEquip(d.equip) }, mon.x + (Math.random() - .5) * 60, mon.y - 20);
    else spawnDrop({ itemId: d.item }, mon.x + (Math.random() - .5) * 60, mon.y - 20);
  });

  S.killCount[mon.type] = (S.killCount[mon.type] || 0) + 1;
  progressQuest(mon.type);
  if (mon.boss) {
    UI.hideBossBar();
    UI.toast('★ 보스 ' + mon.name + ' 격파! ★', 'gold');
    S.boss = null;
  }
  // 리스폰
  const delay = mon.boss ? 60000 : 6000 + Math.random() * 4000;
  const type = mon.type;
  const mapId = S.mapId;
  setTimeout(() => {
    if (S.mapId === mapId && S.running) spawnMonster(type, mon.boss ? S.map.w / 2 : undefined, mon.boss ? S.map.groundY : undefined);
  }, delay);
  setTimeout(() => {
    const i = S.monsters.indexOf(mon);
    if (i >= 0) S.monsters.splice(i, 1);
  }, 400);
}

/* ---------------- 드랍 ---------------- */
function spawnDrop(payload, x, y) {
  let art, label, color;
  if (payload.meso) { art = 'meso'; label = payload.meso + ' 메소'; }
  else if (payload.equip) { art = payload.equip.art; color = payload.equip.color; label = payload.equip.name; }
  else {
    const def = CONSUMABLES[payload.itemId] || ETC_ITEMS[payload.itemId];
    art = def.art; label = def.name;
  }
  const g = gFromHTML(`<g><g class="ic" transform="translate(-14,-28) scale(0.7)">${Art.icon(art, color)}</g>
    <ellipse cx="0" cy="2" rx="10" ry="3" fill="#000" opacity="0.3"/></g>`);
  LAYERS.itemLayer.appendChild(g);
  S.drops.push({
    ...payload, node: g, x, y, vx: (Math.random() - .5) * 150, vy: -260 - Math.random() * 120,
    life: 45, label, t: 0, landed: false,
  });
}

function updateDrops(dt) {
  const m = S.map;
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const d = S.drops[i];
    d.t += dt; d.life -= dt;
    if (!d.landed) {
      d.vy += GAME.GRAVITY * 0.6 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= 0.99;
      if (d.y >= m.groundY) { d.y = m.groundY; d.landed = true; }
      for (const p of m.platforms) {
        if (d.x > p.x && d.x < p.x + p.w && d.y >= p.y && d.y - d.vy * dt <= p.y + 4 && d.vy > 0) { d.y = p.y; d.landed = true; }
      }
    }
    const bob = d.landed ? Math.sin(d.t * 5) * 3 : 0;
    d.node.setAttribute('transform', `translate(${d.x.toFixed(1)},${(d.y + bob).toFixed(1)})`);
    d.node.style.opacity = d.life < 5 ? (Math.sin(d.life * 12) > 0 ? 0.3 : 1) : 1;
    // 메소 자동 획득
    if (d.meso && d.landed && Math.abs(d.x - S.player.x) < 34 && Math.abs(d.y - S.player.y) < 60) { pickup(d, i); continue; }
    if (d.life <= 0) { d.node.remove(); S.drops.splice(i, 1); }
  }
}

function pickupNear() {
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const d = S.drops[i];
    if (Math.abs(d.x - S.player.x) < 60 && Math.abs(d.y - S.player.y) < 80) { pickup(d, i); return; }
  }
}

function pickup(d, i) {
  const p = S.player;
  if (d.meso) {
    p.meso += d.meso;
    damageText(p.x, p.y - 100, '+' + d.meso + ' 메소', 'meso');
  } else if (d.equip) {
    if (p.inv.equip.length >= 30) { UI.toast('장비 인벤토리가 가득 찼습니다!', 'warn'); return; }
    p.inv.equip.push(d.equip);
    UI.toast('획득: ' + d.equip.name, 'gold');
  } else {
    const def = CONSUMABLES[d.itemId] || ETC_ITEMS[d.itemId];
    const bag = def.type === 'use' ? p.inv.use : p.inv.etc;
    const ex = bag.find(x => x.id === def.id);
    if (ex) ex.qty++;
    else {
      if (bag.length >= 30) { UI.toast('인벤토리가 가득 찼습니다!', 'warn'); return; }
      bag.push({ ...def, qty: 1 });
    }
    UI.toast('획득: ' + def.name);
  }
  SFX.pick();
  d.node.remove(); S.drops.splice(i, 1);
  UI.refreshHud(); UI.renderInv();
}

/* ---------------- 성장 ---------------- */
function gainExp(v) {
  const p = S.player;
  p.exp += v;
  damageText(p.x, p.y - 120, '+' + v + ' EXP', 'exp');
  let need = expNeeded(p.level);
  while (p.exp >= need && p.level < 200) {
    p.exp -= need;
    p.level++;
    p.ap += 5; p.sp += 1;
    refreshStats(p, true);
    spawnFx('levelup', p.x, p.y);
    SFX.level();
    UI.levelUpFx();
    UI.toast('레벨 업! Lv.' + p.level + ' (AP +5)', 'gold');
    need = expNeeded(p.level);
  }
  UI.refreshHud();
}

/* ---------------- 퀘스트 ---------------- */
function progressQuest(type) {
  const p = S.player;
  QUESTS.forEach(q => {
    if (q.kill !== type) return;
    if (q.reqLv && p.level < q.reqLv) return;
    const st = p.quests[q.id] || (p.quests[q.id] = { n: 0, done: false });
    if (st.done) return;
    st.n++;
    if (st.n >= q.need) {
      st.done = true;
      p.meso += q.meso;
      gainExp(q.exp);
      UI.toast('퀘스트 완료: ' + q.name + ' (+' + q.meso + ' 메소)', 'gold');
    }
    UI.renderQuests();
  });
}

/* ---------------- 플레이어 피해 ---------------- */
function hurtPlayer(amount, fromX) {
  const p = S.player;
  if (p.invuln > 0 || p.dead) return;
  const st = stats(p);
  const dmg = Math.max(1, Math.round(amount * (1 - st.def / (st.def + 180))));
  p.hp -= dmg;
  p.invuln = 0.9;
  p.anim.hurt = 0.9;
  p.vx = (p.x < fromX ? -1 : 1) * 260;
  p.vy = -300;
  damageText(p.x, p.y - 96, dmg, 'player');
  SFX.hurt();
  UI.refreshHud();
  if (p.hp <= 0) playerDie();
}

function playerDie() {
  const p = S.player;
  p.hp = 0; p.dead = true;
  SFX.die();
  const lost = Math.floor(p.exp * 0.1);
  p.exp = Math.max(0, p.exp - lost);
  UI.showDeath(lost);
}

function revivePlayer() {
  const p = S.player;
  p.dead = false;
  refreshStats(p, true);
  p.invuln = 2;
  loadMap('town', 200);
  UI.hideDeath();
  UI.refreshHud();
}

/* ---------------- 몬스터 AI ---------------- */
function updateMonsters(dt) {
  const p = S.player;
  for (const m of S.monsters) {
    if (m.dead) continue;
    m.aiT -= dt;
    if (m.aggro > 0) m.aggro -= dt;
    if (m.hitCd > 0) m.hitCd -= dt;
    const dx = p.x - m.x, dist = Math.abs(dx), dy = Math.abs(p.y - m.y);
    const chase = !p.dead && (dist < m.def.sight && dy < 160 || m.aggro > 0);

    if (m.boss) { bossAI(m, dt, dx, dist); }
    else if (chase) {
      m.facing = dx > 0 ? 1 : -1;
      m.vx = m.facing * m.def.spd * 1.25;
      if (m.def.jumpy && m.onGround && Math.random() < dt * 1.6) m.vy = -520;
      if (!m.def.flying && m.onGround && p.y < m.y - 50 && Math.random() < dt * 2.2) m.vy = -640;
    } else {
      if (m.aiT <= 0) { m.aiT = 1.2 + Math.random() * 2.4; m.dir = Math.random() < 0.35 ? 0 : (Math.random() < .5 ? -1 : 1); }
      m.vx = m.dir * m.def.spd * 0.55;
      if (m.dir !== 0) m.facing = m.dir;
      if (Math.abs(m.x - m.home) > 420) { m.dir = m.x > m.home ? -1 : 1; m.facing = m.dir; }
    }

    if (m.def.flying) {
      m.x += m.vx * dt;
      const targetY = chase ? p.y - 60 : S.map.groundY - 180;
      m.y += clamp((targetY - m.y), -120, 120) * dt * 1.6;
      m.x = clamp(m.x, 30, S.map.w - 30);
    } else {
      physics(m, dt);
      m.vx *= m.onGround ? 0.86 : 0.98;
    }

    // 접촉 데미지
    if (!p.dead && m.hitCd <= 0 && Math.abs(m.x - p.x) < (m.w / 2 + p.w / 2) && Math.abs(m.y - p.y) < Math.max(m.h, p.h) * 0.8) {
      hurtPlayer(m.def.atk * (m.boss ? 1.1 : 1), m.x);
      m.hitCd = 1.1;
    }
    animateMonster(m, dt);
  }
}

/* ---------------- 보스 AI ---------------- */
function bossAI(m, dt, dx, dist) {
  const p = S.player;
  m.castCd -= dt;
  const ratio = m.hp / m.maxHp;
  const newPhase = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
  if (newPhase !== m.phase) {
    m.phase = newPhase;
    UI.toast('발록이 분노합니다! (페이즈 ' + newPhase + ')', 'warn');
    spawnFx('boom', m.x, m.y - 80);
    for (let i = 0; i < 2; i++) spawnMonster('bat', m.x + (i ? 160 : -160), m.y - 100);
  }
  m.facing = dx > 0 ? 1 : -1;

  if (m.castCd <= 0) {
    const roll = Math.random();
    if (roll < 0.4 || dist > 420) {
      // 파이어볼 연발
      m.atkAnim = 1;
      const n = 2 + m.phase;
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          if (m.dead || S.mapId !== 'lair') return;
          const ang = Math.atan2((p.y - 50) - (m.y - 110), p.x - m.x) + (Math.random() - .5) * 0.24;
          spawnFireball(m.x + m.facing * 70, m.y - 110, Math.cos(ang) * 430, Math.sin(ang) * 430, m.def.atk * 0.8);
        }, i * 260);
      }
      m.castCd = 3.6 - m.phase * 0.5;
    } else if (roll < 0.75) {
      // 그라운드 슬램 (범위 충격파)
      m.atkAnim = 1;
      setTimeout(() => {
        if (m.dead) return;
        spawnFx('boom', m.x + m.facing * 110, m.y);
        for (const dir of [-1, 1]) spawnShock(m.x, m.y, dir * 340, m.def.atk * 0.9);
      }, 420);
      m.castCd = 4.4 - m.phase * 0.4;
    } else {
      // 돌진
      m.vx = m.facing * 420;
      m.atkAnim = 1;
      m.castCd = 3.2;
    }
  }
  if (Math.abs(m.vx) < 400) m.vx = m.facing * m.def.spd * (dist > 120 ? 1 : 0);
}

function spawnFireball(x, y, vx, vy, dmg) {
  const g = gFromHTML(`<g><circle cx="0" cy="0" r="24" fill="url(#glowR)"/><circle cx="0" cy="0" r="11" fill="#ffd36b"/><circle cx="0" cy="0" r="6" fill="#fff"/></g>`);
  LAYERS.fxLayer.appendChild(g);
  S.projs.push({ node: g, x, y, vx, vy, life: 3.2, dmg, from: 'mon', r: 16 });
}
function spawnShock(x, y, vx, dmg) {
  const g = gFromHTML(`<g><path d="M-16 0 L 0 -52 L 16 0 Z" fill="#ff8b3d" opacity="0.9"/><path d="M-8 0 L 0 -34 L 8 0 Z" fill="#ffe14d"/></g>`);
  LAYERS.fxLayer.appendChild(g);
  S.projs.push({ node: g, x, y, vx, vy: 0, life: 1.6, dmg, from: 'mon', r: 22, ground: true });
}

function updateProjectiles(dt) {
  const p = S.player;
  for (let i = S.projs.length - 1; i >= 0; i--) {
    const pr = S.projs[i];
    pr.life -= dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.ground) pr.y = S.map.groundY;
    const face = pr.facing || (pr.vx < 0 ? -1 : 1);
    const ang = Math.atan2(pr.vy, Math.abs(pr.vx)) * 180 / Math.PI * (face < 0 ? -1 : 1);
    const spin = pr.magic ? (S.t * 420) % 360 : 0;
    pr.node.setAttribute('transform',
      `translate(${pr.x.toFixed(1)},${pr.y.toFixed(1)}) scale(${face},1) rotate(${(ang + spin).toFixed(1)})`);
    let hitSomething = false;
    if (pr.from === 'player') {
      for (const m of S.monsters) {
        if (m.dead) continue;
        if (pr.hitIds && pr.hitIds.indexOf(m) >= 0) continue;
        const rr = pr.r || 12;
        if (Math.abs(m.x - pr.x) < m.w / 2 + rr && Math.abs((m.y - m.h / 2) - pr.y) < m.h / 2 + rr + 10) {
          dealDamage(m, pr.dmg);
          spawnFx('hit', pr.x, pr.y);
          if (pr.pierce) { pr.hitIds.push(m); } else { hitSomething = true; }
          break;
        }
      }
    } else if (!p.dead) {
      if (Math.abs(p.x - pr.x) < 26 + (pr.r || 12) && Math.abs((p.y - 40) - pr.y) < 48 + (pr.r || 12)) {
        hurtPlayer(pr.dmg, pr.x);
        spawnFx('boom', pr.x, pr.y);
        hitSomething = true;
      }
    }
    if (hitSomething || pr.life <= 0 || pr.x < 10 || pr.x > S.map.w - 10) {
      pr.node.remove(); S.projs.splice(i, 1);
    }
  }
}

/* ---------------- 소비 아이템 ---------------- */
function useConsumable(item) {
  const p = S.player;
  if (item.hp) { p.hp = Math.min(p.maxHp, p.hp + item.hp); damageText(p.x - 20, p.y - 90, '+' + item.hp, 'heal'); }
  if (item.mp) { p.mp = Math.min(p.maxMp, p.mp + item.mp); damageText(p.x + 20, p.y - 70, '+' + item.mp, 'exp'); }
  item.qty--;
  if (item.qty <= 0) p.inv.use = p.inv.use.filter(x => x !== item);
  UI.refreshHud(); UI.renderInv();
}
function useQuick(i) {
  const id = S.player.quick[i];
  if (!id) return;
  const item = S.player.inv.use.find(x => x.id === id);
  if (!item) { UI.toast('물약이 없습니다.', 'warn'); return; }
  useConsumable(item);
}
