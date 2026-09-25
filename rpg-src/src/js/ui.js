/* =========================================================
   UI : HUD / 인벤토리 / 장비 / 스탯 / 스킬 / 퀘스트 / 미니맵
   ========================================================= */
const UI = {};
const $ = id => document.getElementById(id);

UI.invTab = 'equip';
UI.mmStatic = '';

/* ---------------- HUD ---------------- */
UI.refreshHud = function () {
  const p = S.player;
  if (!p) return;
  const need = expNeeded(p.level);
  $('lvBadge').textContent = 'Lv.' + p.level;
  $('charName').textContent = p.name;
  $('jobName').textContent = JOBS[p.job].name;
  $('hpFill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
  $('mpFill').style.width = Math.max(0, p.mp / p.maxMp * 100) + '%';
  $('expFill').style.width = Math.min(100, p.exp / need * 100) + '%';
  $('hpText').textContent = Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp;
  $('mpText').textContent = Math.max(0, Math.ceil(p.mp)) + ' / ' + p.maxMp;
  $('expText').textContent = p.exp + ' / ' + need + '  (' + (p.exp / need * 100).toFixed(2) + '%)';
  $('mesoText').textContent = p.meso.toLocaleString();
  $('invMeso').textContent = p.meso.toLocaleString() + ' 메소';
  UI.refreshSkillBar();
};

UI.mapName = function (n) { $('mapName').textContent = n; };

UI.toast = function (msg, cls) {
  const d = document.createElement('div');
  d.className = 'toast ' + (cls || '');
  d.textContent = msg;
  $('toastArea').appendChild(d);
  setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = 0; }, 1800);
  setTimeout(() => d.remove(), 2300);
};

UI.levelUpFx = function () {
  const e = $('levelUpFx');
  e.classList.remove('hidden');
  e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
  setTimeout(() => e.classList.add('hidden'), 1600);
};

UI.showBossBar = function (m) {
  $('bossBar').classList.remove('hidden');
  $('bossBar').querySelector('.bossName').textContent = m.name + '  Lv.' + m.def.lv;
  UI.updateBossBar(m);
};
UI.updateBossBar = function (m) {
  $('bossHpFill').style.width = Math.max(0, m.hp / m.maxHp * 100) + '%';
  $('bossHpText').textContent = Math.max(0, m.hp).toLocaleString() + ' / ' + m.maxHp.toLocaleString();
};
UI.hideBossBar = function () { $('bossBar').classList.add('hidden'); };

UI.showDeath = function (lost) {
  $('deathScreen').classList.remove('hidden');
  $('deathScreen').querySelector('p').textContent = '경험치 ' + lost + '을(를) 잃었습니다. 마을에서 부활합니다.';
};
UI.hideDeath = function () { $('deathScreen').classList.add('hidden'); };

/* ---------------- 스킬바 ---------------- */
UI.buildSkillBar = function () {
  const bar = $('skillBar');
  bar.innerHTML = '';
  jobSkills(S.player.job).forEach(sk => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.dataset.skill = sk.id;
    d.innerHTML = `<span class="key">${sk.key}</span><svg viewBox="0 0 40 40">${Art.icon(sk.icon)}</svg><span style="font-size:9px">${sk.name.slice(0, 5)}</span><div class="cd hidden"></div>`;
    d.onclick = () => useSkill(sk.id);
    bar.appendChild(d);
  });
  S.player.quick.forEach((qid, i) => {
    const def = CONSUMABLES[qid];
    const d = document.createElement('div');
    d.className = 'slot';
    d.dataset.quick = i;
    d.innerHTML = `<span class="key">${i + 1}</span><svg viewBox="0 0 40 40">${def ? Art.icon(def.art) : ''}</svg><span class="cnt">0</span>`;
    d.onclick = () => useQuick(i);
    bar.appendChild(d);
  });
};
UI.refreshSkillBar = function () {
  const p = S.player;
  document.querySelectorAll('#skillBar .slot').forEach(d => {
    if (d.dataset.skill) {
      const cd = p.cds[d.dataset.skill] || 0;
      const el2 = d.querySelector('.cd');
      if (cd > 0) { el2.classList.remove('hidden'); el2.textContent = cd.toFixed(1); }
      else el2.classList.add('hidden');
    } else if (d.dataset.quick !== undefined) {
      const qid = p.quick[+d.dataset.quick];
      const it = qid && p.inv.use.find(x => x.id === qid);
      d.querySelector('.cnt').textContent = it ? it.qty : 0;
    }
  });
};

