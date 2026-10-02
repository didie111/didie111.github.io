'use strict';
// ===================================================================
//  엔티티(유닛/건물) — 명령 처리, 이동, 전투, 채취, 건설, 생산
// ===================================================================
let GROUP_ID = 1;

class Entity {
  constructor(type, owner, x, y) {
    const d = typeDef(type);
    this.id = GAME.nextId++;
    this.type = type; this.def = d; this.owner = owner; this.race = d.race;
    this.isBuilding = !!BUILDINGS[type];
    this.x = x; this.y = y;
    if (this.isBuilding) { this.hw = d.w * 16; this.hh = d.h * 16; this.r = Math.max(this.hw, this.hh); }
    else this.r = d.r;
    this.air = !!d.air;
    this.maxHp = d.hp; this.hp = d.hp;
    this.maxSh = d.sh || 0; this.sh = this.maxSh;
    this.maxEnergy = d.energy || 0; this.energy = d.energy ? 50 : 0;
    this.dir = Math.PI / 2;
    this.velocityDirection = this.dir; this.currentSpeed = 0;
    this.orders = [];
    this.cooldown = 0; this.vx = 0; this.vy = 0;
    this.path = null; this.pi = 0;
    this.kills = 0; this.anim = Math.random() * 100; this.attackAnim = 0;
    this.done = true;
    this.tgt = null;
    this.queue = [];
    this.cargo = [];
    this.carry = 0; this.carryKind = null;
    this.mines = d.mines || 0;
    this.born = GAME.tick;
  }

  // ---------- 스탯 ----------
  get speed() {
    const d = this.def; let s = d.speed || 0;
    if (this.lifted) return 1.1;
    const upgrades = { zergling: 'metabolic', hydra: 'muscular', zealot: 'legs', vulture: 'ion', overlord: 'pneumatized', ultralisk: 'anabolic' };
    const modifier = (hasTech(this.owner, upgrades[this.type]) ? 1 : 0) + (this.stimT > 0 ? 1 : 0) - (this.ensnareT > 0 ? 1 : 0);
    if (modifier > 0) s = Math.max(s * 1.5, 10 / 3);
    if (modifier < 0) s /= 2;
    return s;
  }

  get armor() {
    const d = this.def; let a = d.armor || 0;
    if (this.isBuilding) return a;
    if (d.armorUpg && d.armorUpg !== 'none') a += upgLevel(this.owner, d.armorUpg);
    if (this.type === 'ultralisk' && hasTech(this.owner, 'chitinous')) a += 2;
    return a;
  }
  get shArmor() { return upgLevel(this.owner, 'p_sh'); }
  get airTarget() { return this.air || this.lifted; }
  get isWorker() { return !!this.def.worker; }
  weaponVs(t) {
    if (this.isBuilding && !this.done) return null;
    if (this.burrowed && !this.def.burrowAttack) return null;
    if (this.def.burrowAttack && !this.burrowed) return null;
    if (this.def.ammo && !(this.ammo > 0)) return null;
    if (this.stasisT > 0 || this.maelstromT > 0) return null;
    if (!this.airTarget && typeof underWeb === 'function' && underWeb(this)) return null;
    const w = t.airTarget ? this.def.aw : this.def.gw;
    return w || null;
  }
  get canAttack() { return !!(this.def.gw || this.def.aw) && !(this.isBuilding && !this.done); }
  range(w) {
    let r = w.range;
    if (this.type === 'marine' && hasTech(this.owner, 'u238')) r += 32;
    if (this.type === 'hydra' && hasTech(this.owner, 'grooved')) r += 32;
    if (this.type === 'dragoon' && hasTech(this.owner, 'singularity')) r += 64;
    if (this.inside && this.inside.def.bunker) r += 32;
    return r;
  }
  weaponDmg(w) {
    let d = this.type === 'reaver' && hasTech(this.owner, 'scarab_damage') ? 125 : w.dmg;
    if (w.upg && w.upg !== 'none') d += (w.inc || 1) * upgLevel(this.owner, w.upg);
    return d;
  }
  acqRange() {
    if (this.type === 'ghost' && this.cloaked && !(this.orders[0] && this.orders[0].t === 'hold')) return 0;
    let best = 0;
    for (const w of [this.def.gw, this.def.aw]) if (w) best = Math.max(best, this.range(w));
    if (this.type === 'tank_siege') return best;
    if (this.isBuilding) return best;
    return Math.min(Math.max(best + 32, 3 * TILE), (this.def.sight || 7) * TILE);
  }
  get moving() { return this.vx !== 0 || this.vy !== 0; }

  // ---------- 명령 ----------
  issue(o, queued) {
    if (!queued) {
      if (this.orders.length && this.orders[0].t === 'construct' && o.t !== 'construct') {
        const b = this.orders[0].tgt; if (b && b.builder === this) b.builder = null;
      }
      this.releaseMining();
      this.groundRecovery = null;
      this.orders = [o]; this.path = null; this.tgt = null; this.stuck = 0;
      this.vx = 0; this.vy = 0; this.lastD = undefined; this.giveUp = 0; this.avoidSide = 0; this.blockedTicks = 0;
      this.unitPathUntil = 0; this.pathRetryAt = 0; this.pathDynamic = false;
      this.collisionWait = 0; this.repathMoversUntil = 0;
    } else this.orders.push(o);
    this.syncHarvestCollision();
  }
  syncHarvestCollision() {
    const o = this.orders[0];
    this.noCollide = !!this.burrowed || !!(this.isWorker && o && (o.t === 'gather' || o.t === 'ret'));
  }
  releaseMining() {
    const o = this.orders[0];
    if (o && o.t === 'gather' && o.tgt && o.tgt.miner === this) o.tgt.miner = null;
    if (o && o.t === 'gather' && o.tgt && o.tgt.gasUser === this) {
      o.tgt.gasUser = null;
      if (this.hidden && !this.inside) {
        this.hidden = false;
        const sp = findSpawnSpot(o.tgt, this.r, this.x, this.y); this.x = sp[0]; this.y = sp[1];
      }
    }
  }
  nextOrder() {
    this.releaseMining();
    this.orders.shift(); this.path = null; this.tgt = null; this.stuck = 0;
    this.collisionWait = 0; this.repathMoversUntil = 0;
    this.syncHarvestCollision();
  }
  stopAll() { this.issue({ t: 'stop' }); this.orders = []; }

  // ---------- 매 틱 ----------
  update() {
    if (this.dead) return;
    this.timers();
    if (this.dead) return;
    this.vx = 0; this.vy = 0;
    if (this.cooldown > 0) this.cooldown--;
    if (this.attackAnim > 0) this.attackAnim--;
    if (this.inside) { if (this.inside.def.bunker) this.bunkerLogic(); return; }
    if (this.hidden) { const o = this.orders[0]; if (o && o.t === 'gather' && o.phase === 'in') this.gatherLogic(o); return; }
    if (this.isBuilding) { this.buildingUpdate(); return; }
    if (this.type === 'egg' || this.type === 'lurker_egg') { this.eggUpdate(); return; }
    if (this.lockT > 0 || this.stasisT > 0 || this.maelstromT > 0) return;
    if (this.xform) { if (--this.xform.t <= 0) this.finishTransform(); return; }
    if (this.type === 'larva') { this.larvaUpdate(); return; }
    if (this.def.mine) { this.mineUpdate(); return; }
    if (this.def.timed && GAME.tick - this.born > this.def.timed) { killEntity(this, null); return; }
    if (this.ammoQueue && this.ammoQueue.length) {
      const q = this.ammoQueue[0]; q.prog += GAME.buildSpeed;
      if (q.prog >= q.total) { this.ammoQueue.shift(); this.ammo = (this.ammo || 0) + 1; }
    }
    this.orderLogic();
  }

