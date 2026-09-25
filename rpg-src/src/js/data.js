/* =========================================================
   DATA : 직업 / 스킬 / 아이템 / 몬스터 / 맵 / 퀘스트 정의
   ========================================================= */
const GAME = {
  W: 1280, H: 720,
  GRAVITY: 1900,
  JUMP_V: 700,
  MOVE_SPD: 290,
  TERMINAL_V: 1500,
};

/* ---------------- 직업 ---------------- */
const JOBS = {
  warrior: {
    id: 'warrior', name: '전사', desc: '높은 체력과 강한 근접 공격',
    hp: 140, mp: 40, hpPerLv: 26, mpPerLv: 6, atk: 14, def: 8, crit: 0.06,
    color: { armor: '#c0463c', armor2: '#8c2b24', trim: '#ffd166' }, weapon: 'sword',
  },
  mage: {
    id: 'mage', name: '마법사', desc: '넓은 범위의 마법 공격',
    hp: 95, mp: 110, hpPerLv: 15, mpPerLv: 20, atk: 17, def: 5, crit: 0.08,
    color: { armor: '#5560c8', armor2: '#343da0', trim: '#9fd8ff' }, weapon: 'staff',
  },
  archer: {
    id: 'archer', name: '궁수', desc: '빠른 속도와 높은 크리티컬',
    hp: 115, mp: 70, hpPerLv: 20, mpPerLv: 12, atk: 15, def: 6, crit: 0.16,
    color: { armor: '#3f9a63', armor2: '#256b45', trim: '#d8f5a0' }, weapon: 'bow',
  },
};

/* ---------------- 경험치 테이블 ---------------- */
function expNeeded(lv) { return Math.floor(22 * Math.pow(lv, 1.72) + 18 * lv + 20); }

/* ---------------- 스킬 ---------------- */
const SKILL_SETS = {
  warrior: [
    { id: 'slash', name: '기본 베기', key: 'Z', kind: 'melee', mp: 0, cd: 0.42, dmg: 1.0, range: 82, anim: 0.34,
      desc: '검으로 적을 벤다. 소모 없음.', icon: 'sword' },
    { id: 'power', name: '파워 스트라이크', key: 'X', kind: 'melee', mp: 12, cd: 1.4, dmg: 2.6, range: 108, anim: 0.42, fx: 'power',
      desc: 'MP 12 · 혼신의 일격 (260%)', icon: 'power' },
    { id: 'blast', name: '슈러우 블래스트', key: 'C', kind: 'melee', mp: 22, cd: 3.2, dmg: 1.6, hits: 8, range: 150, both: true, anim: 0.46, fx: 'power',
      desc: 'MP 22 · 앞뒤 적 최대 8체를 한꺼번에 베기 (160%)', icon: 'blast' },
    { id: 'ironBody', name: '아이언 바디', key: 'V', kind: 'buff', mp: 18, cd: 14, buff: { def: 1.6, atk: 1.15, dur: 10 }, anim: 0.4,
      desc: 'MP 18 · 10초간 방어력 60% · 공격력 15% 증가', icon: 'shield' },
  ],
  mage: [
    { id: 'bolt', name: '에너지 볼트', key: 'Z', kind: 'bolt', mp: 0, cd: 0.55, dmg: 1.1, proj: 'bolt', anim: 0.42,
      desc: '지팡이에서 마력구를 발사. 소모 없음.', icon: 'bolt' },
    { id: 'fireBolt', name: '파이어 볼트', key: 'X', kind: 'bolt', mp: 14, cd: 1.5, dmg: 2.4, proj: 'fire', pierce: true, anim: 0.46,
      desc: 'MP 14 · 관통하는 화염구 (240%)', icon: 'fire' },
    { id: 'thunder', name: '썬더 브레이크', key: 'C', kind: 'aoe', mp: 30, cd: 4.2, dmg: 1.5, hits: 3, range: 340, anim: 0.5,
      desc: 'MP 30 · 주변 전체에 3연속 번개', icon: 'thunder' },
    { id: 'heal', name: '힐링 라이트', key: 'V', kind: 'heal', mp: 22, cd: 6.0, heal: 0.35, anim: 0.5,
      desc: 'MP 22 · 최대 HP의 35% 회복', icon: 'heal' },
  ],
  archer: [
    { id: 'shot', name: '기본 사격', key: 'Z', kind: 'arrow', mp: 0, cd: 0.5, dmg: 1.05, arrows: 1, anim: 0.4,
      desc: '활을 당겨 화살을 쏜다. 소모 없음.', icon: 'arrow' },
    { id: 'arrowBlow', name: '애로우 블로', key: 'X', kind: 'arrow', mp: 13, cd: 1.5, dmg: 2.4, arrows: 1, pierce: true, anim: 0.44,
      desc: 'MP 13 · 관통하는 강궁 (240%)', icon: 'power' },
    { id: 'multishot', name: '멀티샷', key: 'C', kind: 'arrow', mp: 26, cd: 3.4, dmg: 1.15, arrows: 5, spread: 15, anim: 0.52,
      desc: 'MP 26 · 화살 5발을 부채꼴로 발사', icon: 'multi' },
    { id: 'focus', name: '이글 아이', key: 'V', kind: 'buff', mp: 16, cd: 12, buff: { atk: 1.3, crit: 0.18, dur: 10 }, anim: 0.4,
      desc: 'MP 16 · 10초간 공격력 30% · 크리 18% 증가', icon: 'eye' },
  ],
};
const SKILLS = [].concat(SKILL_SETS.warrior, SKILL_SETS.mage, SKILL_SETS.archer);
function jobSkills(job) { return SKILL_SETS[job] || SKILL_SETS.warrior; }

