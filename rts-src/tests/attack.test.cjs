'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
function world(code){
 const ctx=vm.createContext({console,assert,performance,SND:{play(){}},UI:{clickFx(){},message(){},underAttack(){}}});
 const root=process.env.RTS_SOURCE_DIR||path.join(__dirname,'../src/js');
 for(const file of ['data','content','map','path','game','entity','combat','commands'])
  vm.runInContext(fs.readFileSync(path.join(root,file+'.js'),'utf8'),ctx);
 vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);MAP.height.fill(0);
  GAME.players=[newPlayer('Z',0),newPlayer('T',1),newPlayer('N',2)];GAME.sandbox=true;GAME.revealAll=true;GAME.aiOn=[false,false];
  for(const v of GAME.vis)v.fill(3);for(const v of GAME.explored)v.fill(1);
  let seed=42;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  function unit(type,x,y,owner=0){return createUnit(type,owner,x,y);}
  function target(){const t=createBuilding('cc',1,24,24,true);t.hp=t.maxHp=100000;return t;}
  function ticks(n){for(let i=0;i<n;i++)gameTick();}
  function record(army){const first=new Map();for(const a of army){const fire=a.fire;
   a.fire=function(t,w){assert.ok(this.inRangeOf(t),'weapon fires only within its real range');a.shots=(a.shots||0)+1;
    if(!first.has(a.id))first.set(a.id,GAME.tick);return fire.call(this,t,w);};}return first;}
 `,ctx);
 return vm.runInContext(code,ctx);
}
for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])test('24 zerglings find building attack positions from direction '+angle.toFixed(2),()=>world(`
 const t=target(),angle=${angle};
 const army=Array.from({length:24},(_,i)=>{
  const dx=-260+i%4*20,dy=-130+Math.floor(i/4)*22;
  const a=unit('zergling',t.x+dx*Math.cos(angle)-dy*Math.sin(angle),t.y+dx*Math.sin(angle)+dy*Math.cos(angle));
  a.dir=a.velocityDirection=angle;a.issue({t:'attack',tgt:t});return a;
 });
 const first=record(army);
 for(let n=1;n<=168;n++){
  const before=army.map(a=>[a.x,a.y]);gameTick();
  for(let i=0;i<army.length;i++){
   const a=army[i];assert.ok(dist(...before[i],a.x,a.y)<=a.speed+1e-5,'attack approach cannot teleport or increase speed');
   assert.ok(PF.positionClear(a.x,a.y,Math.max(3,a.r*.75),0),'attack approach stays outside occupied terrain');
   for(let j=0;j<i;j++)assert.ok(dist(a.x,a.y,army[j].x,army[j].y)>=(a.r+army[j].r)*.85-1e-5,'ordinary attack movement cannot create a body overlap');
  }
  if(n===96)assert.ok(first.size>=17,'at least 17 attackers engage within four simulation seconds; got '+first.size);
 }
 assert.equal(first.size,24,'every attacker reaches a free melee position within seven simulation seconds');
 assert.ok(t.hp<t.maxHp,'real attacks inflict damage');
 assert.ok(army.every(a=>a.orders[0]?.tgt===t),'approach does not cancel attack orders');
`));
test('melee attackers use other building sides when legal Hold bodies occupy the near side',()=>world(`
 const t=target(),guards=Array.from({length:7},(_,i)=>unit('marine',t.x-hx(t)-12,t.y-60+i*20));
 for(const g of guards)g.issue({t:'hold'});
 const positions=guards.map(g=>[g.x,g.y]);
 const army=Array.from({length:12},(_,i)=>unit('zergling',t.x-220+i%3*20,t.y-110+Math.floor(i/3)*22));
 for(const a of army){a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:t});}
 const first=record(army);ticks(240);
 assert.equal(first.size,12,'blocked near-side attackers find free sides');
 assert.ok(army.some(a=>Math.abs(a.y-t.y)>hy(t)),'attackers actually occupy another side');
 for(let i=0;i<guards.length;i++){assert.deepEqual([guards[i].x,guards[i].y],positions[i]);assert.equal(guards[i].orders[0].t,'hold');}