/* ---------------- 초상화 / 미리보기 ---------------- */
UI.drawPortrait = function () {
  const p = S.player;
  const svg = $('portrait');
  svg.innerHTML = `<g transform="translate(30,96) scale(0.82)">${Art.player(playerLook(p))}</g>`;
  const g = svg.querySelector('.char');
  if (g) Art.layoutPlayer(g);
};
UI.drawPreview = function () {
  const p = S.player;
  const svg = $('previewSvg');
  svg.innerHTML = `<g transform="translate(60,160) scale(1.25)">${Art.player(playerLook(p))}</g>`;
  const g = svg.querySelector('.char');
  if (g) Art.layoutPlayer(g);
};

/* ---------------- 인벤토리 ---------------- */
UI.renderInv = function () {
  const p = S.player;
  if (!p) return;
  const grid = $('invGrid');
  grid.innerHTML = '';
  const bag = p.inv[UI.invTab];
  for (let i = 0; i < 24; i++) {
    const c = document.createElement('div');
    c.className = 'cell';
    const it = bag[i];
    if (it) {
      if (it.rarity && it.rarity !== 'common') c.classList.add(it.rarity);
      c.innerHTML = `<svg viewBox="0 0 40 40">${Art.icon(it.art, it.color)}</svg>` + (it.qty > 1 ? `<span class="q">${it.qty}</span>` : '');
      c.onmouseenter = e => UI.tooltip(it, e);
      c.onmousemove = e => UI.tooltipMove(e);
      c.onmouseleave = () => UI.tooltipHide();
      c.onclick = () => {
        if (it.type === 'equip') equipItem(it);
        else if (it.type === 'use') useConsumable(it);
        UI.tooltipHide();
      };
      c.oncontextmenu = e => { e.preventDefault(); if (it.type === 'equip' || it.type === 'etc') sellItem(it); };
    }
    grid.appendChild(c);
  }
  $('invMeso').textContent = p.meso.toLocaleString() + ' 메소';
  UI.renderEquip();
};

UI.renderEquip = function () {
  const p = S.player;
  const box = $('equipSlots');
  box.innerHTML = '';
  EQUIP_SLOTS.forEach(sl => {
    const d = document.createElement('div');
    d.className = 'eslot';
    const it = p.equipped[sl.id];
    d.innerHTML = `<span class="lbl">${sl.name}</span>` + (it ? `<svg viewBox="0 0 40 40">${Art.icon(it.art, it.color)}</svg>` : '');
    if (it) {
      d.onmouseenter = e => UI.tooltip(it, e, true);
      d.onmousemove = e => UI.tooltipMove(e);
      d.onmouseleave = () => UI.tooltipHide();
      d.onclick = () => { unequipItem(sl.id); UI.tooltipHide(); };
    }
    box.appendChild(d);
  });
  const st = stats(p);
  $('equipSummary').textContent = `공격력 ${st.atk} · 방어력 ${st.def} · 크리 ${(st.crit * 100).toFixed(1)}%`;
  UI.drawPreview();
};

UI.tooltip = function (it, e, equipped) {
  const t = $('itemTooltip');
  const col = it.rarity ? RARITY[it.rarity].color : '#d8dcf0';
  let s = `<div class="tname" style="color:${col}">${it.name}</div>`;
  if (it.rarity) s += `<div style="color:${col};font-size:10px">${RARITY[it.rarity].name} · ${EQUIP_SLOTS.find(x => x.id === it.slot).name}</div>`;
  const rows = [];
  if (it.atk) rows.push('공격력 +' + it.atk);
  if (it.def) rows.push('방어력 +' + it.def);
  if (it.hp) rows.push('최대 HP +' + it.hp);
  if (it.mp) rows.push('최대 MP +' + it.mp);
  if (it.spd) rows.push('이동속도 +' + it.spd);
  if (it.crit) rows.push('크리티컬 +' + (it.crit * 100).toFixed(1) + '%');
  if (rows.length) s += `<div class="tstat">${rows.join('<br>')}</div>`;
  if (it.desc) s += `<div>${it.desc}</div>`;
  s += `<div class="thint">${equipped ? '클릭: 장비 해제' : it.type === 'equip' ? '클릭: 장착 · 우클릭: 판매' : it.type === 'use' ? '클릭: 사용' : '우클릭: 판매'}</div>`;
  t.innerHTML = s;
  t.classList.remove('hidden');
  UI.tooltipMove(e);
};
UI.tooltipMove = function (e) {
  const t = $('itemTooltip');
  t.style.left = Math.min(window.innerWidth - 260, e.clientX + 16) + 'px';
  t.style.top = Math.min(window.innerHeight - 160, e.clientY + 12) + 'px';
};
UI.tooltipHide = function () { $('itemTooltip').classList.add('hidden'); };

