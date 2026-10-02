'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function camera() {
  const windowEvents = {}, documentEvents = {}, canvasEvents = {};
  const canvas = { style:{}, closest:()=>null, addEventListener(name,fn) {canvasEvents[name]=fn;},
    requestPointerLock() {document.pointerLockElement=canvas;documentEvents.pointerlockchange?.();} };
  let onControl = false, editing = false, hit = null;
  const control = {closest:()=>control,contains:()=>true};
  const classes = () => {const values=new Set(['hidden']);return {contains:k=>values.has(k),toggle(k,on){if(on===undefined)on=!values.has(k);if(on)values.add(k);else values.delete(k);}};};
  const document = {
    hidden: false,
    activeElement: { matches: () => editing },
    pointerLockElement:null,
    exitPointerLock() {document.pointerLockElement=null;documentEvents.pointerlockchange?.();},
    elementFromPoint: () => hit || (onControl ? control : canvas),
    addEventListener: (name, fn) => { documentEvents[name] = fn; },
  };
  const ctx = vm.createContext({
    window: { innerWidth: 1000, innerHeight: 800, addEventListener: (name, fn) => { windowEvents[name] = fn; } },
    document, GAME: { running: true, over: false, paused: false }, MAP_W: 128, MAP_H: 128, TILE: 32,
    SND:{init(){},play(){}}, MouseEvent:class {constructor(type,props){Object.assign(this,props,{type,isTrusted:false});}},
  });
  for (const file of ['render', 'ui']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', file + '.js'), 'utf8'), ctx);
  const { UI, VIEW } = vm.runInContext('({UI, VIEW})', ctx);
  UI.el = { cv: canvas, console: { offsetHeight: 160, addEventListener() {} }, mm: {addEventListener(){}},
    test:{classList:classes()}, mouseLock:{classList:classes(),setAttribute(k,v){this[k]=v;}},
    pointerCursor:{classList:classes(),style:{}} };
  UI.message=()=>{};
  VIEW.w = 800; VIEW.h = 640; VIEW.scale = 1.25; VIEW.x = 1800; VIEW.y = 1800;
  UI.mouse.inside = true; UI.mouse.x = 500; UI.mouse.y = 400;
  return { UI, VIEW, document, windowEvents, documentEvents, canvas,canvasEvents,
    move(x, y, dt = 1000 / 60) { UI.mouse.x = x; UI.mouse.y = y; UI.scrollCamera(dt); },
    control(value) { onControl = value; }, editing(value) { editing = value; },
    hit(value) {hit=value;},
    setGame(code) { vm.runInContext(code, ctx); },
  };
}
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`); }

test('camera responds inside all four edges without touching the browser border', () => {
  for (const [x, y, axis, sign] of [[20,400,'x',-1],[980,400,'x',1],[500,20,'y',-1],[500,795,'y',1]]) {
    const c = camera(); c.move(x, y);
    assert.ok((c.VIEW[axis] - 1800) * sign > 0);
  }
});
test('down scrolling starts below the HUD, not above or inside the information panel', () => {
  const c = camera();
  for (const y of [620,630,700,780,787]) {c.move(500,y);near(c.VIEW.y,1800);}
  c.move(500,790);assert.ok(c.VIEW.y>1800);
  const y = c.VIEW.y; c.move(500,500);near(c.VIEW.y,y);near(c.VIEW.x,1800);
  assert.equal(c.UI.consoleH(),172,'camera extent includes the strip below the HUD');
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
  const c = camera(); c.control(true); c.move(980,795); near(c.VIEW.x,1800); near(c.VIEW.y,1800);
  c.control(false); c.UI.mmDrag = true; c.move(980,795); near(c.VIEW.x,1800); near(c.VIEW.y,1800);
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

test('pointer lock clamps a virtual cursor to every game edge and still scrolls',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();assert.equal(c.document.pointerLockElement,c.canvas);
 c.windowEvents.mousemove({clientX:500,clientY:400,movementX:-2000,movementY:2000,target:c.canvas});
 assert.equal(c.UI.mouse.x,0);assert.equal(c.UI.mouse.y,799);c.UI.scrollCamera();assert.ok(c.VIEW.x<1800&&c.VIEW.y>1800);
 c.windowEvents.mousemove({clientX:500,clientY:400,movementX:3000,movementY:-3000,target:c.canvas});
 assert.equal(c.UI.mouse.x,999);assert.equal(c.UI.mouse.y,0);
 c.documentEvents.mouseleave();assert.equal(c.UI.mouse.inside,true);
});
test('Escape and F10 release pointer lock and clear stale drag/edge input',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.keys.Shift=true;c.UI.mouse.drag={};c.UI.mmDrag=true;
 c.UI.keyDown({key:'Escape'});assert.equal(c.document.pointerLockElement,null);assert.equal(c.UI.mouse.inside,false);
 assert.equal(c.UI.mouse.drag,null);assert.equal(c.UI.mmDrag,false);assert.equal(c.UI.keys.Shift,undefined);
 c.UI.toggleMouseLock();c.UI.toggleTest(true);assert.equal(c.document.pointerLockElement,null);
 assert.equal(c.UI.el.test.classList.contains('hidden'),false);
});
test('locked right clicks and drag selections use the virtual cursor coordinates',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.mouse.x=120;c.UI.mouse.y=140;
 let command,box;c.UI.pick=()=>null;c.UI.rightClick=(...args)=>{command=args;};c.UI.boxSelect=(...args)=>{box=args;};
 c.canvasEvents.mousedown({button:2,clientX:500,clientY:400});near(command[0],1896);near(command[1],1912);
 c.canvasEvents.mousedown({button:0,clientX:500,clientY:400});
 c.windowEvents.mousemove({clientX:500,clientY:400,movementX:100,movementY:80,target:c.canvas});
 c.windowEvents.mouseup({button:0,clientX:500,clientY:400,isTrusted:true});
 near(box[0],1896);near(box[1],1912);near(box[2],1976);near(box[3],1976);
});
test('locked HUD clicks route to the visible control and never issue a map command',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();const events=[];let clicks=0,commands=0;
 const button={closest:s=>s==='#test,#help'?null:button,contains:()=>true,dispatchEvent:e=>events.push(e),click:()=>clicks++};
 c.hit(button);c.UI.mouse.x=230;c.UI.mouse.y=650;c.UI.rightClick=()=>commands++;
 c.canvasEvents.mousedown({button:0,clientX:500,clientY:400,preventDefault(){}});
 c.windowEvents.mouseup({button:0,clientX:500,clientY:400,isTrusted:true});
 assert.deepEqual(events.map(e=>[e.type,e.clientX,e.clientY]),[['mousedown',230,650],['mouseup',230,650]]);
 assert.equal(clicks,1);assert.equal(commands,0);assert.equal(c.UI.mouse.drag,null);
});
test('failed pointer lock leaves ordinary input available and reports a single failure',()=>{
 const c=camera();c.UI.bindInput();const messages=[];c.UI.message=m=>messages.push(m);c.canvas.requestPointerLock=()=>{throw new Error('denied');};
 c.UI.toggleMouseLock();c.documentEvents.pointerlockerror();assert.equal(messages.length,1);
 assert.equal(c.UI.lockPending,false);assert.equal(c.document.pointerLockElement,null);
 c.windowEvents.mousemove({clientX:200,clientY:250,target:c.canvas});assert.equal(c.UI.mouse.x,200);assert.equal(c.UI.mouse.inside,true);
});
test('locking with F10 already visible closes it; clicking F10 unlocks before opening native controls',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleTest(true);c.UI.toggleMouseLock();
 assert.ok(c.UI.el.test.classList.contains('hidden'));assert.equal(c.document.pointerLockElement,c.canvas);
 const button={id:'hud-f10',closest:s=>s==='#test,#help'?null:button};c.hit(button);
 c.canvasEvents.mousedown({button:0,preventDefault(){}});
 assert.equal(c.document.pointerLockElement,null);assert.equal(c.UI.el.test.classList.contains('hidden'),false);
 assert.equal(c.UI.mouse.drag,null);assert.equal(c.UI.lockedTarget,null);
});
test('a delayed pointer lock completion cannot trap an already opened F10 menu',()=>{
 const c=camera();c.UI.bindInput();c.canvas.requestPointerLock=()=>{};c.UI.toggleMouseLock();
 c.UI.toggleTest(true);c.document.pointerLockElement=c.canvas;c.documentEvents.pointerlockchange();
 assert.equal(c.document.pointerLockElement,null);assert.equal(c.UI.el.test.classList.contains('hidden'),false);
});
