'use strict';
// Simulation only. Run each build sequentially without other tests/benchmarks.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const root=process.argv[2]||path.join(__dirname,'../src/js');
const source=['data','content','map','path','game','entity','combat','commands']
 .map(n=>fs.readFileSync(path.join(root,n+'.js'),'utf8')).join('\n');
const cases=[];
for(const target of ['geyser','refinery'])for(const count of [10,100,400]){
 const ctx=vm.createContext({performance,SND:{play(){}},UI:{clickFx(){},message(){}}});
 vm.runInContext(source,ctx);
 cases.push(vm.runInContext(`(()=>{
  MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);
  GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.sandbox=true;GAME.revealAll=true;
  let rng=42;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
  const g=createBuilding('${target}','${target}'==='geyser'?NEUTRAL:0,20,20,true),us=[];
  if(g.type==='geyser')g.amount=5000;else{g.geyser={amount:5000};createBuilding('cc',0,10,10,true);}
  for(let i=0;i<${count};i++){
   const w=createUnit('scv',0,g.x-18+i%10*4,g.y-160-Math.floor(i/10)*4);
   w.dir=w.velocityDirection=Math.PI/2;us.push(w);
  }
  smartCommand(us,g.x,g.y,g);
  const samples=[],contact=new Set();let entries=0,hardSteps=0;
  for(let n=0;n<120;n++){
   const before=us.map(w=>[w.x,w.y,w.hidden]);
   const start=performance.now();gameTick();samples.push(performance.now()-start);
   us.forEach((w,i)=>{
    if(edgeDist(w,g)<=3)contact.add(w);
    if(!before[i][2]&&w.hidden)entries++;
    if(!before[i][2]&&!w.hidden&&dist(before[i][0],before[i][1],w.x,w.y)>w.speed+1e-5)hardSteps++;
   });
  }
  const sorted=samples.slice(8).sort((a,b)=>a-b);
  return {version:RTS_VERSION,target:'${target}',count:${count},ticks:120,
   avgMs:+(sorted.reduce((a,b)=>a+b,0)/sorted.length).toFixed(3),
   p95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(3),maxMs:+Math.max(...samples).toFixed(3),
   contacted:contact.size,entries,hidden:us.filter(w=>w.hidden).length,hardSteps,
   playerGas:P(0).gas,cargo:us.reduce((n,w)=>n+w.carry,0),gasAmount:g.type==='geyser'?g.amount:g.geyser.amount};
 })()`,ctx));
}
console.log(JSON.stringify({scope:'Node simulation timing only; excludes browser rendering and input.',cases},null,2));
