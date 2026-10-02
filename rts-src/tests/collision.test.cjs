'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// 실제 게임 모듈을 로드하고 렌더러 없이 동일한 이동/물리 코드를 실행한다.
function world() {
  const ctx = vm.createContext({ console, SND: { play() {} }, UI: { clickFx() {}, message() {} } });
  for (const name of ['data', 'content', 'map', 'path', 'game', 'entity', 'combat', 'commands']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', name + '.js'), 'utf8'), ctx);
  }
  return vm.runInContext(`(() => {
    MAP.walk.fill(1); MAP.occ.fill(0);
    GAME.players = [newPlayer('T', 0), newPlayer('Z', 1), newPlayer('Z', 2)];
    GAME.sandbox = true;
    return { GAME, MAP, TILE, MAP_W, SH, PF, physics, gameTick, cmdInstant, commandUnits, smartCommand, recoverGround,
      groundTypes: Object.keys(UNITS).filter(t => UNITS[t].speed > 0 && !UNITS[t].air && !UNITS[t].mine && t !== 'larva'),
      unit: (type, x, y) => createUnit(type, 0, x, y),
      building: (type, tx, ty) => createBuilding(type, 0, tx, ty, true),
      step() {
        GAME.tick++; PF.resetBudget(); SH.clear();
        for (const e of GAME.entities) if (!e.dead && !e.hidden) SH.insert(e);
        for (const e of GAME.entities) e.update();
        physics();
      },
      physicalStep() {
        SH.clear(); for (const e of GAME.entities) SH.insert(e); physics();
      }
    };
  })()`, ctx);
}
function position(e) { return [e.x, e.y]; }
function finite(e) { assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y)); }

test('all mobile ground types recover from exact overlap even when both units hold', () => {
  const catalogue = world();
  // 정의된 모든 이동 가능한 지상 유닛을 검사한다 (공중·라바·고정 형태 제외).
  for (const type of catalogue.groundTypes) {
    const w = world(), a = w.unit(type,240,240), b = w.unit(type,240,240);
    a.issue({t:'hold'}); b.issue({t:'hold'});
    for(let i=0;i<40;i++) w.physicalStep();
    finite(a); finite(b);
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=(a.r+b.r)*0.85-1e-6,type+' stays stacked');
  }
});

for (const type of ['scv','drone','probe']) for (const order of ['stop','hold','move'])
test(type+' restores collision immediately after gathering -> '+order, () => {
  const w=world(), blocker=w.unit('tank_siege',240,240), worker=w.unit(type,240,240);
  worker.orders=[{t:'gather',phase:'go'}]; worker.noCollide=true;
  worker.issue({t:order,x:400,y:240});
  assert.ok(!worker.noCollide,'ordinary order must restore body collision');
  for(let i=0;i<40;i++) w.physicalStep();
  assert.deepEqual(position(blocker),[240,240]); finite(worker);
  assert.ok(Math.hypot(worker.x-blocker.x,worker.y-blocker.y)>=(worker.r+blocker.r)*0.85-1e-6);
});

for (const type of ['scv', 'drone', 'probe', 'marine', 'hydra', 'zealot', 'ultralisk'])
test(type + ' walks out of a stack at its own speed without replacing its command', () => {
  const w = world(), tank = w.unit('tank_siege', 240, 240), u = w.unit(type, 240, 240);
  const order = { t: 'hold' }; u.issue(order);
  let travelled = 0;
  for (let i = 0; i < 60; i++) {
    const start = position(u); w.step();
    const distance = Math.hypot(u.x - start[0], u.y - start[1]);
    assert.ok(distance <= u.speed + 1e-6, 'overlap recovery jumps beyond movement speed');
    travelled += distance;
    assert.deepEqual(position(tank), [240, 240]);
    assert.equal(u.orders[0], order, 'recovery replaces original hold');
  }
  assert.ok(travelled > 0);
  assert.ok(Math.hypot(u.x - tank.x, u.y - tank.y) >= (u.r + tank.r) * 0.85 - 1e-6);
  const end = position(u); for (let i = 0; i < 20; i++) w.step();
  assert.deepEqual(position(u), end, 'unit continues wandering after escape');
});