  timers() {
    const d = this.def;
    if (this.lifeT > 0 && --this.lifeT === 0) { killEntity(this, null); return; }
    if (this.stimT > 0) this.stimT--;
    if (this.ensnareT > 0) this.ensnareT--;
    if (this.lockT > 0) this.lockT--;
    if (this.stasisT > 0) this.stasisT--;
    if (this.maelstromT > 0) this.maelstromT--;
    if (this.acidT > 0 && --this.acidT <= 0) this.acidSpores = 0;
    if (this.matrixT > 0) { if (--this.matrixT <= 0) this.matrixHp = 0; }
    if (this.maxEnergy && this.energy < this.maxEnergy && !(this.isBuilding && !this.done)) this.energy = Math.min(this.maxEnergy, this.energy + 0.03125);
    if (this.maxSh && this.sh < this.maxSh && this.done) this.sh = Math.min(this.maxSh, this.sh + 0.027);
    if (this.race === 'Z' && this.hp < this.maxHp && this.done) this.hp = Math.min(this.maxHp, this.hp + 0.0156);
    if (this.cloaked && !d.permCloak) {
      this.energy -= 0.04;
      if (this.energy <= 0) { this.energy = 0; this.cloaked = false; }
    }
    if (this.irrT > 0) {
      this.irrT--;
      for (const o of SH.query(this.x, this.y, 40)) {
        if (o.dead || o.hidden || o.isBuilding || !o.def.bio || o.air !== this.air) continue;
        if (dist(o.x, o.y, this.x, this.y) <= 32 + o.r || o === this) o.takeRaw(0.4167, this.irrSrc);
      }
    }
    if (this.plagueT > 0) { this.plagueT--; if (this.hp > 1) this.hp = Math.max(1, this.hp - 0.5); }
    if (this.isBuilding && this.race === 'T' && this.done && this.hp < this.maxHp / 3 && !this.dead) {
      this.hp -= 0.08; if (this.hp <= 0) killEntity(this, null);
    }
  }

  // ---------- 주문 처리 ----------
  orderLogic() {
    const o = this.orders[0];
    if (this.def.healer) { if (this.healLogic(o)) return; }
    if (!o) { this.idleLogic(false); return; }
    switch (o.t) {
      case 'nuke': break;
      case 'recharge': {
        const b = o.tgt;
        if (!b || b.dead || !b.done || b.unpowered || b.energy <= 0 || this.sh >= this.maxSh) { this.nextOrder(); break; }
        if (edgeDist(this, b) > 12) { this.moveTo(b.x, b.y, this.r + b.r + 6, b); break; }
        const amount = Math.min(8, this.maxSh - this.sh, b.energy * 2);
        this.sh += amount; b.energy -= amount / 2; break;
      }
      case 'move': {
        if (this.moveGroup(o)) this.nextOrder();
        break;
      }
      case 'hold': this.idleLogic(true); break;
      case 'stop': this.nextOrder(); break;
      case 'amove': case 'patrol': {
        if (this.combatScan(true)) break;
        if (this.moveGroup(o)) {
          if (o.t === 'patrol') { const ox = o.ox, oy = o.oy; o.ox = o.x; o.oy = o.y; o.x = ox; o.y = oy; this.path = null; o.group = 0; }
          else this.nextOrder();
        }
        break;
      }
      case 'attack': {
        const t = o.tgt;
        if (!t || t.dead || !targetableBy(t, this.owner)) {
          if (t && !t.dead && !this.isBuilding && !o.chasedToLast) { o.chasedToLast = true; o.lx = t.x; o.ly = t.y; }
          if (o.chasedToLast && o.lx !== undefined && t && !t.dead) { if (this.moveTo(o.lx, o.ly, 16)) this.nextOrder(); break; }
          this.nextOrder(); break;
        }
        o.chasedToLast = false;
        if (!this.engage(t, true)) {
          if (!this.weaponVs(t)) notify(this.owner, 'cant', '그 대상은 공격할 수 없습니다.', 'err');
          this.nextOrder();
        }
        break;
      }
      case 'follow': {
        const t = o.tgt;
        if (!t || t.dead) { this.nextOrder(); break; }
        if (t.hidden) { this.nextOrder(); break; }
        this.moveTo(t.x, t.y, this.r + t.r + 12);
        break;
      }
      case 'gather': this.gatherLogic(o); break;
      case 'ret': this.returnLogic(o); break;
      case 'build': this.buildLogic(o); break;
      case 'construct': this.constructLogic(o); break;
      case 'repair': this.repairLogic(o); break;
      case 'load': {
        const t = o.tgt;
        if (!t || t.dead || t.owner !== this.owner || !canLoad(t, this)) { this.nextOrder(); break; }
        if (edgeDist(this, t) <= 10) { loadUnit(t, this); this.orders = []; break; }
        if (t.air && !t.moving && t.orders.length === 0) { t.vx = 0; }
        this.moveTo(t.x, t.y, this.r + t.r);
        break;
      }
      case 'pickup': {
        const t = o.tgt;
        if (!t || t.dead || t.hidden || !canLoad(this, t)) { this.nextOrder(); break; }
        if (edgeDist(this, t) <= 10) { loadUnit(this, t); this.nextOrder(); break; }
        this.moveTo(t.x, t.y, 6);
        break;
      }
      case 'unload': {
        if (!this.cargo.length) { this.nextOrder(); break; }
        if (this.isBuilding || this.moveTo(o.x, o.y, 8)) { unloadAll(this); this.nextOrder(); }
        break;
      }
      case 'spell': this.spellLogic(o); break;
      case 'mine': {
        if (this.mines <= 0) { this.nextOrder(); break; }
        if (this.moveTo(o.x, o.y, 12)) {
          this.mines--;
          const m = createUnit('spider_mine', this.owner, o.x, o.y);
          m.burrowT = 20; m.burrowed = false; m.src = this;
          this.nextOrder();
        }
        break;
      }
      default: this.nextOrder();
    }
  }

  // 대기 상태: 사거리 안 적 자동 공격 / 공격받으면 반격 / 밀리면 비켜남
  idleLogic(hold) {
    if (this.sieging) return;
    if (this.canAttack && (!this.isWorker || this.retaliate)) {
      if (this.tgt && (this.tgt.dead || !targetableBy(this.tgt, this.owner) || !this.weaponVs(this.tgt))) { this.tgt = null; this.retaliate = null; }
      if (!this.tgt && !this.isWorker && (GAME.tick + this.id) % 6 === 0) this.tgt = this.findTarget(this.acqRange());
      if (this.isWorker && this.retaliate && !this.tgt) this.tgt = this.retaliate;
      if (this.tgt) {
        if (hold && !this.inRangeOf(this.tgt)) { this.tgt = this.findTarget(Math.max(...[this.def.gw, this.def.aw].filter(Boolean).map(w => this.range(w)))); if (!this.tgt) return; }
        if (this.isWorker && edgeDist(this, this.tgt) > 3 * TILE) { this.tgt = null; this.retaliate = null; return; }
        if (!this.engage(this.tgt, !hold && !this.isBuilding && this.speed > 0)) this.tgt = null;
        return;
      }
    }
    // 명령/교전이 없으면 마지막 방향을 유지한다. 그래픽 자체의 대기 모션과 이동 회전은 분리한다.
  }
  inRangeOf(t) {
    const w = this.weaponVs(t); if (!w) return false;
    const d = edgeDist(this, t);
    return d <= this.range(w) && d >= (w.minRange || 0);
  }