/* ---------------- 아이템 ---------------- */
const RARITY = {
  common: { name: '일반', color: '#d8dcf0', mul: 1.0 },
  rare: { name: '레어', color: '#6ab4ff', mul: 1.35 },
  epic: { name: '에픽', color: '#c47bff', mul: 1.8 },
  unique: { name: '유니크', color: '#ffc44d', mul: 2.4 },
};

const EQUIP_SLOTS = [
  { id: 'weapon', name: '무기' },
  { id: 'hat', name: '모자' },
  { id: 'top', name: '상의' },
  { id: 'bottom', name: '하의' },
  { id: 'shoes', name: '신발' },
  { id: 'glove', name: '장갑' },
  { id: 'cape', name: '망토' },
  { id: 'ring', name: '반지' },
];

/* 장비 베이스 (tier 별) */
const EQUIP_BASE = [
  { slot: 'weapon', tier: 1, name: '나무 검', atk: 8, art: 'sword', color: '#a9752f' },
  { slot: 'weapon', tier: 2, name: '강철 장검', atk: 20, art: 'sword', color: '#cfd8e8' },
  { slot: 'weapon', tier: 3, name: '화염 대검', atk: 40, art: 'sword', color: '#ff8b3d' },
  { slot: 'weapon', tier: 4, name: '발록의 클레이모어', atk: 72, art: 'sword', color: '#b46bff' },
  { slot: 'weapon', tier: 1, name: '단풍 활', atk: 8, art: 'bow', color: '#b07b3e' },
  { slot: 'weapon', tier: 2, name: '컴파운드 보우', atk: 20, art: 'bow', color: '#8fd0a8' },
  { slot: 'weapon', tier: 3, name: '폭풍의 장궁', atk: 40, art: 'bow', color: '#5ad2ff' },
  { slot: 'weapon', tier: 4, name: '발록의 살기탈', atk: 72, art: 'bow', color: '#ff7ad1' },
  { slot: 'weapon', tier: 1, name: '견습 지팡이', atk: 8, art: 'staff', color: '#9fd8ff' },
  { slot: 'weapon', tier: 2, name: '마력석 스태프', atk: 20, art: 'staff', color: '#7f9bff' },
  { slot: 'weapon', tier: 3, name: '빙결의 로드', atk: 40, art: 'staff', color: '#6ffaff' },
  { slot: 'weapon', tier: 4, name: '발록의 악마장', atk: 72, art: 'staff', color: '#c07bff' },
  { slot: 'hat', tier: 1, name: '가죽 모자', def: 4, hp: 10, art: 'hat', color: '#9b6b3a' },
  { slot: 'hat', tier: 2, name: '강철 투구', def: 11, hp: 30, art: 'hat', color: '#c3ccdd' },
  { slot: 'hat', tier: 3, name: '드래곤 헬름', def: 22, hp: 70, art: 'hat', color: '#ff9b5c' },
  { slot: 'top', tier: 1, name: '천 갑옷', def: 5, hp: 14, art: 'top', color: '#7fa4d8' },
  { slot: 'top', tier: 2, name: '미스릴 흉갑', def: 14, hp: 40, art: 'top', color: '#9fe8d8' },
  { slot: 'top', tier: 3, name: '용린 갑옷', def: 26, hp: 90, art: 'top', color: '#ff7a6b' },
  { slot: 'bottom', tier: 1, name: '무명 바지', def: 4, art: 'bottom', color: '#6b7bbf' },
  { slot: 'bottom', tier: 2, name: '강철 각반', def: 10, hp: 20, art: 'bottom', color: '#b9c2d8' },
  { slot: 'bottom', tier: 3, name: '용린 각반', def: 20, hp: 50, art: 'bottom', color: '#e8705f' },
  { slot: 'shoes', tier: 1, name: '가죽 신발', def: 3, spd: 6, art: 'shoes', color: '#8a5a33' },
  { slot: 'shoes', tier: 2, name: '바람의 부츠', def: 8, spd: 14, art: 'shoes', color: '#8fe0ff' },
  { slot: 'glove', tier: 1, name: '천 장갑', def: 2, atk: 2, art: 'glove', color: '#cbb89a' },
  { slot: 'glove', tier: 2, name: '전투 건틀릿', def: 7, atk: 8, art: 'glove', color: '#c0c8da' },
  { slot: 'cape', tier: 1, name: '여행자 망토', def: 3, mp: 10, art: 'cape', color: '#6f5ab5' },
  { slot: 'cape', tier: 2, name: '별빛 망토', def: 9, mp: 40, art: 'cape', color: '#4f6fe0' },
  { slot: 'ring', tier: 1, name: '구리 반지', atk: 3, crit: 0.02, art: 'ring', color: '#d99a4e' },
  { slot: 'ring', tier: 2, name: '수정 반지', atk: 9, crit: 0.05, art: 'ring', color: '#9ff0ff' },
  { slot: 'ring', tier: 3, name: '발록의 인장', atk: 18, crit: 0.10, hp: 60, art: 'ring', color: '#ff6b9d' },
];