for (const type of ['scv', 'drone', 'probe']) for (const order of ['hold', 'stop'])
test(type + ' leaving harvest collision makes an overlapping ' + order + ' unit recover too', () => {
  for (const reverse of [false, true]) {
    const w = world(); let b, m;
    if (reverse) { m = w.unit(type, 240, 240); b = w.unit('marine', 240, 240); }
    else { b = w.unit('marine', 240, 240); m = w.unit(type, 240, 240); }
    const heldOrder = { t: order }, moveOrder = { t: 'move', x: 420, y: 240 };
    b.issue(heldOrder);
    m.orders = [{ t: 'gather', phase: 'go' }]; m.noCollide = true;
    for (let i = 0; i < 5; i++) w.physicalStep();
    assert.deepEqual(position(b), [240, 240], 'mineral walking alone must not push hold');
    m.issue(moveOrder);
    let heldTravel = 0;
    for (let i = 0; i < 160; i++) {
      const start = position(m), heldStart = position(b); w.step();
      const heldDistance = Math.hypot(b.x - heldStart[0], b.y - heldStart[1]);
      heldTravel += heldDistance;
      assert.ok(heldDistance <= b.speed + 1e-6, 'held body was instantaneously pushed');
      assert.ok(Math.hypot(m.x - start[0], m.y - start[1]) <= m.speed + 1e-6);
      if (order === 'hold') assert.equal(b.orders[0], heldOrder, 'escape must retain hold');
      if (m.recovering) assert.equal(m.orders[0], moveOrder, 'escape replaces move intent');
    }
    assert.ok(heldTravel > 0, 'hold/stop was incorrectly treated as an immobile body');
    assert.ok(m.x > 400, 'original destination is not resumed after escape');
    const end = position(b); for (let i = 0; i < 20; i++) w.step();
    assert.deepEqual(position(b), end, 'hold/stop keeps wandering after overlap ends');
  }
});

for (const state of ['sieged', 'sieging', 'unsieging', 'egg', 'lurker_egg', 'archon_warp', 'burrowed', 'lockdown', 'stasis', 'maelstrom'])
test(state + ' remains physically fixed while overlapping mobile bodies recover', () => {
  for (const reverse of [false, true]) {
    const w = world(); let fixed, mover;
    const type = state === 'sieged' || state === 'unsieging' ? 'tank_siege' :
      state === 'sieging' || state === 'lockdown' ? 'tank' :
      state === 'egg' || state === 'lurker_egg' ? state :
      state === 'burrowed' ? 'lurker' : state === 'archon_warp' ? 'archon' : 'marine';
    const makeFixed = () => fixed = w.unit(type, 240, 240);
    const makeMover = () => mover = w.unit('marine', 240, 240);
    if (reverse) { makeMover(); makeFixed(); } else { makeFixed(); makeMover(); }
    if (state === 'sieging' || state === 'unsieging') {
      fixed.sieging = true; fixed.xform = { to: state === 'sieging' ? 'tank_siege' : 'tank', t: 1000 };
    }
    if (state === 'archon_warp') fixed.xform = { to: 'archon', t: 1000 };
    if (state === 'egg' || state === 'lurker_egg') { fixed.prog = 0; fixed.total = 1000; }
    if (state === 'burrowed') fixed.burrowed = true;
    if (state === 'lockdown') fixed.lockT = 1000;
    if (state === 'stasis') fixed.stasisT = 1000;
    if (state === 'maelstrom') fixed.maelstromT = 1000;
    mover.issue({ t: 'move', x: 420, y: 240 });
    for (let i = 0; i < 80; i++) {
      w.step(); assert.deepEqual(position(fixed), [240, 240]);
    }
    assert.ok(mover.x > 400, 'mobile body cannot leave the fixed body');
  }
});

test('mixed held ground army untangles a dense stack beside terrain', () => {
  const w=world(), army=[];
  for(let y=0;y<30;y++) w.MAP.walk[y*w.MAP_W+8]=0;
  for(const type of ['marine','scv','hydra','drone','zealot','probe','tank','ultralisk','dragoon']) {
    const u=w.unit(type,232,240); u.issue({t:'hold'}); army.push(u);
  }
  for(let i=0;i<120;i++) {
    const previous=army.map(position); w.physicalStep();
    army.forEach((u,k)=>{
      assert.ok(Math.hypot(u.x-previous[k][0],u.y-previous[k][1])<=u.speed+1e-6,'recovery teleports a body');
      assert.equal(u.orders[0]?.t,'hold');
    });
  }
  for(const a of army) {
    finite(a); assert.ok(w.PF.positionClear(a.x,a.y,a.r*0.75,0),'overlap recovery enters wall');
    for(const b of army) if(a.id<b.id)
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=(a.r+b.r)*0.85-0.1,a.type+' / '+b.type+' stay stacked');
  }
});

