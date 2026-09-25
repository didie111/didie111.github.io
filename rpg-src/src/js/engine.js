/* =========================================================
   ENGINE : 상태 / 맵 생성 / 물리 / 카메라 / 렌더
   ========================================================= */
const S = {
  running: false, paused: false, t: 0,
  map: null, mapId: 'town',
  player: null, monsters: [], drops: [], projs: [], fx: [], npcs: [], portals: [],
  cam: { x: 0, y: 0 },
  keys: {}, pressed: {},
  boss: null,
  killCount: {},
  msgQueue: [],
};

const LAYERS = {};
function initLayers() {
  ['defs', 'skyLayer', 'farLayer', 'nearLayer', 'mapLayer', 'itemLayer', 'entityLayer', 'fxLayer', 'frontLayer'].forEach(id => {
    LAYERS[id] = document.getElementById(id);
  });
  LAYERS.defs.innerHTML = Art.defs();
}
function clearLayer(l) { while (l.firstChild) l.removeChild(l.firstChild); }

/* ---------------- 플레이어 생성 ---------------- */
function createPlayer(name, jobId) {
  const job = JOBS[jobId];
  const p = {
    name, job: jobId, level: 1, exp: 0, meso: 300,
    str: 12, dex: 8, int: 8, luk: 8, ap: 0, sp: 0,
    hp: job.hp, mp: job.mp, maxHp: job.hp, maxMp: job.mp,
    x: 200, y: MAPS.town.groundY, vx: 0, vy: 0, w: 34, h: 78,
    facing: 1, onGround: false, jumps: 0, dropT: 0,
    anim: { t: 0, state: 'idle', atk: 0, hurt: 0 },
    inv: { equip: [], use: [], etc: [] },
    equipped: {}, quests: {}, cds: {}, invuln: 0,
    quick: ['redPotion', 'bluePotion', 'elixir', null],
  };
  p.inv.use.push({ ...CONSUMABLES.redPotion, qty: 10 });
  p.inv.use.push({ ...CONSUMABLES.bluePotion, qty: 5 });
  const w = makeEquip(1, 'weapon', 'common', job.weapon);
  p.equipped[w.slot] = w;
  return p;
}

/* ---------------- 장비 생성 ---------------- */
let uidCounter = 1;
function makeEquip(tier, slotId, forceRarity, wpnKind) {
  const wk = wpnKind || (S.player ? JOBS[S.player.job].weapon : null);
  let pool = EQUIP_BASE.filter(e => e.tier === tier && (!slotId || e.slot === slotId)
    && (e.slot !== 'weapon' || !wk || e.art === wk));
  if (!pool.length) pool = EQUIP_BASE.filter(e => e.tier === tier);
  if (!pool.length) pool = EQUIP_BASE;
  const base = pool[Math.floor(Math.random() * pool.length)];
  let r = forceRarity;
  if (!r) {
    const x = Math.random();
    r = x < 0.6 ? 'common' : x < 0.86 ? 'rare' : x < 0.97 ? 'epic' : 'unique';
  }
  const mul = RARITY[r].mul;
  const it = {
    uid: uidCounter++, type: 'equip', slot: base.slot, name: base.name, rarity: r,
    art: base.art, color: base.color, tier,
    atk: base.atk ? Math.round(base.atk * mul) : 0,
    def: base.def ? Math.round(base.def * mul) : 0,
    hp: base.hp ? Math.round(base.hp * mul) : 0,
    mp: base.mp ? Math.round(base.mp * mul) : 0,
    spd: base.spd ? Math.round(base.spd * mul) : 0,
    crit: base.crit ? +(base.crit * mul).toFixed(3) : 0,
  };
  if (r !== 'common') it.name = RARITY[r].name + ' ' + base.name;
  return it;
}

