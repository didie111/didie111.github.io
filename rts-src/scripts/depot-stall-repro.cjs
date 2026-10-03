'use strict';
// Reproduce the exact same final-step and starting-economy cases in two builds.
// Usage: node rts-src/scripts/depot-stall-repro.cjs [src/js directory]
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.argv[2]||path.join(__dirname,'../src/js');
const source=['data','content','map','path','game','entity','combat','commands','ai','ui','main']
 .map(f=>fs.readFileSync(path.join(root,f+'.js'),'utf8')).join('\n');
function world(code){
 const ctx=vm.createContext({console,window:{addEventListener(){}},SND:{play(){}},
  ART:{resetTerrain(){},icon(){},cmdIcon(){}},RENDER:{centerOn(){}}});
 vm.runInContext(source,ctx);
 vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);MAP.height.fill(0);
  GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.aiOn=[false,false];GAME.sandbox=true;GAME.revealAll=true;
  UI.message=()=>{};UI.clickFx=()=>{};UI.underAttack=()=>{};`,ctx);
 return vm.runInContext(code,ctx);
}
const nearEdge=[];
for(const [type,hall,hx]of [['scv','cc',58],['drone','hatchery',49],['drone','lair',49],['drone','hive',49],['probe','nexus',56]])
 for(const order of ['ret','gather'])for(const kind of ['min','gas'])nearEdge.push(world(`
  const b=createBuilding('${hall}',0,20,20,true),w=createUnit('${type}',0,b.x+${hx}+12.0005,b.y);
  w.dir=w.velocityDirection=Math.PI;w.carry=8;w.carryKind='${kind}';
  const m=createBuilding('mineral',NEUTRAL,34,20,true);m.amount=1500;
  w.issue('${order}'==='ret'?{t:'ret'}:{t:'gather',tgt:m,phase:'ret'});
  const before=P(0)['${kind}'],x=w.x,y=w.y;let depositedAt=null;
  for(let n=0;n<80;n++){gameTick();if(!w.carry){depositedAt=GAME.tick;break;}}
  ({type:'${type}',hall:'${hall}',order:'${order}',kind:'${kind}',depositedAt,credited:P(0)['${kind}']-before,
    carry:w.carry,travel:dist(x,y,w.x,w.y),gap:depotReturnDistance(w,b)});
 `));
const startingEconomy=world(`
 setupScenario(1998);GAME.aiOn=[false,false];GAME.sandbox=true;
 const workers=GAME.entities.filter(e=>e.isWorker),last=new Map(),returns=new Map(),stalls=[];
 const started=Date.now();
 for(let n=0;n<5000;n++){
  const cargo=workers.map(w=>w.carry);gameTick();workers.forEach((w,i)=>{
   if(cargo[i]>0&&!w.carry)returns.set(w,(returns.get(w)||0)+1);
   const previous=last.get(w)||{x:w.x,y:w.y,ticks:0};
   const ticks=w.carry>0&&w.orders[0]?.phase==='ret'&&dist(previous.x,previous.y,w.x,w.y)<1e-6?previous.ticks+1:0;
   last.set(w,{x:w.x,y:w.y,ticks});
   if(ticks===120){const o=w.orders[0];stalls.push({tick:GAME.tick,type:w.type,id:w.id,x:w.x,y:w.y,
    gap:o.depot&&depotReturnDistance(w,o.depot),approach:o.depotApproach&&[o.depotApproach.x,o.depotApproach.y]});}
  });
 }
 ({seed:1998,ticks:5000,simulationMs:Date.now()-started,min:GAME.players.map(p=>p.min),stalls,
   workers:workers.map(w=>({id:w.id,type:w.type,returns:returns.get(w)||0,carry:w.carry,phase:w.orders[0]?.phase}))});
`);
console.log(JSON.stringify({version:world('RTS_VERSION'),nearEdge,startingEconomy},null,2));