test('dense mobile overlap can take a short occupied waypoint instead of always ejecting outward', () => {
  const w=world(), a=w.unit('marine',240,240), b=w.unit('ultralisk',240,250), c=w.unit('dragoon',245,248);
  for(const u of [a,b,c]) {u.issue({t:'hold'});u.groundRecovery={phase:'check'};}
  w.GAME.recoveryRandState=89;
  const penetration=(x,y)=>[b,c].reduce((sum,o)=>sum+Math.max(0,(a.r+o.r)*.85-Math.hypot(x-o.x,y-o.y))**2,0);
  const before=penetration(a.x,a.y); w.recoverGround(a,[b,c]);
  assert.equal(a.groundRecovery.phase,'move');
  assert.ok(penetration(a.groundRecovery.x,a.groundRecovery.y)>before,'every escape candidate is optimized to eject the body');
  assert.equal(a.orders[0]?.t,'hold'); assert.deepEqual(position(a),[240,240]);
  for(let i=0;i<120;i++) w.physicalStep();
  for(const u of [a,b,c]) for(const v of [a,b,c]) if(u.id<v.id)
    assert.ok(Math.hypot(u.x-v.x,u.y-v.y)>=(u.r+v.r)*.85-1e-6,'short retries never reach legal positions');
});

for(const type of ['scv','drone','probe']) test(type+' queued stop keeps mining collision until it becomes active', () => {
  const w=world(), worker=w.unit(type,240,240);
  worker.orders=[{t:'gather',phase:'go'}]; worker.noCollide=true;
  worker.issue({t:'stop'},true); assert.equal(worker.noCollide,true);
  worker.nextOrder(); assert.equal(worker.noCollide,false); assert.equal(worker.orders[0].t,'stop');
});

test('ground units walk straight through friendly and enemy larvae in a corridor', () => {
  for (const type of ['marine', 'scv', 'hydra', 'tank']) for (const owner of [0, 1]) {
    const w = world(); w.MAP.walk.fill(0);
    for (let x = 1; x < 25; x++) w.MAP.walk[7 * w.MAP_W + x] = 1;
    const larvae = [210, 240, 270].map(x => {
      const l = w.unit('larva', x, 240); l.owner = owner;
      l.hatch = { x, y: 190, hw: 10, hh: 44, dead: false }; l.home = [x, 240];
      return l;
    });
    const m = w.unit(type, 100, 240); m.issue({ t: 'move', x: 450, y: 240 });
    let crossed = false;
    for (let i = 0; i < 180; i++) {
      w.step(); assert.ok(Math.abs(m.y - 240) < 1e-6, `${type} sidestepped a larva`);
      if (larvae.some(l => Math.hypot(m.x - l.x, m.y - l.y) < m.r + l.r)) crossed = true;
    }
    assert.ok(m.x > 430, `${type} blocked by larvae`); assert.ok(crossed);
  }
});

test('morphing eggs still block ground movement after the larva collision exception', () => {
  const w = world(), egg = w.unit('egg', 240, 240), m = w.unit('marine', 100, 240);
  egg.prog = 0; egg.total = 1000;
  m.issue({ t: 'move', x: 450, y: 240 }); let maxY = 0;
  for (let i = 0; i < 150; i++) {
    w.step(); maxY = Math.max(maxY, Math.abs(m.y - 240));
    assert.ok(Math.hypot(m.x - egg.x, m.y - egg.y) >= (m.r + egg.r) * 0.85 - 1e-6);
  }
  assert.ok(maxY > 8); assert.ok(m.x > 430); assert.deepEqual(position(egg), [240, 240]);
});

test('close same-speed followers keep a straight heading on an unobstructed route', () => {
  const w = world(), front = w.unit('marine', 116, 240), rear = w.unit('marine', 100, 240);
  front.issue({ t: 'move', x: 616, y: 240 }); rear.issue({ t: 'move', x: 600, y: 240 });
  for (let i = 0; i < 140; i++) {
    w.step();
    for (const u of [front, rear]) assert.ok(Math.abs(u.y - 240) < 1, 'following must not weave on a clear straight route');
    assert.ok(Math.hypot(front.x - rear.x, front.y - rear.y) >= (front.r + rear.r) * 0.85 - 1e-6);
  }
  assert.ok(front.x > 596 && rear.x > 580);
});

test('a subpixel unit-obstacle waypoint is reached without overshoot or a turn loop', () => {
  const w = world(), m = w.unit('marine', 100, 240);
  m.path = [[100.1, 240], [400, 240]]; m.pi = 0; m.pgx = 400; m.pgy = 240;
  m.pathDynamic = true; m.pathExact = true; m.repathAt = 999; m.unitPathUntil = 999;
  m.issue({ t: 'move', x: 400, y: 240 }, true);
  w.step(); assert.ok(Math.abs(m.x - 100.1) < 1e-6);
  for (let i = 0; i < 100; i++) w.step();
  assert.ok(m.x > 380); assert.ok(Math.abs(m.y - 240) < 1e-6);
});

