/* =========================================================
   MAIN : 시작 화면 / 게임 루프 / 저장 · 불러오기
   ========================================================= */
const SAVE_KEY = 'svgMapleSave_v1';
let pickedJob = 'warrior';

/* ---------------- 간단한 효과음 (WebAudio) ---------------- */
const SFX = {
  ctx: null, on: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; } } },
  play(freq, dur, type, vol) {
    if (!this.on) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
    g.gain.setValueAtTime((vol || 0.08), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  swing() { this.play(520, 0.08, 'triangle', 0.05); },
  hit() { this.play(220, 0.09, 'square', 0.05); },
  crit() { this.play(760, 0.14, 'sawtooth', 0.06); },
  hurt() { this.play(150, 0.2, 'sawtooth', 0.07); },
  pick() { this.play(880, 0.09, 'sine', 0.06); },
  level() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.play(f, 0.18, 'triangle', 0.07), i * 110)); },
  die() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'sawtooth', 0.07), i * 120)); },
  draw() { this.play(300, 0.16, 'sine', 0.035); },
  release() { this.play(1100, 0.07, 'triangle', 0.05); },
  cast() { this.play(660, 0.16, 'sine', 0.05); },
  buff() { [523, 784, 1047].forEach((f, i) => setTimeout(() => this.play(f, 0.14, 'sine', 0.05), i * 80)); },
};

function initStartScreen() {
  const box = $('jobPick');
  box.innerHTML = '';
  Object.values(JOBS).forEach(j => {
    const d = document.createElement('div');
    d.className = 'jobCard' + (j.id === pickedJob ? ' active' : '');
    d.innerHTML = `<svg viewBox="0 0 120 150"><g transform="translate(60,128) scale(0.95)">${Art.player({ job: j.id })}</g></svg>
      <div class="jn">${j.name}</div><div class="jd">${j.desc}</div>`;
    const cg = d.querySelector('.char');
    if (cg) Art.layoutPlayer(cg);
    d.onclick = () => {
      pickedJob = j.id;
      document.querySelectorAll('.jobCard').forEach(c => c.classList.remove('active'));
      d.classList.add('active');
    };
    box.appendChild(d);
    const g = d.querySelector('.char');
    if (g) Art.layoutPlayer(g);
  });
  $('btnStart').onclick = () => startGame($('nameField').value.trim() || '모험가', pickedJob);
}

function startGame(name, job) {
  S.player = createPlayer(name, job);
  refreshStats(S.player, true);
  $('startScreen').classList.add('hidden');
  UI.buildSkillBar();
  loadMap('town', 200);
  UI.drawPortrait();
  UI.refreshHud(); UI.renderInv(); UI.renderQuests(); UI.renderSkills();
  S.running = true;
  focusGame();
  UI.toast('오른쪽 포탈(↑)로 사냥터에 갈 수 있어요!');
  last = performance.now();
  requestAnimationFrame(frame);
}

