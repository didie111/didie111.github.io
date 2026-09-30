'use strict';
// ===================================================================
//  StarCraft(1) 스타일 RTS — 게임 데이터
//  수치는 Brood War 원작 값을 기준으로 함(프레임 = Fastest 속도 1/24초)
// ===================================================================
const TILE = 32, MAP_W = 128, MAP_H = 128;
const FPS = 24;
const PLAYER = 0, ENEMY = 1, NEUTRAL = 2;
const MAX_SUPPLY = 200;
const MAX_SELECT = 12;

const TEAM = [
  { main: '#1c5ce8', dark: '#0a2a80', light: '#6f9dff', mm: '#3070ff', name: '파랑' },
  { main: '#e01010', dark: '#780000', light: '#ff7a6a', mm: '#ff2020', name: '빨강' },
  { main: '#b0b0b0', dark: '#555', light: '#eee', mm: '#ccc', name: '중립' },
];

// 공격 타입별 크기 보정 (Brood War)
const DMG_MULT = {
  normal:     { small: 1,   medium: 1,    large: 1 },
  explosive:  { small: 0.5, medium: 0.75, large: 1 },
  concussive: { small: 1,   medium: 0.5,  large: 0.25 },
  spell:      { small: 1,   medium: 1,    large: 1 },
};

const RACE_NAME = { T: '테란', Z: '저그', P: '프로토스' };
const T_ = 32; // tile px for ranges

// w(weapon) helper
function W(dmg, type, cd, range, extra) {
  return Object.assign({ dmg, type, cd, range, inc: 1, hits: 1 }, extra || {});
}

