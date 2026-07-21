import Phaser from 'phaser';
import { getCurrentRun, Run } from '../core/run';
import { Player } from '../entities/Player';
import { Enemy, type EnemyContext } from '../entities/Enemy';
import { Boss, type BossContext } from '../entities/Boss';
import { Projectile } from '../entities/Projectile';
import { GAMEPLAY, ENERGY_MAX, ENERGY_REGEN, ENERGY_COST, ULT_CHARGE_FULL, ULT_CHARGE_PER_DMG, ULT_CHARGE_PER_KILL, ringOuterRadius, RING_COUNT, BIOME_NAMES } from '../data/balance';
import { COLORS, ELEMENT_COLORS } from '../data/theme';
import { MOBS_BY_RING, RING_STATS, ringLevelScale, type MobDef } from '../data/mobs';
import { BOSSES_BY_RING, type BossDef } from '../data/bosses';
import { WEAPON_ARCHETYPES, WEAPON_ITEMS, type WeaponItemDef } from '../data/weapons';
import { fullHit, weaponAV, type HitInput } from '../core/damage';
import type { Rarity } from '../data/rarity';
import { applyElement, vulnMult } from '../core/statusEngine';
import { grantKillReward } from '../core/economy';
import { REACTIONS, type Element } from '../data/elements';
import { CLASS_STATS } from '../data/classes';
import { touch, consumeTouch } from '../core/touchInput';

// Радиус, за которым мобы (не боссы) деспавнятся и переспавниваются ближе к игроку.
const CULL_RANGE = 1500;

// Цвета земли биомов по кольцам (индекс = кольцо, 0 = хаб) — насыщенные, контрастные.
const BIOME_GROUND = [0x2a3a5c, 0x2f7a42, 0x4a6a2e, 0x7a3e20, 0x2f6088, 0x4a2274];
// Сила мобов (спавнятся редко, поэтому крепче) и множители награды.
const MOB_HP_MUL = 5.0; // мобы «жирнее» (спавнятся редко)
const MOB_DMG_MUL = 1.5;
const MOB_LOOT_MUL = 3.5;
const MAX_MOBS = 2; // одновременно на арене (вне босса)

interface Pickup {
  x: number;
  y: number;
  weapon: WeaponItemDef;
  tier: number;
  gfx: Phaser.GameObjects.Container;
}

interface Telegraph {
  x: number;
  y: number;
  radius: number;
  born: number;
  duration: number;
  dmg: number;
  element: Element;
  gfx: Phaser.GameObjects.Arc;
  resolved: boolean;
}

export class WorldScene extends Phaser.Scene {
  private run!: Run;
  private player!: Player;
  private enemies: Enemy[] = [];
  private pProj: Projectile[] = [];
  private eProj: Projectile[] = [];
  private boss: Boss | null = null;
  private bossObj: Boss | null = null;
  private telegraphs: Telegraph[] = [];

  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private pProjGroup!: Phaser.Physics.Arcade.Group;
  private eProjGroup!: Phaser.Physics.Arcade.Group;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private energy = ENERGY_MAX;
  private ultCharge = 0;
  private skillCd = 0;
  private spawnTimer = 0;
  private touchCd = new Map<Enemy, number>();
  private bossTouchCd = 0;
  private center = new Phaser.Math.Vector2(GAMEPLAY.worldRadius, GAMEPLAY.worldRadius);
  private inHubGrace = 0;
  private banner = '';
  private bannerT = 0;
  private activeBossRing = 0; // кольцо активного босса (0 = нет)
  private pickups: Pickup[] = [];
  private lastRing = 0;
  private bossColliders: Phaser.Physics.Arcade.Collider[] = [];
  private groundTex!: Phaser.GameObjects.TileSprite;
  private meleeFx!: Phaser.GameObjects.Graphics;
  private fxPool: Phaser.GameObjects.Arc[] = [];
  private fxIdx = 0;
  private curBiome = -1;
  private dmgPool: Phaser.GameObjects.Text[] = [];
  private dmgIdx = 0;
  private lastDmgAt = 0;
  private regenFlask = { pct: 0, remaining: 0, ratePerSec: 0 };
  private lastTime = 0;

  constructor() {
    super('World');
  }

  create(): void {
    this.run = getCurrentRun();
    this.enemies = [];
    this.pProj = [];
    this.eProj = [];
    this.boss = null;
    this.telegraphs = [];
    this.activeBossRing = 0;
    this.pickups = [];
    this.lastRing = 0;
    this.energy = ENERGY_MAX;

    this.drawGround();
    // текстура земли биома (тайл, скроллится с камерой; меняется при смене кольца)
    this.curBiome = -1;
    this.groundTex = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'biome0')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(-8)
      .setAlpha(0.5);

    // переиспользуемый визуал взмаха + пул вспышек (без аллокаций на каждый удар)
    this.meleeFx = this.add.graphics().setDepth(9);
    this.fxPool = [];
    this.fxIdx = 0;

    this.enemyGroup = this.physics.add.group();
    this.pProjGroup = this.physics.add.group();
    this.eProjGroup = this.physics.add.group();

    // Игрок стартует у внутреннего края кольца.
    const start = new Phaser.Math.Vector2(this.center.x, this.center.y - GAMEPLAY.hubRadius - 40);
    this.player = new Player(this, start.x, start.y, this.run);
    this.player.setDepth(10);
    this.physics.world.setBounds(0, 0, GAMEPLAY.worldRadius * 2, GAMEPLAY.worldRadius * 2);
    this.player.setCollideWorldBounds(true);

    this.cameras.main.setBounds(0, 0, GAMEPLAY.worldRadius * 2, GAMEPLAY.worldRadius * 2);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor(0x120c14);
    this.cameras.main.setZoom(1.55); // меньше FOV — ближе к персонажу

    this.setupInput();
    this.setupOverlaps();

    this.scene.launch('UI');