  // 공격 이동/정찰 중 적 탐색
  combatScan(canMove) {
    if (!this.canAttack) return false;
    if (this.tgt && (this.tgt.dead || !targetableBy(this.tgt, this.owner) || !this.weaponVs(this.tgt))) this.tgt = null;
    if ((GAME.tick + this.id) % 6 === 0) {
      const t = this.findTarget(this.acqRange());
      if (t && (!this.tgt || (threat(t) > threat(this.tgt)))) this.tgt = t;
    }
    if (this.tgt) {
      if (this.engage(this.tgt, canMove)) return true;
      this.tgt = null;
    }
    return false;
  }

  findTarget(r) {
    if (r <= 0) return null;
    let best = null, bs = -1e9;
    const list = SH.query(this.x, this.y, r + 40);
    for (const e of list) {
      if (e.dead || e.hidden || !isEnemy(this.owner, e.owner)) continue;
      if (e.type === 'larva' || e.type === 'egg' && !this.isBuilding && false) continue;
      const w = this.weaponVs(e); if (!w) continue;
      const d = edgeDist(this, e);
      if (d > r) continue;
      if (w.minRange && d < w.minRange) continue;
      if (!targetableBy(e, this.owner)) continue;
      if (e.type === 'spider_mine' && !e.burrowed) continue;
      const s = threat(e) * 1000 - d;
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }

  // 대상 교전: 사거리 밖이면 추적, 사거리 안이면 사격
  engage(t, canMove) {
    const w = this.weaponVs(t);
    if (!w) return false;
    if (!targetableBy(t, this.owner)) return false;
    const d = edgeDist(this, t);
    const rng = this.range(w);
    if (d > rng) {
      if (!canMove || this.speed <= 0) return false;
      this.moveTo(t.x, t.y, 0, t);
      return true;
    }
    if (w.minRange && d < w.minRange) return false;
    this.path = null;
    this.dir = Math.atan2(t.y - this.y, t.x - this.x);
    if (this.cooldown <= 0) this.fire(t, w);
    return true;
  }

  fire(t, w) {
    if (this.def.ammo && !(this.ammo > 0)) return;
    if (this.type === 'reaver') this.ammo--;
    const cd = this.weaponCooldown(w);
    // OpenBW 무기 쿨다운 처리의 -1..+2 프레임 편차를 따른다.
    this.cooldown = Math.max(1, cd + Math.floor(Math.random() * 4) - 1);
    this.attackAnim = 6;
    if (this.cloaked && !this.def.permCloak) { /* 원작: 클로킹 유지 */ }
    fireWeapon(this, t, w);
  }
  weaponCooldown(w) {
    let cd = w.cd + Math.max(Math.floor(w.cd / 8), 3) * (this.acidSpores || 0);
    const mod = (this.stimT > 0 ? 1 : 0) + (this.type === 'zergling' && hasTech(this.owner, 'adrenal') ? 1 : 0) - (this.ensnareT > 0 ? 1 : 0);
    if (mod > 0) cd = Math.floor(cd / 2);
    if (mod < 0) cd += Math.floor(cd / 4);
    return Math.max(5, Math.min(250, cd));
  }

  // ---------- 이동 ----------
  moveGroup(o) {
    const arr = o.arrive ?? .001;
    // UM_FixCollision state 2: 충돌한 몸체가 실제 목표를 점유하면 접촉에서
    // 멈춘다. 전속력·반·사분의 일 접근 뒤 남는 거리만 허용하므로 먼 동료에게
    // 도착 처리를 전파하지 않는다. 이미 겹친 몸체는 먼저 탈출해야 한다.
    if (groundCollider(this)) {
      const blocker = PF.goalBlocker(o.x, o.y, this.r, SH.query(o.x, o.y, this.r + 48), o.group, this.owner);
      if (blocker) {
        const gap = (this.r + blocker.r) * 0.85, d = dist(this.x, this.y, blocker.x, blocker.y);
        const length = this.speed / 4, dx = o.x - this.x, dy = o.y - this.y, targetDistance = Math.hypot(dx, dy) || 1;
        if (d >= gap - 1e-6 && d <= gap + length + 0.1 &&
            !PF.unitsClear(this.x, this.y, this.x + dx / targetDistance * length, this.y + dy / targetDistance * length, this.r, [blocker])) {
          this.arrivedGroup = o.group; this.path = null; this.vx = 0; this.vy = 0; return true;
        }
      }
    }
    // OpenBW order_Move / path_progress: 실제 목표 또는 탐색으로 조정한
    // 도달 지점에 도착해야 완료한다. 동료 접촉을 도착으로 전파하지 않는다.
    if (this.moveTo(o.x, o.y, arr, null, o.group)) { this.arrivedGroup = o.group; return true; }
    return false;
  }

  moveTo(x, y, arrive, tgtEnt, group) {
    this.moveWaypoint = null;
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    const edge = tgtEnt ? edgeDist(this, tgtEnt) : d;
    if (edge <= arrive) { this.path = null; this.vx = 0; this.vy = 0; return true; }
    const sp = this.speed;
    if (sp <= 0 || this.burrowed || this.sieging || this.xform) { this.vx = 0; this.vy = 0; return true; }
    if (this.air || this.lifted) {
      const s = Math.min(sp, d);
      this.vx = dx / d * s; this.vy = dy / d * s;
      this.dir = Math.atan2(dy, dx);
      return false;
    }
    // 목표를 막던 몸체가 움직이면 이전의 조정된 도착점은 더 이상 유효하지 않다.
    if (this.path && this.path.goalBlocker &&
        !PF.goalBlocker(x, y, this.r, [this.path.goalBlocker], group, this.owner)) {
      this.path = null; this.pathRetryAt = 0; this.unitPathUntil = 0;
    }
    // OpenBW UM_RetryPath / UM_WaitFree는 대기 중에도 충돌 카운터를 진행한다.
    // 경로 재시도도 막힘 시간에 포함하지만 정지한 이웃에게 이동을 강제하지 않는다.
    const waitForPath = () => {
      this.vx = 0; this.vy = 0; this.lastD = d;
      this.stuck = Math.min(255, (this.stuck || 0) + 1); return false;
    };
    if (!this.path && GAME.tick < (this.pathRetryAt || 0)) return waitForPath();
    // 직선 통행 가능 시 경로 없이 이동
    if (this.blockedTicks >= 12) { this.unitPathUntil = GAME.tick + 120; this.path = null; this.blockedTicks = 0; }
    const avoidUnits = GAME.tick < (this.unitPathUntil || 0);
    const needRepath = !this.path || Math.abs((this.pgx || 0) - x) > 40 || Math.abs((this.pgy || 0) - y) > 40 || GAME.tick >= (this.repathAt || 0);
    if (needRepath) {
      if ((GAME.tick + this.id) % 4 === 0 || !this.path) {
        if (!avoidUnits && PF.lineClear(this.x, this.y, x, y, Math.max(3, this.r * 0.75), 0)) { this.path = [[x, y]]; this.pi = 0; this.pgx = x; this.pgy = y; this.repathAt = GAME.tick + 24; this.pathExact = true; this.pathDynamic = false; }
        else if (PF.budget > 0) {
          const p = avoidUnits ? PF.unitPath(this.x, this.y, x, y, this.r,
            PF.unitObstacles(this, GAME.tick < (this.repathMoversUntil || 0)), group, this.owner) : PF.worldPath(this.x, this.y, x, y, this.r, 0);
          this.pgx = x; this.pgy = y; this.repathAt = GAME.tick + 120;
          if (!p || !p.length) {
            this.path = null; this.vx = 0; this.vy = 0;
            if (avoidUnits) { this.pathRetryAt = GAME.tick + 12 + this.id % 6; return waitForPath(); }
            return true;
          }
          this.path = p; this.pi = 0; this.pathDynamic = avoidUnits;
          this.pathExact = dist(p[p.length - 1][0], p[p.length - 1][1], x, y) < 1;
        }
      }
    }
    let wx = x, wy = y;
    if (this.path && this.path.length) {
      // 목표가 움직이는 경우 마지막 점을 갱신
      const end = this.path[this.path.length - 1];
      if (this.pathExact && (tgtEnt || this.path.length === 1) || tgtEnt && tgtEnt.isBuilding && edgeDistPt(tgtEnt, end[0], end[1]) <= TILE) this.path[this.path.length - 1] = [x, y];
      while (this.pi < this.path.length - 1 && dist(this.x, this.y, this.path[this.pi][0], this.path[this.pi][1]) < (this.pathDynamic ? 0.001 : Math.max(10, sp * 1.5))) this.pi++;
      [wx, wy] = this.path[this.pi];
      if (this.path.goalBlocker && this.pi === this.path.length - 1 && dist(this.x, this.y, wx, wy) < 0.001) {
        this.path = null; this.vx = 0; this.vy = 0; return true;
      }
      if (!this.pathExact && !this.path.goalBlocker && this.pi === this.path.length - 1 && dist(this.x, this.y, wx, wy) < Math.max(4, sp)) {
        // 목적지가 막혀 있어 더 못 가는 경우
        if (d > arrive) {
          this.path = null;
          // 유닛 장애물의 거친 타일 경로가 여기서 끝나더라도 목적지 도착은 아니다.
          // 지형 경로와 국소 회피를 다시 시도한다. 일시 정체로 명령을 지우지 않는다.
          if (this.pathDynamic && !this.pathExact) { this.unitPathUntil = 0; this.blockedTicks = 0; return false; }
          return !tgtEnt ? true : false;
        }
      }
    }
    const wdx = wx - this.x, wdy = wy - this.y, wd = Math.hypot(wdx, wdy) || 1;
    // 마지막 짧은 구간도 경유점에 정확히 도착한다. 최소 이동량을 강제하면
    // 0.5px보다 가까운 점을 매 틱 넘어서며 회전/좌우 왕복을 반복한다.
    const s = Math.min(sp, wd);
    this.vx = wdx / wd * s; this.vy = wdy / wd * s;
    this.moveWaypoint = [wx, wy];
    if (!GROUND_MOTION[this.type]) this.dir = Math.atan2(wdy, wdx);
    // 막힘 감지
    if (this.lastD !== undefined && d > this.lastD - 0.05 * sp) this.stuck = (this.stuck || 0) + 1;
    else this.stuck = Math.max(0, (this.stuck || 0) - 2);
    this.lastD = d;
    if (this.stuck > 40) {
      this.stuck = 0; this.path = null; this.repathAt = 0;
      this.unitPathUntil = GAME.tick + 120;
      this.giveUp = (this.giveUp || 0) + 1;
      // 정체 횟수만으로 이동 명령을 완료 처리하지 않는다.
    }
    return false;
  }

  // ---------- 채취 ----------
  returnDepot(o) {
    // ReturnMinerals/ReturnGas처럼 명령과 적재물을 유지하며 반납 기지를 재탐색한다.
    this.noCollide = true;
    let th = o.depot;
    if (th && (th.dead || th.owner !== this.owner || !th.done || th.lifted || th.liftT > 0)) {
      th = o.depot = null; this.path = null; o.depotRetryAt = 0;
    }
    if (!th && GAME.tick >= (o.depotRetryAt || 0)) {
      th = o.depot = nearestTownHall(this.owner, this.x, this.y);
      if (!th) o.depotRetryAt = GAME.tick + 75;
    }
    if (!th) { this.path = null; this.vx = 0; this.vy = 0; }
    return th;
  }
  gatherLogic(o) {
    if (this.carry > 0 && o.phase !== 'ret' && o.phase !== 'in') o.phase = 'ret';
    if (o.phase === 'ret') {
      const th = this.returnDepot(o);
      if (!th) return;
      if (this.moveTo(th.x, th.y, 4, th)) {
        const p = P(this.owner);
        if (this.carryKind === 'gas') p.gas += this.carry; else p.min += this.carry;
        this.carry = 0; this.carryKind = null; o.phase = 'go'; this.path = null;
        o.depot = null; o.depotRetryAt = 0;
      }
      return;
    }
    let res = o.tgt;
    if (!res || res.dead) {
      res = o.tgt = res && res.type === 'mineral' ? findFreeMineral(o.lx || this.x, o.ly || this.y, this, null) : null;
      if (!res) { this.nextOrder(); this.noCollide = false; return; }
    }
    // 원작은 가스통 자체가 정제소로 바뀌므로 기존 접근 목표가 유지된다.
    // 여기서는 새 건물을 생성하므로 완성된 아군 정제소로 목표를 연결한다.
    if (res.type === 'geyser' && res.refinery && !res.refinery.dead && res.refinery.done && res.refinery.owner === this.owner) {
      res = o.tgt = res.refinery; this.lastRes = res; this.path = null;
    }
    o.lx = res.x; o.ly = res.y;
    this.noCollide = true;
    if (res.type === 'mineral') {
      if (o.phase === 'mine') {
        this.dir = Math.atan2(res.y - this.y, res.x - this.x);
        if (GAME.tick % 8 === 0) fx('mining', res.x + (Math.random() - 0.5) * 20, res.y + (Math.random() - 0.5) * 8, { life: 6, race: this.race });
        this.attackAnim = 2;
        if (--this.mineT <= 0) {
          const amt = Math.min(8, res.amount);
          res.amount -= amt; this.carry = amt; this.carryKind = 'min';
          res.miner = null; o.phase = 'ret'; this.path = null;
          if (res.amount <= 0) killEntity(res, null);
        }
        return;
      }
      if (this.moveTo(res.x, res.y, 3, res)) {
        if (res.miner && res.miner !== this && !res.miner.dead && res.miner.orders[0] && res.miner.orders[0].tgt === res && res.miner.orders[0].phase === 'mine') {
          const alt = findFreeMineral(res.x, res.y, this, res);
          if (alt) { o.tgt = alt; this.path = null; }
          return; // 대기
        }
        res.miner = this; o.phase = 'mine'; this.mineT = 75;
      }
    } else {
      // 가스
      // get_default_gather_order / MoveToGas: 미정제 가스도 채취 충돌로 접근한다.
      // 도착 후 채취 가능 여부를 검사하며, 정제소가 없으면 충돌을 복원한다.
      if (res.type === 'geyser') {
        if (this.moveTo(res.x, res.y, 3, res)) this.nextOrder();
        return;
      }
      if (res.dead || res.owner !== this.owner || !res.done || !res.def.onGeyser) { this.nextOrder(); this.noCollide = false; return; }
      if (o.phase === 'in') {
        if (--this.gasT <= 0) {
          this.hidden = false; res.gasUser = null;
          const g = res.geyser;
          const amt = g && g.amount > 0 ? Math.min(8, g.amount) : 2;
          if (g) g.amount = Math.max(0, g.amount - amt);
          this.carry = amt; this.carryKind = 'gas'; o.phase = 'ret';
          const sp = findSpawnSpot(res, this.r, this.x, this.y);
          this.x = sp[0]; this.y = sp[1];
        }
        return;
      }
      if (this.moveTo(res.x, res.y, 3, res)) {
        if (!res.gasUser || res.gasUser.dead || res.gasUser.orders[0]?.tgt !== res) {
          res.gasUser = this; o.phase = 'in'; this.gasT = 37; this.hidden = true;
        }
      }
    }
  }
  returnLogic(o) {
    if (this.carry <= 0) { this.nextOrder(); return; }
    const th = this.returnDepot(o);
    if (!th) return;
    if (this.moveTo(th.x, th.y, 4, th)) {
      const p = P(this.owner);
      if (this.carryKind === 'gas') p.gas += this.carry; else p.min += this.carry;
      this.carry = 0; this.carryKind = null;
      const last = this.lastRes;
      this.nextOrder();
      if (!this.orders.length && last && !last.dead) this.issue({ t: 'gather', tgt: last, phase: 'go' });
    }
  }

  // ---------- 건설 ----------
  buildLogic(o) {
    const d = BUILDINGS[o.bt];
    const cx = (o.tx + d.w / 2) * TILE, cy = (o.ty + d.h / 2) * TILE;
    const box = { x: cx, y: cy, hw: d.w * 16, hh: d.h * 16 };
    if (d.onGeyser) {
      // 간헐천 내부는 점유된 타일이다. 내부 목표의 대체 타일 중심에서
      // 멈추면 건설 거리(6px)에 닿지 못하므로 바깥의 실제 작업점을 찾는다.
      if (!canPlace(o.bt, o.tx, o.ty, this.owner, this)) { this.nextOrder(); return; }
      this.noCollide = false;
      if (edgeDist(this, box) <= 6) { startConstruction(this, o); return; }
      if (!o.approach || !PF.positionClear(...o.approach, this.r, 0)) {
        o.approach = gasBuildApproach(this, box, o.failedApproaches);
        this.path = null;
      }
      if (!o.approach) {
        notify(this.owner, 'place', '간헐천으로 접근할 수 없습니다.', 'err'); this.nextOrder(); return;
      }
      if (this.moveTo(...o.approach, 1) && edgeDist(this, box) > 6) {
        (o.failedApproaches ||= new Set()).add(o.approach.join(','));
        o.approach = null;
      }
      return;
    }
    if (edgeDist(this, box) > 6) {
      this.noCollide = false;
      // 목적지는 건물 영역 가장자리
      const tx = Math.max(cx - box.hw + 4, Math.min(cx + box.hw - 4, this.x)), ty = Math.max(cy - box.hh + 4, Math.min(cy + box.hh - 4, this.y));
      const res = this.moveTo(tx, ty, 0, box);
      if (res && edgeDist(this, box) > 40) { notify(this.owner, 'place', '건설 위치에 도달할 수 없습니다.', 'err'); this.nextOrder(); }
      return;
    }
    startConstruction(this, o);
  }
  constructLogic(o) {
    const b = o.tgt;
    if (!b || b.dead || b.done) { this.nextOrder(); return; }
    if (b.builder && b.builder !== this && !b.builder.dead && b.builder.orders[0]?.tgt === b) { this.nextOrder(); return; }
    if (edgeDist(this, b) > 6) { this.moveTo(b.x, b.y, 4, b); return; }
    b.builder = this;
    this.attackAnim = 2;
    // 건물 주위를 오가며 용접
    if (GAME.tick % 24 === 0) {
      const a = Math.random() * Math.PI * 2;
      this.wx = b.x + Math.cos(a) * (b.hw + this.r); this.wy = b.y + Math.sin(a) * (b.hh + this.r);
    }
    if (this.wx !== undefined && dist(this.x, this.y, this.wx, this.wy) > 4) {
      const dx = this.wx - this.x, dy = this.wy - this.y, dd = Math.hypot(dx, dy);
      this.vx = dx / dd * Math.min(2, dd); this.vy = dy / dd * Math.min(2, dd);
    }
    this.dir = Math.atan2(b.y - this.y, b.x - this.x);
    if (GAME.tick % 5 === 0) fx('spark', b.x + (Math.random() - 0.5) * b.hw * 1.6, b.y + (Math.random() - 0.5) * b.hh * 1.6, { life: 5 });
  }
  repairLogic(o) {
    const t = o.tgt;
    if (!t || t.dead || t.hp >= t.maxHp || !t.done) { this.nextOrder(); return; }
    if (edgeDist(this, t) > 6) { this.moveTo(t.x, t.y, 4, t); return; }
    this.dir = Math.atan2(t.y - this.y, t.x - this.x);
    this.attackAnim = 2;
    const time = t.def.time || 300;
    const hpPer = t.maxHp / time;
    const c = t.def.cost || [0, 0];
    this.repAcc = (this.repAcc || 0) + hpPer / t.maxHp;
    const cm = c[0] * 0.33 * this.repAcc, cg = c[1] * 0.33 * this.repAcc;
    if (cm >= 1 || cg >= 1) {
      const p = P(this.owner);
      const nm = Math.floor(cm), ng = Math.floor(cg);
      if (p.min < nm || p.gas < ng) { costFail(this.owner, [nm, ng]); this.nextOrder(); return; }
      p.min -= nm; p.gas -= ng; this.repAcc = 0;
    }
    t.hp = Math.min(t.maxHp, t.hp + hpPer);
    if (GAME.tick % 6 === 0) fx('spark', t.x + (Math.random() - 0.5) * hx(t), t.y + (Math.random() - 0.5) * hy(t), { life: 5 });
  }

  // ---------- 메딕 ----------
  healLogic(o) {
    if (o && (o.t === 'move' || o.t === 'load' || o.t === 'spell' || o.t === 'follow')) return false;
    let t = this.healTgt;
    if (t && (t.dead || t.hidden || t.hp >= t.maxHp || dist(t.x, t.y, this.x, this.y) > 7 * TILE)) t = this.healTgt = null;
    if (!t && (GAME.tick + this.id) % 8 === 0 && this.energy >= 1) {
      let bd = 1e9;
      for (const e of SH.query(this.x, this.y, 6 * TILE)) {
        if (e.dead || e.hidden || e === this || e.owner !== this.owner || !e.def.bio || e.isBuilding || e.air || e.hp >= e.maxHp) continue;
        if (e.type === 'larva' || e.type === 'egg') continue;
        const d = dist(e.x, e.y, this.x, this.y);
        if (d < bd) { bd = d; t = e; }
      }
      this.healTgt = t;
    }
    if (!t || this.energy < 0.5) return false;
    if (edgeDist(this, t) > 30) { if (o && o.t === 'hold') return false; this.moveTo(t.x, t.y, 24, t); return true; }
    this.dir = Math.atan2(t.y - this.y, t.x - this.x);
    const h = Math.min(0.78, t.maxHp - t.hp);
    t.hp += h; this.energy -= h / 2;
    this.attackAnim = 2;
    if (GAME.tick % 6 === 0) fx('heal', t.x, t.y - 4, { life: 8 });
    return true;
  }

  // ---------- 벙커 ----------
  bunkerLogic() {
    const b = this.inside;
    this.x = b.x; this.y = b.y;
    if (!this.canAttack) return;
    if (this.cooldown > 0) return;
    if (this.tgt && (this.tgt.dead || !targetableBy(this.tgt, this.owner) || !this.inRangeOfFrom(b, this.tgt))) this.tgt = null;
    if (!this.tgt && (GAME.tick + this.id) % 6 === 0) {
      let best = null, bd = 1e9;
      for (const e of SH.query(b.x, b.y, 9 * TILE)) {
        if (e.dead || e.hidden || !isEnemy(this.owner, e.owner)) continue;
        if (!this.weaponVs(e) || !targetableBy(e, this.owner) || !this.inRangeOfFrom(b, e)) continue;
        const d = edgeDist(b, e) - threat(e) * 64;
        if (d < bd) { bd = d; best = e; }
      }
      this.tgt = best;
    }
    if (this.tgt) { const w = this.weaponVs(this.tgt); this.fire(this.tgt, w); b.attackAnim = 4; }
  }
  inRangeOfFrom(b, t) { const w = this.weaponVs(t); return w && edgeDist(b, t) <= this.range(w); }

  // ---------- 주문(스킬) ----------
  spellLogic(o) {
    const s = SPELLS[o.s];
    const tx = o.tgt ? o.tgt.x : o.x, ty = o.tgt ? o.tgt.y : o.y;
    if (o.tgt && (o.tgt.dead || o.tgt.hidden)) { this.nextOrder(); return; }
    const rng = (s.range || 1) * TILE;
    const d = o.tgt ? edgeDist(this, o.tgt) : dist(this.x, this.y, tx, ty);
    if (d > rng) { this.moveTo(tx, ty, rng * 0.9, o.tgt); return; }
    this.dir = Math.atan2(ty - this.y, tx - this.x);
    castSpell(this, o.s, o.tgt, tx, ty);
    if (this.orders[0] === o) this.nextOrder();
  }

  // ---------- 변신 ----------
  finishTransform() {
    const to = this.xform.to; this.xform = null;
    const hpF = this.hp / this.maxHp;
    this.type = to; this.def = UNITS[to];
    this.maxHp = this.def.hp; this.hp = Math.max(1, hpF * this.maxHp);
    this.r = this.def.r; this.sieging = false;
    this.cooldown = 0;
  }

  // ---------- 라바 / 에그 ----------
  larvaUpdate() {
    const h = this.hatch;
    if (!h || h.dead) { if (GAME.tick % 48 === 0 && Math.random() < 0.02) killEntity(this, null); return; }
    if (!this.home || GAME.tick % 60 === (this.id % 60)) this.home = [h.x + (Math.random() - 0.5) * h.hw * 1.6, h.y + h.hh + 6 + Math.random() * 10];
    if (dist(this.x, this.y, this.home[0], this.home[1]) > 2) {
      const dx = this.home[0] - this.x, dy = this.home[1] - this.y, d = Math.hypot(dx, dy);
      this.vx = dx / d * 0.4; this.vy = dy / d * 0.4; this.dir = Math.atan2(dy, dx);
    }
  }
  eggUpdate() {
    this.prog += GAME.buildSpeed;
    if (this.prog >= this.total) {
      const t = this.morphTo, n = UNITS[t].pair ? 2 : 1;
      const hpF = this.type === 'lurker_egg' ? 1 : 1;
      const out = [];
      for (let k = 0; k < n; k++) {
        const u = createUnit(t, this.owner, this.x + (k ? 8 : (n > 1 ? -8 : 0)), this.y);
        u.hp = u.maxHp * hpF; out.push(u);
      }
      const h = this.hatch;
      const selWasEgg = UI.selection.includes(this);
      removeEntity(this);
      fx('eggpop', this.x, this.y, { life: 14 });
      for (const u of out) {
        if (h && !h.dead && h.rally) applyRally(u, h.rally);
        if (selWasEgg) UI.selection.push(u);
      }
      if (this.owner === GAME.control) notify(this.owner, 'hatch' + GAME.tick, '', null);
    }
  }

  // ---------- 스파이더 마인 ----------
  mineUpdate() {
    if (this.burrowT > 0) { if (--this.burrowT <= 0) this.burrowed = true; return; }
    if (!this.burrowed && !this.mineTgt) return;
    let t = this.mineTgt;
    if (!t || t.dead || t.hidden) {
      t = this.mineTgt = null;
      if ((GAME.tick + this.id) % 4) return;
      for (const e of SH.query(this.x, this.y, 3 * TILE)) {
        if (e.dead || e.hidden || e.air || e.isBuilding || e.lifted || !isEnemy(this.owner, e.owner)) continue;
        if (e.type === 'vulture' || e.type === 'spider_mine' || e.burrowed) continue;
        if (dist(e.x, e.y, this.x, this.y) <= 3 * TILE) { t = e; break; }
      }
      if (!t) return;
      this.mineTgt = t; this.burrowed = false;
    }
    const d = edgeDist(this, t);
    if (d <= 4) {
      const w = this.def.gw;
      splashDamage(this, this.x, this.y, w, this.src && !this.src.dead ? this.src : this, true, false);
      fx('explode', this.x, this.y, { life: 16, size: 1 });
      SND.play('boom', this.x, this.y);
      killEntity(this, null, true);
      return;
    }
    this.moveTo(t.x, t.y, 0, t);
  }

  // ---------- 건물 ----------
  buildingUpdate() {
    const d = this.def;
    if (!this.done) {
      let progress = true;
      if (this.race === 'T' && !d.addonOf) {
        const b = this.builder;
        progress = b && !b.dead && b.orders[0] && b.orders[0].t === 'construct' && b.orders[0].tgt === this && edgeDist(b, this) <= 8;
      }
      if (progress) {
        const inc = GAME.buildSpeed;
        this.prog += inc;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.9 / d.time * inc);
        if (this.maxSh) this.sh = Math.min(this.maxSh, this.sh + this.maxSh * 0.9 / d.time * inc);
        if (this.prog >= d.time) completeBuilding(this);
      }
      return;
    }
    if (this.morph) {
      this.morph.prog += GAME.buildSpeed;
      if (this.morph.prog >= this.morph.total) {
        const to = this.morph.to; this.morph = null;
        const hpF = this.hp / this.maxHp;
        this.type = to; this.def = BUILDINGS[to];
        this.maxHp = this.def.hp; this.hp = Math.max(1, hpF * this.maxHp);
        notify(this.owner, 'morph' + this.id, BUILDINGS[to].name + ' 변태 완료', 'done');
      }
    }
    if (d.addonOf) {
      this.parent = GAME.entities.find(b => !b.dead && b.owner === this.owner && b.type === d.addonOf && !b.lifted &&
        this.tx0 === b.tx0 + b.def.w && this.ty0 === b.ty0 + b.def.h - 2);
      if (!this.parent) return;
    }
    const powered = this.race !== 'P' || d.noPower || isPoweredCached(this);
    this.unpowered = !powered;
    if (this.lifted) { this.liftedLogic(); return; }
    if (this.liftT > 0) { if (--this.liftT === 0) this.finishLift(); return; }
    if (!powered || this.lockT > 0) return;
    if (this.nukeBuild > 0) { this.nukeBuild += GAME.buildSpeed; if (this.nukeBuild >= 1500) { this.nukeBuild = 0; this.nukeReady = true; } }
    if (this.orders[0] && this.orders[0].t === 'spell') this.spellLogic(this.orders[0]);
    // 생산
    if (this.queue.length && !this.morph) {
      const q = this.queue[0];
      if (!q.started) {
        if (q.kind === 'unit' && !supplyOk(this.owner, UNITS[q.type].supply)) { if (GAME.tick % 72 === 0) supplyFailMsg(this.owner); }
        else q.started = true;
      }
      if (q.started) {
        q.prog += GAME.buildSpeed;
        if (q.prog >= q.total) { this.queue.shift(); finishProduction(this, q); }
      }
    }
    // 라바
    if (d.larvaHall) {
      const n = larvaCount(this);
      if (n < 3) { this.larvaT = (this.larvaT || 0) + GAME.buildSpeed; if (this.larvaT >= 342) { this.larvaT = 0; spawnLarva(this); } }
      else this.larvaT = 0;
    }
    // 방어 건물
    if (this.canAttack) this.idleLogic(true);
    // 벙커/수송 명령
    if (this.orders.length && this.orders[0].t === 'unload') this.orderLogic();
  }
  liftedLogic() {
    const o = this.orders[0];
    if (!o) return;
    if (o.t === 'move') { if (this.moveTo(o.x, o.y, 2)) this.nextOrder(); }
    else if (o.t === 'land') {
      const d = this.def;
      const cx = (o.tx + d.w / 2) * TILE, cy = (o.ty + d.h / 2) * TILE;
      if (this.moveTo(cx, cy, 1)) {
        if (canPlace(this.type, o.tx, o.ty, this.owner, this)) {
          this.x = cx; this.y = cy; this.tx0 = o.tx; this.ty0 = o.ty;
          this.lifted = false; this.air = false; occupy(this, true); this.liftT = 0;
          fx('dust', cx, cy + this.hh, { life: 20 });
        }
        this.nextOrder();
      }
    } else this.nextOrder();
  }
  finishLift() { this.lifted = true; this.air = true; }