`));
test('an inaccessible target keeps the attack order and retries when an edge becomes passable',()=>world(`
 const t=target();
 for(let y=23;y<=27;y++)for(let x=23;x<=28;x++)if(x===23||x===28||y===23||y===27)MAP.walk[tIdx(x,y)]=0;
 const a=unit('zergling',t.x-180,t.y);a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:t});
 const first=record([a]);ticks(72);assert.equal(first.size,0);assert.equal(a.orders[0].tgt,t);
 for(let y=24;y<=26;y++)MAP.walk[tIdx(28,y)]=1;
 ticks(240);assert.equal(first.size,1);assert.ok(a.x>t.x,'unit uses the opened far side');
`));
test('unreachable empty pockets on the near edge cannot starve accessible farther attack positions',()=>world(`
 const t=target();
 for(let y=23;y<=27;y++)MAP.walk[tIdx(22,y)]=0;
 for(const y of [23,27])MAP.walk[tIdx(23,y)]=0;
 const a=unit('zergling',t.x-180,t.y);a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:t});
 const first=record([a]);ticks(168);assert.equal(first.size,1);
 assert.ok(Math.abs(a.y-t.y)>hy(t),'unit reaches an accessible side outside the sealed near-side pocket');
`));
for(const type of ['zealot','dtemplar','firebat','ultralisk','scv','drone','probe'])test(type+' group attacks a building without altered speed or a central blocked goal',()=>world(`
 const t=target(),army=Array.from({length:6},(_,i)=>unit('${type}',t.x-220+i%2*42,t.y-80+Math.floor(i/2)*42));
 for(const a of army){a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:t});}
 const first=record(army);ticks(240);assert.equal(first.size,6);assert.ok(t.hp<t.maxHp);
`));
test('ground melee follows a moving target and responds immediately to a new attack command',()=>world(`
 const t=unit('scv',1000,900,1);t.hp=t.maxHp=100000;t.dir=t.velocityDirection=0;t.issue({t:'move',x:1300,y:1100});
 const a=unit('zergling',850,900);a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:t});
 const first=record([a]);ticks(180);assert.equal(first.size,1);assert.ok(t.x>1100);
 const b=createBuilding('cc',1,47,32,true);b.hp=b.maxHp=100000;
 a.issue({t:'attack',tgt:b});const start=[a.x,a.y];ticks(8);
 assert.ok(dist(...start,a.x,a.y)>0,'new attack turns and moves toward the new target');
 ticks(240);assert.ok(b.hp<b.maxHp);assert.equal(a.orders[0].tgt,b);
`));
for(const type of ['marine','dragoon','mutalisk','wraith','scout'])test(type+' stops to attack within real weapon range and follows a moving target',()=>world(`
 const t=unit('scv',1000,1000,1);t.hp=t.maxHp=100000;t.dir=t.velocityDirection=0;t.issue({t:'move',x:1400,y:1140});
 const a=unit('${type}',650,1000);a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:t});
 const first=record([a]);ticks(240);assert.equal(first.size,1);assert.ok(t.hp<t.maxHp);
 assert.ok(a.inRangeOf(t));assert.equal(a.orders[0].tgt,t);
`));
test('air attackers reacquire a moving airborne target without inheriting ground melee reservations',()=>world(`
 const t=unit('dropship',1000,1000,1);t.hp=t.maxHp=100000;t.dir=t.velocityDirection=0;t.issue({t:'move',x:1300,y:1080});
 const army=Array.from({length:12},(_,i)=>unit('mutalisk',650-i%3*25,920+Math.floor(i/3)*25));
 for(const a of army){a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:t});}
 const first=record(army);ticks(240);assert.equal(first.size,12);assert.ok(t.hp<t.maxHp);
 assert.ok(Math.max(...first.values())<=96,'the group intercepts the moving target within four seconds');
 assert.ok(army.every(a=>a.shots>=4),'each airborne attacker continues firing after arrival');
`));
