'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function world() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', classList: { toggle() {} } });
    return nodes.get(id);
  };
  const pictures = [], rings = [];
  const ctx = vm.createContext({ assert, console,
    document: { getElementById: node }, window: { addEventListener() {} },
    SND: { play() {} }, RENDER: { toWorld: (x, y) => [x, y] },
    ART: { unit: (type, owner) => ({ c: { type, owner }, h: 16 }),
      building: (type, owner) => ({ c: { type, owner }, ox: 32, oy: 32 }) },
    canvas: { drawImage: (sprite, x, y) => pictures.push({ sprite, x, y }),
      beginPath() {}, ellipse: (...args) => rings.push(args), stroke() {}, fillText() {}, fillRect() {} }
  });
  for (const name of ['data', 'content', 'map', 'path', 'game', 'entity', 'combat', 'commands', 'ui'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', name + '.js'), 'utf8'), ctx);
  vm.runInContext(`MAP.walk.fill(1); MAP.buildable.fill(1); MAP.occ.fill(0);
    GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];
    UI.el.test=document.getElementById('test'); UI.message=()=>{}; UI.buildTestPanel();
    UI.mouse.inside=true; UI.mouse.overUI=false;
  `, ctx);
  node('t-type').value = 'scv'; node('t-owner').value = '0'; node('t-count').value = '1';
  return { run: code => vm.runInContext(code, ctx), node, pictures, rings };
}

test('F10 selecting a unit arms the mouse preview without spawning or pressing another button', () => {
  const w = world(); w.node('t-type').value = 'scv'; w.node('t-type').onchange();
  w.run(`assert.equal(UI.mode?.kind,'spawn'); assert.equal(UI.mode.type,'scv');
    assert.equal(GAME.entities.length,0); assert.equal(GAME.nextId,1);
    UI.mouse.x=400; UI.mouse.y=300; UI.drawWorldOverlay(canvas);`);
  assert.equal(w.pictures.length, 1);
  assert.deepEqual(w.pictures[0], { sprite: { type: 'scv', owner: 0 }, x: 384, y: 284 });
  w.run(`UI.execMode(400,300,false); assert.equal(GAME.entities.length,1);
    assert.equal(GAME.entities[0].x,400); assert.equal(GAME.entities[0].y,300);
    assert.equal(UI.mode.kind,'spawn'); UI.cancelMode(); UI.drawWorldOverlay(canvas);`);
  assert.equal(w.pictures.length, 1, 'cancelled preview must disappear');
});

test('the default F10 unit can activate its preview by opening the target selector', () => {
  const w = world(); w.node('t-type').onpointerdown();
  w.run(`assert.equal(UI.mode?.type,'scv'); assert.equal(GAME.entities.length,0);`);
});

test('team and count edits update the active preview, and Escape cancels while the selector has focus', () => {
  const w = world(); w.node('t-type').onchange();
  w.node('t-owner').value='1'; w.node('t-owner').onchange();
  w.node('t-count').value='3.8'; w.node('t-count').oninput();
  w.run(`assert.equal(UI.mode.owner,1); assert.equal(UI.mode.count,3);
    UI.keyDown({key:'Escape',target:{tagName:'SELECT'}}); assert.equal(UI.mode,null);
    assert.equal(GAME.entities.length,0);`);
});

for (const [type, count] of [['scv', 5], ['hydra', 9], ['zealot', 7], ['wraith', 2]])
test(type + ' previews every spawn position and uses the chosen count and team on click', () => {
  const w = world(); w.node('t-type').value = type; w.node('t-owner').value = '1';
  w.node('t-count').value = String(count); w.node('t-type').onchange();
  w.run(`UI.mouse.x=400; UI.mouse.y=300; UI.drawWorldOverlay(canvas);
    assert.equal(GAME.entities.length,0); UI.spawnAt(400,300);`);
  assert.equal(w.pictures.length, count);
  const spawned = w.run(`GAME.entities.map(e=>({x:e.x,y:e.y,type:e.type,owner:e.owner}))`);
  for (let i = 0; i < count; i++) {
    assert.equal(spawned[i].type, type); assert.equal(spawned[i].owner, 1);
    assert.equal(spawned[i].x, w.pictures[i].x + 16);
    assert.equal(spawned[i].y, w.pictures[i].y + 16);
  }
});

test('mouse preview is hidden over the F10 panel and outside the game', () => {
  const w = world(); w.node('t-spawn').onclick();
  w.run(`UI.mouse.overUI=true; UI.drawWorldOverlay(canvas);
    UI.mouse.overUI=false; UI.mouse.inside=false; UI.drawWorldOverlay(canvas);`);
  assert.equal(w.pictures.length, 0);
});

test('blocked ground spawn preview matches the actual relocated positions', () => {
  const w = world(); w.node('t-type').onchange();
  w.run(`MAP.walk[tIdx(12,9)]=0; UI.mouse.x=400; UI.mouse.y=300;
    UI.drawWorldOverlay(canvas); UI.spawnAt(400,300);
    assert.ok(groundPassable(tileOf(GAME.entities[0].x),tileOf(GAME.entities[0].y)));`);
  assert.equal(w.pictures.length, 1);
  const pos = w.run(`[GAME.entities[0].x,GAME.entities[0].y]`);
  assert.equal(pos[0], w.pictures[0].x + 16); assert.equal(pos[1], w.pictures[0].y + 16);
});

test('an invalid building preview cannot create a building or consume an entity ID', () => {
  const w = world(); w.node('t-type').value = 'depot'; w.node('t-type').onchange();
  w.run(`UI.mouse.x=400; UI.mouse.y=300; MAP.buildable.fill(0);
    UI.drawWorldOverlay(canvas); UI.spawnAt(400,300);
    assert.equal(GAME.entities.length,0); assert.equal(GAME.nextId,1);`);
  assert.equal(w.pictures.length, 1);
});
