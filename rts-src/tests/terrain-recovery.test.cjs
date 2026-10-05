'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
function world(code){
 const ctx=vm.createContext({assert,console,SND:{play(){}},UI:{clickFx(){},message(){},underAttack(){}}});
 const root=process.env.RTS_SOURCE_DIR||path.join(__dirname,'../src/js');
 for(const n of ['data','content','map','path','game','entity','combat','commands'])
  vm.runInContext(fs.readFileSync(path.join(root,n+'.js'),'utf8'),ctx);
 return vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);
  GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.sandbox=true;
  let rng=42;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
  function held(type,x,y){const u=createUnit(type,0,x,y);u.issue({t:'hold'});return u;}
  function steps(u,count,check=()=>{}){for(let i=0;i<count;i++){const x=u.x,y=u.y;gameTick();
   assert.ok(dist(x,y,u.x,u.y)<=u.speed+1e-6,'illegal-position recovery teleports beyond real movement speed');
   assert.equal(u.orders[0]?.t,'hold','recovery replaces hold');check(u,i);}}
  ${code}`,ctx);
}
for(const type of ['scv','drone','probe','marine','hydra','zealot'])
 for(const bt of ['mineral','geyser','cc','hatchery','nexus'])
 test(type+' recovers a pre-existing '+bt+' body overlap by walking, preserving hold',()=>world(`
  const b=createBuilding('${bt}',${bt==='mineral'||bt==='geyser'?'NEUTRAL':'0'},20,20,true),u=held('${type}',b.x,b.y);
  const before=[b.x,b.y];assert.ok(!PF.positionClear(u.x,u.y,u.r*.75,0));
  steps(u,180,()=>{assert.deepEqual([b.x,b.y],before);assert.ok(PF.positionClear(u.x,u.y,u.r*.75,b.id),'recovery crosses hard terrain');});
  assert.ok(PF.positionClear(u.x,u.y,u.r*.75,0),'body overlap never clears');
  const end=[u.x,u.y];steps(u,24);assert.deepEqual([u.x,u.y],end,'held unit keeps wandering after recovery');
 `));
for(const type of ['scv','drone','probe'])
 test(type+' cannot recover through water from a gas body on an isolated island',()=>world(`
  MAP.walk.fill(0);const g=createBuilding('geyser',NEUTRAL,20,20,true);
  for(let y=20;y<22;y++)for(let x=20;x<24;x++)MAP.walk[tIdx(x,y)]=1;
  for(let y=18;y<25;y++)for(let x=15;x<18;x++)MAP.walk[tIdx(x,y)]=1;
  const u=held('${type}',g.x,g.y);
  steps(u,180,()=>assert.ok(PF.positionClear(u.x,u.y,u.r*.75,g.id),'body recovery crosses unwalkable water to another island'));
  assert.ok(u.x>=g.x-g.hw&&u.x<=g.x+g.hw,'trapped unit reaches disconnected land');
 `));
for(const type of ['scv','drone','probe'])
 test(type+' deep unwalkable terrain is not a nearest-free-tile teleport',()=>world(`
  for(let y=18;y<24;y++)for(let x=18;x<24;x++)MAP.walk[tIdx(x,y)]=0;
  const u=held('${type}',21*TILE,21*TILE),start=[u.x,u.y];steps(u,40);
  assert.deepEqual([u.x,u.y],start,'a body with no legal departure jumps across hard terrain');
 `));
for(const type of ['scv','drone','probe','marine','hydra','zealot'])
 test(type+' existing recovery follows its path through a newly placed adjacent body and rechecks at arrival',()=>world(`
  const b=createBuilding('cc',0,20,20,true),u=held('${type}',b.x,b.y);
  gameTick();const d=createBuilding('depot',0,21,18,true),bodies=new Set([b.id,d.id]);let touched=false;
  steps(u,180,()=>{assert.ok(PF.positionClear(u.x,u.y,u.r*.75,bodies),'recovery crosses hard terrain');
   if(!PF.positionClear(u.x,u.y,u.r*.75,b.id))touched=true;});
  assert.ok(touched,'MoveToLegal incorrectly reapplies the adjacent building collision');
  assert.ok(PF.positionClear(u.x,u.y,u.r*.75,0),'recovery never returns to a legal ordinary position');
 `));
for(const type of ['scv','drone','probe','marine','hydra','zealot'])
 test(type+' illegal mobile overlap near water keeps the hard boundary',()=>world(`
  for(let y=0;y<MAP_H;y++)MAP.walk[tIdx(20,y)]=0;
  const a=held('${type}',20*TILE-24,650),b=held('marine',a.x,a.y);
  steps(a,160,()=>{assert.ok(PF.positionClear(a.x,a.y,a.r*.75,0),'recovery enters water');assert.ok(PF.positionClear(b.x,b.y,b.r*.75,0));});
  assert.ok(dist(a.x,a.y,b.x,b.y)>=(a.r+b.r)*.85-1e-6,'reachable overlap remains blocked');
 `));
for(const type of ['scv','drone','probe'])
 test(type+' harvesting cannot phase into a new building body',()=>world(`
  const g=createBuilding('geyser',NEUTRAL,26,20,true),b=createBuilding('cc',1,21,19,true);
  const u=createUnit('${type}',0,600,g.y);smartCommand([u],g.x,g.y,g);
  for(let i=0;i<160;i++){const x=u.x,y=u.y;gameTick();
   assert.ok(dist(x,y,u.x,u.y)<=u.speed+1e-6);assert.ok(PF.positionClear(u.x,u.y,u.r*.75,0),'ordinary harvest approach phases into a new fixed body');}
  assert.ok(edgeDist(u,g)<=3,'harvest approach cannot take the valid route around the building');
 `));
for(const [worker,army] of [['scv','marine'],['drone','hydra'],['probe','zealot']])
 test(worker+' and '+army+' crowd walks out of a building placed over ten held bodies',()=>world(`
  const us=Array.from({length:10},(_,i)=>held(i%2?'${army}':'${worker}',670+i%5*6,670+Math.floor(i/5)*6));
  const b=createBuilding('depot',0,20,20,true),fixed=[b.x,b.y];
  for(let i=0;i<240;i++){
   const before=us.map(u=>[u.x,u.y]);gameTick();assert.deepEqual([b.x,b.y],fixed);
   us.forEach((u,n)=>{assert.ok(dist(...before[n],u.x,u.y)<=u.speed+1e-6,'crowd recovery exceeds real speed');
    assert.equal(u.orders[0]?.t,'hold');assert.ok(PF.positionClear(u.x,u.y,u.r*.75,b.id));});
  }
  for(const u of us)assert.ok(PF.positionClear(u.x,u.y,u.r*.75,0),'a member of the crowd remains inside the new building');
 `));
for(const type of ['scv','drone','probe','marine','hydra','zealot'])
 for(const bt of ['mineral','geyser','depot','cc','hatchery','nexus'])
 test(type+' rubbing a stationary ground body can move across a nearby '+bt+' corner',()=>world(`
  const b=createBuilding('${bt}',${bt==='mineral'||bt==='geyser'?'NEUTRAL':'0'},20,20,true),box=bodyBox(b);
  const u=held('${type}',box.x-box.hw-UNITS['${type}'].r*.75-.1,box.y-box.hh-2),s=held('tank_siege',u.x-5,u.y);
  u.dir=u.velocityDirection=0;const fixed=[b.x,b.y,s.x,s.y];let touched=false;
  assert.ok(PF.positionClear(u.x,u.y,u.r*.75,0),'mover already starts inside the building');
  assert.ok(PF.positionClear(s.x,s.y,s.r*.75,0),'stationary blocker starts inside the building');
  steps(u,180,()=>{assert.deepEqual([b.x,b.y,s.x,s.y],fixed,'rubbing displaces a fixed body');
   assert.ok(PF.positionClear(u.x,u.y,u.r*.75,b.id),'rubbing crosses hard terrain');
   if(!PF.positionClear(u.x,u.y,u.r*.75,0))touched=true;});
  assert.ok(touched,'existing mobile overlap cannot follow a recovery path through the nearby body');
  assert.ok(PF.positionClear(u.x,u.y,u.r*.75,0),'ordinary body collision never returns');
 `));
for(const type of ['scv','drone','probe','marine','hydra','zealot'])
 test(type+' ordinary movement retains nearby resource collision without an illegal overlap',()=>world(`
  const b=createBuilding('mineral',NEUTRAL,20,20,true),box=bodyBox(b),u=createUnit('${type}',0,box.x-box.hw-UNITS['${type}'].r*.75-.1,box.y-box.hh-2);
  u.dir=u.velocityDirection=0;u.issue({t:'move',x:box.x+24,y:box.y-box.hh-32});
  for(let i=0;i<180;i++){const x=u.x,y=u.y;gameTick();assert.ok(dist(x,y,u.x,u.y)<=u.speed+1e-6);
   assert.ok(PF.positionClear(u.x,u.y,u.r*.75,0),'normal movement gains the rubbing exception');}
  assert.ok(dist(u.x,u.y,box.x+24,box.y-box.hh-32)<10,'ordinary movement cannot use the legal route');
 `));
for(const type of ['scv','drone','probe','marine','hydra','zealot'])
 test(type+' nearby resource on unwalkable tiles never overrides the terrain during rubbing',()=>world(`
  const b=createBuilding('mineral',NEUTRAL,20,20,true),box=bodyBox(b);
  MAP.walk[tIdx(20,20)]=MAP.walk[tIdx(21,20)]=0;
  const u=held('${type}',box.x-box.hw-UNITS['${type}'].r*.75-.1,box.y-box.hh-2),s=held('tank_siege',u.x-5,u.y);
  u.dir=u.velocityDirection=0;const fixed=[s.x,s.y];
  steps(u,180,()=>{assert.deepEqual([s.x,s.y],fixed);assert.ok(PF.positionClear(u.x,u.y,u.r*.75,b.id),'resource exception crosses water terrain');});
  assert.ok(dist(u.x,u.y,s.x,s.y)>=(u.r+s.r)*.85-1e-6,'hard terrain blocks every otherwise legal recovery');
 `));
