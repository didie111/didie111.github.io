/* =========================================================
   ART : 모든 그래픽을 SVG 문자열로 생성
   좌표계 - 캐릭터/몬스터는 발 중앙이 (0,0), 위쪽이 -y
   ========================================================= */
const SVGNS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, inner) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (inner !== undefined) e.innerHTML = inner;
  return e;
}
function gFromHTML(html, cls) {
  const g = document.createElementNS(SVGNS, 'g');
  if (cls) g.setAttribute('class', cls);
  g.innerHTML = html;
  return g;
}

const Art = {};

/* ---------------- 공통 defs (그라디언트/필터) ---------------- */
Art.defs = function () {
  return `
  <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#5fb4f2"/><stop offset="55%" stop-color="#a8dcff"/><stop offset="100%" stop-color="#e5f6ff"/>
  </linearGradient>
  <linearGradient id="skyDusk" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#2b2a5e"/><stop offset="50%" stop-color="#6b4a86"/><stop offset="100%" stop-color="#f0a07a"/>
  </linearGradient>
  <linearGradient id="skyForest" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#2f7f52"/><stop offset="60%" stop-color="#8fd18a"/><stop offset="100%" stop-color="#e2f6cf"/>
  </linearGradient>
  <linearGradient id="skyIce" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#173a63"/><stop offset="55%" stop-color="#5e9fd6"/><stop offset="100%" stop-color="#d9f2ff"/>
  </linearGradient>
  <linearGradient id="skyLava" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#14060b"/><stop offset="55%" stop-color="#4a1112"/><stop offset="100%" stop-color="#a12d12"/>
  </linearGradient>
  <linearGradient id="grassG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#7ed957"/><stop offset="18%" stop-color="#4fa83b"/><stop offset="100%" stop-color="#6b4a2a"/>
  </linearGradient>
  <linearGradient id="iceG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#d8f4ff"/><stop offset="20%" stop-color="#8dc7ea"/><stop offset="100%" stop-color="#3d5f88"/>
  </linearGradient>
  <linearGradient id="rockG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#6b4f4f"/><stop offset="20%" stop-color="#453035"/><stop offset="100%" stop-color="#241417"/>
  </linearGradient>
  <linearGradient id="woodG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#c38b4a"/><stop offset="30%" stop-color="#96622f"/><stop offset="100%" stop-color="#5d3c1c"/>
  </linearGradient>
  <radialGradient id="portalG"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="#8fd8ff"/><stop offset="100%" stop-color="#2a6fd8" stop-opacity="0.15"/></radialGradient>
  <radialGradient id="portalB"><stop offset="0%" stop-color="#fff0b0"/><stop offset="45%" stop-color="#ff8b4d"/><stop offset="100%" stop-color="#8c1616" stop-opacity="0.2"/></radialGradient>
  <radialGradient id="glowY"><stop offset="0%" stop-color="#fff6c0" stop-opacity="0.95"/><stop offset="100%" stop-color="#ffcf3a" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowR"><stop offset="0%" stop-color="#ffd1a0" stop-opacity="0.9"/><stop offset="100%" stop-color="#ff3a1f" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowB"><stop offset="0%" stop-color="#e8faff" stop-opacity="0.95"/><stop offset="100%" stop-color="#3ab7ff" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="soft2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
  <linearGradient id="skinG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff1df"/><stop offset="70%" stop-color="#ffdfc2"/><stop offset="100%" stop-color="#f3c6a3"/>
  </linearGradient>
  <linearGradient id="leafG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#8ede6a"/><stop offset="55%" stop-color="#4fb04a"/><stop offset="100%" stop-color="#2f7e3c"/>
  </linearGradient>
  <linearGradient id="leafG2" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#b6ef86"/><stop offset="60%" stop-color="#63c455"/><stop offset="100%" stop-color="#3a8c41"/>
  </linearGradient>
  <linearGradient id="barkG" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#8a5e34"/><stop offset="45%" stop-color="#b3813f"/><stop offset="100%" stop-color="#6b4424"/>
  </linearGradient>
  <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#9fe0a8"/><stop offset="100%" stop-color="#5fb07c"/>
  </linearGradient>
  <linearGradient id="hillNear" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#7fd07f"/><stop offset="100%" stop-color="#3f8f5b"/>
  </linearGradient>
  <linearGradient id="roofG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ef8a6a"/><stop offset="100%" stop-color="#b8462f"/>
  </linearGradient>
  <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fbeccb"/><stop offset="100%" stop-color="#d9bd92"/>
  </linearGradient>
  <linearGradient id="dirtG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#a97b47"/><stop offset="100%" stop-color="#6b4526"/>
  </linearGradient>
  <linearGradient id="grassTop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#9ff06e"/><stop offset="55%" stop-color="#5ec34a"/><stop offset="100%" stop-color="#3d9438"/>
  </linearGradient>
  <linearGradient id="iceTop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#f1fbff"/><stop offset="55%" stop-color="#a9dcf5"/><stop offset="100%" stop-color="#6ea9cf"/>
  </linearGradient>
  <linearGradient id="rockTop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#7c5a5c"/><stop offset="55%" stop-color="#4c3336"/><stop offset="100%" stop-color="#2b191c"/>
  </linearGradient>
  <linearGradient id="steelG" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#9fb0c8"/><stop offset="35%" stop-color="#ffffff"/><stop offset="60%" stop-color="#cfd8e8"/><stop offset="100%" stop-color="#7e8ca6"/>
  </linearGradient>
  <radialGradient id="gloss"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  <filter id="dropS" x="-30%" y="-30%" width="170%" height="170%">
    <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#1b1426" flood-opacity="0.45"/>
  </filter>
  `;
};

/* 공용 외곽선 색 */
const OL = '#2e2135';

