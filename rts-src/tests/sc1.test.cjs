'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
function world() {
  const ctx = vm.createContext({ console, assert, window: { addEventListener() {} }, SND: { play() {} },
    ART: { resetTerrain() {}, icon: () => '', cmdIcon: () => '' }, RENDER: { centerOn() {} } });
  for (const name of ['data','content','map','path','game','entity','combat','commands','ai','ui','main'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', name + '.js'), 'utf8'), ctx);
  vm.runInContext(`MAP.walk.fill(1); MAP.buildable.fill(1); MAP.occ.fill(0); MAP.creep.fill(0);
    GAME.players = [newPlayer('T',0),newPlayer('Z',1),newPlayer('N',2)]; GAME.control = 0;
    GAME.aiOn = [false,false]; GAME.sandbox = true; GAME.detectors=[];
    for(const p of GAME.players) { p.min=5000; p.gas=5000; p.max=200; }
    for(const v of GAME.vis) v.fill(3); for(const v of GAME.explored) v.fill(1);
    UI.message=()=>{}; UI.clickFx=()=>{}; UI.underAttack=()=>{};
    function refresh() { SH.clear(); for(const e of GAME.entities) if(!e.dead&&!e.hidden) SH.insert(e); }
    function ticks(n) { for(let i=0;i<n;i++) gameTick(); }
    function unit(t,x=300,y=300,o=0) { return createUnit(t,o,x,y); }
    function building(t,tx=10,ty=10,o=0) { return createBuilding(t,o,tx,ty,true); }
  `,ctx);
  return code => vm.runInContext(code,ctx);
}
function check(name, code) { test(name, () => world()(code)); }
for (const [workerType, gasType, hallType] of [['scv','refinery','cc'],['drone','extractor','hatchery'],['probe','assimilator','nexus']]) {
 for (const [side, dx, dy] of [['left',-180,0],['right',180,0],['top',0,-140],['bottom',0,140]])
 check(workerType+' builds gas from '+side, `
  const g=building('geyser',20,20,NEUTRAL); g.amount=5000;
  const w=unit('${workerType}',g.x+${dx},g.y+${dy}); refresh();
  UI.selection=[w]; UI.mode={kind:'place',bt:'${gasType}'};
  UI.execMode(g.x,g.y,false,false); GAME.buildSpeed=8; ticks(350);
  const b=g.refinery; assert.ok(b,'worker must reach geyser and begin construction');
  assert.equal(b.type,'${gasType}'); assert.equal(b.done,true,'gas building must finish');
  assert.equal(g.hidden,true); assert.equal(!!w.dead,${workerType==='drone'});
  assert.equal(P(0).min,5000-BUILDINGS['${gasType}'].cost[0]);
  assert.equal(canPlace('${gasType}',g.tx0,g.ty0,0,null,true),false);
 `);
 check(workerType+' delivers gas after construction and restores geyser on removal', `
  const g=building('geyser',20,20,NEUTRAL); g.amount=5000;
  building('${hallType}',10,20); const w=unit('${workerType}',g.x,g.y+140); refresh();
  w.issue({t:'build',bt:'${gasType}',tx:g.tx0,ty:g.ty0}); GAME.buildSpeed=8; ticks(350);
  const b=g.refinery; assert.ok(b&&b.done);
  const miner=${workerType==='drone' ? "unit('drone',g.x,g.y+100)" : 'w'};
  smartCommand([miner],b.x,b.y,b,false); const before=P(0).gas; ticks(400);
  assert.ok(P(0).gas>before,'gas must be returned to town hall'); assert.ok(g.amount<5000);
  miner.issue({t:'stop'}); killEntity(b,null);
  assert.equal(g.hidden,false); assert.equal(g.refinery,null);
  assert.equal(MAP.occ[tIdx(g.tx0,g.ty0)],g.id);
  assert.equal(canPlace('${gasType}',g.tx0,g.ty0,0,null,true),true);
 `);
 check(workerType+' approaches gas around a blocked side without occupying the geyser', `
  const g=building('geyser',20,20,NEUTRAL); g.amount=5000;
  for(let y=19;y<=22;y++) MAP.walk[tIdx(19,y)]=0;
  const w=unit('${workerType}',g.x-180,g.y); refresh();
  w.issue({t:'build',bt:'${gasType}',tx:g.tx0,ty:g.ty0}); GAME.buildSpeed=8; ticks(500);
  assert.ok(g.refinery&&g.refinery.done,'must use another reachable edge');
 `);
 check(workerType+' cannot build inaccessible gas or spend resources', `
  const g=building('geyser',20,20,NEUTRAL);
  for(let y=19;y<=22;y++) for(let x=19;x<=24;x++)
   if(x===19||x===24||y===19||y===22) MAP.walk[tIdx(x,y)]=0;
  const w=unit('${workerType}',g.x-180,g.y); refresh();
  w.issue({t:'build',bt:'${gasType}',tx:g.tx0,ty:g.ty0}); ticks(150);
  assert.ok(!g.refinery); assert.equal(P(0).min,5000); assert.ok(!w.orders.length);
 `);
 check(workerType+' cancels gas construction and can reuse the geyser', `
  const g=building('geyser',20,20,NEUTRAL); g.amount=5000;
  const w=unit('${workerType}',g.x,g.y+g.hh+10); refresh();
  w.issue({t:'build',bt:'${gasType}',tx:g.tx0,ty:g.ty0}); ticks(2);
  const b=g.refinery; assert.ok(b&&!b.done); cmdCancelConstruction(b);
  assert.ok(b.dead); assert.equal(g.hidden,false); assert.equal(g.refinery,null);
  assert.equal(MAP.occ[tIdx(g.tx0,g.ty0)],g.id);
  assert.equal(canPlace('${gasType}',g.tx0,g.ty0,0,null,true),true);
 `);
}
check('move command shares destination and immediately clears stale velocity', `
 const a=unit('marine'),b=unit('marine',340,340); a.vx=5;
 commandUnits([a,b],{t:'move',x:600,y:500});
 assert.equal(a.vx,0); assert.equal(a.orders[0].x,b.orders[0].x); assert.equal(a.orders[0].y,b.orders[0].y);
 commandUnits([a],{t:'hold'}); assert.equal(a.vx,0);
`);
for (const seed of [20260930,42,1234]) check('starting mining SCV builds refinery on scenario terrain, seed '+seed, `
 GAME.entities=[]; GAME.byId.clear(); setupScenario(${seed}); GAME.aiOn=[false,false]; P(0).min=5000;
 const cc=GAME.entities.find(e=>e.owner===0&&e.type==='cc');
 const g=GAME.entities.filter(e=>e.type==='geyser').sort((a,b)=>dist(cc.x,cc.y,a.x,a.y)-dist(cc.x,cc.y,b.x,b.y))[0];
 const w=GAME.entities.filter(e=>e.owner===0&&e.type==='scv').sort((a,b)=>dist(g.x,g.y,a.x,a.y)-dist(g.x,g.y,b.x,b.y))[0];
 UI.selection=[w]; UI.mode={kind:'place',bt:'refinery'}; refresh();
 UI.execMode(g.x,g.y-20,false); GAME.buildSpeed=8; ticks(1200);
 assert.ok(g.refinery&&g.refinery.done,'initial SCV must build on the actual map');
`);
check('hold acquires an in-range target without chasing an old target', `
 const a=unit('marine'), far=unit('zergling',520,300,1), near=unit('zergling',350,300,1);
 a.tgt=far; a.orders=[{t:'hold'}]; refresh(); a.idleLogic(true);
 assert.equal(a.tgt,near); assert.equal(a.vx,0); assert.ok(near.hp<near.maxHp);
`);
check('tank production requires a locally attached machine shop', `
 const f=building('factory'); building('machine_shop',40,40);
 assert.equal(cmdTrain(f,'tank'),false);
 const a=building('machine_shop',f.tx0+f.def.w,f.ty0+f.def.h-2);
 assert.equal(cmdTrain(f,'tank'),true); assert.equal(f.queue.length,1);
 f.lifted=true; assert.equal(attachedAddon(f,'machine_shop'),undefined);
 assert.equal(cmdResearch(a,'siege_tech'),false);
`);
check('add-ons build automatically, charge resources, and block duplicate attachment', `
 const f=building('factory'); const before=P(0).min;
 assert.equal(cmdAddon(f,'machine_shop'),true); assert.equal(P(0).min,before-50);
 assert.equal(cmdAddon(f,'machine_shop'),false);
 GAME.buildSpeed=8; ticks(80); assert.ok(attachedAddon(f,'machine_shop'));
`);
check('invalid ability target and unresearched ability never consume energy', `
 const g=unit('ghost'); g.energy=200; P(0).tech.lockdown_t=true;
 const z=unit('zergling',350,300,1); refresh();
 assert.equal(castSpell(g,'lockdown',z,z.x,z.y),false); assert.equal(g.energy,200);
 const v=unit('vessel'); v.energy=200; assert.equal(castSpell(v,'emp',null,400,300),false); assert.equal(v.energy,200);
 assert.equal(castSpell(z,'scan',null,300,300),false);
`);
check('EMP takes effect at missile impact and exempts the firing vessel', `
 const v=unit('vessel'); v.energy=200; P(0).tech.emp_t=true;
 const t=unit('htemplar',390,300,1); t.energy=150; refresh();
 assert.equal(castSpell(v,'emp',null,t.x,t.y),true); assert.equal(t.sh,t.maxSh); assert.equal(t.energy,150);
 for(let i=0;i<30;i++)updateProjectiles(); assert.equal(t.sh,0);assert.equal(t.energy,0); assert.equal(v.energy,100);
`);
check('queen parasite shares vision and reveals the cloaked host', `
 const q=unit('queen');q.energy=200;const g=unit('ghost',420,300,1); refresh();
 assert.equal(castSpell(q,'parasite',g,g.x,g.y),true);g.cloaked=true;
 assert.equal(isCloakedFor(g,0),false); updateVision(); assert.ok(GAME.vis[0][tIdx(tileOf(g.x),tileOf(g.y))]&1);
 assert.equal(castSpell(q,'parasite',building('depot',20,20,1),640,640),false);
`);
check('queen broodlings can destroy occupied tanks but not robotic probes', `
 const q=unit('queen');q.energy=200;P(0).tech.broodlings_t=true;
 const t=unit('tank',360,300,1);refresh();assert.equal(castSpell(q,'spawn_broodlings',t,t.x,t.y),true);
 assert.equal(t.dead,true);assert.equal(GAME.entities.filter(e=>!e.dead&&e.type==='broodling').length,2);
 q.energy=200;const p=unit('probe',370,300,1);refresh();assert.equal(castSpell(q,'spawn_broodlings',p,p.x,p.y),false);assert.equal(q.energy,200);
`);
check('stasis prevents movement and damage; maelstrom affects biological units only', `
 const c=unit('arbiter');c.energy=200;P(0).tech.stasis_t=true;const t=unit('marine',360,300,1);t.vx=4;refresh();
 assert.equal(castSpell(c,'stasis',null,t.x,t.y),true);const hp=t.hp;dealDamage(c,t,{dmg:99,type:'normal'},1);assert.equal(t.hp,hp);
 t.issue({t:'move',x:500,y:300});const x=t.x;ticks(5);assert.equal(t.x,x);
 const d=unit('dark_archon',800,800);d.energy=200;P(0).tech.maelstrom_t=true;
 const bio=unit('marine',850,800,1),mech=unit('vulture',860,830,1);refresh();
 assert.equal(castSpell(d,'maelstrom',null,850,800),true);assert.ok(bio.maelstromT>0);assert.ok(!mech.maelstromT);
`);
check('permanent cloak, arbiter aura, scan detection, and ensnare revealing work', `
 const dt=unit('dtemplar',500,500,1);assert.equal(isCloakedFor(dt,0),true);
 GAME.areas.push({kind:'scan',owner:0,x:500,y:500,r:320,t:0,life:262});GAME.tick++;
 assert.equal(isCloakedFor(dt,0),false); GAME.areas=[];GAME.tick++;
 const ar=unit('arbiter',800,800,1),z=unit('zealot',850,800,1);assert.equal(isCloakedFor(z,0),true);assert.equal(isCloakedFor(ar,0),false);
 z.ensnareT=100;assert.equal(isCloakedFor(z,0),false);
`);
check('carrier and reaver require paid ammunition with capacity limits', `
 const c=unit('carrier'),t=unit('marine',350,300,1);assert.equal(c.weaponVs(t),null);const before=P(0).min;
 for(let i=0;i<4;i++)assert.equal(cmdAmmo(c),true);assert.equal(cmdAmmo(c),false);assert.equal(P(0).min,before-100);
 GAME.buildSpeed=8;ticks(160);assert.equal(c.ammo,4);assert.ok(c.weaponVs(t));
 const r=unit('reaver',800,800),z=unit('zergling',1500,1500,1);assert.equal(cmdAmmo(r),true);ticks(15);assert.equal(r.ammo,1);
 r.fire(z,r.def.gw);assert.equal(r.ammo,0);assert.equal(r.weaponVs(z),null);
`);
check('archon merging preserves supply and mutalisk morph keeps flying', `
 const a=unit('htemplar'),b=unit('htemplar',330,300);recomputeSupply();const supply=P(0).used;
 assert.equal(cmdMerge([a,b],'archon'),true);recomputeSupply();assert.equal(P(0).used,supply);
 const ar=GAME.entities.find(e=>!e.dead&&e.type==='archon');ticks(301);assert.ok(!ar.xform);
 building('greater_spire',50,50);const m=unit('mutalisk',1500,1500);const min=P(0).min;
 assert.equal(cmdInstant([m],'guardian_morph'),true);assert.equal(P(0).min,min-50);ticks(601);assert.equal(m.type,'guardian');assert.equal(m.air,true);
`);
check('cargo cannot load siege transitions and unloads without overlapping', `
 const t=unit('dropship'),a=unit('marine'),b=unit('marine'),tank=unit('tank');tank.xform={to:'tank_siege',t:40};tank.sieging=true;
 assert.equal(canLoad(t,tank),false);assert.equal(loadUnit(t,a),true);assert.equal(loadUnit(t,b),true);refresh();
 assert.equal(unloadUnit(t,a),true);assert.equal(unloadUnit(t,b),true);assert.ok(dist(a.x,a.y,b.x,b.y)>=(a.r+b.r)*0.85);
 assert.equal(unloadUnit(t,a),false);assert.equal(t.cargo.length,0);
`);
check('mind control stops previous orders, clears shields, and updates supply', `
 const d=unit('dark_archon');d.energy=200;P(0).tech.mind_control_t=true;
 const t=unit('marine',350,300,1);t.issue({t:'move',x:800,y:800});refresh();
 assert.equal(castSpell(d,'mind_control',t,t.x,t.y),true);assert.equal(t.owner,0);assert.equal(d.sh,0);assert.equal(t.orders[0].t,'stop');assert.equal(P(1).used,0);
`);
check('disruption web blocks ground weapons while air weapons remain active', `
 const c=unit('corsair');c.energy=200;P(0).tech.disruption_web_t=true;
 const g=unit('marine',350,300),a=unit('wraith',350,300),t=unit('zergling',370,300,1);refresh();
 assert.equal(castSpell(c,'disruption_web',null,350,300),true);assert.equal(g.weaponVs(t),null);assert.ok(a.weaponVs(t));
`);
check('optic flare removes detection and restoration removes blindness', `
 const m=unit('medic');m.energy=200;P(0).tech.optic_flare_t=true;P(0).tech.restoration_t=true;
 const v=unit('vessel',350,300,1);refresh();assert.equal(castSpell(m,'optic_flare',v,v.x,v.y),true);ticks(1);assert.equal(v.blinded,true);assert.ok(!GAME.detectors.includes(v));
 assert.equal(castSpell(m,'restoration',v,v.x,v.y),true);assert.equal(v.blinded,false);
`);
check('hallucinations use no supply, cannot cast spells, and cause no damage', `
 const c=unit('htemplar');c.energy=200;P(0).tech.hallucination_t=true;const z=unit('zealot',350,300);refresh();recomputeSupply();const supply=P(0).used;
 assert.equal(castSpell(c,'hallucination',z,z.x,z.y),true);recomputeSupply();assert.equal(P(0).used,supply);
 const h=GAME.entities.find(e=>e.hallucination),e=unit('marine',370,300,1);const hp=e.hp;dealDamage(h,e,h.def.gw,1);assert.equal(e.hp,hp);
`);
check('nuclear strike consumes an armed attached silo and cancels on stop', `
 const cc=building('cc'),silo=building('nuclear_silo',cc.tx0+cc.def.w,cc.ty0+cc.def.h-2);silo.nukeReady=true;
 const g=unit('ghost',500,500);const t=unit('marine',700,500,1);refresh();
 g.issue({t:'spell',s:'nuclear_strike',x:700,y:500});g.spellLogic(g.orders[0]);assert.equal(g.orders[0].t,'nuke');assert.equal(silo.nukeReady,false);
 g.issue({t:'stop'});updateAreas();assert.equal(GAME.areas.length,0);assert.equal(t.hp,t.maxHp);
 silo.nukeReady=true;assert.equal(castSpell(g,'nuclear_strike',null,700,500),true);for(let i=0;i<360;i++)updateAreas();assert.equal(t.dead,true);
`);
check('shield battery charges shields using energy when unit is ordered to recharge', `
 const b=building('shield_battery');b.unpowered=false;b.energy=100;const z=unit('zealot',b.x+b.hw+10,b.y);z.sh=0;z.issue({t:'recharge',tgt:b});
 z.orderLogic();assert.equal(z.sh,8);assert.equal(b.energy,96);
`);
check('every unit/building has a valid command card with no inaccessible tenth slot', `
 for(const type of [...Object.keys(UNITS),...Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].race!=='N')]) {
  if(['egg','lurker_egg'].includes(type))continue;
  const e=BUILDINGS[type]?building(type,50,50):unit(type);UI.selection=[e];const card=UI.buildCard();assert.equal(card.length,9,type);e.dead=true;
 }
`);
for(const seed of [20260930,42,1234]) check('fixed 1v1 scenario and live simulation stay valid, seed '+seed, `
 GAME.entities=[];GAME.byId.clear();setupScenario(${seed});
 const count=(type,o)=>GAME.entities.filter(e=>!e.dead&&e.type===type&&e.owner===o).length;
 assert.equal(count('cc',0),1);assert.equal(count('barracks',0),1);assert.equal(count('depot',0),2);assert.equal(count('marine',0),4);assert.equal(count('scv',0),10);
 assert.equal(count('hatchery',1),3);assert.equal(count('zergling',1),10);assert.equal(count('hydra',1),10);
 assert.ok(MAP.starts[0].tx>64&&MAP.starts[0].ty<64);assert.ok(MAP.starts[1].tx<64&&MAP.starts[1].ty>64);
 GAME.aiOn[1]=true;const min=P(0).min;ticks(500);
 assert.ok(P(0).min>min);for(const e of GAME.entities)assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.hp),e.type);
`);
check('comsat executes a queued building spell and deducts energy exactly once', `
 building('academy',30,30);const cc=building('cc'),a=building('comsat',cc.tx0+cc.def.w,cc.ty0+cc.def.h-2);a.energy=100;
 a.issue({t:'spell',s:'scan',x:2000,y:2000});ticks(1);
 assert.equal(GAME.areas.filter(a=>a.kind==='scan').length,1);assert.ok(a.energy>=50&&a.energy<51);assert.equal(a.orders.length,0);
`);
check('ensnare slows all races, including friendly units, and acid spores expire', `
 const q=unit('queen');q.energy=200;P(0).tech.ensnare_t=true;const a=unit('marine',350,300),b=unit('zealot',360,300,1);refresh();
 const speed=a.speed;assert.equal(castSpell(q,'ensnare',null,350,300),true);assert.equal(a.speed,speed/2);assert.ok(b.ensnareT>0);
 a.acidSpores=4;a.acidT=1;a.timers();assert.equal(a.acidSpores,0);
`);
check('recall brings friendly units to the arbiter and keeps enemies at their original position', `
 const a=unit('arbiter',1000,1000);a.energy=200;P(0).tech.recall_t=true;
 const z=unit('zealot',500,500),e=unit('marine',510,500,1);refresh();
 assert.equal(castSpell(a,'recall',null,500,500),true);assert.ok(dist(a.x,a.y,z.x,z.y)<100);assert.equal(e.x,510);
`);
check('nuclear production requires spare supply and an active attached silo', `
 const cc=building('cc'),s=building('nuclear_silo',cc.tx0+cc.def.w,cc.ty0+cc.def.h-2);
 P(0).max=0;assert.equal(cmdInstant([s],'arm_nuke'),false);P(0).max=200;
 assert.equal(cmdInstant([s],'arm_nuke'),true);recomputeSupply();assert.equal(P(0).used,8);assert.equal(cmdInstant([s],'arm_nuke'),false);
 GAME.buildSpeed=8;ticks(190);assert.equal(s.nukeReady,true);assert.equal(P(0).used,8);
`);
for(const [worker,base,structure,race] of [['scv','cc','depot','T'],['drone','hatchery','pool','Z'],['probe','nexus','pylon','P']]) {
 check(race+' worker mines minerals and returns them to its town hall', `
 const b=building('${base}',10,10),m=building('mineral',16,11,NEUTRAL);m.amount=1500;
 const w=unit('${worker}',b.x+b.hw+16,b.y);w.issue({t:'gather',tgt:m,phase:'go'});w.lastRes=m;
 const min=P(0).min;ticks(700);assert.ok(P(0).min>min);assert.ok(m.amount<1500);
 `);
 check(race+' construction follows worker consumption/release rules', `
 building('${base}',10,10);if('${race}'==='Z')MAP.creep.fill(1);
 const w=unit('${worker}',600,600);const min=P(0).min;w.issue({t:'build',bt:'${structure}',tx:20,ty:20});
 startConstruction(w,w.orders[0]);const b=GAME.entities.find(e=>e.type==='${structure}');assert.ok(b);assert.ok(P(0).min<min);
 if('${race}'==='Z')assert.equal(w.dead,true);else assert.ok(!w.dead);
 if('${race}'==='P')assert.equal(b.builder,undefined);
 `);
}

check('idle ground units keep their position and facing without arbitrary rotation', `
 Math.random=()=>0;const u=unit('marine');u.dir=0.75;const x=u.x,y=u.y;ticks(700);
 assert.equal(u.x,x);assert.equal(u.y,y);assert.equal(u.dir,0.75);
`);
check('Move crosses an enemy without auto-attacking while attack move engages', `
 const m=unit('marine',300,300),e=unit('zergling',350,300,1);e.orders=[{t:'hold'}];refresh();
 m.issue({t:'move',x:600,y:300});m.update();assert.equal(e.hp,e.maxHp);assert.equal(m.tgt,null);assert.ok(m.moving);
 m.issue({t:'amove',x:600,y:300});GAME.tick=(6-m.id%6)%6;refresh();m.update();assert.ok(e.hp<e.maxHp);assert.equal(m.vx,0);
`);
check('ground path replans around a dense stationary unit wall without displacing it', `
 const wall=[];for(let y=160;y<=480;y+=16){const u=unit('marine',320,y);u.issue({t:'hold'});wall.push(u);}
 const mover=unit('marine',160,320);mover.issue({t:'move',x:500,y:320});let usedUnitPath=false;
 for(let i=0;i<500;i++){ticks(1);usedUnitPath ||= mover.unitPathUntil>GAME.tick;}
 assert.ok(usedUnitPath);assert.ok(mover.x>475,'mover failed to route around the wall: '+mover.x+','+mover.y);
 for(let i=0;i<wall.length;i++){assert.equal(wall[i].x,320);assert.equal(wall[i].y,160+i*16);}
`);
check('path endpoint in unreachable terrain stays reachable instead of being overwritten', `
 for(let y=0;y<MAP_H;y++)MAP.walk[tIdx(12,y)]=0;
 const m=unit('marine',200,300);m.issue({t:'move',x:600,y:300});ticks(150);
 assert.ok(m.x<384);assert.ok(groundPassable(tileOf(m.x),tileOf(m.y)));assert.ok(!m.moving);
`);

check('cloaked ghost stays passive in Guard, but Hold and explicit attack can fire', `
 const g=unit('ghost');g.cloaked=true;g.energy=200;const e=unit('marine',350,300,1);refresh();GAME.tick=(6-g.id%6)%6;
 g.update();assert.equal(e.hp,e.maxHp);assert.equal(g.tgt,null);
 g.issue({t:'hold'});g.update();assert.ok(e.hp<e.maxHp);
`);
check('weapon cooldown combines stim, adrenal, ensnare and acid spores like the reference formula', `
 const m=unit('marine');const w={cd:15};assert.equal(m.weaponCooldown(w),15);
 m.stimT=100;assert.equal(m.weaponCooldown(w),7);m.ensnareT=100;assert.equal(m.weaponCooldown(w),15);
 m.stimT=0;assert.equal(m.weaponCooldown(w),18);m.acidSpores=2;assert.equal(m.weaponCooldown(w),26);
 const z=unit('zergling');P(0).tech.adrenal=true;assert.equal(z.weaponCooldown({cd:8}),5);
`);

check('movement modifiers cancel rather than multiplying stim and ensnare', `
 const m=unit('marine');const base=m.speed;m.stimT=100;m.ensnareT=100;assert.equal(m.speed,base);
 m.stimT=0;assert.equal(m.speed,base/2);
 const z=unit('zergling');const speed=z.speed;P(0).tech.metabolic=true;z.ensnareT=100;assert.equal(z.speed,speed);
 assert.ok(BUILDINGS.pool.research.includes('adrenal'));assert.deepEqual(Array.from(TECH.adrenal.req),['hive']);
`);

for (const seed of [20260930, 42, 1234]) check('all four starting marines spawn clear and accept a move, seed '+seed, `
 GAME.entities=[];GAME.byId.clear();setupScenario(${seed});GAME.aiOn=[false,false];
 const marines=GAME.entities.filter(e=>e.type==='marine'&&e.owner===0);assert.equal(marines.length,4);
 for(const m of marines){assert.ok(PF.positionClear(m.x,m.y,m.r*.75,0));for(const other of marines)if(other!==m)assert.ok(dist(m.x,m.y,other.x,other.y)>=(m.r+other.r)*.85);}
 const starts=marines.map(m=>[m.x,m.y]);
 for(const m of marines){let goal=null;for(let radius=80;radius<200&&!goal;radius+=40)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const x=m.x+Math.cos(angle)*radius,y=m.y+Math.sin(angle)*radius;if(PF.lineClear(m.x,m.y,x,y,m.r*.75,0)){goal=[x,y];break;}}assert.ok(goal);m.issue({t:'move',x:goal[0],y:goal[1]});}
 ticks(100);marines.forEach((m,i)=>assert.ok(dist(m.x,m.y,starts[i][0],starts[i][1])>30,'starting marine '+i+' trapped'));
`);
