'use strict';
// 확장 데이터: Blizzard StarCraft Compendium 수치/역할을 참고한 웹게임 구현.
// 원작 MPQ/엔진을 포함하지 않으며 투사체/애니메이션/길찾기는 자체 구현이다.
const RTS_VERSION = '2026.10.04-sc1.29';
// flingy.dat: [acceleration, turn N/256 circle, halt N/256 px, movement control].
// Control 0: acceleration + braking; 1: acceleration without braking; 2: iscript.
// The acceleration field alone does not identify walking units (notably templars).
const GROUND_MOTION = {
  marine: [1, 40, 1, 2],
  ghost: [1, 40, 1, 2],
  vulture: [100, 40, 14569, 0],
  goliath: [1, 17, 1, 2],
  tank: [1, 13, 1, 2],
  scv: [67, 40, 12227, 0],
  firebat: [1, 40, 1, 2],
  medic: [1, 40, 1, 2],
  zergling: [1, 27, 1, 2],
  hydra: [1, 27, 1, 2],
  ultralisk: [1, 40, 1, 2],
  broodling: [1, 27, 1, 2],
  drone: [67, 40, 12227, 0],
  defiler: [1, 27, 1, 2],
  infested_terran: [1, 40, 1, 2],
  dtemplar: [27, 40, 13474, 2],
  dark_archon: [160, 40, 5120, 0],
  probe: [67, 40, 12227, 0],
  zealot: [1, 40, 1, 2],
  dragoon: [1, 40, 1, 2],
  htemplar: [27, 40, 13474, 1],
  archon: [160, 40, 5120, 0],
  reaver: [1, 20, 1, 2],
  lurker: [1, 40, 1, 2],
};
const AIR_MOTION = {
  wraith: [67,40,21745,0], vessel: [50,40,5120,0], dropship: [17,20,37756,0], bc: [27,20,7585,0],
  valkyrie: [65,30,21901,0], overlord: [27,20,840,0], mutalisk: [67,40,21745,0],
  queen: [67,40,21745,0], guardian: [27,20,7585,0], scourge: [107,40,13616,0],
  devourer: [48,30,17067,0], corsair: [67,30,17067,0], shuttle: [17,20,37756,0],
  scout: [48,30,17067,0], arbiter: [33,40,24824,0], carrier: [27,20,13474,0], observer: [27,20,13474,0],
};
const LIFT_MOTION = [33, 27, 2763, 0];
const MINE_MOTION = [1, 127, 1, 2];
const MINE_HOVER_TARGETS = new Set(['vulture','scv','drone','probe','archon','dark_archon','spider_mine']);
Object.assign(UNITS, {
  valkyrie: { name: '발키리', race: 'T', hp: 200, armor: 2, size: 'large', air: true, speed: 6.6, sight: 8, r: 16,
    cost: [250, 125], supply: 3, time: 750, mech: true, from: 'starport', hotkey: 'V', req: ['armory'], addon: 'control_tower',
    aw: W(6, 'explosive', 64, 6 * TILE, { hits: 8, upg: 't_shp_w', proj: 'missile', splash: [5, 50, 100] }), armorUpg: 't_shp_a' },
  queen: { name: '퀸', race: 'Z', hp: 120, armor: 0, size: 'medium', air: true, speed: 6.6, sight: 10, r: 13,
    cost: [100, 100], supply: 2, time: 750, bio: true, from: 'larva', hotkey: 'Q', req: ['queens_nest'], energy: 200,
    spells: ['parasite', 'ensnare', 'spawn_broodlings', 'infest'], armorUpg: 'z_fcar' },
  guardian: { name: '가디언', race: 'Z', hp: 150, armor: 2, size: 'large', air: true, speed: 2.5, sight: 11, r: 18,
    cost: [50, 100], supply: 2, time: 600, bio: true, hidden: true,
    gw: W(20, 'normal', 30, 8 * TILE, { inc: 2, upg: 'z_fat', proj: 'spit' }), armorUpg: 'z_fcar' },
  devourer: { name: '디바우러', race: 'Z', hp: 250, armor: 2, size: 'large', air: true, speed: 4.5, sight: 10, r: 18,
    cost: [150, 50], supply: 2, time: 600, bio: true, hidden: true,
    aw: W(25, 'explosive', 100, 6 * TILE, { inc: 2, upg: 'z_fat', proj: 'spore', acid: true, splash: [16, 32, 48] }), armorUpg: 'z_fcar' },
  infested_terran: { name: '인페스티드 테란', race: 'Z', hp: 60, armor: 0, size: 'small', speed: 4, sight: 5, r: 8,
    cost: [100, 50], supply: 1, time: 600, bio: true, from: 'infested_cc', hotkey: 'I', trans: 1,
    gw: W(500, 'explosive', 1, 4, { upg: 'none', suicide: true, splash: [20, 40, 60], friendly: true }), armorUpg: 'z_car' },
  archon: { name: '아콘', race: 'P', hp: 10, sh: 350, armor: 0, size: 'large', speed: 4.9, sight: 8, r: 15,
    cost: [0, 0], supply: 4, time: 300, hidden: true, trans: 4,
    gw: W(30, 'normal', 20, 2 * TILE, { inc: 3, upg: 'p_gw', fx: 'laser', splash: [3, 15, 30] }),
    aw: W(30, 'normal', 20, 2 * TILE, { inc: 3, upg: 'p_gw', fx: 'laser', splash: [3, 15, 30] }), armorUpg: 'p_ga' },
  dark_archon: { name: '다크 아콘', race: 'P', hp: 25, sh: 200, armor: 1, size: 'large', speed: 4.9, sight: 10, r: 15,
    cost: [0, 0], supply: 4, time: 300, hidden: true, trans: 4, energy: 200,
    spells: ['feedback', 'maelstrom', 'mind_control'], armorUpg: 'p_ga' },
  reaver: { name: '리버', race: 'P', hp: 100, sh: 80, armor: 0, size: 'large', speed: 1.8, sight: 10, r: 17,
    cost: [200, 100], supply: 4, time: 1050, mech: true, from: 'robo', hotkey: 'V', req: ['robo_support'], trans: 4, ammo: 'scarab',
    gw: W(100, 'normal', 60, 8 * TILE, { upg: 'none', proj: 'scarab', splash: [20, 40, 60] }), armorUpg: 'p_ga' },
  arbiter: { name: '아비터', race: 'P', hp: 200, sh: 150, armor: 1, size: 'large', air: true, speed: 4, sight: 9, r: 19,
    cost: [100, 350], supply: 4, time: 2400, mech: true, from: 'stargate', hotkey: 'A', req: ['arbiter_tribunal'], energy: 200,
    gw: W(10, 'explosive', 45, 5 * TILE, { upg: 'p_aw', proj: 'plasma' }), aw: W(10, 'explosive', 45, 5 * TILE, { upg: 'p_aw', proj: 'plasma' }),
    spells: ['recall', 'stasis'], cloakAura: 4 * TILE, armorUpg: 'p_aa' },
});
UNITS.carrier.hotkey = 'C'; UNITS.carrier.ammo = 'interceptor';
// Exact DAT fixed-point speeds for flingy-controlled units. Walking retains mean gait speed.
for (const [type, speed256] of Object.entries({ scv:1280, drone:1280, probe:1280, vulture:1707,
  htemplar:853, archon:1280, dark_archon:1280, wraith:1707, vessel:1280, dropship:1400, bc:640,
  valkyrie:1690, overlord:213, mutalisk:1707, queen:1707, guardian:640, scourge:1707, devourer:1280,
  corsair:1707, shuttle:1133, scout:1280, arbiter:1280, carrier:853, observer:853 })) UNITS[type].speed = speed256 / 256;