test('ordinary movement reaches its actual clear goal before completing, including the final short step', () => {
  for(const type of ['marine','scv','hydra','zealot','tank']) {
    const w=world(), u=w.unit(type,300,300);
    u.issue({t:'move',x:335.2,y:303.1});
    for(let i=0;i<80;i++)w.step();
    assert.ok(Math.hypot(u.x-335.2,u.y-303.1)<.001,type+' completes before its actual goal');
    assert.equal(u.orders.length,0);
    const end=position(u);for(let i=0;i<30;i++)w.step();assert.deepEqual(position(u),end);
  }
});

test('close followers detour around a stopped marine without rapid alternating headings', () => {
  const w = world(), front = w.unit('marine', 116, 240), blocker = w.unit('marine', 240, 240), rear = w.unit('marine', 100, 240);
  front.issue({ t: 'move', x: 516, y: 240 }); rear.issue({ t: 'move', x: 500, y: 240 });
  let last = 0, flips = 0;
  for (let i = 0; i < 180; i++) {
    w.step(); assert.deepEqual(position(blocker), [240, 240]);
    if (rear.moving && Math.abs(rear.vy) > 0.3) {
      const side = Math.sign(rear.vy); if (last && side !== last) flips++; last = side;
    }
  }
  assert.ok(flips <= 4, `repeated left/right turns: ${flips}`);
  assert.ok(front.x > 496 && rear.x > 480);
});

for (const blocker of ['idle', 'stop', 'hold', 'tank_siege', 'sieging', 'unsieging']) {
  for (const reverse of [false, true]) {
    test(`${blocker} stays fixed while a moving unit passes (reverse IDs=${reverse})`, () => {
      const w = world();
      let b, m;
      const makeBlocker = () => b = w.unit(blocker === 'tank_siege' || blocker === 'unsieging' ? 'tank_siege' : blocker === 'sieging' ? 'tank' : 'marine', 240, 240);
      const makeMover = () => m = w.unit('marine', 100, 240);
      if (reverse) { makeMover(); makeBlocker(); } else { makeBlocker(); makeMover(); }
      if (blocker === 'stop' || blocker === 'hold') b.issue({ t: blocker });
      if (blocker === 'sieging' || blocker === 'unsieging') {
        w.GAME.players[0].tech.siege_tech = true;
        assert.equal(w.cmdInstant([b], blocker === 'sieging' ? 'siege' : 'unsiege'), true);
      }
      const start = position(b);
      m.issue({ t: 'move', x: 380, y: 240 });
      let maxY = 0;
      for (let i = 0; i < 160; i++) {
        w.step(); assert.deepEqual(position(b), start); finite(m);
        assert.ok(Math.hypot(m.x - b.x, m.y - b.y) >= (m.r + b.r) * 0.85 - 1e-6);
        maxY = Math.max(maxY, Math.abs(m.y - 240));
      }
      assert.ok(m.x > 360, `mover did not pass: ${position(m)}`);
      assert.ok(maxY > 8, 'mover should go around the blocker');
    });
  }
}

test('sieged/transforming tanks ignore stale velocity and terrain correction', () => {
  for (const type of ['tank_siege', 'tank']) {
    const w = world(), b = w.unit(type, 240, 240);
    if (type === 'tank') { b.sieging = true; b.xform = { to: 'tank_siege', t: 40 }; }
    w.MAP.walk[7 * w.MAP_W + 7] = 0;
    b.vx = 4; b.vy = 2;
    const start = position(b);
    for (let i = 0; i < 20; i++) w.physicalStep();
    assert.deepEqual(position(b), start);
  }
});

test('tank moves again after unsiege completes', () => {
  const w = world(), t = w.unit('tank_siege', 240, 240);
  w.cmdInstant([t], 'unsiege');
  for (let i = 0; i < 40; i++) w.step();
  assert.equal(t.type, 'tank');
  t.issue({ t: 'move', x: 400, y: 240 });
  for (let i = 0; i < 60; i++) w.step();
  assert.ok(t.x > 380);
});

test('moving units meet head-on and both reach their destinations', () => {
  const w = world(), a = w.unit('marine', 100, 240), b = w.unit('marine', 380, 240);
  a.issue({ t: 'move', x: 380, y: 240 }); b.issue({ t: 'move', x: 100, y: 240 });
  for (let i = 0; i < 160; i++) {
    w.step(); finite(a); finite(b);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= (a.r + b.r) * 0.85 - 1e-6);
  }
  assert.ok(a.x > 360 && b.x < 120, `${position(a)} / ${position(b)}`);
});