// ---------------------------------------------------------------
// 유닛
// speed: px/frame, sight: tiles, r: 충돌 반경(px), range: px(가장자리 기준)
// ---------------------------------------------------------------
const UNITS = {
  // ======================= TERRAN =======================
  scv: { name: 'SCV', race: 'T', hp: 60, armor: 0, size: 'small', speed: 4.92, sight: 7, r: 8,
    cost: [50, 0], supply: 1, time: 300, worker: true, mech: true, from: 'cc', hotkey: 'S',
    gw: W(5, 'normal', 15, 10, { upg: 'none' }), trans: 1, armorUpg: 't_inf_a' },
  marine: { name: '마린', race: 'T', hp: 40, armor: 0, size: 'small', speed: 4, sight: 7, r: 8,
    cost: [50, 0], supply: 1, time: 360, bio: true, from: 'barracks', hotkey: 'M',
    gw: W(6, 'normal', 15, 4 * T_, { upg: 't_inf_w', fx: 'gun' }), aw: W(6, 'normal', 15, 4 * T_, { upg: 't_inf_w', fx: 'gun' }),
    spells: ['stim'], trans: 1, armorUpg: 't_inf_a' },
  firebat: { name: '파이어뱃', race: 'T', hp: 50, armor: 1, size: 'small', speed: 4, sight: 7, r: 9,
    cost: [50, 25], supply: 1, time: 360, bio: true, from: 'barracks', hotkey: 'F', req: ['academy'],
    gw: W(8, 'concussive', 22, 32, { hits: 2, upg: 't_inf_w', fx: 'flame', splash: [15, 20, 25] }),
    spells: ['stim'], trans: 1, armorUpg: 't_inf_a' },
  medic: { name: '메딕', race: 'T', hp: 60, armor: 1, size: 'small', speed: 4, sight: 9, r: 8,
    cost: [50, 25], supply: 1, time: 450, bio: true, from: 'barracks', hotkey: 'C', req: ['academy'],
    energy: 200, spells: ['heal', 'restoration'], trans: 1, armorUpg: 't_inf_a', healer: true },
  ghost: { name: '고스트', race: 'T', hp: 45, armor: 0, size: 'small', speed: 4, sight: 9, r: 8,
    cost: [25, 75], supply: 1, time: 750, bio: true, from: 'barracks', hotkey: 'G', req: ['academy', 'science_facility'],
    gw: W(10, 'concussive', 22, 7 * T_, { upg: 't_inf_w', fx: 'gun' }), aw: W(10, 'concussive', 22, 7 * T_, { upg: 't_inf_w', fx: 'gun' }),
    energy: 200, spells: ['cloak', 'lockdown'], trans: 1, armorUpg: 't_inf_a' },
  vulture: { name: '벌처', race: 'T', hp: 80, armor: 0, size: 'medium', speed: 6.4, sight: 8, r: 12,
    cost: [75, 0], supply: 2, time: 450, mech: true, from: 'factory', hotkey: 'V',
    gw: W(20, 'concussive', 30, 5 * T_, { inc: 2, upg: 't_veh_w', proj: 'grenade' }),
    spells: ['spider_mine'], mines: 3, trans: 2, armorUpg: 't_veh_a' },
  tank: { name: '시즈 탱크', race: 'T', hp: 150, armor: 1, size: 'large', speed: 4, sight: 10, r: 14,
    cost: [150, 100], supply: 2, time: 750, mech: true, from: 'factory', hotkey: 'T',
    gw: W(30, 'explosive', 37, 7 * T_, { inc: 3, upg: 't_veh_w', proj: 'shell' }),
    spells: ['siege'], trans: 4, armorUpg: 't_veh_a' },
  tank_siege: { name: '시즈 탱크(시즈 모드)', race: 'T', hp: 150, armor: 1, size: 'large', speed: 0, sight: 10, r: 14,
    cost: [150, 100], supply: 2, time: 750, mech: true, hidden: true,
    gw: W(70, 'explosive', 75, 12 * T_, { inc: 5, upg: 't_veh_w', minRange: 2 * T_, proj: 'siege', splash: [10, 25, 40], friendly: true }),
    spells: ['unsiege'], trans: 4, armorUpg: 't_veh_a' },
  goliath: { name: '골리앗', race: 'T', hp: 125, armor: 1, size: 'large', speed: 4.57, sight: 8, r: 12,
    cost: [100, 50], supply: 2, time: 600, mech: true, from: 'factory', hotkey: 'G', req: ['armory'],
    gw: W(12, 'normal', 22, 6 * T_, { upg: 't_veh_w', fx: 'gun' }), aw: W(10, 'explosive', 22, 5 * T_, { hits: 2, inc: 2, upg: 't_veh_w', proj: 'missile' }),
    trans: 4, armorUpg: 't_veh_a' },
  wraith: { name: '레이스', race: 'T', hp: 120, armor: 0, size: 'large', air: true, speed: 6.67, sight: 7, r: 12,
    cost: [150, 100], supply: 2, time: 900, mech: true, from: 'starport', hotkey: 'W',
    gw: W(8, 'normal', 30, 5 * T_, { upg: 't_shp_w', proj: 'laser' }), aw: W(20, 'explosive', 22, 5 * T_, { inc: 2, upg: 't_shp_w', proj: 'missile' }),
    energy: 200, spells: ['cloak'], armorUpg: 't_shp_a' },
  dropship: { name: '드랍십', race: 'T', hp: 150, armor: 1, size: 'large', air: true, speed: 5.47, sight: 8, r: 14,
    cost: [100, 100], supply: 2, time: 750, mech: true, from: 'starport', hotkey: 'D', cargo: 8, armorUpg: 't_shp_a' },
  vessel: { name: '사이언스 베슬', race: 'T', hp: 200, armor: 1, size: 'large', air: true, speed: 5, sight: 10, r: 16,
    cost: [100, 225], supply: 2, time: 1200, mech: true, from: 'starport', hotkey: 'V', req: ['science_facility'],
    detector: true, energy: 200, spells: ['defensive_matrix', 'emp', 'irradiate'], armorUpg: 't_shp_a' },
  bc: { name: '배틀크루저', race: 'T', hp: 500, armor: 3, size: 'large', air: true, speed: 2.5, sight: 11, r: 22,
    cost: [400, 300], supply: 6, time: 2000, mech: true, from: 'starport', hotkey: 'B', req: ['science_facility'],
    gw: W(25, 'normal', 30, 6 * T_, { inc: 3, upg: 't_shp_w', fx: 'laser' }), aw: W(25, 'normal', 30, 6 * T_, { inc: 3, upg: 't_shp_w', fx: 'laser' }),
    energy: 200, spells: ['yamato'], armorUpg: 't_shp_a' },
  spider_mine: { name: '스파이더 마인', race: 'T', hp: 20, armor: 0, size: 'small', speed: 6, sight: 3, r: 6,
    cost: [0, 0], supply: 0, time: 0, mech: true, hidden: true, mine: true, noSelect: false,
    gw: W(125, 'explosive', 1, 4, { splash: [50, 75, 100], friendly: true }), armorUpg: 'none' },

  // ======================= ZERG =======================
  larva: { name: '라바', race: 'Z', hp: 25, armor: 10, size: 'small', speed: 0.5, sight: 4, r: 6,
    cost: [0, 0], supply: 0, time: 0, bio: true, hidden: true, larva: true, armorUpg: 'none' },
  egg: { name: '에그', race: 'Z', hp: 200, armor: 10, size: 'medium', speed: 0, sight: 4, r: 10,
    cost: [0, 0], supply: 0, time: 0, bio: true, hidden: true, egg: true, armorUpg: 'none' },
  drone: { name: '드론', race: 'Z', hp: 40, armor: 0, size: 'small', speed: 4.92, sight: 7, r: 8,
    cost: [50, 0], supply: 1, time: 300, worker: true, bio: true, from: 'larva', hotkey: 'D',
    gw: W(5, 'normal', 22, 32, { upg: 'none', proj: 'spit' }), spells: ['burrow'], trans: 1, armorUpg: 'z_car' },
  zergling: { name: '저글링', race: 'Z', hp: 35, armor: 0, size: 'small', speed: 5.57, sight: 5, r: 7,
    cost: [50, 0], supply: 0.5, time: 420, pair: true, bio: true, from: 'larva', hotkey: 'Z', req: ['pool'],
    gw: W(5, 'normal', 8, 15, { upg: 'z_mel' }), spells: ['burrow'], trans: 1, armorUpg: 'z_car' },
  hydra: { name: '히드라리스크', race: 'Z', hp: 80, armor: 0, size: 'medium', speed: 3.66, sight: 6, r: 10,
    cost: [75, 25], supply: 1, time: 420, bio: true, from: 'larva', hotkey: 'H', req: ['hydra_den'],
    gw: W(10, 'explosive', 15, 4 * T_, { upg: 'z_mis', proj: 'spine' }), aw: W(10, 'explosive', 15, 4 * T_, { upg: 'z_mis', proj: 'spine' }),
    spells: ['burrow', 'lurker_morph'], trans: 2, armorUpg: 'z_car' },
  lurker: { name: '럴커', race: 'Z', hp: 125, armor: 1, size: 'medium', speed: 5.8, sight: 8, r: 12,
    cost: [125, 125], supply: 2, time: 600, bio: true, hidden: true, burrowAttack: true,
    gw: W(20, 'normal', 37, 6 * T_, { inc: 2, upg: 'z_mis', line: true }), spells: ['burrow'], trans: 4, armorUpg: 'z_car' },
  lurker_egg: { name: '럴커 에그', race: 'Z', hp: 200, armor: 10, size: 'medium', speed: 0, sight: 4, r: 10,
    cost: [0, 0], supply: 0, time: 0, bio: true, hidden: true, egg: true, armorUpg: 'none' },
  overlord: { name: '오버로드', race: 'Z', hp: 200, armor: 0, size: 'large', air: true, speed: 0.83, sight: 11, r: 18,
    cost: [100, 0], supply: 0, provides: 8, time: 600, bio: true, from: 'larva', hotkey: 'O', detector: true,
    cargoTech: 'ventral', cargo: 8, armorUpg: 'z_fcar' },
  mutalisk: { name: '뮤탈리스크', race: 'Z', hp: 120, armor: 0, size: 'small', air: true, speed: 6.67, sight: 7, r: 12,
    cost: [100, 100], supply: 2, time: 600, bio: true, from: 'larva', hotkey: 'M', req: ['spire'],
    gw: W(9, 'normal', 30, 3 * T_, { upg: 'z_fat', proj: 'glaive', bounce: 3 }), aw: W(9, 'normal', 30, 3 * T_, { upg: 'z_fat', proj: 'glaive', bounce: 3 }),
    armorUpg: 'z_fcar' },
  scourge: { name: '스커지', race: 'Z', hp: 25, armor: 0, size: 'small', air: true, speed: 6.67, sight: 5, r: 7,
    cost: [25, 75], supply: 0.5, time: 450, pair: true, bio: true, from: 'larva', hotkey: 'S', req: ['spire'],
    aw: W(110, 'normal', 1, 3, { upg: 'none', suicide: true }), armorUpg: 'z_fcar' },
  ultralisk: { name: '울트라리스크', race: 'Z', hp: 400, armor: 1, size: 'large', speed: 5.1, sight: 7, r: 18,
    cost: [200, 200], supply: 4, time: 900, bio: true, from: 'larva', hotkey: 'U', req: ['ultra_cavern'],
    gw: W(20, 'normal', 15, 25, { inc: 3, upg: 'z_mel' }), trans: 4, armorUpg: 'z_car' },
  defiler: { name: '디파일러', race: 'Z', hp: 80, armor: 1, size: 'medium', speed: 4, sight: 10, r: 10,
    cost: [50, 150], supply: 2, time: 750, bio: true, from: 'larva', hotkey: 'F', req: ['defiler_mound'],
    energy: 200, spells: ['dark_swarm', 'plague', 'consume', 'burrow'], trans: 2, armorUpg: 'z_car' },
  broodling: { name: '브루들링', race: 'Z', hp: 30, armor: 0, size: 'small', speed: 6, sight: 5, r: 6,
    cost: [0, 0], supply: 0, time: 0, bio: true, hidden: true, timed: 1800,
    gw: W(4, 'normal', 15, 10, { upg: 'z_mel' }), armorUpg: 'z_car' },

  // ======================= PROTOSS =======================
  probe: { name: '프로브', race: 'P', hp: 20, sh: 20, armor: 0, size: 'small', speed: 4.92, sight: 8, r: 8,
    cost: [50, 0], supply: 1, time: 300, worker: true, mech: true, from: 'nexus', hotkey: 'P',
    gw: W(5, 'normal', 22, 32, { upg: 'none', proj: 'particle' }), trans: 1, armorUpg: 'p_ga' },
  zealot: { name: '질럿', race: 'P', hp: 100, sh: 60, armor: 1, size: 'small', speed: 4, sight: 7, r: 9,
    cost: [100, 0], supply: 2, time: 600, bio: true, from: 'gateway', hotkey: 'Z',
    gw: W(8, 'normal', 22, 15, { hits: 2, upg: 'p_gw' }), trans: 2, armorUpg: 'p_ga' },
  dragoon: { name: '드라군', race: 'P', hp: 100, sh: 80, armor: 1, size: 'large', speed: 5, sight: 8, r: 14,
    cost: [125, 50], supply: 2, time: 750, mech: true, from: 'gateway', hotkey: 'D', req: ['cyber'],
    gw: W(20, 'explosive', 30, 4 * T_, { inc: 2, upg: 'p_gw', proj: 'plasma' }), aw: W(20, 'explosive', 30, 4 * T_, { inc: 2, upg: 'p_gw', proj: 'plasma' }),
    trans: 4, armorUpg: 'p_ga' },
  htemplar: { name: '하이 템플러', race: 'P', hp: 40, sh: 40, armor: 0, size: 'small', speed: 3.2, sight: 7, r: 8,
    cost: [50, 150], supply: 2, time: 750, bio: true, from: 'gateway', hotkey: 'T', req: ['archives'],
    energy: 200, spells: ['storm'], trans: 2, armorUpg: 'p_ga' },
  dtemplar: { name: '다크 템플러', race: 'P', hp: 80, sh: 40, armor: 1, size: 'small', speed: 4.92, sight: 7, r: 9,
    cost: [125, 100], supply: 2, time: 750, bio: true, from: 'gateway', hotkey: 'K', req: ['archives'], permCloak: true,
    gw: W(40, 'normal', 30, 15, { inc: 3, upg: 'p_gw' }), trans: 2, armorUpg: 'p_ga' },
  shuttle: { name: '셔틀', race: 'P', hp: 80, sh: 60, armor: 1, size: 'large', air: true, speed: 4.43, sight: 8, r: 14,
    cost: [200, 0], supply: 2, time: 900, mech: true, from: 'robo', hotkey: 'S', cargo: 8, armorUpg: 'p_aa' },
  observer: { name: '옵저버', race: 'P', hp: 40, sh: 20, armor: 0, size: 'small', air: true, speed: 3.33, sight: 9, r: 8,
    cost: [25, 75], supply: 1, time: 600, mech: true, from: 'robo', hotkey: 'O', detector: true, permCloak: true, armorUpg: 'p_aa' },
  scout: { name: '스카웃', race: 'P', hp: 150, sh: 100, armor: 0, size: 'large', air: true, speed: 5, sight: 8, r: 14,
    cost: [275, 125], supply: 3, time: 1200, mech: true, from: 'stargate', hotkey: 'S',
    gw: W(8, 'normal', 30, 4 * T_, { upg: 'p_aw', fx: 'laser' }), aw: W(14, 'explosive', 22, 4 * T_, { hits: 2, upg: 'p_aw', proj: 'missile' }),
    armorUpg: 'p_aa' },
  corsair: { name: '커세어', race: 'P', hp: 100, sh: 80, armor: 1, size: 'medium', air: true, speed: 6.67, sight: 9, r: 12,
    cost: [150, 100], supply: 2, time: 600, mech: true, from: 'stargate', hotkey: 'C',
    aw: W(5, 'explosive', 8, 5 * T_, { upg: 'p_aw', proj: 'neutron', splash: [5, 50, 100] }), armorUpg: 'p_aa' },
  carrier: { name: '캐리어', race: 'P', hp: 300, sh: 150, armor: 4, size: 'large', air: true, speed: 3.33, sight: 11, r: 24,
    cost: [350, 250], supply: 6, time: 2100, mech: true, from: 'stargate', hotkey: 'A', req: ['fleet_beacon'],
    gw: W(6, 'normal', 30, 8 * T_, { hits: 8, upg: 'p_aw', proj: 'interceptor' }), aw: W(6, 'normal', 30, 8 * T_, { hits: 8, upg: 'p_aw', proj: 'interceptor' }),
    armorUpg: 'p_aa' },
};