const CONSUMABLES = {
  redPotion: { id: 'redPotion', name: '빨간 포션', type: 'use', hp: 60, art: 'potionRed', desc: 'HP 60 회복', price: 60 },
  bluePotion: { id: 'bluePotion', name: '파란 포션', type: 'use', mp: 40, art: 'potionBlue', desc: 'MP 40 회복', price: 80 },
  elixir: { id: 'elixir', name: '엘릭서', type: 'use', hp: 400, mp: 200, art: 'elixir', desc: 'HP 400 · MP 200 회복', price: 800 },
};

const ETC_ITEMS = {
  jelly: { id: 'jelly', name: '슬라임 젤리', type: 'etc', art: 'jelly', desc: '물컹거리는 젤리 조각' },
  spore: { id: 'spore', name: '버섯 포자', type: 'etc', art: 'spore', desc: '버섯에서 떨어진 포자' },
  fang: { id: 'fang', name: '늑대 송곳니', type: 'etc', art: 'fang', desc: '날카로운 송곳니' },
  shard: { id: 'shard', name: '얼음 파편', type: 'etc', art: 'shard', desc: '차가운 결정 조각' },
  horn: { id: 'horn', name: '발록의 뿔', type: 'etc', art: 'horn', desc: '보스를 쓰러뜨린 증표' },
};

