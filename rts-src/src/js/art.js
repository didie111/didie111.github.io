'use strict';
// ===================================================================
//  절차적 픽셀 아트 — 스타크래프트1 풍 (Badlands 타일셋 / 3종족 스프라이트)
//  외부 이미지 없이 캔버스로 생성하여 캐시
// ===================================================================
const ART = (() => {
  const cache = new Map();
  const DIRS = 16;
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function hex2rgb(h) {
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function shade(h, f) {
    const [r, g, b] = hex2rgb(h);
    const m = f >= 0 ? (c) => Math.round(c + (255 - c) * f) : (c) => Math.round(c * (1 + f));
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  // ---------- 그리기 헬퍼 ----------
  let g = null;
  function E(x, y, rx, ry, fill, stroke, lw) {
    g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
  }
  function R(x, y, w, h, fill, rad, stroke) {
    g.beginPath();
    if (rad) { g.roundRect ? g.roundRect(x, y, w, h, rad) : g.rect(x, y, w, h); } else g.rect(x, y, w, h);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  }
  function Pl(pts, fill, stroke, lw) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
  }
  function L(x1, y1, x2, y2, c, w) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = c; g.lineWidth = w || 1; g.lineCap = 'round'; g.stroke(); }
  function mirror(pts) { return pts.concat(pts.slice().reverse().map(p => [p[0], -p[1]])); }

  const TM = { mid: '#8a9098', lt: '#c4cad0', dk: '#4a5058', glass: '#3a6a90' };
  const ZC = { mid: '#7a5648', lt: '#b08070', dk: '#3a2420', flesh: '#a86858', bone: '#d8ccb0' };
  const PC = { mid: '#c8a048', lt: '#f0d880', dk: '#6a5020', glow: '#60d0ff', glow2: '#a0f0ff' };

  // ---------- 유닛 그리기 (로컬 좌표: +x 전방) ----------
  const U = {
    scv(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      E(-1 + ph * 2, -4, 2.5, 1.8, TM.dk); E(-1 - ph * 2, 4, 2.5, 1.8, TM.dk);
      E(-1, 0, 7, 6.5, '#9a9478'); E(-3, 0, 4, 5, '#7a7460');
      E(-1, -5.5, 3, 2.2, T.main); E(-1, 5.5, 3, 2.2, T.main);
      E(2, 0, 3.4, 3.4, TM.glass); E(2.8, -1, 1.3, 1.1, '#a0d0f0');
      R(3, 2.5, 6 + (a ? 2 : 0), 2, '#505050'); R(3, -4.5, 5, 1.8, '#606060');
      if (a) E(9 + 2, 3.5, 1.4, 1.4, '#ffffa0');
    },
    marine(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      E(ph * 2.5, -2.8, 2.2, 1.6, '#2a2e38'); E(-ph * 2.5, 2.8, 2.2, 1.6, '#2a2e38');
      E(-1, 0, 4.6, 5.4, '#606878'); E(-3.5, 0, 2.2, 3.5, '#484e5a');
      E(-0.5, -4.6, 2.8, 2.4, T.main); E(-0.5, 4.6, 2.8, 2.4, T.main);
      E(-1, -4.8, 1.2, 1, T.light); E(-1, 4.4, 1.2, 1, T.light);
      E(1, 0, 3, 2.9, '#7c8494'); R(2.2, -1.4, 1.4, 2.8, '#e0c040');
      R(1.5, 1.4, 8 + (a ? 1 : 0), 1.8, '#26282c'); R(5, 1, 2, 2.4, '#3a3c40');
    },
    firebat(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      E(ph * 2.5, -3.2, 2.4, 1.8, '#2a2a2a'); E(-ph * 2.5, 3.2, 2.4, 1.8, '#2a2a2a');
      E(-5, -3, 2.8, 2.2, '#b04828'); E(-5, 3, 2.8, 2.2, '#b04828');
      E(-1, 0, 5.4, 6.4, '#a07448'); E(-0.5, -5.4, 3.2, 2.6, T.main); E(-0.5, 5.4, 3.2, 2.6, T.main);
      E(1.5, 0, 3, 3, '#8a6040'); R(2.8, -1.2, 1.3, 2.4, '#ffb040');
      R(2, -6, 7, 2.2, '#3a3a3a'); R(2, 3.8, 7, 2.2, '#3a3a3a');
      if (a) { E(9.5, -5, 1.6, 1.4, '#ff8020'); E(9.5, 5, 1.6, 1.4, '#ff8020'); }
    },
    medic(T, f) {
      const ph = [0, 1, 0, -1][f];
      E(ph * 2.5, -2.8, 2.2, 1.6, '#50505a'); E(-ph * 2.5, 2.8, 2.2, 1.6, '#50505a');
      E(-1, 0, 4.6, 5.4, '#d8d8dc'); E(-0.5, -4.6, 2.8, 2.4, T.main); E(-0.5, 4.6, 2.8, 2.4, T.main);
      R(-5, -1, 3, 2, '#e02020'); R(-4.5, -1.8, 2, 3.6, '#e02020');
      E(1, 0, 3, 2.9, '#f0f0f0'); R(2.2, -1.4, 1.4, 2.8, '#50b0e0');
    },
    ghost(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      E(ph * 2.5, -2.4, 2, 1.4, '#222'); E(-ph * 2.5, 2.4, 2, 1.4, '#222');
      E(-1, 0, 4, 4.6, '#5a6068'); E(-0.5, -4, 2.2, 1.8, T.main); E(-0.5, 4, 2.2, 1.8, T.main);
      E(1, 0, 2.6, 2.6, '#707880'); R(2, -1, 1.4, 2, '#ff4040');
      R(0, 1.2, 12, 1.4, '#1c1c1c'); R(8, 0.8, 3, 2, '#303030');
    },
    vulture(T, f) {
      Pl([[13, 0], [5, -5], [-8, -5.5], [-11, -2], [-11, 2], [-8, 5.5], [5, 5]], '#9aa0a8');
      Pl([[11, 0], [5, -3], [-4, -3], [-4, 3], [5, 3]], '#b8bec4');
      Pl([[4, -5], [-6, -5.5], [-6, -3.5], [4, -3]], T.main); Pl([[4, 5], [-6, 5.5], [-6, 3.5], [4, 3]], T.main);
      E(-2, 0, 3, 2.4, '#505860'); E(-1, 0, 1.6, 1.4, '#303438');
      R(-13, -4.5, 3, 3, '#ff9030'); R(-13, 1.5, 3, 3, '#ff9030');
      if (f % 2) { E(-14.5, -3, 1.6, 1, '#ffe080'); E(-14.5, 3, 1.6, 1, '#ffe080'); }
    },
    tank(T, f) {
      const off = f % 2 ? 2 : 0;
      R(-13, -11, 26, 6, '#2c2c2c', 1); R(-13, 5, 26, 6, '#2c2c2c', 1);
      for (let x = -12 + off; x < 12; x += 4) { L(x, -11, x, -5, '#4a4a4a'); L(x, 5, x, 11, '#4a4a4a'); }
      R(-11, -7, 22, 14, '#848c88', 2); R(-9, -6, 5, 12, T.main); R(6, -6, 4, 12, '#6a7270');
      E(0, 0, 6.5, 5.5, '#a4aca8'); E(-1, 0, 3.5, 3, '#8a928e');
      R(4, -1.6, 13, 3.2, '#5e6664'); R(15, -2, 3, 4, '#4a5250');
    },
    tank_siege(T) {
      for (const [x, y] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { L(x * 0.6, y * 0.6, x * 1.25, y * 1.25, '#3a3a3a', 3); E(x * 1.25, y * 1.25, 2.5, 2.5, '#505050'); }
      R(-10, -8, 20, 16, '#7c8480', 2); R(-9, -7, 5, 14, T.main);
      E(-1, 0, 7.5, 6.5, '#a0a8a4'); E(-2, 0, 4, 3.5, '#8a928e');
      R(3, -2.4, 20, 4.8, '#5a6260'); R(20, -3, 4, 6, '#444c4a'); R(3, -3.2, 5, 6.4, T.dark);
    },
    goliath(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      R(-4 + ph * 3, -9, 7, 3.4, '#4a5058', 1); R(-4 - ph * 3, 5.6, 7, 3.4, '#4a5058', 1);
      E(-1, 0, 7, 7, '#8e949c'); E(1.5, 0, 3.4, 3.4, TM.glass);
      R(-5, -11, 7, 4, T.main, 1); R(-5, 7, 7, 4, T.main, 1);
      R(0, -8.5, 10, 2.6, '#40444a'); R(0, 5.9, 10, 2.6, '#40444a');
      R(-6, -12, 3, 6, '#60666e'); R(-6, 6, 3, 6, '#60666e');
      if (a) { E(10.5, -7.2, 1.3, 1.3, '#ffff80'); E(10.5, 7.2, 1.3, 1.3, '#ffff80'); }
    },
    wraith(T) {
      Pl([[15, 0], [-3, -4], [-9, -13], [-12, -12], [-8, -3], [-12, 0], [-8, 3], [-12, 12], [-9, 13], [-3, 4]], '#a8b0b8');
      Pl([[-4, -5], [-9, -12], [-11, -11], [-7, -4]], T.main); Pl([[-4, 5], [-9, 12], [-11, 11], [-7, 4]], T.main);
      Pl([[12, 0], [0, -2.5], [-8, -1.5], [-8, 1.5], [0, 2.5]], '#8a929a');
      E(5, 0, 3.2, 1.6, '#2a3440'); E(-12, -2.5, 2, 1.4, '#ffb030'); E(-12, 2.5, 2, 1.4, '#ffb030');
    },
    dropship(T, f) {
      R(-10, -12, 16, 5, '#5a626a', 2); R(-10, 7, 16, 5, '#5a626a', 2);
      E(-12, -9.5, 2, 2.2, f % 2 ? '#ffe080' : '#ff9030'); E(-12, 9.5, 2, 2.2, f % 2 ? '#ffe080' : '#ff9030');
      R(-13, -7, 24, 14, '#8a9098', 5); E(11, 0, 5, 6, '#9aa0a8'); E(12, 0, 2.6, 3.6, TM.glass);
      R(-6, -7, 4, 14, T.main); R(-12, -4, 4, 8, '#6a7078');
    },
    vessel(T) {
      E(-3, 0, 15, 15, '#8a90a0'); E(-3, 0, 12, 12, '#6a7080'); E(-3, 0, 7, 7, '#5a9ae0'); E(-4.5, -2, 3, 2.4, '#b0e0ff');
      for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3; E(-3 + Math.cos(an) * 13.5, Math.sin(an) * 13.5, 1.6, 1.6, k % 2 ? T.main : '#c0c8d0'); }
      R(10, -1.2, 9, 2.4, '#a0a8b0'); E(19, 0, 2.5, 5, '#c0c8d0');
    },
    bc(T) {
      Pl([[24, 0], [15, -8], [-14, -13], [-24, -8], [-24, 8], [-14, 13], [15, 8]], '#6e767e');
      Pl([[16, 0], [10, -5], [-16, -6], [-16, 6], [10, 5]], '#949ca4');
      R(-10, -12, 12, 3, T.main); R(-10, 9, 12, 3, T.main);
      R(14, -3, 10, 6, '#50585e'); R(-6, -2.5, 12, 5, '#b0b8c0');
      E(-24, -5, 2.2, 2.2, '#40a0ff'); E(-24, 5, 2.2, 2.2, '#40a0ff'); E(-24, 0, 2.2, 2.2, '#40a0ff');
      E(4, 0, 2.6, 2, '#2a3440');
    },
    spider_mine(T) {
      for (let k = 0; k < 3; k++) { const an = k * 2.09 + 0.5; L(0, 0, Math.cos(an) * 6, Math.sin(an) * 6, '#303030', 1.5); }
      E(0, 0, 3.6, 3.6, '#4a4a4a'); E(0, 0, 1.6, 1.6, T.main);
    },
    // ---------------- ZERG ----------------
    larva(T, f) {
      const w = [0, 0.6, 0, -0.6][f];
      E(-4, w, 2.6, 2.2, '#6a4a3a'); E(-1, -w * 0.5, 3.2, 2.8, '#7e5a46'); E(2.5, w * 0.5, 3, 2.6, '#8a6650'); E(4.5, 0, 1.4, 1.4, '#3a2020');
      L(-3, -2, -3, 2, '#4a3028'); L(0, -2.5, 0, 2.5, '#4a3028');
    },
    egg(T, f) {
      const p = [0, 0.4, 0.8, 0.4][f];
      E(0, 0, 8 + p, 10 + p, '#8a6a4a'); E(-1.5, -2, 5, 6, '#a88460');
      L(0, -10, 0, 10, '#5a3a2a'); L(-6, -6, 5, 7, '#6a4a30'); L(6, -6, -4, 8, '#6a4a30');
      E(0, 0, 3, 3, T.dark);
    },
    drone(T, f, a) {
      const w = f % 2 ? 1 : 0;
      Pl([[-2, -3], [-7, -9 - w], [-9, -6], [-4, -2]], 'rgba(200,180,160,0.5)'); Pl([[-2, 3], [-7, 9 + w], [-9, 6], [-4, 2]], 'rgba(200,180,160,0.5)');
      E(-1, 0, 7, 6, '#8a6650'); E(-3, 0, 4, 4.5, T.dark); E(-2, 0, 2.5, 3, T.main);
      E(5, 0, 3.4, 3.2, '#6a4a3a');
      L(6, -2, 11 + (a ? 2 : 0), -4, ZC.bone, 1.6); L(6, 2, 11 + (a ? 2 : 0), 4, ZC.bone, 1.6);
    },
    zergling(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      L(2, -2, 3 + ph * 2, -5, '#4a2e24', 1.4); L(2, 2, 3 - ph * 2, 5, '#4a2e24', 1.4);
      L(-3, -2, -3 - ph * 2, -5, '#4a2e24', 1.4); L(-3, 2, -3 + ph * 2, 5, '#4a2e24', 1.4);
      E(-1, 0, 5.4, 3.6, '#7a5040'); E(-2, 0, 3, 2.2, T.main); E(4, 0, 2.8, 2.6, '#5a3a2e');
      Pl([[-5, -2], [-9, -4], [-6, 0]], '#9a6a50'); Pl([[-5, 2], [-9, 4], [-6, 0]], '#9a6a50');
      const s = a ? 3 : 0;
      L(3, -2.5, 8 + s, -5, ZC.bone, 1.3); L(3, 2.5, 8 + s, 5, ZC.bone, 1.3);
    },
    hydra(T, f, a) {
      const w = [0, 1, 0, -1][f];
      E(-8, w, 4.5, 2.8, '#6a4a3a'); E(-11, w * 1.5, 2.4, 1.8, '#5a3a2a');
      E(-2, 0, 5.6, 4.6, '#80584a'); E(0, 0, 3.4, 7.6, T.dark); E(0.5, 0, 2.6, 6.2, T.main);
      for (const s of [-1, 1]) Pl([[0, s * 6], [-3, s * 10], [1.5, s * 7]], ZC.bone);
      E(5, 0, 3, 2.4, '#4a2e28'); E(6.5, 0, 1.2, 1, '#e0c060');
      L(2, -3, 7 + (a ? 2 : 0), -4.5, ZC.bone, 1.2); L(2, 3, 7 + (a ? 2 : 0), 4.5, ZC.bone, 1.2);
    },
    lurker(T, f) {
      const ph = [0, 1, 0, -1][f];
      for (let k = -1; k <= 1; k++) { L(k * 5, -4, k * 5 + ph * 2, -10, '#3a2420', 1.6); L(k * 5, 4, k * 5 - ph * 2, 10, '#3a2420', 1.6); }
      E(-1, 0, 10, 6.5, '#6a4a40'); E(-2, 0, 6, 4, T.dark);
      for (let k = 0; k < 4; k++) { const x = -7 + k * 4; Pl([[x, -2], [x - 3, -8], [x + 1, -2.5]], ZC.bone); Pl([[x, 2], [x - 3, 8], [x + 1, 2.5]], ZC.bone); }
      E(9, 0, 3, 3, '#4a2e28'); E(-2, 0, 2.4, 2.4, T.main);
    },
    lurker_egg(T, f) { U.egg(T, f); E(0, 0, 9, 6, 'rgba(120,60,40,0.4)'); },
    overlord(T, f) {
      const w = [0, 1, 2, 1][f];
      for (let k = -2; k <= 2; k++) L(-12, k * 3, -20 - w, k * 4 + (k % 2 ? w : -w), '#6a4a4a', 1.6);
      E(-2, 0, 15, 13, '#8a6a5a'); E(-3, 0, 12, 10, '#9a7a66');
      E(-4, -5, 6, 4, T.main); E(-4, 5, 6, 4, T.main); E(-9, 0, 4, 3, T.dark);
      E(9, 0, 6, 5.4, '#6a4a48'); E(12, -2, 1.3, 1.1, '#e0d060'); E(12, 2, 1.3, 1.1, '#e0d060');
    },
    mutalisk(T, f) {
      const s = [1, 0.75, 0.45, 0.75][f];
      Pl([[1, -2], [-5, -18 * s], [-13, -17 * s], [-9, -9 * s], [-4, -3]], '#8a6a7a'); Pl([[1, 2], [-5, 18 * s], [-13, 17 * s], [-9, 9 * s], [-4, 3]], '#8a6a7a');
      Pl([[-3, -4], [-6, -15 * s], [-10, -14 * s], [-6, -4]], T.main); Pl([[-3, 4], [-6, 15 * s], [-10, 14 * s], [-6, 4]], T.main);
      E(-11, 0, 4, 1.8, '#5a4050'); E(-15, 0, 2, 1.3, '#4a3040');
      E(0, 0, 7, 3.6, '#6a5060'); E(7, 0, 3, 2.8, '#4a3040'); E(9, 0, 1.2, 1.2, '#b0ff60');
    },
    scourge(T, f) {
      const s = [1, 0.6, 0.3, 0.6][f];
      Pl([[0, -1], [-3, -7 * s], [-6, -5 * s]], '#8a6a5a'); Pl([[0, 1], [-3, 7 * s], [-6, 5 * s]], '#8a6a5a');
      E(0, 0, 4, 2.6, T.main); E(3, 0, 2, 2, '#5a3a2a'); E(-1, 0, 1.4, 1.4, '#ff9040');
    },
    ultralisk(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      for (const x of [-8, 4]) { R(x + ph * 2, -12, 4, 5, '#5a4a40', 1); R(x - ph * 2, 7, 4, 5, '#5a4a40', 1); }
      E(-3, 0, 14, 11, '#9a8070'); E(-4, 0, 10, 8, T.dark); E(-5, 0, 7, 5, T.main);
      for (let k = 0; k < 3; k++) E(-10 + k * 5, 0, 2, 1.5, ZC.bone);
      E(9, 0, 6, 6, '#6a5a50');
      const r = a ? 4 : 0;
      Pl([[5, -7], [18 + r, -15], [22 + r, -12], [9, -4]], ZC.bone, '#8a7a60'); Pl([[5, 7], [18 + r, 15], [22 + r, 12], [9, 4]], ZC.bone, '#8a7a60');
    },
    defiler(T, f) {
      const ph = [0, 1, 0, -1][f];
      for (let k = -2; k <= 2; k++) { L(k * 4, -3, k * 4 + ph * (k % 2 ? 1 : -1) * 2, -8, '#3a2a20', 1.2); L(k * 4, 3, k * 4 - ph * (k % 2 ? 1 : -1) * 2, 8, '#3a2a20', 1.2); }
      E(-9, 0, 3, 3, '#6a5040'); E(-5, 0, 4, 4, '#7a5a48'); E(-5, 0, 2, 2, T.main);
      E(0, 0, 4.4, 4.4, '#7a5a48'); E(0, 0, 2.2, 2.2, T.main); E(5, 0, 4, 3.6, '#6a4a3a');
      E(8, 0, 2, 2, '#4a2a20'); L(8, -1, 12, -3, ZC.bone); L(8, 1, 12, 3, ZC.bone);
    },
    broodling(T, f) {
      const ph = [0, 1, 0, -1][f];
      for (let k = -1; k <= 1; k++) { L(k * 2, 0, k * 3 + ph, -5, '#3a2a20'); L(k * 2, 0, k * 3 - ph, 5, '#3a2a20'); }
      E(0, 0, 4, 3, '#7a6040'); E(-1, 0, 2, 1.6, T.main); L(3, -1, 6, -2, ZC.bone); L(3, 1, 6, 2, ZC.bone);
    },
    // ---------------- PROTOSS ----------------
    probe(T, f, a) {
      Pl([[10, 0], [1, -6], [-7, -4.5], [-8, 0], [-7, 4.5], [1, 6]], PC.mid);
      Pl([[8, 0], [1, -3.5], [-5, -2.5], [-5, 2.5], [1, 3.5]], PC.lt);
      R(-7, -2, 3, 4, T.main); E(1, 0, 2.6, 2.6, PC.glow); E(0.5, -0.8, 1, 1, '#fff');
      L(4, -4, 10, -5, PC.dk, 1.4); L(4, 4, 10, 5, PC.dk, 1.4);
      if (a) L(10, 0, 14, 0, PC.glow2, 1.5);
    },
    zealot(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      E(ph * 2.5, -3, 2.2, 1.8, '#5a4a30'); E(-ph * 2.5, 3, 2.2, 1.8, '#5a4a30');
      E(-1, 0, 5.4, 6, PC.mid); E(-3, 0, 2.6, 4, PC.dk);
      E(0, -5.2, 2.8, 2.4, T.main); E(0, 5.2, 2.8, 2.4, T.main);
      E(2, 0, 2.6, 2.4, '#806838'); E(3, 0, 1, 1.6, '#80e0ff');
      const s = a ? 5 : 2;
      L(2, -5, 7 + s, -4, PC.glow, 2); L(2, 5, 7 + s, 4, PC.glow, 2);
      L(2, -5, 7 + s, -4, '#e0ffff', 0.8); L(2, 5, 7 + s, 4, '#e0ffff', 0.8);
    },
    dragoon(T, f) {
      const ph = [0, 1, 0, -1][f];
      for (const [x, y, s] of [[6, -8, 1], [6, 8, -1], [-7, -9, -1], [-7, 9, 1]]) {
        const kx = x + ph * s * 2.5;
        L(x * 0.5, y * 0.5, kx, y * 1.25, '#6a5020', 2.2); E(kx, y * 1.25, 1.6, 1.6, '#4a3a18');
      }
      E(0, 0, 9, 8.6, '#b89040'); E(-1, -1, 7, 6.6, PC.lt);
      E(0, 0, 4.6, 4.6, '#2a60d0'); E(0.5, 0, 3, 3, PC.glow); E(0, -1, 1.2, 1.2, '#fff');
      R(-8, -2, 3, 4, T.main); E(0, -8, 2, 1.4, T.main); E(0, 8, 2, 1.4, T.main);
      R(7, -1.5, 5, 3, '#806030');
    },
    htemplar(T, f, a) {
      E(-1, 0, 7.5, 6.5, 'rgba(120,200,255,0.25)');
      E(-1, 0, 6, 5, '#8a7a50'); E(-2, 0, 4, 3.6, '#a09060');
      R(-2.5, -5, 2, 10, T.main); E(1.5, 0, 2.6, 2.4, '#5a4a30'); E(2.5, 0, 1, 1.4, '#80e0ff');
      if (a) E(4, 0, 4, 4, 'rgba(160,220,255,0.6)');
    },
    dtemplar(T, f, a) {
      const ph = [0, 1, 0, -1][f];
      E(ph * 2, -2.6, 2, 1.6, '#1a1420'); E(-ph * 2, 2.6, 2, 1.6, '#1a1420');
      E(-1, 0, 5.6, 5, '#302838'); E(-2, 0, 3.6, 3.4, '#403450');
      R(-3, -5, 2, 10, T.dark); E(1.5, 0, 2.4, 2.2, '#201828');
      const s = a ? 4 : 0;
      g.beginPath(); g.moveTo(2, 4); g.quadraticCurveTo(7 + s, 6, 11 + s, 1); g.strokeStyle = '#80ffff'; g.lineWidth = 1.8; g.stroke();
    },
    shuttle(T, f) {
      Pl([[15, 0], [5, -8], [-11, -8], [-15, -3], [-15, 3], [-11, 8], [5, 8]], PC.mid);
      Pl([[12, 0], [4, -5], [-9, -5], [-9, 5], [4, 5]], PC.lt);
      E(0, 0, 5, 3.6, '#806030'); R(-7, -8, 4, 16, T.main);
      E(-15, -4, 1.6, 1.6, PC.glow); E(-15, 4, 1.6, 1.6, PC.glow); E(12, 0, 1.6, 1.6, f % 2 ? PC.glow2 : PC.glow);
    },
    observer(T) {
      E(0, 0, 8, 8, '#8a909a'); E(0, 0, 6, 6, '#a8b0b8'); E(-4, 0, 2, 4, T.main);
      E(2, 0, 3, 3, '#3070c0'); E(2.4, -0.6, 1.4, 1.4, '#b0e0ff');
      L(-6, -6, -9, -9, '#606870', 1.4); L(-6, 6, -9, 9, '#606870', 1.4);
    },
    scout(T) {
      Pl([[15, 0], [3, -4], [-5, -15], [-10, -13], [-6, -3], [-10, 0], [-6, 3], [-10, 13], [-5, 15], [3, 4]], PC.mid);
      Pl([[12, 0], [2, -2.5], [-7, -1.5], [-7, 1.5], [2, 2.5]], PC.lt);
      Pl([[-5, -12], [-9, -12.5], [-7, -9]], T.main); Pl([[-5, 12], [-9, 12.5], [-7, 9]], T.main);
      E(5, 0, 2.6, 1.6, PC.glow); E(-10, -2, 1.5, 1.5, PC.glow); E(-10, 2, 1.5, 1.5, PC.glow);
    },
    corsair(T) {
      Pl([[13, 0], [-1, -11], [-11, -10], [-4, 0], [-11, 10], [-1, 11]], '#d0b060');
      Pl([[9, 0], [-1, -7], [-6, -6], [-2, 0], [-6, 6], [-1, 7]], PC.lt);
      E(1, 0, 3.4, 3.4, '#2a70e0'); E(1, 0, 1.8, 1.8, PC.glow2);
      Pl([[-2, -10], [-9, -9.5], [-7, -7]], T.main); Pl([[-2, 10], [-9, 9.5], [-7, 7]], T.main);
    },
    carrier(T) {
      Pl([[27, 0], [11, -12], [-18, -15], [-27, -9], [-27, 9], [-18, 15], [11, 12]], PC.mid);
      Pl([[22, 0], [9, -7], [-20, -8], [-20, 8], [9, 7]], PC.lt);
      R(-16, -3, 30, 6, '#a08038'); R(-18, -15, 10, 4, T.main); R(-18, 11, 10, 4, T.main);
      for (let k = 0; k < 3; k++) { E(-12 + k * 9, -9, 2.4, 1.6, '#4a3a18'); E(-12 + k * 9, 9, 2.4, 1.6, '#4a3a18'); }
      E(14, 0, 3, 2.4, PC.glow); E(-27, -5, 2, 2, PC.glow); E(-27, 5, 2, 2, PC.glow);
    },
  };

  // 스프라이트 크기 (반경 → 캔버스)
  function spriteSize(type) {
    const d = UNITS[type];
    const ext = { overlord: 1.5, mutalisk: 1.6, bc: 1.3, carrier: 1.3, wraith: 1.4, scout: 1.4, vessel: 1.3, tank: 1.5, tank_siege: 1.8, ultralisk: 1.4, lurker: 1.3, spider_mine: 1.2 };
    return Math.ceil(d.r * 2 * (ext[type] || 1.9) + 10);
  }

  // 외곽선 + 조명 적용
  function finish(c, S) {
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    const lg = x.createLinearGradient(0, 0, S, S);
    lg.addColorStop(0, 'rgba(255,255,230,0.22)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,20,0.35)');
    x.fillStyle = lg; x.fillRect(0, 0, S, c.height);
    x.globalCompositeOperation = 'source-over';
    // 외곽선
    const o = mk(c.width, c.height), ox = o.getContext('2d');
    const sil = mk(c.width, c.height), sx = sil.getContext('2d');
    sx.drawImage(c, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = 'rgba(8,6,4,0.85)'; sx.fillRect(0, 0, c.width, c.height);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ox.drawImage(sil, dx, dy);
    ox.drawImage(c, 0, 0);
    return o;
  }

  function unit(type, owner, dir, frame) {
    const di = ((Math.round(dir / (Math.PI * 2) * DIRS) % DIRS) + DIRS) % DIRS;
    const key = 'u' + type + owner + ':' + di + ':' + frame;
    let s = cache.get(key);
    if (s) return s;
    const S = spriteSize(type);
    const c = mk(S, S);
    g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    const rot = (type === 'egg' || type === 'lurker_egg') ? 0 : di / DIRS * Math.PI * 2;
    g.rotate(rot);
    const T = TEAM[owner] || TEAM[2];
    const fn = U[type] || U.marine;
    fn(T, frame & 3, frame >= 4);
    const out = finish(c, S);
    s = { c: out, h: S / 2 };
    cache.set(key, s);
    return s;
  }
  function shadowOf(type, owner, dir, frame) {
    const di = ((Math.round(dir / (Math.PI * 2) * DIRS) % DIRS) + DIRS) % DIRS;
    const key = 's' + type + ':' + di + ':' + (frame & 3);
    let s = cache.get(key);
    if (s) return s;
    const u = unit(type, 2, dir, frame & 3);
    const c = mk(u.c.width, u.c.height), x = c.getContext('2d');
    x.drawImage(u.c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, 0, c.width, c.height);
    s = { c, h: u.h }; cache.set(key, s); return s;
  }

  // ---------- 건물 ----------
  const ELEV = 18;
  function box3d(x, y, w, d, h, top, front, edge) {
    R(x, y - h + d, w, h, front);
    R(x, y - h, w, d, top);
    if (edge) { L(x, y - h + d, x + w, y - h + d, edge, 1); }
  }
  function lights(xs, y, col) { for (const x of xs) E(x, y, 1.3, 1.3, col); }
  function tBase(w, h) { R(2, ELEV + 3, w - 4, h - 4, '#3c4046', 3); for (let x = 6; x < w - 4; x += 10) E(x, ELEV + h - 4, 1, 1, '#6a7078'); }
  function zBase(w, h) {
    E(w / 2, ELEV + h / 2 + 2, w / 2 + 2, h / 2 + 2, '#4a2a3a');
    E(w / 2, ELEV + h / 2 + 2, w / 2 - 2, h / 2 - 2, '#5e3848');
  }
  function pBase(w, h) { Pl([[6, ELEV + h - 2], [2, ELEV + h / 2 + 4], [6, ELEV + 8], [w - 6, ELEV + 8], [w - 2, ELEV + h / 2 + 4], [w - 6, ELEV + h - 2]], '#5a5040'); }
  function crystal(x, y, s, col) {
    Pl([[x, y - 8 * s], [x + 4 * s, y - 2 * s], [x, y + 4 * s], [x - 4 * s, y - 2 * s]], col || '#2080e0');
    Pl([[x, y - 8 * s], [x + 4 * s, y - 2 * s], [x, y]], '#80d0ff');
  }
  function blob(x, y, rx, ry, col) { E(x, y, rx, ry, col); E(x - rx * 0.25, y - ry * 0.3, rx * 0.55, ry * 0.5, 'rgba(255,220,200,0.15)'); }

  const B = {
    cc(T, w, h) {
      tBase(w, h);
      for (const [x, y] of [[8, ELEV + 10], [w - 8, ELEV + 10], [8, ELEV + h - 6], [w - 8, ELEV + h - 6]]) R(x - 4, y - 4, 8, 8, '#50565e', 1);
      box3d(12, ELEV + 10, w - 24, h - 22, 14, '#9aa2aa', '#5e666e', '#c0c8d0');
      box3d(28, ELEV + 8, w - 56, h - 34, 26, '#b0b8c0', '#6a727a');
      E(w / 2, ELEV + 2, 14, 10, '#8a929a'); E(w / 2, ELEV, 9, 6, '#5aa0d0'); E(w / 2 - 3, ELEV - 2, 3, 2, '#c0e8ff');
      R(14, ELEV + h - 30, w - 28, 4, T.main); R(18, ELEV + 6, 8, 4, T.main); R(w - 26, ELEV + 6, 8, 4, T.main);
      R(w / 2 - 10, ELEV + h - 24, 20, 12, '#2a2e34'); lights([w / 2 - 6, w / 2, w / 2 + 6], ELEV + h - 20, '#ffd040');
    },
    depot(T, w, h) {
      tBase(w, h);
      box3d(6, ELEV + 10, w - 12, h - 18, 10, '#9098a0', '#5a626a', '#c0c8d0');
      for (let x = 12; x < w - 12; x += 8) Pl([[x, ELEV + 2], [x + 4, ELEV + 2], [x + 8, ELEV + h - 18], [x + 4, ELEV + h - 18]], 'rgba(40,40,40,0.35)');
      R(8, ELEV + h - 18, w - 16, 3, T.main); R(w / 2 - 6, ELEV + 4, 12, 4, '#e0c040');
    },
    refinery(T, w, h) {
      R(4, ELEV + 6, w - 8, h - 8, '#3a3630', 3);
      box3d(10, ELEV + 6, 40, h - 14, 14, '#8a9098', '#545a62');
      E(w - 30, ELEV + 2, 16, 12, '#7a8088'); E(w - 30, ELEV, 12, 8, '#a0a8b0');
      R(w - 36, ELEV - 22, 10, 22, '#6a7078'); E(w - 31, ELEV - 22, 5, 3, '#303030');
      R(14, ELEV + h - 16, 32, 3, T.main); lights([18, 26, 34], ELEV + h - 22, '#ff5020');
    },
    barracks(T, w, h) {
      tBase(w, h);
      box3d(8, ELEV + 10, w - 16, h - 20, 20, '#8e969e', '#5a626a', '#c0c8d0');
      box3d(w - 44, ELEV + 6, 30, 22, 30, '#a4acb4', '#646c74');
      R(16, ELEV + h - 28, 30, 18, '#2c3036'); for (let y = ELEV + h - 26; y < ELEV + h - 12; y += 4) L(17, y, 45, y, '#4a4e54');
      R(12, ELEV - 4, w - 60, 5, T.main); R(w - 40, ELEV - 16, 22, 4, T.main); lights([54, 62, 70], ELEV + h - 20, '#ffd040');
    },
    ebay(T, w, h) {
      tBase(w, h);
      box3d(8, ELEV + 12, w - 16, h - 22, 16, '#8e969e', '#5a626a');
      E(w / 2 + 10, ELEV + 6, 22, 14, '#7a828a'); E(w / 2 + 10, ELEV + 2, 16, 10, '#a8b0b8');
      R(20, ELEV - 10, 4, 18, '#606870'); E(22, ELEV - 12, 6, 3, '#a0a8b0');
      R(12, ELEV + h - 24, w - 24, 3, T.main);
    },
    bunker(T, w, h) {
      Pl([[12, ELEV + h - 4], [2, ELEV + h / 2 + 2], [12, ELEV + 6], [w - 12, ELEV + 6], [w - 2, ELEV + h / 2 + 2], [w - 12, ELEV + h - 4]], '#5a626a');
      Pl([[16, ELEV + h - 12], [8, ELEV + h / 2 - 2], [16, ELEV], [w - 16, ELEV], [w - 8, ELEV + h / 2 - 2], [w - 16, ELEV + h - 12]], '#8e969e');
      for (let x = 20; x < w - 16; x += 14) R(x, ELEV + h / 2 - 4, 8, 3, '#1a1a1a');
      R(16, ELEV + 4, w - 32, 3, T.main);
    },
    turret(T, w, h) {
      R(8, ELEV + 10, w - 16, h - 14, '#50565e', 3);
      E(w / 2, ELEV + h / 2, 12, 9, '#7a828a'); E(w / 2, ELEV + h / 2 - 6, 8, 6, '#a0a8b0');
      R(w / 2 - 12, ELEV + h / 2 - 14, 24, 6, '#6a7078', 2); R(w / 2 - 14, ELEV + h / 2 - 13, 4, 4, T.main); R(w / 2 + 10, ELEV + h / 2 - 13, 4, 4, T.main);
    },
    academy(T, w, h) {
      tBase(w, h);
      box3d(8, ELEV + 10, w - 16, h - 18, 16, '#9aa2aa', '#5e666e', '#c0c8d0');
      E(w / 2, ELEV + 4, 12, 8, '#6a9ac0'); R(w / 2 - 1, ELEV - 20, 2, 16, '#707070'); R(w / 2 + 1, ELEV - 20, 10, 6, T.main);
      R(12, ELEV + h - 20, w - 24, 3, T.main);
    },
    factory(T, w, h) {
      tBase(w, h);
      box3d(6, ELEV + 10, w - 12, h - 18, 22, '#868e96', '#555d65', '#b8c0c8');
      R(w - 34, ELEV - 30, 12, 30, '#5a6068'); E(w - 28, ELEV - 30, 6, 3, '#202020');
      R(12, ELEV + h - 30, 40, 20, '#2c3036'); for (let x = 14; x < 50; x += 5) L(x, ELEV + h - 29, x, ELEV + h - 11, '#3e4248');
      R(10, ELEV - 8, w - 50, 5, T.main); lights([w - 50, w - 42], ELEV + h - 20, '#ff6020');
    },
    starport(T, w, h) {
      tBase(w, h);
      box3d(6, ELEV + 14, 60, h - 22, 18, '#8e969e', '#5a626a');
      E(w - 28, ELEV + h / 2, 22, 16, '#5a6068'); E(w - 28, ELEV + h / 2, 16, 11, '#707880');
      L(w - 42, ELEV + h / 2, w - 14, ELEV + h / 2, '#e0c040', 2); L(w - 28, ELEV + h / 2 - 10, w - 28, ELEV + h / 2 + 10, '#e0c040', 2);
      R(10, ELEV - 2, 52, 4, T.main); lights([w - 46, w - 10], ELEV + h / 2, '#40ff40');
    },
    armory(T, w, h) {
      tBase(w, h);
      box3d(8, ELEV + 10, w - 16, h - 18, 14, '#868e96', '#555d65');
      E(w / 2 + 8, ELEV + 4, 14, 10, '#9aa2aa'); R(w / 2 - 20, ELEV - 6, 20, 6, '#5a6068');
      R(12, ELEV + h - 20, w - 24, 3, T.main);
    },
    science_facility(T, w, h) {
      tBase(w, h);
      box3d(10, ELEV + 12, w - 20, h - 22, 16, '#8e969e', '#5a626a');
      R(w / 2 - 8, ELEV - 30, 16, 36, '#7a828a'); E(w / 2, ELEV - 30, 16, 6, '#a0a8b0', '#50a0e0', 2); E(w / 2, ELEV - 14, 20, 7, null, '#50a0e0', 2);
      R(14, ELEV + h - 24, w - 28, 3, T.main); R(w / 2 - 8, ELEV - 20, 16, 3, T.main);
    },
    // ---- ZERG ----
    hatchery(T, w, h, lvl) {
      zBase(w, h);
      lvl = lvl || 0;
      blob(w / 2, ELEV + h / 2, w / 2 - 8, h / 2 - 4, '#7a5048');
      blob(w / 2, ELEV + h / 2 - 8 - lvl * 4, w / 2 - 20, h / 2 - 12, '#8e6050');
      for (let k = 0; k < 5 + lvl * 3; k++) { const x = 16 + k * (w - 32) / (4 + lvl * 3); Pl([[x - 4, ELEV + 14], [x, ELEV - 6 - lvl * 8 - (k % 2) * 6], [x + 4, ELEV + 14]], ZC.bone); }
      E(w / 2, ELEV + h / 2 + 6, 14, 8, '#3a1a1a'); E(w / 2, ELEV + h / 2 + 6, 10, 5, '#6a2020');
      E(24, ELEV + h / 2, 8, 5, T.main); E(w - 24, ELEV + h / 2, 8, 5, T.main);
      if (lvl >= 2) { blob(w / 2, ELEV - 14, 16, 18, '#9a6a58'); E(w / 2, ELEV - 16, 6, 6, T.main); }
    },
    lair(T, w, h) { B.hatchery(T, w, h, 1); },
    hive(T, w, h) { B.hatchery(T, w, h, 2); },
    extractor(T, w, h) {
      E(w / 2, ELEV + h / 2 + 4, w / 2 - 4, h / 2, '#4a2a3a');
      blob(w / 2, ELEV + h / 2, w / 2 - 14, h / 2 - 2, '#7a5048'); blob(w / 2, ELEV + 6, 22, 16, '#8e6050');
      E(w / 2, ELEV + 2, 10, 6, '#30a030'); E(w / 2, ELEV + 1, 6, 3, '#80ff60');
      E(22, ELEV + h / 2 + 4, 6, 4, T.main); E(w - 22, ELEV + h / 2 + 4, 6, 4, T.main);
    },
    pool(T, w, h) {
      zBase(w, h);
      blob(w / 2, ELEV + h / 2, w / 2 - 6, h / 2 - 6, '#7a5048');
      E(w / 2, ELEV + h / 2 - 2, w / 2 - 16, h / 2 - 14, '#40a020'); E(w / 2 - 6, ELEV + h / 2 - 5, 10, 4, '#90ff60');
      for (let k = 0; k < 4; k++) Pl([[14 + k * 20, ELEV + 10], [18 + k * 20, ELEV - 6], [22 + k * 20, ELEV + 10]], ZC.bone);
      E(14, ELEV + h - 12, 6, 4, T.main); E(w - 14, ELEV + h - 12, 6, 4, T.main);
    },
    hydra_den(T, w, h) {
      zBase(w, h);
      blob(w / 2, ELEV + h / 2, w / 2 - 10, h / 2 - 6, '#7a5048'); blob(w / 2, ELEV + 6, 26, 18, '#8e6050');
      for (let k = -2; k <= 2; k++) Pl([[w / 2 + k * 10 - 4, ELEV + 4], [w / 2 + k * 12, ELEV - 22 + Math.abs(k) * 6], [w / 2 + k * 10 + 4, ELEV + 4]], ZC.bone);
      E(w / 2, ELEV + h / 2 + 6, 10, 6, T.main);
    },
    evo(T, w, h) {
      zBase(w, h);
      blob(w / 2, ELEV + h / 2, w / 2 - 10, h / 2 - 6, '#7a5048');
      for (let k = 0; k < 5; k++) { const x = 22 + k * 13; g.beginPath(); g.arc(x, ELEV + h / 2, 14, Math.PI, 0); g.strokeStyle = ZC.bone; g.lineWidth = 3; g.stroke(); }
      E(w / 2, ELEV + h / 2 + 4, 12, 6, T.main);
    },
    creep_colony(T, w, h) {
      E(w / 2, ELEV + h / 2 + 4, w / 2 - 4, h / 2 - 4, '#4a2a3a');
      blob(w / 2, ELEV + h / 2, 20, 16, '#8a5a50'); E(w / 2, ELEV + h / 2 - 4, 8, 6, T.main); E(w / 2, ELEV + h / 2 - 4, 4, 3, '#e0a080');
    },
    sunken(T, w, h) {
      E(w / 2, ELEV + h / 2 + 4, w / 2 - 4, h / 2 - 4, '#4a2a3a');
      blob(w / 2, ELEV + h / 2, 22, 16, '#8a5a50'); Pl([[w / 2 - 8, ELEV + h / 2], [w / 2, ELEV - 16], [w / 2 + 8, ELEV + h / 2]], '#b07060');
      E(w / 2, ELEV + h / 2 + 2, 7, 5, T.main);
    },
    spore(T, w, h) {
      E(w / 2, ELEV + h / 2 + 4, w / 2 - 4, h / 2 - 4, '#4a2a3a');
      blob(w / 2, ELEV + h / 2 + 2, 18, 12, '#8a5a50'); blob(w / 2, ELEV + 2, 14, 16, '#a07060'); E(w / 2, ELEV - 2, 6, 6, '#c0ff80');
      E(w / 2, ELEV + h / 2 + 6, 6, 4, T.main);
    },
    spire(T, w, h) {
      E(w / 2, ELEV + h / 2 + 4, w / 2 - 2, h / 2 - 4, '#4a2a3a');
      blob(w / 2, ELEV + h / 2, 22, 14, '#7a5048');
      Pl([[w / 2 - 12, ELEV + h / 2], [w / 2 - 2, ELEV - 36], [w / 2 + 4, ELEV - 30], [w / 2 + 12, ELEV + h / 2]], '#9a6a58');
      E(w / 2, ELEV + 6, 6, 4, T.main); E(w / 2 - 1, ELEV - 20, 3, 3, '#e0ff80');
    },
    ultra_cavern(T, w, h) {
      zBase(w, h);
      blob(w / 2, ELEV + h / 2, w / 2 - 8, h / 2 - 4, '#7a5048');
      for (const s of [-1, 1]) Pl([[w / 2 + s * 6, ELEV + 10], [w / 2 + s * 30, ELEV - 20], [w / 2 + s * 24, ELEV + 4]], ZC.bone);
      E(w / 2, ELEV + h / 2, 12, 7, '#2a1010'); E(w / 2, ELEV + h / 2 + 8, 8, 4, T.main);
    },
    defiler_mound(T, w, h) {
      zBase(w, h);
      blob(w / 2, ELEV + h / 2, w / 2 - 8, h / 2 - 4, '#6a4a40');
      for (let k = 0; k < 6; k++) E(20 + k * 17, ELEV + h / 2 - 4 - (k % 2) * 4, 7, 6, '#8a6a58');
      E(w / 2, ELEV + h / 2 + 8, 10, 5, T.main);
    },
    // ---- PROTOSS ----
    nexus(T, w, h) {
      pBase(w, h);
      Pl([[14, ELEV + h - 8], [w / 2, ELEV - 14], [w - 14, ELEV + h - 8]], PC.mid);
      Pl([[14, ELEV + h - 8], [w / 2, ELEV - 14], [w / 2, ELEV + h - 8]], PC.lt);
      crystal(w / 2, ELEV - 16, 1.8, '#2070e0');
      R(20, ELEV + h - 14, 16, 4, T.main); R(w - 36, ELEV + h - 14, 16, 4, T.main);
      E(w / 2, ELEV + h - 18, 8, 5, PC.glow);
    },
    pylon(T, w, h) {
      E(w / 2, ELEV + h / 2 + 8, 22, 12, '#5a5040'); E(w / 2, ELEV + h / 2 + 5, 16, 9, PC.mid);
      crystal(w / 2, ELEV + h / 2 - 6, 2.4, '#2a80f0');
      R(w / 2 - 12, ELEV + h / 2 + 5, 6, 3, T.main); R(w / 2 + 6, ELEV + h / 2 + 5, 6, 3, T.main);
    },
    assimilator(T, w, h) {
      E(w / 2, ELEV + h / 2 + 2, w / 2 - 6, h / 2 - 2, '#5a5040');
      E(w / 2, ELEV + h / 2 - 4, 34, 20, PC.mid); E(w / 2, ELEV + h / 2 - 8, 24, 14, PC.lt);
      E(w / 2, ELEV + h / 2 - 10, 10, 7, '#30c050'); crystal(w / 2, ELEV + h / 2 - 14, 1, '#40e060');
      R(w / 2 - 30, ELEV + h / 2, 8, 3, T.main); R(w / 2 + 22, ELEV + h / 2, 8, 3, T.main);
    },
    gateway(T, w, h) {
      pBase(w, h);
      box3d(14, ELEV + 12, w - 28, h - 24, 18, PC.lt, PC.mid);
      Pl([[w / 2 - 20, ELEV + h - 12], [w / 2 - 20, ELEV + 10], [w / 2, ELEV - 6], [w / 2 + 20, ELEV + 10], [w / 2 + 20, ELEV + h - 12]], PC.dk);
      Pl([[w / 2 - 12, ELEV + h - 14], [w / 2 - 12, ELEV + 12], [w / 2, ELEV + 2], [w / 2 + 12, ELEV + 12], [w / 2 + 12, ELEV + h - 14]], PC.glow);
      R(18, ELEV + h - 20, 12, 4, T.main); R(w - 30, ELEV + h - 20, 12, 4, T.main);
    },
    forge(T, w, h) {
      pBase(w, h);
      box3d(10, ELEV + 10, w - 20, h - 18, 14, PC.lt, PC.mid);
      E(w / 2, ELEV + 6, 16, 10, PC.dk); E(w / 2, ELEV + 6, 10, 6, '#ff8030');
      R(14, ELEV + h - 16, w - 28, 3, T.main);
    },
    cannon(T, w, h) {
      E(w / 2, ELEV + h / 2 + 8, 22, 12, '#5a5040'); E(w / 2, ELEV + h / 2 + 4, 16, 9, PC.mid);
      E(w / 2, ELEV + h / 2 - 6, 11, 11, PC.lt); E(w / 2, ELEV + h / 2 - 6, 7, 7, '#2a60d0'); E(w / 2 - 2, ELEV + h / 2 - 8, 3, 3, PC.glow2);
      R(w / 2 - 14, ELEV + h / 2 + 4, 5, 3, T.main); R(w / 2 + 9, ELEV + h / 2 + 4, 5, 3, T.main);
    },
    cyber(T, w, h) {
      pBase(w, h);
      box3d(10, ELEV + 10, w - 20, h - 18, 12, PC.lt, PC.mid);
      E(w / 2, ELEV + 4, 22, 14, PC.mid); E(w / 2, ELEV, 16, 10, '#3080e0'); E(w / 2 - 4, ELEV - 3, 5, 3, PC.glow2);
      R(14, ELEV + h - 16, w - 28, 3, T.main);
    },
    robo(T, w, h) {
      pBase(w, h);
      box3d(8, ELEV + 10, w - 16, h - 18, 14, PC.lt, PC.mid);
      for (let k = 0; k < 3; k++) E(24 + k * 24, ELEV + 4, 8, 6, PC.dk);
      E(w / 2, ELEV + 4, 5, 4, PC.glow); R(12, ELEV + h - 16, w - 24, 3, T.main);
    },
    stargate(T, w, h) {
      pBase(w, h);
      E(w / 2, ELEV + h / 2, w / 2 - 10, h / 2 - 2, PC.mid); E(w / 2, ELEV + h / 2, w / 2 - 22, h / 2 - 12, '#1a2a50');
      E(w / 2, ELEV + h / 2, w / 2 - 30, h / 2 - 18, '#3080e0');
      for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3; crystal(w / 2 + Math.cos(an) * (w / 2 - 14), ELEV + h / 2 + Math.sin(an) * (h / 2 - 6), 0.8, '#2070e0'); }
      R(16, ELEV + h - 12, 12, 4, T.main); R(w - 28, ELEV + h - 12, 12, 4, T.main);
    },
    citadel(T, w, h) {
      pBase(w, h);
      box3d(12, ELEV + 12, w - 24, h - 20, 12, PC.lt, PC.mid);
      R(w / 2 - 6, ELEV - 20, 12, 30, PC.mid); crystal(w / 2, ELEV - 22, 1, '#2070e0');
      R(16, ELEV + h - 16, w - 32, 3, T.main);
    },
    archives(T, w, h) {
      pBase(w, h);
      box3d(10, ELEV + 10, w - 20, h - 18, 12, PC.lt, PC.mid);
      E(w / 2, ELEV + 2, 18, 12, '#6040a0'); E(w / 2, ELEV, 10, 6, '#c080ff');
      R(14, ELEV + h - 16, w - 28, 3, T.main);
    },
    fleet_beacon(T, w, h) {
      pBase(w, h);
      box3d(10, ELEV + 12, w - 20, h - 20, 10, PC.lt, PC.mid);
      for (const s of [-1, 1]) Pl([[w / 2 + s * 4, ELEV + 10], [w / 2 + s * 26, ELEV - 16], [w / 2 + s * 18, ELEV + 10]], PC.mid);
      crystal(w / 2, ELEV - 2, 1.2, '#2070e0'); R(14, ELEV + h - 16, w - 28, 3, T.main);
    },
    // ---- 자원 ----
    mineral(T, w, h, lvl, v) {
      const n = 3 + (lvl || 0);
      const rng = mulberry32(v * 7919 + 17);
      for (let k = 0; k < n; k++) {
        const x = 8 + rng() * (w - 16), y = ELEV + h - 6 - rng() * 12, s = 0.9 + rng() * 0.6;
        Pl([[x, y - 12 * s], [x + 6 * s, y - 4 * s], [x + 3 * s, y + 3], [x - 4 * s, y + 3], [x - 6 * s, y - 5 * s]], '#1860c0', '#0a2a60');
        Pl([[x, y - 12 * s], [x + 6 * s, y - 4 * s], [x + 1, y - 2]], '#50b0ff');
        Pl([[x, y - 12 * s], [x - 6 * s, y - 5 * s], [x - 1, y - 3]], '#3890e8');
        L(x - 1, y - 9 * s, x - 2, y - 4, '#c0f0ff', 1);
      }
    },
    geyser(T, w, h) {
      E(w / 2, ELEV + h / 2 + 4, w / 2 - 2, h / 2 + 2, '#3a3028');
      E(w / 2, ELEV + h / 2, w / 2 - 10, h / 2 - 2, '#5a4a38'); E(w / 2 - 6, ELEV + h / 2 - 4, w / 2 - 24, h / 2 - 10, '#6e5c46');
      E(w / 2, ELEV + h / 2 - 2, 14, 7, '#1a1410'); E(w / 2, ELEV + h / 2 - 1, 9, 4, '#2a4a20');
      for (let k = 0; k < 6; k++) E(14 + k * 20, ELEV + h - 6 - (k % 2) * 4, 5, 3, '#4a3e30');
    },
  };

  function building(type, owner, extra) {
    const key = 'b' + type + owner + ':' + (extra || '');
    let s = cache.get(key);
    if (s) return s;
    const d = BUILDINGS[type];
    const w = d.w * TILE, h = d.h * TILE;
    const c = mk(w, h + ELEV);
    g = c.getContext('2d');
    const T = TEAM[owner] || TEAM[2];
    let lvl = 0, v = 0;
    if (type === 'mineral') { lvl = extra >> 4; v = extra & 15; }
    (B[type] || B.depot)(T, w, h, lvl, v);
    const out = finish(c, w);
    s = { c: out, ox: w / 2, oy: h / 2 + ELEV };
    cache.set(key, s);
    return s;
  }

  // 저그 건설 중 고치(드론 변태)
  function zergCocoon(type, owner, prog) {
    const st = Math.min(3, Math.floor(prog * 4));
    const key = 'zc' + type + owner + st;
    let s = cache.get(key);
    if (s) return s;
    const d = BUILDINGS[type];
    const w = d.w * TILE, h = d.h * TILE;
    const c = mk(w, h + ELEV);
    g = c.getContext('2d');
    const f = 0.45 + st * 0.18;
    E(w / 2, ELEV + h / 2 + 4, (w / 2 - 4) * f + 6, (h / 2 - 2) * f + 4, '#4a2a3a');
    blob(w / 2, ELEV + h / 2, (w / 2 - 8) * f, (h / 2 - 4) * f, '#8a6048');
    for (let k = 0; k < 4 + st; k++) { const a = k * 1.3; L(w / 2, ELEV + h / 2, w / 2 + Math.cos(a) * (w / 2 - 10) * f, ELEV + h / 2 + Math.sin(a) * (h / 2 - 6) * f, '#5a3028', 2); }
    E(w / 2, ELEV + h / 2, 6 * f + 2, 4 * f + 2, TEAM[owner].main);
    s = { c: finish(c, w), ox: w / 2, oy: h / 2 + ELEV };
    cache.set(key, s);
    return s;
  }

  // ---------- 지형 ----------
  const TCOL = {
    [TT.LOW]: [104, 86, 58], [TT.HIGH]: [140, 118, 80], [TT.CLIFF]: [92, 76, 56], [TT.WATER]: [26, 46, 70], [TT.RAMP]: [124, 104, 72], [TT.ROCK]: [104, 86, 58],
  };
  const CH = 16; // 청크당 타일
  const chunkCache = new Map();
  function chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = chunkCache.get(key);
    if (c) { chunkCache.delete(key); chunkCache.set(key, c); return c; }
    c = renderChunk(cx, cy);
    chunkCache.set(key, c);
    if (chunkCache.size > 40) chunkCache.delete(chunkCache.keys().next().value);
    return c;
  }
  function renderChunk(cx, cy) {
    const SZ = CH * TILE;
    const c = mk(SZ, SZ);
    g = c.getContext('2d');
    // 1) 저해상도 색 → 부드러운 확대(자연스러운 경계)
    const sm = mk(CH + 2, CH + 2), sx = sm.getContext('2d');
    const id = sx.createImageData(CH + 2, CH + 2);
    for (let y = 0; y < CH + 2; y++) for (let x = 0; x < CH + 2; x++) {
      const tx = cx * CH + x - 1, ty = cy * CH + y - 1;
      const t = terrAt(Math.max(0, Math.min(MAP_W - 1, tx)), Math.max(0, Math.min(MAP_H - 1, ty)));
      const col = TCOL[t], o = (y * (CH + 2) + x) * 4;
      id.data[o] = col[0]; id.data[o + 1] = col[1]; id.data[o + 2] = col[2]; id.data[o + 3] = 255;
    }
    sx.putImageData(id, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(sm, -TILE / 2 - TILE / 2, -TILE, SZ + TILE * 2, SZ + TILE * 2);
    g.imageSmoothingEnabled = false;
    // 2) 픽셀 노이즈
    const img = g.getImageData(0, 0, SZ, SZ), dd = img.data;
    const rng = mulberry32(cx * 1000 + cy + 7);
    for (let i = 0; i < dd.length; i += 4) {
      const n = (rng() - 0.5) * 22 + ((rng() < 0.03) ? -25 : 0);
      dd[i] = Math.max(0, Math.min(255, dd[i] + n)); dd[i + 1] = Math.max(0, Math.min(255, dd[i + 1] + n * 0.9)); dd[i + 2] = Math.max(0, Math.min(255, dd[i + 2] + n * 0.7));
    }
    g.putImageData(img, 0, 0);
    // 3) 타일별 디테일
    for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
      const tx = cx * CH + x, ty = cy * CH + y;
      if (!inMap(tx, ty)) continue;
      const t = MAP.terr[tIdx(tx, ty)], v = MAP.variant[tIdx(tx, ty)];
      const px = x * TILE, py = y * TILE;
      const r2 = mulberry32(v * 131 + tx * 7 + ty);
      if (t === TT.LOW || t === TT.HIGH) {
        const base = t === TT.LOW ? '#4a3c28' : '#6a5838';
        if (v % 5 === 0) for (let k = 0; k < 3; k++) E(px + r2() * 32, py + r2() * 32, 1 + r2() * 2, 1 + r2(), base);
        if (v % 11 === 0) { L(px + 4, py + 10 + r2() * 10, px + 28, py + 12 + r2() * 12, 'rgba(40,30,20,0.5)', 1); }
        if (v % 17 === 0) for (let k = 0; k < 4; k++) L(px + 10 + k * 3, py + 22, px + 9 + k * 3 + r2() * 4, py + 16, '#5a6a30', 1);
      } else if (t === TT.CLIFF) {
        const south = terrAt(tx, ty + 1), north = terrAt(tx, ty - 1);
        const faceDown = south !== TT.HIGH && south !== TT.CLIFF;
        R(px, py, 32, 32, faceDown ? '#4e4030' : '#6a5840');
        for (let k = 0; k < 5; k++) {
          const bx = px + r2() * 32, by = py + r2() * 32, br = 3 + r2() * 6;
          E(bx, by, br, br * 0.7, faceDown ? '#5e4e3a' : '#7a684c');
          E(bx - br * 0.3, by - br * 0.3, br * 0.5, br * 0.35, faceDown ? '#6e5e48' : '#8e7c5c');
        }
        if (faceDown) { for (let k = 0; k < 4; k++) L(px + 4 + k * 8, py + 6, px + 3 + k * 8 + r2() * 3, py + 30, 'rgba(20,14,8,0.55)', 1.5); R(px, py + 26, 32, 6, 'rgba(0,0,0,0.3)'); }
        if (north !== TT.HIGH && north !== TT.CLIFF) R(px, py, 32, 3, 'rgba(255,240,200,0.12)');
      } else if (t === TT.WATER) {
        for (let k = 0; k < 3; k++) { const wy = py + 6 + k * 10 + r2() * 4; L(px + r2() * 12, wy, px + 16 + r2() * 14, wy, 'rgba(120,170,210,0.35)', 1); }
      } else if (t === TT.RAMP) {
        for (let k = 0; k < 4; k++) R(px, py + k * 8, 32, 2, 'rgba(60,46,30,0.35)');
      } else if (t === TT.ROCK) {
        E(px + 16, py + 20, 14, 10, 'rgba(0,0,0,0.3)');
        E(px + 16, py + 16, 13, 11, '#6a6258'); E(px + 13, py + 12, 8, 6, '#8a8276'); E(px + 11, py + 10, 3, 2, '#a8a094');
        L(px + 8, py + 18, px + 20, py + 22, '#4a4238', 1);
      }
    }
    return c;
  }
  function resetTerrain() { chunkCache.clear(); }

  // 크립 타일
  let creepImg = null;
  function creepBlob() {
    if (creepImg) return creepImg;
    const c = mk(48, 48); g = c.getContext('2d');
    const rg = g.createRadialGradient(24, 24, 8, 24, 24, 24);
    rg.addColorStop(0, 'rgba(92,56,86,1)'); rg.addColorStop(0.6, 'rgba(86,50,80,0.95)'); rg.addColorStop(1, 'rgba(70,40,64,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 48, 48);
    const r = mulberry32(99);
    for (let k = 0; k < 14; k++) E(8 + r() * 32, 8 + r() * 32, 1 + r() * 3, 1 + r() * 2, r() < 0.5 ? 'rgba(120,70,100,0.8)' : 'rgba(50,26,44,0.8)');
    creepImg = c; return c;
  }

  // ---------- 미니맵 지형 ----------
  function minimapTerrain() {
    const c = mk(MAP_W, MAP_H), x = c.getContext('2d');
    const id = x.createImageData(MAP_W, MAP_H);
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      const col = TCOL[MAP.terr[i]], o = i * 4;
      const n = (MAP.variant[i] % 10) - 5;
      id.data[o] = col[0] + n; id.data[o + 1] = col[1] + n; id.data[o + 2] = col[2] + n; id.data[o + 3] = 255;
      if (MAP.terr[i] === TT.ROCK) { id.data[o] = 90; id.data[o + 1] = 86; id.data[o + 2] = 80; }
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // ---------- 아이콘 ----------
  function icon(type, owner) {
    const key = 'i' + type + (owner || 0);
    let s = cache.get(key);
    if (s) return s;
    const c = mk(36, 36), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    let spr, sw, sh;
    if (BUILDINGS[type]) { spr = building(type, owner || 0, type === 'mineral' ? 0x30 : '').c; }
    else if (UNITS[type]) { spr = unit(type, owner || 0, Math.PI * 0.75, 0).c; }
    if (spr) {
      sw = spr.width; sh = spr.height;
      const sc = Math.min(34 / sw, 34 / sh) * (BUILDINGS[type] ? 1 : 1.35);
      x.drawImage(spr, 18 - sw * sc / 2, 18 - sh * sc / 2, sw * sc, sh * sc);
    }
    s = c.toDataURL(); cache.set(key, s); return s;
  }
  // 명령 아이콘 (기호)
  function cmdIcon(kind) {
    const key = 'ci' + kind;
    let s = cache.get(key);
    if (s) return s;
    const c = mk(36, 36); g = c.getContext('2d');
    const Y = '#e8d060', G = '#40d040', Rr = '#e04040', Bl = '#60a0ff', W2 = '#e0e0e0';
    switch (kind) {
      case 'move': Pl([[8, 26], [24, 10], [24, 18], [30, 18], [30, 6], [18, 6], [18, 12]], G, '#104010'); break;
      case 'stop': Pl([[12, 6], [24, 6], [30, 12], [30, 24], [24, 30], [12, 30], [6, 24], [6, 12]], Rr, '#401010'); R(10, 16, 16, 4, '#fff'); break;
      case 'attack': L(8, 28, 26, 10, W2, 3); Pl([[24, 6], [30, 6], [30, 12]], W2); L(10, 20, 16, 26, Y, 3); break;
      case 'patrol': g.beginPath(); g.arc(18, 18, 10, 0.3, 5.8); g.strokeStyle = Bl; g.lineWidth = 3; g.stroke(); Pl([[28, 12], [30, 20], [22, 18]], Bl); break;
      case 'hold': R(9, 10, 18, 18, Y, 2, '#403010'); R(13, 6, 3, 8, Y); R(20, 6, 3, 8, Y); break;
      case 'gather': crystal(18, 24, 1.8, '#2070e0'); break;
      case 'ret': R(8, 14, 20, 14, '#8a9098'); crystal(18, 16, 0.9, '#2070e0'); Pl([[18, 4], [24, 10], [12, 10]], G); break;
      case 'build': R(8, 16, 20, 12, '#8a9098'); Pl([[6, 16], [18, 6], [30, 16]], '#a0a8b0'); R(15, 20, 6, 8, '#303030'); break;
      case 'advbuild': R(6, 12, 24, 16, '#6a7078'); R(10, 6, 6, 8, '#6a7078'); R(20, 18, 8, 10, '#303030'); E(26, 10, 3, 3, Y); break;
      case 'repair': L(8, 28, 22, 14, '#b0b0b0', 4); E(24, 12, 6, 6, null, '#b0b0b0', 3); break;
      case 'load': Pl([[18, 28], [8, 16], [14, 16], [14, 6], [22, 6], [22, 16], [28, 16]], G); break;
      case 'unload': Pl([[18, 6], [8, 18], [14, 18], [14, 28], [22, 28], [22, 18], [28, 18]], Y); break;
      case 'cancel': L(9, 9, 27, 27, Rr, 4); L(27, 9, 9, 27, Rr, 4); break;
      case 'rally': R(10, 6, 2, 24, '#c0c0c0'); Pl([[12, 6], [28, 11], [12, 16]], G); break;
      case 'back': Pl([[6, 18], [18, 8], [18, 14], [30, 14], [30, 22], [18, 22], [18, 28]], W2); break;
      case 'larva': U.larva.call(null, TEAM[1], 0); break;
      default: {
        // 스킬/연구 기호
        const col = { stim: '#e04040', heal: '#ffffff', restoration: '#80ffff', cloak: '#a0a0ff', lockdown: '#80ff80', spider_mine: '#e0a040', siege: '#e0e080', unsiege: '#e0e080', defensive_matrix: '#60a0ff', emp: '#80c0ff', irradiate: '#60ff60', yamato: '#ff8030', scan: '#40ff80', lift: '#c0c0c0', land: '#c0c0c0', burrow: '#a08060', unburrow: '#a08060', lurker_morph: '#c08060', dark_swarm: '#806040', plague: '#80a040', consume: '#c04040', storm: '#6080ff', select_larva: '#a08060' }[kind] || '#d0b060';
        const rg = g.createRadialGradient(15, 14, 2, 18, 18, 15); rg.addColorStop(0, '#fff'); rg.addColorStop(0.35, col); rg.addColorStop(1, 'rgba(0,0,0,0.2)');
        E(18, 18, 13, 13, rg);
        g.fillStyle = '#000'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const txt = (SPELLS[kind] && SPELLS[kind].hotkey) || (TECH[kind] && TECH[kind].hotkey) || '?';
        g.fillText(txt, 18, 19);
      }
    }
    s = c.toDataURL(); cache.set(key, s); return s;
  }

  // 와이어프레임 (선택 패널)
  function wireframe(type, owner, hpf) {
    const band = hpf > 0.66 ? 0 : hpf > 0.33 ? 1 : 2;
    const key = 'w' + type + band;
    let s = cache.get(key);
    if (s) return s;
    const src = BUILDINGS[type] ? building(type, 2, type === 'mineral' ? 0x30 : '').c : unit(type, 2, Math.PI * 0.5, 0).c;
    const c = mk(64, 64), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const sc = Math.min(60 / src.width, 60 / src.height) * (BUILDINGS[type] ? 1 : 1.6);
    const w = src.width * sc, h = src.height * sc;
    x.drawImage(src, 32 - w / 2, 32 - h / 2, w, h);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = ['rgba(40,220,40,0.65)', 'rgba(230,210,40,0.65)', 'rgba(230,40,30,0.7)'][band];
    x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = ['#40ff40', '#ffff40', '#ff4040'][band]; x.globalAlpha = 0.25;
    for (let y = 0; y < 64; y += 3) { x.beginPath(); x.moveTo(0, y); x.lineTo(64, y); x.stroke(); }
    s = c.toDataURL(); cache.set(key, s); return s;
  }

  return { unit, shadowOf, building, zergCocoon, chunk, CH, resetTerrain, creepBlob, minimapTerrain, icon, cmdIcon, wireframe, ELEV, shade, DIRS };
})();