test('pre-existing exact overlap resolves without moving a fixed tank', () => {
  const w = world(), t = w.unit('tank_siege', 240, 240), a = w.unit('marine', 240, 240);
  for (let i = 0; i < 30; i++) w.physicalStep();
  assert.deepEqual(position(t), [240, 240]); finite(a);
  assert.ok(Math.hypot(a.x - t.x, a.y - t.y) >= (a.r + t.r) * 0.85 - 1e-6);
});

test('two overlapping ordinary idle units separate deterministically', () => {
  const w = world(), a = w.unit('marine', 240, 240), b = w.unit('marine', 240, 240);
  for (let i = 0; i < 30; i++) w.physicalStep(); finite(a); finite(b);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= (a.r + b.r) * 0.85 - 1e-6);
});

test('a tank blocking a one-tile corridor stops the mover without being pushed', () => {
  const w = world();
  w.MAP.walk.fill(0);
  for (let x = 1; x < 25; x++) w.MAP.walk[7 * w.MAP_W + x] = 1;
  const t = w.unit('tank_siege', 240, 240), m = w.unit('marine', 100, 240);
  m.issue({ t: 'move', x: 500, y: 240 });
  for (let i = 0; i < 220; i++) {
    w.step(); assert.deepEqual(position(t), [240, 240]); finite(m);
    assert.ok(m.x < t.x && m.y >= 224 && m.y < 256);
  }
});

test('a crowd of mixed-size movers does not displace a siege tank', () => {
  const w = world(), t = w.unit('tank_siege', 300, 300);
  const movers = [];
  for (let i = 0; i < 24; i++) {
    const u = w.unit(['marine', 'vulture', 'ultralisk'][i % 3], 100 - Math.floor(i / 6) * 42, 225 + i % 6 * 30);
    u.issue({ t: 'move', x: 520, y: 225 + i % 6 * 30 }); movers.push(u);
  }
  for (let i = 0; i < 220; i++) {
    w.step(); assert.deepEqual(position(t), [300, 300]); movers.forEach(finite);
  }
  assert.ok(movers.filter(u => u.x > 450).length >= 20, 'most of the crowd should pass');
});

test('air, hidden, dead, burrowed, and mineral-walking workers do not block ground movement', () => {
  for (const kind of ['air', 'hidden', 'dead', 'burrowed', 'worker']) {
    const w = world(), b = w.unit(kind === 'air' ? 'wraith' : kind === 'worker' ? 'scv' : 'marine', 240, 240);
    if (kind === 'hidden' || kind === 'dead' || kind === 'burrowed') b[kind] = true;
    if (kind === 'worker') b.noCollide = true;
    const m = w.unit('marine', 100, 240); m.issue({ t: 'move', x: 380, y: 240 });
    for (let i = 0; i < 100; i++) w.step();
    assert.ok(m.x > 360); assert.ok(Math.abs(m.y - 240) < 1e-6);
  }
});

test('buildings remain fixed while ground units follow a terrain path around them', () => {
  const w = world(), b = w.building('depot', 7, 7), m = w.unit('marine', 100, b.y);
  const start = position(b); m.issue({ t: 'move', x: 440, y: b.y });
  for (let i = 0; i < 200; i++) { w.step(); assert.deepEqual(position(b), start); finite(m); }
  assert.ok(m.x > 420, `mover did not pass building: ${position(m)}`);
});

test('full game ticks keep an idle blocker and a sieged tank stationary', () => {
  const w = world(), t = w.unit('tank_siege', 300, 300), b = w.unit('marine', 240, 300);
  const m = w.unit('marine', 100, 300); m.issue({ t: 'move', x: 450, y: 300 });
  for (let i = 0; i < 180; i++) {
    w.gameTick(); assert.deepEqual(position(t), [300, 300]); assert.deepEqual(position(b), [240, 300]);
  }
  assert.ok(m.x > 430);
});

test('a marine touching a building corner can obey a fresh move command', () => {
 const w=world();w.building('depot',7,7);const m=w.unit('marine',218,218);
 m.issue({t:'move',x:100,y:100});for(let i=0;i<120;i++)w.step();
 assert.ok(m.x<125&&m.y<125,`corner trap: ${position(m)}`);
});
test('units packed against a building can all move away on a fresh command', () => {
 const w=world();w.building('depot',7,7);const units=[];
 for(let i=0;i<12;i++)units.push(w.unit('marine',211-i%3*12,225+Math.floor(i/3)*12));
 for(let i=0;i<15;i++)w.physicalStep();
 for(const u of units)u.issue({t:'move',x:90,y:100});
 for(let i=0;i<400;i++)w.step();
 assert.ok(units.every(u=>Math.hypot(u.x-90,u.y-100)<80),units.map(position).join(' / '));
});