function equipItem(it) {
  const p = S.player;
  const cur = p.equipped[it.slot];
  p.equipped[it.slot] = it;
  p.inv.equip = p.inv.equip.filter(x => x !== it);
  if (cur) p.inv.equip.push(cur);
  refreshStats(p);
  rebuildPlayerArt();
  UI.renderInv(); UI.refreshHud(); UI.renderStats();
  UI.toast('장착: ' + it.name);
}
function unequipItem(slotId) {
  const p = S.player;
  const it = p.equipped[slotId];
  if (!it) return;
  if (p.inv.equip.length >= 24) { UI.toast('인벤토리가 가득 찼습니다!', 'warn'); return; }
  p.inv.equip.push(it);
  delete p.equipped[slotId];
  refreshStats(p);
  rebuildPlayerArt();
  UI.renderInv(); UI.refreshHud(); UI.renderStats();
}
function sellItem(it) {
  const p = S.player;
  const price = it.type === 'equip'
    ? Math.round((it.atk * 12 + it.def * 9 + it.hp * 2 + it.mp * 2 + it.crit * 900 + 30) * RARITY[it.rarity].mul)
    : 15 * (it.qty || 1);
  if (it.type === 'equip') p.inv.equip = p.inv.equip.filter(x => x !== it);
  else p.inv.etc = p.inv.etc.filter(x => x !== it);
  p.meso += price;
  UI.toast('판매: ' + it.name + ' (+' + price + ' 메소)', 'gold');
  UI.renderInv(); UI.refreshHud();
}

/* ---------------- 스탯 창 ---------------- */
UI.renderStats = function () {
  const p = S.player;
  if (!p) return;
  const st = stats(p);
  const row = (a, b) => `<div class="statRow"><span>${a}</span><b>${b}</b></div>`;
  const ap = (label, k) => `<div class="apRow"><span>${label}</span><span><b>${p[k]}</b> ${p.ap > 0 ? `<button data-ap="${k}">+</button>` : ''}</span></div>`;
  $('statBody').innerHTML =
    row('이름', p.name) + row('직업', JOBS[p.job].name) + row('레벨', p.level) +
    row('경험치', p.exp + ' / ' + expNeeded(p.level)) +
    `<div class="statHead">능력치 (남은 AP: ${p.ap})</div>` +
    ap('STR', 'str') + ap('DEX', 'dex') + ap('INT', 'int') + ap('LUK', 'luk') +
    `<div class="statHead">전투</div>` +
    row('공격력', st.atk) + row('방어력', st.def) + row('크리티컬', (st.crit * 100).toFixed(1) + '%') +
    row('HP', Math.ceil(p.hp) + ' / ' + st.maxHp) + row('MP', Math.ceil(p.mp) + ' / ' + st.maxMp) +
    row('이동속도', Math.round(st.speed)) + row('메소', p.meso.toLocaleString());
  $('statBody').querySelectorAll('[data-ap]').forEach(b => {
    b.onclick = () => {
      if (p.ap <= 0) return;
      p[b.dataset.ap]++; p.ap--;
      refreshStats(p);
      UI.renderStats(); UI.refreshHud(); UI.renderEquip();
    };
  });
};

/* ---------------- 스킬 창 ---------------- */
UI.renderSkills = function () {
  $('skillBody').innerHTML = jobSkills(S.player.job).map(sk => `
    <div class="skillRow">
      <svg viewBox="0 0 40 40">${Art.icon(sk.icon)}</svg>
      <div class="sinfo"><div class="sname">${sk.name} <span style="color:#9fb2ff;font-size:10px">[${sk.key}]</span></div>
      <div class="sdesc">${sk.desc}<br>재사용 대기 ${sk.cd}초</div></div>
    </div>`).join('');
};

/* ---------------- 퀘스트 창 ---------------- */
UI.renderQuests = function () {
  const p = S.player;
  if (!p) return;
  $('questBody').innerHTML = QUESTS.map(q => {
    const st = p.quests[q.id] || { n: 0, done: false };
    const locked = q.reqLv && p.level < q.reqLv;
    return `<div class="qItem ${st.done ? 'done' : ''}">
      <div class="qname">${q.name} ${st.done ? '✔' : ''}</div>
      <div class="qdesc">${q.desc}${locked ? ` <span style="color:#ff9c9c">(Lv.${q.reqLv} 필요)</span>` : ''}</div>
      <div class="qprog">진행 ${Math.min(st.n, q.need)} / ${q.need} · 보상 EXP ${q.exp} · ${q.meso} 메소</div>
    </div>`;
  }).join('');
};

