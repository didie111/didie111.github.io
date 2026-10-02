'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
function world(){
 const ctx=vm.createContext({console,assert,performance,window:{addEventListener(){}},SND:{play(){}},ART:{icon:()=>'',cmdIcon:()=>''},RENDER:{centerOn(){}}});
 for(const file of ['data','content','map','path','game','entity','combat','commands','ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file+'.js'),'utf8'),ctx);
 vm.runInContext(`MAP.walk.fill(1);MAP.buildable.fill(1);MAP.occ.fill(0);MAP.height.fill(0);
  GAME.players=[newPlayer('T',0),newPlayer('P',1),newPlayer('N',2)];GAME.control=0;GAME.sandbox=true;GAME.aiOn=[false,false];GAME.detectors=[];
  for(const p of GAME.players){p.min=10000;p.gas=10000;p.max=200;}
  for(const v of GAME.vis)v.fill(3);for(const v of GAME.explored)v.fill(1);
  UI.message=()=>{};UI.clickFx=()=>{};UI.underAttack=()=>{};UI.onScreen=()=>true;Math.random=()=>.75;
  function unit(t,x=500,y=500,o=0){return createUnit(t,o,x,y);}
  function building(t,tx=20,ty=20,o=0){return createBuilding(t,o,tx,ty,true);}
  function refresh(){SH.clear();for(const e of GAME.entities)if(!e.dead&&!e.hidden)SH.insert(e);PF.resetBudget();}
  function ticks(n){for(let i=0;i<n;i++)gameTick();}
  function projectiles(n=100){for(let i=0;i<n;i++){GAME.tick++;PF.resetBudget();updateProjectiles();}}
 `,ctx);
 return code=>vm.runInContext(code,ctx);
}
function check(name,code){test(name,()=>world()(code));}
const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/sc118-unit-audit.json'),'utf8'));
test('every implemented mobile profile matches the independently decoded DAT movement control and coefficients',()=>{
 const actual=world()('({UNITS,GROUND_MOTION,AIR_MOTION,MINE_MOTION})');
 for(const [type,d] of Object.entries(actual.UNITS)){
  const r=reference.units[type];assert.ok(r,type+' missing from reference audit');
  const profile=type==='spider_mine'?actual.MINE_MOTION:actual.GROUND_MOTION[type]||actual.AIR_MOTION[type];
  if(!profile){assert.ok(['larva','egg','lurker_egg','tank_siege'].includes(type),type+' missing movement profile');continue;}
  assert.deepEqual(Array.from(profile),[r.motion.acceleration,r.motion.turn,r.motion.haltDistance256,r.motion.control],type);
  if(r.motion.control!==2)assert.equal(d.speed,r.motion.topSpeed256/256,type+' fixed-point top speed');
 }
});
test('all standard unit weapon damage, upgrade increments, type, cooldown and range match DAT facts',()=>{
 const actual=world()('UNITS'),types={1:'explosive',2:'concussive',3:'normal',4:'spell'};
 for(const [type,d] of Object.entries(actual))for(const [side,slot] of [['ground','gw'],['air','aw']]){
  const w=d[slot];if(!w)continue;const r=reference.units[type].weapons[side];assert.ok(r,type+' '+side+' missing reference');
  assert.equal(w.dmg,r.damage_amount,type+' damage');assert.equal(w.type,types[r.weapon_type],type+' damage type');
  if(w.upg&&w.upg!=='none')assert.equal(w.inc||1,r.damage_bonus,type+' upgrade increment');
  if(!['carrier','reaver','spider_mine'].includes(type)){assert.equal(w.cd,r.weapon_cooldown,type+' cooldown');assert.equal(w.range,r.maximum_range,type+' range');}
  if(w.splash)assert.deepEqual(Array.from(w.splash),[r.inner_splash_range,r.medium_splash_range,r.outer_splash_range],type+' splash');
 }
});
check('terrain cache agrees with exact swept-circle checks and invalidates on construction, lift and destruction',`
 let seed=13;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<180;i++)MAP.walk[tIdx(5+Math.floor(rand()*60),5+Math.floor(rand()*60))]=0;
 const cases=Array.from({length:400},()=>[150+rand()*2000,150+rand()*2000,150+rand()*2000,150+rand()*2000,3+rand()*15,0]);
 PF.endTick();const expected=cases.map(c=>PF.lineClear(...c));PF.beginTick();
 assert.deepEqual(cases.map(c=>PF.lineClear(...c)),expected);
 MAP.walk.fill(1);PF.beginTick();assert.equal(PF.lineClear(500,700,1200,700,5,0),true);
 const b=building('barracks',24,20);assert.equal(PF.lineClear(500,b.y,1200,b.y,5,0),false);
 occupy(b,false);assert.equal(PF.lineClear(500,b.y,1200,b.y,5,0),true);
 occupy(b,true);assert.equal(PF.lineClear(500,b.y,1200,b.y,5,0),false);
 killEntity(b,null,true);assert.equal(PF.lineClear(500,b.y,1200,b.y,5,0),true);
 PF.endTick();MAP.walk[tIdx(20,21)]=0;assert.equal(PF.lineClear(500,688,1200,688,5,0),false);
`);
check('24-unit box, shift, Ctrl, control-group storage and recall enforce the same cap',`
 const army=Array.from({length:30},(_,i)=>unit('marine',500+i*20,500));
 UI.boxSelect(480,480,1200,520,false);assert.equal(UI.selection.length,24);
 UI.groupKey(1,true,false);UI.setSelection([]);UI.groupKey(1,false,false);assert.equal(UI.selection.length,24);
 UI.pick=()=>army[0];UI.clickSelect(0,0,true,false);assert.equal(UI.selection.length,23);
 UI.pick=()=>army[24];UI.clickSelect(0,0,true,false);assert.equal(UI.selection.length,24);
 UI.setSelection([army[0]]);UI.clickSelect(0,0,false,true);assert.equal(UI.selection.length,24);
 UI.setSelection(army.concat(army));assert.equal(new Set(UI.selection).size,24);
`);
check('only production buildings can be selected in a group of 24; units and enemy buildings stay separate',`
 const bs=Array.from({length:30},(_,i)=>building('barracks',5+i*3,10)),s=building('depot',7,15);
 UI.boxSelect(0,300,3500,480,false);assert.equal(UI.selection.length,24);assert.ok(UI.selection.every(e=>e.type==='barracks'));
 UI.groupKey(2,true,false);UI.setSelection([]);UI.groupKey(2,false,false);assert.equal(UI.selection.length,24);
 UI.pick=()=>bs[0];UI.clickSelect(0,0,true,false);assert.equal(UI.selection.length,23);
 UI.pick=()=>bs[24];UI.clickSelect(0,0,true,false);assert.equal(UI.selection.length,24);
 UI.setSelection([bs[0]]);UI.clickSelect(0,0,false,true);assert.equal(UI.selection.length,24);
 UI.setSelection([s,...bs]);assert.equal(UI.selection.length,1);
 const a=unit('marine');UI.setSelection([a,...bs]);assert.deepEqual(UI.selection,[a]);
 const enemy=building('barracks',40,30,1);UI.setSelection([enemy,...bs]);assert.deepEqual(UI.selection,[enemy]);
`);
check('24 producers distribute paid production, expose commands and rally every selected building',`
 const bs=Array.from({length:24},(_,i)=>building('barracks',5+i*3,10));UI.setSelection(bs);
 const before=P(0).min;for(let i=0;i<24;i++)assert.equal(cmdTrainSelected(UI.own(),'marine'),true);
 assert.ok(bs.every(b=>b.queue.length===1));assert.equal(P(0).min,before-1200);
 const card=UI.buildCard();assert.ok(card.some(b=>b?.name==='마린'));
 UI.pick=()=>null;UI.setMode({kind:'target',cmd:'rally'});UI.execMode(900,800,false,false);
 assert.ok(bs.every(b=>b.rally.x===900&&b.rally.y===800));UI.escQueue();assert.ok(bs.every(b=>!b.queue.length));
`);
check('mixed producers switch command tabs and skip incomplete, lifted, full or missing-addon factories',`
 building('armory',60,60);const barr=building('barracks'),a=building('factory',25,20),b=building('factory',30,20);
 building('machine_shop',b.tx0+b.def.w,b.ty0+b.def.h-2);UI.setSelection([barr,a,b]);UI.producerType='factory';
 const card=UI.buildCard();assert.ok(card.some(x=>x?.name==='시즈 탱크'));assert.equal(cmdTrainSelected([a,b],'tank'),true);
 assert.equal(a.queue.length,0);assert.equal(b.queue.length,1);
 b.lifted=true;assert.equal(cmdTrainSelected([a,b],'tank'),false);assert.equal(b.queue.length,1);
`);
check('multiple hatcheries select larvae from all selected halls, capped at 24',`
 const halls=Array.from({length:10},(_,i)=>building('hatchery',5+i*3,10));
 for(const h of halls)for(let i=0;i<3;i++){const l=unit('larva',h.x+i*8,h.y);l.hatch=h;}
 UI.setSelection(halls);UI.buildCard()[0].fn();assert.equal(UI.selection.length,24);assert.ok(UI.selection.every(e=>e.type==='larva'));
`);
check('completing a refinery automatically sends its constructing SCV to gas and deposits actual gas',`
 building('cc',15,20);const g=building('geyser',23,20,NEUTRAL);g.amount=5000;
 const w=unit('scv',g.x-150,g.y);w.issue({t:'build',bt:'refinery',tx:g.tx0,ty:g.ty0});GAME.buildSpeed=20;
 ticks(300);const b=GAME.entities.find(e=>e.type==='refinery'&&!e.dead);
 assert.ok(b?.done);assert.equal(w.orders[0]?.t,'gather');assert.equal(w.orders[0]?.tgt,b);
 const gas=P(0).gas;ticks(500);assert.ok(P(0).gas>gas);assert.equal(w.orders[0]?.t,'gather');
`);
check('refinery completion respects queued commands, abandoned builders and depleted gas',`
 const b=building('refinery'),w=unit('scv');b.done=false;b.geyser={amount:0};b.builder=w;
 w.orders=[{t:'construct',tgt:b},{t:'move',x:900,y:800}];completeBuilding(b);
 assert.equal(w.orders[0].t,'move');assert.equal(b.geyser.amount,0);
 b.done=false;b.builder=w;w.orders=[{t:'hold'}];completeBuilding(b);assert.equal(w.orders[0].t,'hold');
`);
check('dark templar starts at walking speed, while high templar accelerates without destination braking',`
 const dt=unit('dtemplar'),ht=unit('htemplar',700,500),scv=unit('scv',900,500);
 for(const e of [dt,ht,scv])e.dir=e.velocityDirection=0;
 groundMovement(dt,1500,500);assert.equal(dt.vx,dt.speed);
 groundMovement(ht,1500,500);assert.equal(ht.vx,27/256);
 ht.currentSpeed=ht.speed;groundMovement(ht,ht.x+2,ht.y);assert.equal(ht.currentSpeed,ht.speed);assert.equal(ht.vx,2);
 scv.currentSpeed=scv.speed;groundMovement(scv,scv.x+2,scv.y);assert.ok(scv.currentSpeed<scv.speed);
`);
check('speed upgrades and ensnare change flingy acceleration and turning, not just top speed',`
 const v=unit('vulture');v.dir=v.velocityDirection=0;P(0).tech.ion=true;groundMovement(v,1500,500);assert.equal(v.currentSpeed,200/256);
 v.currentSpeed=0;v.ensnareT=100;groundMovement(v,1500,500);assert.equal(v.currentSpeed,100/256);
 P(0).tech.ion=false;v.currentSpeed=0;groundMovement(v,1500,500);assert.equal(v.currentSpeed,75/256);
`);
check('shuttle, observer, scout and overlord speed research follows the original modifiers and ensnare cancellation',`
 for(const [type,tech] of [['shuttle','gravitic_drive'],['observer','gravitic_boosters'],['scout','gravitic_thrusters'],['overlord','pneumatized']]){
  const e=unit(type);P(0).tech[tech]=true;const fast=type==='scout'?6+2/3:Math.max(e.def.speed*1.5,10/3);assert.equal(e.speed,fast);
  e.ensnareT=100;assert.equal(e.speed,e.def.speed);P(0).tech[tech]=false;assert.equal(e.speed,e.def.speed/2);
 }
 assert.ok(BUILDINGS.robo_support.research.includes('gravitic_drive'));assert.ok(BUILDINGS.observatory.research.includes('gravitic_boosters'));assert.ok(BUILDINGS.fleet_beacon.research.includes('gravitic_thrusters'));
`);
check('shield overflow does not invent HP damage, fractional shields are not overdrawn, and matrix cannot heal',`
 const m=unit('marine'),z=unit('zealot',600,500,1);z.sh=5;dealDamage(m,z,m.def.gw,1);assert.equal(z.sh,0);assert.equal(z.hp,100);
 z.sh=.25;dealDamage(m,z,{dmg:5,type:'normal'},1);assert.equal(z.sh,.25);assert.equal(z.hp,96);
 const t=unit('marine',650,500,1);t.hp=.25;t.matrixHp=100;dealDamage(m,t,m.def.gw,1);assert.ok(t.dead);
`);
check('reaver forced friendly attack damages its target but leaves nearby friendly units intact',`
 const r=unit('reaver'),t=building('cc',20,16),friend=unit('scv',t.x+50,t.y,0);r.x=t.x-90;r.y=t.y;r.ammo=1;
 P(0).tech.scarab_damage=true;refresh();r.issue({t:'attack',tgt:t});r.orderLogic();projectiles();
 assert.equal(r.ammo,0);assert.equal(t.hp,1500-124);assert.equal(friend.hp,60);
`);
check('scarabs follow ground routes instead of crossing an impassable wall and expire after 90 frames',`
 const r=unit('reaver',500,500),t=unit('ultralisk',700,500,1);refresh();
 for(let y=0;y<MAP_H;y++)MAP.walk[tIdx(19,y)]=0;
 fireWeapon(r,t,r.def.gw);projectiles(95);assert.equal(t.hp,400);assert.equal(GAME.projectiles.length,0);
`);
check('carrier ammunition determines interceptor hits and swarm misses cannot deal damage',`
 const c=unit('carrier'),t=building('cc',20,16,1);c.x=t.x-120;c.y=t.y;c.ammo=4;refresh();
 fireWeapon(c,t,c.def.gw);projectiles(120);assert.equal(t.hp,1500-4*5);
 t.hp=1500;GAME.areas.push({kind:'swarm',x:t.x,y:t.y,r:100,t:0,life:700});fireWeapon(c,t,c.def.gw);projectiles(120);assert.equal(t.hp,1500);
`);
check('lurker damages enemies along its line once and never damages same-owner units even when forced',`
 const l=unit('lurker'),t=unit('ultralisk',620,500,1),second=unit('ultralisk',660,500,1),ally=unit('marine',640,500,0),off=unit('marine',620,580,1);refresh();
 lurkerSpines(l,t,l.def.gw);assert.equal(t.hp,381);assert.equal(second.hp,381);assert.equal(ally.hp,40);assert.equal(off.hp,40);
 lurkerSpines(l,ally,l.def.gw);assert.equal(ally.hp,40);
`);
check('siege point splash preserves its three rings, friendly damage and burrowed outer immunity',`
 const s=unit('tank_siege',400,500),primary=unit('ultralisk',600,500,1),full=unit('ultralisk',600,500,0),half=unit('ultralisk',638,500,1),quarter=unit('ultralisk',653,500,1),burrow=unit('hydra',638,500,1);
 burrow.burrowed=true;refresh();fireWeapon(s,primary,s.def.gw);projectiles();
 assert.equal(primary.hp,331);assert.equal(full.hp,331);assert.equal(half.hp,366);assert.equal(quarter.hp,383.5);assert.equal(burrow.hp,80);
`);
check('corsair air splash deals full primary, half inner-secondary, quarter outer-secondary and no ground damage',`
 const c=unit('corsair'),t=unit('overlord',600,500,0),near=unit('overlord',650,500,1),outer=unit('overlord',685,500,1),ally=unit('overlord',620,500,0),ground=unit('marine',600,500,1);refresh();
 fireWeapon(c,t,c.def.aw);projectiles();assert.equal(t.hp,195);assert.equal(near.hp,197.5);assert.equal(outer.hp,198.75);assert.equal(ally.hp,200);assert.equal(ground.hp,40);
`);
check('archon enemy splash can damage ground and air together without damaging its friendly neighbors',`
 const a=unit('archon'),t=unit('overlord',600,500,1),ground=unit('ultralisk',600,510,1),ally=unit('marine',600,500,0);refresh();
 fireWeapon(a,t,a.def.aw);assert.equal(t.hp,170);assert.equal(ground.hp,371);assert.equal(ally.hp,40);
`);
check('devourer spreads spores without splash damage and direct projectile damage retains upgrades after source death',`
 const d=unit('devourer'),t=unit('overlord',600,500,1),neighbor=unit('overlord',630,500,1);refresh();
 fireWeapon(d,t,d.def.aw);projectiles();assert.equal(t.hp,175);assert.equal(neighbor.hp,200);assert.equal(neighbor.acidSpores,1);
 const h=unit('hydra',500,700),v=unit('ultralisk',600,700,1);P(0).upg.z_mis=3;refresh();
 fireWeapon(h,v,h.def.gw);killEntity(h,null,true);projectiles();assert.equal(v.hp,388);
`);
check('acid spores expire independently and refresh the oldest stack at the nine-stack cap',`
 const t=unit('overlord');addAcidSpore(t);for(let i=0;i<400;i++)t.timers();addAcidSpore(t);
 for(let i=0;i<800;i++)t.timers();assert.equal(t.acidSpores,1);assert.equal(t.acidT,400);
 for(let i=0;i<400;i++)t.timers();assert.equal(t.acidSpores,0);
 for(let i=0;i<12;i++)addAcidSpore(t);assert.equal(t.acidSpores,9);
`);
check('plague ignores shields and remains nonlethal; Yamato uses explosive damage and EMP removes shields and energy',`
 const d=unit('defiler'),z=unit('zealot',600,500,1);P(0).tech.plague_t=true;d.energy=200;refresh();
 assert.equal(castSpell(d,'plague',null,600,500),true);const sh=z.sh;for(let i=0;i<600;i++)z.timers();assert.ok(z.hp>0&&z.hp<5);assert.equal(z.sh,sh);
 const c=unit('bc'),t=unit('ultralisk',650,500,1);onProjectileHit({kind:'yamato',src:c,tgt:t,x:t.x,y:t.y,w:c.def.gw});assert.equal(t.hp,141);
 const h=unit('htemplar',660,500,1);h.energy=100;refresh();onProjectileHit({kind:'plasma',emp:true,src:c,x:h.x,y:h.y});assert.equal(h.sh,0);assert.equal(h.energy,0);
`);
check('phase-shifted overlapping storms share the damage interval and still damage friendly units',`
 const c=unit('htemplar'),t=unit('ultralisk',600,500,0);refresh();
 GAME.areas=[{kind:'storm',x:600,y:500,r:48,t:0,life:68,src:c},{kind:'storm',x:600,y:500,r:48,t:4,life:68,src:c}];
 for(let i=0;i<32;i++){GAME.tick++;updateAreas();}assert.equal(t.hp,344);
`);
check('irradiate uses shield and armor-ignore damage on air and ground, while protecting eggs, buried neighbors and stasis',`
 const c=unit('vessel'),source=unit('marine',600,500,1),z=unit('zealot',615,500,1),air=unit('mutalisk',600,515,1),egg=unit('egg',600,500,1),burrow=unit('hydra',600,500,1);burrow.burrowed=true;
 source.irrT=8;source.irrSrc=c;refresh();for(let i=0;i<8;i++)source.timers();
 assert.equal(z.hp,100);assert.equal(z.sh,60-Math.floor(250*256/75)/256);assert.ok(air.hp<120);assert.equal(egg.hp,200);assert.equal(burrow.hp,80);
`);
check('nuclear damage uses original 128/192/256 rings and explosive size/armor reduction',`
 const g=unit('ghost',100,100),inner=unit('ultralisk',600,500,1),half=unit('ultralisk',770,500,1),outer=unit('ultralisk',830,500,1),outside=unit('ultralisk',880,500,1);refresh();
 GAME.areas=[{kind:'nuke',x:600,y:500,r:256,t:359,life:360,src:g}];updateAreas();
 assert.ok(inner.dead);assert.equal(half.hp,151);assert.equal(outer.hp,276);assert.equal(outside.hp,400);
`);
check('mines ignore hovering workers and archons, then pursue ground enemies and splash their own vulture',`
 const v=unit('vulture',500,500),m=unit('spider_mine',510,500);m.src=v;m.burrowed=true;
 for(const t of ['scv','drone','probe','archon','dark_archon','vulture'])unit(t,540,500,1);
 refresh();for(let i=0;i<8;i++){GAME.tick++;m.mineUpdate();}assert.equal(m.mineTgt,null);
 const enemy=unit('marine',550,500,1);refresh();for(let i=0;i<8&&!m.dead;i++){GAME.tick++;m.mineUpdate();physics();}
 assert.ok(m.dead);assert.ok(enemy.dead);assert.equal(v.hp,0);
`);
const weapons=world()(`Object.entries({...UNITS,...BUILDINGS}).flatMap(([type,d])=>['gw','aw'].filter(k=>d[k]).map(k=>[type,k,!!BUILDINGS[type]]))`);
for(const [type,slot,isBuilding] of weapons)for(const owner of [0,1])check(type+' '+slot+' damages '+(owner?'enemy':'forced friendly')+' primary with its actual firing path',`
 const src=${isBuilding?'building':'unit'}('${type}'),t='${slot}'==='aw'?unit('bc',650,500,${owner}):building('cc',20,16,${owner});
 src.x=t.x-150;src.y=t.y;src.ammo=4;refresh();const hp=t.hp,sh=t.sh;
 fireWeapon(src,t,src.def.${slot});projectiles(120);
 if('${type}'==='lurker'&&${owner}===0)assert.equal(t.hp,hp);
 else assert.ok(t.hp<hp||t.sh<sh,'weapon did not damage its primary target');
`);
