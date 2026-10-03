'use strict';
// Identical open-map cargo return, plus an unreachable-depot regression.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.argv[2]||path.join(__dirname,'../src/js');
function world(code){
 const ctx=vm.createContext({console,window:{addEventListener(){}},SND:{play(){}},ART:{resetTerrain(){},icon(){},cmdIcon(){}},RENDER:{centerOn(){}}});
 for(const f of ['data','content','map','path','game','entity','combat','commands','ai','ui','main'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx);
 vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);MAP.height.fill(0);
 GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.aiOn=[false,false];GAME.sandbox=true;GAME.revealAll=true;
 UI.message=()=>{};UI.clickFx=()=>{};UI.underAttack=()=>{};`,ctx);
 return vm.runInContext(code,ctx);
}
for(const [type,hall,bx,by]of [['scv','cc',58,41],['drone','hatchery',49,32],['probe','nexus',56,39]])for(const [side,dx,dy]of [['right',180,0],['bottom',0,180]]){
 console.log(JSON.stringify(world(`const b=createBuilding('${hall}',0,20,20,true),w=createUnit('${type}',0,b.x+${dx},b.y+${dy});
 w.dir=w.velocityDirection=Math.atan2(b.y-w.y,b.x-w.x);w.carry=8;w.carryKind='min';w.issue({t:'ret'});const before=P(0).min;
 let travel=0,answer=null;for(let n=0;n<240;n++){const x=w.x,y=w.y;gameTick();travel+=dist(x,y,w.x,w.y);if(P(0).min>before){
 answer={type:'${type}',hall:'${hall}',side:'${side}',tick:GAME.tick,dx:w.x-b.x,dy:w.y-b.y,travel,gap:Math.hypot(Math.max(0,Math.abs(w.x-b.x)-${bx}-11),Math.max(0,Math.abs(w.y-b.y)-${by}-11))};break;}}answer;`)));
}
console.log(JSON.stringify(world(`MAP.walk.fill(0);for(let y=10;y<=12;y++)for(let x=10;x<=12;x++)MAP.walk[tIdx(x,y)]=1;
 const b=createBuilding('hatchery',0,40,40,true),w=createUnit('drone',0,352,352);w.carry=8;w.carryKind='min';w.issue({t:'ret'});
 const before=P(0).min;gameTick();({case:'unreachable',credited:P(0).min-before,carry:w.carry});`)));