test('a temporarily blocked move resumes when the unit in the corridor leaves', () => {
 const w=world();w.MAP.walk.fill(0);
 for(let x=1;x<25;x++)w.MAP.walk[7*w.MAP_W+x]=1;
 const blocker=w.unit('marine',240,240),m=w.unit('marine',100,240);blocker.issue({t:'hold'});
 m.issue({t:'move',x:360,y:240});for(let i=0;i<300;i++)w.step();
 assert.equal(m.orders[0]?.t,'move','unit collision must not discard the destination');
 blocker.dead=true;for(let i=0;i<150;i++)w.step();
 assert.ok(m.x>340,`failed to resume: ${position(m)}`);
});
for(const type of ['marine','vulture','tank','ultralisk']) {
 for(const kind of ['building','terrain','mineral']) {
  test(`${type} escapes ${kind} corners after a renewed move command`,()=>{
   const w=world();const obstacle=w.building(kind==='mineral'?'mineral':'depot',7,7);
   if(kind==='terrain'){w.GAME.entities.splice(w.GAME.entities.indexOf(obstacle),1);for(let y=7;y<9;y++)for(let x=7;x<10;x++){w.MAP.occ[y*w.MAP_W+x]=0;w.MAP.walk[y*w.MAP_W+x]=0;}}
   const u=w.unit(type,100,100),r=u.r*.75;u.x=224-r;u.y=224-r;
   u.issue({t:'move',x:400,y:400});for(let i=0;i<15;i++)w.step();
   u.issue({t:'move',x:100,y:100});for(let i=0;i<200;i++)w.step();
   assert.ok(Math.hypot(u.x-100,u.y-100)<20,`trapped: ${position(u)}`);
  });
 }
}

test('a mixed crowd can regroup after bunching against buildings and minerals',()=>{
 const w=world();w.building('depot',7,7);w.building('mineral',10,9);
 const units=[];for(let i=0;i<30;i++)units.push(w.unit(['marine','vulture','tank'][i%3],180-i%5*19,210+Math.floor(i/5)*19));
 w.commandUnits(units,{t:'move',x:365,y:285});for(let i=0;i<250;i++)w.step();
 w.commandUnits(units,{t:'move',x:110,y:450});for(let i=0;i<450;i++)w.step();
 // 40px 간격에서는 먼저 도착한 몸체의 탱크용 확장 경계가 닫힌 고리를 만든다.
 // 재분산은 도착 순서와 무관하게 통과 가능한 간격으로 검사한다. 초기 19px
 // 군집, 장애물, 두 번의 집결/이동 및 각 단계의 시간 제한은 그대로다.
 const destinations=units.map((u,i)=>[500+i%6*60,650+Math.floor(i/6)*60]);
 units.forEach((u,i)=>u.issue({t:'move',x:destinations[i][0],y:destinations[i][1]}));
 for(let i=0;i<450;i++)w.step();
 assert.ok(units.every((u,i)=>Math.hypot(u.x-destinations[i][0],u.y-destinations[i][1])<20),units.map(position).join(' / '));
});

test('contact with a distant arrived group member does not complete a move', () => {
  const w = world(), stopped = w.unit('marine', 725, 600), mover = w.unit('marine', 740, 600);
  stopped.arrivedGroup = 77;
  mover.issue({ t: 'move', x: 600, y: 600, group: 77, gsize: 28 });
  w.step();
  assert.equal(mover.orders[0]?.t, 'move', 'arrival must not propagate through a distant neighbour');
  for (let i = 0; i < 150; i++) w.step();
  assert.ok(Math.hypot(mover.x - 600, mover.y - 600) < 12);
});

