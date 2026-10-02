'use strict';
// Reproducible simulation-only benchmark. Run each version separately; do not
// run tests or another benchmark concurrently when comparing elapsed times.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {performance} = require('node:perf_hooks');
const source = path.resolve(process.argv[2] || path.join(__dirname, '../src/js'));
function world() {
  const ctx = vm.createContext({console, performance, SND:{play(){}}, UI:{clickFx(){},message(){}}});
  for (const name of ['data','content','map','path','game','entity','combat','commands'])
    vm.runInContext(fs.readFileSync(path.join(source, name + '.js'), 'utf8'), ctx);
  vm.runInContext(`MAP.walk.fill(1); MAP.occ.fill(0);
    GAME.players=[newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)];GAME.sandbox=true;GAME.revealAll=true;
    let rng=42;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);`, ctx);
  return ctx;
}
for (const mode of ['idle','move','overlap']) for (const count of [100,400,800]) {
  const ctx=world();ctx.mode=mode;ctx.count=count;
  const result=vm.runInContext(`(()=>{
    const cols=Math.ceil(Math.sqrt(count)), spacing=mode==='overlap'?5:24;
    for(let i=0;i<count;i++){
      const e=createUnit(i%5===0?'scv':'marine',0,600+(i%cols)*spacing,600+Math.floor(i/cols)*spacing);
      e.dir=e.velocityDirection=0;
      e.issue(mode==='move'?{t:'move',x:e.x+700,y:e.y}:{t:'hold'});
    }
    const stats={queries:0,candidates:0,obstacleBuilds:0,lineChecks:0};
    for(const name of ['query','queryGround','queryEnemy']) if(SH[name]){
      const query=SH[name];SH[name]=(...args)=>{const r=query(...args);stats.queries++;stats.candidates+=r.length;return r;};
    }
    const obstacle=PF.unitObstacles, line=PF.lineClear;
    PF.unitObstacles=(...args)=>{stats.obstacleBuilds++;return obstacle(...args);};
    PF.lineClear=(...args)=>{stats.lineChecks++;return line(...args);};
    const ticks=mode==='overlap'?32:96, samples=[];
    for(let i=0;i<ticks;i++){
      const start=performance.now();gameTick();samples.push(performance.now()-start);
      if(i===7)for(const key in stats)stats[key]=0;
    }
    const steady=samples.slice(8).sort((a,b)=>a-b), mean=steady.reduce((a,b)=>a+b,0)/steady.length;
    for(const key in stats)stats[key]=Math.round(stats[key]/steady.length);
    return {version:RTS_VERSION,mode,count,ticks,meanMs:+mean.toFixed(2),
      p95Ms:+steady[Math.floor(steady.length*.95)].toFixed(2),maxMs:+Math.max(...samples).toFixed(2),
      perTick:stats,moving:GAME.entities.filter(e=>e.moving).length,recovering:GAME.entities.filter(e=>e.groundRecovery).length};
  })()`, ctx);
  console.log(JSON.stringify(result));
}
