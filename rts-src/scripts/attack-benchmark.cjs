'use strict';
// Simulation only. Compare revisions sequentially without concurrent tests or benchmarks.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const source=path.resolve(process.argv[2]||path.join(__dirname,'../src/js'));
const count=Number(process.argv[3]||24),ticks=Number(process.argv[4]||240),runs=Number(process.argv[5]||1);
if(!Number.isInteger(count)||count<1||count>400||!Number.isInteger(ticks)||ticks<24||!Number.isInteger(runs)||runs<1||runs>10)
 throw new Error('Use 1–400 attackers, at least 24 ticks, and 1–10 runs.');
for(let run=1;run<=runs;run++){
 const ctx=vm.createContext({console,performance,count,ticks,SND:{play(){}},UI:{clickFx(){},message(){},underAttack(){}}});
 for(const file of ['data','content','map','path','game','entity','combat','commands'])
  vm.runInContext(fs.readFileSync(path.join(source,file+'.js'),'utf8'),ctx);
 const result=vm.runInContext(`(()=>{
  MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);MAP.height.fill(0);
  GAME.players=[newPlayer('Z',0),newPlayer('T',1),newPlayer('N',2)];GAME.sandbox=true;GAME.revealAll=true;GAME.aiOn=[false,false];
  for(const v of GAME.vis)v.fill(3);for(const v of GAME.explored)v.fill(1);
  let seed=42;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const target=createBuilding('cc',1,24,24,true);target.hp=target.maxHp=100000;
  const army=Array.from({length:count},(_,i)=>createUnit('zergling',0,target.x-260+i%4*20,target.y-130+Math.floor(i/4)*22));
  const first=new Map();
  for(const a of army){a.dir=a.velocityDirection=0;a.issue({t:'attack',tgt:target});const fire=a.fire;
   a.fire=function(t,w){if(!first.has(a.id))first.set(a.id,GAME.tick);return fire.call(this,t,w);};}
  const samples=[],times=[],start=performance.now();
  for(let n=1;n<=ticks;n++){
   const before=performance.now();gameTick();times.push(performance.now()-before);
   if(n%24===0)samples.push({second:n/24,fired:first.size,inRange:army.filter(a=>a.inRangeOf(target)).length});
  }
  const elapsed=performance.now()-start,sorted=times.slice().sort((a,b)=>a-b),shots=[...first.values()];
  return {version:RTS_VERSION,attackers:count,ticks,elapsedMs:+elapsed.toFixed(2),
   meanTickMs:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(2),
   p95TickMs:+sorted[Math.floor(sorted.length*.95)].toFixed(2),maxTickMs:+Math.max(...times).toFixed(2),
   firstAttackTicks:shots.sort((a,b)=>a-b),remaining:count-first.size,samples};
 })()`,ctx);
 console.log(JSON.stringify({run,...result}));
}