test('28 Protoss units gather at a reachable destination and obey a fresh dispersal command', () => {
  const w = world(), army = [];
  for (let i = 0; i < 28; i++) army.push(w.unit(i < 12 ? 'dragoon' : i < 24 ? 'zealot' : 'archon',
    600 + i % 4 * 40, 400 + Math.floor(i / 4) * 40));
  w.commandUnits(army, { t: 'move', x: 650, y: 660 });
  for (let tick = 0; tick < 800; tick++) {
    const before = army.map(position); w.step();
    for (let i = 0; i < army.length; i++) {
      const a = army[i]; finite(a);
      assert.ok(Math.hypot(a.x - before[i][0], a.y - before[i][1]) <= a.speed + 1e-6);
      for (const b of army) if (a.id < b.id)
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= (a.r + b.r) * 0.85 - 1e-6, 'gathering creates an overlap');
    }
  }
  const distances = army.map(u => Math.hypot(u.x - 650, u.y - 660));
  assert.ok(distances.reduce((a, b) => a + b, 0) / army.length < 55, 'arrival stops an unnecessarily spread-out army');
  assert.ok(Math.max(...distances) < 100, 'a far-away body was falsely marked arrived');
  assert.ok(army.every(u => !u.orders.length), 'gathering never settles');
  const targets = army.map((u, i) => [1200 + i % 7 * 40, 1000 + Math.floor(i / 7) * 40]);
  army.forEach((u, i) => u.issue({ t: 'move', x: targets[i][0], y: targets[i][1] }));
  for (let i = 0; i < 450; i++) w.step();
  assert.ok(army.every((u, i) => Math.hypot(u.x - targets[i][0], u.y - targets[i][1]) < 20), 'new command retains a previous adjusted destination');
});

test('an occupied shared destination uses a reachable endpoint without moving a fixed body', () => {
  const w = world(), fixed = w.unit('tank_siege', 650, 660), mover = w.unit('marine', 550, 660);
  fixed.arrivedGroup = 77;
  mover.issue({ t: 'move', x: 650, y: 660, group: 77, gsize: 2 });
  for (let i = 0; i < 200; i++) {
    w.step(); assert.deepEqual(position(fixed), [650, 660]);
    assert.ok(Math.hypot(mover.x - fixed.x, mover.y - fixed.y) >= (mover.r + fixed.r) * 0.85 - 1e-6);
  }
  assert.ok(!mover.orders.length, 'reachable adjusted endpoint never completes');
  assert.ok(Math.hypot(mover.x - fixed.x, mover.y - fixed.y) < 32, 'endpoint is not near the actual occupied destination');
});

test('an adjusted destination is discarded when the occupying body disappears', () => {
  const w = world(), fixed = w.unit('tank_siege', 650, 660), mover = w.unit('marine', 590, 640);
  fixed.arrivedGroup = 77;
  mover.issue({ t: 'move', x: 650, y: 660, group: 77, gsize: 2 });
  w.PF.resetBudget();
  const route = w.PF.unitPath(mover.x, mover.y, 650, 660, mover.r, w.PF.unitObstacles(mover), 77, mover.owner);
  assert.equal(route.goalBlocker, fixed);
  mover.path = route; mover.pi = 0; mover.pgx = 650; mover.pgy = 660;
  mover.pathDynamic = true; mover.pathExact = false; mover.repathAt = 999; mover.unitPathUntil = 999;
  fixed.dead = true;
  for (let i = 0; i < 80; i++) w.step();
  assert.ok(Math.hypot(mover.x - 650, mover.y - 660) <= 8, 'unit stops at the obsolete endpoint');
});

test('a clear short forward step is used before turning beside a ground body', () => {
  const w = world(), fixed = w.unit('tank_siege', 240, 240), mover = w.unit('marine', 219, 240);
  mover.issue({ t: 'move', x: 400, y: 240 }); w.step();
  assert.deepEqual(position(fixed), [240, 240]);
  assert.ok(Math.abs(mover.y - 240) < 1e-6, 'full-speed sidestep replaced a legal short approach');
  assert.ok(mover.x > 219 && mover.x < 223);
  assert.ok(Math.hypot(mover.x - fixed.x, mover.y - fixed.y) >= (mover.r + fixed.r) * 0.85 - 1e-6);
});

test('a faster follower waits for a moving body and then resumes its original destination', () => {
  const w = world(), front = w.unit('marine', 130, 600), rear = w.unit('vulture', 112.8, 600);
  front.issue({ t: 'move', x: 600, y: 600 }); rear.issue({ t: 'move', x: 580, y: 600 });
  const start = position(rear); w.step();
  assert.deepEqual(position(rear), start, 'waiting follower makes an unnecessary sidestep');
  assert.equal(rear.orders[0]?.t, 'move');
  for (let i = 0; i < 170; i++) {
    w.step();
    assert.ok(Math.hypot(front.x - rear.x, front.y - rear.y) >= (front.r + rear.r) * 0.85 - 1e-6);
  }
  assert.ok(rear.x > 560, 'follower never resumes after the moving body clears');
});