/* ---------------- 파생 스탯 ---------------- */
function stats(p) {
  const job = JOBS[p.job];
  let atk = job.atk + p.level * 2.2 + p.str * 1.6 + p.dex * 0.6;
  if (p.job === 'mage') atk = job.atk + p.level * 2.2 + p.int * 1.8 + p.luk * 0.5;
  if (p.job === 'archer') atk = job.atk + p.level * 2.2 + p.dex * 1.7 + p.str * 0.5;
  let def = job.def + p.level * 1.1;
  let crit = job.crit + p.luk * 0.002;
  let hpB = 0, mpB = 0, spd = 0;
  for (const k in p.equipped) {
    const e = p.equipped[k];
    if (!e) continue;
    atk += e.atk || 0; def += e.def || 0; hpB += e.hp || 0; mpB += e.mp || 0;
    crit += e.crit || 0; spd += e.spd || 0;
  }
  if (p.buff && p.buff.t > 0) {
    atk *= p.buff.atk || 1;
    def *= p.buff.def || 1;
    crit += p.buff.crit || 0;
  }
  return {
    atk: Math.round(atk), def: Math.round(def), crit: Math.min(0.75, crit),
    maxHp: Math.round(job.hp + (p.level - 1) * job.hpPerLv + hpB),
    maxMp: Math.round(job.mp + (p.level - 1) * job.mpPerLv + mpB),
    speed: GAME.MOVE_SPD + spd * 2,
  };
}
function refreshStats(p, fill) {
  const s = stats(p);
  p.maxHp = s.maxHp; p.maxMp = s.maxMp;
  if (fill) { p.hp = s.maxHp; p.mp = s.maxMp; }
  p.hp = Math.min(p.hp, p.maxHp); p.mp = Math.min(p.mp, p.maxMp);
}

/* ---------------- 맵 로딩 ---------------- */
function loadMap(id, spawnX) {
  const m = MAPS[id];
  S.map = m; S.mapId = id;
  S.monsters = []; S.drops = []; S.projs = []; S.fx = []; S.npcs = []; S.portals = []; S.boss = null;
  [LAYERS.skyLayer, LAYERS.farLayer, LAYERS.nearLayer, LAYERS.mapLayer, LAYERS.itemLayer, LAYERS.entityLayer, LAYERS.fxLayer, LAYERS.frontLayer].forEach(clearLayer);

  const bg = Art.background(m.theme, m.w);
  LAYERS.skyLayer.innerHTML = bg.sky;
  LAYERS.farLayer.innerHTML = bg.far;
  LAYERS.nearLayer.innerHTML = bg.near;
  resizeStage();

  let mapHTML = Art.ground(m.theme, m.w, m.groundY);
  m.platforms.forEach(p => { mapHTML += Art.platform(m.theme, p); });
  LAYERS.mapLayer.innerHTML = mapHTML;

  // 포탈
  m.portals.forEach(pt => {
    const g = gFromHTML(Art.portal(pt.boss), 'portalG');
    g.setAttribute('transform', `translate(${pt.x},${pt.y})`);
    const label = el('text', { x: 0, y: -100, 'text-anchor': 'middle', fill: '#fff', 'font-size': 14, 'font-weight': 700 });
    label.textContent = pt.label + ' ▲';
    label.setAttribute('style', 'paint-order:stroke;stroke:#000;stroke-width:4px;');
    g.appendChild(label);
    LAYERS.mapLayer.appendChild(g);
    S.portals.push({ ...pt, node: g });
  });

  // NPC
  (m.npcs || []).forEach(n => {
    const g = gFromHTML(Art.monster('npc'));
    g.setAttribute('transform', `translate(${n.x},${n.y})`);
    const label = el('text', { x: 0, y: -74, 'text-anchor': 'middle', fill: '#ffe08a', 'font-size': 13, 'font-weight': 700 });
    label.textContent = n.name;
    label.setAttribute('style', 'paint-order:stroke;stroke:#000;stroke-width:4px;');
    g.appendChild(label);
    LAYERS.entityLayer.appendChild(g);
    S.npcs.push({ ...n, node: g, t: Math.random() * 6 });
  });

  // 몬스터
  (m.spawns || []).forEach(sp => { for (let i = 0; i < sp.n; i++) spawnMonster(sp.type); });
  if (m.boss) spawnMonster(m.boss, m.w / 2, m.groundY);

  // 플레이어 노드 재생성
  attachPlayerNode();
  S.player.x = spawnX !== undefined ? spawnX : 200;
  S.player.y = m.groundY - 1;
  S.player.vx = 0; S.player.vy = 0;
  S.cam.x = clamp(S.player.x - GAME.W / 2, 0, m.w - GAME.W);
  updateCamera(true);
  UI.mapName(m.name);
  UI.buildMinimapStatic();
  UI.toast('▶ ' + m.name);
}

