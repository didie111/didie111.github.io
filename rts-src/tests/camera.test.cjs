'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

class InputEvent {
  constructor(type, props = {}) { Object.assign(this, props, {type, isTrusted:false}); }
}
function element(tag = 'div', doc) {
  const names = new Set(), listeners = {};
  const el = {tagName:tag.toUpperCase(), id:'', style:{}, children:[], parentElement:null, scrollTop:0,
    classList:{add:k=>names.add(k),remove:k=>names.delete(k),contains:k=>names.has(k),toggle(k,on){if(on===undefined)on=!names.has(k);if(on)names.add(k);else names.delete(k);}},
    setAttribute(k,v){this[k]=String(v);},getAttribute(k){return this[k]??null;},
    appendChild(child){child.remove?.();child.parentElement=this;this.children.push(child);return child;},
    insertBefore(child,next){child.parentElement=this;const i=this.children.indexOf(next);this.children.splice(i<0?this.children.length:i,0,child);},
    remove(){if(this.parentElement){const a=this.parentElement.children;a.splice(a.indexOf(this),1);this.parentElement=null;}},
    contains(child){for(let p=child;p;p=p.parentElement)if(p===this)return true;return false;},
    matches(s){return s.split(',').some(k=>{k=k.trim();return k[0]==='#'?this.id===k.slice(1):k[0]==='.'?names.has(k.slice(1)):this.tagName===k.toUpperCase();});},
    closest(s){for(let p=this;p;p=p.parentElement)if(p.matches?.(s))return p;return null;},
    addEventListener(k,fn){(listeners[k]??=[]).push(fn);},
    dispatchEvent(e){e.target=this;this['on'+e.type]?.(e);for(const fn of listeners[e.type]||[])fn(e);return true;},
    click(){if(this.tagName==='INPUT'&&this.type==='checkbox'){this.checked=!this.checked;this.dispatchEvent(new InputEvent('change'));}this.onclick?.(new InputEvent('click'));},
    focus(){if(doc)doc.activeElement=this;},blur(){if(doc)doc.activeElement=doc.body;},select(){this.textSelected=true;},
    scrollIntoView(){this.scrolled=true;},
    getBoundingClientRect(){return this.rect||{left:100,top:100,bottom:120,width:200,height:20};},
  };
  Object.defineProperties(el,{parentNode:{get(){return this.parentElement;}},nextSibling:{get(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1]||null;}},
    className:{get(){return [...names].join(' ');},set(v){names.clear();for(const k of v.split(/\s+/))if(k)names.add(k);}}});
  return el;
}