/* hex 색을 밝게(f>1)/어둡게(f<1) */
function shade(hex, f) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = i => Math.max(0, Math.min(255, Math.round(((n >> i) & 255) * f)));
  return '#' + [ch(16), ch(8), ch(0)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/* ---------------- 캐릭터 ---------------- */
/* look: {job, weaponArt, weaponColor, hat, hatColor, top, topColor, bottom, bottomColor, shoes, shoesColor, cape, capeColor, glove, gloveColor} */
Art.weapon = function (kind, color) {
  color = color || '#cfd8e8';
  if (kind === 'staff') {
    return `<g class="wpn" stroke="${OL}" stroke-width="1.7" stroke-linejoin="round">
      <path d="M-3 17 L -3 -48 q 0 -3.4 3 -3.4 q 3 0 3 3.4 L 3 17 q 0 3.4 -3 3.4 q -3 0 -3 -3.4 z" fill="url(#barkG)"/>
      <path d="M-3 -8 h 6 v 9 h -6 z" fill="#6d4520"/>
      <path d="M-5 -16 q 5 -5.5 10 0 q -5 5.5 -10 0 z" fill="#e8c884"/>
      <path d="M-6.5 -44 q 6.5 -9 13 0 q -6.5 6 -13 0 z" fill="${color}"/>
      <g class="orb" transform="translate(0,-58)">
        <circle r="19" fill="url(#glowB)" stroke="none" class="orbGlow"/>
        <circle r="9.5" fill="${color}"/>
        <circle r="9.5" fill="url(#gloss)" stroke="none" opacity="0.55"/>
        <ellipse cx="-3" cy="-3.4" rx="3" ry="2.2" fill="#ffffff" stroke="none" opacity="0.9"/>
        <g class="orbRing" stroke-width="1.4">
          <ellipse rx="14" ry="4.6" fill="none" stroke="${color}" opacity="0.85"/>
          <circle cx="14" cy="0" r="2" fill="#fff" stroke="none" opacity="0.95"/>
        </g>
      </g>
    </g>`;
  }
  if (kind === 'bow') {
    return `<g class="wpn" stroke-linecap="round"><g transform="translate(-20,0)">
      <path d="M2 -36 q 22 13 22 36 q 0 23 -22 36" fill="none" stroke="${OL}" stroke-width="8.6"/>
      <path d="M2 -36 q 22 13 22 36 q 0 23 -22 36" fill="none" stroke="${color}" stroke-width="5.4"/>
      <path d="M2 -36 q 22 13 22 36 q 0 23 -22 36" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.4"/>
      <path d="M2 -36 q 7 4 10 11" fill="none" stroke="#e8b84f" stroke-width="3.2"/>
      <path d="M2 36 q 7 -4 10 -11" fill="none" stroke="#e8b84f" stroke-width="3.2"/>
      <rect x="15.5" y="-10" width="9" height="20" rx="4.5" fill="#6d4520" stroke="${OL}" stroke-width="1.6"/>
      <path class="bowString" d="M2 -34 L 0 0 L 2 34" fill="none" stroke="#f6f8ff" stroke-width="1.8"/>
      <g class="nock" opacity="0">
        <rect x="0" y="-1.5" width="36" height="3" rx="1.5" fill="#c9a06a" stroke="${OL}" stroke-width="1"/>
        <path d="M36 0 l -8 -5.5 l 0 11 z" fill="#eef1ff" stroke="${OL}" stroke-width="1"/>
        <path d="M2 0 l 8 -5.5 l 0 11 z" fill="#ff8f6b" stroke="${OL}" stroke-width="1"/>
      </g>
    </g></g>`;
  }
  return `<g class="wpn" stroke="${OL}" stroke-width="1.8" stroke-linejoin="round">
    <path d="M-4 -8 L -4 -39 q 0 -6.5 4 -11 q 4 4.5 4 11 L 4 -8 z" fill="url(#steelG)"/>
    <path d="M-1.3 -12 L -1.3 -37 q 0 -4 1.3 -6 L 0.2 -12 z" fill="#ffffff" stroke="none" opacity="0.65"/>
    <path d="M-12 -8 q 12 -6 24 0 q -12 7 -24 0 z" fill="${color === '#cfd8e8' ? '#d8a63c' : color}"/>
    <circle cx="0" cy="-8" r="2.8" fill="#ffe89a"/>
    <rect x="-3.4" y="-3" width="6.8" height="18" rx="3.4" fill="#5d3c1c"/>
    <circle cx="0" cy="17.5" r="4.6" fill="#e8b84f"/>
  </g>`;
};

Art.player = function (look) {
  const job = JOBS[look.job] || JOBS.warrior;
  const c = job.color;
  const topC = look.topColor || c.armor;
  const botC = look.bottomColor || '#3c4670';
  const shoeC = look.shoesColor || '#3a2c22';
  const gloveC = look.gloveColor || '#e8d7b4';
  const skin = '#ffe0c0';
  const hair = look.hairColor || '#4a2e22';
  const capeC = look.capeColor || '#6f5ab5';
  const capeHTML = look.cape ? `<path class="cape" d="M-13 -54 Q -29 -22 -20 -2 L 16 -2 Q 25 -26 13 -54 Z" fill="${capeC}"
      stroke="${OL}" stroke-width="1.8" stroke-linejoin="round" opacity="0.96"/>` : '';
  const hatC = look.hatColor || '#9b6b3a';
  const hatHTML = look.hat ? `<g class="hat">
      <path d="M-17 -80 Q 0 -100 17 -80 L 19 -76 L -19 -76 Z" fill="${hatC}"/>
      <rect x="-23" y="-78" width="46" height="6" rx="3" fill="${hatC}"/>
      <rect x="-17" y="-83" width="34" height="4.5" rx="2.2" fill="${c.trim}" opacity="0.95"/>
      <path d="M-14 -88 q 8 -8 16 -4" stroke="#fff" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/>
    </g>` : '';

  const sleeve = fill => `<path d="M-4.8 -2 q 4.8 -2.4 9.6 0 l -0.7 16 q -4.1 2.2 -8.2 0 z" fill="${fill}"/>
      <path d="M-4.5 13 q 4.5 2.2 9 0 l -0.4 5 q -4.1 2 -8.2 0 z" fill="${c.trim}" opacity="0.95"/>`;
  const hand = `<g class="hand">
        <circle cx="0" cy="23.5" r="5.6" fill="${gloveC}"/>
        <path d="M-5.2 21.8 q 2.4 -2.6 5.4 -2.2" stroke="${OL}" stroke-width="1.1" fill="none" opacity="0.55"/>
        <path d="M-3.4 26.6 q 3.4 1.8 6.8 -0.6" stroke="${OL}" stroke-width="1" fill="none" opacity="0.4"/>
      </g>`;

  const wk = look.weaponArt || job.weapon;
  return `<g class="char" data-wpn="${wk}">
    <ellipse class="shadow" cx="0" cy="1" rx="18" ry="5.5" fill="#000" opacity="0.28" stroke="none"/>
    <g class="body" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
      ${capeHTML}
      <g class="armB" transform="rotate(0)">${sleeve(shade(c.armor2, 0.82))}${hand}</g>
      <g class="legL"><rect x="-5" y="0" width="10" height="19" rx="4.6" fill="${botC}"/>
        <path d="M-6.5 17 h 13 a3.4 3.4 0 0 1 3.4 3.4 v 4.6 h -17.4 v -4.6 a3.4 3.4 0 0 1 1 -3.4 z" fill="${shoeC}"/></g>
      <g class="legR"><rect x="-5" y="0" width="10" height="19" rx="4.6" fill="${botC}"/>
        <path d="M-6.5 17 h 13 a3.4 3.4 0 0 1 3.4 3.4 v 4.6 h -17.4 v -4.6 a3.4 3.4 0 0 1 1 -3.4 z" fill="${shoeC}"/></g>
      <g class="torso">
        <path d="M-14 -53 Q 0 -57 14 -53 Q 17 -38 16 -25 Q 0 -20 -16 -25 Q -17 -38 -14 -53 Z" fill="${topC}"/>
        <path d="M-14 -53 Q 0 -57 14 -53 L 13.4 -46 Q 0 -50 -13.4 -46 Z" fill="${c.trim}" opacity="0.95"/>
        <path d="M-9 -50 Q 0 -44 9 -50" fill="none" stroke="${OL}" stroke-width="1.4" opacity="0.45"/>
        <path d="M-15.4 -29 Q 0 -24 15.4 -29" fill="none" stroke="${c.trim}" stroke-width="3.4" stroke-linecap="butt" opacity="0.9"/>
        <ellipse cx="-7" cy="-45" rx="4" ry="7" fill="#fff" stroke="none" opacity="0.14"/>
      </g>
      <g class="head">
        <path class="hairBack" d="M-19 -66 Q -21 -92 0 -92 Q 21 -92 19 -66 L 19 -58 Q 0 -68 -19 -58 Z" fill="${hair}"/>
        <ellipse cx="0" cy="-67" rx="18" ry="17" fill="url(#skinG)"/>
        <ellipse cx="-17.6" cy="-64" rx="3.2" ry="4" fill="url(#skinG)"/>
        <ellipse cx="17.6" cy="-64" rx="3.2" ry="4" fill="url(#skinG)"/>
        <path d="M-18.4 -70 Q -16 -91 0 -91 Q 16 -91 18.4 -70 Q 14 -82 8 -80 Q 2 -86 -3 -79 Q -9 -84 -13 -78 Q -16 -76 -18.4 -70 Z" fill="${hair}"/>
        <path d="M-12 -86 q 7 -4 13 -1" stroke="#fff" stroke-width="2.2" fill="none" opacity="0.28"/>
        <g stroke="none">
          <ellipse class="eyeL" cx="-7" cy="-67" rx="3.6" ry="4.9" fill="#2a2030"/>
          <ellipse class="eyeR" cx="7" cy="-67" rx="3.6" ry="4.9" fill="#2a2030"/>
          <circle cx="-8.2" cy="-68.8" r="1.5" fill="#fff"/><circle cx="5.8" cy="-68.8" r="1.5" fill="#fff"/>
          <circle cx="-6" cy="-65.2" r="0.9" fill="#fff" opacity="0.7" stroke="none"/><circle cx="8" cy="-65.2" r="0.9" fill="#fff" opacity="0.7" stroke="none"/>
          <ellipse cx="-11.5" cy="-60" rx="3" ry="1.9" fill="#ff9d9d" opacity="0.6" stroke="none"/>
          <ellipse cx="11.5" cy="-60" rx="3" ry="1.9" fill="#ff9d9d" opacity="0.6" stroke="none"/>
        </g>
        <path d="M-10.5 -73.5 q 3.5 -2 6.6 -0.6" stroke="${hair}" stroke-width="1.6" fill="none" opacity="0.9"/>
        <path d="M10.5 -73.5 q -3.5 -2 -6.6 -0.6" stroke="${hair}" stroke-width="1.6" fill="none" opacity="0.9"/>
        <path class="mouth" d="M-3 -58.5 q 3 3 6 0" stroke="#b06a62" stroke-width="1.4" fill="none"/>
        ${hatHTML}
      </g>
      <g class="armF" transform="rotate(0)">
        ${sleeve(shade(topC, 0.84))}
        <g class="wpnMount" transform="translate(0,24)">${Art.weapon(wk, look.weaponColor)}</g>
        ${hand}
      </g>
    </g>
  </g>`;
};

/* 무기 종류별 기본 자세 (팔 각도 · 무기 보정 회전) */
Art.basePose = function (kind) {
  if (kind === 'bow') return { armF: -86, armB: -56, wpn: 86, wpnY: 23 };
  if (kind === 'staff') return { armF: -14, armB: 12, wpn: 14, wpnY: 26 };
  return { armF: 7, armB: -7, wpn: 0, wpnY: 26 };
};

/* 파츠 위치 세팅(정적) - 생성 직후 1회 */
Art.layoutPlayer = function (g, kind) {
  const pose = Art.basePose(kind || g.getAttribute('data-wpn'));
  g.querySelector('.legL').setAttribute('transform', 'translate(-5,-25)');
  g.querySelector('.legR').setAttribute('transform', 'translate(5,-25)');
  g.querySelector('.armB').setAttribute('transform', `translate(-13,-50) rotate(${pose.armB})`);
  g.querySelector('.armF').setAttribute('transform', `translate(13,-50) rotate(${pose.armF})`);
  const wm = g.querySelector('.wpnMount');
  if (wm) wm.setAttribute('transform', `translate(0,${pose.wpnY}) rotate(${pose.wpn})`);
};

/* ---------------- 몬스터 ---------------- */
Art.monster = function (key) {
  switch (key) {
    case 'snail': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="0" rx="20" ry="5" fill="#000" opacity="0.25" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <path class="foot" d="M-23 0 q 3 -14 23 -14 q 20 0 23 14 z" fill="#9fdcff"/>
        <path d="M-18 -3 q 8 -6 18 -6" stroke="#fff" stroke-width="2.4" fill="none" opacity="0.6" stroke-linecap="round"/>
        <circle cx="4" cy="-19" r="15" fill="#d4783f"/>
        <path d="M4 -19 m -11 0 a 11 11 0 1 1 15 10" fill="none" stroke="#8a4420" stroke-width="3.6"/>
        <path d="M4 -19 m -5.5 0 a 5.5 5.5 0 1 1 7.5 5" fill="none" stroke="#8a4420" stroke-width="2.8"/>
        <ellipse cx="-1" cy="-27" rx="5" ry="3" fill="#fff" opacity="0.35" stroke="none" transform="rotate(-20,-1,-27)"/>
        <path class="eyeStalk" d="M-16 -9 q -3 -13 1 -18" stroke="#9fdcff" stroke-width="4.6" fill="none"/>
        <circle cx="-15" cy="-28" r="5" fill="#fff"/><circle cx="-15.6" cy="-28" r="2.4" fill="#23324a" stroke="none"/>
        <circle cx="-16.6" cy="-29.4" r="0.9" fill="#fff" stroke="none"/>
        <path d="M-19 -4 q 5 4 9 0" stroke="#4e8fb8" stroke-width="1.5" fill="none"/>
      </g></g>`;

    case 'slime': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="0" rx="22" ry="6" fill="#000" opacity="0.25" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <path class="blob" d="M-24 0 q -3 -27 10 -33 q 8 -4 14 0 q 13 6 10 33 z" fill="#5fe094"/>
        <path d="M-20 -4 q -2 -21 9 -27" fill="none" stroke="#bdffd8" stroke-width="3.4" opacity="0.75"/>
        <path d="M-12 -25 q 5 -7 12 -6 q -7 1 -9 8 z" fill="#ffffff" opacity="0.7" stroke="none"/>
        <ellipse cx="0" cy="-3" rx="16" ry="3.4" fill="#2f9b63" opacity="0.35" stroke="none"/>
        <ellipse cx="-7" cy="-16" rx="3.6" ry="4.2" fill="#173d2a" stroke="none"/><ellipse cx="7" cy="-16" rx="3.6" ry="4.2" fill="#173d2a" stroke="none"/>
        <circle cx="-8" cy="-17.4" r="1.3" fill="#fff" stroke="none"/><circle cx="6" cy="-17.4" r="1.3" fill="#fff" stroke="none"/>
        <path d="M-5 -8 q 5 5 10 0" stroke="#173d2a" stroke-width="1.7" fill="none"/>
      </g></g>`;

    case 'mushroom': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="0" rx="24" ry="6" fill="#000" opacity="0.25" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <path d="M-13 0 q -5 -19 0 -23 h 26 q 5 4 0 23 z" fill="#fbf1dd"/>
        <path class="cap" d="M-28 -20 q 3 -28 28 -28 q 25 0 28 28 q -28 7 -56 0 z" fill="#f5913a"/>
        <ellipse cx="-13" cy="-31" rx="6.4" ry="4.8" fill="#ffe3bd"/>
        <ellipse cx="12" cy="-35" rx="5.2" ry="3.8" fill="#ffe3bd"/>
        <ellipse cx="2" cy="-23" rx="4.2" ry="2.8" fill="#ffe3bd"/>
        <path d="M-22 -30 q 6 -13 18 -15" stroke="#ffd0a0" stroke-width="3" fill="none" opacity="0.55"/>
        <ellipse cx="-7" cy="-12" rx="3.4" ry="4" fill="#3a2418" stroke="none"/><ellipse cx="7" cy="-12" rx="3.4" ry="4" fill="#3a2418" stroke="none"/>
        <circle cx="-8" cy="-13.4" r="1.2" fill="#fff" stroke="none"/><circle cx="6" cy="-13.4" r="1.2" fill="#fff" stroke="none"/>
        <ellipse cx="-12" cy="-7" rx="2.6" ry="1.6" fill="#ffb0a8" opacity="0.75" stroke="none"/>
        <ellipse cx="12" cy="-7" rx="2.6" ry="1.6" fill="#ffb0a8" opacity="0.75" stroke="none"/>
        <path d="M-4 -6 q 4 4.5 8 0" stroke="#3a2418" stroke-width="1.6" fill="none"/>
        <g class="legL"><rect x="-3" y="-2" width="6" height="4" rx="2" fill="#d8c8a8"/></g>
      </g></g>`;

    case 'wolf': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="0" rx="28" ry="6" fill="#000" opacity="0.25" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <path class="tail" d="M24 -26 q 16 -6 14 -20 q -3 12 -16 14 z" fill="#6d6f7d"/>
        <g class="legB"><rect x="8" y="-16" width="7" height="17" rx="3" fill="#575a68"/></g>
        <g class="legB2"><rect x="-16" y="-16" width="7" height="17" rx="3" fill="#575a68"/></g>
        <ellipse cx="0" cy="-24" rx="27" ry="15" fill="#7b7e8d"/>
        <g class="legF"><rect x="12" y="-16" width="7" height="17" rx="3" fill="#8b8e9c"/></g>
        <g class="legF2"><rect x="-20" y="-16" width="7" height="17" rx="3" fill="#8b8e9c"/></g>
        <path d="M-22 -30 q -14 2 -16 -12 q 10 4 14 -2 z" fill="#8b8e9c"/>
        <circle cx="-26" cy="-30" r="12" fill="#8b8e9c"/>
        <path d="M-33 -40 l -3 -12 l 10 6 z" fill="#6d6f7d"/>
        <path d="M-20 -42 l 2 -11 l 8 9 z" fill="#6d6f7d"/>
        <ellipse cx="-36" cy="-27" rx="5" ry="4" fill="#5a5d6a"/>
        <circle cx="-38" cy="-28" r="2" fill="#1d1f28" stroke="none"/>
        <circle cx="-29" cy="-33" r="2.6" fill="#ffd34d" stroke="none"/><circle cx="-29.6" cy="-33.5" r="1" fill="#000" stroke="none"/>
        <path d="M-40 -23 l 8 0 l -6 4 z" fill="#f0f0f5"/>
      </g></g>`;

    case 'golem': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="0" rx="36" ry="8" fill="#000" opacity="0.3" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <g class="legL"><rect x="-22" y="-26" width="16" height="27" rx="5" fill="#5a86ad"/></g>
        <g class="legR"><rect x="6" y="-26" width="16" height="27" rx="5" fill="#5a86ad"/></g>
        <g class="armB"><rect x="-38" y="-62" width="14" height="34" rx="6" fill="#4f7ba3"/></g>
        <path d="M-28 -70 q 28 -10 56 0 l 6 44 q -34 10 -68 0 z" fill="#79aed4"/>
        <path d="M-20 -62 q 20 -6 40 0 l 3 18 q -24 7 -46 0 z" fill="#a8dcf5" opacity="0.8" stroke="none"/>
        <path d="M-10 -56 l 10 -6 l 10 6 l -4 14 l -12 0 z" fill="#e8fbff" opacity="0.9"/>
        <rect x="-16" y="-92" width="32" height="26" rx="8" fill="#8fc4e8"/>
        <rect x="-10" y="-86" width="7" height="6" rx="2" fill="#1a3550"/><rect x="3" y="-86" width="7" height="6" rx="2" fill="#1a3550"/>
        <circle cx="-6.5" cy="-83" r="2" fill="#7df0ff" stroke="none"/><circle cx="6.5" cy="-83" r="2" fill="#7df0ff" stroke="none"/>
        <path d="M-10 -74 h 20" stroke="#31597d" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M-4 -102 l 5 -14 l 5 14 z" fill="#cdf2ff" opacity="0.9"/>
        <g class="armF"><rect x="24" y="-62" width="15" height="36" rx="6" fill="#95c9ec"/>
          <circle cx="31" cy="-24" r="10" fill="#79aed4"/></g>
      </g></g>`;

    case 'bat': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="8" rx="16" ry="4" fill="#000" opacity="0.2" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <g class="wingL"><path d="M-6 -22 q -26 -14 -32 2 q 14 -4 16 6 q 6 -8 16 2 z" fill="#8c2230"/></g>
        <g class="wingR"><path d="M6 -22 q 26 -14 32 2 q -14 -4 -16 6 q -6 -8 -16 2 z" fill="#8c2230"/></g>
        <ellipse cx="0" cy="-18" rx="13" ry="14" fill="#3a1218"/>
        <path d="M-10 -28 l -2 -11 l 9 7 z" fill="#3a1218"/>
        <path d="M10 -28 l 2 -11 l -9 7 z" fill="#3a1218"/>
        <circle cx="-5" cy="-19" r="3" fill="#ffb03a" stroke="none"/><circle cx="5" cy="-19" r="3" fill="#ffb03a" stroke="none"/>
        <circle cx="-5" cy="-19" r="1.2" fill="#3a0d0d" stroke="none"/><circle cx="5" cy="-19" r="1.2" fill="#3a0d0d" stroke="none"/>
        <path d="M-4 -10 l 2 5 l 2 -5 z" fill="#fff"/><path d="M2 -10 l 2 5 l 2 -5 z" fill="#fff"/>
      </g></g>`;

    case 'balrog': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="0" rx="70" ry="14" fill="#000" opacity="0.35" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <g class="wingL"><path d="M-30 -130 q -80 -40 -108 6 q 26 -10 34 4 q 8 -12 24 0 q 6 -14 26 2 q 10 -8 24 -2 z" fill="#4a0f17"/>
          <path d="M-30 -130 q -70 -34 -96 4" fill="none" stroke="#7a2230" stroke-width="3"/></g>
        <g class="wingR"><path d="M30 -130 q 80 -40 108 6 q -26 -10 -34 4 q -8 -12 -24 0 q -6 -14 -26 2 q -10 -8 -24 -2 z" fill="#4a0f17"/>
          <path d="M30 -130 q 70 -34 96 4" fill="none" stroke="#7a2230" stroke-width="3"/></g>
        <g class="legL"><rect x="-44" y="-56" width="30" height="58" rx="12" fill="#6d1b1b"/>
          <path d="M-48 -4 h 40 v 8 h -44 z" fill="#2c0a0a"/></g>
        <g class="legR"><rect x="14" y="-56" width="30" height="58" rx="12" fill="#6d1b1b"/>
          <path d="M10 -4 h 40 v 8 h -44 z" fill="#2c0a0a"/></g>
        <path d="M-46 -132 q 46 -16 92 0 l 12 82 q -58 18 -116 0 z" fill="#8f2320"/>
        <path d="M-30 -120 q 30 -10 60 0 l 8 56 q -38 12 -76 0 z" fill="#c4442b" opacity="0.85" stroke="none"/>
        <path d="M-40 -126 q 10 -6 18 -6 l -10 76 q -8 -2 -14 -4 z" fill="#ff7f5a" opacity="0.28" stroke="none"/>
        <circle cx="0" cy="-88" r="30" fill="url(#glowR)" opacity="0.7" stroke="none"/>
        <path d="M-18 -104 q 18 -6 36 0 l -6 34 q -12 4 -24 0 z" fill="#ffb03a" opacity="0.75" stroke="none"/>
        <path d="M-10 -100 q 10 -4 20 0 l -3 14 q -7 3 -14 0 z" fill="#fff2b0" opacity="0.65" stroke="none"/>
        <path d="M-42 -70 q 42 12 84 0" stroke="#4d0f0f" stroke-width="3" fill="none" opacity="0.5"/>
        <g class="armB"><rect x="-76" y="-128" width="26" height="66" rx="12" fill="#6d1b1b"/>
          <circle cx="-63" cy="-58" r="16" fill="#7d1f1c"/></g>
        <g class="head">
          <path d="M-34 -184 q 34 -22 68 0 q 6 26 -34 34 q -40 -8 -34 -34 z" fill="#a52a22"/>
          <path d="M-34 -178 l -22 -30 q 24 2 30 14 z" fill="#f0e2c8"/>
          <path d="M34 -178 l 22 -30 q -24 2 -30 14 z" fill="#f0e2c8"/>
          <ellipse cx="-14" cy="-166" rx="8" ry="6" fill="#ffe14d"/>
          <ellipse cx="14" cy="-166" rx="8" ry="6" fill="#ffe14d"/>
          <ellipse class="pupil" cx="-14" cy="-166" rx="3" ry="5" fill="#2a0505"/>
          <ellipse class="pupil" cx="14" cy="-166" rx="3" ry="5" fill="#2a0505"/>
          <path d="M-24 -150 q 24 12 48 0 q -8 16 -24 16 q -16 0 -24 -16 z" fill="#2a0505"/>
          <path d="M-18 -150 l 5 9 l 5 -9 z" fill="#fff"/><path d="M8 -150 l 5 9 l 5 -9 z" fill="#fff"/>
          <path d="M-30 -176 q 10 6 18 4" stroke="#5d100d" stroke-width="3" fill="none"/>
          <path d="M30 -176 q -10 6 -18 4" stroke="#5d100d" stroke-width="3" fill="none"/>
        </g>
        <g class="armF"><rect x="50" y="-130" width="28" height="70" rx="12" fill="#a52a22"/>
          <circle cx="64" cy="-56" r="18" fill="#8f2320"/>
          <path d="M64 -56 l 40 -46 l 12 10 l -40 46 z" fill="#3a2020"/>
          <path d="M100 -104 l 26 -30 q 12 10 4 22 l -22 20 z" fill="#ff7a2f"/></g>
      </g></g>`;

    case 'npc': return `<g class="mon">
      <ellipse class="shadow" cx="0" cy="0" rx="16" ry="5" fill="#000" opacity="0.25" stroke="none"/>
      <g class="bodyG" stroke="${OL}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">
        <path d="M-14 0 q -2 -34 14 -34 q 16 0 14 34 z" fill="#e8d36b"/>
        <circle cx="0" cy="-44" r="13" fill="#ffe0c0"/>
        <path d="M-13 -48 q 13 -18 26 0 q -6 -8 -13 -7 q -7 -1 -13 7 z" fill="#6b4a2a"/>
        <circle cx="-4.5" cy="-44" r="2" fill="#2a2030" stroke="none"/><circle cx="4.5" cy="-44" r="2" fill="#2a2030" stroke="none"/>
        <path d="M-3 -38 q 3 3 6 0" stroke="#a5605a" stroke-width="1.2" fill="none"/>
        <circle cx="0" cy="-58" r="4" fill="#ffd166" opacity="0.8" stroke="none"/>
      </g></g>`;
  }
  return `<g class="mon"><circle cx="0" cy="-20" r="20" fill="#f55"/></g>`;
};

/* ---------------- 아이템 아이콘 (viewBox 0 0 40 40) ---------------- */
Art.icon = function (kind, color) {
  const c = color || '#cfd8e8';
  switch (kind) {
    case 'sword': return `<g><rect x="17.5" y="5" width="5" height="22" rx="2" fill="${c}"/><rect x="19.3" y="6" width="1.6" height="19" fill="#fff" opacity="0.5"/><rect x="12" y="26" width="16" height="4" rx="2" fill="#8c6a2f"/><rect x="18" y="29" width="4" height="7" rx="2" fill="#5d3c1c"/></g>`;
    case 'staff': return `<g><rect x="18" y="12" width="4" height="24" rx="2" fill="#8a5a2b"/><circle cx="20" cy="10" r="7" fill="${c}"/><circle cx="18" cy="8" r="2" fill="#fff" opacity="0.8" stroke="none"/></g>`;
    case 'bow': return `<g><path d="M14 6 Q 32 20 14 34" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M14 6 L 14 34" stroke="#eee" stroke-width="1.5"/></g>`;
    case 'hat': return `<g><path d="M8 26 Q 20 6 32 26 Z" fill="${c}"/><rect x="5" y="25" width="30" height="5" rx="2.5" fill="${c}"/><rect x="10" y="22" width="20" height="3" rx="1.5" fill="#ffd166"/></g>`;
    case 'top': return `<g><path d="M12 10 L 20 13 L 28 10 L 33 16 L 29 20 L 29 32 L 11 32 L 11 20 L 7 16 Z" fill="${c}"/><path d="M14 11 L 20 18 L 26 11" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.6"/></g>`;
    case 'bottom': return `<g><path d="M11 8 h 18 l 2 24 h -7 l -4 -14 l -4 14 h -7 z" fill="${c}"/></g>`;
    case 'shoes': return `<g><path d="M8 20 h 9 l 4 6 l 9 3 v 5 h -22 z" fill="${c}"/><path d="M8 31 h 22 v 3 h -22 z" fill="#333" opacity="0.6" stroke="none"/></g>`;
    case 'glove': return `<g><path d="M12 14 h 12 q 4 0 4 4 v 10 q 0 4 -4 4 h -12 q -4 0 -4 -4 v -10 q 0 -4 4 -4 z" fill="${c}"/><rect x="26" y="16" width="6" height="8" rx="3" fill="${c}"/></g>`;
    case 'cape': return `<g><path d="M12 8 q -6 16 -2 26 h 20 q 4 -10 -2 -26 q -8 4 -16 0 z" fill="${c}"/><rect x="12" y="7" width="16" height="4" rx="2" fill="#ffd166"/></g>`;
    case 'ring': return `<g><circle cx="20" cy="23" r="9" fill="none" stroke="${c}" stroke-width="4"/><path d="M20 8 l 5 7 h -10 z" fill="#9ff0ff"/></g>`;
    case 'potionRed': return `<g><rect x="16" y="6" width="8" height="5" fill="#b8b8c8"/><path d="M14 11 h 12 q 5 6 5 14 q 0 8 -11 8 q -11 0 -11 -8 q 0 -8 5 -14 z" fill="#ff5a5a"/><path d="M17 16 q -3 5 -2 10" stroke="#fff" stroke-width="2" opacity="0.5" fill="none"/></g>`;
    case 'potionBlue': return `<g><rect x="16" y="6" width="8" height="5" fill="#b8b8c8"/><path d="M14 11 h 12 q 5 6 5 14 q 0 8 -11 8 q -11 0 -11 -8 q 0 -8 5 -14 z" fill="#4da6ff"/><path d="M17 16 q -3 5 -2 10" stroke="#fff" stroke-width="2" opacity="0.5" fill="none"/></g>`;
    case 'elixir': return `<g><rect x="17" y="5" width="6" height="4" fill="#d8b84a"/><path d="M13 9 q 7 8 7 12 q 0 -4 7 -12 q 6 8 4 16 q -2 8 -11 8 q -9 0 -11 -8 q -2 -8 4 -16 z" fill="#ffd45a"/><circle cx="20" cy="26" r="4" fill="#fff" opacity="0.6" stroke="none"/></g>`;
    case 'meso': return `<g><circle cx="20" cy="20" r="11" fill="#ffcf5c" stroke="#c98f14" stroke-width="2"/><text x="20" y="25" font-size="13" font-weight="700" text-anchor="middle" fill="#8a5f0a">₩</text></g>`;
    case 'jelly': return `<g><path d="M9 30 q -2 -16 11 -18 q 13 2 11 18 z" fill="#57d98a"/><circle cx="16" cy="18" r="2" fill="#fff" opacity="0.7" stroke="none"/></g>`;
    case 'spore': return `<g><circle cx="20" cy="20" r="9" fill="#f08a33"/><circle cx="16" cy="17" r="2.5" fill="#ffd9a8"/><circle cx="23" cy="22" r="2" fill="#ffd9a8"/></g>`;
    case 'fang': return `<g><path d="M14 8 q 8 12 6 24 q -8 -6 -12 -18 z" fill="#f0f0f5"/><path d="M26 10 q -4 12 0 20" stroke="#ddd" stroke-width="3" fill="none"/></g>`;
    case 'shard': return `<g><path d="M20 5 l 9 15 l -9 16 l -9 -16 z" fill="#9fe4ff" stroke="#4da6d8" stroke-width="1.5"/></g>`;
    case 'horn': return `<g><path d="M10 33 q 4 -26 22 -28 q -6 8 -6 14 q 0 8 -6 14 z" fill="#f0e2c8"/><path d="M14 30 q 4 -18 14 -22" stroke="#c9b48c" stroke-width="2" fill="none"/></g>`;
    case 'power': return `<g><path d="M20 4 l 5 12 l 12 4 l -12 4 l -5 12 l -5 -12 l -12 -4 l 12 -4 z" fill="#ff8b3d"/></g>`;
    case 'thunder': return `<g><path d="M23 4 l -12 18 h 8 l -4 14 l 14 -19 h -9 z" fill="#ffe14d" stroke="#ffa500" stroke-width="1.2"/></g>`;
    case 'heal': return `<g><path d="M16 8 h 8 v 8 h 8 v 8 h -8 v 8 h -8 v -8 h -8 v -8 h 8 z" fill="#7ce89a"/></g>`;
    case 'blast': return `<g><path d="M6 30 q 14 -22 30 -24" fill="none" stroke="#ffb35c" stroke-width="5" stroke-linecap="round"/>
      <path d="M6 22 q 14 -14 30 -14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
      <path d="M8 34 q 14 -8 28 -6" fill="none" stroke="#ff8b3d" stroke-width="3" stroke-linecap="round"/></g>`;
    case 'shield': return `<g><path d="M20 5 l 13 5 v 10 q 0 11 -13 16 q -13 -5 -13 -16 v -10 z" fill="#8fa5e8" stroke="#dfe7ff" stroke-width="1.6"/>
      <path d="M20 12 v 16" stroke="#fff" stroke-width="2.4" opacity="0.8"/></g>`;
    case 'bolt': return `<g><circle cx="20" cy="20" r="9" fill="#9fd8ff"/><circle cx="17" cy="17" r="3" fill="#fff"/>
      <circle cx="20" cy="20" r="13" fill="none" stroke="#6fb8ff" stroke-width="1.6" opacity="0.8"/></g>`;
    case 'fire': return `<g><path d="M20 4 q 10 10 6 18 q 5 -2 5 -7 q 5 7 2 14 q -3 7 -13 7 q -10 0 -12 -9 q -2 -9 6 -14 q -1 6 3 7 q -3 -10 3 -16 z" fill="#ff8b3d"/>
      <path d="M20 18 q 5 6 3 11 q -2 5 -6 4 q -4 -1 -3 -6 q 1 -5 6 -9 z" fill="#ffe14d"/></g>`;
    case 'arrow': return `<g><rect x="6" y="18.5" width="24" height="3" rx="1.5" fill="#c9a06a"/>
      <path d="M34 20 l -8 -6 l 0 12 z" fill="#eef1ff"/><path d="M6 20 l 7 -5 l 0 10 z" fill="#ff8f6b"/></g>`;
    case 'multi': return `<g><path d="M6 12 h 20 M6 20 h 24 M6 28 h 20" stroke="#c9a06a" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M30 12 l -6 -4 l 0 8 z M34 20 l -6 -4 l 0 8 z M30 28 l -6 -4 l 0 8 z" fill="#eef1ff"/></g>`;
    case 'eye': return `<g><path d="M6 20 q 14 -12 28 0 q -14 12 -28 0 z" fill="#dfe7ff"/><circle cx="20" cy="20" r="6" fill="#3f9a63"/>
      <circle cx="20" cy="20" r="2.5" fill="#12261a"/></g>`;
  }
  return `<circle cx="20" cy="20" r="10" fill="${c}"/>`;
};

/* ---------------- 배경 조각 ---------------- */
Art.tree = function (v) {
  // v: 0~1 변형값 — 메이플풍 둥근 잎 뭉치 + 외곽선
  const lean = (v - 0.5) * 8;
  return `<g stroke="${OL}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M-7 0 q -2 -42 ${lean} -58 q 3 16 9 20 l 2 38 z" fill="url(#barkG)"/>
    <path d="M-2 -20 q -7 -6 -12 -6 q 7 -4 13 2 z" fill="url(#barkG)"/>
    <circle cx="${lean}" cy="-74" r="30" fill="url(#leafG)"/>
    <circle cx="${lean - 25}" cy="-58" r="21" fill="url(#leafG2)"/>
    <circle cx="${lean + 25}" cy="-60" r="23" fill="url(#leafG)"/>
    <circle cx="${lean - 12}" cy="-88" r="18" fill="url(#leafG2)"/>
    <circle cx="${lean + 14}" cy="-86" r="16" fill="url(#leafG2)"/>
    <path d="M${lean - 18} -84 q 10 -10 22 -8" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.3"/>
  </g>`;
};
Art.house = function (v) {
  const roof = ['#e8734f', '#5fa8d8', '#c58ad8'][Math.floor(v * 3) % 3];
  return `<g stroke="${OL}" stroke-width="2.4" stroke-linejoin="round">
    <rect x="-56" y="-92" width="112" height="92" rx="6" fill="url(#wallG)"/>
    <path d="M-72 -88 q 72 -62 144 0 z" fill="${roof}"/>
    <path d="M-60 -92 h 120 v 8 h -120 z" fill="${roof}" opacity="0.95"/>
    <path d="M-44 -104 q 44 -30 88 4" stroke="#ffffff" stroke-width="3.4" fill="none" opacity="0.35"/>
    <rect x="-17" y="-54" width="34" height="54" rx="4" fill="#9a6535"/>
    <path d="M-17 -40 h 34" stroke="${OL}" stroke-width="1.8"/>
    <circle cx="10" cy="-27" r="2.6" fill="#ffe08a"/>
    <rect x="-44" y="-76" width="24" height="22" rx="4" fill="#ffeaa7"/>
    <rect x="20" y="-76" width="24" height="22" rx="4" fill="#ffeaa7"/>
    <path d="M-32 -76 v 22 M-44 -65 h 24" stroke="${OL}" stroke-width="1.6"/>
    <path d="M32 -76 v 22 M20 -65 h 24" stroke="${OL}" stroke-width="1.6"/>
    <rect x="-8" y="-118" width="16" height="16" rx="4" fill="#b6743c"/>
  </g>`;
};
Art.bush = function () {
  return `<g stroke="${OL}" stroke-width="2" stroke-linejoin="round">
    <circle cx="-13" cy="-9" r="12" fill="url(#leafG2)"/>
    <circle cx="13" cy="-9" r="13" fill="url(#leafG)"/>
    <circle cx="0" cy="-15" r="15" fill="url(#leafG2)"/>
    <path d="M-8 -20 q 7 -6 15 -4" stroke="#fff" stroke-width="2.4" fill="none" opacity="0.3"/>
  </g>`;
};
Art.flower = function (col) {
  return `<g stroke="${OL}" stroke-width="1.4" stroke-linejoin="round">
    <path d="M0 0 v -10" stroke="#4fa83b" stroke-width="2"/>
    <circle cx="0" cy="-13" r="3.4" fill="${col}"/>
    <circle cx="-4.6" cy="-11" r="3" fill="${col}"/><circle cx="4.6" cy="-11" r="3" fill="${col}"/>
    <circle cx="0" cy="-16.5" r="3" fill="${col}"/>
    <circle cx="0" cy="-13" r="1.6" fill="#ffe08a" stroke="none"/>
  </g>`;
};

/* ---------------- 배경 (테마별, 시차 레이어) ---------------- */
Art.background = function (theme, w) {
  const sky = { town: 'skyDusk', hill: 'skyDay', forest: 'skyForest', ice: 'skyIce', lava: 'skyLava' }[theme] || 'skyDay';
  let far = '', near = '';
  const rnd = mulberry(theme.length * 977);

  if (theme === 'town' || theme === 'hill') {
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = 60 + rnd() * 140, s = 0.6 + rnd() * 0.9;
      far += `<g transform="translate(${x},${y}) scale(${s})" opacity="0.85"><ellipse cx="0" cy="0" rx="46" ry="20" fill="#fff"/><ellipse cx="-30" cy="6" rx="26" ry="14" fill="#fff"/><ellipse cx="32" cy="7" rx="30" ry="15" fill="#fff"/></g>`;
    }
    for (let i = 0; i < 8; i++) {
      const x = i * (w / 7), h = 190 + rnd() * 150;
      far += `<path d="M${x - 260} 680 q 260 ${-h} 520 0 z" fill="url(#hillFar)" opacity="0.65" stroke="none"/>`;
    }
    for (let i = 0; i < 7; i++) {
      const x = i * (w / 6) + 80, h = 120 + rnd() * 110;
      far += `<path d="M${x - 220} 690 q 220 ${-h} 440 0 z" fill="url(#hillNear)" opacity="0.85" stroke="none"/>`;
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, s = 0.62 + rnd() * 0.5;
      far += `<g transform="translate(${x},612) scale(${s})" opacity="0.75">${Art.tree(rnd())}</g>`;
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, s = 0.85 + rnd() * 0.6;
      near += `<g transform="translate(${x},616) scale(${s})">${Art.tree(rnd())}</g>`;
    }
    for (let i = 0; i < 18; i++) near += `<g transform="translate(${rnd() * w},618) scale(${0.7 + rnd() * 0.5})">${Art.bush()}</g>`;
    for (let i = 0; i < 26; i++) {
      const col = ['#ff9ec4', '#ffe36b', '#9fd4ff', '#ffb0a0'][Math.floor(rnd() * 4)];
      near += `<g transform="translate(${rnd() * w},618)">${Art.flower(col)}</g>`;
    }
    if (theme === 'town') {
      for (let i = 0; i < 6; i++) {
        const x = 140 + i * (w / 6) + rnd() * 50;
        near += `<g transform="translate(${x},616) scale(${0.9 + rnd() * 0.25})">${Art.house(rnd())}</g>`;
      }
      far += `<circle cx="${w * 0.75}" cy="120" r="46" fill="#fff6d0" opacity="0.9"/><circle cx="${w * 0.75}" cy="120" r="80" fill="url(#glowY)"/>`;
      for (let i = 0; i < 40; i++) {
        far += `<circle cx="${rnd() * w}" cy="${40 + rnd() * 260}" r="${1 + rnd() * 1.8}" fill="#fff" opacity="${0.3 + rnd() * 0.6}" stroke="none"/>`;
      }
    }
  } else if (theme === 'forest') {
    for (let i = 0; i < 24; i++) {
      const x = rnd() * w, s = 1.0 + rnd() * 0.8, lean = (rnd() - 0.5) * 10;
      far += `<g transform="translate(${x},646) scale(${s})" opacity="0.7" stroke="none">
        <path d="M-7 0 q -2 -42 ${lean} -58 l 9 2 l 2 56 z" fill="#3a5e3a"/>
        <circle cx="${lean}" cy="-74" r="30" fill="#2f7048"/>
        <circle cx="${lean - 25}" cy="-58" r="21" fill="#2a6541"/>
        <circle cx="${lean + 25}" cy="-60" r="23" fill="#2a6541"/>
        <circle cx="${lean - 12}" cy="-88" r="18" fill="#357a4e"/>
        <circle cx="${lean + 14}" cy="-86" r="16" fill="#357a4e"/></g>`;
    }
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w, s = 1.15 + rnd() * 0.75;
      near += `<g transform="translate(${x},634) scale(${s})">${Art.tree(rnd())}</g>`;
      near += `<g transform="translate(${rnd() * w},634) scale(${0.8 + rnd() * 0.5})">${Art.bush()}</g>`;
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, s = 0.5 + rnd() * 0.4;
      near += `<g transform="translate(${x},634) scale(${s})" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round">
        <path d="M-11 0 q -4 -17 0 -20 h 22 q 4 3 0 20 z" fill="#f6ead0"/>
        <path d="M-25 -18 q 3 -26 25 -26 q 22 0 25 26 q -25 7 -50 0 z" fill="#d8664a"/>
        <ellipse cx="-10" cy="-28" rx="6" ry="4.2" fill="#ffe3bd"/><ellipse cx="10" cy="-32" rx="5" ry="3.6" fill="#ffe3bd"/></g>`;
    }
    for (let i = 0; i < 30; i++) {
      far += `<circle cx="${rnd() * w}" cy="${200 + rnd() * 380}" r="${2 + rnd() * 3}" fill="#eaffb0" opacity="0.5" stroke="none"/>`;
    }
  } else if (theme === 'ice') {
    for (let i = 0; i < 12; i++) {
      const x = i * (w / 11), h = 200 + rnd() * 220;
      far += `<path d="M${x - 160} 680 L ${x} ${680 - h} L ${x + 160} 680 z" fill="#8fc0e0" opacity="0.55" stroke="none"/>`;
      far += `<path d="M${x - 60} 680 L ${x} ${680 - h} L ${x + 30} 680 z" fill="#e2f4ff" opacity="0.45" stroke="none"/>`;
    }
    for (let i = 0; i < 24; i++) {
      const x = rnd() * w, y = 400 + rnd() * 220, s = 0.5 + rnd();
      near += `<path transform="translate(${x},${y}) scale(${s})" d="M0 -30 l 10 18 l -10 22 l -10 -22 z" fill="#cdeeff" opacity="0.6" stroke="none"/>`;
    }
  } else if (theme === 'lava') {
    for (let i = 0; i < 10; i++) {
      const x = i * (w / 9), h = 180 + rnd() * 200;
      far += `<path d="M${x - 180} 680 L ${x} ${680 - h} L ${x + 180} 680 z" fill="#3a1416" opacity="0.9"/>`;
    }
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w, y = 120 + rnd() * 400, r = 4 + rnd() * 10;
      near += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glowR)" opacity="0.5" stroke="none"/>`;
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w;
      near += `<path d="M${x} 700 l 14 -${60 + rnd() * 90} l 14 ${60 + rnd() * 90} z" fill="#2a0d0f"/>`;
    }
  }
  return {
    sky: `<rect x="0" y="0" width="${GAME.W}" height="${GAME.H}" fill="url(#${sky})"/>`,
    far, near,
  };
};

