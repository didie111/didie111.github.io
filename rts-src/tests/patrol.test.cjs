'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { test } = require('node:test');
function world(code) {
  const ctx = vm.createContext({ assert, console, SND: { play() {} }, UI: { clickFx() {}, message() {}, underAttack() {} } });
  const root = process.env.RTS_SOURCE_DIR || path.join(__dirname, '../src/js');
  for (const name of ['data', 'content', 'map', 'path', 'game', 'entity', 'combat', 'commands']) {
    vm.runInContext(fs.readFileSync(path.join(root, name + '.js'), 'utf8'), ctx);
  }
  return vm.runInContext(`MAP.walk.fill(1); MAP.buildable.fill(1); MAP.occ.fill(0);
    GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];
    GAME.sandbox=true; GAME.revealAll=true; ${code}`, ctx);
}
for (const type of ['scv', 'drone', 'probe']) for (const order of ['gather', 'ret']) {
  test(type + ' ' + order + ' permits its own passage but blocks an approaching patrol', () => world(`
    const w=createUnit('${type}',0,414,400), m=createUnit('marine',0,400,400);
    if('${order}'==='ret'){w.carry=8;w.carryKind='min';}
    w.issue({t:'${order}',phase:'go'}); m.issue({t:'patrol',x:700,y:400,ox:400,oy:400});
    SH.prepareGround(GAME.entities);
    assert.ok(SH.queryGround(400,400,48).includes(w), 'patrol cannot see the harvesting body');
    assert.equal(PF.unitsClear(400,400,404,400,m.r,[w],m),false);
    assert.equal(PF.unitsClear(414,400,410,400,w.r,[m],w),true);
    assert.equal(PF.unitObstacles(w,true).units.length,0);
    assert.ok(PF.unitObstacles(m,true).units.includes(w));
  `));
}
for (const type of ['scv', 'drone', 'probe']) {
  test(type + ' approaching a held army retains its harvest passage after collision separation', () => world(`
    const m=createUnit('marine',0,450,400), w=createUnit('${type}',0,360,400);m.issue({t:'hold'});
    w.dir=w.velocityDirection=0;w.issue({t:'gather',phase:'go'});let crossed=false;
    for(let n=0;n<30;n++){w.vx=w.speed;w.vy=0;w.moveWaypoint=[700,400];physics();
      assert.deepEqual([m.x,m.y],[450,400]);
      if(dist(w.x,w.y,m.x,m.y)<(w.r+m.r)*.85)crossed=true;}
    assert.ok(crossed);assert.ok(w.isWorkerGathering());assert.equal(w.noCollide,false);
  `));
  test(type + ' WaitForGas blocks another harvester except returning gas', () => world(`
    const a=createUnit('${type}',0,400,400), b=createUnit('${type}',0,414,400);
    a.issue({t:'gather',phase:'go'}); b.issue({t:'gather',phase:'go',gasWaiting:true});
    assert.equal(PF.unitsClear(400,400,404,400,a.r,[b],a),false);
    a.carry=8;a.carryKind='gas';a.issue({t:'ret'});
    assert.equal(PF.unitsClear(400,400,404,400,a.r,[b],a),true);
  `));
}
test('patrol takes a legal next step before selecting a distant detour', () => world(`
  const m=createUnit('marine',0,400,400), b=createUnit('marine',0,440,400);
  m.dir=m.velocityDirection=0;m.issue({t:'patrol',x:700,y:400,ox:400,oy:400});b.issue({t:'hold'});
  for(let n=0;n<3;n++)gameTick();
  assert.equal(m.x,412);assert.equal(m.y,400);assert.deepEqual([b.x,b.y],[440,400]);
  for(let n=0;n<80;n++)gameTick();
  assert.ok(m.x>440,'contact never resumes movement');assert.deepEqual([b.x,b.y],[440,400]);
`));
test('patrol preserves its leg while an existing illegal overlap follows a recovery step', () => world(`
  const m=createUnit('marine',0,400,400), b=createUnit('marine',0,400,400);
  const o={t:'patrol',x:416,y:400,ox:400,oy:400};m.issue(o);b.issue({t:'hold'});
  m.groundRecovery={phase:'move',x:416,y:400};m.x=416;
  for(let n=0;n<4;n++){m.update();assert.equal(o.x,416);assert.equal(o.ox,400);}
  assert.equal(m.orders[0],o);
`));
test('patrol checks actual completion on the order timer and retains the occupied requested endpoint', () => world(`
  const m=createUnit('marine',0,400,400), b=createUnit('marine',0,413.61,400);
  const o={t:'patrol',x:b.x,y:b.y,ox:350,oy:400,patrolCheckAt:10};m.issue(o);b.issue({t:'hold'});
  for(let n=1;n<10;n++){GAME.tick=n;SH.clear();SH.insert(m);SH.insert(b);m.update();assert.equal(o.x,413.61);}
  GAME.tick=10;m.update();assert.equal(o.x,350);assert.equal(o.ox,413.61);
  assert.deepEqual([b.x,b.y],[413.61,400]);
`));
test('patrol records its actual reachable endpoint when the terrain target was adjusted', () => world(`
  const m=createUnit('marine',0,400,400),o={t:'patrol',x:450,y:400,ox:350,oy:400};m.issue(o);
  m.path=[[400,400]];m.pi=0;m.pgx=450;m.pgy=400;m.repathAt=9999;m.pathExact=false;m.pathDynamic=false;
  m.update();assert.equal(o.x,350);assert.equal(o.ox,400);
`));
test('shared-goal completion ignores the approaching body itself', () => world(`
  const a=createUnit('marine',0,400,400),b=createUnit('marine',0,413.61,400);
  a.issue({t:'move',x:b.x,y:b.y});b.issue({t:'hold'});SH.clear();SH.insert(a);SH.insert(b);
  assert.ok(a.moveGroup(a.orders[0]));assert.equal(a.moveArrivalBlocked,true);
  assert.deepEqual([a.x,a.y],[400,400]);assert.deepEqual([b.x,b.y],[413.61,400]);
`));