function attachPlayerNode() {
  const p = S.player;
  const look = playerLook(p);
  const g = gFromHTML(Art.player(look), 'playerG');
  Art.layoutPlayer(g);
  LAYERS.entityLayer.appendChild(g);
  p.node = g;
  p.parts = {
    body: g.querySelector('.body'), legL: g.querySelector('.legL'), legR: g.querySelector('.legR'),
    armF: g.querySelector('.armF'), armB: g.querySelector('.armB'), head: g.querySelector('.head'),
    torso: g.querySelector('.torso'), wpnMount: g.querySelector('.wpnMount'),
    bowString: g.querySelector('.bowString'), nock: g.querySelector('.nock'),
    orb: g.querySelector('.orb'), cape: g.querySelector('.cape'),
  };
  p.wpnKind = look.weaponArt || JOBS[p.job].weapon;
  p.rig = p.rig || { armF: 0, armB: 0, legL: 0, torso: 0, bob: 0 };
  const nm = el('text', { x: 0, y: 16, 'text-anchor': 'middle', fill: '#fff', 'font-size': 12 });
  nm.textContent = p.name;
  nm.setAttribute('style', 'paint-order:stroke;stroke:#000;stroke-width:4px;');
  g.appendChild(nm);
}
function playerLook(p) {
  const e = p.equipped;
  return {
    job: p.job,
    weaponArt: e.weapon ? e.weapon.art : JOBS[p.job].weapon,
    weaponColor: e.weapon ? e.weapon.color : undefined,
    hat: !!e.hat, hatColor: e.hat && e.hat.color,
    topColor: e.top && e.top.color,
    bottomColor: e.bottom && e.bottom.color,
    shoesColor: e.shoes && e.shoes.color,
    gloveColor: e.glove && e.glove.color,
    cape: !!e.cape, capeColor: e.cape && e.cape.color,
  };
}
function rebuildPlayerArt() {
  const p = S.player;
  if (p.node && p.node.parentNode) p.node.parentNode.removeChild(p.node);
  attachPlayerNode();
  UI.drawPortrait(); UI.drawPreview();
}

/* ---------------- 몬스터 생성 ---------------- */
function spawnMonster(type, fx, fy) {
  const def = MONSTERS[type];
  const m = S.map;
  let x = fx, y = fy;
  if (x === undefined) {
    const spots = [{ y: m.groundY, x0: 60, x1: m.w - 60 }].concat(
      m.platforms.map(p => ({ y: p.y, x0: p.x + 20, x1: p.x + p.w - 20 })));
    const sp = spots[Math.floor(Math.random() * spots.length)];
    x = sp.x0 + Math.random() * (sp.x1 - sp.x0);
    y = sp.y;
  }
  const mon = {
    type, def, name: def.name, x, y, vx: 0, vy: 0, w: def.w, h: def.h,
    hp: def.hp, maxHp: def.hp, facing: -1, onGround: false, boss: !!def.boss,
    aiT: Math.random() * 2, dir: Math.random() < .5 ? -1 : 1, hitCd: 0, hurt: 0, dead: false,
    home: x, anim: Math.random() * 6, state: 'idle', phase: 1, castCd: 2.5, atkAnim: 0,
  };
  const g = gFromHTML(Art.monster(def.art), 'monG');
  LAYERS.entityLayer.appendChild(g);
  mon.node = g;
  mon.parts = {
    body: g.querySelector('.bodyG'),
    wingL: g.querySelector('.wingL'), wingR: g.querySelector('.wingR'),
    armF: g.querySelector('.armF'), legL: g.querySelector('.legL'), legR: g.querySelector('.legR'),
  };
  // HP 바
  const bar = el('g', { class: 'mhp' });
  bar.innerHTML = `<rect x="${-def.w / 2}" y="${-def.h - 16}" width="${def.w}" height="5" rx="2.5" fill="#000" opacity="0.55"/>
    <rect class="f" x="${-def.w / 2 + 1}" y="${-def.h - 15}" width="${def.w - 2}" height="3" rx="1.5" fill="#6ee06e"/>`;
  bar.style.opacity = 0;
  g.appendChild(bar);
  mon.bar = bar;
  if (def.boss) { S.boss = mon; UI.showBossBar(mon); }
  S.monsters.push(mon);
  return mon;
}

/* ---------------- 물리 ---------------- */
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function physics(o, dt, opts) {
  opts = opts || {};
  const m = S.map;
  o.vy += GAME.GRAVITY * dt;
  if (o.vy > GAME.TERMINAL_V) o.vy = GAME.TERMINAL_V;
  o.x += o.vx * dt;
  const prevY = o.y;
  o.y += o.vy * dt;
  o.x = clamp(o.x, 20, m.w - 20);
  o.onGround = false;

  if (o.y >= m.groundY && o.vy >= 0) { o.y = m.groundY; o.vy = 0; o.onGround = true; }
  if (!opts.noPlatform && o.vy >= 0) {
    for (const p of m.platforms) {
      if (o.x > p.x - 6 && o.x < p.x + p.w + 6 && prevY <= p.y + 2 && o.y >= p.y) {
        o.y = p.y; o.vy = 0; o.onGround = true; break;
      }
    }
  }
}