  // ---------- 피해 ----------
  takeRaw(amount, src) {
    if (this.dead || this.stasisT > 0) return;
    this.hp -= amount;
    this.lastHit = GAME.tick;
    if (this.hp <= 0) killEntity(this, src);
  }
  onAttacked(src) {
    if (!src || src.dead || src.owner === this.owner) return;
    this.lastHit = GAME.tick;
    if (this.owner === GAME.control && typeof UI !== 'undefined') UI.underAttack(this);
    if (typeof AI !== 'undefined') AI.onAttacked(this, src);
    // 반격
    const idle = !this.orders.length;
    if (idle && !this.tgt && !this.isBuilding) {
      if (this.weaponVs(src) && targetableBy(src, this.owner)) { this.tgt = src; if (this.isWorker) this.retaliate = src; }
      else if (!this.isWorker && !this.canAttack && this.speed > 0 && !this.burrowed) {
        // 공격 못하는 유닛은 도망
        const dx = this.x - src.x, dy = this.y - src.y, d = Math.hypot(dx, dy) || 1;
        this.issue({ t: 'move', x: this.x + dx / d * 96, y: this.y + dy / d * 96 });
      }
    }
    // 주변 대기 아군 호출
    if (!this.isBuilding || this.def.townHall || true) {
      if ((GAME.tick - (this.helpT || -99)) > 12) {
        this.helpT = GAME.tick;
        for (const e of SH.query(this.x, this.y, 5 * TILE)) {
          if (e.dead || e.hidden || e.owner !== this.owner || e.isBuilding || e.isWorker || e.orders.length || e.tgt) continue;
          if (e.weaponVs(src) && targetableBy(src, e.owner)) e.tgt = src;
        }
      }
    }
  }
}