UNITS.infested_terran.speed = 5.82; UNITS.ultralisk.speed = 5.12; UNITS.reaver.speed = 1.78; UNITS.lurker.speed = 5.82;
UNITS.spider_mine.speed = 16;
UNITS.broodling.gw.range = 2; UNITS.infested_terran.gw.range = 3;
// Devourer spreads acid spores, not weapon damage, to nearby flyers.
delete UNITS.devourer.aw.splash;
UNITS.valkyrie.aw.airSplash = true; UNITS.corsair.aw.airSplash = true;
UNITS.archon.gw.splashBoth = true; UNITS.archon.aw.splashBoth = true;
UNITS.scout.aw.inc = 1;
UNITS.htemplar.spells.push('archon_merge'); UNITS.dtemplar.spells = ['dark_archon_merge'];
UNITS.mutalisk.spells = ['guardian_morph', 'devourer_morph']; UNITS.corsair.spells = ['disruption_web'];
UNITS.tank.addon = 'machine_shop'; UNITS.dropship.addon = 'control_tower'; UNITS.vessel.addon = 'control_tower'; UNITS.bc.addon = 'control_tower';
UNITS.goliath.req = ['armory']; UNITS.ghost.req = ['academy', 'covert_ops']; UNITS.bc.req = ['physics_lab'];
Object.assign(BUILDINGS, {
  comsat: { name: '컴샛 스테이션', race: 'T', hp: 500, armor: 1, w: 2, h: 2, cost: [50, 50], time: 600, req: ['academy'], addonOf: 'cc', energy: 200, spells: ['scan'], sight: 10 },
  machine_shop: { name: '머신 샵', race: 'T', hp: 750, armor: 1, w: 2, h: 2, cost: [50, 50], time: 600, addonOf: 'factory', research: ['siege_tech', 'mines', 'ion'], sight: 8 },
  control_tower: { name: '컨트롤 타워', race: 'T', hp: 500, armor: 1, w: 2, h: 2, cost: [50, 50], time: 600, addonOf: 'starport', research: ['cloak_w'], sight: 8 },
  covert_ops: { name: '코버트 옵스', race: 'T', hp: 750, armor: 1, w: 2, h: 2, cost: [50, 50], time: 600, addonOf: 'science_facility', research: ['lockdown_t', 'cloak_g'], sight: 8 },
  physics_lab: { name: '피직스 랩', race: 'T', hp: 600, armor: 1, w: 2, h: 2, cost: [50, 50], time: 600, addonOf: 'science_facility', research: ['yamato'], sight: 8 },
  queens_nest: { name: '퀸즈 네스트', race: 'Z', hp: 850, armor: 1, w: 3, h: 2, cost: [150, 100], time: 900, req: ['lair'], research: ['ensnare_t', 'broodlings_t'], hotkey: 'Q', adv: true, sight: 8 },
  greater_spire: { name: '그레이터 스파이어', race: 'Z', hp: 1000, armor: 1, w: 2, h: 2, cost: [100, 150], time: 1800, hidden: true, counts: ['spire'], research: ['z_fat', 'z_fcar'], sight: 8 },
  infested_cc: { name: '인페스티드 커맨드 센터', race: 'Z', hp: 1500, armor: 1, w: 4, h: 3, cost: [0, 0], time: 0, hidden: true, produces: ['infested_terran'], sight: 10 },
  robo_support: { name: '로보틱스 서포트 베이', race: 'P', hp: 450, sh: 450, armor: 1, w: 3, h: 2, cost: [150, 100], time: 450, req: ['robo'], research: ['scarab_damage', 'reaver_capacity'], hotkey: 'B', adv: true, sight: 8 },
  observatory: { name: '옵저버토리', race: 'P', hp: 250, sh: 250, armor: 1, w: 2, h: 2, cost: [50, 100], time: 450, req: ['robo'], research: [], hotkey: 'O', adv: true, sight: 8 },
  arbiter_tribunal: { name: '아비터 트리뷰널', race: 'P', hp: 500, sh: 500, armor: 1, w: 3, h: 2, cost: [200, 150], time: 900, req: ['stargate', 'archives'], research: ['recall_t', 'stasis_t'], hotkey: 'A', adv: true, sight: 8 },
});
UNITS.observer.req = ['observatory'];
BUILDINGS.cc.spells = ['lift']; BUILDINGS.cc.addons = ['comsat'];
BUILDINGS.factory.research = []; BUILDINGS.factory.addons = ['machine_shop'];
BUILDINGS.starport.produces.push('valkyrie'); BUILDINGS.starport.research = []; BUILDINGS.starport.addons = ['control_tower'];
BUILDINGS.science_facility.research = ['irradiate', 'emp_t']; BUILDINGS.science_facility.addons = ['covert_ops', 'physics_lab'];
BUILDINGS.robo.produces.push('reaver'); BUILDINGS.stargate.produces.push('arbiter');
BUILDINGS.spire.spells = ['morph_greater_spire']; BUILDINGS.archives.research.push('maelstrom_t', 'mind_control_t');
BUILDINGS.fleet_beacon.research = ['carrier_capacity', 'disruption_web_t'];
BUILD_MENU.Z[1].push('queens_nest'); BUILD_KEYS.queens_nest = 'Q';
BUILD_MENU.P[1].push('robo_support', 'observatory', 'arbiter_tribunal');
Object.assign(BUILD_KEYS, { robo_support: 'B', observatory: 'O', arbiter_tribunal: 'A' });
BUILDINGS.pool.research.push('adrenal');
Object.assign(TECH, {
  gravitic_drive: { name:'그라비틱 드라이브', cost:[200,200], time:2500, hotkey:'G', desc:'셔틀 이동 속도 증가' },
  gravitic_boosters: { name:'그라비틱 부스터', cost:[150,150], time:2000, hotkey:'G', desc:'옵저버 이동 속도 증가' },
  gravitic_thrusters: { name:'그라비틱 스러스터', cost:[200,200], time:2500, hotkey:'G', desc:'스카웃 이동 속도 증가' },
  adrenal: { name: '아드레날 글랜드', cost: [200, 200], time: 1500, req: ['hive'], hotkey: 'A', desc: '저글링 공격 간격 감소' },
  ensnare_t: { name: '인스네어', cost: [100, 100], time: 1200, hotkey: 'E', desc: '퀸의 이동 감속 능력' },
  broodlings_t: { name: '스폰 브루들링', cost: [100, 100], time: 1200, hotkey: 'B', desc: '지상 생체 유닛을 브루들링으로 변환' },
  maelstrom_t: { name: '메일스트롬', cost: [100, 100], time: 1500, hotkey: 'E', desc: '생체 유닛 일시 정지' },
  mind_control_t: { name: '마인드 컨트롤', cost: [200, 200], time: 1800, hotkey: 'M', desc: '적 유닛 소유권 획득' },
  recall_t: { name: '리콜', cost: [150, 150], time: 1800, hotkey: 'R', desc: '아군 유닛을 아비터로 이동' },
  stasis_t: { name: '스테이시스 필드', cost: [150, 150], time: 1500, hotkey: 'S', desc: '유닛을 일시적으로 전투에서 제외' },
  carrier_capacity: { name: '캐리어 용량', cost: [100, 100], time: 1500, hotkey: 'C', desc: '인터셉터 최대 4 → 8' },
  reaver_capacity: { name: '리버 용량', cost: [200, 200], time: 1500, hotkey: 'R', desc: '스캐럽 최대 5 → 10' },
  scarab_damage: { name: '스캐럽 공격력', cost: [200, 200], time: 1500, hotkey: 'S', desc: '스캐럽 공격력 100 → 125' },
  disruption_web_t: { name: '디스럽션 웹', cost: [200, 200], time: 1200, hotkey: 'D', desc: '영역 내 지상 무기 사용 억제' },
});
BUILDINGS.robo_support.research.push('gravitic_drive');
BUILDINGS.observatory.research.push('gravitic_boosters');
BUILDINGS.fleet_beacon.research.push('gravitic_thrusters');
Object.assign(SPELLS, {
  parasite: { name: '패러사이트', hotkey: 'P', target: 'unit', energy: 75, range: 12, desc: '대상 시야 공유' },
  ensnare: { name: '인스네어', hotkey: 'E', target: 'point', energy: 75, tech: 'ensnare_t', range: 9, desc: '영역 내 유닛 감속/클로킹 노출' },
  spawn_broodlings: { name: '스폰 브루들링', hotkey: 'B', target: 'unit', energy: 150, tech: 'broodlings_t', range: 9, desc: '지상 생체 유닛 제거 후 브루들링 2기 생성' },
  infest: { name: '인페스트', hotkey: 'I', target: 'unit', range: 1, desc: '체력 절반 이하 적 커맨드 센터 감염' },
  feedback: { name: '피드백', hotkey: 'F', target: 'unit', energy: 50, range: 10, desc: '대상 에너지를 없애고 그만큼 피해' },
  maelstrom: { name: '메일스트롬', hotkey: 'E', target: 'point', energy: 100, tech: 'maelstrom_t', range: 10, desc: '영역 내 생체 유닛 정지' },
  mind_control: { name: '마인드 컨트롤', hotkey: 'M', target: 'unit', energy: 150, tech: 'mind_control_t', range: 8, desc: '적 유닛을 아군으로 전환 · 시전자 보호막 소모' },
  recall: { name: '리콜', hotkey: 'R', target: 'point', energy: 150, tech: 'recall_t', range: 9999, desc: '지점의 아군 유닛을 아비터 앞으로 소환' },
  stasis: { name: '스테이시스 필드', hotkey: 'T', target: 'point', energy: 100, tech: 'stasis_t', range: 9, desc: '영역 내 유닛을 정지/무적으로 전환' },
  disruption_web: { name: '디스럽션 웹', hotkey: 'D', target: 'point', energy: 125, tech: 'disruption_web_t', range: 9, desc: '영역 내 지상 공격 억제' },
  archon_merge: { name: '아콘 합체', hotkey: 'R', target: 'none', desc: '선택한 하이 템플러 2기를 합체' },
  dark_archon_merge: { name: '다크 아콘 합체', hotkey: 'R', target: 'none', desc: '선택한 다크 템플러 2기를 합체' },
  guardian_morph: { name: '가디언 변태', hotkey: 'G', target: 'none', cost: [50, 100], req: ['greater_spire'], desc: '뮤탈리스크를 가디언으로 변태' },
  devourer_morph: { name: '디바우러 변태', hotkey: 'D', target: 'none', cost: [150, 50], req: ['greater_spire'], desc: '뮤탈리스크를 디바우러로 변태' },
  morph_greater_spire: { name: '그레이터 스파이어 변태', hotkey: 'G', target: 'none', morph: 'greater_spire', req: ['hive'], desc: '가디언/디바우러 변태 허용' },
});
SPELLS.morph_hive.req = ['lair', 'queens_nest'];
SPELLS.morph_hive.desc = '퀸즈 네스트가 있는 레어를 하이브로 변태';

