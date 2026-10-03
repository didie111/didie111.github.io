'use strict';
// Diagnostic scenarios for SC1.28, not an OpenBW equivalence test.
// Usage: node rts-src/scripts/patrol-collision-repro.cjs [src/js directory]
// The step-only variant changes a function inside an isolated VM; it never edits game files.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = process.argv[2] || path.join(__dirname, '../src/js');
const source = ['data', 'content', 'map', 'path', 'game', 'entity', 'combat', 'commands']
  .map(name => fs.readFileSync(path.join(root, name + '.js'), 'utf8')).join('\n');

function world(code, stepOnly = false) {
  const context = vm.createContext({ console, SND: { play() {} },
    UI: { clickFx() {}, message() {}, underAttack() {} } });
  vm.runInContext(source, context);
  vm.runInContext(`MAP.walk.fill(1); MAP.buildable.fill(1); MAP.occ.fill(0);
    GAME.players = [newPlayer('T', 0), newPlayer('Z', 1), newPlayer('N', 2)];
    GAME.sandbox = true; GAME.revealAll = true;`, context);
  if (stepOnly) {
    const original = vm.runInContext('steerGround.toString()', context);
    const changed = original.replace('Math.max(speed, e.r + speed * 6)', 'speed');
    if (changed === original) throw new Error('Diagnostic control no longer matches steerGround');
    vm.runInContext('steerGround = ' + changed, context);
  }
  return vm.runInContext(code, context);
}

const harvestPairs = [];
for (const type of ['scv', 'drone', 'probe']) for (const order of ['gather', 'ret', 'hold']) {
  harvestPairs.push(world(`
    const worker = createUnit('${type}', 0, 414, 400), marine = createUnit('marine', 0, 400, 400);
    worker.issue({ t: '${order}', phase: 'go' });
    marine.issue({ t: 'patrol', x: 700, y: 400, ox: 400, oy: 400 });
    SH.prepareGround(GAME.entities);
    ({ type: '${type}', order: '${order}', workerNoCollide: worker.noCollide,
      workerInGroundRoster: SH.queryGround(marine.x, marine.y, 48).includes(worker),
      patrolStepBlocked: !PF.unitsClear(marine.x, marine.y, marine.x + 4, marine.y, marine.r, [worker]),
      harvestMoverChecksBodies: groundCollider(worker), patrolMoverChecksBodies: groundCollider(marine) });
  `));
}

const approach = [];
for (const stepOnly of [false, true]) approach.push(world(`
  const u = createUnit('marine', 0, 400, 400), blocker = createUnit('marine', 0, 440, 400);
  u.dir = u.velocityDirection = 0;
  u.issue({ t: 'patrol', x: 700, y: 400, ox: 400, oy: 400 }); blocker.issue({ t: 'hold' });
  const record = [], original = steerGround;
  steerGround = function (e) {
    const vx = e.vx, vy = e.vy;
    const clear = PF.unitsClear(e.x, e.y, e.x + vx, e.y + vy, e.r, [blocker]);
    original(e);
    if (e === u) record.push({ tick: GAME.tick, x: e.x, y: e.y,
      distance: dist(e.x, e.y, blocker.x, blocker.y), normalStepClear: clear,
      wanted: [vx, vy], steered: [e.vx, e.vy], waypoint: e.moveWaypoint });
  };
  for (let n = 0; n < 12; n++) gameTick();
  ({ case: 'one patrol approaches one Hold', stepOnly: ${stepOnly}, record });
`, stepOnly));

const drill = [];
for (const type of ['scv', 'drone', 'probe']) for (const mode of ['hold', 'patrol']) {
  for (const stepOnly of [false, true]) drill.push(world(`
    const gas = createBuilding('geyser', NEUTRAL, 18, 18, true), army = [], workers = [];
    for (let i = 0; i < 12; i++) {
      const u = createUnit('marine', 0, 530 + i % 3 * 17, 560 + Math.floor(i / 3) * 17);
      u.issue({ t: 'hold' }); army.push(u);
    }
    for (let i = 0; i < 11; i++) workers.push(createUnit('${type}', 0,
      535 + i % 3 * 4, 425 + Math.floor(i / 3) * 4));
    smartCommand(workers, gas.x, gas.y, gas);
    let crossedAt = null;
    for (let n = 0; n < 200; n++) {
      gameTick();
      if (workers.some(a => army.some(b => dist(a.x, a.y, b.x, b.y) < (a.r + b.r) * .85))) {
        crossedAt = GAME.tick; break;
      }
    }
    if (crossedAt === null) throw new Error('Workers did not cross the army');
    workers.forEach(u => u.issue({ t: 'hold' }));
    if ('${mode}' === 'patrol') commandUnits(army, { t: 'patrol', x: 550, y: 590 }, false);
    const units = [...army, ...workers], frames = [];
    let sideStepRequests = 0, recoveryMovementFrames = 0, recoveryWaitFrames = 0, patrolTurns = 0;
    const original = steerGround;
    steerGround = function (e) {
      const vx = e.vx, vy = e.vy; original(e);
      if (Math.abs(e.vx * vy - e.vy * vx) > 1e-7) sideStepRequests++;
    };
    for (let n = 0; n <= 240; n++) {
      if (n % 24 === 0) {
        const xs = units.map(u => u.x), ys = units.map(u => u.y); let overlaps = 0;
        for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
          if (dist(units[i].x, units[i].y, units[j].x, units[j].y) <
              (units[i].r + units[j].r) * .85 - 1e-6) overlaps++;
        }
        frames.push({ tick: n, overlaps, width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys), recovering: units.filter(u => u.groundRecovery).length });
      }
      if (n === 240) break;
      const positions = units.map(u => [u.x, u.y]), goals = army.map(u => u.orders[0]?.x);
      gameTick();
      units.forEach((u, i) => {
        if (u.recovering) {
          if (dist(...positions[i], u.x, u.y) > 1e-6) recoveryMovementFrames++;
          else recoveryWaitFrames++;
        }
      });
      army.forEach((u, i) => { if (goals[i] !== u.orders[0]?.x) patrolTurns++; });
    }
    ({ case: 'gas drill followed by ${mode}', type: '${type}', stepOnly: ${stepOnly}, crossedAt,
      sideStepRequests, recoveryMovementFrames, recoveryWaitFrames, patrolTurns, frames });
  `, stepOnly));
}

console.log(JSON.stringify({ version: world('RTS_VERSION'),
  purpose: 'Project diagnosis only; no OpenBW runtime or original frame equivalence',
  stepOnlyControl: 'VM-only steerGround look = speed; not a deployed fix',
  definitions: { overlaps: 'centre distance < .85 * summed radii - 1e-6',
    widthHeight: 'bounding box of unit centres, not sprite dimensions',
    drillTicks: 240, simulationTicksPerSecond: 24,
    sideStepRequests: 'steerGround changes desired direction; cross product tolerance 1e-7',
    recoveryMovementFrames: 'unit-frames flagged recovering with displacement > 1e-6',
    recoveryWaitFrames: 'unit-frames flagged recovering with no displacement',
    patrolTurns: 'army order endpoint x changes, not sprite heading turns' },
  harvestPairs, approach, drill }, null, 2));