/* ---------------- 카메라 ---------------- */
function updateCamera(instant) {
  const p = S.player, m = S.map;
  const VH = GAME.VH || GAME.H;
  const tx = clamp(p.x - GAME.W / 2, 0, Math.max(0, m.w - GAME.W));
  const yLim = 780 - VH;
  const ty = clamp(p.y - VH * 0.62, Math.min(0, yLim), Math.max(0, yLim));
  S.cam.x += (tx - S.cam.x) * (instant ? 1 : 0.12);
  S.cam.y += (ty - S.cam.y) * (instant ? 1 : 0.12);
  const cx = Math.round(S.cam.x), cy = Math.round(S.cam.y);
  LAYERS.farLayer.setAttribute('transform', `translate(${-cx * 0.25},${-cy * 0.3})`);
  LAYERS.nearLayer.setAttribute('transform', `translate(${-cx * 0.55},${-cy * 0.6})`);
  const t = `translate(${-cx},${-cy})`;
  LAYERS.mapLayer.setAttribute('transform', t);
  LAYERS.itemLayer.setAttribute('transform', t);
  LAYERS.entityLayer.setAttribute('transform', t);
  LAYERS.fxLayer.setAttribute('transform', t);
}

/* ---------------- 애니메이션 ---------------- */
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
const easeInQuad = k => k * k;
const easeInOutSine = k => 0.5 - Math.cos(Math.PI * k) / 2;