// ---------------------------------------------------------------
// 건물  (w,h: 타일)
// ---------------------------------------------------------------
const BUILDINGS = {
  // ---------- TERRAN ----------
  cc: { name: '커맨드 센터', race: 'T', hp: 1500, armor: 1, w: 4, h: 3, cost: [400, 0], time: 1800, provides: 10,
    townHall: true, produces: ['scv'], research: [], spells: ['scan', 'lift'], hotkey: 'C', canLift: true, sight: 10, tier: 0 },
  depot: { name: '서플라이 디팟', race: 'T', hp: 500, armor: 1, w: 3, h: 2, cost: [100, 0], time: 600, provides: 8, hotkey: 'S', sight: 8 },
  refinery: { name: '리파이너리', race: 'T', hp: 750, armor: 1, w: 4, h: 2, cost: [100, 0], time: 600, onGeyser: true, hotkey: 'R', sight: 8 },
  barracks: { name: '배럭', race: 'T', hp: 1000, armor: 1, w: 4, h: 3, cost: [150, 0], time: 1200, req: ['cc'],
    produces: ['marine', 'firebat', 'medic', 'ghost'], hotkey: 'B', canLift: true, spells: ['lift'], sight: 8 },
  ebay: { name: '엔지니어링 베이', race: 'T', hp: 850, armor: 1, w: 4, h: 3, cost: [125, 0], time: 900, req: ['cc'],
    research: ['t_inf_w', 't_inf_a'], hotkey: 'E', sight: 8 },
  bunker: { name: '벙커', race: 'T', hp: 350, armor: 1, w: 3, h: 2, cost: [100, 0], time: 450, req: ['barracks'], hotkey: 'U',
    cargo: 4, bunker: true, sight: 10 },
  turret: { name: '미사일 터렛', race: 'T', hp: 200, armor: 0, w: 2, h: 2, cost: [75, 0], time: 450, req: ['ebay'], hotkey: 'T',
    detector: true, aw: W(20, 'explosive', 15, 7 * T_, { upg: 'none', proj: 'missile' }), sight: 11 },
  academy: { name: '아카데미', race: 'T', hp: 600, armor: 1, w: 3, h: 2, cost: [150, 0], time: 1200, req: ['barracks'],
    research: ['stim', 'u238', 'restoration_t'], hotkey: 'A', sight: 8 },
  factory: { name: '팩토리', race: 'T', hp: 1250, armor: 1, w: 4, h: 3, cost: [200, 100], time: 1200, req: ['barracks'],
    produces: ['vulture', 'tank', 'goliath'], research: ['siege_tech', 'mines', 'ion'], hotkey: 'F', canLift: true, spells: ['lift'], adv: true, sight: 8 },
  starport: { name: '스타포트', race: 'T', hp: 1300, armor: 1, w: 4, h: 3, cost: [150, 100], time: 1050, req: ['factory'],
    produces: ['wraith', 'dropship', 'vessel', 'bc'], research: ['cloak_w'], hotkey: 'S', canLift: true, spells: ['lift'], adv: true, sight: 8 },
  armory: { name: '아머리', race: 'T', hp: 750, armor: 1, w: 3, h: 2, cost: [100, 50], time: 1200, req: ['factory'],
    research: ['t_veh_w', 't_veh_a', 't_shp_w', 't_shp_a'], hotkey: 'A', adv: true, sight: 8 },
  science_facility: { name: '사이언스 퍼실리티', race: 'T', hp: 850, armor: 1, w: 4, h: 3, cost: [100, 150], time: 900, req: ['starport'],
    research: ['irradiate', 'emp_t', 'yamato', 'lockdown_t', 'cloak_g'], hotkey: 'I', adv: true, sight: 8, tier: 2 },

  // ---------- ZERG ----------
  hatchery: { name: '해처리', race: 'Z', hp: 1250, armor: 1, w: 4, h: 3, cost: [300, 0], time: 1800, provides: 1,
    townHall: true, larvaHall: true, research: ['burrow_t'], spells: ['select_larva', 'morph_lair'], hotkey: 'H', noCreepNeeded: true, sight: 9, tier: 0 },
  lair: { name: '레어', race: 'Z', hp: 1800, armor: 1, w: 4, h: 3, cost: [150, 100], time: 1500, provides: 1, hidden: true,
    townHall: true, larvaHall: true, research: ['burrow_t', 'ventral', 'pneumatized'], spells: ['select_larva', 'morph_hive'], sight: 10, tier: 1, counts: ['hatchery'] },
  hive: { name: '하이브', race: 'Z', hp: 2500, armor: 1, w: 4, h: 3, cost: [200, 150], time: 1800, provides: 1, hidden: true,
    townHall: true, larvaHall: true, research: ['burrow_t', 'ventral', 'pneumatized'], spells: ['select_larva'], sight: 11, tier: 2, counts: ['hatchery', 'lair'] },
  extractor: { name: '익스트랙터', race: 'Z', hp: 750, armor: 1, w: 4, h: 2, cost: [50, 0], time: 600, onGeyser: true, hotkey: 'E', noCreepNeeded: true, sight: 7 },
  pool: { name: '스포닝 풀', race: 'Z', hp: 750, armor: 1, w: 3, h: 2, cost: [200, 0], time: 1200, req: ['hatchery'],
    research: ['metabolic'], hotkey: 'S', sight: 8 },
  hydra_den: { name: '히드라리스크 덴', race: 'Z', hp: 850, armor: 1, w: 3, h: 2, cost: [100, 50], time: 600, req: ['pool'],
    research: ['muscular', 'grooved', 'lurker_aspect'], hotkey: 'D', sight: 8 },
  evo: { name: '에볼루션 챔버', race: 'Z', hp: 750, armor: 1, w: 3, h: 2, cost: [75, 0], time: 600, req: ['hatchery'],
    research: ['z_mel', 'z_mis', 'z_car'], hotkey: 'V', sight: 8 },
  creep_colony: { name: '크립 콜로니', race: 'Z', hp: 400, armor: 0, w: 2, h: 2, cost: [75, 0], time: 300, req: ['hatchery'],
    spells: ['morph_sunken', 'morph_spore'], hotkey: 'C', creepSource: true, sight: 10 },
  sunken: { name: '성큰 콜로니', race: 'Z', hp: 300, armor: 2, w: 2, h: 2, cost: [50, 0], time: 300, hidden: true, creepSource: true,
    gw: W(40, 'explosive', 32, 7 * T_, { upg: 'none', proj: 'tentacle' }), sight: 10 },
  spore: { name: '스포어 콜로니', race: 'Z', hp: 400, armor: 0, w: 2, h: 2, cost: [50, 0], time: 300, hidden: true, creepSource: true, detector: true,
    aw: W(15, 'normal', 15, 7 * T_, { upg: 'none', proj: 'spore' }), sight: 10 },
  spire: { name: '스파이어', race: 'Z', hp: 600, armor: 1, w: 2, h: 2, cost: [200, 150], time: 1800, req: ['lair'],
    research: ['z_fat', 'z_fcar'], hotkey: 'S', adv: true, sight: 8 },
  ultra_cavern: { name: '울트라리스크 캐번', race: 'Z', hp: 600, armor: 1, w: 3, h: 2, cost: [150, 200], time: 1200, req: ['hive'],
    research: ['chitinous', 'anabolic'], hotkey: 'U', adv: true, sight: 8 },
  defiler_mound: { name: '디파일러 마운드', race: 'Z', hp: 850, armor: 1, w: 4, h: 2, cost: [100, 100], time: 900, req: ['hive'],
    research: ['plague_t', 'consume_t'], hotkey: 'F', adv: true, sight: 8 },

  // ---------- PROTOSS ----------
  nexus: { name: '넥서스', race: 'P', hp: 750, sh: 750, armor: 1, w: 4, h: 3, cost: [400, 0], time: 1800, provides: 9,
    townHall: true, produces: ['probe'], hotkey: 'N', noPower: true, sight: 11, tier: 0 },
  pylon: { name: '파일런', race: 'P', hp: 300, sh: 300, armor: 0, w: 2, h: 2, cost: [100, 0], time: 450, provides: 8, hotkey: 'P', noPower: true, pylon: true, sight: 8 },
  assimilator: { name: '어시밀레이터', race: 'P', hp: 450, sh: 450, armor: 1, w: 4, h: 2, cost: [100, 0], time: 600, onGeyser: true, hotkey: 'A', noPower: true, sight: 8 },
  gateway: { name: '게이트웨이', race: 'P', hp: 500, sh: 500, armor: 1, w: 4, h: 3, cost: [150, 0], time: 900, req: ['nexus'],
    produces: ['zealot', 'dragoon', 'htemplar', 'dtemplar'], hotkey: 'G', sight: 8 },
  forge: { name: '포지', race: 'P', hp: 550, sh: 550, armor: 1, w: 3, h: 2, cost: [150, 0], time: 600, req: ['nexus'],
    research: ['p_gw', 'p_ga', 'p_sh'], hotkey: 'F', sight: 8 },
  cannon: { name: '포톤 캐논', race: 'P', hp: 100, sh: 100, armor: 0, w: 2, h: 2, cost: [150, 0], time: 750, req: ['forge'], hotkey: 'C',
    detector: true, gw: W(20, 'normal', 22, 7 * T_, { upg: 'none', proj: 'plasma' }), aw: W(20, 'normal', 22, 7 * T_, { upg: 'none', proj: 'plasma' }), sight: 11 },
  cyber: { name: '사이버네틱스 코어', race: 'P', hp: 500, sh: 500, armor: 1, w: 3, h: 2, cost: [200, 0], time: 900, req: ['gateway'],
    research: ['singularity', 'p_aw', 'p_aa'], hotkey: 'Y', sight: 8 },
  robo: { name: '로보틱스 퍼실리티', race: 'P', hp: 500, sh: 500, armor: 1, w: 3, h: 2, cost: [200, 200], time: 1200, req: ['cyber'],
    produces: ['shuttle', 'observer'], hotkey: 'R', adv: true, sight: 8 },
  stargate: { name: '스타게이트', race: 'P', hp: 600, sh: 600, armor: 1, w: 4, h: 3, cost: [150, 150], time: 1050, req: ['cyber'],
    produces: ['scout', 'corsair', 'carrier'], hotkey: 'S', adv: true, sight: 8 },
  citadel: { name: '시타델 오브 아둔', race: 'P', hp: 450, sh: 450, armor: 1, w: 3, h: 2, cost: [150, 100], time: 900, req: ['cyber'],
    research: ['legs'], hotkey: 'C', adv: true, sight: 8 },
  archives: { name: '템플러 아카이브', race: 'P', hp: 500, sh: 500, armor: 1, w: 3, h: 2, cost: [150, 200], time: 900, req: ['citadel'],
    research: ['storm_t'], hotkey: 'T', adv: true, sight: 8, tier: 2 },
  fleet_beacon: { name: '플릿 비콘', race: 'P', hp: 500, sh: 500, armor: 1, w: 3, h: 2, cost: [300, 200], time: 900, req: ['stargate'],
    research: [], hotkey: 'F', adv: true, sight: 8 },

  // ---------- NEUTRAL ----------
  mineral: { name: '미네랄 필드', race: 'N', hp: 1, armor: 0, w: 2, h: 1, cost: [0, 0], time: 0, resource: 'min', hidden: true, sight: 0 },
  geyser: { name: '베스핀 가스', race: 'N', hp: 1, armor: 0, w: 4, h: 2, cost: [0, 0], time: 0, resource: 'gas', hidden: true, sight: 0 },
};

