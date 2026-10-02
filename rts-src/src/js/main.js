'use strict';
// ===================================================================
//  시나리오 설정 / 메인 루프 / 승패
//  1:1 — 나(테란) 1시 본진, 적(저그) 7시 본진
// ===================================================================
function freeRect(tx, ty, w, h, pad) {
  for (let y = ty - pad; y < ty + h + pad; y++) for (let x = tx - pad; x < tx + w + pad; x++) {
    if (!inMap(x, y)) return false;
    const i = tIdx(x, y);
    const inner = x >= tx && x < tx + w && y >= ty && y < ty + h;
    if (MAP.occ[i]) return false;
    if (inner && !MAP.buildable[i]) return false;
  }
  return true;
}
function awayFromResources(tx, ty, w, h, gap) {
  for (const e of GAME.entities) {
    if (e.dead || !e.def.resource) continue;
    const dx = Math.max(0, e.tx0 - (tx + w), tx - (e.tx0 + e.def.w));
    const dy = Math.max(0, e.ty0 - (ty + h), ty - (e.ty0 + e.def.h));
    if (dx < gap && dy < gap) return false;
  }
  return true;
}
// 본진 주변에서 자원 반대편으로 빈 자리 찾기
function findSetupSpot(type, base, minR, maxR, awayDir) {
  const d = BUILDINGS[type];
  const cx = base.tx + 2, cy = base.ty + 1.5;
  let best = null, bs = 1e9;
  for (let ty = Math.floor(cy - maxR); ty <= cy + maxR; ty++) for (let tx = Math.floor(cx - maxR); tx <= cx + maxR; tx++) {
    const mx = tx + d.w / 2, my = ty + d.h / 2, r = Math.hypot(mx - cx, my - cy);
    if (r < minR || r > maxR) continue;
    if (!freeRect(tx, ty, d.w, d.h, 1) || !awayFromResources(tx, ty, d.w, d.h, 3)) continue;
    if (terrAt(tx, ty) !== terrAt(base.tx + 2, base.ty + 1)) continue;
    const ang = Math.atan2(my - cy, mx - cx);
    const s = r - Math.cos(ang - awayDir) * 6;
    if (s < bs) { bs = s; best = [tx, ty]; }
  }
  return best;
}
function resourceDir(base) {
  let sx = 0, sy = 0;
  const cx = base.tx + 2, cy = base.ty + 1.5;
  for (const e of GAME.entities) {
    if (e.dead || !e.def.resource) continue;
    const ex = e.tx0 + e.def.w / 2, ey = e.ty0 + e.def.h / 2;
    if (Math.hypot(ex - cx, ey - cy) > 12) continue;
    sx += ex - cx; sy += ey - cy;
  }
  return Math.atan2(sy, sx);
}
function unitRing(type, owner, cx, cy, n, r0) {
  const out = [];
  const ud = UNITS[type];
  let k = 0, ring = 0;
  while (out.length < n && ring < 12) {
    const r = r0 + ring * (ud.r * 2 + 6);
    const cnt = Math.max(6, Math.floor(2 * Math.PI * r / (ud.r * 2 + 6)));
    for (let j = 0; j < cnt && out.length < n; j++, k++) {
      const a = j / cnt * Math.PI * 2 + ring * 0.3;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8;
      if (!ud.air) {
        if (!PF.positionClear(x, y, Math.max(3, ud.r * 0.75) + 1, 0)) continue;
        if (GAME.entities.some(e => groundCollider(e) && Math.hypot(e.x - x, e.y - y) < (e.r + ud.r) * 0.85 + 2)) continue;
      }
      out.push(createUnit(type, owner, x, y));
    }
    ring++;
  }
  return out;
}