// 위협도: 공격 가능한 유닛 우선
function threat(e) {
  if (e.isBuilding) return (e.def.gw || e.def.aw || e.def.bunker && e.cargo.length) ? 2 : 0;
  if (e.type === 'larva' || e.type === 'egg' || e.type === 'lurker_egg') return -1;
  if (e.def.gw || e.def.aw || e.def.healer || e.def.energy) return e.isWorker ? 1 : 3;
  return 1;
}

function isPoweredCached(b) {
  if (b.powT === GAME.tick >> 3) return b.powV;
  b.powT = GAME.tick >> 3; b.powV = isPowered(b.owner, b.x, b.y);
  return b.powV;
}

function findFreeMineral(x, y, worker, exclude) {
  let best = null, bd = 1e9;
  for (const e of SH.query(x, y, 10 * TILE)) {
    if (e.dead || e.type !== 'mineral' || e === exclude) continue;
    const dd = dist(e.x, e.y, x, y);
    if (dd > 10 * TILE) continue;
    const busy = e.miner && !e.miner.dead && e.miner !== worker && e.miner.orders[0] && e.miner.orders[0].tgt === e;
    const score = dist(e.x, e.y, worker.x, worker.y) + (busy ? 400 : 0);
    if (score < bd) { bd = score; best = e; }
  }
  if (exclude && best && best.miner && best.miner !== worker && !best.miner.dead) return null;
  return best;
}

