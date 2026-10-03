'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
function world(code){
 const ctx=vm.createContext({console,assert,window:{addEventListener(){}},SND:{play(){}},
  ART:{resetTerrain(){},icon(){},cmdIcon(){}},RENDER:{centerOn(){}}});
 const root=process.env.RTS_SOURCE_DIR||path.join(__dirname,'../src/js');
 for(const f of ['data','content','map','path','game','entity','combat','commands','ai','ui','main'])
  vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx);
 vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);MAP.height.fill(0);
  GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.aiOn=[false,false];GAME.sandbox=true;GAME.revealAll=true;
  UI.message=()=>{};UI.clickFx=()=>{};UI.underAttack=()=>{};
  function loaded(type,b,dx,dy,kind='min',order='ret'){
   const w=createUnit(type,0,b.x+dx,b.y+dy);w.dir=w.velocityDirection=Math.atan2(-dy,-dx);
   w.carry=8;w.carryKind=kind;
   if(order==='ret')w.issue({t:'ret'});else{const m=createBuilding('mineral',NEUTRAL,34,20,true);m.amount=1500;w.issue({t:'gather',tgt:m,phase:'ret'});}
   return w;
  }
  function deposit(w,kind='min',limit=240){
   const before=P(0)[kind];let travel=0;
   for(let n=0;n<limit;n++){
    const x=w.x,y=w.y;gameTick();const step=dist(x,y,w.x,w.y);travel+=step;
    assert.ok(step<=w.speed+1e-5,'return must use actual movement without teleporting');
    assert.ok(PF.positionClear(w.x,w.y,Math.max(3,w.r*.75),0),'worker must stay outside actual building bodies');
    if(P(0)[kind]>before){assert.equal(P(0)[kind],before+8);assert.equal(w.carry,0);return {tick:GAME.tick,travel};}
   }return null;
  }
 `,ctx);
 return vm.runInContext(code,ctx);
}
// Independent expectations: units.dat L/U/R/D extents, including the 11px worker body.
for(const [type,hall,hx,hy]of [['scv','cc',58,41],['drone','hatchery',49,32],['drone','lair',49,32],['drone','hive',49,32],['probe','nexus',56,39]])
 for(const [side,dx,dy]of [['right',180,0],['left',-180,0],['bottom',0,180],['top',0,-180]])
 test(type+' returns at the '+hall+' body on the approached '+side+' face',()=>world(`
  const b=createBuilding('${hall}',0,20,20,true),w=loaded('${type}',b,${dx},${dy});
  const result=deposit(w);assert.ok(result,'cargo must be deposited');
  const gx=Math.max(0,Math.abs(w.x-b.x)-${hx}-11),gy=Math.max(0,Math.abs(w.y-b.y)-${hy}-11);
  assert.ok(Math.hypot(gx,gy)<=1.000001,'must touch the original body boundary, not the placement rectangle');
  assert.ok(Math.abs(${dx}===0?w.x-b.x:w.y-b.y)<.001,'must use the near face instead of an arbitrary corner');
  assert.ok(Math.abs(result.travel-(180-${dx===0?hy:hx}-12))<.001,'open approach must use the direct legal distance');
 `));
for(const [type,hall]of [['scv','cc'],['drone','hatchery'],['probe','nexus']])for(const order of ['ret','gather'])
 test(type+' credits gas only and restores the correct collision for '+order,()=>world(`
  const b=createBuilding('${hall}',0,20,20,true),w=loaded('${type}',b,180,0,'gas','${order}');
  const before=P(0).min;assert.ok(deposit(w,'gas'));assert.equal(P(0).min,before);
  if('${order}'==='gather'){assert.equal(w.orders[0].t,'gather');assert.equal(w.orders[0].phase,'go');assert.equal(w.noCollide,true);}
  else assert.equal(!!w.noCollide,false);
 `));
for(const type of ['scv','drone','probe'])for(const order of ['ret','gather'])
 test(type+' preserves unreachable cargo for '+order+' instead of depositing remotely',()=>world(`
  MAP.walk.fill(0);for(let y=10;y<=12;y++)for(let x=10;x<=12;x++)MAP.walk[tIdx(x,y)]=1;
  const b=createBuilding('hatchery',0,40,40,true),w=loaded('${type}',b,352-b.x,352-b.y,'min','${order}');
  const before=P(0).min;assert.equal(deposit(w,'min',32),null);assert.equal(w.carry,8);assert.equal(P(0).min,before);
  assert.equal(w.orders[0].t,'${order}');
  MAP.walk.fill(1);assert.ok(deposit(w,'min',420),'opening the terrain must resume the existing order');
 `));
test('a nearer inaccessible depot cannot starve return to a reachable owned depot',()=>world(`
 const near=createBuilding('hatchery',0,20,20,true),far=createBuilding('nexus',0,32,20,true);
 for(let y=19;y<=23;y++)for(let x=19;x<=24;x++)if(y===19||y===23||x===19||x===24)MAP.walk[tIdx(x,y)]=0;
 const w=loaded('drone',near,180,0);assert.ok(deposit(w));
 assert.ok(Math.hypot(Math.max(0,Math.abs(w.x-far.x)-56-11),Math.max(0,Math.abs(w.y-far.y)-39-11))<=1.000001);
`));
test('a return approach blocked by a new building is replanned without credit at a distance',()=>world(`
 const b=createBuilding('hatchery',0,20,20,true),w=loaded('drone',b,220,0);gameTick();
 const a=w.orders[0].depotApproach;assert.ok(a);createBuilding('depot',1,24,20,true);
 assert.ok(deposit(w));assert.ok(depotReturnDistance(w,b)<=1.000001);
