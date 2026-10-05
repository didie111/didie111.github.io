'use strict';
// Diagnose raw-gas approach geometry in the actual game modules.
// Usage: node rts-src/scripts/gas-approach-repro.cjs [src/js directory]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = process.argv[2] || path.join(__dirname, '../src/js');
const source = ['data', 'content', 'map', 'path', 'game', 'entity', 'combat', 'commands']
  .map(n => fs.readFileSync(path.join(root, n + '.js'), 'utf8')).join('\n');
const cases = [];
for (const type of ['scv', 'drone', 'probe']) for (const side of ['top', 'bottom', 'left', 'right']) {
  const ctx = vm.createContext({console, SND: {play() {}}, UI: {clickFx() {}, message() {}}});
  vm.runInContext(source, ctx);
  cases.push(vm.runInContext(`(() => {
    MAP.walk.fill(1); MAP.buildable.fill(1); MAP.occ.fill(0);
    GAME.players = [newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)]; GAME.sandbox = true;
    const gas = createBuilding('geyser',NEUTRAL,20,20,true), workers = [];
    const vertical = '${side}' === 'top' || '${side}' === 'bottom';
    for (let i=0;i<10;i++) {
      const along = -8 + i%2*4, outward = 160 - Math.floor(i/2)*4;
      const x = gas.x + (vertical ? along : '${side}'==='left' ? -outward : outward);
      const y = gas.y + (!vertical ? along : '${side}'==='top' ? -outward : outward);
      workers.push(createUnit('${type}',0,x,y));
    }
    const starts = workers.map(u=>[u.x,u.y]), metrics = workers.map(()=>({travel:0,sideways:0,contact:null}));
    smartCommand(workers,gas.x,gas.y,gas);
    let firstPath;
    for (let tick=1;tick<=240;tick++) {
      const before=workers.map(u=>[u.x,u.y]); gameTick();
      if(tick===1) firstPath=workers[0].path?.map(p=>p.slice());
      workers.forEach((u,i)=>{
        const m=metrics[i]; if(m.contact!==null)return;
        m.travel+=dist(...before[i],u.x,u.y);
        m.sideways=Math.max(m.sideways,Math.abs((vertical?u.x:u.y)-starts[i][vertical?0:1]));
        if(edgeDist(u,gas)<=3) m.contact=tick;
      });
      if(metrics.every(m=>m.contact!==null)) break;
    }
    return {worker:'${type}',side:'${side}',firstPath,
      contacted:metrics.filter(m=>m.contact!==null).length,total:workers.length,
      firstContactTick:Math.min(...metrics.map(m=>m.contact??Infinity)),
      lastContactTick:Math.max(...metrics.map(m=>m.contact??Infinity)),
      minTravel:+Math.min(...metrics.map(m=>m.travel)).toFixed(2),
      maxTravel:+Math.max(...metrics.map(m=>m.travel)).toFixed(2),
      maxSideways:+Math.max(...metrics.map(m=>m.sideways)).toFixed(2),
      gasAmount:gas.amount??null,cargo:workers.reduce((n,u)=>n+u.carry,0),
      version:RTS_VERSION};
  })()`, ctx));
}
console.log(JSON.stringify({scope:'Project modules only; video input timings and original engine frames are not reproduced.',gas:{x:704,y:672,hw:64,hh:32},cases},null,2));