function larvaCount(h) {
  let n = 0;
  for (const e of GAME.entities) if (!e.dead && e.type === 'larva' && e.hatch === h) n++;
  return n;
}
function spawnLarva(h) {
  const l = createUnit('larva', h.owner, h.x + (Math.random() - 0.5) * h.hw, h.y + h.hh + 6);
  l.hatch = h;
  return l;
}

function applyRally(u, rally) {
  if (!rally) return;
  if (rally.tgt && !rally.tgt.dead) {
    if (u.isWorker && (rally.tgt.type === 'mineral' || rally.tgt.def.onGeyser && rally.tgt.owner === u.owner)) { u.issue({ t: 'gather', tgt: rally.tgt, phase: 'go' }); return; }
    u.issue({ t: 'follow', tgt: rally.tgt }); return;
  }
  u.issue({ t: 'move', x: rally.x, y: rally.y });
}

function gasBuildApproach(worker, box, failed) {
  const gap = worker.r + 2;
  const left = box.x - box.hw - gap, right = box.x + box.hw + gap;
  const top = box.y - box.hh - gap, bottom = box.y + box.hh + gap;
  const points = [];
  const xs = [Math.max(box.x - box.hw, Math.min(box.x + box.hw, worker.x))];
  const ys = [Math.max(box.y - box.hh, Math.min(box.y + box.hh, worker.y))];
  for (let x = box.x - box.hw; x <= box.x + box.hw; x += TILE / 2) xs.push(x);
  for (let y = box.y - box.hh; y <= box.y + box.hh; y += TILE / 2) ys.push(y);
  for (const x of xs) points.push([x, top], [x, bottom]);
  for (const y of ys) points.push([left, y], [right, y]);
  return points.filter(p => !(failed && failed.has(p.join(','))) && PF.positionClear(...p, worker.r, 0))
    .sort((a, b) => dist(worker.x, worker.y, ...a) - dist(worker.x, worker.y, ...b))[0];
}