/* ---------------- 몬스터 ---------------- */
const MONSTERS = {
  snail: {
    id: 'snail', name: '달팽이', art: 'snail', lv: 1, hp: 30, atk: 8, def: 1, exp: 12,
    w: 44, h: 34, spd: 32, meso: [4, 14], sight: 180,
    drops: [{ item: 'jelly', p: 0.25 }, { item: 'redPotion', p: 0.18 }, { equip: 1, p: 0.10 }],
  },
  slime: {
    id: 'slime', name: '슬라임', art: 'slime', lv: 3, hp: 55, atk: 12, def: 2, exp: 22,
    w: 48, h: 40, spd: 52, jumpy: true, meso: [8, 24], sight: 260,
    drops: [{ item: 'jelly', p: 0.35 }, { item: 'redPotion', p: 0.2 }, { item: 'bluePotion', p: 0.12 }, { equip: 1, p: 0.14 }],
  },
  mushroom: {
    id: 'mushroom', name: '주황버섯', art: 'mushroom', lv: 8, hp: 130, atk: 22, def: 6, exp: 52,
    w: 52, h: 50, spd: 62, meso: [18, 45], sight: 300,
    drops: [{ item: 'spore', p: 0.4 }, { item: 'redPotion', p: 0.22 }, { equip: 1, p: 0.16 }, { equip: 2, p: 0.05 }],
  },
  wolf: {
    id: 'wolf', name: '들개', art: 'wolf', lv: 14, hp: 240, atk: 38, def: 11, exp: 105,
    w: 62, h: 44, spd: 118, meso: [30, 80], sight: 420,
    drops: [{ item: 'fang', p: 0.35 }, { item: 'bluePotion', p: 0.2 }, { equip: 2, p: 0.18 }],
  },
  golem: {
    id: 'golem', name: '얼음 골렘', art: 'golem', lv: 22, hp: 640, atk: 62, def: 26, exp: 260,
    w: 74, h: 78, spd: 54, meso: [70, 160], sight: 380,
    drops: [{ item: 'shard', p: 0.45 }, { item: 'elixir', p: 0.1 }, { equip: 2, p: 0.22 }, { equip: 3, p: 0.07 }],
  },
  bat: {
    id: 'bat', name: '화염 박쥐', art: 'bat', lv: 26, hp: 420, atk: 70, def: 18, exp: 300,
    w: 52, h: 38, spd: 150, flying: true, meso: [80, 180], sight: 500,
    drops: [{ item: 'elixir', p: 0.12 }, { equip: 3, p: 0.12 }],
  },
  balrog: {
    id: 'balrog', name: '발록', art: 'balrog', boss: true, lv: 35, hp: 9000, atk: 110, def: 40, exp: 4200,
    w: 150, h: 170, spd: 78, meso: [2500, 4200], sight: 900,
    drops: [{ item: 'horn', p: 1 }, { item: 'elixir', p: 1 }, { equip: 4, p: 0.6 }, { equip: 3, p: 1 }],
  },
};