`));
test('hatchery and lair upgrades retain an active resource depot',()=>{
 for(const hall of ['hatchery','lair'])world(`
  const b=createBuilding('${hall}',0,20,20,true);b.morph={to:'${hall==='hatchery'?'lair':'hive'}',prog:0,total:1500};
  const w=loaded('drone',b,180,0);assert.ok(deposit(w));assert.ok(b.morph);
 `);
});
test('construction tiles remain occupied while actual body margins permit ordinary movement and Stop',()=>world(`
 const b=createBuilding('hatchery',0,20,20,true),w=loaded('drone',b,0,180);assert.ok(deposit(w));
 assert.equal(MAP.occ[tIdx(22,22)],b.id);assert.equal(canPlace('depot',22,22,0,null,true),false);
 const x=w.x,y=w.y;w.issue({t:'stop'});gameTick();assert.equal(w.x,x);assert.equal(w.y,y);assert.equal(!!w.noCollide,false);
 w.issue({t:'move',x,y:y+100});for(let n=0;n<70;n++)gameTick();assert.ok(w.y>y+95);
 assert.equal(PF.positionClear(b.x,b.y,6,0),false,'the actual hatchery body remains solid');
`));

// A return can finish a curved approach just outside the legal deposit edge.
// Starting there reproduces the permanent stall without relying on a movement
// implementation or a particular random consumption order.
for(const [type,hall,hx,hy]of [['scv','cc',58,41],['drone','hatchery',49,32],['probe','nexus',56,39],['drone','lair',49,32],['drone','hive',49,32]])
 for(const order of ['ret','gather'])
 test(type+' completes the last fractional step at '+hall+' for '+order,()=>{
  for(const [dx,dy]of [[hx+12.0005,0],[-hx-12.0005,0],[0,hy+12.0005],[0,-hy-12.0005]])
   for(const kind of ['min','gas'])world(`
    const b=createBuilding('${hall}',0,20,20,true),w=loaded('${type}',b,${dx},${dy},'${kind}','${order}');
    const before=P(0)['${kind}'],x=w.x,y=w.y;
    assert.ok(depotReturnDistance(w,b)>1,'cargo begins outside the real deposit boundary');
    assert.ok(deposit(w,'${kind}',20),'fractional final step must deposit instead of stopping forever');
    assert.ok(dist(x,y,w.x,w.y)>0,'worker must actually move into the legal boundary');
    assert.ok(dist(x,y,w.x,w.y)<.001,'the last step must not jump or expand the deposit range');
    assert.ok(depotReturnDistance(w,b)<=1,'deposit range must remain one pixel');
    assert.equal(P(0)['${kind}'],before+8);
   `);
 });

test('long starting economy keeps every SCV and drone returning without a permanent cargo stall',()=>world(`
 setupScenario(1998);GAME.aiOn=[false,false];GAME.sandbox=true;
 const workers=GAME.entities.filter(e=>e.isWorker),last=new Map(),returns=new Map();
 for(let n=0;n<5000;n++){
  const cargo=workers.map(w=>w.carry);gameTick();
  workers.forEach((w,i)=>{
   if(cargo[i]>0&&!w.carry)returns.set(w,(returns.get(w)||0)+1);
   const previous=last.get(w)||{x:w.x,y:w.y,ticks:0};
   const waiting=w.carry>0&&w.orders[0]?.phase==='ret'&&dist(previous.x,previous.y,w.x,w.y)<1e-6;
   const ticks=waiting?previous.ticks+1:0;last.set(w,{x:w.x,y:w.y,ticks});
   assert.ok(ticks<120,w.type+' '+w.id+' must not stop permanently while carrying cargo');
  });
 }
 for(const w of workers)assert.ok((returns.get(w)||0)>=5,w.type+' '+w.id+' must keep completing return trips');
`));

for(const [type,hall]of [['scv','cc'],['drone','hatchery'],['probe','nexus']])
 test(type+' completes repeated mineral trips at a compact map base',()=>world(`
  generateMap(1998);
  for(const r of MAP.resources){const m=createBuilding(r.type,NEUTRAL,r.tx,r.ty,true);m.amount=r.amount;}
  const base=MAP.starts[0],b=createBuilding('${hall}',0,base.tx,base.ty,true);
  const minerals=GAME.entities.filter(e=>e.type==='mineral'&&dist(e.x,e.y,b.x,b.y)<12*TILE);
  const workers=minerals.map((m,i)=>{
   const w=createUnit('${type}',0,b.x+(i-3.5)*18,b.y+b.hh+16);
   w.lastRes=m;w.issue({t:'gather',tgt:m,phase:'go'});return w;
  });
  const last=new Map(),returns=new Map();
  for(let n=0;n<5000;n++){
   const cargo=workers.map(w=>w.carry);gameTick();
   workers.forEach((w,i)=>{
    if(cargo[i]>0&&!w.carry)returns.set(w,(returns.get(w)||0)+1);
    const previous=last.get(w)||{x:w.x,y:w.y,ticks:0};
    const ticks=w.carry>0&&w.orders[0]?.phase==='ret'&&dist(previous.x,previous.y,w.x,w.y)<1e-6?previous.ticks+1:0;
    last.set(w,{x:w.x,y:w.y,ticks});
    assert.ok(ticks<120,'loaded ${type} must keep progressing through return trips');
   });
  }
  assert.equal(workers.length,8);
  for(const w of workers)assert.ok((returns.get(w)||0)>=10,'every ${type} must repeatedly deliver cargo');
 `));
