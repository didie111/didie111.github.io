'use strict';
// Run sequentially in two source trees to compare the actual game modules.
// Usage: node rts-src/scripts/patrol-mixing-repro.cjs [src/js directory]
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.argv[2]||path.join(__dirname,'../src/js');
const source=['data','content','map','path','game','entity','combat','commands']
  .map(n=>fs.readFileSync(path.join(root,n+'.js'),'utf8')).join('\n');
function world(code){
  const c=vm.createContext({console,SND:{play(){}},UI:{clickFx(){},message(){},underAttack(){}}});
  vm.runInContext(source,c);
  vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);
    GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];
    GAME.sandbox=true;GAME.revealAll=true;`,c);
  return vm.runInContext(code,c);
}
const cases=[];
for(const type of ['scv','drone','probe'])for(const mixed of [false,true])cases.push(world(`
  const gas=createBuilding('geyser',NEUTRAL,18,18,true),army=[],workers=[];
  const types=${mixed} ? ['marine','hydra','zealot','dragoon','zergling','tank'] : ['marine'];
  const spacing=${mixed}?28:17;
  for(let i=0;i<12;i++){const u=createUnit(types[i%types.length],0,530+i%3*spacing,560+Math.floor(i/3)*spacing);
    u.issue({t:'hold'});army.push(u);}
  for(let i=0;i<11;i++)workers.push(createUnit('${type}',0,535+i%3*4,425+Math.floor(i/3)*4));
  smartCommand(workers,gas.x,gas.y,gas);let crossedAt=null;
  for(let n=0;n<200;n++){gameTick();if(workers.some(a=>army.some(b=>dist(a.x,a.y,b.x,b.y)<(a.r+b.r)*.85))){crossedAt=GAME.tick;break;}}
  if(crossedAt===null)throw new Error('No drill contact');
  workers.forEach(u=>u.issue({t:'hold'}));commandUnits(army,{t:'patrol',x:550,y:590},false);
  const units=[...army,...workers],frames=[];
  function snapshot(tick){
    let overlaps=0;const xs=units.map(u=>u.x),ys=units.map(u=>u.y);
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++)
      if(dist(units[i].x,units[i].y,units[j].x,units[j].y)<(units[i].r+units[j].r)*.85-1e-6)overlaps++;
    const nearest=units.map(a=>Math.min(...units.filter(b=>b!==a).map(b=>dist(a.x,a.y,b.x,b.y))));
    return {tick,overlaps,recovering:units.filter(u=>u.groundRecovery).length,
      width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),
      meanNearestDistance:nearest.reduce((a,b)=>a+b,0)/nearest.length};
  }
  let turns=0,maxStep=0;
  for(let n=0;n<=240;n++){
    if([0,24,48,120,240].includes(n))frames.push(snapshot(n));if(n===240)break;
    const goals=army.map(u=>u.orders[0]?.x),pos=units.map(u=>[u.x,u.y]);gameTick();
    army.forEach((u,i)=>{if(goals[i]!==u.orders[0]?.x)turns++;});
    units.forEach((u,i)=>{const step=dist(...pos[i],u.x,u.y);maxStep=Math.max(maxStep,step);
      if(step>u.speed+1e-6)throw new Error('Movement exceeded unit speed');});
  }
  const patrolRetained=army.every(u=>u.orders[0]?.t==='patrol');
  units.forEach(u=>u.issue({t:'hold'}));let settledAt=null;
  for(let n=0;n<=600;n++){const s=snapshot(n);if(s.overlaps===0&&s.recovering===0){settledAt=n;break;}gameTick();}
  const holdRetained=units.every(u=>u.orders[0]?.t==='hold'),settled=snapshot(settledAt);
  const starts=units.map(u=>[u.x,u.y]);
  units.forEach(u=>u.issue({t:'move',x:u.x+500,y:u.y}));for(let n=0;n<180;n++)gameTick();
  const travel=units.map((u,i)=>dist(...starts[i],u.x,u.y));
  const completedAt180=units.filter(u=>!u.orders.length).length;
  for(let n=180;n<360&&units.some(u=>u.orders.length);n++)gameTick();
  ({worker:'${type}',mixed:${mixed},crossedAt,turns,maxStep,patrolRetained,frames,
    holdRetained,settledAt,settled,moveAfterHold:{ticks:180,minTravel:Math.min(...travel),
      completed:completedAt180,total:units.length,completedBy360:units.filter(u=>!u.orders.length).length},
    finalPositions:units.map(u=>({type:u.type,x:u.x,y:u.y}))});
`));
console.log(JSON.stringify({version:world('RTS_VERSION'),simulationTicksPerSecond:24,
  scope:'Project modules only; not original/OpenBW frame equivalence',cases},null,2));