function startConstruction(worker, o) {
  const d = BUILDINGS[o.bt];
  if (!canPlace(o.bt, o.tx, o.ty, worker.owner, worker)) { worker.nextOrder(); return; }
  if (!reqMet(worker.owner, d.req)) { worker.nextOrder(); return; }
  if (costFail(worker.owner, d.cost)) { worker.nextOrder(); return; }
  pay(worker.owner, d.cost);
  let geyser = null;
  if (d.onGeyser) {
    geyser = GAME.entities.find(e => !e.dead && e.type === 'geyser' && e.tx0 === o.tx && e.ty0 === o.ty);
    if (geyser) { occupy(geyser, false); geyser.hidden = true; }
  }
  const b = createBuilding(o.bt, worker.owner, o.tx, o.ty, false);
  if (geyser) { b.geyser = geyser; geyser.refinery = b; }
  SND.play('build', b.x, b.y);
  if (worker.race === 'T') {
    worker.orders[0] = { t: 'construct', tgt: b };
    b.builder = worker; worker.noCollide = false;
    const sp = findSpawnSpot(b, worker.r, worker.x, worker.y); worker.x = sp[0]; worker.y = sp[1];
  } else if (worker.race === 'P') {
    fx('warp', b.x, b.y, { life: 30, w: b.hw, h: b.hh });
    worker.nextOrder();
    const sp = findSpawnSpot(b, worker.r, worker.x, worker.y); worker.x = sp[0]; worker.y = sp[1];
  } else {
    // 드론은 건물로 변태
    const sel = UI.selection.indexOf(worker);
    if (sel >= 0) UI.selection[sel] = b;
    removeEntity(worker);
  }
}