/* ---------------- 미니맵 ---------------- */
UI.buildMinimapStatic = function () {
  const m = S.map;
  const sx = 220 / m.w, sy = 110 / 700;
  const gc = { ice: '#3c5f80', lava: '#5a2420', forest: '#2f5a37', town: '#3f5a3a' }[m.theme] || '#3a5a46';
  let s = `<rect x="0" y="0" width="220" height="120" fill="#0b1022"/>`;
  s += `<rect x="0" y="${(m.groundY * sy).toFixed(1)}" width="220" height="${(120 - m.groundY * sy).toFixed(1)}" fill="${gc}"/>`;
  m.platforms.forEach(p => {
    s += `<rect x="${(p.x * sx).toFixed(1)}" y="${(p.y * sy).toFixed(1)}" width="${Math.max(2, p.w * sx).toFixed(1)}" height="2.5" rx="1" fill="#7fa4d8"/>`;
  });
  m.portals.forEach(p => {
    s += `<circle cx="${(p.x * sx).toFixed(1)}" cy="${(p.y * sy - 3).toFixed(1)}" r="3.4" fill="${p.boss ? '#ff7a4d' : '#8fd8ff'}"/>`;
  });
  (m.npcs || []).forEach(n => {
    s += `<circle cx="${(n.x * sx).toFixed(1)}" cy="${(n.y * sy - 3).toFixed(1)}" r="3" fill="#ffd166"/>`;
  });
  UI.mmStatic = s;
};
UI.updateMinimap = function () {
  const m = S.map, p = S.player;
  const sx = 220 / m.w, sy = 110 / 700;
  let s = UI.mmStatic;
  S.monsters.forEach(mo => {
    if (mo.dead) return;
    s += `<circle cx="${(mo.x * sx).toFixed(1)}" cy="${(mo.y * sy - 2).toFixed(1)}" r="${mo.boss ? 5 : 2.6}" fill="${mo.boss ? '#ff3b3b' : '#ff8b8b'}"/>`;
  });
  S.drops.forEach(d => {
    s += `<circle cx="${(d.x * sx).toFixed(1)}" cy="${(d.y * sy - 2).toFixed(1)}" r="1.8" fill="#ffd166"/>`;
  });
  s += `<g transform="translate(${(p.x * sx).toFixed(1)},${(p.y * sy - 4).toFixed(1)})">
    <circle r="4.6" fill="#fff" opacity="0.35"/><circle r="3" fill="#4dff88"/></g>`;
  // 카메라 박스
  s += `<rect x="${(S.cam.x * sx).toFixed(1)}" y="0" width="${(GAME.W * sx).toFixed(1)}" height="118" fill="none" stroke="#ffffff" stroke-opacity="0.25"/>`;
  $('minimap').innerHTML = s;
};

/* ---------------- 창 관리 ---------------- */
UI.toggleWin = function (id) {
  const w = $(id);
  w.classList.toggle('hidden');
  if (!w.classList.contains('hidden')) {
    if (id === 'winInv') UI.renderInv();
    if (id === 'winEquip') UI.renderEquip();
    if (id === 'winStat') UI.renderStats();
    if (id === 'winSkill') UI.renderSkills();
    if (id === 'winQuest') UI.renderQuests();
    w.style.zIndex = ++UI.z;
  }
};
UI.z = 20;

UI.initWindows = function () {
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      UI.invTab = t.dataset.tab;
      UI.renderInv();
    };
  });
  $('btnSort').onclick = () => {
    const p = S.player;
    p.inv.equip.sort((a, b) => (b.atk + b.def) - (a.atk + a.def));
    p.inv.use.sort((a, b) => a.name.localeCompare(b.name));
    UI.renderInv(); UI.toast('정렬 완료');
  };
  $('mmToggle').onclick = () => $('minimapBox').classList.toggle('collapsed');
  // 드래그
  document.querySelectorAll('.win').forEach(w => {
    const bar = w.querySelector('.winBar');
    let dx = 0, dy = 0, drag = false;
    bar.addEventListener('mousedown', e => {
      drag = true; dx = e.clientX - w.offsetLeft; dy = e.clientY - w.offsetTop;
      w.style.zIndex = ++UI.z;
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      w.style.left = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dx)) + 'px';
      w.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + 'px';
    });
    window.addEventListener('mouseup', () => drag = false);
  });
};