/* ---------------- 저장 / 불러오기 ---------------- */
function saveGame(silent) {
  if (!S.player) return;
  const p = S.player;
  const data = {
    v: 1, mapId: S.mapId, killCount: S.killCount,
    p: {
      name: p.name, job: p.job, level: p.level, exp: p.exp, meso: p.meso,
      str: p.str, dex: p.dex, int: p.int, luk: p.luk, ap: p.ap, sp: p.sp,
      hp: p.hp, mp: p.mp, inv: p.inv, equipped: p.equipped, quests: p.quests, quick: p.quick,
    },
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  if (!silent) UI.toast('저장 완료!', 'gold');
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { UI.toast('저장된 데이터가 없습니다.', 'warn'); return false; }
  try {
    const d = JSON.parse(raw);
    S.player = createPlayer(d.p.name, d.p.job);
    Object.assign(S.player, d.p);
    S.killCount = d.killCount || {};
    refreshStats(S.player);
    $('startScreen').classList.add('hidden');
    UI.buildSkillBar();
    loadMap(MAPS[d.mapId] ? d.mapId : 'town', 200);
    UI.drawPortrait();
    UI.refreshHud(); UI.renderInv(); UI.renderQuests(); UI.renderSkills(); UI.renderStats();
    if (!S.running) { S.running = true; last = performance.now(); requestAnimationFrame(frame); }
    UI.toast('불러오기 완료!', 'gold');
    return true;
  } catch (e) {
    UI.toast('불러오기 실패: ' + e.message, 'warn');
    return false;
  }
}

/* ---------------- 게임 루프 ---------------- */
let last = 0, acc = 0, mmTimer = 0, hudTimer = 0, autoSave = 0;

function frame(ts) {
  if (!S.running) return;
  let dt = (ts - last) / 1000;
  last = ts;
  if (dt > 0.05) dt = 0.05;
  S.t += dt;

  if (!S.paused) {
    controlPlayer(dt);
    updateMonsters(dt);
    updateProjectiles(dt);
    updateDrops(dt);
    updateFx(dt);
    animatePlayer(dt);
    updateCamera(false);
    // NPC 애니메이션
    S.npcs.forEach(n => {
      n.t += dt;
      const b = n.node.querySelector('.bodyG');
      if (b) b.setAttribute('transform', `translate(0,${Math.sin(n.t * 2.2) * 2})`);
    });

    mmTimer += dt;
    if (mmTimer > 0.1) { mmTimer = 0; UI.updateMinimap(); }
    hudTimer += dt;
    if (hudTimer > 0.15) { hudTimer = 0; UI.refreshHud(); }
    autoSave += dt;
    if (autoSave > 30) { autoSave = 0; saveGame(true); }
  }
  // 눌림 초기화
  S.pressed = {};
  requestAnimationFrame(frame);
}

/* ---------------- 전역 키 ---------------- */
function focusGame() {
  const g = $('game');
  if (!g) return;
  g.setAttribute('tabindex', '-1');
  try { window.focus(); } catch (e) { /* noop */ }
  g.focus({ preventScroll: true });
  if (document.activeElement && document.activeElement.blur &&
      document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  g.focus({ preventScroll: true });
}

function initGlobalKeys() {
  const refocus = e => { if (S.running && e.target.tagName !== 'INPUT') focusGame(); };
  window.addEventListener('pointerdown', refocus);
  window.addEventListener('click', refocus);
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (!S.running) return;
    switch (e.code) {
      case 'KeyI': UI.toggleWin('winInv'); break;
      case 'KeyE': UI.toggleWin('winEquip'); break;
      case 'KeyS': UI.toggleWin('winStat'); break;
      case 'KeyK': UI.toggleWin('winSkill'); break;
      case 'KeyQ': UI.toggleWin('winQuest'); break;
      case 'F1': e.preventDefault(); UI.toggleWin('winHelp'); break;
      case 'Escape':
        document.querySelectorAll('.win').forEach(w => w.classList.add('hidden'));
        break;
    }
  });
}

/* ---------------- 부팅 ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  initLayers();
  initInput();
  initGlobalKeys();
  UI.initWindows();
  initStartScreen();
  window.addEventListener('resize', () => { if (S.map) resizeStage(); });
  window.addEventListener('pointerdown', () => SFX.init(), { once: true });

  $('btnSave').onclick = () => saveGame(false);
  $('btnLoad').onclick = () => loadGame();
  $('btnHelp').onclick = () => UI.toggleWin('winHelp');
  $('btnReset').onclick = () => {
    if (confirm('저장 데이터를 삭제하고 처음부터 시작할까요?')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  };
  $('btnRevive').onclick = () => revivePlayer();

  if (localStorage.getItem(SAVE_KEY)) {
    const b = document.createElement('button');
    b.textContent = '이어하기';
    b.id = 'btnContinue';
    b.style.cssText = 'margin-left:10px;background:#39426b;color:#e8ecff;border:1px solid #5a6796;padding:9px 20px;border-radius:9px;cursor:pointer;font-size:14px';
    $('btnStart').after(b);
    b.onclick = () => loadGame();
  }
});
