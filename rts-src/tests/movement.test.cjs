'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
function world(){
 const ctx=vm.createContext({console,SND:{play(){}},UI:{clickFx(){},message(){}}});
 const root=process.env.RTS_SOURCE_DIR||path.join(__dirname,'../src/js');
 for(const name of ['data','content','map','path','game','entity','combat','commands'])vm.runInContext(fs.readFileSync(path.join(root,name+'.js'),'utf8'),ctx);
 return vm.runInContext(`(()=>{MAP.walk.fill(1);MAP.occ.fill(0);GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.sandbox=true;let rng=42;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);return{GAME,MAP,PF,SH,gameTick,UNITS,GROUND_MOTION,groundCollider,collisionFixed,unit:(type,x=600,y=600)=>createUnit(type,0,x,y),step:gameTick};})()`,ctx);
}
const catalogue=world(),ground=Object.keys(catalogue.GROUND_MOTION),air=Object.keys(catalogue.UNITS).filter(t=>catalogue.UNITS[t].air&&catalogue.UNITS[t].speed>0);
for(const type of ground)test(type+' resumes its normal cruise speed after overlap recovery and stops afterward',()=>{
 const w=world(),a=w.unit(type),b=w.unit(type);a.issue({t:'hold'});b.issue({t:'hold'});
 for(let i=0;i<240;i++)w.step();assert.equal(a.groundRecovery,null);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=(a.r+b.r)*.85-1e-6);
 const angle=Math.atan2(a.y-b.y,a.x-b.x),x=a.x+Math.cos(angle)*800,y=a.y+Math.sin(angle)*800;
 a.issue({t:'move',x,y});let cruise=0;
 for(let i=0;i<80;i++){const px=a.x,py=a.y;w.step();const d=Math.hypot(a.x-px,a.y-py);assert.ok(d<=a.speed+1e-6);if(i>=60)cruise+=d;}
 assert.ok(cruise/20>=a.speed*.98,type+' retained a slow recovery speed');
 a.issue({t:'hold'});for(let i=0;i<4;i++)w.step();const pos=[a.x,a.y];for(let i=0;i<24;i++)w.step();assert.deepEqual([a.x,a.y],pos);assert.equal(a.currentSpeed,0);
});
for(const type of ['scv','drone','probe'])test(type+' traverses a straight local path without braking at every 8px grid point',()=>{
 const w=world(),e=w.unit(type,500,500);e.dir=e.velocityDirection=0;e.issue({t:'move',x:620,y:500});w.PF.resetBudget();
 e.path=w.PF.localPath(500,500,620,500,e.r,{units:[],cells:new Set()},null);
 e.pi=0;e.pgx=620;e.pgy=500;e.repathAt=9999;e.pathExact=true;e.pathDynamic=true;
 let arrival=null;for(let i=0;i<65;i++){w.step();if(!e.orders.length){arrival=i+1;break;}}
 assert.ok(arrival!==null,'worker remained slow on a verified straight segment');assert.ok(Math.hypot(e.x-620,e.y-500)<.001);
});
test('all flying types accelerate to their own cruise speed and ignore ground overlaps',()=>{
 for(const type of air){const w=world(),a=w.unit(type),b=w.unit('tank_siege');a.issue({t:'move',x:1600,y:600});
  a.orders[0].x=3000;
  for(let i=0;i<120;i++){const x=a.x,y=a.y;w.step();const moved=Math.hypot(a.x-x,a.y-y);assert.ok(moved<=a.speed+1e-6,type);if(i===0)assert.ok(moved>0&&moved<a.speed,type+' needs its DAT acceleration');if(i>=100)assert.ok(Math.abs(moved-a.speed)<1e-6,type+' cruise');assert.deepEqual([b.x,b.y],[600,600]);}
 }
});
test('ground speed upgrades, stim and ensnare affect actual movement and cancel correctly',()=>{
 for(const [type,tech] of [['zergling','metabolic'],['hydra','muscular'],['zealot','legs'],['vulture','ion'],['ultralisk','anabolic']]){
  const w=world(),e=w.unit(type);e.dir=e.velocityDirection=0;w.GAME.players[0].tech[tech]=true;e.issue({t:'move',x:1800,y:600});
  assert.equal(e.speed,Math.max(e.def.speed*1.5,10/3));
  for(let i=0;i<60;i++)w.step();let x=e.x;w.step();assert.ok(Math.abs(e.x-x-e.speed)<1e-6,type+' upgrade');
  e.ensnareT=200;for(let i=0;i<20;i++)w.step();x=e.x;w.step();assert.ok(Math.abs(e.x-x-e.def.speed)<1e-6,type+' upgrade/ensnare cancellation');
 }
 const w=world(),m=w.unit('marine');m.dir=m.velocityDirection=0;m.stimT=200;m.issue({t:'move',x:1800,y:600});w.step();assert.equal(m.x,606);
 m.ensnareT=200;w.step();assert.equal(m.x,610);m.stimT=0;w.step();assert.equal(m.x,612);
});
test('ground broad phase includes restored harvest bodies and excludes air, buildings, larvae and mines',()=>{
 const w=world(),worker=w.unit('scv'),held=w.unit('marine',622,600);held.issue({t:'hold'});worker.issue({t:'gather',phase:'go'});
 w.unit('wraith');w.unit('larva');w.unit('spider_mine');w.SH.clear();for(const e of w.GAME.entities)w.SH.insert(e);
 worker.issue({t:'move',x:750,y:600});const near=w.SH.queryGround(600,600,64);
 assert.ok(near.includes(worker)&&near.includes(held));assert.equal(near.length,2);
 const start=[held.x,held.y];for(let i=0;i<40;i++)w.step();assert.deepEqual([held.x,held.y],start);
});
test('large stationary armies keep collision candidates local across spatial cell boundaries',()=>{
 const w=world();for(let i=0;i<1000;i++)w.unit(i%4?'marine':'scv',400+(i%40)*24,400+Math.floor(i/40)*24);
 w.SH.clear();for(const e of w.GAME.entities)w.SH.insert(e);
 for(const e of w.GAME.entities){const near=w.SH.queryGround(e.x,e.y,e.r+48);assert.ok(near.length<=32);for(const o of w.GAME.entities)if(Math.hypot(e.x-o.x,e.y-o.y)<(e.r+o.r)*.85)assert.ok(near.includes(o));}
});
test('indexed path collision checks agree with exhaustive checks for dense and distant obstacles',()=>{
 const w=world();for(let i=0;i<400;i++)w.unit(i%3?'marine':'dragoon',400+(i%25)*30,400+Math.floor(i/25)*30);
 const mover=w.unit('scv',300,300),units=w.PF.unitObstacles(mover,false).units,plain=units.slice();let seed=13;
 const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<300;i++){const ax=300+rand()*1000,ay=300+rand()*800,bx=300+rand()*1000,by=300+rand()*800;
  assert.equal(w.PF.unitsClear(ax,ay,bx,by,mover.r,units),w.PF.unitsClear(ax,ay,bx,by,mover.r,plain));}
});
test('enemy spatial queries reflect mind control immediately in the same tick',()=>{
 const w=world(),a=w.unit('marine'),b=w.unit('marine',615,600);w.SH.clear();for(const e of w.GAME.entities)w.SH.insert(e);
 assert.equal(w.SH.queryEnemy(600,600,100,0).length,0);
 b.owner=1;w.SH.ownerChanged(b);assert.ok(w.SH.queryEnemy(600,600,100,0).includes(b));
 assert.ok(w.SH.queryEnemy(600,600,100,1).includes(a));
 b.owner=0;w.SH.ownerChanged(b);assert.equal(w.SH.queryEnemy(600,600,100,0).length,0);
});
