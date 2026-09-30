'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// 실제 게임 모듈을 로드하고 렌더러 없이 동일한 이동/물리 코드를 실행한다.
function world() {
  const ctx = vm.createContext({ console, SND: { play() {} } });
  for (const name of ['data', 'content', 'map', 'path', 'game', 'entity', 'combat', 'commands']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', name + '.js'), 'utf8'), ctx);
  }
  return vm.runInContext(`(() => {
    MAP.walk.fill(1); MAP.occ.fill(0);
    GAME.players = [newPlayer('T', 0), newPlayer('Z', 1), newPlayer('Z', 2)];
    GAME.sandbox = true;
    return { GAME, MAP, TILE, MAP_W, SH, PF, physics, gameTick, cmdInstant, commandUnits,
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
  for (let i = 0; i < 3; i++) w.physicalStep();
  assert.deepEqual(position(t), [240, 240]); finite(a);
  assert.ok(Math.hypot(a.x - t.x, a.y - t.y) >= (a.r + t.r) * 0.85 - 1e-6);
});

test('two overlapping ordinary idle units separate deterministically', () => {
  const w = world(), a = w.unit('marine', 240, 240), b = w.unit('marine', 240, 240);
  w.physicalStep(); finite(a); finite(b);
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
 const destinations=units.map((u,i)=>[500+i%6*40,650+Math.floor(i/6)*40]);
 units.forEach((u,i)=>u.issue({t:'move',x:destinations[i][0],y:destinations[i][1]}));
 for(let i=0;i<450;i++)w.step();
 assert.ok(units.every((u,i)=>Math.hypot(u.x-destinations[i][0],u.y-destinations[i][1])<20),units.map(position).join(' / '));
});