function animatePlayer(dt) {
  const p = S.player, a = p.anim, pa = p.parts;
  a.t += dt;
  const pose = Art.basePose(p.wpnKind);
  const moving = Math.abs(p.vx) > 10;
  const speedK = Math.min(1, Math.abs(p.vx) / GAME.MOVE_SPD);

  // 착지 스쿼시
  if (p.onGround && a.wasAir) { a.land = 0.2; a.wasAir = false; }
  if (!p.onGround) a.wasAir = true;
  if (a.land > 0) a.land -= dt;

  let legA = 0, armF = pose.armF, armB = pose.armB, bob = 0, torso = 0;
  let wpnRot = pose.wpn, draw = 0, nockOn = 0, orbS = 1;

  if (!p.onGround) {
    const rise = p.vy < 0;
    legA = rise ? 26 : -16;
    armF = pose.armF + (rise ? -26 : 16);
    armB = pose.armB + (rise ? -32 : 22);
    torso = rise ? -5 : 4;
  } else if (moving) {
    const w = Math.sin(a.t * 12.5);
    const w2 = Math.sin(a.t * 25);
    legA = w * 36 * speedK;
    bob = (w2 * 1.6 - 1) * speedK;
    torso = -3 * speedK;
    if (p.wpnKind === 'bow') { armF = pose.armF + w * 7; armB = pose.armB - w * 9; }
    else if (p.wpnKind === 'staff') { armF = pose.armF + w * 12; armB = pose.armB - w * 26; }
    else { armF = pose.armF - w * 30; armB = pose.armB + w * 30; }
  } else {
    const br = Math.sin(a.t * 2.6);
    bob = br * 1.1;
    armF = pose.armF + br * 3;
    armB = pose.armB - br * 3;
    if (p.wpnKind === 'staff') orbS = 1 + Math.sin(a.t * 2.2) * 0.07;
  }

  // 공격 모션 (무기 종류별)
  let attacking = false;
  if (a.atk > 0) {
    attacking = true;
    a.atk -= dt;
    const dur = a.atkDur || 0.34;
    const k = clamp(1 - Math.max(0, a.atk) / dur, 0, 1);
    if (p.wpnKind === 'bow') {
      if (k < 0.45) {                       // 시위 당기기
        const d = easeOutCubic(k / 0.45);
        draw = d; nockOn = 1;
        armF = -88 - d * 4; armB = -62 - d * 26; torso = -6 * d;
      } else {                              // 발사 · 반동
        const r = (k - 0.45) / 0.55;
        draw = (1 - easeOutCubic(r)) * Math.cos(r * 16) * 0.5;
        nockOn = 0;
        armF = -92 + easeOutCubic(r) * 6; armB = -88 + easeOutCubic(r) * 32; torso = -6 + r * 6;
      }
      wpnRot = -armF;
    } else if (p.wpnKind === 'staff') {
      if (k < 0.42) {                       // 지팡이 들어올리기
        const d = easeOutCubic(k / 0.42);
        armF = pose.armF - d * 122; armB = pose.armB - d * 20; torso = -7 * d; orbS = 1 + d * 0.55;
      } else {                              // 시전 · 밀어내기
        const r = easeOutCubic((k - 0.42) / 0.58);
        armF = -136 + r * 62; armB = pose.armB - 20 + r * 24; torso = -7 + r * 13; orbS = 1.55 - r * 0.55;
      }
      wpnRot = -armF * 0.55;
    } else {                                 // 검 베기
      if (k < 0.3) {                        // 윈드업
        const d = easeOutCubic(k / 0.3);
        armF = pose.armF - d * 158; torso = -11 * d; wpnRot = -34 * d;
      } else {                              // 내려베기
        const r = easeOutCubic((k - 0.3) / 0.7);
        armF = -151 + r * 212; torso = -11 + r * 22; wpnRot = -34 + r * 52;
      }
      armB = pose.armB + (armF + 40) * -0.18;
    }
  }

  // 부드러운 보간 (프레임 독립)
  const rate = attacking ? 34 : 16;
  const s = 1 - Math.exp(-rate * dt);
  const r = p.rig;
  r.armF += (armF - r.armF) * s;
  r.armB += (armB - r.armB) * s;
  r.legL += (legA - r.legL) * (1 - Math.exp(-26 * dt));
  r.torso += (torso - r.torso) * s;
  r.bob += (bob - r.bob) * (1 - Math.exp(-18 * dt));
  r.wpn = r.wpn === undefined ? wpnRot : r.wpn + (wpnRot - r.wpn) * s;

  const squash = a.land > 0 ? Math.sin((a.land / 0.2) * Math.PI) * 0.16 : 0;
  pa.legL.setAttribute('transform', `translate(-5,-25) rotate(${r.legL.toFixed(1)})`);
  pa.legR.setAttribute('transform', `translate(5,-25) rotate(${(-r.legL).toFixed(1)})`);
  pa.armF.setAttribute('transform', `translate(13,-50) rotate(${r.armF.toFixed(1)})`);
  pa.armB.setAttribute('transform', `translate(-13,-50) rotate(${r.armB.toFixed(1)})`);
  if (pa.torso) pa.torso.setAttribute('transform', `rotate(${(r.torso * 0.5).toFixed(1)},0,-26)`);
  if (pa.head) pa.head.setAttribute('transform', `rotate(${(r.torso * 0.35).toFixed(1)},0,-56) translate(0,${(r.bob * 0.4).toFixed(2)})`);
  if (pa.wpnMount) pa.wpnMount.setAttribute('transform', `translate(0,${pose.wpnY}) rotate(${r.wpn.toFixed(1)})`);
  if (pa.cape) pa.cape.setAttribute('transform', `rotate(${(-r.torso * 0.8 - p.vx * 0.012).toFixed(1)},0,-50)`);
  pa.body.setAttribute('transform',
    `translate(0,${(r.bob + squash * 12).toFixed(2)}) scale(${(1 + squash * 0.5).toFixed(3)},${(1 - squash).toFixed(3)})`);

  // 활 시위 · 화살
  if (pa.bowString) {
    const px = -14 * draw;
    pa.bowString.setAttribute('d', `M2 -34 L ${px.toFixed(1)} 0 L 2 34`);
    if (pa.nock) {
      pa.nock.setAttribute('opacity', nockOn);
      pa.nock.setAttribute('transform', `translate(${px.toFixed(1)},0)`);
    }
  }
  if (pa.orb) pa.orb.setAttribute('transform', `translate(0,-58) scale(${orbS.toFixed(3)}) rotate(${(a.t * 60).toFixed(1)})`);

  if (a.hurt > 0) { a.hurt -= dt; p.node.style.opacity = (Math.sin(S.t * 40) > 0 ? 0.35 : 1); }
  else p.node.style.opacity = 1;
  p.node.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${p.facing},1)`);
}

function animateMonster(mon, dt) {
  mon.anim += dt;
  const pa = mon.parts;
  const moving = Math.abs(mon.vx) > 5;
  if (pa.body) {
    let sy = 1, sx = 1, rot = 0, ty = 0;
    if (mon.def.jumpy) { sy = 1 + Math.sin(mon.anim * 8) * 0.08; sx = 2 - sy; }
    else if (mon.def.flying) { ty = Math.sin(mon.anim * 6) * 5; }
    else if (moving) { rot = Math.sin(mon.anim * 10) * 4; ty = -Math.abs(Math.sin(mon.anim * 10)) * 3; }
    else { sy = 1 + Math.sin(mon.anim * 2.4) * 0.03; sx = 2 - sy; }
    if (mon.boss) {
      sy = 1 + Math.sin(mon.anim * 1.8) * 0.025; sx = 2 - sy;
      ty = Math.sin(mon.anim * 1.8) * 3;
      rot = mon.atkAnim > 0 ? -18 * Math.sin((1 - mon.atkAnim) * Math.PI) : 0;
    }
    pa.body.setAttribute('transform', `translate(0,${ty}) scale(${sx.toFixed(3)},${sy.toFixed(3)}) rotate(${rot})`);
  }
  if (pa.wingL) {
    const f = Math.sin(mon.anim * (mon.boss ? 2.6 : 14)) * (mon.boss ? 12 : 34);
    pa.wingL.setAttribute('transform', `rotate(${f}, -10, -${mon.h * 0.7})`);
    pa.wingR.setAttribute('transform', `rotate(${-f}, 10, -${mon.h * 0.7})`);
  }
  if (pa.legL && !mon.boss) {
    const w = moving ? Math.sin(mon.anim * 12) * 18 : 0;
    pa.legL.setAttribute('transform', `rotate(${w}, -8, -${mon.h * 0.35})`);
    if (pa.legR) pa.legR.setAttribute('transform', `rotate(${-w}, 8, -${mon.h * 0.35})`);
  } else if (pa.legL && mon.boss) {
    const w = moving ? Math.sin(mon.anim * 5) * 10 : 0;
    pa.legL.setAttribute('transform', `rotate(${w}, -28, -56)`);
    if (pa.legR) pa.legR.setAttribute('transform', `rotate(${-w}, 28, -56)`);
  }
  if (mon.atkAnim > 0) mon.atkAnim -= dt * 2;
  if (mon.hurt > 0) { mon.hurt -= dt; mon.node.style.filter = 'brightness(2.4)'; }
  else mon.node.style.filter = '';
  mon.node.setAttribute('transform', `translate(${mon.x.toFixed(1)},${mon.y.toFixed(1)}) scale(${mon.facing},1)`);
  // hp bar
  if (mon.hp < mon.maxHp) {
    mon.bar.style.opacity = 1;
    const f = mon.bar.querySelector('.f');
    f.setAttribute('width', Math.max(0, (mon.w - 2) * mon.hp / mon.maxHp));
    f.setAttribute('fill', mon.hp / mon.maxHp > .5 ? '#6ee06e' : mon.hp / mon.maxHp > .2 ? '#ffd24d' : '#ff5a5a');
  }
}

/* ---------------- 입력 ---------------- */
function resizeStage() {
  const stage = document.getElementById('stage');
  const ratio = window.innerHeight / window.innerWidth;
  GAME.VH = Math.round(GAME.W * clamp(ratio, 0.42, 1.05));
  stage.setAttribute('viewBox', `0 0 ${GAME.W} ${GAME.VH}`);
  const sky = LAYERS.skyLayer.firstElementChild;
  if (sky) { sky.setAttribute('y', -300); sky.setAttribute('height', GAME.VH + 800); }
}

function initInput() {
  const codeOf = e => e.code;
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const c = codeOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'AltLeft', 'AltRight', 'F1'].includes(c)) e.preventDefault();
    if (!S.keys[c]) S.pressed[c] = true;
    S.keys[c] = true;
  });
  window.addEventListener('keyup', e => { S.keys[codeOf(e)] = false; });
  window.addEventListener('blur', () => { S.keys = {}; });
}
function key(c) { return !!S.keys[c]; }
function hit(c) { if (S.pressed[c]) { S.pressed[c] = false; return true; } return false; }

/* ---------------- 플레이어 조작 ---------------- */
function controlPlayer(dt) {
  const p = S.player;
  if (p.dead) return;
  const sp = stats(p).speed;
  let ax = 0;
  if (key('ArrowLeft')) ax -= 1;
  if (key('ArrowRight')) ax += 1;
  if (ax !== 0) { p.facing = ax; p.vx = ax * sp; } else p.vx *= p.onGround ? 0.62 : 0.92;

  const jumpKey = hit('AltLeft') || hit('AltRight') || hit('Space');
  if (jumpKey) {
    if (key('ArrowDown') && p.onGround) { p.dropT = 0.22; p.y += 4; p.vy = 60; }
    else if (p.onGround) { p.vy = -GAME.JUMP_V; p.jumps = 1; spawnFx('dust', p.x, p.y); }
    else if (p.jumps < 2) { p.vy = -GAME.JUMP_V * 0.88; p.jumps = 2; spawnFx('dblJump', p.x, p.y - 30); }
  }
  if (p.dropT > 0) p.dropT -= dt;
  physics(p, dt, { noPlatform: p.dropT > 0 });
  if (p.onGround) p.jumps = 0;

  // 포탈
  if (hit('ArrowUp')) {
    const pt = S.portals.find(q => Math.abs(q.x - p.x) < 50 && Math.abs(q.y - p.y) < 90);
    if (pt) { loadMap(pt.to, pt.toX); return; }
    const npc = S.npcs.find(q => Math.abs(q.x - p.x) < 60);
    if (npc) UI.toast(npc.lines[Math.floor(Math.random() * npc.lines.length)]);
  }
  // 줍기
  if (key('KeyA')) pickupNear();
  // 스킬
  const sks = jobSkills(p.job);
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV'].forEach((k, i) => { if (hit(k) && sks[i]) useSkill(sks[i].id); });
  if (p.buff && p.buff.t > 0) {
    p.buff.t -= dt;
    if (p.buff.t <= 0) { p.buff = null; refreshStats(p); UI.refreshHud(); UI.toast('버프가 종료되었습니다.'); }
  }
  // 퀵슬롯
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((k, i) => { if (hit(k)) useQuick(i); });

  for (const id in p.cds) if (p.cds[id] > 0) p.cds[id] -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  // 자연 회복
  p.regen = (p.regen || 0) + dt;
  if (p.regen > 3) { p.regen = 0; p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.02)); p.mp = Math.min(p.maxMp, p.mp + Math.ceil(p.maxMp * 0.04)); }
}

/* ---------------- 이펙트 ---------------- */
function spawnFx(kind, x, y, opt) {
  opt = opt || {};
  let html = '', life = 0.5;
  switch (kind) {
    case 'dust': html = `<ellipse cx="0" cy="-4" rx="16" ry="6" fill="#fff" opacity="0.5"/>`; life = 0.3; break;
    case 'dblJump': html = `<circle cx="0" cy="0" r="26" fill="none" stroke="#bfe6ff" stroke-width="4" opacity="0.85"/>`; life = 0.35; break;
    case 'slash': html = `<path d="M-10 -40 q 60 20 6 56" fill="none" stroke="#fff" stroke-width="7" opacity="0.9" stroke-linecap="round"/>
        <path d="M-6 -34 q 46 18 4 44" fill="none" stroke="#ffe08a" stroke-width="3" opacity="0.9" stroke-linecap="round"/>`; life = 0.22; break;
    case 'power': html = `<g><path d="M-20 -50 q 90 30 10 74" fill="none" stroke="#ffb35c" stroke-width="12" opacity="0.9" stroke-linecap="round"/>
        <path d="M-14 -44 q 70 26 8 58" fill="none" stroke="#fff" stroke-width="5" opacity="0.95" stroke-linecap="round"/></g>`; life = 0.3; break;
    case 'thunder': html = `<g><path d="M6 -520 l -18 340 h 26 l -14 190 l 40 -250 h -26 z" fill="#ffe14d" opacity="0.95"/>
        <path d="M6 -520 l -10 340 h 14 l -8 180" fill="none" stroke="#fff" stroke-width="6" opacity="0.9"/>
        <circle cx="0" cy="0" r="60" fill="url(#glowY)"/></g>`; life = 0.32; break;
    case 'heal': html = `<g><circle cx="0" cy="-40" r="48" fill="none" stroke="#7ce89a" stroke-width="5" opacity="0.8"/>
        <path d="M-10 -66 h 20 v 12 h 12 v 20 h -12 v 12 h -20 v -12 h -12 v -20 h 12 z" fill="#b6ffce" opacity="0.9"/></g>`; life = 0.8; break;
    case 'hit': html = `<g><circle cx="0" cy="0" r="18" fill="url(#glowY)"/><path d="M-16 -16 L 16 16 M16 -16 L -16 16" stroke="#fff" stroke-width="4" opacity="0.9"/></g>`; life = 0.2; break;
    case 'boom': html = `<g><circle cx="0" cy="0" r="50" fill="url(#glowR)"/><circle cx="0" cy="0" r="30" fill="#ffd9a0" opacity="0.6"/></g>`; life = 0.4; break;
    case 'die': html = `<g><circle cx="0" cy="-20" r="26" fill="#fff" opacity="0.8"/></g>`; life = 0.3; break;
    case 'levelup': html = `<g><circle cx="0" cy="-40" r="70" fill="url(#glowY)"/>
        <circle cx="0" cy="-40" r="52" fill="none" stroke="#ffe98a" stroke-width="6" opacity="0.9"/></g>`; life = 1.2; break;
    case 'shootSpark': html = `<g><path d="M0 0 l 34 -7 l -34 7 l 34 7 z" fill="#fff6cf" opacity="0.9"/>
        <circle cx="0" cy="0" r="13" fill="url(#glowY)"/></g>`; life = 0.16; break;
    case 'castRune': {
      const col = opt.fire ? '#ffb347' : '#8fd0ff';
      html = `<g><circle r="30" fill="none" stroke="${col}" stroke-width="3" opacity="0.9"/>
        <circle r="20" fill="none" stroke="${col}" stroke-width="2" opacity="0.7"/>
        <path d="M0 -30 L 26 15 L -26 15 Z" fill="none" stroke="${col}" stroke-width="2" opacity="0.8"/>
        <path d="M0 30 L 26 -15 L -26 -15 Z" fill="none" stroke="${col}" stroke-width="2" opacity="0.5"/>
        <circle r="34" fill="url(${opt.fire ? '#glowR' : '#glowB'})" opacity="0.5"/></g>`;
      life = 0.4; break;
    }
    case 'buff': html = `<g><circle cx="0" cy="-40" r="54" fill="none" stroke="#ffe08a" stroke-width="5" opacity="0.85"/>
        <circle cx="0" cy="-40" r="34" fill="none" stroke="#fff" stroke-width="3" opacity="0.7"/>
        <circle cx="0" cy="-40" r="70" fill="url(#glowY)" opacity="0.6"/></g>`; life = 0.9; break;
  }
  const g = gFromHTML(html, 'fx');
  g.setAttribute('transform', `translate(${x},${y}) scale(${opt.flip || 1},1)`);
  LAYERS.fxLayer.appendChild(g);
  S.fx.push({ node: g, life, max: life, x, y, kind, flip: opt.flip || 1, grow: opt.grow });
}

function damageText(x, y, val, kind) {
  const colors = { normal: '#ffffff', crit: '#ffd24d', player: '#ff6b6b', heal: '#7ce89a', exp: '#9fd8ff', meso: '#ffcf5c' };
  const size = kind === 'crit' ? 30 : kind === 'player' ? 22 : 24;
  const t = el('text', {
    x: 0, y: 0, 'text-anchor': 'middle', fill: colors[kind] || '#fff',
    'font-size': size, 'font-weight': 900, style: 'paint-order:stroke;stroke:#2a1a05;stroke-width:5px;',
  });
  t.textContent = (kind === 'crit' ? val + '!' : val);
  const g = el('g', { transform: `translate(${x},${y})` });
  g.appendChild(t);
  LAYERS.fxLayer.appendChild(g);
  S.fx.push({ node: g, life: 0.9, max: 0.9, x, y: y, rise: true, vx: (Math.random() - .5) * 40 });
}

function updateFx(dt) {
  for (let i = S.fx.length - 1; i >= 0; i--) {
    const f = S.fx[i];
    f.life -= dt;
    const k = 1 - f.life / f.max;
    if (f.rise) {
      f.y -= (60 - k * 30) * dt * 2;
      f.x += (f.vx || 0) * dt;
      f.node.setAttribute('transform', `translate(${f.x},${f.y}) scale(${1 + k * 0.25})`);
      f.node.style.opacity = f.life < 0.3 ? f.life / 0.3 : 1;
    } else {
      f.node.style.opacity = Math.max(0, f.life / f.max);
      if (f.kind === 'castRune') {
        f.node.setAttribute('transform', `translate(${f.x},${f.y}) scale(${(0.5 + k * 0.9) * (f.flip || 1)},${0.5 + k * 0.9}) rotate(${k * 180})`);
      } else if (f.kind === 'buff') {
        f.node.setAttribute('transform', `translate(${f.x},${f.y}) scale(${1.3 - k * 0.5})`);
      } else if (f.kind === 'boom' || f.kind === 'dblJump' || f.kind === 'levelup') {
        f.node.setAttribute('transform', `translate(${f.x},${f.y}) scale(${(1 + k * 1.2) * (f.flip || 1)},${1 + k * 1.2})`);
      }
    }
    if (f.life <= 0) { f.node.remove(); S.fx.splice(i, 1); }
  }
}