function completeBuilding(b) {
  b.done = true; b.prog = b.def.time;
  b.hp = Math.max(b.hp, b.maxHp * 0.999); if (b.maxSh) b.sh = b.maxSh;
  if (b.hp > b.maxHp * 0.99) b.hp = b.maxHp;
  if (b.race === 'T' && b.builder && !b.builder.dead) { const w = b.builder; if (w.orders[0] && w.orders[0].tgt === b) w.nextOrder(); b.builder = null; }
  notify(b.owner, 'done' + b.id, b.def.name + ' 건설 완료', 'done');
  if (b.def.larvaHall) b.larvaT = 300;
  if (b.def.onGeyser && b.geyser) b.geyser.amount = b.geyser.amount || 5000;
  if (typeof AI !== 'undefined') AI.onBuilt(b);
}

function finishProduction(b, q) {
  const p = P(b.owner);
  if (q.kind === 'unit') {
    const n = UNITS[q.type].pair ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const u = createUnit(q.type, b.owner, b.x, b.y);
      const sp = findSpawnSpot(b, u.r);
      u.x = sp[0]; u.y = sp[1];
      if (u.air) { u.x = b.x; u.y = b.y + b.hh; }
      if (b.race === 'P') fx('warp', u.x, u.y, { life: 16, w: u.r, h: u.r });
      if (b.rally) applyRally(u, b.rally);
      if (typeof AI !== 'undefined') AI.onUnit(u);
    }
    notify(b.owner, 'unit' + b.id, '', null);
  } else if (q.kind === 'tech') {
    const t = TECH[q.type];
    if (t.lv) p.upg[q.type] = (p.upg[q.type] || 0) + 1; else p.tech[q.type] = true;
    delete p.researching[q.type];
    notify(b.owner, 'tech' + q.type, t.name + ' 연구 완료', 'done');
  }
}

// 수송 가능 여부 (transport t 가 unit u 를 태울 수 있나)
function canLoad(t, u) {
  if (!t.def.cargo || u.isBuilding || u.air || u.dead) return false;
  if (t.isBuilding && !t.done) return false;
  if (t.def.bunker && !(u.race === 'T' && u.def.bio)) return false;
  if (t.type === 'overlord' && !hasTech(t.owner, 'ventral')) return false;
  if (u.sieging || u.xform || u.type === 'tank_siege' || u.burrowed || u.def.mine || u.type === 'larva' || u.type === 'egg' || u.type === 'lurker_egg') return false;
  const used = t.cargo.reduce((s, e) => s + (e.def.trans || 1), 0);
  return used + (u.def.trans || 1) <= t.def.cargo;
}
function loadUnit(t, u) {
  if (!canLoad(t, u)) return false;
  u.vx = 0; u.vy = 0; u.inside = t; u.hidden = true; u.orders = []; u.tgt = null; u.path = null;
  t.cargo.push(u);
  if (typeof UI !== 'undefined') { const i = UI.selection.indexOf(u); if (i >= 0) UI.selection.splice(i, 1); }
  SND.play('load', t.x, t.y);
  return true;
}
function unloadAll(t) {
  const out = t.cargo.slice();
  for (const u of out) unloadUnit(t, u);
}
function findUnloadSpot(t, u) {
  const base = t.isBuilding ? Math.max(t.hw, t.hh) + u.r : u.r;
  for (let ring = 0; ring < 8; ring++) for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8, r = base + ring * 8;
    const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
    if (!PF.lineClear(x, y, x, y, Math.max(3, u.r * 0.75), 0)) continue;
    if (GAME.entities.some(o => o !== u && o !== t && !o.dead && !o.hidden && groundCollider(o) && dist(o.x, o.y, x, y) < (u.r + o.r) * 0.85)) continue;
    return [x, y];
  }
  return null;
}
function unloadUnit(t, u) {
  if (!t || !u || u.dead || u.inside !== t || !t.cargo.includes(u)) return false;
  const tx = tileOf(t.x), ty = tileOf(t.y);
  if (!t.isBuilding && !groundPassable(tx, ty)) { notify(t.owner, 'unl', '여기에는 내릴 수 없습니다.', 'err'); return false; }
  const sp = findUnloadSpot(t, u);
  if (!sp) { notify(t.owner, 'unl', '유닛을 내릴 빈 공간이 없습니다.', 'err'); return false; }
  u.inside = null; u.hidden = false; u.x = sp[0]; u.y = sp[1];
  t.cargo.splice(t.cargo.indexOf(u), 1);
  return true;
}

function removeEntity(e) {
  if (e.dead) return;
  e.dead = true; e.removed = true;
  if (e.isBuilding && !e.lifted) occupy(e, false);
  GAME.byId.delete(e.id);
}

function killEntity(e, killer, silent) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  if (e.isBuilding && !e.lifted) occupy(e, false);
  if (e.type === 'mineral' || e.type === 'geyser') { GAME.byId.delete(e.id); return; }
  if (killer && killer.owner !== e.owner && killer.owner < 2) { killer.kills++; P(killer.owner).kills++; }
  if (e.owner < 2) P(e.owner).lost++;
  // 가스 건물 → 간헐천 복원
  if (e.geyser) { const g = e.geyser; g.hidden = false; g.refinery = null; occupy(g, true); }
  // 수송물
  if (e.cargo.length) {
    if (e.def.bunker) { for (const u of e.cargo.slice()) unloadUnit(e, u); }
    else for (const u of e.cargo) { u.inside = null; u.hidden = false; u.x = e.x; u.y = e.y; killEntity(u, killer); }
    e.cargo = [];
  }
  if (e.gasUser && e.gasUser.hidden && !e.gasUser.dead) { const w = e.gasUser; w.hidden = false; w.orders = []; w.x = e.x; w.y = e.y + e.hh + 8; }
  if (e.builder) e.builder = null;
  if (e.queue.length) { for (const q of e.queue) if (q.kind === 'tech') delete P(e.owner).researching[q.type]; }
  if (!silent) deathFx(e);
  GAME.byId.delete(e.id);
  if (typeof AI !== 'undefined') AI.onDeath(e, killer);
}

function deathFx(e) {
  const big = e.isBuilding ? 2 : (e.def.size === 'large' ? 1.3 : e.def.size === 'medium' ? 1 : 0.7);
  if (e.isBuilding) {
    if (e.race === 'Z') { fx('zsplat', e.x, e.y, { life: 30, size: big * 1.2 }); GAME.decals.push({ kind: 'zgoo', x: e.x, y: e.y, t: 0, life: 1800, size: e.hw / 16 }); }
    else if (e.race === 'P') { fx('pdeath', e.x, e.y, { life: 30, size: big * 1.5 }); }
    else { for (let k = 0; k < 5; k++) fx('explode', e.x + (Math.random() - 0.5) * e.hw * 1.5, e.y + (Math.random() - 0.5) * e.hh * 1.5, { life: 20 + k * 3, size: 1.5, delay: k * 3 }); GAME.decals.push({ kind: 'rubble', x: e.x, y: e.y, t: 0, life: 2400, size: e.hw / 16 }); }
    SND.play('bigboom', e.x, e.y);
    return;
  }
  if (e.race === 'Z') {
    fx('zsplat', e.x, e.y, { life: 18, size: big });
    if (!e.air) GAME.decals.push({ kind: 'zgoo', x: e.x, y: e.y, t: 0, life: 900, size: big });
    SND.play('splat', e.x, e.y);
  } else if (e.race === 'P') { fx('pdeath', e.x, e.y, { life: 20, size: big }); SND.play('boom', e.x, e.y); }
  else if (e.def.bio) {
    fx('blood', e.x, e.y, { life: 18, size: big });
    GAME.decals.push({ kind: 'blood', x: e.x, y: e.y, t: 0, life: 900, size: big });
    SND.play('die', e.x, e.y);
  } else { fx('explode', e.x, e.y, { life: 18, size: big }); SND.play('boom', e.x, e.y); }
}