function camera() {
  const windowEvents = {}, documentEvents = {}, canvasEvents = {};
  const canvas = { style:{}, closest:()=>null, addEventListener(name,fn) {canvasEvents[name]=fn;},
    requestPointerLock() {document.pointerLockElement=canvas;documentEvents.pointerlockchange?.();} };
  let onControl = false, editing = false, hit = null;
  const control = {closest:()=>control,contains:()=>true};
  const classes = () => {const values=new Set(['hidden']);return {add:k=>values.add(k),remove:k=>values.delete(k),contains:k=>values.has(k),toggle(k,on){if(on===undefined)on=!values.has(k);if(on)values.add(k);else values.delete(k);}};};
  const document = {
    hidden: false,
    activeElement: { matches: () => editing },
    pointerLockElement:null,
    exitPointerLock() {document.pointerLockElement=null;documentEvents.pointerlockchange?.();},
    elementFromPoint: () => hit || (onControl ? control : canvas),
    addEventListener: (name, fn) => { documentEvents[name] = fn; },
  };
  document.body=element('body',document);document.createElement=tag=>element(tag,document);
  const ctx = vm.createContext({
    window: { innerWidth: 1000, innerHeight: 800, addEventListener: (name, fn) => { windowEvents[name] = fn; } },
    document, GAME: { running: true, over: false, paused: false }, MAP_W: 128, MAP_H: 128, TILE: 32,
    SND:{init(){},play(){}}, MouseEvent:InputEvent, Event:InputEvent,
  });
  for (const file of ['render', 'ui']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', file + '.js'), 'utf8'), ctx);
  const { UI, VIEW } = vm.runInContext('({UI, VIEW})', ctx);
  UI.el = { cv: canvas, console: { offsetHeight: 160, addEventListener() {} }, mm: {addEventListener(){}},
    test:{classList:classes()}, help:{classList:classes()}, mouseLock:{classList:classes(),setAttribute(k,v){this[k]=v;}},
    pointerCursor:{classList:classes(),style:{}} };
  UI.message=()=>{};
  VIEW.w = 800; VIEW.h = 640; VIEW.scale = 1.25; VIEW.x = 1800; VIEW.y = 1800;
  UI.mouse.inside = true; UI.mouse.x = 500; UI.mouse.y = 400;
  return { UI, VIEW, document, windowEvents, documentEvents, canvas,canvasEvents,node:tag=>element(tag,document),
    move(x, y, dt = 1000 / 60) { UI.mouse.x = x; UI.mouse.y = y; UI.scrollCamera(dt); },
    control(value) { onControl = value; }, editing(value) { editing = value; },
    hit(value) {hit=value;},
    setGame(code) { vm.runInContext(code, ctx); },
  };
}
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`); }
function cameraKey(c,key,shiftKey=false,props={}) {
 let prevented=0;
 c.UI.keyDown({key,shiftKey,preventDefault(){prevented++;},...props});
 return prevented;
}

test('Shift F2-F4 store three independent screen locations and one key recalls each immediately',()=>{
 const c=camera();
 const positions=[[400,500],[1700,2200],[2900,1200]];
 for(let i=0;i<3;i++){[c.VIEW.x,c.VIEW.y]=positions[i];assert.equal(cameraKey(c,'F'+(i+2),true),1);}
 for(let i=0;i<3;i++){c.VIEW.x=900;c.VIEW.y=900;assert.equal(cameraKey(c,'F'+(i+2)),1);near(c.VIEW.x,positions[i][0]);near(c.VIEW.y,positions[i][1]);}
 c.VIEW.x=600;c.VIEW.y=800;cameraKey(c,'F3',true);c.VIEW.x=2200;cameraKey(c,'F3');near(c.VIEW.x,600);near(c.VIEW.y,800);
 cameraKey(c,'F2');near(c.VIEW.x,400);near(c.VIEW.y,500);
});
test('screen recall preserves the bookmarked map center across zoom and resize, clamping map edges',()=>{
 const c=camera();c.VIEW.x=1600;c.VIEW.y=1900;cameraKey(c,'F2',true);
 const x=2000,y=1900+(640-172/1.25)/2;
 for(const [scale,w,h] of [[2,500,400],[1,1400,900],[3,700,600]]){
  c.VIEW.scale=scale;c.VIEW.w=w;c.VIEW.h=h;c.VIEW.x=0;c.VIEW.y=0;cameraKey(c,'F2');
  near(c.VIEW.x+w/2,x);near(c.VIEW.y+(h-172/scale)/2,y);assert.equal(c.VIEW.scale,scale);
 }
 c.VIEW.scale=3;c.VIEW.w=300;c.VIEW.h=300;c.VIEW.x=3796;c.VIEW.y=3796+172/3;cameraKey(c,'F4',true);
 c.VIEW.scale=1;c.VIEW.w=1400;c.VIEW.h=900;cameraKey(c,'F4');near(c.VIEW.x,2696);near(c.VIEW.y,3368);
});
test('camera hotkeys keep selection, queued orders and target mode while clearing an unfinished map drag',()=>{
 const c=camera(),unit={owner:0,orders:[{kind:'move',x:123,y:456}]};c.UI.selection=[unit];c.UI.mode={kind:'target',cmd:'attack'};
 const selection=c.UI.selection,mode=c.UI.mode,orders=unit.orders;cameraKey(c,'F2',true);
 c.UI.mouse.drag={wx:12,wy:34};c.UI.mmDrag=true;c.VIEW.x=1200;cameraKey(c,'F2');
 assert.equal(c.UI.selection,selection);assert.equal(c.UI.mode,mode);assert.equal(unit.orders,orders);
 assert.equal(c.UI.mouse.drag,null);assert.equal(c.UI.mmDrag,false);
});
test('unassigned screen keys do not move, and suspended gameplay never changes bookmarks',()=>{
 const c=camera(),messages=[];c.UI.message=m=>messages.push(m);
 assert.equal(cameraKey(c,'F2'),1);near(c.VIEW.x,1800);near(c.VIEW.y,1800);assert.ok(messages[0].includes('Shift+F2'));
 cameraKey(c,'F2',true);
 for(const state of ['GAME.running=false','GAME.running=true;GAME.over=true','GAME.over=false;document.hidden=true']){
  c.setGame(state);c.VIEW.x=800;cameraKey(c,'F2');near(c.VIEW.x,800);cameraKey(c,'F3',true);assert.equal(c.UI.cameraLocations[1],undefined);
 }
 c.setGame('document.hidden=false;GAME.paused=true');cameraKey(c,'F2');near(c.VIEW.x,1800);
 assert.equal(camera().UI.cameraLocations.length,0,'a new page/game starts without old locations');
});
test('repeats, composition and browser modifier shortcuts cannot accidentally overwrite a screen location',()=>{
 const c=camera();cameraKey(c,'F2',true);c.VIEW.x=900;
 assert.equal(cameraKey(c,'F2',true,{repeat:true}),1);
 for(const prop of ['ctrlKey','metaKey','altKey','isComposing'])assert.equal(c.UI.cameraLocationKey({key:'F2',shiftKey:true,[prop]:true,preventDefault(){assert.fail('browser shortcut captured');}}),false);
 cameraKey(c,'F2');near(c.VIEW.x,1800);
});
test('screen location hotkeys work through locked menu focus and retain pointer lock without requests or exits',()=>{
 const c=camera();c.UI.bindInput();let requests=0,exits=0;
 c.canvas.requestPointerLock=()=>{requests++;c.document.pointerLockElement=c.canvas;c.documentEvents.pointerlockchange();};
 c.document.exitPointerLock=()=>{exits++;};c.UI.toggleMouseLock();c.UI.toggleTest(true);
 const input=c.node('input');input.type='number';input.value='5';cameraKey(c,'F2',true,{target:input});
 c.VIEW.x=800;cameraKey(c,'F2',false,{target:input});near(c.VIEW.x,1800);assert.equal(input.value,'5');
 const {trigger}=picker(c);trigger.click();const menu=c.UI.menuSelect;
 cameraKey(c,'F3',true,{target:menu.options[0]});c.VIEW.y=700;cameraKey(c,'F3',false,{target:menu.options[0]});near(c.VIEW.y,1800);
 assert.equal(c.UI.menuSelect,menu);assert.equal(c.UI.el.test.classList.contains('hidden'),false);
 assert.equal(c.document.pointerLockElement,c.canvas);assert.equal(requests,1);assert.equal(exits,0);
});
function cursorCamera() {
  const c = camera(), create = c.document.createElement;
  let image = 0;
  c.document.createElement = tag => {
    const node = create(tag);
    if (tag === 'canvas') {
      node.getContext = () => ({beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},arc(){}});
      node.toDataURL = () => 'data:image/mock,' + image++;
    }
    return node;
  };
  c.UI.makeCursors(); c.UI.bindInput(); c.UI.toggleMouseLock(); c.UI.toggleTest(true);
  c.setGame('RENDER.resize=()=>{}');
  c.UI.el.test.style = {};
  c.UI.el.test.getBoundingClientRect = () => ({width:300,height:150});
  c.UI.testPosition = {x:12,y:160};
  return c;
}

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
test('Escape releases pointer lock; F10 clears stale drag/edge input while retaining the lock',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.keys.Shift=true;c.UI.mouse.drag={};c.UI.mmDrag=true;
 c.UI.keyDown({key:'Escape'});assert.equal(c.document.pointerLockElement,null);assert.equal(c.UI.mouse.inside,false);
 assert.equal(c.UI.mouse.drag,null);assert.equal(c.UI.mmDrag,false);assert.equal(c.UI.keys.Shift,undefined);
 c.UI.toggleMouseLock();c.UI.keys.ArrowRight=true;c.UI.mouse.drag={};c.UI.toggleTest(true);assert.equal(c.document.pointerLockElement,c.canvas);
 assert.equal(c.UI.el.test.classList.contains('hidden'),false);
 assert.equal(c.UI.mouse.drag,null);assert.equal(c.UI.keys.ArrowRight,undefined);
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
for(const locked of [false,true])test((locked?'locked':'ordinary')+' mouse-up preserves an empty drag selection unless its option is enabled',()=>{
 const c=camera();c.setGame(`const MAX_SELECT=24;GAME.control=0;
  GAME.entities=[{id:1,type:'marine',owner:0,x:1800,y:1800,r:8,isBuilding:false,def:{}}];UI.setSelection(GAME.entities);`);
 c.UI.bindInput();if(locked)c.UI.toggleMouseLock();
 const drag=()=>{
  c.UI.mouse.x=120;c.UI.mouse.y=140;
  c.canvasEvents.mousedown({button:0,clientX:120,clientY:140,isTrusted:true});
  c.windowEvents.mousemove({clientX:220,clientY:220,movementX:100,movementY:80,target:c.canvas});
  c.windowEvents.mouseup({button:0,clientX:220,clientY:220,isTrusted:true});
 };
 const previous=c.UI.selection;drag();assert.equal(c.UI.selection,previous);assert.equal(c.UI.selection.length,1);
 assert.equal(c.UI.mouse.drag,null);if(locked)assert.equal(c.document.pointerLockElement,c.canvas);
 c.UI.clearSelectionOnEmpty=true;drag();assert.equal(c.UI.selection.length,0);
 if(locked)assert.equal(c.document.pointerLockElement,c.canvas);
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
test('locking with F10 already visible keeps the panel open',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleTest(true);c.UI.toggleMouseLock();
 assert.equal(c.UI.el.test.classList.contains('hidden'),false);assert.equal(c.document.pointerLockElement,c.canvas);
});
test('clicking the HUD F10 button opens and closes F10 without any unlock or extra request',()=>{
 const c=camera();c.UI.bindInput();let exits=0,requests=0;
 c.document.exitPointerLock=()=>{exits++;};
 c.canvas.requestPointerLock=()=>{requests++;c.document.pointerLockElement=c.canvas;c.documentEvents.pointerlockchange();};
 c.UI.toggleMouseLock();const button=c.node('button');button.id='hud-f10';button.onclick=()=>c.UI.toggleTest();c.hit(button);
 for(let i=0;i<4;i++){
  c.canvasEvents.mousedown({button:0,preventDefault(){}});c.windowEvents.mouseup({button:0,isTrusted:true});
  assert.equal(c.document.pointerLockElement,c.canvas);assert.equal(c.UI.el.test.classList.contains('hidden'),i%2===1);
 }
 assert.equal(exits,0);assert.equal(requests,1);
});
test('F10 key and focused-input F10 both retain the actual pointer lock',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();
 c.UI.keyDown({key:'F10',preventDefault(){}});
 assert.equal(c.document.pointerLockElement,c.canvas);assert.equal(c.UI.el.mouseLock['aria-pressed'],'true');
 assert.equal(c.UI.el.pointerCursor.classList.contains('hidden'),false);
 c.UI.keyDown({key:'F10',target:{tagName:'INPUT'},preventDefault(){}});
 assert.equal(c.document.pointerLockElement,c.canvas);assert.equal(c.UI.el.test.classList.contains('hidden'),true);
});
test('help and F10 can coexist and close without releasing an active lock',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);c.UI.toggleHelp(true);
 c.UI.toggleTest(false);assert.equal(c.document.pointerLockElement,c.canvas);
 c.UI.toggleHelp(false);assert.equal(c.document.pointerLockElement,c.canvas);
 c.UI.keyDown({key:'F1',preventDefault(){}});assert.equal(c.document.pointerLockElement,c.canvas);
 c.UI.keyDown({key:'F1',preventDefault(){}});assert.equal(c.document.pointerLockElement,c.canvas);
 c.UI.keyDown({key:'F1',target:{tagName:'INPUT'},preventDefault(){}});assert.equal(c.UI.el.help.classList.contains('hidden'),false);
 assert.equal(c.document.pointerLockElement,c.canvas);
});
test('menus never enable pointer lock when the setting is off',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleTest(true);c.UI.toggleHelp(true);c.UI.toggleTest(false);c.UI.toggleHelp(false);
 assert.equal(c.document.pointerLockElement,null);assert.equal(c.UI.lockWanted,false);
});
test('a delayed initial lock can finish while F10 is open and remains locked',()=>{
 const c=camera();c.UI.bindInput();let requests=0;c.canvas.requestPointerLock=()=>{requests++;};c.UI.toggleMouseLock();
 c.UI.toggleTest(true);c.document.pointerLockElement=c.canvas;c.documentEvents.pointerlockchange();
 assert.equal(c.document.pointerLockElement,c.canvas);assert.equal(c.UI.el.test.classList.contains('hidden'),false);
 c.UI.toggleTest(false);assert.equal(requests,1);
});
test('Escape, explicit disable, focus loss, hidden tab and game end still release an open-menu lock',()=>{
 for(const action of ['Escape','disable','blur','hidden','game end']){
  const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);
  if(action==='Escape')c.UI.keyDown({key:'Escape'});
  else if(action==='disable')c.UI.toggleMouseLock();
  else if(action==='blur')c.windowEvents.blur();
  else if(action==='hidden'){c.document.hidden=true;c.documentEvents.visibilitychange();c.document.hidden=false;}
  else{c.setGame('GAME.over=true');c.UI.releaseMouse();}
  assert.equal(c.document.pointerLockElement,null,action);assert.equal(c.UI.lockWanted,false,action);
  c.UI.toggleTest(false);assert.equal(c.document.pointerLockElement,null,action);
 }
});
test('a browser escape gesture clears the setting without automatic relocking',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);
 c.document.pointerLockElement=null;c.documentEvents.pointerlockchange();
 assert.equal(c.UI.lockWanted,false);assert.equal(c.UI.el.mouseLock['aria-pressed'],'false');
 c.UI.toggleTest(false);assert.equal(c.document.pointerLockElement,null);
});
test('Escape cancels a pending initial request even if it completes after F10 opens',()=>{
 const c=camera();c.UI.bindInput();c.canvas.requestPointerLock=()=>{};c.UI.toggleMouseLock();c.UI.toggleTest(true);
 c.UI.keyDown({key:'Escape',target:{tagName:'INPUT'}});assert.equal(c.UI.lockWanted,false);
 c.document.pointerLockElement=c.canvas;c.documentEvents.pointerlockchange();
 assert.equal(c.document.pointerLockElement,null);assert.equal(c.UI.lockWanted,false);
});
test('late promise rejection from a released request cannot cancel a later lock request',()=>{
 const c=camera();c.UI.bindInput();let oldFail,requests=0;
 c.canvas.requestPointerLock=()=>{requests++;return{catch(fn){if(requests===1)oldFail=fn;}};};
 c.UI.toggleMouseLock();c.document.pointerLockElement=c.canvas;c.documentEvents.pointerlockchange();c.UI.releaseMouse();c.UI.toggleMouseLock();
 oldFail();assert.equal(c.UI.lockPending,true);assert.equal(c.UI.lockWanted,true);
 c.document.pointerLockElement=c.canvas;c.documentEvents.pointerlockchange();assert.equal(c.UI.lockPending,false);
});
test('a locked checkbox click toggles the menu setting once without reaching the map',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);
 const input=c.node('input');input.type='checkbox';input.checked=true;let changes=0;input.onchange=()=>changes++;
 c.hit(input);let commands=0;c.UI.rightClick=()=>commands++;
 c.canvasEvents.mousedown({button:0,preventDefault(){}});c.windowEvents.mouseup({button:0,isTrusted:true});
 assert.equal(input.checked,false);assert.equal(changes,1);assert.equal(commands,0);assert.equal(c.document.pointerLockElement,c.canvas);
});
test('locked numeric input receives keyboard focus and count buttons enforce bounds',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);
 const input=c.node('input');input.type='number';input.min='1';input.max='50';input.value='5';let changes=0;input.oninput=()=>changes++;
 c.hit(input);c.canvasEvents.mousedown({button:0,preventDefault(){}});
 assert.equal(c.document.activeElement,input);assert.equal(input.textSelected,true);assert.equal(c.UI.mouse.drag,null);
 const button=c.node('button');button.onclick=()=>c.UI.stepMenuNumber(input,1);c.hit(button);
 c.canvasEvents.mousedown({button:0,preventDefault(){}});c.windowEvents.mouseup({button:0,isTrusted:true});assert.equal(input.value,'6');
 input.value='50';c.UI.stepMenuNumber(input,1);assert.equal(input.value,'50');
 input.value='1';c.UI.stepMenuNumber(input,-1);assert.equal(input.value,'1');assert.equal(changes,3);
 assert.equal(c.document.pointerLockElement,c.canvas);
});
test('a locked range drag updates quantized values across the entire track and never zooms the map',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);
 const input=c.node('input');input.type='range';input.min='.5';input.max='3';input.step='.25';input.rect={left:100,width:200};
 let updates=0,commits=0;input.oninput=()=>updates++;input.onchange=()=>commits++;
 c.hit(input);c.UI.mouse.x=100;c.canvasEvents.mousedown({button:0,preventDefault(){}});assert.equal(input.value,'0.5');
 c.windowEvents.mousemove({movementX:100,movementY:0,target:c.canvas});assert.equal(input.value,'1.75');
 c.windowEvents.mousemove({movementX:1000,movementY:0,target:c.canvas});assert.equal(input.value,'3');
 c.windowEvents.mouseup({button:0,isTrusted:true});assert.equal(commits,1);assert.equal(updates,3);
 assert.equal(c.UI.lockedInputDrag,null);assert.equal(c.UI.mouse.drag,null);assert.equal(c.document.pointerLockElement,c.canvas);
});
test('locked title dragging moves and clamps the same F10 panel without pointer capture or unlock',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);
 c.UI.el.test.style={};c.UI.el.test.getBoundingClientRect=()=>({width:300,height:150});c.UI.testPosition={x:12,y:160};
 const header=c.node('div');header.id='t-drag';const text=c.node('span');header.appendChild(text);c.hit(text);
 c.UI.mouse.x=100;c.UI.mouse.y=170;c.canvasEvents.mousedown({button:0,preventDefault(){}});
 c.windowEvents.mousemove({movementX:200,movementY:80,target:c.canvas});assert.equal(c.UI.el.test.style.left,'212px');assert.equal(c.UI.el.test.style.top,'240px');
 c.windowEvents.mousemove({movementX:2000,movementY:2000,target:c.canvas});assert.equal(c.UI.testPosition.x,688);assert.equal(c.UI.testPosition.y,466);
 c.windowEvents.mouseup({button:0,isTrusted:true});assert.equal(c.UI.testDrag,null);assert.equal(c.UI.mouse.drag,null);
 assert.equal(c.document.pointerLockElement,c.canvas);
});
test('locked F10 title hover changes the visible cursor, including nested text and active targeting',()=>{
 const c=cursorCamera(),header=c.node('div'),text=c.node('small');header.id='t-drag';header.appendChild(text);
 c.hit(c.canvas);c.UI.updateCursor();const normal=c.UI.el.pointerCursor.src;
 c.UI.mode={kind:'target'};c.hit(text);c.windowEvents.mousemove({movementX:10,movementY:0,target:c.canvas});
 const move=c.UI.el.pointerCursor.src;assert.notEqual(move,normal);assert.equal(move,c.UI.cursorImages.get(c.UI.cur.move).src);
 assert.equal(c.UI.el.pointerCursor.style.left,(c.UI.mouse.x-16)+'px');assert.equal(c.UI.el.pointerCursor.style.top,(c.UI.mouse.y-16)+'px');
 const close=c.node('button');header.appendChild(close);c.hit(close);c.windowEvents.mousemove({movementX:0,movementY:0,target:c.canvas});
 assert.equal(c.UI.el.pointerCursor.src,normal,'the close button is not the draggable title');
 assert.equal(c.document.pointerLockElement,c.canvas);
});
test('locked F10 drag shows grabbing immediately, keeps it outside the title and restores on release',()=>{
 const c=cursorCamera(),header=c.node('div');header.id='t-drag';c.hit(header);c.UI.updateCursor();const move=c.UI.el.pointerCursor.src;
 c.canvasEvents.mousedown({button:0,preventDefault(){}});const grabbing=c.UI.el.pointerCursor.src;
 assert.notEqual(grabbing,move);assert.equal(grabbing,c.UI.cursorImages.get(c.UI.cur.grabbing).src);
 c.hit(c.canvas);c.windowEvents.mousemove({movementX:100,movementY:80,target:c.canvas});assert.equal(c.UI.el.pointerCursor.src,grabbing);
 c.windowEvents.mouseup({button:0,isTrusted:true});assert.equal(c.UI.el.pointerCursor.src,c.UI.cursorImages.get(c.UI.cur.normal).src);
 c.hit(header);c.UI.updateCursor();c.canvasEvents.mousedown({button:0,preventDefault(){}});c.windowEvents.mouseup({button:0,isTrusted:true});
 assert.equal(c.UI.el.pointerCursor.src,move,'release over the title restores its move cursor');
 assert.equal(c.document.pointerLockElement,c.canvas);assert.equal(c.UI.mouse.drag,null);
});
test('closing or cancelling a locked F10 drag clears the grabbing cursor without a relock',()=>{
 for(const action of ['close','resize','unlock']){
  const c=cursorCamera(),header=c.node('div');header.id='t-drag';c.hit(header);c.UI.updateCursor();
  c.canvasEvents.mousedown({button:0,preventDefault(){}});c.hit(c.canvas);
  if(action==='close')c.UI.toggleTest(false);
  else if(action==='resize')c.windowEvents.resize();
  else c.UI.releaseMouse();
  assert.equal(c.UI.testDrag,null,action);assert.equal(c.UI.el.pointerCursor.src,c.UI.cursorImages.get(c.UI.cur.normal).src,action);
  assert.equal(c.document.pointerLockElement,action==='unlock'?null:c.canvas,action);
  if(action==='unlock')assert.equal(c.UI.el.pointerCursor.classList.contains('hidden'),true);
 }
});
function picker(c){
 const row=c.node('div'),select=c.node('select');select.id='t-type';select.value='scv';row.appendChild(select);
 select.options=['SCV','다크 템플러','배럭'].map((text,i)=>{const o=c.node('option');o.textContent=text;o.value=['scv','darktemplar','barracks'][i];o.selected=i===0;return o;});
 Object.defineProperty(select,'selectedOptions',{get(){return select.options.filter(o=>o.value===select.value);}});
 c.UI.installMenuSelect(select,'스폰 대상');return{select,trigger:row.children.find(n=>n.tagName==='BUTTON')};
}
test('the locked dropdown opens in the game, selects a unit and fires the backing select change once',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);
 const {select,trigger}=picker(c);let previews=0,changes=0;select.onpointerdown=()=>previews++;select.onchange=()=>changes++;
 c.hit(trigger);c.canvasEvents.mousedown({button:0,preventDefault(){}});c.windowEvents.mouseup({button:0,isTrusted:true});
 assert.equal(c.UI.menuSelect.popup.parentNode,c.document.body);assert.equal(previews,1);assert.equal(trigger['aria-expanded'],'true');
 c.hit(c.UI.menuSelect.options[1]);c.canvasEvents.mousedown({button:0,preventDefault(){}});c.windowEvents.mouseup({button:0,isTrusted:true});
 assert.equal(select.value,'darktemplar');assert.equal(changes,1);assert.equal(trigger.textContent,'다크 템플러 ▾');assert.equal(c.UI.menuSelect,null);
 assert.equal(c.document.pointerLockElement,c.canvas);
});
test('dropdown keyboard navigation and wheel scroll stay inside the game while locked',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);const {select,trigger}=picker(c);trigger.click();
 const popup=c.UI.menuSelect.popup;c.hit(popup);const scale=c.VIEW.scale;
 c.canvasEvents.wheel({deltaY:100,preventDefault(){}});assert.equal(popup.scrollTop,100);assert.equal(c.VIEW.scale,scale);
 let prevented=0;c.UI.keyDown({key:'ArrowDown',preventDefault(){prevented++;}});c.UI.keyDown({key:'Enter',preventDefault(){prevented++;}});
 assert.equal(select.value,'darktemplar');assert.equal(prevented,2);assert.equal(c.document.pointerLockElement,c.canvas);
});
test('spawn list reopens at its exact previous scroll position after selection, dismissal and F10',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);const {select,trigger}=picker(c);trigger.click();
 c.UI.menuSelect.popup.scrollTop=143;c.UI.chooseMenuSelect('darktemplar');trigger.click();
 assert.equal(select.value,'darktemplar');assert.equal(c.UI.menuSelect.popup.scrollTop,143);
 c.UI.menuSelect.popup.scrollTop=219;c.UI.closeMenuSelect();trigger.click();assert.equal(c.UI.menuSelect.popup.scrollTop,219);
 c.UI.menuSelect.popup.scrollTop=312;c.UI.toggleTest(false);c.UI.toggleTest(true);trigger.click();
 assert.equal(c.UI.menuSelect.popup.scrollTop,312);assert.equal(c.document.pointerLockElement,c.canvas);
});
test('each spawn menu list keeps its own position and external changes reveal the newly selected option',()=>{
 const c=camera(),a=picker(c),b=picker(c);a.trigger.click();c.UI.menuSelect.popup.scrollTop=88;c.UI.chooseMenuSelect('darktemplar');
 b.trigger.click();c.UI.menuSelect.popup.scrollTop=177;c.UI.chooseMenuSelect('barracks');
 a.trigger.click();assert.equal(c.UI.menuSelect.popup.scrollTop,88);c.UI.closeMenuSelect();
 b.trigger.click();assert.equal(c.UI.menuSelect.popup.scrollTop,177);c.UI.closeMenuSelect();
 a.select.value='barracks';a.trigger.click();assert.equal(c.UI.menuSelect.options[2].scrolled,true);
});
test('minimap camera indicator stays square, centered when possible and inside the map at every edge and zoom',()=>{
 const c=camera();
 for(const scale of [1,1.25,2,3])for(const pos of [[1800,1800],[0,0],[4096-c.VIEW.w,4096-c.VIEW.h]]){
  c.VIEW.scale=scale;[c.VIEW.x,c.VIEW.y]=pos;const before={...c.VIEW},box=c.UI.minimapViewport();
  assert.ok(box.size>0);assert.ok(box.x>=0&&box.y>=0);assert.ok(box.x+box.size<=127&&box.y+box.size<=127);
  if(pos[0]===1800){near(box.x+box.size/2,(c.VIEW.x+c.VIEW.w/2)/32);near(box.y+box.size/2,(c.VIEW.y+(c.VIEW.h-c.UI.consoleH()/scale)/2)/32);}
  assert.deepEqual({...c.VIEW},before,'indicator does not distort the actual game camera');
 }
});
test('a click outside the dropdown only dismisses it; F10 closes its popup while retaining lock',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();c.UI.toggleTest(true);const {trigger}=picker(c);trigger.click();
 c.hit(c.canvas);let commands=0;c.UI.rightClick=()=>commands++;c.canvasEvents.mousedown({button:2,preventDefault(){}});
 assert.equal(c.UI.menuSelect,null);assert.equal(commands,0);assert.equal(c.document.pointerLockElement,c.canvas);
 trigger.click();c.UI.keyDown({key:'F10',preventDefault(){}});assert.equal(c.UI.menuSelect,null);assert.equal(c.UI.el.test.classList.contains('hidden'),true);
 assert.equal(c.document.pointerLockElement,c.canvas);
});
test('hover feedback follows the locked cursor over menu controls without unlocking',()=>{
 const c=camera();c.UI.bindInput();c.UI.toggleMouseLock();const button=c.node('button');c.hit(button);
 c.windowEvents.mousemove({movementX:10,movementY:0,target:c.canvas});assert.equal(button.classList.contains('locked-hover'),true);
 c.hit(c.canvas);c.windowEvents.mousemove({movementX:10,movementY:0,target:c.canvas});assert.equal(button.classList.contains('locked-hover'),false);
 assert.equal(c.document.pointerLockElement,c.canvas);
});
