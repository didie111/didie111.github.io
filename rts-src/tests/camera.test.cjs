'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function camera() {
  const windowEvents = {}, documentEvents = {};
  const canvas = { addEventListener() {} };
  let onControl = false, editing = false;
  const document = {
    hidden: false,
    activeElement: { matches: () => editing },
    elementFromPoint: () => ({ closest: () => onControl ? {} : null }),
    addEventListener: (name, fn) => { documentEvents[name] = fn; },
  };
  const ctx = vm.createContext({
    window: { innerWidth: 1000, innerHeight: 800, addEventListener: (name, fn) => { windowEvents[name] = fn; } },
    document, GAME: { running: true, over: false, paused: false }, MAP_W: 128, MAP_H: 128, TILE: 32,
  });
  for (const file of ['render', 'ui']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', file + '.js'), 'utf8'), ctx);
  const { UI, VIEW } = vm.runInContext('({UI, VIEW})', ctx);
  UI.el = { cv: canvas, console: { offsetHeight: 160, addEventListener() {} }, mm: canvas };
  VIEW.w = 800; VIEW.h = 640; VIEW.scale = 1.25; VIEW.x = 1800; VIEW.y = 1800;
  UI.mouse.inside = true; UI.mouse.x = 500; UI.mouse.y = 400;
  return { UI, VIEW, document, windowEvents, documentEvents, canvas,
    move(x, y, dt = 1000 / 60) { UI.mouse.x = x; UI.mouse.y = y; UI.scrollCamera(dt); },
    control(value) { onControl = value; }, editing(value) { editing = value; },
    setGame(code) { vm.runInContext(code, ctx); },
  };
}
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`); }

test('camera responds inside all four edges without touching the browser border', () => {
  for (const [x, y, axis, sign] of [[20,400,'x',-1],[980,400,'x',1],[500,20,'y',-1],[500,780,'y',1]]) {
    const c = camera(); c.move(x, y);
    assert.ok((c.VIEW[axis] - 1800) * sign > 0);
  }
});
test('camera scrolls down just above the bottom HUD and stays still in the middle', () => {
  const c = camera(); c.move(500, 630); assert.ok(c.VIEW.y > 1800);
  const y = c.VIEW.y; c.move(500, 500); near(c.VIEW.y, y); near(c.VIEW.x, 1800);
});
test('edge scrolling travels the same screen distance at different zooms and refresh rates', () => {
  for (const zoom of [1,1.25,2,3]) for (const hz of [30,60,144]) {
    const c = camera(); c.VIEW.scale = zoom;
    for (let i = 0; i < hz; i++) c.move(980, 400, 1000 / hz);
    near((c.VIEW.x - 1800) * zoom, 720);
  }
});
test('diagonal scrolling keeps the same total speed and camera stays in the map', () => {
  const c = camera(); c.move(20, 20);
  near(Math.hypot(c.VIEW.x-1800,c.VIEW.y-1800) * c.VIEW.scale, 12);
  c.VIEW.x = 0; c.VIEW.y = -8; c.move(20,20);
  near(c.VIEW.x,0); near(c.VIEW.y,-8);
});
test('menu, command and minimap interaction suppress mouse edge scrolling', () => {
  const c = camera(); c.control(true); c.move(980,780); near(c.VIEW.x,1800); near(c.VIEW.y,1800);
  c.control(false); c.UI.mmDrag = true; c.move(980,780); near(c.VIEW.x,1800); near(c.VIEW.y,1800);
});
test('camera works while paused but stops before game start, after game end and while editing', () => {
  const c = camera(); c.setGame('GAME.paused=true'); c.move(980,400); assert.ok(c.VIEW.x>1800);
  const x=c.VIEW.x;
  c.setGame('GAME.running=false'); c.move(980,400); near(c.VIEW.x,x);
  c.setGame('GAME.running=true;GAME.over=true'); c.move(980,400); near(c.VIEW.x,x);
  c.setGame('GAME.over=false'); c.editing(true); c.move(980,400); near(c.VIEW.x,x);
});
test('losing browser focus clears stale edge and keyboard input until the pointer returns', () => {
  const c=camera(); c.UI.bindInput(); c.UI.keys.ArrowRight=true; c.UI.mmDrag=true; c.UI.mouse.drag={};
  c.windowEvents.blur(); assert.equal(c.UI.mouse.inside,false); assert.equal(c.UI.mmDrag,false); assert.equal(c.UI.mouse.drag,null);
  c.move(980,400); near(c.VIEW.x,1800);
  c.windowEvents.mousemove({clientX:980,clientY:400,target:c.canvas}); c.UI.scrollCamera(); assert.ok(c.VIEW.x>1800);
  const x=c.VIEW.x; c.document.hidden=true; c.documentEvents.visibilitychange(); c.move(980,400); near(c.VIEW.x,x);
});
test('arrow key scrolling remains available away from the edges', () => {
  const c=camera(); c.UI.mouse.inside=false; c.UI.keys.ArrowLeft=true; c.UI.scrollCamera(); assert.ok(c.VIEW.x<1800);
});