/* 지면/발판 */
Art.ground = function (theme, w, y) {
  const top = { ice: 'url(#iceTop)', lava: 'url(#rockTop)' }[theme] || 'url(#grassTop)';
  const body = { ice: '#4c78a8', lava: '#23131a' }[theme] || 'url(#dirtG)';
  const rnd = mulberry(Math.round(w) + 31);
  // 윗면 물결(스캘럽) 가장자리
  let scallop = `M0 ${y + 26}`;
  for (let x = 0; x <= w; x += 44) scallop += ` Q ${x + 11} ${y - 5} ${x + 22} ${y + 3} Q ${x + 33} ${y + 10} ${x + 44} ${y + 3}`;
  scallop += ` L ${w} ${y + 60} L 0 ${y + 60} Z`;
  let deco = '';
  if (theme !== 'lava' && theme !== 'ice') {
    for (let i = 0; i < Math.round(w / 90); i++) {
      const x = rnd() * w;
      deco += `<path d="M${x} ${y + 2} q -4 -10 -1 -14 q 3 6 4 8 q 2 -7 6 -11 q 0 9 -3 17 z" fill="#8ce06a" opacity="0.85" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>`;
    }
  }
  for (let i = 0; i < Math.round(w / 70); i++) {
    const x = rnd() * w, yy = y + 34 + rnd() * 90;
    deco += `<ellipse cx="${x}" cy="${yy}" rx="${5 + rnd() * 9}" ry="${3 + rnd() * 5}" fill="#000" opacity="0.12" stroke="none"/>`;
  }
  let extra = '';
  if (theme === 'lava') extra = `<rect x="0" y="${y + 40}" width="${w}" height="${720 - y}" fill="#ff5a1f" opacity="0.22" stroke="none"/>`;
  return `<rect x="0" y="${y + 20}" width="${w}" height="${760 - y}" fill="${body}"/>
    <path d="${scallop}" fill="${top}" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M0 ${y + 7} h ${w}" stroke="#ffffff" stroke-width="3" opacity="0.22"/>${deco}${extra}`;
};