// 빌드 메뉴 (일꾼) — [기본, 고급]
const BUILD_MENU = {
  T: [['cc', 'depot', 'refinery', 'barracks', 'ebay', 'bunker', 'turret', 'academy'], ['factory', 'starport', 'armory', 'science_facility']],
  Z: [['hatchery', 'extractor', 'pool', 'evo', 'creep_colony', 'hydra_den'], ['spire', 'ultra_cavern', 'defiler_mound']],
  P: [['nexus', 'pylon', 'assimilator', 'gateway', 'forge', 'cannon', 'cyber'], ['robo', 'stargate', 'citadel', 'archives', 'fleet_beacon']],
};
// 빌드 메뉴 단축키 (원작 기준)
const BUILD_KEYS = {
  cc: 'C', depot: 'S', refinery: 'R', barracks: 'B', ebay: 'E', bunker: 'U', turret: 'T', academy: 'A',
  factory: 'F', starport: 'S', armory: 'A', science_facility: 'I',
  hatchery: 'H', extractor: 'E', pool: 'S', evo: 'V', creep_colony: 'C', hydra_den: 'D',
  spire: 'S', ultra_cavern: 'U', defiler_mound: 'F',
  nexus: 'N', pylon: 'P', assimilator: 'A', gateway: 'G', forge: 'F', cannon: 'C', cyber: 'Y',
  robo: 'R', stargate: 'S', citadel: 'C', archives: 'T', fleet_beacon: 'F',
};