/* ---------------- 맵 ---------------- */
const MAPS = {
  town: {
    id: 'town', name: '달빛 마을', w: 1900, groundY: 600, theme: 'town',
    platforms: [
      { x: 300, y: 460, w: 220 }, { x: 700, y: 400, w: 200 }, { x: 1100, y: 470, w: 240 },
    ],
    portals: [{ x: 1780, y: 600, to: 'hill', toX: 120, label: '구름 언덕' }],
    spawns: [],
    npcs: [{ x: 620, y: 600, name: '안내인 루미', art: 'npc', lines: ['달빛 마을에 온 걸 환영해!', '오른쪽 포탈로 나가면 사냥터야.', 'Z키로 공격, Alt로 점프!'] }],
  },
  hill: {
    id: 'hill', name: '구름 언덕', w: 2600, groundY: 620, theme: 'hill',
    platforms: [
      { x: 260, y: 500, w: 200 }, { x: 560, y: 410, w: 180 }, { x: 900, y: 500, w: 240 },
      { x: 1300, y: 430, w: 200 }, { x: 1650, y: 520, w: 260 }, { x: 2050, y: 440, w: 220 },
      { x: 700, y: 280, w: 160 }, { x: 1500, y: 290, w: 180 },
    ],
    portals: [
      { x: 60, y: 620, to: 'town', toX: 1760, label: '달빛 마을' },
      { x: 2520, y: 620, to: 'forest', toX: 120, label: '버섯 숲' },
    ],
    spawns: [{ type: 'snail', n: 5 }, { type: 'slime', n: 5 }],
  },
  forest: {
    id: 'forest', name: '버섯 숲', w: 2800, groundY: 630, theme: 'forest',
    platforms: [
      { x: 300, y: 520, w: 220 }, { x: 640, y: 430, w: 200 }, { x: 1000, y: 340, w: 200 },
      { x: 1350, y: 460, w: 240 }, { x: 1750, y: 380, w: 200 }, { x: 2100, y: 500, w: 260 },
      { x: 2400, y: 380, w: 200 }, { x: 180, y: 320, w: 160 },
    ],
    portals: [
      { x: 60, y: 630, to: 'hill', toX: 2470, label: '구름 언덕' },
      { x: 2720, y: 630, to: 'glacier', toX: 120, label: '얼음 협곡' },
    ],
    spawns: [{ type: 'mushroom', n: 6 }, { type: 'wolf', n: 4 }],
  },
  glacier: {
    id: 'glacier', name: '얼음 협곡', w: 3000, groundY: 640, theme: 'ice',
    platforms: [
      { x: 260, y: 520, w: 200 }, { x: 600, y: 420, w: 220 }, { x: 980, y: 520, w: 200 },
      { x: 1320, y: 400, w: 240 }, { x: 1700, y: 500, w: 220 }, { x: 2080, y: 380, w: 200 },
      { x: 2420, y: 500, w: 240 }, { x: 1000, y: 260, w: 180 },
    ],
    portals: [
      { x: 60, y: 640, to: 'forest', toX: 2670, label: '버섯 숲' },
      { x: 2920, y: 640, to: 'lair', toX: 150, label: '발록의 제단', boss: true },
    ],
    spawns: [{ type: 'golem', n: 4 }, { type: 'wolf', n: 4 }, { type: 'bat', n: 3 }],
  },
  lair: {
    id: 'lair', name: '발록의 제단', w: 2200, groundY: 640, theme: 'lava', boss: 'balrog',
    platforms: [
      { x: 300, y: 470, w: 220 }, { x: 900, y: 420, w: 260 }, { x: 1600, y: 470, w: 220 },
    ],
    portals: [{ x: 60, y: 640, to: 'glacier', toX: 2870, label: '얼음 협곡' }],
    spawns: [{ type: 'bat', n: 3 }],
  },
};

/* ---------------- 퀘스트 ---------------- */
const QUESTS = [
  { id: 'q1', name: '말랑한 젤리', desc: '슬라임을 5마리 처치하세요.', kill: 'slime', need: 5, exp: 120, meso: 400 },
  { id: 'q2', name: '숲의 위협', desc: '주황버섯을 8마리 처치하세요.', kill: 'mushroom', need: 8, exp: 500, meso: 1200, reqLv: 6 },
  { id: 'q3', name: '사나운 들개', desc: '들개를 10마리 처치하세요.', kill: 'wolf', need: 10, exp: 1600, meso: 3000, reqLv: 12 },
  { id: 'q4', name: '얼어붙은 수호자', desc: '얼음 골렘을 8마리 처치하세요.', kill: 'golem', need: 8, exp: 4200, meso: 8000, reqLv: 20 },
  { id: 'q5', name: '심연의 군주', desc: '보스 발록을 처치하세요.', kill: 'balrog', need: 1, exp: 15000, meso: 30000, reqLv: 28 },
];