BUILDINGS.nuclear_silo = { name: '뉴클리어 사일로', race: 'T', hp: 600, armor: 1, w: 2, h: 2, cost: [100, 100], time: 1200, req: ['covert_ops'], addonOf: 'cc', spells: ['arm_nuke'], sight: 8 };
BUILDINGS.cc.addons.push('nuclear_silo');
BUILDINGS.infested_cc.canLift = true; BUILDINGS.infested_cc.spells = ['lift'];
BUILDINGS.shield_battery = { name: '실드 배터리', race: 'P', hp: 200, sh: 200, armor: 1, w: 3, h: 2, cost: [100, 0], time: 450, req: ['gateway'], energy: 200, hotkey: 'B', spells: ['recharge'], sight: 7 };
BUILD_MENU.P[0].push('shield_battery'); BUILD_KEYS.shield_battery = 'B';
TECH.optic_flare_t = { name: '옵틱 플레어', cost: [100, 100], time: 1800, hotkey: 'F', desc: '대상 유닛 시야/탐지 무력화' };
TECH.hallucination_t = { name: '할루시네이션', cost: [150, 150], time: 1200, hotkey: 'H', desc: '피해를 주지 않는 유닛 환상 2기' };
BUILDINGS.academy.research.push('optic_flare_t'); BUILDINGS.archives.research.push('hallucination_t');
UNITS.medic.spells.push('optic_flare'); UNITS.htemplar.spells.push('hallucination'); UNITS.ghost.spells.push('nuclear_strike');
Object.assign(SPELLS, {
  optic_flare: { name: '옵틱 플레어', hotkey: 'F', target: 'unit', energy: 75, tech: 'optic_flare_t', range: 9, desc: '대상 시야 1 · 탐지 제거 · 리스토레이션으로 회복' },
  hallucination: { name: '할루시네이션', hotkey: 'L', target: 'unit', energy: 100, tech: 'hallucination_t', range: 7, desc: '환상 2기 · 공격 피해 없음 · 피격 피해 2배' },
  arm_nuke: { name: '핵무기 준비', hotkey: 'N', target: 'none', cost: [200, 200], desc: '인구 8 필요 · 사일로당 1발' },
  nuclear_strike: { name: '핵 공격', hotkey: 'N', target: 'point', range: 10, desc: '준비된 핵무기 필요 · 유도 중 정지/사망하면 취소' },
  recharge: { name: '보호막 충전', hotkey: 'R', target: 'unit', range: 5, desc: '근접한 아군 보호막을 에너지로 충전' },
});