// ---------------------------------------------------------------
// 연구 / 업그레이드
// lv: 최대 레벨(업그레이드), req: 요구 건물 (레벨별 배열 가능)
// ---------------------------------------------------------------
const TECH = {
  // Terran
  stim:        { name: '스팀팩', cost: [100, 100], time: 1200, hotkey: 'T', desc: '마린/파이어뱃 스팀팩 사용 가능' },
  u238:        { name: 'U-238 탄환', cost: [150, 150], time: 1500, hotkey: 'U', desc: '마린 사거리 +1' },
  restoration_t: { name: '리스토레이션', cost: [100, 100], time: 1200, hotkey: 'R', desc: '메딕 리스토레이션 사용 가능' },
  siege_tech:  { name: '시즈 모드', cost: [150, 150], time: 1200, hotkey: 'S', desc: '시즈 탱크 시즈 모드' },
  mines:       { name: '스파이더 마인', cost: [100, 100], time: 1200, hotkey: 'I', desc: '벌처 스파이더 마인 3개' },
  ion:         { name: '이온 추진기', cost: [100, 100], time: 1500, hotkey: 'T', desc: '벌처 이동속도 증가' },
  cloak_w:     { name: '클로킹 필드', cost: [150, 150], time: 1500, hotkey: 'C', desc: '레이스 클로킹' },
  irradiate:   { name: '이레디에이트', cost: [200, 200], time: 1200, hotkey: 'I', desc: '사이언스 베슬 이레디에이트' },
  emp_t:       { name: 'EMP 충격파', cost: [200, 200], time: 1800, hotkey: 'E', desc: '사이언스 베슬 EMP' },
  yamato:      { name: '야마토 포', cost: [100, 100], time: 1800, hotkey: 'Y', desc: '배틀크루저 야마토 포' },
  lockdown_t:  { name: '락다운', cost: [200, 200], time: 1500, hotkey: 'L', desc: '고스트 락다운' },
  cloak_g:     { name: '고스트 클로킹', cost: [100, 100], time: 1200, hotkey: 'C', desc: '고스트 개인 클로킹' },
  t_inf_w: { name: '보병 무기', cost: [100, 100], inc: [75, 75], time: 4000, lv: 3, hotkey: 'W', req: [null, 'science_facility', 'science_facility'], desc: '보병 공격력 +1' },
  t_inf_a: { name: '보병 방어력', cost: [100, 100], inc: [75, 75], time: 4000, lv: 3, hotkey: 'A', req: [null, 'science_facility', 'science_facility'], desc: '보병 방어력 +1' },
  t_veh_w: { name: '차량 무기', cost: [100, 100], inc: [75, 75], time: 4000, lv: 3, hotkey: 'V', req: [null, 'science_facility', 'science_facility'], desc: '차량 공격력 증가' },
  t_veh_a: { name: '차량 장갑', cost: [100, 100], inc: [75, 75], time: 4000, lv: 3, hotkey: 'P', req: [null, 'science_facility', 'science_facility'], desc: '차량 방어력 +1' },
  t_shp_w: { name: '함선 무기', cost: [100, 100], inc: [50, 50], time: 4000, lv: 3, hotkey: 'S', req: [null, 'science_facility', 'science_facility'], desc: '함선 공격력 증가' },
  t_shp_a: { name: '함선 장갑', cost: [150, 150], inc: [75, 75], time: 4000, lv: 3, hotkey: 'H', req: [null, 'science_facility', 'science_facility'], desc: '함선 방어력 +1' },
  // Zerg
  burrow_t:    { name: '버로우', cost: [100, 100], time: 1200, hotkey: 'B', desc: '저그 지상 유닛 버로우' },
  metabolic:   { name: '대사 촉진', cost: [100, 100], time: 1500, hotkey: 'M', desc: '저글링 이동속도 증가' },
  muscular:    { name: '근육 강화', cost: [150, 150], time: 1500, hotkey: 'M', desc: '히드라 이동속도 증가' },
  grooved:     { name: '가시 연마', cost: [150, 150], time: 1500, hotkey: 'G', desc: '히드라 사거리 +1' },
  lurker_aspect: { name: '럴커 변태', cost: [200, 200], time: 1800, hotkey: 'L', req: ['lair'], desc: '히드라 → 럴커 변태 가능' },
  ventral:     { name: '복부 주머니', cost: [200, 200], time: 2400, hotkey: 'V', desc: '오버로드 수송' },
  pneumatized: { name: '기낭 갑피', cost: [150, 150], time: 2000, hotkey: 'P', desc: '오버로드 이동속도 증가' },
  chitinous:   { name: '키틴질 도금', cost: [150, 150], time: 2000, hotkey: 'C', desc: '울트라 방어력 +2' },
  anabolic:    { name: '동화 작용', cost: [200, 200], time: 2000, hotkey: 'A', desc: '울트라 이동속도 증가' },
  plague_t:    { name: '플레이그', cost: [200, 200], time: 1500, hotkey: 'P', desc: '디파일러 플레이그' },
  consume_t:   { name: '컨슘', cost: [100, 100], time: 1500, hotkey: 'C', desc: '디파일러 컨슘' },
  z_mel: { name: '근접 공격', cost: [100, 100], inc: [50, 50], time: 4000, lv: 3, hotkey: 'M', req: [null, 'lair', 'hive'], desc: '근접 공격력 +1' },
  z_mis: { name: '원거리 공격', cost: [100, 100], inc: [50, 50], time: 4000, lv: 3, hotkey: 'A', req: [null, 'lair', 'hive'], desc: '원거리 공격력 +1' },
  z_car: { name: '지상 갑피', cost: [150, 150], inc: [75, 75], time: 4000, lv: 3, hotkey: 'C', req: [null, 'lair', 'hive'], desc: '지상 방어력 +1' },
  z_fat: { name: '비행 공격', cost: [100, 100], inc: [75, 75], time: 4000, lv: 3, hotkey: 'A', req: [null, 'lair', 'hive'], desc: '비행 공격력 +1' },
  z_fcar: { name: '비행 갑피', cost: [150, 150], inc: [75, 75], time: 4000, lv: 3, hotkey: 'C', req: [null, 'lair', 'hive'], desc: '비행 방어력 +1' },
  // Protoss
  singularity: { name: '특이점 충전', cost: [150, 150], time: 2500, hotkey: 'S', desc: '드라군 사거리 +2' },
  legs:        { name: '다리 강화', cost: [150, 150], time: 2000, hotkey: 'L', desc: '질럿 이동속도 증가' },
  storm_t:     { name: '사이오닉 스톰', cost: [200, 200], time: 1800, hotkey: 'P', desc: '하이 템플러 사이오닉 스톰' },
  p_gw: { name: '지상 무기', cost: [100, 100], inc: [50, 50], time: 4000, lv: 3, hotkey: 'W', req: [null, 'archives', 'archives'], desc: '지상 공격력 증가' },
  p_ga: { name: '지상 방어구', cost: [100, 100], inc: [100, 100], time: 4000, lv: 3, hotkey: 'A', req: [null, 'archives', 'archives'], desc: '지상 방어력 +1' },
  p_sh: { name: '보호막', cost: [200, 200], inc: [100, 100], time: 4000, lv: 3, hotkey: 'S', req: [null, 'archives', 'archives'], desc: '보호막 방어력 +1' },
  p_aw: { name: '공중 무기', cost: [100, 100], inc: [75, 75], time: 4000, lv: 3, hotkey: 'W', req: [null, 'fleet_beacon', 'fleet_beacon'], desc: '공중 공격력 증가' },
  p_aa: { name: '공중 장갑', cost: [150, 150], inc: [75, 75], time: 4000, lv: 3, hotkey: 'A', req: [null, 'fleet_beacon', 'fleet_beacon'], desc: '공중 방어력 +1' },
};