for (const mode of ['idle', 'stop', 'hold']) test('blocked corridor: non-overlapping ' + mode + ' body stays put', () => {
  const w = world(); w.MAP.walk.fill(0);
  for (let x = 1; x < 25; x++) w.MAP.walk[7 * w.MAP_W + x] = 1;
  const blocker = w.unit('marine', 240, 240), mover = w.unit('marine', 100, 240);
  if (mode !== 'idle') blocker.issue({ t: mode });
  mover.issue({ t: 'move', x: 400, y: 240 });
  let blockerDistance = 0;
  for (let i = 0; i < 320; i++) {
    const start = position(blocker); w.step();
    const step = Math.hypot(blocker.x - start[0], blocker.y - start[1]);
    assert.ok(step <= blocker.speed + 1e-6, 'yield teleports the blocker');
    blockerDistance += step;
    assert.ok(Math.hypot(blocker.x - mover.x, blocker.y - mover.y) >= (blocker.r + mover.r) * 0.85 - 1e-6);
  }
  assert.equal(blockerDistance, 0, 'mere approach moves a stopped body');
  assert.deepEqual(position(blocker), [240, 240]); assert.ok(mover.x < 240);
  assert.equal(mover.orders[0]?.t, 'move');
});

for (const type of ['scv', 'drone', 'probe']) test(type + ' uses harvest collision while approaching a raw geyser, then restores it', () => {
  const w = world(), gas = w.building('geyser', 20, 10), blocker = w.unit('marine', 450, gas.y);
  gas.owner = 2; blocker.issue({ t: 'hold' });
  const workers = Array.from({ length: 8 }, (_, i) => w.unit(type, 270 - i * 2, gas.y));
  w.smartCommand(workers, gas.x, gas.y, gas);
  assert.ok(workers.every(u => u.orders[0]?.t === 'gather'), 'raw gas click became an ordinary move');
  let crossed = false, stacked = false;
  for (let i = 0; i < 200; i++) {
    w.step();
    assert.deepEqual(position(blocker), [450, gas.y], 'gas approach displaces a non-overlapping hold body');
    for (const a of workers) {
      if (a.orders.length) assert.equal(a.noCollide, true, 'gas approach restores collision before arrival');
      else assert.equal(a.noCollide, false, 'raw gas arrival leaves harvest collision permanently disabled');
      assert.equal(a.carry, 0, 'a geyser without a refinery produces cargo');
      if (a.noCollide && Math.hypot(a.x - blocker.x, a.y - blocker.y) < (a.r + blocker.r) * .85) crossed = true;
      if (a.noCollide && workers.some(b => b !== a && b.noCollide && Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * .85)) stacked = true;
    }
  }
  assert.ok(crossed && stacked, 'gas workers did not pass through ground bodies and each other');
  assert.ok(workers.every(u => !u.orders.length && !u.noCollide), 'invalid gas arrival never restores collision');
});

test('an overlapping hold body waits for a moving neighbour before taking its own escape steps', () => {
  const w = world(), held = w.unit('marine', 240, 240), mover = w.unit('marine', 240, 240);
  held.issue({ t: 'hold' }); mover.issue({ t: 'move', x: 420, y: 240 });
  w.step();
  assert.deepEqual(position(held), [240, 240], 'overlap recovery lacks the moving-neighbour wait');
  let travelled = 0;
  for (let i = 0; i < 100; i++) {
    const start = position(held); w.step();
    const step = Math.hypot(held.x - start[0], held.y - start[1]);
    assert.ok(step <= held.speed + 1e-6); travelled += step;
    assert.equal(held.orders[0]?.t, 'hold');
  }
  assert.ok(travelled > 0, 'moving-neighbour wait permanently freezes overlap recovery');
  assert.ok(Math.hypot(held.x - mover.x, held.y - mover.y) >= (held.r + mover.r) * .85);
  const end = position(held); for (let i = 0; i < 60; i++) w.step();
  assert.deepEqual(position(held), end, 'legal hold body continues to spread after escape');
});

test('a stopped body occupying the destination completes an approach without automatic yielding', () => {
  const w = world(), stopped = w.unit('marine', 650, 660), mover = w.unit('marine', 550, 660);
  w.commandUnits([mover], { t: 'move', x: stopped.x, y: stopped.y });
  for (let i = 0; i < 200; i++) {
    w.step(); assert.deepEqual(position(stopped), [650, 660]);
    assert.ok(Math.hypot(mover.x - stopped.x, mover.y - stopped.y) >= (mover.r + stopped.r) * .85 - 1e-6);
  }
  assert.ok(!mover.orders.length, 'an occupied destination causes perpetual movement');
  assert.ok(Math.hypot(mover.x - stopped.x, mover.y - stopped.y) < 24);
  const end = position(mover); for (let i = 0; i < 120; i++) w.step();
  assert.deepEqual(position(mover), end, 'settled destination spreads without a new command');
});