Art.platform = function (theme, p) {
  const top = { ice: 'url(#iceTop)', lava: 'url(#rockTop)', forest: 'url(#woodG)' }[theme] || 'url(#grassTop)';
  const body = { ice: '#4c78a8', lava: '#23131a', forest: '#6b4424' }[theme] || 'url(#dirtG)';
  const x = p.x, y = p.y, w = p.w;
  let vines = '';
  if (theme !== 'ice' && theme !== 'lava') {
    for (let i = 0; i < Math.max(1, Math.round(w / 110)); i++) {
      const vx = x + 24 + i * 100 + (i % 2) * 18, vl = 14 + (i % 3) * 9;
      vines += `<path d="M${vx} ${y + 22} q 4 ${vl / 2} 0 ${vl}" stroke="#3f9a4f" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="${vx}" cy="${y + 22 + vl}" r="4" fill="#63c455" stroke="${OL}" stroke-width="1.4"/>`;
    }
  }
  return `<g>
    <rect x="${x}" y="${y + 8}" width="${w}" height="22" rx="9" fill="${body}" stroke="${OL}" stroke-width="2.2"/>
    <rect x="${x}" y="${y}" width="${w}" height="18" rx="9" fill="${top}" stroke="${OL}" stroke-width="2.2"/>
    <rect x="${x + 6}" y="${y + 3}" width="${Math.max(8, w - 12)}" height="4" rx="2" fill="#fff" opacity="0.3" stroke="none"/>
    ${vines}</g>`;
};

Art.portal = function (boss) {
  const g = boss ? 'url(#portalB)' : 'url(#portalG)';
  const rim = boss ? '#ffb15c' : '#9fe0ff';
  return `<g class="portal">
    <ellipse cx="0" cy="-45" rx="38" ry="54" fill="${g}" opacity="0.35" stroke="none"/>
    <ellipse class="pRing" cx="0" cy="-45" rx="30" ry="46" fill="${g}" stroke="${rim}" stroke-width="3"/>
    <ellipse cx="0" cy="-45" rx="18" ry="34" fill="#fff" opacity="0.35" stroke="none"/>
    <ellipse class="pSpin" cx="0" cy="-45" rx="26" ry="40" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 12" opacity="0.85"/>
    <path d="M-34 -2 q 34 -14 68 0 q -34 10 -68 0 z" fill="${rim}" opacity="0.45" stroke="none"/>
    <circle cx="-16" cy="-70" r="2.6" fill="#fff" opacity="0.9" stroke="none"/>
    <circle cx="14" cy="-30" r="2" fill="#fff" opacity="0.8" stroke="none"/>
  </g>`;
};

/* 난수(시드) */
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