// ---------------------------------------------------------------
// 특수 능력 (유닛/건물 커맨드)
// target: 'none' | 'point' | 'unit'
// ---------------------------------------------------------------
const SPELLS = {
  stim:        { name: '스팀팩', hotkey: 'T', target: 'none', tech: 'stim', hpCost: 10, desc: '체력 10 소모, 공격/이동 속도 증가' },
  heal:        { name: '힐', hotkey: 'A', target: 'unit', auto: true, desc: '아군 생체 유닛 치료 (자동)' },
  restoration: { name: '리스토레이션', hotkey: 'R', target: 'unit', energy: 50, tech: 'restoration_t', range: 6, desc: '해로운 효과 제거' },
  cloak:       { name: '클로킹', hotkey: 'C', target: 'none', energy: 25, techBy: { ghost: 'cloak_g', wraith: 'cloak_w' }, toggle: true, desc: '투명화 (에너지 지속 소모)' },
  lockdown:    { name: '락다운', hotkey: 'D', target: 'unit', energy: 100, tech: 'lockdown_t', range: 8, desc: '기계 유닛 정지' },
  spider_mine: { name: '스파이더 마인', hotkey: 'I', target: 'point', tech: 'mines', range: 1, desc: '스파이더 마인 매설' },
  siege:       { name: '시즈 모드', hotkey: 'O', target: 'none', tech: 'siege_tech', desc: '시즈 모드 전환' },
  unsiege:     { name: '퉁퉁포 모드', hotkey: 'O', target: 'none', desc: '탱크 모드 전환' },
  defensive_matrix: { name: '디펜시브 매트릭스', hotkey: 'D', target: 'unit', energy: 100, range: 10, desc: '피해 250 흡수 보호막' },
  emp:         { name: 'EMP 충격파', hotkey: 'E', target: 'point', energy: 100, tech: 'emp_t', range: 8, desc: '보호막/에너지 제거' },
  irradiate:   { name: '이레디에이트', hotkey: 'I', target: 'unit', energy: 75, tech: 'irradiate', range: 9, desc: '생체 유닛 방사능 피해' },
  yamato:      { name: '야마토 포', hotkey: 'Y', target: 'unit', energy: 150, tech: 'yamato', range: 10, desc: '260 피해' },
  scan:        { name: '스캐너 스윕', hotkey: 'S', target: 'point', energy: 50, range: 9999, req: ['academy'], desc: '지역 시야 + 탐지' },
  lift:        { name: '이륙', hotkey: 'L', target: 'none', desc: '건물 이륙' },
  land:        { name: '착륙', hotkey: 'L', target: 'land', desc: '건물 착륙' },
  burrow:      { name: '버로우', hotkey: 'U', target: 'none', tech: 'burrow_t', desc: '땅속으로 숨기', techFree: ['lurker'] },
  unburrow:    { name: '언버로우', hotkey: 'U', target: 'none', desc: '땅 위로' },
  lurker_morph:{ name: '럴커 변태', hotkey: 'L', target: 'none', tech: 'lurker_aspect', cost: [50, 100], desc: '럴커로 변태' },
  dark_swarm:  { name: '다크 스웜', hotkey: 'W', target: 'point', energy: 100, range: 9, desc: '원거리 공격 차단' },
  plague:      { name: '플레이그', hotkey: 'G', target: 'point', energy: 150, tech: 'plague_t', range: 9, desc: '지속 피해 300' },
  consume:     { name: '컨슘', hotkey: 'C', target: 'unit', tech: 'consume_t', range: 1, desc: '아군 저그 유닛 흡수, 에너지 +50' },
  storm:       { name: '사이오닉 스톰', hotkey: 'T', target: 'point', energy: 75, tech: 'storm_t', range: 9, desc: '광역 112 피해' },
  select_larva:{ name: '라바 선택', hotkey: 'S', target: 'none', desc: '라바 선택' },
  morph_lair:  { name: '레어 변태', hotkey: 'L', target: 'none', morph: 'lair', req: ['pool'], desc: '레어로 변태' },
  morph_hive:  { name: '하이브 변태', hotkey: 'H', target: 'none', morph: 'hive', req: ['lair'], desc: '하이브로 변태 (퀸즈네스트 생략)' },
  morph_sunken:{ name: '성큰 콜로니', hotkey: 'U', target: 'none', morph: 'sunken', req: ['pool'], desc: '성큰 콜로니 변태 (대지상)' },
  morph_spore: { name: '스포어 콜로니', hotkey: 'S', target: 'none', morph: 'spore', req: ['evo'], desc: '스포어 콜로니 변태 (대공/탐지)' },
};

