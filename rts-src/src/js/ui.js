'use strict';
// ===================================================================
//  UI — 선택/드래그, 우클릭 스마트 명령, 커맨드 카드, 미니맵, 단축키,
//       부대 지정, 메시지, 테스트 패널(적 스폰 / 적 조작 / AI on-off)
// ===================================================================
const UI = {
  selection: [], hover: null, keys: {}, mode: null, menu: null,
  groups: [], lastGroup: { k: -1, t: 0 }, clicks: [], pings: [], lastAlert: null, alertT: -9999,
  mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false, drag: null, overUI: false },
  cardSig: '', infoSig: '', card: [], lastClick: { t: 0, id: 0 },
  el: {},

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = { cv: $('game'), mm: $('minimap'), info: $('info'), cmd: $('cmd'), msgs: $('msgs'), tip: $('tip'),
      min: $('r-min'), gas: $('r-gas'), sup: $('r-sup'), supIco: $('r-sup-ico'), console: $('console'), test: $('test'), help: $('help') };
    this.mmCtx = this.el.mm.getContext('2d');
    this.mmTerrain = ART.minimapTerrain();
    this.mmFog = document.createElement('canvas'); this.mmFog.width = MAP_W; this.mmFog.height = MAP_H;
    this.mmFogCtx = this.mmFog.getContext('2d'); this.mmFogImg = this.mmFogCtx.createImageData(MAP_W, MAP_H);
    this.makeCursors();
    this.bindInput();
    this.buildTestPanel();
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('div'); b.className = 'btn empty';
      b.innerHTML = '<img><span class="hk"></span>';
      b.addEventListener('mousedown', (ev) => { ev.stopPropagation(); if (ev.button === 0) this.pressCard(i, ev.shiftKey); });
      b.addEventListener('mouseenter', () => this.showTip(i, b));
      b.addEventListener('mouseleave', () => this.hideTip());
      this.el.cmd.appendChild(b);
    }
    document.getElementById('ico-min').src = ART.cmdIcon('gather');
  },
  consoleH() { return this.el.console ? this.el.console.offsetHeight : 0; },

  // ---------------- 커서 ----------------
  makeCursors() {
    const mkc = (draw, hx, hy) => { const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d'); draw(g); return 'url(' + c.toDataURL() + ') ' + hx + ' ' + hy + ', auto'; };
    const arrow = (col) => (g) => { g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(2, 2); g.lineTo(2, 20); g.lineTo(7, 15); g.lineTo(11, 23); g.lineTo(14, 21); g.lineTo(10, 14); g.lineTo(17, 14); g.closePath(); g.fill(); g.stroke(); };
    const cross = (col) => (g) => { g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath(); g.arc(16, 16, 9, 0, 6.283); g.moveTo(16, 2); g.lineTo(16, 10); g.moveTo(16, 22); g.lineTo(16, 30); g.moveTo(2, 16); g.lineTo(10, 16); g.moveTo(22, 16); g.lineTo(30, 16); g.stroke(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); };
    const mag = (col) => (g) => { g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath(); g.arc(13, 13, 8, 0, 6.283); g.moveTo(19, 19); g.lineTo(28, 28); g.stroke(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); };
    this.cur = { normal: mkc(arrow('#30e030'), 2, 2), tg: mkc(cross('#30e030'), 16, 16), ty: mkc(cross('#e0e030'), 16, 16), tr: mkc(cross('#e03030'), 16, 16),
      mg: mkc(mag('#30e030'), 13, 13), my: mkc(mag('#e0e030'), 13, 13), mr: mkc(mag('#e03030'), 13, 13) };
    document.body.style.cursor = this.cur.normal;
  },
  updateCursor() {
    let c = this.cur.normal;
    const h = this.hover;
    const col = (e) => !e ? 'g' : e.owner === GAME.control ? 'g' : e.owner === NEUTRAL ? 'y' : 'r';
    if (this.mode && this.mode.kind === 'target') c = this.cur['t' + col(h)];
    else if (!this.mouse.overUI && h) c = this.cur['m' + col(h)];
    if (this._cur !== c) { this._cur = c; this.el.cv.style.cursor = c; }
  },

  // ---------------- 입력 ----------------
  bindInput() {
    const cv = this.el.cv;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.console.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      this.mouse.overUI = e.target !== cv;
      if (this.mmDrag) this.minimapAt(e, true);
    });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    cv.addEventListener('mousedown', (e) => {
      SND.init();
      const [wx, wy] = RENDER.toWorld(e.clientX, e.clientY);
      if (e.button === 0) {
        if (this.mode) { this.execMode(wx, wy, e.shiftKey); return; }
        this.mouse.drag = { sx: e.clientX, sy: e.clientY, wx, wy, shift: e.shiftKey, ctrl: e.ctrlKey };
      } else if (e.button === 2) {
        if (this.mode) { this.cancelMode(); return; }
        this.rightClick(wx, wy, this.pick(wx, wy), e.shiftKey);
      }
    });
    window.addEventListener('mouseup', (e) => {
      this.mmDrag = false;
      if (e.button !== 0 || !this.mouse.drag) return;
      const d = this.mouse.drag; this.mouse.drag = null;
      const [wx, wy] = RENDER.toWorld(e.clientX, e.clientY);
      if (Math.abs(e.clientX - d.sx) < 5 && Math.abs(e.clientY - d.sy) < 5) this.clickSelect(wx, wy, d.shift, d.ctrl);
      else this.boxSelect(d.wx, d.wy, wx, wy, d.shift);
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const steps = [1, 1.25, 1.5, 2, 2.5, 3];
      let i = steps.indexOf(VIEW.scale); if (i < 0) i = 3;
      i = Math.max(0, Math.min(steps.length - 1, i + (e.deltaY > 0 ? -1 : 1)));
      const [cx, cy] = RENDER.toWorld(e.clientX, e.clientY);
      VIEW.scale = steps[i]; RENDER.resize();
      VIEW.x = cx - e.clientX / VIEW.scale; VIEW.y = cy - e.clientY / VIEW.scale; RENDER.clampCam();
    }, { passive: false });
    // 미니맵
    const mm = this.el.mm;
    mm.addEventListener('mousedown', (e) => {
      e.preventDefault(); SND.init();
      if (e.button === 0) {
        if (this.mode && this.mode.kind === 'target') { const [wx, wy] = this.mmWorld(e); this.execMode(wx, wy, e.shiftKey, true); return; }
        this.mmDrag = true; this.minimapAt(e, false);
      } else if (e.button === 2) { const [wx, wy] = this.mmWorld(e); if (this.mode) { this.cancelMode(); return; } this.rightClick(wx, wy, null, e.shiftKey); }
    });
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; if (e.key === 'Shift') this.keys.Shift = false; if (e.key === 'Alt') this.keys.Alt = false; });
    const loseFocus = () => { this.keys = {}; this.mouse.inside = false; this.mouse.drag = null; this.mmDrag = false; };
    window.addEventListener('blur', loseFocus);
    document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); });
    window.addEventListener('resize', () => RENDER.resize());
  },
  mmWorld(e) {
    const r = this.el.mm.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * MAP_W * TILE, (e.clientY - r.top) / r.height * MAP_H * TILE];
  },
  minimapAt(e) { const [wx, wy] = this.mmWorld(e); RENDER.centerOn(wx, wy); },

  keyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
      if (e.key === 'Escape' && this.mode && this.mode.kind === 'spawn') { this.cancelMode(); return; }
      if (e.key === 'F10') { e.preventDefault(); this.toggleTest(); }
      return;
    }
    SND.init();
    this.keys[e.key] = true;
    if (e.key === 'Shift') this.keys.Shift = true;
    if (e.key === 'Alt') { this.keys.Alt = true; e.preventDefault(); }
    const k = e.key;
    if (k === 'F10' || k === '`') { e.preventDefault(); this.toggleTest(); return; }
    if (k === 'F1') { e.preventDefault(); this.el.help.classList.toggle('hidden'); return; }
    if (k === 'F9' || k === 'Pause') { e.preventDefault(); GAME.paused = !GAME.paused; this.message(GAME.paused ? '일시 정지' : '게임 재개'); return; }
    if (k === 'Escape') { if (this.mode) this.cancelMode(); else if (this.menu) { this.menu = null; this.cardSig = ''; } else this.escQueue(); return; }
    if (k === ' ') { e.preventDefault(); if (this.lastAlert) RENDER.centerOn(this.lastAlert[0], this.lastAlert[1]); return; }
    if (k === 'Tab') { e.preventDefault(); return; }
    if (/^[0-9]$/.test(k)) { this.groupKey(+k, e.ctrlKey || e.metaKey, e.shiftKey); e.preventDefault(); return; }
    if (e.code && /^Digit[0-9]$/.test(e.code) && e.shiftKey) { this.groupKey(+e.code.slice(5), false, true); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (k.length === 1) {
      const up = k.toUpperCase();
      const i = this.card.findIndex(b => b && b.key === up && !b.disabled);
      if (i >= 0) { this.pressCard(i, e.shiftKey); e.preventDefault(); }
      else { const j = this.card.findIndex(b => b && b.key === up); if (j >= 0) this.pressCard(j, e.shiftKey); }
    }
  },
  groupKey(n, set, add) {
    const own = this.selection.filter(e => e.owner === GAME.control && !e.dead);
    if (set) { this.groups[n] = own.slice(); this.message('부대 ' + n + ' 지정'); return; }
    if (add) { const g = (this.groups[n] || []).filter(e => !e.dead); for (const e of own) if (!g.includes(e) && g.length < MAX_SELECT) g.push(e); this.groups[n] = g; return; }
    const g = (this.groups[n] || []).filter(e => !e.dead && e.owner === GAME.control && !e.hidden);
    if (!g.length) return;
    const now = performance.now();
    if (this.lastGroup.k === n && now - this.lastGroup.t < 350) { let cx = 0, cy = 0; for (const e of g) { cx += e.x; cy += e.y; } RENDER.centerOn(cx / g.length, cy / g.length); }
    this.lastGroup = { k: n, t: now };
    this.setSelection(g);
  },
  escQueue() {
    const b = this.selection.length === 1 && this.selection[0];
    if (!b || b.owner !== GAME.control) return;
    if (b.isBuilding && b.queue.length) cmdCancelQueue(b, b.queue.length - 1);
    else if (b.isBuilding && (!b.done || b.morph)) cmdCancelConstruction(b);
  },

  // ---------------- 선택 ----------------
  pick(wx, wy) {
    const p = GAME.control;
    let best = null, bs = 1e9;
    for (const e of GAME.entities) {
      if (e.dead || e.hidden) continue;
      if (!isVisibleTo(e, p)) continue;
      if (isCloakedFor(e, p) || (e.burrowed && e.owner !== p)) continue;
      let sc;
      if (e.isBuilding) {
        const ly = e.lifted ? 22 : 0;
        if (wx < e.x - e.hw || wx > e.x + e.hw || wy < e.y - e.hh - ART.ELEV * 0.7 - ly || wy > e.y + e.hh - ly) continue;
        sc = 1000 + dist(wx, wy, e.x, e.y - ly);
        if (e.lifted) sc -= 600;
      } else {
        const d = dist(wx, wy, e.x, e.y);
        if (d > e.r + 5) continue;
        sc = d - (e.air ? 500 : 0);
      }
      if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  },
  selectable(e) { return e && !e.dead && !e.hidden && e.type !== 'spider_mine'; },
  setSelection(arr) {
    const own = arr.filter(e => this.selectable(e));
    this.selection = own.slice(0, MAX_SELECT);
    this.menu = null; this.cardSig = ''; this.infoSig = '';
  },
  clickSelect(wx, wy, shift, ctrl) {
    const e = this.pick(wx, wy);
    const p = GAME.control;
    if (!e) { if (!shift) this.setSelection([]); return; }
    const now = performance.now();
    const dbl = this.lastClick.id === e.id && now - this.lastClick.t < 350;
    this.lastClick = { t: now, id: e.id };
    if ((ctrl || dbl) && e.owner === p && !e.isBuilding) {
      const same = GAME.entities.filter(o => !o.dead && !o.hidden && o.owner === p && o.type === e.type && this.onScreen(o));
      same.sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y));
      this.setSelection(shift ? this.selection.concat(same.filter(o => !this.selection.includes(o))) : same);
      SND.play('click'); return;
    }
    if (shift && e.owner === p && !e.isBuilding && this.selection.every(s => s.owner === p && !s.isBuilding)) {
      const i = this.selection.indexOf(e);
      if (i >= 0) this.selection.splice(i, 1); else if (this.selection.length < MAX_SELECT) this.selection.push(e);
      this.cardSig = ''; this.menu = null; return;
    }
    this.setSelection([e]);
    SND.play('click');
  },
  onScreen(e) { return e.x > VIEW.x && e.x < VIEW.x + VIEW.w && e.y > VIEW.y && e.y < VIEW.y + VIEW.h - this.consoleH() / VIEW.scale; },
  boxSelect(x0, y0, x1, y1, shift) {
    const p = GAME.control;
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const inBox = (e) => e.x + (e.r || 0) * 0.5 >= ax && e.x - (e.r || 0) * 0.5 <= bx && e.y + (e.r || 0) * 0.5 >= ay && e.y - (e.r || 0) * 0.5 <= by;
    let c = GAME.entities.filter(e => !e.dead && !e.hidden && e.owner === p && !e.isBuilding && e.type !== 'spider_mine' && inBox(e));
    const nonLarva = c.filter(e => e.type !== 'larva' && e.type !== 'egg' && e.type !== 'lurker_egg');
    if (nonLarva.length) c = nonLarva;
    if (!c.length) {
      const b = GAME.entities.find(e => !e.dead && !e.hidden && e.owner === p && e.isBuilding && inBox(e));
      if (b) c = [b];
    }
    if (!c.length) { const any = GAME.entities.find(e => !e.dead && !e.hidden && e.owner !== p && inBox(e) && isVisibleTo(e, p) && !isCloakedFor(e, p)); if (any) c = [any]; }
    if (!c.length) { if (!shift) this.setSelection([]); return; }
    if (shift && this.selection.every(s => s.owner === p && !s.isBuilding) && !c[0].isBuilding) c = this.selection.concat(c.filter(e => !this.selection.includes(e)));
    this.setSelection(c);
    SND.play('click');
  },
  own() { return this.selection.filter(e => !e.dead && e.owner === GAME.control); },

  rightClick(wx, wy, tgt, shift) {
    const us = this.own();
    if (!us.length) return;
    if (tgt && tgt.owner !== GAME.control && isCloakedFor(tgt, GAME.control)) tgt = null;
    smartCommand(us, wx, wy, tgt, shift);
  },

  // ---------------- 모드 (타겟팅/배치/스폰) ----------------
  setMode(m) { this.mode = m; this.cardSig = ''; },
  cancelMode() { this.mode = null; this.cardSig = ''; },
  execMode(wx, wy, shift, fromMinimap) {
    const m = this.mode;
    const us = this.own();
    const tgt = fromMinimap ? null : this.pick(wx, wy);
    const keep = shift;
    if (m.kind === 'place') {
      const d = BUILDINGS[m.bt];
      let [tx, ty] = this.placeTile(wx, wy, m.bt);
      const builders = us.filter(u => u.isWorker && u.race === d.race);
      if (!builders.length) { this.cancelMode(); return; }
      if (!canPlace(m.bt, tx, ty, GAME.control, builders[0])) { SND.play('err'); return; }
      if (costFail(GAME.control, d.cost)) return;
      builders.sort((a, b) => dist(a.x, a.y, wx, wy) - dist(b.x, b.y, wx, wy));
      const w = builders[0];
      w.issue({ t: 'build', bt: m.bt, tx, ty }, shift);
      this.clickFx((tx + d.w / 2) * TILE, (ty + d.h / 2) * TILE, 'move');
      if (!keep) this.cancelMode();
      return;
    }
    if (m.kind === 'land') {
      const b = m.b, d = b.def;
      const [tx, ty] = this.placeTile(wx, wy, b.type);
      if (!canPlace(b.type, tx, ty, b.owner, b)) { SND.play('err'); return; }
      b.issue({ t: 'land', tx, ty }); this.cancelMode(); return;
    }
    if (m.kind === 'spawn') {
      this.spawnAt(wx, wy);
      if (!keep && !this.keys.Shift) { /* 스폰 모드는 유지 — 우클릭/ESC로 종료 */ }
      return;
    }
    // 타겟 명령
    const c = m.cmd;
    const p = GAME.control;
    if (c === 'move') { if (tgt && tgt !== us[0]) smartCommand(us.filter(u => !u.isBuilding || u.lifted), wx, wy, tgt.owner === p ? tgt : null, shift); else commandUnits(us, { t: 'move', x: wx, y: wy }, shift); this.clickFx(wx, wy, 'move'); }
    else if (c === 'attack') {
      if (tgt && tgt.owner !== p && tgt.owner !== NEUTRAL || tgt && tgt.owner === p && tgt !== us[0] && false) {
        for (const u of us) if (u.canAttack && u.weaponVs(tgt)) u.issue({ t: 'attack', tgt }, shift); else u.issue({ t: 'amove', x: wx, y: wy }, shift);
      } else if (tgt && tgt !== us[0] && !tgt.def.resource) {
        for (const u of us) if (u.canAttack && u.weaponVs(tgt)) u.issue({ t: 'attack', tgt }, shift);
      } else commandUnits(us.filter(u => u.canAttack || u.def.healer), { t: 'amove', x: wx, y: wy }, shift);
      this.clickFx(wx, wy, 'attack');
    } else if (c === 'patrol') { commandUnits(us, { t: 'patrol', x: wx, y: wy }, shift); this.clickFx(wx, wy, 'move'); }
    else if (c === 'gather') {
      if (!tgt || !(tgt.type === 'mineral' || tgt.type === 'geyser' || (tgt.def.onGeyser && tgt.owner === p && tgt.done))) { this.message('자원을 선택해야 합니다.'); SND.play('err'); return; }
      for (const u of us) if (u.isWorker) { u.issue({ t: 'gather', tgt, phase: 'go' }, shift); u.lastRes = tgt; }
      this.clickFx(tgt.x, tgt.y, 'gather');
    } else if (c === 'repair') {
      if (!tgt || tgt.owner !== p || !(tgt.isBuilding || tgt.def.mech) || tgt.race !== 'T') { this.message('수리할 대상을 선택하세요.'); SND.play('err'); return; }
      for (const u of us) if (u.isWorker && u.race === 'T') u.issue(tgt.done ? { t: 'repair', tgt } : { t: 'construct', tgt }, shift);
      this.clickFx(tgt.x, tgt.y, 'gather');
    } else if (c === 'load') {
      if (!tgt) return;
      for (const u of us) {
        if (u.def.cargo && canLoad(u, tgt)) u.issue({ t: 'pickup', tgt }, shift);
        else if (tgt.def.cargo && canLoad(tgt, u)) u.issue({ t: 'load', tgt }, shift);
      }
    } else if (c === 'unload') { for (const u of us) if (u.def.cargo && u.cargo.length) u.issue({ t: 'unload', x: wx, y: wy }, shift); this.clickFx(wx, wy, 'move'); }
    else if (c === 'rally') { for (const b of us) if (b.isBuilding) b.rally = tgt && tgt !== b ? { tgt, x: tgt.x, y: tgt.y } : { x: wx, y: wy }; this.clickFx(wx, wy, 'rally'); }
    else if (c === 'spell') {
      const s = SPELLS[m.s];
      if (m.s === 'spider_mine') {
        const v = us.filter(u => u.type === 'vulture' && u.mines > 0).sort((a, b) => dist(a.x, a.y, wx, wy) - dist(b.x, b.y, wx, wy))[0];
        if (v) v.issue({ t: 'mine', x: wx, y: wy }, shift);
      } else {
        if (s.target === 'unit' && !tgt) { this.message('대상을 선택해야 합니다.'); SND.play('err'); return; }
        const casters = us.filter(u => (u.def.spells || []).includes(m.s) && spellTechOk(u, m.s) && (!s.energy || u.energy >= s.energy));
        if (!casters.length) { notify(p, 'energy', '에너지가 부족합니다.', 'err'); this.cancelMode(); return; }
        casters.sort((a, b) => dist(a.x, a.y, wx, wy) - dist(b.x, b.y, wx, wy));
        casters[0].issue({ t: 'spell', s: m.s, tgt: s.target === 'unit' ? tgt : null, x: wx, y: wy }, shift);
      }
      this.clickFx(wx, wy, 'attack');
    }
    if (!keep) this.cancelMode();
  },
  placeTile(wx, wy, bt) {
    const d = BUILDINGS[bt];
    if (d.onGeyser) {
      let best = null, bd = 1e9;
      for (const g of GAME.entities) { if (g.dead || g.type !== 'geyser') continue; const dd = dist(g.x, g.y, wx, wy); if (dd < bd) { bd = dd; best = g; } }
      if (best && bd < 96) return [best.tx0, best.ty0];
    }
    return [Math.round(wx / TILE - d.w / 2), Math.round(wy / TILE - d.h / 2)];
  },

  // ---------------- 커맨드 카드 ----------------
  buildCard() {
    const p = GAME.control;
    const card = new Array(9).fill(null);
    const us = this.own();
    if (!us.length) return card;
    const B = (icon, key, name, fn, o) => Object.assign({ icon, key, name, fn }, o || {});
    const cancelBtn = () => B(ART.cmdIcon('cancel'), 'ESCAPE', '취소', () => this.cancelMode());
    if (this.mode) { card[8] = cancelBtn(); card[8].key = 'X'; return card; }
    const u0 = us[0];
    const types = new Set(us.map(u => u.type));
    const pl = P(p);
    // 건설 메뉴
    if (this.menu === 'build' || this.menu === 'advbuild') {
      const list = BUILD_MENU[u0.race][this.menu === 'build' ? 0 : 1];
      list.forEach((bt, i) => {
        const d = BUILDINGS[bt];
        const miss = missingReq(p, d.req);
        card[i] = B(ART.icon(bt, p), BUILD_KEYS[bt], d.name, () => {
          if (miss) { notify(p, 'req', BUILDINGS[miss].name + ' 이(가) 필요합니다.', 'err'); return; }
          if (costFail(p, d.cost)) return;
          this.menu = null; this.setMode({ kind: 'place', bt });
        }, { cost: d.cost, disabled: !!miss, desc: miss ? '필요: ' + BUILDINGS[miss].name : (d.provides ? '인구수 +' + d.provides : '') });
      });
      card[8] = B(ART.cmdIcon('back'), 'ESCAPE', '뒤로', () => { this.menu = null; this.cardSig = ''; });
      return card;
    }
    // 건물
    if (u0.isBuilding && us.length === 1) {
      const b = u0, d = b.def;
      if (!b.done) { card[8] = B(ART.cmdIcon('cancel'), 'ESCAPE', '건설 취소', () => cmdCancelConstruction(b), { desc: '비용의 75% 환불' }); return card; }
      if (b.lifted) {
        card[0] = B(ART.cmdIcon('move'), 'M', '이동', () => this.setMode({ kind: 'target', cmd: 'move' }));
        card[1] = B(ART.cmdIcon('stop'), 'S', '정지', () => { b.orders = []; });
        card[8] = B(ART.cmdIcon('land'), 'L', '착륙', () => this.setMode({ kind: 'land', b }));
        return card;
      }
      if (b.morph) { card[8] = B(ART.cmdIcon('cancel'), 'ESCAPE', '변태 취소', () => cmdCancelConstruction(b)); return card; }
      let i = 0;
      for (const t of d.produces || []) {
        const ud = UNITS[t], miss = missingReq(p, ud.req) || (ud.addon && !attachedAddon(b, ud.addon) ? ud.addon : null);
        card[i++] = B(ART.icon(t, p), ud.hotkey, ud.name, () => cmdTrain(b, t), { cost: ud.cost, sup: ud.supply, disabled: !!miss, desc: miss ? '필요: ' + BUILDINGS[miss].name : '' });
      }
      for (const t of d.addons || []) {
        if (i >= 7 || attachedAddon(b)) break;
        const ad = BUILDINGS[t], miss = missingReq(p, ad.req);
        card[i++] = B(ART.icon(t, p), t === 'physics_lab' ? 'P' : 'C', ad.name + ' 부속 건물', () => cmdAddon(b, t), { cost: ad.cost, disabled: !!miss || b.queue.length > 0, desc: '오른쪽에 연결 · ' + (miss ? '필요: ' + BUILDINGS[miss].name : '빈 공간 필요') });
      }
      for (const t of d.research || []) {
        if (i >= 8) break;
        const td = TECH[t];
        if (!td) continue;
        const lvl = td.lv ? upgLevel(p, t) : 0;
        if (td.lv ? lvl >= td.lv : pl.tech[t]) continue;
        const miss = techReq(p, t), busy = pl.researching[t];
        card[i++] = B(ART.cmdIcon(t), td.hotkey, td.name + (td.lv ? ' ' + (lvl + 1) + '단계' : ''), () => cmdResearch(b, t), { cost: techCost(p, t), disabled: !!miss || busy, desc: busy ? '연구 중' : miss ? '필요: ' + BUILDINGS[miss].name : td.desc });
      }
      for (const s of d.spells || []) {
        const S = SPELLS[s];
        if (s === 'select_larva') { card[i++] = B(ART.icon('larva', p), 'S', '라바 선택', () => { const ls = GAME.entities.filter(e => !e.dead && e.type === 'larva' && e.hatch === b); if (ls.length) this.setSelection(ls); }); continue; }
        if (S.morph) {
          const md = BUILDINGS[S.morph], miss = missingReq(p, S.req);
          card[i++] = B(ART.icon(S.morph, p), S.hotkey, S.name, () => cmdBuildingMorph(b, S.morph), { cost: md.cost, disabled: !!miss || b.queue.length > 0, desc: miss ? '필요: ' + BUILDINGS[miss].name : S.desc });
          continue;
        }
        if (s === 'lift') { card[i++] = B(ART.cmdIcon('lift'), 'L', '이륙', () => cmdInstant([b], 'lift'), { disabled: b.queue.length > 0 }); continue; }
        if (s === 'arm_nuke') { card[i++] = B(ART.cmdIcon(s), 'N', b.nukeReady ? '핵무기 준비 완료' : b.nukeBuild ? '핵무기 생산 중' : S.name, () => cmdInstant([b], s), { cost: S.cost, disabled: !!b.nukeReady || !!b.nukeBuild, desc: S.desc }); continue; }
        if (S.target === 'unit') { card[i++] = B(ART.cmdIcon(s), S.hotkey, S.name, () => this.setMode({ kind: 'target', cmd: 'spell', s }), { desc: S.desc }); continue; }
        if (S.target === 'point') {
          const miss = S.req ? missingReq(p, S.req) : null;
          card[i++] = B(ART.cmdIcon(s), S.hotkey, S.name, () => { if (miss) { notify(p, 'req', BUILDINGS[miss].name + ' 이(가) 필요합니다.', 'err'); return; } if (b.energy < S.energy) { notify(p, 'energy', '에너지가 부족합니다.', 'err'); return; } this.setMode({ kind: 'target', cmd: 'spell', s }); }, { energy: S.energy, disabled: !!miss, desc: S.desc });
        }
      }
      if (d.cargo && b.cargo.length) card[i++] = B(ART.cmdIcon('unload'), 'U', '모두 내리기', () => unloadAll(b));
      if (d.produces || d.larvaHall) card[7] = card[7] || B(ART.cmdIcon('rally'), 'R', '집결 지점', () => this.setMode({ kind: 'target', cmd: 'rally' }));
      if (b.queue.length) card[8] = B(ART.cmdIcon('cancel'), 'ESCAPE', '취소', () => cmdCancelQueue(b, b.queue.length - 1));
      return card;
    }
    const mob = us.filter(u => !u.isBuilding);
    if (!mob.length) return card;
    // 라바
    if (mob.every(u => u.type === 'larva')) {
      let i = 0;
      for (const t of Object.keys(UNITS)) {
        const ud = UNITS[t];
        if (ud.from !== 'larva') continue;
        const miss = missingReq(p, ud.req);
        card[i++] = B(ART.icon(t, p), ud.hotkey, ud.name, () => cmdMorphLarva(mob, t), { cost: ud.cost, sup: ud.pair ? ud.supply * 2 : ud.supply, disabled: !!miss, desc: miss ? '필요: ' + BUILDINGS[miss].name : ud.pair ? '2마리 생산' : '' });
        if (i >= 9) break;
      }
      return card;
    }
    if (mob.every(u => u.type === 'egg' || u.type === 'lurker_egg')) return card;
    const single = types.size === 1;
    const burrowed = single && u0.burrowed;
    const canAtk = mob.some(u => u.canAttack);
    if (burrowed) {
      if (u0.type === 'lurker') { card[1] = B(ART.cmdIcon('stop'), 'S', '정지', () => { for (const u of mob) u.orders = []; }); card[2] = B(ART.cmdIcon('attack'), 'A', '공격', () => this.setMode({ kind: 'target', cmd: 'attack' })); card[4] = B(ART.cmdIcon('hold'), 'H', '위치 사수', () => commandUnits(mob, { t: 'hold' })); }
      card[8] = B(ART.cmdIcon('unburrow'), 'U', '언버로우', () => cmdInstant(mob, 'unburrow'));
      return card;
    }
    const siege = single && u0.type === 'tank_siege';
    if (!siege) card[0] = B(ART.cmdIcon('move'), 'M', '이동', () => this.setMode({ kind: 'target', cmd: 'move' }));
    card[1] = B(ART.cmdIcon('stop'), 'S', '정지', () => commandUnits(mob, { t: 'stop' }));
    if (canAtk) card[2] = B(ART.cmdIcon('attack'), 'A', '공격', () => this.setMode({ kind: 'target', cmd: 'attack' }));
    const allWorkers = mob.every(u => u.isWorker);
    if (allWorkers) {
      if (mob.every(u => u.race === 'T')) card[3] = B(ART.cmdIcon('repair'), 'R', '수리', () => this.setMode({ kind: 'target', cmd: 'repair' }));
      card[4] = B(ART.cmdIcon('gather'), 'G', '자원 채취', () => this.setMode({ kind: 'target', cmd: 'gather' }));
      card[5] = B(ART.cmdIcon('ret'), 'C', '자원 반환', () => { for (const u of mob) if (u.carry > 0) u.issue({ t: 'ret' }, this.keys.Shift); });
      if (single || mob.every(u => u.race === u0.race)) {
        card[6] = B(ART.cmdIcon('build'), 'B', '기본 건물', () => { this.menu = 'build'; this.cardSig = ''; });
        card[7] = B(ART.cmdIcon('advbuild'), 'V', '고급 건물', () => { this.menu = 'advbuild'; this.cardSig = ''; });
      }
      if (single && u0.race === 'Z') card[8] = B(ART.cmdIcon('burrow'), 'U', '버로우', () => cmdInstant(mob, 'burrow'), { disabled: !spellTechOk(u0, 'burrow') });
      return card;
    }
    if (!siege) { card[3] = B(ART.cmdIcon('patrol'), 'P', '정찰', () => this.setMode({ kind: 'target', cmd: 'patrol' })); }
    card[4] = B(ART.cmdIcon('hold'), 'H', '위치 사수', () => commandUnits(mob, { t: 'hold' }));
    const slots = [6, 7, 8, 5];
    let si = 0;
    const put = (b) => { if (si < slots.length) card[slots[si++]] = b; };
    if (single && u0.def.cargo && (u0.type !== 'overlord' || hasTech(p, 'ventral'))) {
      put(B(ART.cmdIcon('load'), 'L', '태우기', () => this.setMode({ kind: 'target', cmd: 'load' })));
      put(B(ART.cmdIcon('unload'), 'U', '모두 내리기', () => this.setMode({ kind: 'target', cmd: 'unload' }), { disabled: !mob.some(u => u.cargo.length) }));
    }
    if (single) {
      if (u0.def.ammo) put(B(ART.icon(u0.type, p), u0.type === 'carrier' ? 'I' : 'R', (u0.type === 'carrier' ? '인터셉터' : '스캐럽') + ' 생산 (' + (u0.ammo || 0) + '/' + ammoCapacity(u0) + ')', () => { for (const u of mob) cmdAmmo(u); }, { cost: [u0.type === 'carrier' ? 25 : 15, 0], desc: '생산 대기 ' + (u0.ammoQueue || []).length, disabled: (u0.ammo || 0) + (u0.ammoQueue || []).length >= ammoCapacity(u0) }));
      for (const s of u0.def.spells || []) {
        const S = SPELLS[s];
        if (!S) continue;
        const ok = spellTechOk(u0, s);
        let name = S.name, desc = S.desc;
        if (s === 'spider_mine') name += ' (' + mob.reduce((a, u) => a + (u.mines || 0), 0) + ')';
        if (s === 'cloak' && mob.some(u => u.cloaked)) name = '클로킹 해제';
        const fn = () => {
          if (!ok) { notify(p, 'tech', (S.tech || (S.techBy && S.techBy[u0.type])) ? TECH[S.tech || S.techBy[u0.type]].name + ' 연구가 필요합니다.' : '사용할 수 없습니다.', 'err'); return; }
          if (S.target === 'none') { cmdInstant(mob, s); this.cardSig = ''; return; }
          if (s === 'heal') return;
          if (S.energy && !mob.some(u => u.energy >= S.energy)) { notify(p, 'energy', '에너지가 부족합니다.', 'err'); return; }
          this.setMode({ kind: 'target', cmd: 'spell', s });
        };
        put(B(ART.cmdIcon(s), S.hotkey, name, fn, { disabled: !ok || (s === 'spider_mine' && !mob.some(u => u.mines > 0)), energy: S.energy, cost: S.cost, desc: desc + (s === 'heal' ? '' : '') }));
      }
    }
    return card;
  },
  pressCard(i, shift) {
    const b = this.card[i];
    if (!b) return;
    if (b.disabled && !b.fn) return;
    SND.play('click');
    b.fn(shift);
    this.cardSig = '';
  },
  renderCard() {
    this.card = this.buildCard();
    const pl = P(GAME.control);
    const sig = this.card.map(b => b ? b.name + (b.disabled ? 0 : 1) + (b.cost && pl && !canAfford(GAME.control, b.cost) ? 'x' : '') : '-').join('|');
    if (sig === this.cardSig) return;
    this.cardSig = sig;
    const btns = this.el.cmd.children;
    for (let i = 0; i < 9; i++) {
      const b = this.card[i], el = btns[i];
      if (!b) { el.className = 'btn empty'; el.querySelector('img').removeAttribute('src'); el.querySelector('.hk').textContent = ''; continue; }
      el.className = 'btn' + (b.disabled ? ' dis' : '') + (b.cost && !canAfford(GAME.control, b.cost) ? ' poor' : '');
      el.querySelector('img').src = b.icon;
      el.querySelector('.hk').textContent = b.key === 'ESCAPE' ? 'Esc' : b.key;
    }
  },
  showTip(i, el) {
    const b = this.card[i];
    if (!b) return;
    let h = '<b>' + b.name + '</b> <span class="k">[' + (b.key === 'ESCAPE' ? 'Esc' : b.key) + ']</span>';
    if (b.cost && (b.cost[0] || b.cost[1])) h += '<br><span class="m">◆ ' + b.cost[0] + '</span> <span class="g">▲ ' + b.cost[1] + '</span>';
    if (b.sup) h += ' <span class="s">⌂ ' + supplyText(b.sup) + '</span>';
    if (b.energy) h += ' <span class="e">✦ ' + b.energy + '</span>';
    if (b.desc) h += '<br><small>' + b.desc + '</small>';
    const t = this.el.tip; t.innerHTML = h; t.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    t.style.left = Math.min(window.innerWidth - 240, r.left - 60) + 'px'; t.style.bottom = (window.innerHeight - r.top + 6) + 'px';
  },
  hideTip() { this.el.tip.classList.add('hidden'); },

  // ---------------- 정보 패널 ----------------
  renderInfo() {
    const sel = this.selection = this.selection.filter(e => !e.dead && !e.hidden);
    const el = this.el.info;
    if (!sel.length) { if (this.infoSig !== 'none') { el.innerHTML = ''; this.infoSig = 'none'; } return; }
    if (sel.length > 1) {
      const sig = 'm' + sel.map(e => e.id + ':' + Math.ceil(e.hp / e.maxHp * 3)).join(',');
      if (sig !== this.infoSig) {
        this.infoSig = sig;
        el.innerHTML = '<div class="multi">' + sel.map((e, i) => '<div class="wf" data-i="' + i + '"><img src="' + ART.wireframe(e.type, e.owner, e.hp / e.maxHp) + '"></div>').join('') + '</div>';
        el.querySelectorAll('.wf').forEach(w => w.addEventListener('mousedown', (ev) => {
          ev.stopPropagation(); const e = sel[+w.dataset.i]; if (!e) return;
          if (ev.shiftKey) { this.selection.splice(this.selection.indexOf(e), 1); this.cardSig = ''; this.infoSig = ''; }
          else if (ev.ctrlKey) this.setSelection(sel.filter(o => o.type === e.type));
          else { this.setSelection([e]); }
        }));
      }
      return;
    }
    const e = sel[0], d = e.def, p = GAME.control;
    const own = e.owner === p;
    if (this.infoSig.split('#')[0] !== 's' + e.id + e.type) {
      el.innerHTML = '<div class="single"><div class="wfb"><img class="wfi"></div><div class="stats"><div class="nm"></div><div class="hp"></div><div class="ln2"></div><div class="ln3"></div></div><div class="extra"></div></div>';
      this.infoSig = 's' + e.id + e.type;
      el.querySelector('.extra').addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        const q = ev.target.closest('[data-q]'), c = ev.target.closest('[data-c]');
        if (q && e.owner === GAME.control) cmdCancelQueue(e, +q.dataset.q);
        if (c && e.owner === GAME.control) { const u = e.cargo[+c.dataset.c]; if (u) unloadUnit(e, u); }
      });
    }
    const hf = e.hp / e.maxHp;
    el.querySelector('.wfi').src = ART.wireframe(e.type, e.owner, hf);
    const nameT = (d.name || e.type) + (e.owner !== p && e.owner !== NEUTRAL ? ' <span class="en">(적)</span>' : '');
    el.querySelector('.nm').innerHTML = nameT;
    let hpT = '';
    if (d.resource) hpT = '';
    else hpT = '<span style="color:' + (hf > 0.66 ? '#30ff30' : hf > 0.33 ? '#ffff30' : '#ff3030') + '">' + Math.ceil(e.hp) + '/' + e.maxHp + '</span>' + (e.maxSh ? ' <span class="sh">' + Math.ceil(e.sh) + '/' + e.maxSh + '</span>' : '');
    el.querySelector('.hp').innerHTML = hpT;
    let l2 = '', l3 = '';
    if (d.resource) l2 = (d.resource === 'min' ? '미네랄: ' : '베스핀 가스: ') + Math.floor(e.amount || 0);
    else if (e.def.onGeyser && e.geyser) l2 = '남은 가스: ' + Math.floor(e.geyser.amount || 0);
    else if (!e.isBuilding || e.canAttack) {
      const w = d.gw || d.aw;
      const parts = [];
      if (w) { const up = w.upg && w.upg !== 'none' ? upgLevel(e.owner, w.upg) : 0; parts.push('공격 ' + w.dmg + (up ? '+' + (w.inc || 1) * up : '') + (w.hits > 1 ? '×' + w.hits : '')); }
      parts.push('방어 ' + e.armor);
      if (e.maxEnergy) parts.push('<span class="e">에너지 ' + Math.floor(e.energy) + '/' + e.maxEnergy + '</span>');
      l2 = parts.join(' · ');
      if (!e.isBuilding) l3 = '처치 ' + e.kills + (d.supply ? ' · 인구 ' + supplyText(d.pair ? d.supply : d.supply) : '');
    } else if (e.maxEnergy) l2 = '에너지 ' + Math.floor(e.energy) + '/' + e.maxEnergy;
    else if (d.provides && e.done) { const pp = P(e.owner); if (pp) l2 = '제공 인구: ' + d.provides + ' · 사용 ' + supplyText(pp.used) + '/' + pp.max; }
    if (d.ammo) l3 += ' · 탄약 ' + (e.ammo || 0) + '/' + ammoCapacity(e) + ' · 생산 대기 ' + (e.ammoQueue || []).length;
    if (e.nukeReady || e.nukeBuild) l2 += e.nukeReady ? ' · 핵무기 준비 완료' : ' · 핵무기 생산 ' + Math.floor(e.nukeBuild / 15) + '%';
    if (e.blinded) l3 += ' · 실명';
    if (e.parasiteOwner !== undefined) l3 += ' · 패러사이트';
    if (e.stasisT > 0) l3 += ' · 스테이시스';
    if (e.maelstromT > 0) l3 += ' · 메일스트롬';
    if (e.acidSpores) l3 += ' · 애시드 스포어 ' + e.acidSpores;
    if (e.hallucination && own) l3 += ' · 환상';
    if (e.type === 'egg' || e.type === 'lurker_egg') l2 = (UNITS[e.morphTo] ? UNITS[e.morphTo].name : '') + ' 변태 중';
    el.querySelector('.ln2').innerHTML = l2;
    el.querySelector('.ln3').innerHTML = l3;
    // 추가 정보: 생산 대기열 / 건설 진행 / 수송 칸
    let x = '';
    const bar = (f, label) => '<div class="pbar"><div style="width:' + Math.floor(f * 100) + '%"></div><span>' + label + '</span></div>';
    if (own || GAME.revealAll) {
      if (e.isBuilding && !e.done) x = bar((e.prog || 0) / d.time, '건설 중 ' + Math.floor((e.prog || 0) / d.time * 100) + '%');
      else if (e.morph) x = bar(e.morph.prog / e.morph.total, BUILDINGS[e.morph.to].name + ' 변태 중');
      else if (e.type === 'egg' || e.type === 'lurker_egg') x = bar((e.prog || 0) / (e.total || 1), '변태');
      else if (e.queue.length) {
        const q0 = e.queue[0];
        x = '<div class="queue">' + [0, 1, 2, 3, 4].map(i => { const q = e.queue[i]; return '<div class="qs' + (q ? '' : ' empty') + '" data-q="' + i + '">' + (q ? '<img src="' + (q.kind === 'unit' ? ART.icon(q.type, e.owner) : ART.cmdIcon(q.type)) + '">' : '') + '</div>'; }).join('') + '</div>' +
          bar(q0.prog / q0.total, (q0.kind === 'unit' ? UNITS[q0.type].name : TECH[q0.type].name) + ' ' + Math.floor(q0.prog / q0.total * 100) + '%');
      } else if (e.cargo && e.cargo.length) {
        x = '<div class="queue">' + e.cargo.map((u, i) => '<div class="qs" data-c="' + i + '"><img src="' + ART.icon(u.type, u.owner) + '"></div>').join('') + '</div>';
      } else if (e.xform) x = bar(1 - e.xform.t / 40, '모드 전환');
    }
    const ex = el.querySelector('.extra');
    if (ex._h !== x) { ex.innerHTML = x; ex._h = x; }
  },

  // ---------------- 메시지 / 경보 ----------------
  message(text) {
    if (!text) return;
    const d = document.createElement('div'); d.className = 'msg'; d.textContent = text;
    this.el.msgs.appendChild(d);
    while (this.el.msgs.children.length > 6) this.el.msgs.firstChild.remove();
    setTimeout(() => { d.classList.add('fade'); setTimeout(() => d.remove(), 800); }, 5000);
  },
  underAttack(e) {
    if (GAME.tick - this.alertT < 24 * 8) { this.lastAlert = [e.x, e.y]; return; }
    const vis = this.onScreen(e);
    this.alertT = GAME.tick; this.lastAlert = [e.x, e.y];
    this.pings.push({ x: e.x, y: e.y, t: 0 });
    if (!vis) {
      const r = P(e.owner).race;
      const txt = e.isBuilding ? (r === 'Z' ? '군락이 공격받고 있습니다!' : '기지가 공격받고 있습니다!') : (e.isWorker ? '일꾼이 공격받고 있습니다!' : '병력이 공격받고 있습니다!');
      this.message(txt + ' (Space: 이동)');
      SND.play('alert');
    }
  },
  clickFx(x, y, kind) { this.clicks.push({ x, y, kind, t: 0 }); },

  // ---------------- 월드 오버레이 ----------------
  drawWorldOverlay(ctx) {
    // 클릭 표시
    for (const c of this.clicks) {
      const k = c.t / 14, r = 8 * (1 - k) + 2;
      ctx.strokeStyle = c.kind === 'attack' ? '#ff3030' : c.kind === 'gather' ? '#ffff40' : c.kind === 'rally' ? '#40ff40' : '#30ff30';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.6, 0, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x - r, c.y); ctx.lineTo(c.x + r, c.y); ctx.moveTo(c.x, c.y - r * 0.6); ctx.lineTo(c.x, c.y + r * 0.6); ctx.stroke();
      c.t++;
    }
    this.clicks = this.clicks.filter(c => c.t < 14);
    const m = this.mode, [wx, wy] = RENDER.toWorld(this.mouse.x, this.mouse.y);
    if (m && (m.kind === 'place' || m.kind === 'land')) {
      const bt = m.kind === 'place' ? m.bt : m.b.type, d = BUILDINGS[bt];
      const [tx, ty] = this.placeTile(wx, wy, bt);
      const s = ART.building(bt, GAME.control, '');
      ctx.globalAlpha = 0.55; ctx.drawImage(s.c, (tx + d.w / 2) * TILE - s.ox, (ty + d.h / 2) * TILE - s.oy); ctx.globalAlpha = 1;
      const builder = m.kind === 'land' ? m.b : this.own()[0];
      const okAll = canPlace(bt, tx, ty, GAME.control, builder, true);
      for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
        let ok = okAll;
        if (!okAll && inMap(x, y) && !d.onGeyser) {
          const i = tIdx(x, y);
          ok = MAP.buildable[i] && (!MAP.occ[i] || (m.kind === 'land' && MAP.occ[i] === m.b.id)) && (GAME.explored[GAME.control][i] || GAME.revealAll) && (d.race === 'Z' ? (d.noCreepNeeded || MAP.creep[i]) : !MAP.creep[i]);
          if (d.race === 'P' && !d.noPower && !isPowered(GAME.control, (tx + d.w / 2) * TILE, (ty + d.h / 2) * TILE)) ok = false;
        }
        ctx.fillStyle = ok ? 'rgba(40,255,40,0.28)' : 'rgba(255,30,30,0.4)';
        ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      }
      if (d.pylon || d.race === 'P') this.drawPylonFields(ctx);
    }
    if (m && m.kind === 'target' && m.cmd === 'spell') {
      const rad = { storm: 48, dark_swarm: 80, plague: 64, emp: 64, scan: 10 * TILE }[m.s];
      if (rad) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(wx, wy, rad, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (m && m.kind === 'spawn' && this.mouse.inside && !this.mouse.overUI) {
      const t = m.type;
      const layout = this.spawnLayout(wx, wy);
      ctx.globalAlpha = 0.6;
      if (UNITS[t]) {
        const s = ART.unit(t, m.owner, Math.PI / 2, 0);
        for (const p of layout) {
          ctx.drawImage(s.c, p.x - s.h, p.y - s.h);
          ctx.strokeStyle = p.valid ? '#30ff60' : '#ff4040'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, UNITS[t].r, UNITS[t].r * .6, 0, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (BUILDINGS[t]) {
        const d = BUILDINGS[t], s = ART.building(t, m.owner, ''), p = layout[0];
        ctx.drawImage(s.c, p.x - s.ox, p.y - s.oy);
        ctx.fillStyle = p.valid ? 'rgba(40,255,40,0.28)' : 'rgba(255,30,30,0.4)';
        ctx.fillRect(p.tx * TILE, p.ty * TILE, d.w * TILE, d.h * TILE);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif'; ctx.fillText('×' + layout.length + ' ' + (m.owner === ENEMY ? '적군' : '아군'), wx + 10, wy - 10);
    }
    // 드래그 박스
    const dr = this.mouse.drag;
    if (dr) {
      const [x0, y0] = [dr.wx, dr.wy];
      if (Math.abs(this.mouse.x - dr.sx) > 4 || Math.abs(this.mouse.y - dr.sy) > 4) {
        ctx.strokeStyle = '#20ff20'; ctx.lineWidth = 1;
        ctx.strokeRect(Math.min(x0, wx) + 0.5, Math.min(y0, wy) + 0.5, Math.abs(wx - x0), Math.abs(wy - y0));
      }
    }
  },
  drawPylonFields(ctx) {
    ctx.fillStyle = 'rgba(80,160,255,0.12)';
    for (const e of GAME.entities) if (!e.dead && e.def.pylon && e.done && e.owner === GAME.control) { ctx.beginPath(); ctx.ellipse(e.x, e.y, 8 * TILE, 5 * TILE, 0, 0, 6.283); ctx.fill(); }
  },

  // ---------------- 미니맵 ----------------
  drawMinimap() {
    const g = this.mmCtx, p = GAME.control;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mmTerrain, 0, 0);
    // 크립
    g.fillStyle = 'rgba(110,60,100,0.9)';
    const ex = GAME.explored[p], v = GAME.vis[p];
    for (let i = 0; i < MAP.creep.length; i++) if (MAP.creep[i] && (ex[i] || GAME.revealAll)) g.fillRect(i % MAP_W, (i / MAP_W) | 0, 1, 1);
    if (!GAME.revealAll) {
      const d = this.mmFogImg.data;
      for (let i = 0, o = 3; i < v.length; i++, o += 4) d[o] = (v[i] & 1) ? 0 : ex[i] ? 130 : 255;
      this.mmFogCtx.putImageData(this.mmFogImg, 0, 0);
      g.drawImage(this.mmFog, 0, 0);
    }
    // 잔상 건물
    for (const gh of GAME.ghosts[p].values()) { const d = BUILDINGS[gh.type]; g.fillStyle = TEAM[gh.owner].mm; g.fillRect(gh.tx0 !== undefined ? gh.tx0 : tileOf(gh.x) - 1, gh.ty0 !== undefined ? gh.ty0 : tileOf(gh.y) - 1, d ? d.w : 2, d ? d.h : 2); }
    for (const e of GAME.entities) {
      if (e.dead || e.hidden) continue;
      if (e.owner !== p && !isVisibleTo(e, p)) continue;
      if (e.owner !== p && e.owner !== NEUTRAL && isCloakedFor(e, p)) continue;
      const tx = tileOf(e.x), ty = tileOf(e.y);
      if (e.def.resource) { g.fillStyle = e.type === 'mineral' ? '#40b0ff' : '#30c030'; g.fillRect(e.tx0, e.ty0, e.def.w, e.def.h); continue; }
      g.fillStyle = this.selection.includes(e) ? '#ffffff' : TEAM[e.owner].mm;
      if (e.isBuilding) g.fillRect(tileOf(e.x - e.hw), tileOf(e.y - e.hh), e.def.w, e.def.h);
      else { const s = e.r > 14 ? 3 : 2; g.fillRect(tx - (s >> 1), ty - (s >> 1), s, s); }
    }
    // 경보 핑
    for (const pg of this.pings) {
      pg.t++;
      g.strokeStyle = 'rgba(255,40,40,' + (1 - pg.t / 72) + ')'; g.lineWidth = 1;
      g.beginPath(); g.arc(pg.x / TILE, pg.y / TILE, 3 + (pg.t % 24) / 2, 0, 6.283); g.stroke();
    }
    this.pings = this.pings.filter(pg => pg.t < 72);
    // 화면 사각형
    g.strokeStyle = '#fff'; g.lineWidth = 1;
    const vh = VIEW.h - this.consoleH() / VIEW.scale;
    g.strokeRect(VIEW.x / TILE + 0.5, VIEW.y / TILE + 0.5, VIEW.w / TILE, vh / TILE);
  },

  // ---------------- 프레임 ----------------
  scrollCamera(dt = 1000 / 60) {
    if (!GAME.running || GAME.over || document.hidden || this.mmDrag) return;
    if (document.activeElement?.matches('input,select,textarea,[contenteditable="true"]')) return;
    const edge = 24, width = window.innerWidth, height = window.innerHeight;
    let dx = 0, dy = 0;
    const m = this.mouse;
    if (m.inside && m.x >= 0 && m.y >= 0 && m.x < width && m.y < height) {
      const hit = document.elementFromPoint(m.x, m.y);
      // 메뉴/미니맵/명령 버튼을 조작하는 동안 가장자리 이동이 끼어들지 않는다.
      const control = hit?.closest('#test,#help,#title,#end,#minimap,button,input,select,textarea,.btn,.wf,.qs');
      if (!control) {
        if (m.x < edge) dx = -1; else if (m.x >= width - edge) dx = 1;
        const bottom = height - this.consoleH();
        if (m.y < edge) dy = -1;
        else if (m.y >= height - edge || m.y >= bottom - edge && m.y < bottom) dy = 1;
      }
    }
    if (this.keys.ArrowLeft) dx = -1; if (this.keys.ArrowRight) dx = 1;
    if (this.keys.ArrowUp) dy = -1; if (this.keys.ArrowDown) dy = 1;
    if (dx || dy) {
      // CSS 화면 기준 초당 720px. 줌 배율/모니터 주사율과 무관한 이동 속도.
      const distance = 720 * Math.min(50, Math.max(0, dt)) / 1000 / VIEW.scale / Math.hypot(dx, dy);
      VIEW.x += dx * distance; VIEW.y += dy * distance; RENDER.clampCam();
    }
  },
  frame(fr, dt) {
    this.scrollCamera(dt);
    const m = this.mouse;
    const [wx, wy] = RENDER.toWorld(m.x, m.y);
    m.wx = wx; m.wy = wy;
    this.hover = m.overUI ? null : this.pick(wx, wy);
    this.updateCursor();
    if (this.selection.some(e => e.dead || e.hidden)) { this.selection = this.selection.filter(e => !e.dead && !e.hidden); this.cardSig = ''; }
    if (this.mode && this.mode.kind !== 'spawn' && !this.own().length) this.cancelMode();
    if (fr % 3 === 0) { this.renderInfo(); this.renderCard(); this.renderRes(); }
    if (fr % 4 === 0) this.drawMinimap();
  },
  renderRes() {
    const pl = P(GAME.control);
    if (!pl) return;
    this.el.min.textContent = Math.floor(pl.min);
    this.el.gas.textContent = Math.floor(pl.gas);
    this.el.sup.textContent = supplyText(pl.used) + '/' + supplyText(pl.max);
    this.el.sup.classList.toggle('cap', pl.used >= pl.max);
    const ico = { T: 'depot', Z: 'overlord', P: 'pylon' }[pl.race];
    if (this._supIco !== ico) { this._supIco = ico; this.el.supIco.src = ART.icon(ico, GAME.control); document.getElementById('ico-gas').src = ART.icon({ T: 'refinery', Z: 'extractor', P: 'assimilator' }[pl.race], GAME.control); }
  },

  // ---------------- 테스트 패널 ----------------
  buildTestPanel() {
    const t = this.el.test;
    const opts = (race) => Object.keys(UNITS).filter(k => UNITS[k].race === race && !['larva', 'egg', 'lurker_egg', 'spider_mine', 'broodling', 'tank_siege'].includes(k)).map(k => '<option value="' + k + '">' + UNITS[k].name + '</option>').join('');
    const bopts = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].race !== 'N').map(k => '<option value="' + k + '">' + BUILDINGS[k].name + '</option>').join('');
    t.innerHTML = `
      <div class="th">테스트 / 치트 패널 <span class="x" id="t-close">✕</span></div>
      <div class="row small">버전 ${RTS_VERSION} · 자체 픽셀 그래픽 / 웹 RTS</div>
      <div class="row"><label>스폰 대상</label>
        <select id="t-type"><optgroup label="테란">${opts('T')}</optgroup><optgroup label="저그">${opts('Z')}</optgroup><optgroup label="프로토스">${opts('P')}</optgroup><optgroup label="건물">${bopts}</optgroup></select></div>
      <div class="row"><label>소속</label><select id="t-owner"><option value="1">적군 (저그/빨강)</option><option value="0">아군 (테란/파랑)</option></select>
        <label>수</label><input id="t-count" type="number" min="1" max="50" value="5"></div>
      <div class="row"><button id="t-spawn">스폰 프리뷰 켜기 (우클릭 종료)</button></div>
      <div class="row small">대상 선택 → 마우스 프리뷰 → 지도 클릭으로 스폰</div>
      <div class="row"><button id="t-wave">적 공격 웨이브 즉시 출격</button><button id="t-killsel">선택 유닛 제거</button></div>
      <div class="row"><label><input type="checkbox" id="t-ai" checked> 적 AI 작동</label><label><input type="checkbox" id="t-reveal"> 전체 맵 공개</label></div>
      <div class="row"><label><input type="checkbox" id="t-sandbox"> 샌드박스 (승패 없음)</label><label><input type="checkbox" id="t-snd" checked> 효과음</label></div>
      <div class="row"><label>조작 진영</label><button id="t-ctrl0" class="on">테란 (나)</button><button id="t-ctrl1">저그 (적군 조작)</button></div>
      <div class="row"><button id="t-res">자원 +5000</button><button id="t-fast">빌드 속도 x<span id="t-bs">1</span></button></div>
      <div class="row"><button id="t-tech">전 종족 연구 완료 (테스트)</button></div>
      <div class="row"><label>게임 속도</label><input id="t-speed" type="range" min="0.5" max="3" step="0.25" value="1"><span id="t-spv">1.0x</span></div>
      <div class="row small">F10 / \` : 패널 열기 · F1 : 도움말 · F9 : 일시정지</div>`;
    const $ = (id) => document.getElementById(id);
    $('t-close').onclick = () => this.toggleTest(false);
    const preview = () => this.setMode({ kind: 'spawn', type: $('t-type').value, owner: +$('t-owner').value, count: Math.max(1, Math.min(50, Math.floor(+$('t-count').value) || 1)) });
    $('t-spawn').onclick = () => { preview(); this.message('마우스 프리뷰 위치에 클릭해 스폰하세요 (우클릭/ESC 종료)'); };
    $('t-type').onpointerdown = $('t-type').onchange = preview;
    $('t-owner').onchange = $('t-count').oninput = $('t-count').onchange = () => { if (this.mode && this.mode.kind === 'spawn') preview(); };
    $('t-wave').onclick = () => { AI.forceWave(ENEMY); this.message('적 웨이브 출격!'); };
    $('t-killsel').onclick = () => { for (const e of this.selection.slice()) killEntity(e, null); };
    $('t-ai').onchange = (e) => { GAME.aiOn[ENEMY] = e.target.checked; this.message('적 AI ' + (e.target.checked ? '켜짐' : '꺼짐')); };
    $('t-reveal').onchange = (e) => { GAME.revealAll = e.target.checked; };
    $('t-sandbox').onchange = (e) => { GAME.sandbox = e.target.checked; };
    $('t-snd').onchange = (e) => { SND.enabled = e.target.checked; };
    const ctrl = (o) => {
      GAME.control = o; this.setSelection([]); this.groups = []; this.cancelMode();
      $('t-ctrl0').classList.toggle('on', o === 0); $('t-ctrl1').classList.toggle('on', o === 1);
      const s = MAP.starts[o]; if (s) RENDER.centerOn((s.tx + 2) * TILE, (s.ty + 1.5) * TILE);
      this.message((o === 0 ? '테란' : '저그 (적군)') + ' 진영을 조작합니다.' + (o === 1 ? ' 조작 중에는 저그 AI가 일시 정지됩니다.' : ''));
      this._supIco = null;
    };
    $('t-ctrl0').onclick = () => ctrl(0); $('t-ctrl1').onclick = () => ctrl(1);
    $('t-res').onclick = () => { const pl = P(GAME.control); pl.min += 5000; pl.gas += 5000; };
    $('t-tech').onclick = () => { const pl = P(GAME.control); for (const [k, d] of Object.entries(TECH)) { if (d.lv) pl.upg[k] = d.lv; else pl.tech[k] = true; } this.cardSig = ''; this.message('조작 진영 연구 완료 · F10에서 3종족 유닛을 스폰할 수 있습니다.'); };
    $('t-fast').onclick = () => { GAME.buildSpeed = GAME.buildSpeed >= 8 ? 1 : GAME.buildSpeed * 2; $('t-bs').textContent = GAME.buildSpeed; };
    $('t-speed').oninput = (e) => { GAME.speed = +e.target.value; $('t-spv').textContent = GAME.speed.toFixed(2).replace(/0$/, '') + 'x'; };
  },
  toggleTest(v) { this.el.test.classList.toggle('hidden', v === undefined ? !this.el.test.classList.contains('hidden') : !v); },
  // 미리보기와 클릭 생성이 같은 좌표/배치 검사 결과를 사용한다. 엔티티를 만들지 않는다.
  spawnLayout(wx, wy) {
    const m = this.mode;
    const t = m.type;
    if (BUILDINGS[t]) {
      const d = BUILDINGS[t];
      const tx = Math.round(wx / TILE - d.w / 2), ty = Math.round(wy / TILE - d.h / 2);
      let ok = true;
      for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) if (!inMap(x, y) || !MAP.buildable[tIdx(x, y)] || MAP.occ[tIdx(x, y)]) ok = false;
      return [{ tx, ty, x: (tx + d.w / 2) * TILE, y: (ty + d.h / 2) * TILE, valid: ok }];
    }
    const d = UNITS[t];
    const n = m.count;
    const cols = Math.ceil(Math.sqrt(n));
    const sp = d.r * 2 + 4;
    const layout = [];
    for (let k = 0; k < n; k++) {
      let x = wx + ((k % cols) - (cols - 1) / 2) * sp, y = wy + (Math.floor(k / cols) - (cols - 1) / 2) * sp;
      let valid = true;
      if (!d.air && !groundPassable(tileOf(x), tileOf(y))) {
        const np = PF.nearestPassable(tileOf(x), tileOf(y), 5);
        if (np) { x = np[0] * TILE + 16; y = np[1] * TILE + 16; } else valid = false;
      }
      layout.push({ x, y, valid });
    }
    return layout;
  },
  spawnAt(wx, wy) {
    const m = this.mode, t = m.type, layout = this.spawnLayout(wx, wy);
    if (BUILDINGS[t]) {
      const p = layout[0], d = BUILDINGS[t];
      if (!p.valid) { this.message('그곳에는 배치할 수 없습니다.'); SND.play('err'); return; }
      const b = createBuilding(t, m.owner, p.tx, p.ty, true);
      completeBuilding(b);
      if (d.race === 'Z') updateCreep();
      return;
    }
    const d = UNITS[t];
    for (const { x, y, valid } of layout) {
      if (!valid) continue;
      const u = createUnit(t, m.owner, x, y);
      if (d.mines) u.mines = 3;
      fx('warp', x, y, { life: 12, w: d.r, h: d.r });
      if (typeof AI !== 'undefined') AI.onUnit(u);
    }
    SND.play('ready');
  },
};
