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
  function mineral(tx,ty){const m=createBuilding('mineral',NEUTRAL,tx,ty,true);m.amount=1500;return m;}
  function worker(type,x,y,m){const w=createUnit(type,0,x,y);w.dir=w.velocityDirection=Math.atan2(m.y-y,m.x-x);w.issue({t:'gather',tgt:m,phase:'go'});return w;}
  function firstMine(w,limit=240){let traveled=0;for(let i=0;i<limit;i++){
   const x=w.x,y=w.y;gameTick();const step=dist(x,y,w.x,w.y);traveled+=step;
   assert.ok(step<=w.speed+1e-5,'mining approach uses real movement, without teleporting');
   assert.ok(PF.positionClear(w.x,w.y,Math.max(3,w.r*.75),0),'worker stays outside occupied terrain');
   if(w.orders[0]?.phase==='mine')return {tick:GAME.tick,x:w.x,y:w.y,traveled,target:w.orders[0].tgt};
  }return null;}
 `,ctx);
 return vm.runInContext(code,ctx);
}
for(const type of ['scv','drone','probe'])for(const side of ['bottom','top','left','right'])
test(type+' mines the approached side of a connected mineral line from '+side,()=>world(`
 const vertical=${side==='left'||side==='right'};
 const fields=Array.from({length:8},(_,i)=>mineral(20+(vertical?0:i*2),20+(vertical?i:0))),m=fields[3];
 const dx=${side==='left'?-180:side==='right'?180:0},dy=${side==='top'?-180:side==='bottom'?180:0};
 const w=worker('${type}',m.x+dx,m.y+dy,m),result=firstMine(w,80);
 assert.ok(result,'must begin mining from the available near side');
 assert.equal(result.target,m);assert.ok((result.x-m.x)*dx+(result.y-m.y)*dy>0,'must not go around the mineral line to its far side');
 assert.ok(result.traveled<175,'near-side approach must not circle the line; traveled '+result.traveled);
 assert.ok(edgeDist(w,m)<=3);assert.equal(m.miner,w);assert.equal(w.gathering,true);assert.equal(w.noCollide,false);
`));
test('an unreachable near-side pocket cannot win over a reachable resource edge',()=>world(`
 const m=mineral(20,20);
 for(const x of [19,22])for(const y of [21,22])MAP.walk[tIdx(x,y)]=0;
 for(const x of [20,21])MAP.walk[tIdx(x,22)]=0;
 const w=worker('scv',m.x,m.y+180,m),result=firstMine(w);
 assert.ok(result,'worker must reach another accessible edge');
 assert.ok(Math.abs(result.x-m.x)>m.hw,'sealed bottom pocket must not be treated as arrival');
 assert.ok(edgeDist(w,m)<=3);
`));
test('a completely blocked mineral keeps the gather order and resumes when an edge opens',()=>world(`
 const m=mineral(20,20);
 for(let y=19;y<=21;y++)for(let x=19;x<=22;x++)if(y===19||y===21||x===19||x===22)MAP.walk[tIdx(x,y)]=0;
 const w=worker('scv',m.x,m.y+180,m);
 assert.equal(firstMine(w,96),null);assert.equal(w.orders[0].t,'gather');assert.equal(w.orders[0].tgt,m);
 assert.equal(w.carry,0);assert.equal(m.amount,1500);assert.ok(!m.miner);
 for(const x of [20,21])MAP.walk[tIdx(x,21)]=1;
 assert.ok(firstMine(w,120),'opened near edge must become usable');
`));
test('a newly occupied cached approach is replaced with another legal mineral edge',()=>world(`
 const m=mineral(20,20),w=worker('scv',m.x,m.y+220,m);gameTick();
 const [x,y]=w.path.at(-1);
 const blocker=createBuilding('depot',1,tileOf(x)-1,tileOf(y),true);
 const result=firstMine(w);assert.ok(result);assert.ok(edgeDist(w,m)<=3);
 assert.ok(PF.positionClear(w.x,w.y,Math.max(3,w.r*.75),0));
 assert.ok(!blocker.dead);
`));
test('all eight compact map bases are mined on the home side by all three worker types',()=>{
 for(const type of ['scv','drone','probe'])world(`
  generateMap(1998);
  for(const r of MAP.resources)if(r.type==='mineral')mineral(r.tx,r.ty);
  const miners=[];
  for(const b of MAP.bases){const x=(b.tx+2)*TILE,y=(b.ty+1.5)*TILE;
   for(const m of GAME.entities.filter(e=>e.type==='mineral'&&dist(e.x,e.y,x,y)<12*TILE))miners.push({w:worker('${type}',x,y,m),x,y});
  }
  const seen=new Set();
  for(let n=0;n<240&&seen.size<miners.length;n++){
   gameTick();for(const {w,x,y}of miners)if(!seen.has(w.id)&&w.orders[0]?.phase==='mine'){
    const m=w.orders[0].tgt;assert.ok((w.x-m.x)*(x-m.x)+(w.y-m.y)*(y-m.y)>0,'worker must mine toward its base');seen.add(w.id);
   }
  }
  assert.equal(miners.length,64);assert.equal(seen.size,64,'every field must be accessible from its home side');
 `);
});
test('the actual starting scenario harvests and deposits without mining behind the line',()=>world(`
 setupScenario(1998);GAME.aiOn=[false,false];GAME.sandbox=true;GAME.revealAll=true;
 const hall=GAME.entities.find(e=>e.type==='cc'),workers=GAME.entities.filter(e=>e.type==='scv'),seen=new Set();
 for(let n=0;n<400;n++){
  gameTick();for(const w of workers)if(!seen.has(w.id)&&w.orders[0]?.phase==='mine'){
   const m=w.orders[0].tgt;assert.ok((w.x-m.x)*(hall.x-m.x)+(w.y-m.y)*(hall.y-m.y)>0,'starting SCV mines on the base side');seen.add(w.id);
  }
 }
 assert.equal(seen.size,10);assert.ok(P(0).min>50,'real cargo must be returned');
 for(const w of workers){w.issue({t:'stop'});assert.equal(w.noCollide,false,'ordinary orders restore body collision');}
`));