    this.flashBanner(
      `${CLASS_STATS[this.run.loadout.classId].name} · ${this.run.loadout.weapon.name}. К краю — там босс!`,
      3500,
    );
  }

  // Кольцо по расстоянию до центра (0 = хаб, 1..5).
  private ringOf(dist: number): number {
    if (dist < GAMEPLAY.hubRadius) return 0;
    for (let i = 1; i <= RING_COUNT; i++) if (dist <= ringOuterRadius(i)) return i;
    return RING_COUNT;
  }

  // ---------- Мир ----------
  private drawGround(): void {
    const g = this.add.graphics().setDepth(-10);
    const cx = this.center.x;
    const cy = this.center.y;
    // от внешнего кольца к внутреннему (внутренние перекрывают)
    for (let i = RING_COUNT; i >= 1; i--) {
      g.fillStyle(BIOME_GROUND[i], 1).fillCircle(cx, cy, ringOuterRadius(i));
    }
    // хаб (безопасная зона)
    g.fillStyle(BIOME_GROUND[0], 1).fillCircle(cx, cy, GAMEPLAY.hubRadius);
    g.lineStyle(4, 0x3a5f8a, 0.85).strokeCircle(cx, cy, GAMEPLAY.hubRadius);
    // границы колец
    for (let i = 1; i <= RING_COUNT; i++) {
      g.lineStyle(2, 0x000000, 0.35).strokeCircle(cx, cy, ringOuterRadius(i));
    }
    this.add
      .text(cx, cy, 'ХАБ\n(безопасно)', {
        fontFamily: 'system-ui',
        fontSize: '18px',
        color: '#8fb0e0',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(-9);
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,SPACE,J,K,E,TAB,H,ONE,TWO,THREE,FOUR') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    kb.on('keydown-SPACE', () => this.player.tryDash());
    kb.on('keydown-J', () => this.castSkill());
    kb.on('keydown-K', () => this.castUlt());
    kb.on('keydown-E', () => this.tryEnterHub());
    kb.on('keydown-H', () => this.useHeal());
    kb.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.openMenu();
    });
    kb.on('keydown-ONE', () => (this.run.selectedHeal = 'small_potion'));
    kb.on('keydown-TWO', () => (this.run.selectedHeal = 'big_potion'));
    kb.on('keydown-THREE', () => (this.run.selectedHeal = 'regen_flask'));
    kb.on('keydown-FOUR', () => (this.run.selectedHeal = 'elixir'));
  }

  private setupOverlaps(): void {
    this.physics.add.overlap(this.pProjGroup, this.enemyGroup, (proj, enemy) => {
      this.onPlayerProjHitEnemy(proj as Projectile, enemy as Enemy);
    });
    this.physics.add.overlap(this.eProjGroup, this.player, (_pl, proj) => {
      this.onEnemyProjHitPlayer(proj as Projectile);
    });
    this.physics.add.overlap(this.player, this.enemyGroup, (_pl, enemy) => {
      this.onPlayerTouchEnemy(enemy as Enemy);
    });
  }

  // ---------- Цикл ----------
  update(time: number, delta: number): void {
    const dtMs = delta;
    const dt = delta / 1000;
    this.lastTime = time;
    this.run.addPlaytime(dtMs);

    this.handleMovement(dtMs);
    this.handleTouchActions();
    this.player.tick(dtMs);

    // текстура земли скроллится с камерой
    const cam = this.cameras.main;
    this.groundTex.setTilePosition(cam.scrollX, cam.scrollY);
    // затухание визуала взмаха
    if (this.meleeFx.alpha > 0) this.meleeFx.setAlpha(Math.max(0, this.meleeFx.alpha - dt * 6));

    // энергия/реген/скиллы
    this.energy = Math.min(ENERGY_MAX, this.energy + ENERGY_REGEN * dt);
    if (this.skillCd > 0) this.skillCd -= dtMs;
    this.regenPlayer(dt);
    this.autoAttack(time);

    // враги
    const ctx = this.enemyContext();
    for (const e of this.enemies) {
      if (!e.active) continue;
      // отсев далёких мобов (кроме боссов) — держим стаю в радиусе вокруг игрока
      if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) > CULL_RANGE) {
        this.despawnEnemy(e);
        continue;
      }
      e.update(dt, ctx);
      if (e.isDead) this.killEnemy(e);
    }

    // босс
    if (this.boss && this.boss.active) {
      this.boss.update(dtMs, this.bossContext());
      if (this.boss.isDead) {
        this.onBossDead();
      } else if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y) > 1000) {
        // ушёл далеко от босса — босс исчезает (не убит), появится снова при возвращении
        this.removeBoss();
      }
    }

    this.updateTelegraphs(time);
    this.updateProjectilesCleanup();
    this.updatePickups();

    // спавн мобов + появление босса
    this.spawnLogic(dt);

    // смерть игрока
    if (this.run.currentHP <= 0) this.onPlayerDead();

    // таймеры контактов
    for (const [e, t] of this.touchCd) {
      const nt = t - dtMs;
      if (nt <= 0) this.touchCd.delete(e);
      else this.touchCd.set(e, nt);
    }
    if (this.bossTouchCd > 0) this.bossTouchCd -= dtMs;

    // баннер
    if (this.bannerT > 0) this.bannerT -= dtMs;

    this.pushHud();
  }

  private handleMovement(dtMs: number): void {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.keys.W.isDown) dir.y -= 1;
    if (this.keys.S.isDown) dir.y += 1;
    if (this.keys.A.isDown) dir.x -= 1;
    if (this.keys.D.isDown) dir.x += 1;
    // сенсорный стик
    if (touch.moving) {
      dir.x += touch.moveX;
      dir.y += touch.moveY;
    }
    // прицел по умолчанию — к указателю (десктоп); авто-прицел по врагу — в autoAttack
    if (!touch.enabled) {
      const ptr = this.input.activePointer;
      const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const aim = new Phaser.Math.Vector2(world.x - this.player.x, world.y - this.player.y);
      if (aim.lengthSq() > 4) this.player.facing.copy(aim.normalize());
    } else if (dir.lengthSq() > 0) {
      this.player.facing.copy(dir.clone().normalize());
    }
    this.player.handleMovement(dir, dtMs);

    // grace-таймер выхода из хаба
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.center.x, this.center.y);
    if (d < GAMEPLAY.hubRadius) this.inHubGrace = 400;
    else if (this.inHubGrace > 0) this.inHubGrace -= dtMs;
  }

  private handleTouchActions(): void {
    if (consumeTouch('dash')) this.player.tryDash();
    if (consumeTouch('skill')) this.castSkill();
    if (consumeTouch('ult')) this.castUlt();
    if (consumeTouch('heal')) this.useHeal();
    if (consumeTouch('hub')) this.tryEnterHub();
    if (consumeTouch('menu')) this.openMenu();
  }

  // Направление на ближайшего врага/босса в радиусе (для авто-прицела).
  private nearestTargetDir(range: number): Phaser.Math.Vector2 | null {
    let best: { x: number; y: number } | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = { x: e.x, y: e.y };
      }
    }
    if (this.boss && this.boss.active) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (d < bestD) {
        bestD = d;
        best = { x: this.boss.x, y: this.boss.y };
      }
    }
    if (!best) return null;
    return new Phaser.Math.Vector2(best.x - this.player.x, best.y - this.player.y).normalize();
  }

  private regenPlayer(dt: number): void {
    const s = this.run.stats();
    if (this.run.currentHP > 0 && this.run.currentHP < s.maxHP) {
      this.run.currentHP = Math.min(s.maxHP, this.run.currentHP + s.regen * dt);
    }
    if (this.regenFlask.remaining > 0) {
      this.regenFlask.remaining -= dt;
      this.run.currentHP = Math.min(s.maxHP, this.run.currentHP + this.regenFlask.ratePerSec * dt);
    }
  }

  // ---------- Атаки ----------
  private autoAttack(time: number): void {
    if (this.player.attackCd > 0) return;
    if (this.inHub()) return;
    const s = this.run.stats();
    const arch = WEAPON_ARCHETYPES[this.run.loadout.weapon.archetype];
    const period = 1000 / (arch.atkSpeedMult && s.atkSpeedMult ? s.atkSpeedMult : 1);
    this.player.attackCd = Math.max(120, period);

    // авто-прицел по ближайшему врагу (обязателен для тача, удобен и на десктопе)
    const aim = this.nearestTargetDir(arch.ranged ? arch.range : arch.range + 40);
    if (aim) this.player.facing.copy(aim);
    else if (touch.enabled) return; // на тач-устройстве без цели не тратим атаку

    if (arch.ranged) {
      this.rangedAttack();
    } else {
      this.meleeAttack();
    }
    void time;
  }

  private baseHitInput(coef: number): HitInput {
    const s = this.run.stats();
    let pct = s.pctBonuses;
    const weaponEl = this.run.loadout.weapon.element;
    const infusion = this.run.loadout.element;
    const elemental = weaponEl !== 'none' || infusion !== 'none';
    if (elemental) pct += s.elemDmgPct;
    if (coef > 1) pct += s.skillDmgPct;
    return {
      av: s.av,
      classDmgMult: s.classDmgMult,
      classPowerMult: s.classPowerMult * s.evolutionMult,
      pctBonuses: pct,
      coef,
      critChance: s.critChance,
      critMult: 1.5 + s.critDmg,
      weaponElement: weaponEl,
      infusion,
      armorPen: s.armorPen,
    };
  }

  private meleeAttack(): void {
    const arch = WEAPON_ARCHETYPES[this.run.loadout.weapon.archetype];
    const range = arch.range;
    const facing = this.player.facing.clone();
    const angle = facing.angle();
    const arc =
      arch.pattern === 'melee_thrust' ? 0.4 : arch.pattern === 'melee_wide' ? 2.0 : arch.pattern === 'melee_flurry' ? 1.5 : 1.2;
    const hits = arch.pattern === 'melee_flurry' ? 2 : 1; // серия ударов

    // визуал дуги — в переиспользуемый Graphics (без аллокаций)
    const g = this.meleeFx;
    g.clear();
    g.fillStyle(0xffffff, 0.9);
    g.slice(this.player.x, this.player.y, range, angle - arc / 2, angle + arc / 2, false);
    g.fillPath();
    g.setAlpha(0.28);

    const input = this.baseHitInput(1.0);
    let hitAny = false;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d > range + e.displayWidth / 2) continue;
      const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > arc / 2) continue;
      for (let h = 0; h < hits; h++) this.dealToEnemy(e, input);
      hitAny = true;
    }
    if (this.boss && this.boss.active) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (d <= range + this.boss.displayWidth / 2 && Math.abs(Phaser.Math.Angle.Wrap(a - angle)) <= arc / 2) {
        for (let h = 0; h < hits; h++) this.dealToBoss(input);
        hitAny = true;
      }
    }
    void hitAny;
  }

  private rangedAttack(): void {
    const arch = WEAPON_ARCHETYPES[this.run.loadout.weapon.archetype];
    const cost = arch.pattern === 'boomerang' ? ENERGY_COST.thrown : arch.id === 'bow' ? ENERGY_COST.bowShot : ENERGY_COST.cast;
    if (this.energy < cost) return;
    this.energy -= cost;
    const input = this.baseHitInput(1.0);
    const el = this.run.loadout.weapon.element !== 'none' ? this.run.loadout.weapon.element : this.run.loadout.element;
    const facing = this.player.facing.clone().normalize();

    const affix = this.run.loadout.weapon.affixText;
    // веер: у веерных аффиксов 3, иначе 1
    const fanCount = /веер|рой|наводится|отскок|рикошет/.test(affix) ? 3 : 1;
    // пробитие: лук/копьё-снаряд/пробивающие аффиксы бьют насквозь
    const pierce = arch.id === 'bow' ? 2 : /пробива|пронза|игнор брони/.test(affix) ? 4 : 1;
    // размер снаряда крупнее у посоха/маул-магии
    const projR = arch.id === 'staff' ? 15 : arch.id === 'bow' ? 10 : 12;
    const speedMul = arch.id === 'bow' ? 1.25 : 1;
    for (let i = 0; i < fanCount; i++) {
      const spread = (i - (fanCount - 1) / 2) * 0.2;
      const dir = facing.clone().rotate(spread);
      this.firePlayerProjectile(dir, input, el, arch.pattern === 'boomerang', pierce, projR, speedMul);
    }
  }

  private firePlayerProjectile(
    dir: Phaser.Math.Vector2,
    input: HitInput,
    el: Element,
    boomerang: boolean,
    pierce: number,
    radius: number,
    speedMul: number,
  ): void {
    const proj = this.getProjectile(this.pProj, this.pProjGroup);
    const speed = GAMEPLAY.projectileSpeed * speedMul;
    const payload = {
      owner: 'player' as const,
      raw: 0,
      element: el,
      isTrue: el === 'void',
      crit: false,
      pierce,
      boomerang,
      returnTo: boomerang ? () => new Phaser.Math.Vector2(this.player.x, this.player.y) : undefined,
    };
    (proj as Projectile & { hitInput?: HitInput }).hitInput = input;
    proj.fire(this.player.x, this.player.y, dir.x * speed, dir.y * speed, payload, radius);
  }

  private castSkill(): void {
    if (this.skillCd > 0 || this.inHub()) return;
    const s = this.run.stats();
    const coef = CLASS_STATS[this.run.loadout.classId].skillCoef;
    this.skillCd = 5000 * (1 - s.cdrPct);
    const input = this.baseHitInput(coef);
    const radius = 240;
    this.aoeBurst(this.player.x, this.player.y, radius, input, this.skillElement(), 0x88bbff);
    this.flashBanner(CLASS_STATS[this.run.loadout.classId].name + ': ' + (this.run.loadout.abilitySkill), 900);
  }

  private castUlt(): void {
    if (this.ultCharge < ULT_CHARGE_FULL || this.inHub()) return;
    this.ultCharge = 0;
    const coef = CLASS_STATS[this.run.loadout.classId].ultCoef;
    const input = this.baseHitInput(coef);
    // очистка экрана — большой AoE вокруг игрока
    this.aoeBurst(this.player.x, this.player.y, 500, input, this.skillElement(), 0xffaa33);
    this.cameras.main.shake(220, 0.01);
    this.flashBanner('УЛЬТА!', 1200);
  }

  private skillElement(): Element {
    const w = this.run.loadout.weapon.element;
    return w !== 'none' ? w : this.run.loadout.element;
  }

  private aoeBurst(x: number, y: number, radius: number, input: HitInput, el: Element, color: number): void {
    this.fxCircle(x, y, radius, color, 0.35);
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) this.dealToEnemy(e, input, el);
    }
    if (this.boss && this.boss.active && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) <= radius) {
      this.dealToBoss(input, el);
    }
  }

  // ---------- Нанесение урона ----------
  private dealToEnemy(e: Enemy, input: HitInput, forceElement?: Element): void {
    const res = fullHit(input, { armor: e.armor, res: e.res }, () => Math.random());
    const vuln = vulnMult(e.status);
    let dealt = res.dealt * vuln;
    e.applyDamage(dealt);
    this.addUltCharge(dealt);
    this.lifesteal(dealt);
    this.spawnDamageNumber(e.x, e.y, dealt, res.crit, res.element);

    // статус/реакция
    const el = forceElement ?? res.element;
    if (el !== 'none') {
      const reaction = applyElement(e.status, el, input.av, {
        doubleReaction: this.run.loadout.relic?.flag === 'double_reaction',
      });
      if (reaction) this.resolveReaction(e.x, e.y, reaction.kind, reaction.mult, reaction.radius, dealt, input, el);
    }
    if (e.isDead) this.killEnemy(e);
  }

  private dealToBoss(input: HitInput, forceElement?: Element): void {
    if (!this.boss) return;
    const res = fullHit(input, { armor: this.boss.armor, res: this.boss.res }, () => Math.random());
    const s = this.run.stats();
    let dealt = res.dealt * (1 + (s.mods.bossDmgPct ?? 0)) * vulnMult(this.boss.status);
    this.boss.applyDamage(dealt);
    this.addUltCharge(dealt);
    this.lifesteal(dealt);
    this.spawnDamageNumber(this.boss.x, this.boss.y, dealt, res.crit, res.element);
    const el = forceElement ?? res.element;
    if (el !== 'none') {
      const reaction = applyElement(this.boss.status, el, input.av, {
        doubleReaction: this.run.loadout.relic?.flag === 'double_reaction',
      });
      if (reaction) {
        this.resolveReaction(this.boss.x, this.boss.y, reaction.kind, reaction.mult, reaction.radius, dealt, input, el, true);
      }
    }
  }

  private resolveReaction(
    x: number,
    y: number,
    kind: keyof typeof REACTIONS,
    mult: number,
    radius: number,
    triggerDmg: number,
    input: HitInput,
    el: Element,
    fromBoss = false,
  ): void {
    const def = REACTIONS[kind];
    const burst = triggerDmg * mult;
    // визуал
    const color = ELEMENT_COLORS[el] ?? 0xffffff;
    this.fxCircle(x, y, Math.max(26, radius), color, 0.45);
    this.spawnDamageNumber(x, y - 14, burst, true, el, def.name);

    if (radius > 0) {
      for (const e of this.enemies) {
        if (!e.active) continue;
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) {
          e.applyDamage(burst * 0.6);
          if (def.stun) e.status.stunT = Math.max(e.status.stunT, def.stun);
          if (e.isDead) this.killEnemy(e);
        }
      }
      if (!fromBoss && this.boss && this.boss.active && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) <= radius) {
        this.boss.applyDamage(burst * 0.6);
      }
    } else {
      // одноцелевые реакции — доп. урон уже в burst, применяем к ближайшему/цели
      if (!fromBoss) {
        const target = this.enemies.find((e) => e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) < 20);
        target?.applyDamage(burst * 0.4);
      } else this.boss?.applyDamage(burst * 0.4);
    }
    void input;
  }

  private lifesteal(dmg: number): void {
    const s = this.run.stats();
    if (s.lifesteal > 0) {
      this.run.currentHP = Math.min(s.maxHP, this.run.currentHP + dmg * s.lifesteal);
    }
  }

  private addUltCharge(dmg: number): void {
    this.ultCharge = Math.min(ULT_CHARGE_FULL, this.ultCharge + dmg * ULT_CHARGE_PER_DMG);
  }

  // ---------- Столкновения ----------
  private onPlayerProjHitEnemy(proj: Projectile, enemy: Enemy): void {
    if (!proj.active || !enemy.active || !proj.payload || proj.payload.owner !== 'player') return;
    if (proj.hitSet.has(enemy as unknown as number)) return;
    const input = (proj as Projectile & { hitInput?: HitInput }).hitInput;
    if (input) this.dealToEnemy(enemy, input);
    proj.hitSet.add(enemy as unknown as number);
    proj.payload.pierce -= 1;
    if (proj.payload.pierce <= 0 && !proj.payload.boomerang) proj.kill();
  }

  private onEnemyProjHitPlayer(proj: Projectile): void {
    if (!proj.active || !proj.payload || proj.payload.owner !== 'enemy') return;
    this.hitPlayer(proj.payload.raw, proj.payload.element);
    proj.kill();
  }

  private onPlayerTouchEnemy(enemy: Enemy): void {
    if (!enemy.active) return;
    if (this.touchCd.has(enemy)) return;
    this.touchCd.set(enemy, 700);
    this.hitPlayer(enemy.dmg, enemy.def.element);
  }

  private hitPlayer(amount: number, _el: Element): void {
    if (this.inHub()) return; // хаб — безопасная зона: урона нет
    const dealt = this.player.takeDamage(amount, Math.random());
    if (dealt > 0) {
      this.cameras.main.shake(90, 0.006);
      this.spawnDamageNumber(this.player.x, this.player.y - 18, dealt, false, 'none');
    }
  }

  // ---------- Спавн ----------
  private spawnLogic(dt: number): void {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.center.x, this.center.y);
    const ring = this.ringOf(dist);

    // смена биома → баннер + текстура земли
    if (ring !== this.lastRing) {
      this.lastRing = ring;
      if (ring >= 1) this.flashBanner(`Кольцо ${ring} · ${BIOME_NAMES[ring]}`, 2500);
    }
    if (ring !== this.curBiome) {
      this.curBiome = ring;
      this.groundTex.setTexture('biome' + ring);
    }

    // мобы спавнятся редко и по 1 (макс MAX_MOBS одновременно); во время босса — не спавнятся
    this.spawnTimer -= dt;
    const activeMobs = this.enemies.filter((e) => e.active).length;
    if (ring >= 1 && !this.boss && this.spawnTimer <= 0 && activeMobs < MAX_MOBS) {
      this.spawnTimer = Phaser.Math.FloatBetween(2.4, 4.0);
      this.spawnWave(ring, 1);
    }

    // босс текущего кольца (если ещё не убит и не активен)
    if (ring >= 1 && !this.boss) {
      const def = BOSSES_BY_RING[ring];
      if (def && !this.run.bossesKilled.includes(def.id)) {
        const innerR = ringOuterRadius(ring - 1);
        const trigger = innerR + (ringOuterRadius(ring) - innerR) * 0.55;
        if (dist > trigger) this.spawnBoss(ring);
      }
    }
  }

  private spawnWave(ring: number, count = 1): void {
    const pool = MOBS_BY_RING[ring] ?? MOBS_BY_RING[1];
    for (let i = 0; i < count; i++) {
      const def = Phaser.Utils.Array.GetRandom(pool);
      const pos = this.randomSpawnPos();
      if (!pos) continue;
      this.spawnEnemy(def, pos.x, pos.y, ring, Math.random() < 0.18);
    }
  }

  private randomSpawnPos(): Phaser.Math.Vector2 | null {
    for (let tries = 0; tries < 8; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(340, 520);
      const x = this.player.x + Math.cos(ang) * dist;
      const y = this.player.y + Math.sin(ang) * dist;
      const dc = Phaser.Math.Distance.Between(x, y, this.center.x, this.center.y);
      if (dc > GAMEPLAY.hubRadius + 40 && dc < GAMEPLAY.worldRadius - 40) {
        return new Phaser.Math.Vector2(x, y);
      }
    }
    return null;
  }

  private spawnEnemy(def: MobDef, x: number, y: number, ring: number, elite = false): Enemy {
    const e = this.getEnemy();
    const base = RING_STATS[ring] ?? RING_STATS[1];
    const mobLevel = Phaser.Math.Clamp(this.run.levelState.level, base.minLevel, base.minLevel + 19);
    const scale = ringLevelScale(ring, mobLevel);
    const eliteMul = elite ? { hp: 3, dmg: 1.5, loot: 3 } : { hp: 1, dmg: 1, loot: 1 };
    e.spawn(
      def,
      x,
      y,
      {
        hp: base.hp * def.hpMult * scale * eliteMul.hp * MOB_HP_MUL,
        dmg: base.dmg * def.dmgMult * scale * eliteMul.dmg * MOB_DMG_MUL,
        armor: base.armor,
        xp: base.xp * eliteMul.loot * MOB_LOOT_MUL,
        gold: base.gold * eliteMul.loot * MOB_LOOT_MUL,
      },
      elite,
    );
    e.setDepth(6);
    this.enemyGroup.add(e);
    return e;
  }

  private spawnBoss(ring: number): void {
    const def = BOSSES_BY_RING[ring];
    this.activeBossRing = ring;
    const ang = Phaser.Math.Angle.Between(this.center.x, this.center.y, this.player.x, this.player.y);
    const pd = Phaser.Math.Distance.Between(this.center.x, this.center.y, this.player.x, this.player.y);
    // босс появляется чуть впереди игрока (радиально), но не дальше внешнего края кольца
    const r = Math.min(ringOuterRadius(ring) - 120, pd + 620);
    const bx = this.center.x + Math.cos(ang) * r;
    const by = this.center.y + Math.sin(ang) * r;
    // переиспользуем один инстанс босса (иначе утечка при уходе/возврате к боссу)
    if (!this.bossObj) this.bossObj = new Boss(this);
    this.boss = this.bossObj;
    const base = RING_STATS[ring];
    this.boss.spawn(def, bx, by, {
      hp: base.hp * def.hpMult,
      dmg: base.dmg * def.dmgMult,
      armor: base.armor * 1.5,
    });
    this.boss.setDepth(7);
    const c1 = this.physics.add.overlap(this.pProjGroup, this.boss, (proj) => {
      const p = proj as Projectile;
      if (!p.active || !p.payload || p.payload.owner !== 'player') return;
      const input = (p as Projectile & { hitInput?: HitInput }).hitInput;
      if (input) this.dealToBoss(input);
      p.payload.pierce -= 1;
      if (p.payload.pierce <= 0 && !p.payload.boomerang) p.kill();
    });
    const c2 = this.physics.add.overlap(this.player, this.boss, () => {
      if (this.bossTouchCd > 0) return;
      this.bossTouchCd = 800;
      this.hitPlayer(this.boss!.dmg, this.boss!.def.element);
    });
    this.bossColliders.push(c1, c2);
    this.flashBanner(`⚠ ${def.final ? 'ФИНАЛ' : 'БОСС'}: ${def.name}`, 3200);
  }

  // Снять босса со сцены и почистить его коллайдеры (без наград).
  private removeBoss(): void {
    if (this.boss) this.boss.kill();
    this.boss = null;
    this.activeBossRing = 0;
    this.bossColliders.forEach((c) => c.destroy());
    this.bossColliders = [];
  }

  // ---------- Смерть врагов/босса ----------
  private killEnemy(e: Enemy): void {
    if (!e.active) return;
    const gained = this.run.gainXP(e.xp);
    grantKillReward(this.run.wallet, e.gold, this.run.stats().goldPct, () => Math.random());
    this.run.wallet.shards += Math.random() < 0.35 ? 1 : 0;
    this.ultCharge = Math.min(ULT_CHARGE_FULL, this.ultCharge + ULT_CHARGE_PER_KILL);
    if (this.run.loadout.relic?.flag === 'kill_heal') {
      this.run.currentHP = Math.min(this.run.stats().maxHP, this.run.currentHP + this.run.stats().maxHP * 0.03);
    }
    if (gained > 0) this.onLevelUp(gained);
    this.spawnPickupFx(e.x, e.y, 0xf0c040);
    this.enemyGroup.remove(e);
    this.touchCd.delete(e);
    e.kill();
  }

  // Убрать моба без награды (отсев по дальности).
  private despawnEnemy(e: Enemy): void {
    if (!e.active) return;
    this.enemyGroup.remove(e);
    this.touchCd.delete(e);
    e.kill();
  }

  private onBossDead(): void {
    if (!this.boss) return;
    const def: BossDef = this.boss.def;
    const ring = def.ring;
    const bx = this.boss.x;
    const by = this.boss.y;
    this.run.gainXP(RING_STATS[ring].xp * 80);
    this.run.wallet.gold += 200 * ring;
    this.run.wallet.bossCores += 1;
    if (def.reward.evolutionStage > 0) this.run.evolve(def.reward.evolutionStage);
    if (!this.run.bossesKilled.includes(def.id)) this.run.bossesKilled.push(def.id);
    this.player.refreshFromStats();
    this.run.currentHP = this.run.stats().maxHP;
    this.boss.kill();
    this.boss = null;
    this.activeBossRing = 0;
    this.bossColliders.forEach((c) => c.destroy());
    this.bossColliders = [];
    this.spawnPickupFx(bx, by, 0xffaa33);
    this.cameras.main.shake(300, 0.012);

    // дроп оружия на землю
    this.dropBossWeapon(ring, bx, by);
    this.run.persist();

    if (def.final) {
      this.flashBanner('🏆 ПОЖИРАТЕЛЬ МИРОВ ПОВЕРЖЕН — ПОБЕДА!', 3500);
      this.time.delayedCall(3200, () => this.finishVictory());
      return;
    }
    const evoMsg =
      def.reward.evolutionStage > 0
        ? ` Эволюция класса ${['I', 'II', 'III'][def.reward.evolutionStage - 1]}!`
        : ' Легендарный дроп!';
    this.flashBanner(`${def.name} повержен!${evoMsg} Дальше — Кольцо ${Math.min(RING_COUNT, ring + 1)}`, 3500);
  }

  // Оружие с босса падает на землю; редкость растёт с кольцом.
  private dropBossWeapon(ring: number, x: number, y: number): void {
    const rarities: Rarity[] = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const rarity = rarities[Math.min(4, ring - 1)];
    const pool = WEAPON_ITEMS.filter((w) => w.rarity === rarity);
    const weapon = Phaser.Utils.Array.GetRandom(pool.length ? pool : WEAPON_ITEMS);
    const color = ELEMENT_COLORS[weapon.element] ?? 0xf0c040;
    const ring2 = this.add.circle(0, 0, 15, color, 0.85).setStrokeStyle(3, 0xffffff, 0.9);
    const icon = this.add.text(0, 0, '⚔', { fontFamily: 'system-ui', fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    const c = this.add.container(x, y, [ring2, icon]).setDepth(9);
    this.tweens.add({ targets: c, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.pickups.push({ x, y, weapon, tier: ring, gfx: c });
  }

  private updatePickups(): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y) < 40) {
        this.collectWeapon(p);
        p.gfx.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  private collectWeapon(p: Pickup): void {
    const newAV = weaponAV(p.weapon, p.tier, 0, 1);
    const curAV = weaponAV(this.run.build.weapon, this.run.build.weaponTier, this.run.build.weaponEnchant, 1);
    if (newAV > curAV) {
      this.run.build.weapon = p.weapon;
      this.run.build.weaponTier = p.tier;
      this.run.build.weaponEnchant = 0;
      this.player.refreshFromStats();
      this.flashBanner(`Новое оружие: ${p.weapon.name} (AV ${Math.round(newAV)})`, 2500);
    } else {
      const gold = Math.round(newAV * 3);
      this.run.wallet.gold += gold;
      this.flashBanner(`Продано: ${p.weapon.name} (+${gold}⦿)`, 2000);
    }
    this.spawnPickupFx(p.x, p.y, 0xf0c040);
  }

  private onLevelUp(levels: number): void {
    this.player.refreshFromStats();
    this.run.currentHP = this.run.stats().maxHP; // хил на левелапе
    this.flashBanner(`Уровень ${this.run.levelState.level}! +${levels} очк. талантов/навыков (Tab)`, 1800);
  }

  // ---------- Телеграфы босса ----------
  private updateTelegraphs(time: number): void {
    for (const t of this.telegraphs) {
      if (t.resolved) continue;
      const age = time - t.born;
      const p = Phaser.Math.Clamp(age / t.duration, 0, 1);
      t.gfx.setScale(0.2 + 0.8 * p);
      t.gfx.setFillStyle(COLORS.telegraph, 0.15 + 0.35 * p);
      if (age >= t.duration) {
        t.resolved = true;
        // урон если игрок в зоне
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) <= t.radius) {
          this.hitPlayer(t.dmg, t.element);
        }
        this.fxCircle(t.x, t.y, t.radius, COLORS.telegraph, 0.5);
        t.gfx.destroy();
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => !t.resolved);
  }

  private updateProjectilesCleanup(): void {
    for (const p of [...this.pProj, ...this.eProj]) {
      if (!p.active) continue;
      p.tick(this.lastTime);
      if (!p.active) continue;
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.center.x, this.center.y);
      if (d > GAMEPLAY.worldRadius) p.kill();
    }
  }

  // ---------- Контексты ИИ ----------
  private enemyContext(): EnemyContext {
    return {
      playerPos: () => new Phaser.Math.Vector2(this.player.x, this.player.y),
      shoot: (x, y, tx, ty, dmg, element) => this.fireEnemyProjectile(x, y, tx, ty, dmg, element),
      playerTargetable: () => !this.inHub() && this.run.currentHP > 0,
    };
  }

  private bossContext(): BossContext {
    return {
      playerPos: () => new Phaser.Math.Vector2(this.player.x, this.player.y),
      telegraphCircle: (x, y, radius, delay, _onHit) => this.addTelegraph(x, y, radius, delay, this.boss!.dmg),
      shootFan: (x, y, tx, ty, count, dmg, element) => this.enemyFan(x, y, tx, ty, count, dmg, element),
      summonAdds: (x, y, count) => this.summonAdds(x, y, count),
      onPhaseChange: () => this.flashBanner('Древо-Страж: ФАЗА 2 — корни по арене!', 2500),
    };
  }

  private addTelegraph(x: number, y: number, radius: number, duration: number, dmg: number): void {
    const gfx = this.add.circle(x, y, radius, COLORS.telegraph, 0.15).setDepth(4);
    this.telegraphs.push({ x, y, radius, born: this.lastTime, duration, dmg, element: 'poison', gfx, resolved: false });
  }

  private enemyFan(x: number, y: number, tx: number, ty: number, count: number, dmg: number, element: Element): void {
    const base = Phaser.Math.Angle.Between(x, y, tx, ty);
    const spread = 0.9;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1));
      this.spawnEnemyProjectileDir(x, y, Math.cos(a), Math.sin(a), dmg, element);
    }
  }

  private summonAdds(x: number, y: number, count: number): void {
    const ring = this.activeBossRing || 1;
    const pool = MOBS_BY_RING[ring] ?? MOBS_BY_RING[1];
    const def = pool.find((m) => m.ai === 'chaser' || m.ai === 'charger') ?? pool[0];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.spawnEnemy(def, x + Math.cos(a) * 60, y + Math.sin(a) * 60, ring);
    }
  }

  private fireEnemyProjectile(x: number, y: number, tx: number, ty: number, dmg: number, element: Element): void {
    const a = Phaser.Math.Angle.Between(x, y, tx, ty);
    this.spawnEnemyProjectileDir(x, y, Math.cos(a), Math.sin(a), dmg, element);
  }

  private spawnEnemyProjectileDir(x: number, y: number, dx: number, dy: number, dmg: number, element: Element): void {
    const proj = this.getProjectile(this.eProj, this.eProjGroup);
    proj.fire(x, y, dx * GAMEPLAY.enemyProjectileSpeed, dy * GAMEPLAY.enemyProjectileSpeed, {
      owner: 'enemy',
      raw: dmg,
      element,
      isTrue: false,
      crit: false,
      pierce: 1,
    }, 6);
  }

  // ---------- Пулы ----------
  private getEnemy(): Enemy {
    let e = this.enemies.find((x) => !x.active);
    if (!e) {
      e = new Enemy(this);
      this.enemies.push(e);
    }
    return e;
  }

  private getProjectile(pool: Projectile[], group: Phaser.Physics.Arcade.Group): Projectile {
    let p = pool.find((x) => !x.active);
    if (!p) {
      p = new Projectile(this);
      pool.push(p);
      group.add(p);
    }
    return p;
  }

  // ---------- Переходы ----------
  private inHub(): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, this.center.x, this.center.y) < GAMEPLAY.hubRadius;
  }

  private tryEnterHub(): void {
    if (!this.inHub()) {
      this.flashBanner('Хаб — в центре карты (синий круг)', 1500);
      return;
    }
    this.run.persist();
    this.scene.stop('UI');
    this.scene.start('Hub', { fromStart: false });
  }

  private openMenu(): void {
    this.scene.pause();
    this.scene.launch('Menu', { from: 'World' });
  }

  private useHeal(): void {
    const kind = this.run.selectedHeal;
    const def = this.run.heals[kind];
    if (def <= 0) return;
    const healed = this.run.useHeal();
    if (healed > 0 || kind === 'regen_flask') {
      if (kind === 'regen_flask') {
        this.regenFlask.remaining = 8;
        this.regenFlask.ratePerSec = (this.run.stats().maxHP * 0.4) / 8;
      }
      this.spawnPickupFx(this.player.x, this.player.y, 0x55dd77);
    }
  }

  private onPlayerDead(): void {
    // Второе дыхание / Перо Феникса
    const hasRevive =
      !this.run.reviveUsed &&
      (this.run.build.allocatedTalents.has('fort5') || this.run.loadout.relic?.flag === 'revive');
    if (hasRevive) {
      this.run.reviveUsed = true;
      const pct = this.run.loadout.relic?.flag === 'revive' ? 0.5 : 0.4;
      this.run.currentHP = this.run.stats().maxHP * pct;
      this.player.iframeT = 1500;
      this.flashBanner('Возрождение!', 1500);
      return;
    }
    this.scene.stop('UI');
    this.finishDeath();
  }

  private finishVictory(): void {
    this.scene.stop('UI');
    this.scene.start('End', { victory: true });
  }

  private finishDeath(): void {
    this.scene.start('End', { victory: false });
  }

  // ---------- HUD/визуал ----------
  private flashBanner(text: string, ms: number): void {
    this.banner = text;
    this.bannerT = ms;
  }

  private spawnDamageNumber(x: number, y: number, dmg: number, crit: boolean, el: Element, label?: string): void {
    const important = crit || !!label;
    // троттлинг обычных чисел (важные — криты/реакции — всегда)
    if (!important && this.lastTime - this.lastDmgAt < 45) return;
    this.lastDmgAt = this.lastTime;

    const color = label ? '#ffdd66' : crit ? '#ffcf3f' : el !== 'none' ? '#' + (ELEMENT_COLORS[el] ?? 0xffffff).toString(16).padStart(6, '0') : '#ffffff';
    const POOL = 28;
    let t = this.dmgPool[this.dmgIdx];
    if (!t) {
      t = this.add.text(0, 0, '', { fontFamily: 'system-ui', fontSize: '13px' }).setDepth(20).setOrigin(0.5);
      this.dmgPool[this.dmgIdx] = t;
    }
    this.dmgIdx = (this.dmgIdx + 1) % POOL;
    this.tweens.killTweensOf(t);
    const px = x + Phaser.Math.Between(-8, 8);
    t.setText(label ? `${label} ${Math.round(dmg)}` : `${Math.round(dmg)}`)
      .setColor(color)
      .setFontSize(important ? 16 : 13)
      .setFontStyle(important ? 'bold' : 'normal')
      .setPosition(px, y - 10)
      .setAlpha(1)
      .setVisible(true);
    this.tweens.add({ targets: t, y: y - 44, alpha: 0, duration: 600, onComplete: () => t.setVisible(false) });
  }

  private spawnPickupFx(x: number, y: number, color: number): void {
    this.fxCircle(x, y, 16, color, 0.9);
  }

  // Пул вспышек (расширяются и гаснут) — без аллокаций на событие.
  private fxCircle(x: number, y: number, r: number, color: number, alpha = 0.4): void {
    const POOL = 24;
    let c = this.fxPool[this.fxIdx];
    if (!c) {
      c = this.add.circle(0, 0, 10, 0xffffff, 1).setDepth(8);
      this.fxPool[this.fxIdx] = c;
    }
    this.fxIdx = (this.fxIdx + 1) % POOL;
    this.tweens.killTweensOf(c);
    c.setPosition(x, y).setFillStyle(color, alpha).setScale((r * 0.25) / 10).setVisible(true);
    this.tweens.add({ targets: c, scale: r / 10, alpha: 0, duration: 240, onComplete: () => c.setVisible(false) });
  }

  private pushHud(): void {
    const s = this.run.stats();
    this.registry.set('hud', {
      hp: Math.max(0, this.run.currentHP),
      maxHp: s.maxHP,
      xp: this.run.levelState.xp,
      xpNext: this.run.levelState.xpNext,
      level: this.run.levelState.level,
      levelCap: this.run.levelCap,
      gold: this.run.wallet.gold,
      energy: this.energy,
      energyMax: ENERGY_MAX,
      ultCharge: this.ultCharge,
      ultFull: ULT_CHARGE_FULL,
      dashCharges: this.player.dashCharges,
      maxDash: this.player.maxDashCharges,
      skillCd: Math.max(0, this.skillCd),
      skillCdMax: 5000 * (1 - s.cdrPct),
      healKind: this.run.selectedHeal,
      healCount: this.run.heals[this.run.selectedHeal],
      talentPoints: this.run.talentPoints,
      skillPoints: this.run.skillPoints,
      bossName: this.boss?.active ? 'Древо-Страж' : '',
      bossHp: this.boss?.active ? this.boss.hp : 0,
      bossMaxHp: this.boss?.active ? this.boss.maxHp : 1,
      banner: this.bannerT > 0 ? this.banner : '',
      inHub: this.inHub(),
      // данные миникарты
      px: this.player.x,
      py: this.player.y,
      hasBoss: !!(this.boss && this.boss.active),
      bossX: this.boss?.active ? this.boss.x : 0,
      bossY: this.boss?.active ? this.boss.y : 0,
      blips: this.enemies.filter((e) => e.active).slice(0, 60).map((e) => ({ x: e.x, y: e.y, elite: e.isElite })),
    });
  }
}
