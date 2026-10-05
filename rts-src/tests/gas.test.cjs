'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
function world(code){
 const ctx=vm.createContext({assert,console,SND:{play(){}},UI:{clickFx(){},message(){},underAttack(){}}});
 const root=process.env.RTS_SOURCE_DIR||path.join(__dirname,'../src/js');
 for(const n of ['data','content','map','path','game','entity','combat','commands'])
  vm.runInContext(fs.readFileSync(path.join(root,n+'.js'),'utf8'),ctx);
 return vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);
  GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.sandbox=true;GAME.revealAll=true;
  let rng=42;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
  function gas(type='geyser'){const g=createBuilding(type,type==='geyser'?NEUTRAL:0,20,20,true);
   if(type==='geyser')g.amount=5000;else g.geyser={amount:5000};return g;}
  function worker(type,g,dx,dy){const w=createUnit(type,0,g.x+dx,g.y+dy);
   w.dir=w.velocityDirection=Math.atan2(-dy,-dx);smartCommand([w],g.x,g.y,g);return w;}
  function approach(w,g,limit=240){let travel=0;const sx=w.x,sy=w.y;
   for(let n=0;n<limit;n++){const x=w.x,y=w.y;gameTick();
    const step=dist(x,y,w.x,w.y);assert.ok(step<=w.speed+1e-5,'approach exceeds worker speed');travel+=step;
    assert.ok(PF.positionClear(w.x,w.y,Math.max(3,w.r*.75),0),'approach crosses occupied terrain');
    if(edgeDist(w,g)<=3)return {tick:GAME.tick,x:w.x,y:w.y,travel,sx,sy};
   }return null;}
  ${code}`,ctx);
}
const races=[['scv','refinery','cc'],['drone','extractor','hatchery'],['probe','assimilator','nexus']];
for(const [type,refinery,hall] of races){
 for(const refined of [false,true])for(const side of ['top','bottom','left','right'])
  test(type+' approaches '+(refined?refinery:'raw gas')+' on its near '+side+' edge',()=>world(`
   const g=gas('${refined?refinery:'geyser'}'),dx=${side==='left'?-160:side==='right'?160:0},dy=${side==='top'?-160:side==='bottom'?160:0};
   const w=worker('${type}',g,dx,dy),result=approach(w,g,60);
   assert.ok(result,'reachable near gas edge is missed');
   assert.ok((w.x-g.x)*dx+(w.y-g.y)*dy>0,'worker circles to the wrong gas side');
   assert.ok(Math.abs(dx?w.y-g.y:w.x-g.x)<2,'worker takes a sideways detour to occupied gas center');
   const direct=160-(dx?g.hw:g.hh)-w.r;
   assert.ok(result.travel<=direct+8,'gas approach is unnecessarily long: '+result.travel);
   assert.equal(w.carry,0,'arrival alone creates cargo');
   if(!${refined}){gameTick();assert.equal(w.orders.length,0);assert.equal(w.gathering,false);assert.equal(g.amount,5000);}
   else{gameTick();assert.ok(w.hidden);assert.equal(g.gasUser,w);assert.equal(w.orders[0].phase,'in');}
  `));
 test(type+' raw-gas stack takes the near edge without fanning out during approach',()=>world(`
  const g=gas(),workers=Array.from({length:10},(_,i)=>worker('${type}',g,-8+i%2*4,-160+Math.floor(i/2)*4));
  const starts=workers.map(w=>w.x),seen=new Set();let stacked=false;
  for(let n=0;n<80&&seen.size<workers.length;n++){
   gameTick();workers.forEach((w,i)=>{if(seen.has(w))return;
    assert.ok(Math.abs(w.x-starts[i])<2,'gas approach stretches the stack sideways');
    if(edgeDist(w,g)<=3)seen.add(w);
    else{assert.equal(w.gathering,true);if(workers.some(o=>o!==w&&o.gathering&&dist(w.x,w.y,o.x,o.y)<(w.r+o.r)*.85))stacked=true;}
   });
  }
  assert.equal(seen.size,10);assert.ok(stacked);assert.equal(P(0).gas,0);
 `));
 test(type+' reaches another gas edge when the near side is sealed',()=>world(`
  const g=gas();for(let x=19;x<=24;x++)MAP.walk[tIdx(x,19)]=0;
  const w=worker('${type}',g,0,-190),r=approach(w,g);
  assert.ok(r,'sealed near edge prevents a reachable alternative');assert.ok(edgeDist(w,g)<=3);
  assert.ok(Math.abs(w.x-g.x)>g.hw||w.y>g.y,'arrival uses an unreachable near-side point');
 `));
 for(const gt of ['geyser',refinery])test(type+' retains inaccessible '+gt+' orders and resumes after an edge opens',()=>world(`
   const g=gas('${gt}');for(let y=19;y<=22;y++)for(let x=19;x<=24;x++)if(y===19||y===22||x===19||x===24)MAP.walk[tIdx(x,y)]=0;
   const w=worker('${type}',g,0,-190);assert.equal(approach(w,g,96),null);
   assert.equal(w.orders[0].t,'gather');assert.equal(w.orders[0].tgt,g);assert.ok(!w.hidden);assert.equal(w.carry,0);assert.ok(!g.gasUser);
   for(let x=20;x<=23;x++)MAP.walk[tIdx(x,19)]=1;
   assert.ok(approach(w,g,160),'opened gas edge never becomes reachable');
 `));
 test(type+' replaces a gas approach that a new building blocks',()=>world(`
  const g=gas(),w=worker('${type}',g,0,-220);gameTick();
  const p=w.path.at(-1);assert.ok(PF.positionClear(...p,w.r,0),'planned gas endpoint is occupied');
  createBuilding('depot',1,tileOf(p[0])-1,tileOf(p[1])-1,true);
  assert.ok(approach(w,g),'new obstacle leaves an obsolete gas endpoint');
 `));
 for(const gt of ['geyser',refinery])test(type+' immobility never counts as '+gt+' arrival',()=>world(`
   const g=gas('${gt}'),w=worker('${type}',g,0,-190);w.lockT=500;
   for(let n=0;n<80;n++)gameTick();
   assert.equal(w.orders[0]?.t,'gather');assert.ok(!w.hidden);assert.ok(edgeDist(w,g)>3);assert.equal(w.carry,0);assert.ok(!g.gasUser);
   w.lockT=0;assert.ok(approach(w,g),'unlocked worker fails to resume');
 `));
 test(type+' a completed refinery replaces the cached raw-gas target',()=>world(`
  const g=gas(),w=worker('${type}',g,0,-190);for(let n=0;n<12;n++)gameTick();
  occupy(g,false);g.hidden=true;const r=createBuilding('${refinery}',0,g.tx0,g.ty0,true);g.refinery=r;r.geyser=g;
  assert.ok(approach(w,r));gameTick();assert.equal(w.orders[0].tgt,r);assert.equal(w.orders[0].phase,'in');assert.equal(r.gasUser,w);
 `));
 test(type+' repeated gas and ordinary moves preserve orders and restore collision',()=>world(`
  const g=gas(),us=Array.from({length:10},(_,i)=>worker('${type}',g,-8+i%2*4,-180+Math.floor(i/2)*4));
  for(let cycle=0;cycle<4;cycle++){
   for(let n=0;n<16;n++)gameTick();commandUnits(us,{t:'move',x:g.x,y:g.y-220},false);
   for(const w of us){assert.equal(w.gathering,false);assert.equal(w.noCollide,false);}
   for(let n=0;n<16;n++){const ps=us.map(w=>[w.x,w.y]);gameTick();us.forEach((w,i)=>assert.ok(dist(...ps[i],w.x,w.y)<=w.speed+1e-5));}
   smartCommand(us,g.x,g.y,g);assert.ok(us.every(w=>w.orders[0].t==='gather'&&w.gathering));
  }
  for(let n=0;n<240;n++)gameTick();assert.ok(us.every(w=>!w.orders.length&&!w.gathering));assert.equal(P(0).gas,0);
 `));
 test(type+' chooses a free gas edge around an actual waiting worker',()=>world(`
  const g=gas('${refinery}'),inside=createUnit('${type}',0,g.x,g.y);
  inside.issue({t:'gather',tgt:g,phase:'in'});inside.hidden=true;inside.gasT=500;g.gasUser=inside;
  const q=worker('${type}',g,0,-g.hh-10),w=worker('${type}',g,0,-160);
  gameTick();assert.ok(q.orders[0].gasWaiting);assert.ok(!w.orders[0].gasWaiting);
  const p=w.path.at(-1);assert.ok(dist(...p,q.x,q.y)>(w.r+q.r)*.85,'occupied queue point remains the goal');
  assert.ok(approach(w,g),'waiting worker blocks every gas entrance');gameTick();
  assert.ok(w.orders[0].gasWaiting);assert.ok(!w.hidden);assert.equal(g.gasUser,inside);
  assert.ok(dist(w.x,w.y,q.x,q.y)>=(w.r+q.r)*.85-1e-5);assert.equal(g.geyser.amount,5000);
 `));
 test(type+' gas waiting, entry, exit and repeated deposits remain live',()=>world(`
  const g=gas('${refinery}'),h=createBuilding('${hall}',0,10,10,true),us=[];
  for(let i=0;i<5;i++)us.push(worker('${type}',g,-8+i*4,-160));
  const returns=new Map(us.map(w=>[w,0]));let waiting=false,entries=0;
  for(let n=0;n<3000;n++){
   const cargo=us.map(w=>w.carry),hidden=us.map(w=>w.hidden);gameTick();
   assert.ok(us.filter(w=>w.hidden).length<=1,'more than one worker enters occupied gas');
   us.forEach((w,i)=>{if(w.orders[0]?.gasWaiting){waiting=true;assert.ok(edgeDist(w,g)<=3,'gas waiting begins before real contact');}
    if(!hidden[i]&&w.hidden)entries++;if(cargo[i]>0&&w.carry===0)returns.set(w,returns.get(w)+1);});
  }
  assert.ok(waiting&&entries>10);assert.ok(us.every(w=>returns.get(w)>=2),'some workers stop in the gas queue');
  assert.ok(P(0).gas>80);assert.equal(5000-g.geyser.amount,P(0).gas+us.reduce((n,w)=>n+w.carry,0));
  assert.equal(P(0).min,50);assert.ok(!h.dead);
 `));
}
