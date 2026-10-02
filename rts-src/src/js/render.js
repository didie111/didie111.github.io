'use strict';
// ===================================================================
//  렌더링 — 지형 청크, 크립, 유닛/건물 스프라이트, 이펙트, 안개
// ===================================================================
const VIEW = { x: 0, y: 0, w: 640, h: 400, scale: 1.25 };
const RENDER = (() => {
  let cv, ctx, fogC, fogX, fogImg;
  let fogVersion = -1, fogPlayer = -1, fogReveal;
  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    fogC = document.createElement('canvas'); fogC.width = MAP_W; fogC.height = MAP_H;
    fogX = fogC.getContext('2d'); fogImg = fogX.createImageData(MAP_W, MAP_H);
    resize();
  }
  function resize() {
    const s = VIEW.scale;
    cv.width = Math.ceil(window.innerWidth / s); cv.height = Math.ceil(window.innerHeight / s);
    cv.style.width = cv.width * s + 'px'; cv.style.height = cv.height * s + 'px';
    VIEW.w = cv.width; VIEW.h = cv.height;
    ctx.imageSmoothingEnabled = false;
    clampCam();
  }
  function clampCam() {
    const bottomUI = UI && UI.consoleH ? UI.consoleH() / VIEW.scale : 0;
    VIEW.x = Math.max(0, Math.min(MAP_W * TILE - VIEW.w, VIEW.x));
    VIEW.y = Math.max(-8, Math.min(MAP_H * TILE - VIEW.h + bottomUI, VIEW.y));
  }
  function centerOn(x, y) {
    const bottomUI = UI && UI.consoleH ? UI.consoleH() / VIEW.scale : 0;
    VIEW.x = x - VIEW.w / 2; VIEW.y = y - (VIEW.h - bottomUI) / 2; clampCam();
  }
  const onScreen = (x, y, m) => x > VIEW.x - m && x < VIEW.x + VIEW.w + m && y > VIEW.y - m && y < VIEW.y + VIEW.h + m;

  function updateFog() {
    const p = GAME.control, v = GAME.vis[p], ex = GAME.explored[p], d = fogImg.data;
    const all = GAME.revealAll;
    if (fogVersion === GAME.visionVersion && fogPlayer === p && fogReveal === all) return;
    fogVersion = GAME.visionVersion; fogPlayer = p; fogReveal = all;
    for (let i = 0, o = 3; i < v.length; i++, o += 4) d[o] = all ? 0 : (v[i] & 1) ? 0 : ex[i] ? 140 : 255;
    fogX.putImageData(fogImg, 0, 0);
  }

  function frameOf(e) {
    let f = 0;
    if (e.moving || (e.air && !e.isBuilding)) { e.anim += (e.air ? 0.12 : Math.max(0.08, e.speed * 0.06)); f = Math.floor(e.anim) & 3; }
    if (e.type === 'larva' || e.type === 'egg' || e.type === 'lurker_egg') { e.anim += 0.05; f = Math.floor(e.anim) & 3; }
    if (e.attackAnim > 0 && !e.isBuilding) f += 4;
    return f;
  }

  function draw() {
    const p = GAME.control;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    const vx = Math.round(VIEW.x), vy = Math.round(VIEW.y);
    ctx.translate(-vx, -vy);
    // 지형
    const CS = ART.CH * TILE;
    for (let cy = Math.max(0, Math.floor(vy / CS)); cy <= Math.min(MAP_H / ART.CH - 1, Math.floor((vy + VIEW.h) / CS)); cy++)
      for (let cx = Math.max(0, Math.floor(vx / CS)); cx <= Math.min(MAP_W / ART.CH - 1, Math.floor((vx + VIEW.w) / CS)); cx++)
        ctx.drawImage(ART.chunk(cx, cy), cx * CS, cy * CS);
    // 크립
    const cb = ART.creepBlob();
    const tx0 = Math.max(0, Math.floor(vx / TILE) - 1), ty0 = Math.max(0, Math.floor(vy / TILE) - 1);
    const tx1 = Math.min(MAP_W - 1, Math.floor((vx + VIEW.w) / TILE) + 1), ty1 = Math.min(MAP_H - 1, Math.floor((vy + VIEW.h) / TILE) + 1);
    const ex = GAME.explored[p];
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const i = tIdx(x, y);
      if (MAP.creep[i] && (ex[i] || GAME.revealAll)) ctx.drawImage(cb, x * TILE - 8, y * TILE - 8);
    }
    // 데칼
    for (const d of GAME.decals) {
      if (!onScreen(d.x, d.y, 60)) continue;
      const a = Math.max(0, 1 - d.t / d.life);
      ctx.globalAlpha = a * 0.8;
      if (d.kind === 'blood') { ctx.fillStyle = '#6a0a0a'; blobAt(d.x, d.y, 6 * d.size, 4 * d.size, d.x); }
      else if (d.kind === 'zgoo') { ctx.fillStyle = '#4a5a10'; blobAt(d.x, d.y, 9 * d.size, 6 * d.size, d.x); }
      else { ctx.fillStyle = '#2a2622'; blobAt(d.x, d.y, 14 * d.size, 9 * d.size, d.x); ctx.fillStyle = '#4a443c'; blobAt(d.x - 4, d.y - 2, 8 * d.size, 5 * d.size, d.y); }
      ctx.globalAlpha = 1;
    }
    // 안개 속 건물 잔상
    for (const gh of GAME.ghosts[p].values()) {
      const e = GAME.byId.get(gh.id);
      if (e && isVisibleTo(e, p)) continue;
      if (!onScreen(gh.x, gh.y, 140)) continue;
      const s = ART.building(gh.type, gh.owner, '');
      ctx.globalAlpha = 0.85; ctx.drawImage(s.c, Math.round(gh.x - s.ox), Math.round(gh.y - s.oy)); ctx.globalAlpha = 1;
    }
    // 보이는 엔티티 수집
    const ground = [], air = [];
    const sel = new Set(UI.selection);
    for (const e of GAME.entities) {
      if (e.dead || e.hidden) continue;
      if (!onScreen(e.x, e.y, 120)) continue;
      if (!isVisibleTo(e, p)) continue;
      if ((e.air || e.lifted) && !e.isBuilding || e.lifted) air.push(e); else ground.push(e);
    }
    ground.sort((a, b) => (a.isBuilding ? a.y + a.hh * 0.5 : a.y) - (b.isBuilding ? b.y + b.hh * 0.5 : b.y) || (a.burrowed ? -1 : 0));
    air.sort((a, b) => a.y - b.y);
    // 선택 원
    for (const e of ground) if (sel.has(e) || UI.hover === e) selCircle(e, sel.has(e));
    // 지상
    for (const e of ground) drawEntity(e, p);
    // 이동 명령/투사체 (지상)
    drawAreas(false);
    // 공중 그림자 + 공중
    for (const e of air) {
      const lift = e.isBuilding ? 22 : 0;
      if (e.isBuilding) { const s = ART.building(e.type, e.owner, ''); ctx.globalAlpha = 0.35; ctx.drawImage(s.c, Math.round(e.x - s.ox + 6), Math.round(e.y - s.oy + 18), s.c.width, s.c.height * 0.8); ctx.globalAlpha = 1; }
      else { const f = frameOf(e); e._f = f; const s = ART.shadowOf(e.type, e.owner, e.dir, f); ctx.drawImage(s.c, Math.round(e.x - s.h + 4), Math.round(e.y - s.h + 22 + lift)); }
    }
    for (const e of air) if (sel.has(e) || UI.hover === e) selCircle(e, sel.has(e));
    for (const e of air) drawEntity(e, p);
    drawProjectiles();
    drawEffects();
    drawAreas(true);
    // 안개
    updateFog();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogC, 0, 0, MAP_W, MAP_H, -TILE / 2, -TILE / 2, MAP_W * TILE + TILE, MAP_H * TILE + TILE);
    ctx.imageSmoothingEnabled = false;
    // HP 바 (선택/알트)
    const showAll = UI.keys && UI.keys.Alt;
    for (const e of ground.concat(air)) if (sel.has(e) || showAll || (UI.hover === e)) bars(e);
    // 집결지점/웨이포인트
    for (const e of UI.selection) {
      if (e.dead || e.owner !== p) continue;
      if (e.rally) { const rx = e.rally.tgt && !e.rally.tgt.dead ? e.rally.tgt.x : e.rally.x, ry = e.rally.tgt && !e.rally.tgt.dead ? e.rally.tgt.y : e.rally.y; dashLine(e.x, e.y, rx, ry, 'rgba(80,255,80,0.6)'); flag(rx, ry); }
      if (UI.keys && UI.keys.Shift && e.orders.length) {
        let lx = e.x, ly = e.y;
        for (const o of e.orders) { const ox = o.tgt ? o.tgt.x : o.x, oy = o.tgt ? o.tgt.y : o.y; if (ox === undefined) continue; dashLine(lx, ly, ox, oy, o.t === 'amove' || o.t === 'attack' ? 'rgba(255,80,80,0.6)' : 'rgba(80,255,80,0.6)'); lx = ox; ly = oy; }
      }
    }
    UI.drawWorldOverlay(ctx);
  }
  function blobAt(x, y, rx, ry, seed) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + (seed % 7) - 3, y + (seed % 5) - 2, rx * 0.6, ry * 0.6, 0, 0, 6.283); ctx.fill();
  }
  function dashLine(x0, y0, x1, y1, c) { ctx.setLineDash([3, 3]); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); }
  function flag(x, y) { ctx.fillStyle = '#ccc'; ctx.fillRect(x, y - 12, 1, 12); ctx.fillStyle = '#40ff40'; ctx.beginPath(); ctx.moveTo(x + 1, y - 12); ctx.lineTo(x + 8, y - 9); ctx.lineTo(x + 1, y - 6); ctx.fill(); }

  function selCircle(e, selected) {
    const p = GAME.control;
    const col = e.owner === p ? '#20ff20' : e.owner === NEUTRAL ? '#ffff40' : '#ff2020';
    ctx.strokeStyle = selected ? col : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (e.isBuilding) ctx.ellipse(e.x, e.y + e.hh * 0.25 - (e.lifted ? 22 : 0), e.hw + 3, e.hh * 0.8 + 2, 0, 0, 6.283);
    else ctx.ellipse(e.x, e.y + e.r * 0.35 - (e.air ? 0 : 0), e.r + 2, (e.r + 2) * 0.6, 0, 0, 6.283);
    ctx.stroke();
  }

  function drawEntity(e, p) {
    const x = Math.round(e.x), y = Math.round(e.y);
    let alpha = 1;
    if (e.cloaked || (e.def.permCloak && !e.isBuilding)) {
      if (e.owner === p) alpha = 0.45;
      else if (isCloakedFor(e, p)) alpha = 0.12 + 0.06 * Math.sin(GAME.tick * 0.3 + e.id);
      else alpha = 0.7;
    }
    if (e.burrowed) {
      if (e.owner !== p && isCloakedFor(e, p)) return;
      if (e.def.mine) { ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(x, y, 4, 2.5, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = TEAM[e.owner].main; ctx.fillRect(x - 1, y - 1, 2, 2); return; }
      ctx.globalAlpha = e.owner === p ? 0.55 : 0.8;
      ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.ellipse(x, y + 2, e.r, e.r * 0.5, 0, 0, 6.283); ctx.fill();
      if (e.type === 'lurker') { ctx.fillStyle = '#d8ccb0'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 4 - 2, y + 2); ctx.lineTo(x + k * 4, y - 5 - Math.abs(k)); ctx.lineTo(x + k * 4 + 2, y + 2); ctx.fill(); } }
      ctx.globalAlpha = 1;
      return;
    }
    if (e.isBuilding) {
      const lift = (e.lifted ? 22 : 0) + (e.liftT > 0 ? (20 - e.liftT) : 0);
      ctx.globalAlpha = alpha;
      if (!e.done) {
        const prog = (e.prog || 0) / e.def.time;
        if (e.race === 'Z') { const s = ART.zergCocoon(e.type, e.owner, prog); ctx.drawImage(s.c, x - s.ox, y - s.oy); }
        else if (e.race === 'P') {
          const s = ART.building(e.type, e.owner, '');
          ctx.globalAlpha = 0.25 + prog * 0.6; ctx.drawImage(s.c, x - s.ox, y - s.oy);
          ctx.globalAlpha = 0.4 * (1 - prog) + 0.1 * Math.sin(GAME.tick * 0.2);
          ctx.fillStyle = '#a0e0ff'; ctx.fillRect(x - e.hw, y - e.hh - ART.ELEV, e.hw * 2, e.hh * 2 + ART.ELEV);
        } else {
          const s = ART.building(e.type, e.owner, '');
          const hgt = s.c.height, shown = Math.max(6, hgt * prog);
          // 비계(골조)
          ctx.strokeStyle = '#8a8a70'; ctx.lineWidth = 1;
          for (let yy = y - s.oy + hgt; yy > y - s.oy; yy -= 8) { ctx.beginPath(); ctx.moveTo(x - s.ox + 4, yy); ctx.lineTo(x + s.ox - 4, yy); ctx.stroke(); }
          for (let xx = x - s.ox + 4; xx < x + s.ox; xx += 12) { ctx.beginPath(); ctx.moveTo(xx, y - s.oy + hgt); ctx.lineTo(xx, y - s.oy + 4); ctx.stroke(); }
          ctx.drawImage(s.c, 0, hgt - shown, s.c.width, shown, x - s.ox, y - s.oy + hgt - shown, s.c.width, shown);
        }
        ctx.globalAlpha = 1;
        return;
      }
      let key = '';
      if (e.type === 'mineral') { const lv = e.amount > 1000 ? 3 : e.amount > 600 ? 2 : e.amount > 250 ? 1 : 0; key = (lv << 4) | (e.id % 5); }
      const s = ART.building(e.type, e.owner, key);
      ctx.drawImage(s.c, x - s.ox, y - s.oy - lift);
      if (e.hitT > 0) { e.hitT--; }
      // 상태 효과
      if (e.type === 'geyser' && GAME.tick % 40 < 20) { ctx.fillStyle = 'rgba(220,230,220,0.25)'; ctx.beginPath(); ctx.ellipse(x, y - 14 - (GAME.tick % 40) * 0.6, 8 + (GAME.tick % 40) * 0.3, 5, 0, 0, 6.283); ctx.fill(); }
      if (e.def.onGeyser && e.race === 'T' && e.gasUser) { ctx.fillStyle = 'rgba(200,200,200,0.35)'; ctx.beginPath(); ctx.ellipse(x + 2, y - 40 - (GAME.tick % 30), 5 + (GAME.tick % 30) * 0.2, 4, 0, 0, 6.283); ctx.fill(); }
      if (e.race === 'T' && e.hp < e.maxHp * 0.66) fire(x, y - lift, e, e.hp < e.maxHp * 0.33 ? 3 : 1);
      if (e.race === 'Z' && e.hp < e.maxHp * 0.5 && GAME.tick % 16 < 8) { ctx.fillStyle = 'rgba(160,40,30,0.5)'; ctx.beginPath(); ctx.arc(x - e.hw * 0.3, y, 4, 0, 6.283); ctx.fill(); }
      if (e.race === 'P' && e.unpowered) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - e.hw, y - e.hh - ART.ELEV, e.hw * 2, e.hh * 2 + ART.ELEV); }
      if (e.morph) { ctx.globalAlpha = 0.3 + 0.2 * Math.sin(GAME.tick * 0.2); ctx.fillStyle = '#a06040'; ctx.beginPath(); ctx.ellipse(x, y, e.hw, e.hh, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
      if (e.queue.length && e.def.produces && GAME.tick % 12 < 6 && e.race === 'T') { ctx.fillStyle = '#ffe060'; ctx.fillRect(x - 4, y + e.hh - 8, 2, 2); ctx.fillRect(x + 2, y + e.hh - 8, 2, 2); }
      if (e.lockT > 0) statusRing(x, y, e.hw, '#80ff80');
      ctx.globalAlpha = 1;
      return;
    }
    // 유닛
    if (e.air || e.lifted) { /* 그림자 따로 */ }
    else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 1, y + e.r * 0.5, e.r * 0.9, e.r * 0.45, 0, 0, 6.283); ctx.fill(); }
    const f = e._f !== undefined && e.air ? e._f : frameOf(e);
    e._f = undefined;
    const bob = e.air ? Math.round(Math.sin(GAME.tick * 0.08 + e.id) * 1.5) : 0;
    let dir = e.dir;
    if (e.xform) { /* 시즈 전환 */ }
    const spr = ART.unit(e.type, e.owner, dir, f);
    ctx.globalAlpha = alpha;
    ctx.drawImage(spr.c, x - spr.h, y - spr.h + bob);
    if (e.hitT > 0) { e.hitT--; ctx.globalAlpha = 0.5 * alpha; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(spr.c, x - spr.h, y - spr.h + bob); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1;
    if (e.xform) { ctx.strokeStyle = 'rgba(255,255,160,0.6)'; ctx.beginPath(); ctx.arc(x, y, e.r + 2, 0, 6.283 * (1 - e.xform.t / 40)); ctx.stroke(); }
    if (e.stimT > 0 && GAME.tick % 6 < 3) { ctx.fillStyle = 'rgba(255,40,40,0.5)'; ctx.fillRect(x - 1, y - e.r - 3, 2, 2); }
    if (e.matrixHp > 0) statusRing(x, y + bob, e.r + 2, '#60a0ff');
    if (e.irrT > 0) { ctx.fillStyle = 'rgba(80,255,80,0.25)'; ctx.beginPath(); ctx.arc(x, y, e.r + 4 + Math.sin(GAME.tick * 0.3) * 2, 0, 6.283); ctx.fill(); }
    if (e.plagueT > 0) { ctx.fillStyle = 'rgba(160,200,60,0.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(x - e.r + ((GAME.tick * 3 + k * 7) % (e.r * 2)), y - e.r + ((k * 11 + GAME.tick) % (e.r * 2)), 2, 2); }
    if (e.lockT > 0) statusRing(x, y, e.r + 2, '#80ff80');
    if (e.ensnareT > 0) statusRing(x, y, e.r + 1, '#c0a040');
    if (e.stasisT > 0) { ctx.fillStyle = 'rgba(100,170,255,0.6)'; ctx.fillRect(x - e.r, y - e.r, e.r * 2, e.r * 2); }
    if (e.maelstromT > 0) statusRing(x, y, e.r + 3, '#e04090');
    if (e.acidSpores) statusRing(x, y, e.r + 3, '#b0f050');
    if (e.carry > 0 && e.isWorker) {
      const cx = x + Math.cos(e.dir) * (e.r - 1), cy = y + Math.sin(e.dir) * (e.r - 1);
      if (e.carryKind === 'gas') { ctx.fillStyle = e.race === 'Z' ? '#40c020' : e.race === 'P' ? '#40e060' : '#30b030'; ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4); }
      else { ctx.fillStyle = '#2080e0'; ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 3, cy); ctx.lineTo(cx, cy + 2); ctx.lineTo(cx - 3, cy); ctx.fill(); ctx.fillStyle = '#90d0ff'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 3, 1, 2); }
    }
  }
  function statusRing(x, y, r, c) { ctx.strokeStyle = c; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(GAME.tick * 0.2); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  function fire(x, y, e, n) {
    for (let k = 0; k < n; k++) {
      const fx0 = x + ((e.id * 13 + k * 29) % (e.hw * 1.4)) - e.hw * 0.7, fy0 = y - ((e.id * 7 + k * 17) % (e.hh)) ;
      const t = (GAME.tick + k * 5) % 12;
      ctx.fillStyle = t < 6 ? '#ff8020' : '#ffd040';
      ctx.beginPath(); ctx.ellipse(fx0, fy0 - t * 0.5, 3, 4 + (t % 3), 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(60,60,60,0.35)'; ctx.beginPath(); ctx.arc(fx0 + 2, fy0 - 10 - t, 4 + t * 0.3, 0, 6.283); ctx.fill();
    }
  }

  // SC1 스타일 체력 바
  function bars(e) {
    if (e.def.resource) {
      if (!UI.selection.includes(e)) return;
    }
    const w = e.isBuilding ? Math.max(24, e.hw * 1.6) : Math.max(14, e.r * 2.2);
    const x = Math.round(e.x - w / 2);
    let y = Math.round(e.y + (e.isBuilding ? e.hh + 2 - (e.lifted ? 22 : 0) : e.r + 3));
    if (e.def.resource) return;
    const seg = e.isBuilding ? 6 : 4;
    const n = Math.max(3, Math.floor(w / seg));
    const bw = n * seg;
    const drawBar = (f, col) => {
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, bw + 1, 5);
      const filled = Math.ceil(f * n);
      for (let k = 0; k < n; k++) { ctx.fillStyle = k < filled ? col : '#303030'; ctx.fillRect(x + k * seg, y, seg - 1, 3); }
      y += 4;
    };
    if (e.maxSh) drawBar(e.sh / e.maxSh, '#3070ff');
    const hf = e.hp / e.maxHp;
    drawBar(hf, hf > 0.66 ? '#10e010' : hf > 0.33 ? '#e0e000' : '#e01010');
    if (e.maxEnergy && e.owner === GAME.control) drawBar(e.energy / e.maxEnergy, '#c040e0');
    if (e.isBuilding && !e.done) drawBar((e.prog || 0) / e.def.time, '#a0a0a0');
  }

  function drawProjectiles() {
    for (const pr of GAME.projectiles) {
      if (pr.delay > 0) continue;
      if (!isVisibleAt(pr.x, pr.y)) continue;
      const x = pr.x, y = pr.y, d = pr.dir || 0;
      const col = (PROJ[pr.kind] && PROJ[pr.kind].color) || '#fff';
      switch (pr.kind) {
        case 'missile': ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ff8030'; ctx.fillRect(x - Math.cos(d) * 3 - 1, y - Math.sin(d) * 3 - 1, 2, 2); break;
        case 'spine': case 'laser': case 'shell':
          ctx.strokeStyle = col; ctx.lineWidth = pr.kind === 'shell' ? 2 : 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(d) * 6, y - Math.sin(d) * 6); ctx.stroke(); break;
        case 'siege': {
          const tot = dist(pr.sx, pr.sy, pr.tx, pr.ty) || 1, prog = 1 - dist(x, y, pr.tx, pr.ty) / tot;
          const hy = Math.sin(prog * Math.PI) * Math.min(40, tot * 0.15);
          ctx.fillStyle = '#fff8c0'; ctx.fillRect(x - 2, y - hy - 2, 4, 4); break;
        }
        case 'glaive': ctx.save(); ctx.translate(x, y); ctx.rotate(GAME.tick * 0.6); ctx.fillStyle = col; ctx.fillRect(-3, -1, 6, 2); ctx.fillRect(-1, -3, 2, 6); ctx.restore(); break;
        case 'plasma': case 'particle': case 'neutron': case 'spore': case 'spit': case 'lock': case 'yamato': {
          const r = pr.kind === 'yamato' ? 6 : pr.kind === 'plasma' ? 3 : 2;
          ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 6.283); ctx.fill(); break;
        }
        case 'grenade': ctx.fillStyle = '#ffcc55'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 6.283); ctx.fill(); break;
        case 'interceptor': ctx.save(); ctx.translate(x, y); ctx.rotate(d); ctx.fillStyle = '#d8c060'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -3); ctx.lineTo(-2, 0); ctx.lineTo(-3, 3); ctx.fill(); ctx.restore(); break;
        default: ctx.fillStyle = col; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }
  function isVisibleAt(x, y) {
    if (GAME.revealAll) return true;
    const tx = tileOf(x), ty = tileOf(y);
    if (!inMap(tx, ty)) return false;
    return GAME.vis[GAME.control][tIdx(tx, ty)] & 1;
  }

  function drawEffects() {
    for (const f of GAME.effects) {
      if (f.delay > 0) continue;
      if (!onScreen(f.x, f.y, 60) || !isVisibleAt(f.x, f.y)) continue;
      const k = f.t / f.life, x = f.x, y = f.y, sz = f.size || 1;
      ctx.globalAlpha = 1;
      switch (f.kind) {
        case 'muzzle': ctx.fillStyle = k < 0.5 ? '#fff8c0' : '#ffb040'; ctx.beginPath(); ctx.arc(x, y, 2.5 * sz, 0, 6.283); ctx.fill(); break;
        case 'hitspark': ctx.fillStyle = f.color || (f.miss ? '#888' : '#ffe080'); for (let i = 0; i < 3; i++) ctx.fillRect(x + (i - 1) * 2 * (1 + k * 2), y + ((i * 7) % 3 - 1) * 2 * k, 2, 2); break;
        case 'beam': ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.7; ctx.stroke(); break;
        case 'flame': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(f.ang);
          for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,200,60,0.8)' : 'rgba(255,90,20,0.75)'; ctx.beginPath(); ctx.arc(4 + i * 4 * (0.5 + k), (i % 3 - 1) * 3 * k, 2 + i * 0.8, 0, 6.283); ctx.fill(); }
          ctx.restore(); break;
        }
        case 'slash': ctx.strokeStyle = f.race === 'P' ? '#80e0ff' : '#e0d0b0'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5, k * 3, k * 3 + 2); ctx.stroke(); break;
        case 'explode': {
          const r = (4 + k * 12) * sz;
          ctx.fillStyle = f.color || (k < 0.3 ? '#fff0a0' : k < 0.6 ? '#ff9030' : '#803020');
          ctx.globalAlpha = 1 - k * 0.8; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
          if (k > 0.4) { ctx.fillStyle = 'rgba(40,40,40,0.5)'; ctx.beginPath(); ctx.arc(x + 2, y - k * 10, r * 0.7, 0, 6.283); ctx.fill(); }
          break;
        }
        case 'zsplat': ctx.fillStyle = k < 0.5 ? '#8a3a20' : '#5a4a10'; ctx.globalAlpha = 1 - k; for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.beginPath(); ctx.arc(x + Math.cos(a) * k * 14 * sz, y + Math.sin(a) * k * 10 * sz, 3 * sz * (1 - k * 0.5), 0, 6.283); ctx.fill(); } break;
        case 'pdeath': ctx.fillStyle = '#a0e0ff'; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(x, y, (4 + k * 16) * sz, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, (6 + k * 22) * sz, 0, 6.283); ctx.stroke(); break;
        case 'blood': ctx.fillStyle = '#a01010'; ctx.globalAlpha = 1 - k; for (let i = 0; i < 5; i++) { const a = i * 1.3; ctx.fillRect(x + Math.cos(a) * k * 10 * sz, y + Math.sin(a) * k * 8 * sz, 3, 3); } break;
        case 'smoke': ctx.fillStyle = 'rgba(200,200,200,' + (0.5 * (1 - k)) + ')'; ctx.beginPath(); ctx.arc(x, y - k * 3, 1.5 + k * 2, 0, 6.283); ctx.fill(); break;
        case 'spark': ctx.fillStyle = k < 0.5 ? '#fff' : '#80c0ff'; ctx.fillRect(x - 1, y - 1, 2, 2); ctx.fillRect(x + k * 4, y - k * 3, 1, 1); break;
        case 'mining': ctx.fillStyle = f.race === 'P' ? '#80e0ff' : f.race === 'Z' ? '#c0a060' : '#fff080'; ctx.fillRect(x, y, 2, 2); ctx.fillRect(x + 2 * k, y - 3 * k, 1, 1); break;
        case 'heal': ctx.strokeStyle = '#fff'; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(x, y, 3 + k * 5, 0, 6.283); ctx.stroke(); break;
        case 'warp': ctx.fillStyle = 'rgba(160,220,255,' + (0.6 * (1 - k)) + ')'; ctx.fillRect(x - f.w, y - f.h, f.w * 2, f.h * 2); break;
        case 'shield': ctx.strokeStyle = 'rgba(100,160,255,' + (0.9 * (1 - k)) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, (f.r || 10) + 1, 0, 6.283); ctx.stroke(); break;
        case 'matrixhit': ctx.strokeStyle = 'rgba(120,180,255,0.8)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.283); ctx.stroke(); break;
        case 'miss': ctx.fillStyle = '#ccc'; ctx.globalAlpha = 1 - k; ctx.font = '7px sans-serif'; ctx.fillText('miss', x - 7, y - k * 6); break;
        case 'dust': ctx.fillStyle = 'rgba(140,120,90,' + (0.6 * (1 - k)) + ')'; for (let i = 0; i < 5; i++) { const a = i * 1.25; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (6 + k * 10), y + Math.sin(a) * (4 + k * 6), 3, 0, 6.283); ctx.fill(); } break;
        case 'tentacle': { const h = Math.sin(k * Math.PI) * 18; ctx.fillStyle = '#a06050'; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 4, y); ctx.fill(); ctx.fillStyle = '#d8ccb0'; ctx.fillRect(x - 1, y - h, 2, 3); break; }
        case 'spines': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(f.ang);
          const n = Math.floor(f.len / 10);
          for (let i = 1; i <= n; i++) { const on = Math.abs(i / n - k * 1.4) < 0.25; if (!on) continue; ctx.fillStyle = '#d8ccb0'; ctx.beginPath(); ctx.moveTo(i * 10 - 4, 4); ctx.lineTo(i * 10, -10); ctx.lineTo(i * 10 + 4, 4); ctx.fill(); }
          ctx.restore(); break;
        }
        case 'cast': ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 4 + k * 16, 0, 6.283); ctx.stroke(); break;
        case 'plaguefx': ctx.fillStyle = 'rgba(140,180,40,' + (0.5 * (1 - k)) + ')'; ctx.beginPath(); ctx.arc(x, y, 48 * Math.min(1, k * 3), 0, 6.283); ctx.fill(); break;
        case 'empfx': ctx.strokeStyle = 'rgba(160,200,255,' + (1 - k) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 64 * k, 0, 6.283); ctx.stroke(); break;
        case 'lockfx': ctx.strokeStyle = '#80ff80'; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(x, y, 14 * (1 - k) + 4, 0, 6.283); ctx.stroke(); break;
        case 'eggpop': ctx.fillStyle = '#8a6a4a'; ctx.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) { const a = i; ctx.fillRect(x + Math.cos(a) * k * 12, y + Math.sin(a) * k * 10, 3, 2); } break;
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawAreas(top) {
    for (const a of GAME.areas) {
      if (a.kind === 'nuke' && top && isVisibleAt(a.x, a.y)) { ctx.fillStyle = '#ff2020'; ctx.beginPath(); ctx.arc(a.x, a.y, 3 + (GAME.tick % 12) / 4, 0, 6.283); ctx.fill(); continue; }
      if (a.kind === 'web' && !top && isVisibleAt(a.x, a.y)) { ctx.strokeStyle = '#b0b0ff'; ctx.globalAlpha = 0.4; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(a.x, a.y + i * 12, a.r, 10, 0, 0, 6.283); ctx.stroke(); } ctx.globalAlpha = 1; continue; }
      if (!onScreen(a.x, a.y, 120)) continue;
      if (a.kind === 'swarm' && !top) {
        ctx.globalAlpha = 0.45 * Math.min(1, a.t / 20, (a.life - a.t) / 30);
        ctx.fillStyle = '#3a2a18';
        for (let k = 0; k < 14; k++) { const an = k * 0.45 + a.t * 0.002; const rr = (k * 37 % 60) + 10; ctx.beginPath(); ctx.arc(a.x + Math.cos(an) * rr, a.y + Math.sin(an) * rr * 0.8, 22, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      if (a.kind === 'storm' && top) {
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#4060ff'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#c0d0ff'; ctx.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const an = Math.random() * 6.28, r1 = Math.random() * a.r; let px = a.x + Math.cos(an) * r1, py = a.y + Math.sin(an) * r1; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (Math.random() - 0.5) * 14; py += (Math.random() - 0.5) * 14; ctx.lineTo(px, py); } ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      if (a.kind === 'scan' && top && a.owner === GAME.control && a.t < 30) { ctx.strokeStyle = 'rgba(80,255,120,' + (1 - a.t / 30) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * a.t / 30, 0, 6.283); ctx.stroke(); }
    }
  }

  // 화면 → 월드
  function toWorld(sx, sy) { return [sx / VIEW.scale + VIEW.x, sy / VIEW.scale + VIEW.y]; }
  function toScreen(wx, wy) { return [(wx - VIEW.x) * VIEW.scale, (wy - VIEW.y) * VIEW.scale]; }
  return { init, resize, draw, centerOn, clampCam, toWorld, toScreen, get ctx() { return ctx; } };
})();