// 공용 커맨드 버튼
const CMD = {
  move:   { name: '이동', hotkey: 'M', target: 'point' },
  stop:   { name: '정지', hotkey: 'S', target: 'none' },
  attack: { name: '공격', hotkey: 'A', target: 'point' },
  patrol: { name: '정찰', hotkey: 'P', target: 'point' },
  hold:   { name: '위치 사수', hotkey: 'H', target: 'none' },
  gather: { name: '자원 채취', hotkey: 'G', target: 'unit' },
  ret:    { name: '자원 반환', hotkey: 'C', target: 'none' },
  build:  { name: '기본 건물', hotkey: 'B', target: 'menu' },
  advbuild: { name: '고급 건물', hotkey: 'V', target: 'menu' },
  repair: { name: '수리', hotkey: 'R', target: 'unit' },
  load:   { name: '태우기', hotkey: 'L', target: 'unit' },
  unload: { name: '모두 내리기', hotkey: 'U', target: 'point' },
  cancel: { name: '취소', hotkey: 'Escape', target: 'none' },
  rally:  { name: '집결 지점', hotkey: 'R', target: 'point' },
  back:   { name: '뒤로', hotkey: 'Escape', target: 'none' },
};

function typeDef(t) { return UNITS[t] || BUILDINGS[t]; }
function isBuildingType(t) { return !!BUILDINGS[t]; }
function supplyText(v) { return (Math.round(v * 2) / 2).toString(); }