function setupScenario(seed) {
  generateMap(seed);
  GAME.recoveryRandState = 42;
  ART.resetTerrain();
  GAME.players = [newPlayer('T', 0), newPlayer('Z', 1), newPlayer('N', 2)];
  GAME.players[0].min = 50; GAME.players[1].min = 50;
  for (const r of MAP.resources) {
    const e = createBuilding(r.type, NEUTRAL, r.tx, r.ty, true);
    e.amount = r.amount;
  }
  // ---- 테란 (1시) ----
  const tb = MAP.starts[PLAYER];
  const cc = createBuilding('cc', PLAYER, tb.tx, tb.ty, true);
  const away = resourceDir(tb) + Math.PI;
  const bxs = findSetupSpot('barracks', tb, 6, 13, away);
  if (bxs) createBuilding('barracks', PLAYER, bxs[0], bxs[1], true);
  for (let i = 0; i < 2; i++) { const s = findSetupSpot('depot', tb, 5, 12, away + (i ? 1.3 : -1.3)); if (s) createBuilding('depot', PLAYER, s[0], s[1], true); }
  const scvs = unitRing('scv', PLAYER, cc.x, cc.y + cc.hh + 14, 10, 4);
  const mar = unitRing('marine', PLAYER, cc.x + Math.cos(away) * 90, cc.y + Math.sin(away) * 90, 4, 6);
  for (const m of mar) m.dir = away;
  // SCV 는 바로 미네랄 채취 시작
  const mins = GAME.entities.filter(e => e.type === 'mineral' && dist(e.x, e.y, cc.x, cc.y) < 12 * TILE);
  scvs.forEach((w, i) => { const m = mins[i % mins.length]; if (m) { w.issue({ t: 'gather', tgt: m, phase: 'go' }); w.lastRes = m; } });

  // ---- 저그 (7시) : 해처리 3 + 저글링 10 + 히드라 10 ----
  const zb = MAP.starts[ENEMY];
  const nat = MAP.bases.find(b => b.side === 1 && b.kind === 'natural');
  const h1 = createBuilding('hatchery', ENEMY, zb.tx, zb.ty, true);
  const zaway = resourceDir(zb) + Math.PI;
  const h2s = nat ? [nat.tx, nat.ty] : findSetupSpot('hatchery', zb, 7, 14, zaway);
  const h2 = createBuilding('hatchery', ENEMY, h2s[0], h2s[1], true);
  const h3s = findSetupSpot('hatchery', zb, 7, 14, zaway);
  const hs = [h1, h2];
  if (h3s) hs.push(createBuilding('hatchery', ENEMY, h3s[0], h3s[1], true));
  for (const h of hs) { h.larvaT = 300; h.creepR = 10; for (let k = 0; k < 3; k++) spawnLarva(h); }
  // 저그는 인구수를 오버로드가 제공 — 기본 오버로드 2 + 드론 4 (AI 경제용)
  unitRing('overlord', ENEMY, h1.x, h1.y - 40, 2, 30);
  const drones = unitRing('drone', ENEMY, h1.x, h1.y + h1.hh + 14, 4, 4);
  const zmins = GAME.entities.filter(e => e.type === 'mineral' && dist(e.x, e.y, h1.x, h1.y) < 12 * TILE);
  drones.forEach((w, i) => { const m = zmins[i % zmins.length]; if (m) { w.issue({ t: 'gather', tgt: m, phase: 'go' }); w.lastRes = m; } });
  const rally = [h1.x + Math.cos(zaway) * 120, h1.y + Math.sin(zaway) * 120];
  const lings = unitRing('zergling', ENEMY, rally[0], rally[1], 10, 8);
  const hydras = unitRing('hydra', ENEMY, rally[0] + Math.cos(zaway) * 60, rally[1] + Math.sin(zaway) * 60, 10, 10);
  for (const u of lings.concat(hydras)) AI.onUnit(u);
  for (let i = 0; i < 20; i++) updateCreep();
  recomputeSupply();
  updateVision();
  RENDER.centerOn(cc.x - 60, cc.y + 40);
}

// ---------------- 승패 ----------------
function endGame(win) {
  if (GAME.over) return;
  GAME.over = true;
  UI.releaseMouse();
  const el = document.getElementById('end');
  const pl = P(PLAYER);
  el.querySelector('h1').textContent = win ? '승리!' : '패배';
  el.querySelector('h1').className = win ? 'win' : 'lose';
  const mins = Math.floor(GAME.tick / FPS / 60), secs = Math.floor(GAME.tick / FPS) % 60;
  el.querySelector('.stats').innerHTML = '게임 시간 ' + mins + ':' + String(secs).padStart(2, '0') + '<br>처치 ' + pl.kills + ' · 손실 ' + pl.lost;
  el.classList.remove('hidden');
  SND.play(win ? 'done' : 'alert');
}

// ---------------- 메인 루프 ----------------
const LOOP = { acc: 0, last: 0, frame: 0, measuredAt: 0, frames: 0, ticks: 0, tickTime: 0 };
function loop(now) {
  const dt = Math.min(250, now - (LOOP.last || now));
  LOOP.last = now;
  if (GAME.running && !GAME.paused && !GAME.over) {
    LOOP.acc += dt * GAME.speed;
    const step = 1000 / FPS;
    let n = 0;
    while (LOOP.acc >= step && n < 8) {
      const started = performance.now(); gameTick(); LOOP.tickTime += performance.now() - started; LOOP.ticks++;
      LOOP.acc -= step; n++;
    }
    if (n >= 8) LOOP.acc = 0;
  }
  RENDER.draw();
  UI.frame(LOOP.frame++, dt);
  LOOP.frames++;
  if (!LOOP.measuredAt) LOOP.measuredAt = now;
  if (now - LOOP.measuredAt >= 1000) {
    GAME.performance = {fps:Math.round(LOOP.frames * 1000 / (now - LOOP.measuredAt)), tickMs:LOOP.ticks ? LOOP.tickTime / LOOP.ticks : 0};
    LOOP.measuredAt = now; LOOP.frames = 0; LOOP.ticks = 0; LOOP.tickTime = 0;
  }
  requestAnimationFrame(loop);
}

function boot() {
  RENDER.init(document.getElementById('game'));
  UI.init();
  const seed = +(new URLSearchParams(location.search).get('seed') || 20260930);
  setupScenario(seed);
  RENDER.resize();
  for (const el of document.querySelectorAll('[data-rts-version]')) {
    el.textContent = el.dataset.rtsVersion === 'short' ? RTS_VERSION.split('-')[1].toUpperCase() : '버전 ' + RTS_VERSION;
  }
  document.getElementById('start-btn').addEventListener('click', () => {
    SND.init();
    document.getElementById('title').classList.add('hidden');
    GAME.running = true;
    UI.message('작전 개시 — 저그의 해처리를 모두 파괴하십시오.');
    UI.message('F1: 도움말 · F10: 테스트 패널(적 스폰/적 조작)');
  });
  document.getElementById('restart').addEventListener('click', () => location.reload());
  document.getElementById('continue').addEventListener('click', () => { document.getElementById('end').classList.add('hidden'); GAME.over = false; GAME.sandbox = true; const cb = document.getElementById('t-sandbox'); if (cb) cb.checked = true; });
  window.RTS = { GAME, UI, AI, RENDER, MAP };
  requestAnimationFrame(loop);
}
window.addEventListener('load', boot);
