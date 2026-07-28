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
import { RARITY_NAMES } from '../data/rarity';
import { RARITY_COLORS } from '../data/theme';
import { applyElement, vulnMult } from '../core/statusEngine';
import { grantKillReward } from '../core/economy';
import { REACTIONS, type Element } from '../data/elements';
import { CLASS_STATS, CLASS_ABILITIES, CLASS_ABILITY, type AbilityKind } from '../data/classes';
import { touch, consumeTouch } from '../core/touchInput';
import { RNG, hashSeed } from '../core/rng';
import { ARMOR_SLOTS, ARMOR_SLOT_NAMES, CLASS_SETS } from '../data/armor';
import { nativeWeight, type ArmorPiece } from '../core/stats';
import { RARITY_ORDER } from '../data/rarity';

// Радиус, за которым мобы (не боссы) деспавнятся и переспавниваются ближе к игроку.
const CULL_RANGE = 1500;

// Цвета земли биомов по кольцам (индекс = кольцо, 0 = хаб) — насыщенные, контрастные.
const BIOME_GROUND = [0x2a3a5c, 0x2f7a42, 0x4a6a2e, 0x7a3e20, 0x2f6088, 0x4a2274];
// Сила мобов (спавнятся редко, поэтому крепче) и множители награды.
const MOB_HP_MUL = 5.0; // мобы «жирнее» (спавнятся редко)
const MOB_DMG_MUL = 1.5;
const MOB_LOOT_MUL = 3.5;
const MAX_MOBS = 2; // одновременно на арене (вне босса)
const BOSS_AGGRO_RANGE = 560; // подход к логову → босс агрится и начинается бой

// Декор биомов по кольцам (индекс = кольцо). Разбрасывается чанками вокруг игрока.
const DECO_SETS: Record<number, string[]> = {
  1: ['deco_bush', 'deco_rock', 'prop_tree', 'deco_stump'],
  2: ['deco_deadtree', 'deco_rock', 'deco_bones', 'deco_stump'],
  3: ['deco_rock', 'deco_bones', 'deco_deadtree', 'deco_rock'],
  4: ['deco_crystal', 'deco_column', 'deco_rock', 'deco_column'],
  5: ['deco_crystal', 'deco_bones', 'deco_column', 'deco_crystal'],
};
const DECO_CELL = 620; // размер чанка декора (world px)

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
  // временные турели/миньоны от навыков
  private summons: { x: number; y: number; spr: Phaser.GameObjects.Image; until: number; cd: number; coef: number }[] = [];
  // наземные дропы брони
  private armorDrops: { x: number; y: number; piece: ArmorPiece; gfx: Phaser.GameObjects.Container }[] = [];
  // фиксированные точки боссов (по одной на кольцо), всегда на карте
  private bossAnchors: { ring: number; id: string; x: number; y: number }[] = [];
  // декор биомов (чанки вокруг игрока) + сундуки
  private decoCells = new Map<string, Phaser.GameObjects.Image[]>();
  private chests: { x: number; y: number; gfx: Phaser.GameObjects.Image; opened: boolean; key: string }[] = [];
  private openedChests = new Set<string>();
  private decoTimer = 0;
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
  private slashFx!: Phaser.GameObjects.Image;
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

    this.computeBossAnchors();
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
    // росчерк удара (переиспользуемый спрайт, пивот у игрока)
    this.slashFx = this.add
      .image(0, 0, this.textures.exists('slash') ? 'slash' : 'circle')
      .setDepth(11)
      .setOrigin(0.18, 0.5)
      .setVisible(false);
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
    this.buildHub();
    this.drawBossLairs();
  }

  // Видимые логова боссов на земле (тёмный круг + метка «череп»).
  private drawBossLairs(): void {
    const g = this.add.graphics().setDepth(-7);
    for (const a of this.bossAnchors) {
      if (this.run.bossesKilled.includes(a.id)) continue;
      g.fillStyle(0x1a0e12, 0.55).fillCircle(a.x, a.y, 230);
      g.lineStyle(5, 0xc0402a, 0.7).strokeCircle(a.x, a.y, 230);
      this.add.text(a.x, a.y - 300, '☠ ' + BOSSES_BY_RING[a.ring].name, {
        fontFamily: 'system-ui', fontSize: '26px', color: '#e88060', align: 'center',
      }).setOrigin(0.5).setDepth(-6);
    }
  }

  // Пропы хаба: домики/кузница/лавка/фонтан/портал/статуя/факелы — «безопасный город».
  private buildHub(): void {
    const cx = this.center.x;
    const cy = this.center.y;
    const place = (key: string, dx: number, dy: number, scale = 1.3): void => {
      if (!this.textures.exists(key)) return;
      this.add.image(cx + dx, cy + dy, key).setOrigin(0.5, 0.92).setScale(scale).setDepth(5);
    };
    place('prop_fountain', 0, 30, 1.6);
    place('prop_statue', -150, -70);
    place('prop_house', -300, -130);
    place('prop_house', 270, -150);
    place('prop_house', 70, -290);
    place('prop_forge', -330, 130);
    place('prop_stall', 310, 130);
    place('prop_portal', -70, 320, 1.4);
    place('prop_tree', -390, -30, 1.1);
    place('prop_tree', 390, 30, 1.1);
    place('prop_tree', 150, 250, 1.1);
    place('prop_barrel', -250, 200, 1.0);
    place('prop_barrel', -215, 212, 0.9);
    place('prop_barrel', 250, -60, 0.95);
    // факелы по периметру безопасной зоны
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      place('prop_torch', Math.cos(a) * 470, Math.sin(a) * 470, 1.0);
    }
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
    this.updateArmorPickups();
    this.updateDecorations(dt);
    this.updateChests();
    this.updateSummons(dtMs, time);

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
      this.player.playAttack('ranged');
      this.rangedAttack();
    } else {
      this.player.playAttack('melee');
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

    // слабый конус зоны поражения (подсказка) + яркий росчерк-удар поверх
    const g = this.meleeFx;
    g.clear();
    g.fillStyle(0xffffff, 0.9);
    g.slice(this.player.x, this.player.y, range, angle - arc / 2, angle + arc / 2, false);
    g.fillPath();
    g.setAlpha(0.12);
    // анимация самого удара: серп проносится дугой и гаснет
    const el = this.run.loadout.weapon.element !== 'none' ? this.run.loadout.weapon.element : this.run.loadout.element;
    const color = ELEMENT_COLORS[el] ?? 0xffffff;
    const thrust = arch.pattern === 'melee_thrust';
    const s = this.slashFx;
    this.tweens.killTweensOf(s);
    // масштаб так, чтобы радиус серпа ≈ дальность удара (не «нимб» вокруг)
    const sc = range / 127;
    s.setVisible(true)
      .setPosition(this.player.x, this.player.y)
      .setTint(color)
      .setAlpha(0.95)
      .setScale(sc * 0.9)
      .setRotation(angle - arc * 0.5);
    this.tweens.add({
      targets: s,
      rotation: angle + arc * 0.5,
      alpha: 0,
      scale: thrust ? sc * 0.85 : sc * 1.12,
      duration: thrust ? 120 : 160,
      ease: 'Quad.easeOut',
      onComplete: () => s.setVisible(false),
    });

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
    // форма снаряда по архетипу оружия
    const shape =
      arch.id === 'bow' ? 'proj_arrow' :
      arch.pattern === 'boomerang' || arch.id === 'thrown' ? 'proj_star' :
      arch.id === 'spear' ? 'proj_bolt' : 'proj_orb';
    for (let i = 0; i < fanCount; i++) {
      const spread = (i - (fanCount - 1) / 2) * 0.2;
      const dir = facing.clone().rotate(spread);
      this.firePlayerProjectile(dir, input, el, arch.pattern === 'boomerang', pierce, projR, speedMul, shape);
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
    shape = 'proj_orb',
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
    proj.fire(this.player.x, this.player.y, dir.x * speed, dir.y * speed, payload, radius, shape);
  }

  private castSkill(): void {
    if (this.skillCd > 0 || this.inHub()) return;
    const s = this.run.stats();
    const coef = CLASS_STATS[this.run.loadout.classId].skillCoef;
    this.skillCd = 5000 * (1 - s.cdrPct);
    const kind = CLASS_ABILITY[this.run.loadout.classId]?.skill ?? 'nova';
    this.performAbility(kind, coef, false);
    this.flashBanner(this.run.loadout.abilitySkill, 900);
  }

  private castUlt(): void {
    if (this.ultCharge < ULT_CHARGE_FULL || this.inHub()) return;
    this.ultCharge = 0;
    const coef = CLASS_STATS[this.run.loadout.classId].ultCoef;
    const kind = CLASS_ABILITY[this.run.loadout.classId]?.ult ?? 'nuke';
    this.performAbility(kind, coef, true);
    this.cameras.main.shake(240, 0.011);
    this.flashBanner('★ ' + CLASS_ABILITIES[this.run.loadout.classId].ult, 1300);
  }

  // Диспатч уникального действия навыка/ульты по виду класса.
  private performAbility(kind: AbilityKind, coef: number, ult: boolean): void {
    const input = this.baseHitInput(coef);
    const el = this.skillElement();
    // навык несёт стихию класса/оружия целиком (урон по элементу + реакции)
    input.weaponElement = el;
    const col = ELEMENT_COLORS[el] ?? 0x9fd0ff;
    // классы со стихией красят эффект по своей стихии; без стихии — тематич. цвет
    const fx = (def: number) => (el !== 'none' ? col : def);
    const px = this.player.x, py = this.player.y;
    switch (kind) {
      case 'whirlwind': {
        // вихрь клинков — серия росчерков + мультихит вокруг
        const r = ult ? 340 : 230;
        const hits = ult ? 5 : 3;
        for (let i = 0; i < hits; i++) {
          this.time.delayedCall(i * 85, () => {
            if (!this.player.active) return;
            this.spinSlash(this.player.x, this.player.y, r, col, i);
            this.aoeBurst(this.player.x, this.player.y, r, input, el, fx(0xffd066));
          });
        }
        break;
      }
      case 'nova': {
        const r = ult ? 460 : 290;
        this.novaRing(px, py, r, col);
        this.aoeBurst(px, py, r, input, el, col);
        if (el === 'ice') this.freezeInRadius(px, py, r, ult ? 2200 : 1400);
        break;
      }
      case 'arc': {
        // Рассекающий удар / жатва — фронтальный росчерк-дуга
        const range = ult ? 320 : 240;
        const arc = 1.6;
        const ang = this.player.facing.angle();
        this.player.playAttack('melee');
        const fx = { x: px + Math.cos(ang) * range * 0.4, y: py + Math.sin(ang) * range * 0.4 };
        this.spinSlash(fx.x, fx.y, range, 0xffffff, ang / 1.4);
        this.coneStrike(range, arc, input, el, col);
        break;
      }
      case 'fireball': {
        // летящий шар, взрывается впереди/по цели
        const ang = this.player.facing.angle();
        const t = this.nearestEnemyPos() ?? { x: px + Math.cos(ang) * 320, y: py + Math.sin(ang) * 320 };
        const proj = this.getProjectile(this.pProj, this.pProjGroup);
        (proj as Projectile & { hitInput?: HitInput }).hitInput = input;
        proj.fire(px, py, Math.cos(ang) * 700, Math.sin(ang) * 700, { owner: 'player', raw: 0, element: el, isTrue: false, crit: false, pierce: 1 }, 16, 'proj_orb');
        this.time.delayedCall(200, () => {
          const r = 150;
          this.novaRing(t.x, t.y, r, fx(0xff7030));
          this.aoeBurst(t.x, t.y, r, input, el, fx(0xff7030));
        });
        break;
      }
      case 'zone': {
        // Освящённая земля — лечащая/жгущая зона под игроком
        this.playerCloud(px, py, ult ? 300 : 220, ult ? 6 : 5, input, el === 'none' ? 'radiance' : el);
        this.run.currentHP = Math.min(this.run.stats().maxHP, this.run.currentHP + this.run.stats().maxHP * 0.1);
        break;
      }
      case 'storm': {
        // Гроза — серия ударов молний по врагам вокруг за ~2с
        const strikes = ult ? 10 : 6;
        for (let i = 0; i < strikes; i++) {
          this.time.delayedCall(i * 200, () => {
            const e = this.randomNearbyEnemy(560);
            const tx = e ? e.x : px + (Math.random() - 0.5) * 500;
            const ty = e ? e.y : py + (Math.random() - 0.5) * 500;
            // разряд «с неба» в точку удара
            this.lightningBolt(tx + (Math.random() - 0.5) * 40, ty - 300, tx, ty, fx(0x9fe0ff), 7, 26);
            this.cameras.main.shake(70, 0.003);
            this.novaRing(tx, ty, 110, fx(0x9fe0ff));
            this.aoeBurst(tx, ty, 110, input, el, fx(0x9fe0ff));
          });
        }
        break;
      }
      case 'void': {
        // Разлом Пустоты — притягивает врагов к центру + урон
        const r = ult ? 480 : 340;
        // воронка: закручивающиеся внутрь частицы + тёмное ядро
        const core = this.add.circle(px, py, r * 0.18, 0x10001e, 0.55).setDepth(7).setStrokeStyle(3, 0xb060ff, 0.9);
        this.tweens.add({ targets: core, scale: 0.2, alpha: 0, angle: 220, duration: 320, onComplete: () => core.destroy() });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2; const sx = px + Math.cos(a) * r * 0.9, sy = py + Math.sin(a) * r * 0.9;
          const m = this.add.circle(sx, sy, 3, 0xc98cff, 0.9).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
          const ia = a + 1.1;
          this.tweens.add({ targets: m, x: px + Math.cos(ia) * 12, y: py + Math.sin(ia) * 12, alpha: 0, scale: 0.3, duration: 300, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
        }
        this.novaRing(px, py, r, 0xb060ff);
        for (const e of this.enemies) {
          if (!e.active) continue;
          const d = Phaser.Math.Distance.Between(px, py, e.x, e.y);
          if (d > r) continue;
          const ang = Phaser.Math.Angle.Between(e.x, e.y, px, py);
          e.setPosition(e.x + Math.cos(ang) * Math.min(d * 0.6, 220), e.y + Math.sin(ang) * Math.min(d * 0.6, 220));
        }
        this.time.delayedCall(140, () => this.aoeBurst(px, py, r * 0.7, input, 'void', 0xb060ff));
        break;
      }
      case 'rune': {
        // Начертать руну — печать на земле, срабатывает с задержкой
        const rx = px, ry = py;
        const ring = this.add.circle(rx, ry, ult ? 220 : 150, 0x9f7aff, 0).setStrokeStyle(4, 0x9f7aff, 0.8).setDepth(4);
        this.tweens.add({ targets: ring, angle: 180, duration: 500, onComplete: () => ring.destroy() });
        this.time.delayedCall(500, () => {
          const r = ult ? 220 : 150;
          this.novaRing(rx, ry, r, fx(0xc79bff));
          this.aoeBurst(rx, ry, r, input, el, fx(0xc79bff));
        });
        break;
      }
      case 'buff': {
        // Смена формы — щит + рывок силы + волна
        this.player.grantShield(ult ? 3000 : 1800);
        this.run.currentHP = Math.min(this.run.stats().maxHP, this.run.currentHP + this.run.stats().maxHP * 0.12);
        this.novaRing(px, py, 260, 0x7ae090);
        this.risingMotes(px, py, 150, 0x9fe8a0, 12);
        this.aoeBurst(px, py, 260, input, el, 0x7ae090);
        break;
      }
      case 'random': {
        // Адаптивный навык (Вознесённый) — случайное действие
        const pool: AbilityKind[] = ['nova', 'meteor', 'chain', 'volley', 'whirlwind', 'beam'];
        this.performAbility(pool[Math.floor(Math.random() * pool.length)], coef, ult);
        return;
      }
      case 'nuke': {
        // экранный удар: расширяющаяся волна + мощный AoE
        const r = ult ? 620 : 420;
        this.novaRing(px, py, r, fx(0xffe08a));
        this.time.delayedCall(60, () => this.novaRing(px, py, r * 0.7, col));
        this.aoeBurst(px, py, r, input, el, fx(0xffcf6a));
        if (this.run.loadout.classId === 'bloodmage') this.run.currentHP = Math.min(this.run.stats().maxHP, this.run.currentHP + this.run.stats().maxHP * 0.2);
        break;
      }
      case 'rain': {
        // ливень ударов по площади (метеоры/стрелы)
        const n = ult ? 12 : 6;
        const R = ult ? 460 : 300;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * R;
          const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
          const rainCol = el !== 'none' ? col : 0xff9a40;
          this.time.delayedCall(100 + i * 70, () => {
            this.fxCircle(x, y, 78, rainCol, 0.4);
            this.aoeBurst(x, y, 86, input, el, rainCol);
            if (el === 'ice') this.freezeInRadius(x, y, 90, 1500);
          });
        }
        break;
      }
      case 'meteor': {
        // одиночный тяжёлый снаряд-взрыв в цель/по направлению
        const t = this.nearestEnemyPos() ?? { x: px + Math.cos(this.player.facing.angle()) * 300, y: py + Math.sin(this.player.facing.angle()) * 300 };
        const fall = ult ? 260 : 200;
        // телеграф-круг на земле + падающий с неба огненный снаряд со шлейфом
        const mark = this.add.circle(t.x, t.y, 30, fx(0xff5020), 0).setStrokeStyle(3, fx(0xff7030), 0.8).setDepth(4);
        this.tweens.add({ targets: mark, radius: (ult ? 260 : 170) * 0.6, alpha: 0.2, duration: fall, onComplete: () => mark.destroy() });
        const rock = this.add.image(t.x + 70, t.y - 340, this.textures.exists('proj_orb') ? 'proj_orb' : 'circle')
          .setDepth(10).setScale(ult ? 2.6 : 2).setTint(fx(0xff6a30)).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: rock, x: t.x, y: t.y, duration: fall, ease: 'Quad.easeIn',
          onUpdate: () => this.fxCircle(rock.x, rock.y, 16, fx(0xff7030), 0.4), onComplete: () => rock.destroy() });
        this.time.delayedCall(fall, () => {
          const r = ult ? 260 : 170;
          this.novaRing(t.x, t.y, r, fx(0xff7030));
          this.aoeBurst(t.x, t.y, r, input, el, fx(0xff7030));
          this.cameras.main.shake(140, 0.006);
        });
        break;
      }
      case 'volley': {
        const n = ult ? 9 : 5;
        const spreadTotal = ult ? 1.1 : 0.6;
        const facing = this.player.facing.clone().normalize();
        this.player.playAttack('ranged');
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * (spreadTotal / Math.max(1, n - 1));
          const dir = facing.clone().rotate(off);
          this.firePlayerProjectile(dir, input, el, false, 3, 12, 1.15, 'proj_arrow');
        }
        break;
      }
      case 'cone': {
        // фронтальный конус (дыхание/волна)
        const range = ult ? 440 : 300;
        const arc = ult ? 1.5 : 1.0;
        this.coneStrike(range, arc, input, el, col);
        break;
      }
      case 'beam': {
        // луч по направлению
        const range = ult ? 560 : 420;
        this.beamStrike(range, input, el, col);
        break;
      }
      case 'chain': {
        this.chainLightning(ult ? 8 : 5, input, el, fx(0x9fe0ff));
        break;
      }
      case 'dash': {
        this.blinkStrike(input, el, ult ? 3 : 1);
        break;
      }
      case 'heal': {
        const st = this.run.stats();
        this.run.currentHP = Math.min(st.maxHP, this.run.currentHP + st.maxHP * (ult ? 0.5 : 0.28));
        this.novaRing(px, py, ult ? 360 : 240, 0xffe89a);
        this.spawnPickupFx(px, py, 0x9fe0a0);
        this.risingMotes(px, py, ult ? 200 : 140, 0x9fe8a0, ult ? 18 : 12);
        this.aoeBurst(px, py, ult ? 360 : 240, input, 'radiance', 0xffe89a);
        if (ult) this.player.grantShield(2600);
        break;
      }
      case 'shield': {
        this.player.grantShield(ult ? 4000 : 2200);
        this.novaRing(px, py, 260, 0xffe08a);
        this.risingMotes(px, py, 150, 0xffe08a, 14);
        // мерцающий купол-щит вокруг игрока
        const dome = this.add.circle(px, py, 46, 0xffe08a, 0.12).setDepth(9).setStrokeStyle(3, 0xffe08a, 0.8);
        this.tweens.add({ targets: dome, scale: 1.15, alpha: 0, duration: 620, ease: 'Quad.easeOut', onComplete: () => dome.destroy() });
        this.aoeBurst(px, py, 260, input, 'radiance', 0xffe08a);
        break;
      }
      case 'poison': {
        // ядовитое облако — залипающая зона урона
        const r = ult ? 300 : 200;
        this.playerCloud(px, py, r, ult ? 6 : 4, input);
        break;
      }
      case 'timestop': {
        // временной разрыв: стан+урон по округе
        const r = ult ? 440 : 300;
        this.novaRing(px, py, r, 0x9fd0ff);
        this.time.delayedCall(80, () => this.novaRing(px, py, r * 0.6, 0xd0e8ff));
        for (const e of this.enemies) if (e.active && Phaser.Math.Distance.Between(px, py, e.x, e.y) <= r) e.freeze(ult ? 2500 : 1400);
        this.aoeBurst(px, py, r, input, el, fx(0xbfe0ff));
        break;
      }
      case 'summon': {
        const n = ult ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.spawnTurret(px + Math.cos(a) * 70, py + Math.sin(a) * 70, coef, ult ? 8000 : 5500);
        }
        break;
      }
    }
  }

  private skillElement(): Element {
    const w = this.run.loadout.weapon.element;
    if (w !== 'none') return w;
    if (this.run.loadout.element !== 'none') return this.run.loadout.element;
    return CLASS_STATS[this.run.loadout.classId].affinity; // напр. пиромант=огонь, криомант=лёд
  }

  private nearestEnemyPos(): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = 900;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bd) { bd = d; best = { x: e.x, y: e.y }; }
    }
    if (this.boss && this.boss.active) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (d < bd) best = { x: this.boss.x, y: this.boss.y };
    }
    return best;
  }

  // Вращающийся росчерк для вихря.
  private spinSlash(x: number, y: number, r: number, color: number, i: number): void {
    const s = this.slashFx;
    this.tweens.killTweensOf(s);
    s.setVisible(true).setPosition(x, y).setTint(color).setAlpha(0.85)
      .setScale((r / 127) * 0.95).setRotation(i * 1.4).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: s, rotation: i * 1.4 + Math.PI * 1.5, alpha: 0, duration: 280, ease: 'Quad.easeOut',
      onComplete: () => s.setVisible(false).setBlendMode(Phaser.BlendModes.NORMAL),
    });
    // яркий полумесяц-росчерк, прочерчивающий дугу
    this.slashArc(x, y, r * 0.52, i * 1.4, color, i % 2 ? -1 : 1);
  }

  // Светящийся полумесяц, «прочерчивающий» дугу (аддитивный, ядро белое).
  private slashArc(x: number, y: number, r: number, baseAngle: number, color: number, dir: number): void {
    const g = this.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
    const spread = 0.55;
    const draw = (a: number) => {
      g.clear();
      g.lineStyle(11, color, 0.45); g.beginPath(); g.arc(x, y, r, a - spread, a + spread); g.strokePath();
      g.lineStyle(4, 0xffffff, 0.9); g.beginPath(); g.arc(x, y, r * 1.02, a - spread * 0.8, a + spread * 0.8); g.strokePath();
    };
    const start = baseAngle - dir * 1.35;
    const o = { v: 0 };
    this.tweens.add({
      targets: o, v: 1, duration: 240, ease: 'Quad.easeOut',
      onUpdate: () => draw(start + dir * 2.5 * o.v),
      onComplete: () => g.destroy(),
    });
  }

  // Зазубренная молния между двумя точками (свечение + ядро), аддитивная.
  private lightningBolt(x1: number, y1: number, x2: number, y2: number, color: number, seg = 6, jitter = 18): void {
    const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
    const dx = x2 - x1, dy = y2 - y1; const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < seg; i++) {
      const t = i / seg; const j = (Math.random() - 0.5) * jitter;
      pts.push({ x: x1 + dx * t + nx * j, y: y1 + dy * t + ny * j });
    }
    pts.push({ x: x2, y: y2 });
    const g = this.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
    const stroke = (w: number, c: number, a: number) => {
      g.lineStyle(w, c, a); g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    };
    stroke(9, color, 0.3); stroke(4, color, 0.8); stroke(1.5, 0xffffff, 1);
    this.tweens.add({ targets: g, alpha: 0, duration: 190, onComplete: () => g.destroy() });
  }

  // Расширяющееся кольцо-ударная волна: вспышка + 2 кольца + свечение + осколки + искры.
  private novaRing(x: number, y: number, r: number, color: number): void {
    const flash = this.add.circle(x, y, r * 0.32, 0xffffff, 0.9).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, scale: 0.1, alpha: 0, duration: 170, onComplete: () => flash.destroy() });
    // толстая внешняя волна (утончается по мере расширения)
    const ring = this.add.circle(x, y, 10, color, 0).setStrokeStyle(9, color, 0.95).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring, radius: r, alpha: 0, duration: 360, ease: 'Cubic.easeOut',
      onUpdate: () => ring.setStrokeStyle(9 * (0.35 + 0.65 * ring.alpha), color, ring.alpha),
      onComplete: () => ring.destroy(),
    });
    // быстрое белое ядро-кольцо
    const ring2 = this.add.circle(x, y, 8, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 0.85).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring2, radius: r * 0.72, alpha: 0, duration: 260, ease: 'Cubic.easeOut',
      onUpdate: () => ring2.setStrokeStyle(3, 0xffffff, ring2.alpha),
      onComplete: () => ring2.destroy(),
    });
    this.fxCircle(x, y, r * 0.6, color, 0.22);
    this.shards(x, y, color, Math.min(12, Math.round(r / 34)), r * 0.85);
    this.sparks(x, y, color, Math.min(14, Math.round(r / 26)), r * 0.9);
  }

  // Разлетающиеся продолговатые осколки-искры (аддитивные, с торможением).
  private shards(x: number, y: number, color: number, count: number, reach: number): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const d = reach * (0.4 + Math.random() * 0.6);
      const len = 5 + Math.random() * 6;
      const sh = this.add.rectangle(x, y, len, 2.5, color, 1).setDepth(9).setRotation(a).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: sh, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scaleX: 0.25, alpha: 0,
        duration: 260 + Math.random() * 180, ease: 'Cubic.easeOut', onComplete: () => sh.destroy(),
      });
    }
  }

  // Восходящие мотыльки света (лечение/щит/благословение).
  private risingMotes(x: number, y: number, r: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2; const rr = Math.random() * r;
      const m = this.add.circle(x + Math.cos(a) * rr, y + r * 0.35, 3 + Math.random() * 2, color, 0.9)
        .setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: m, y: m.y - r * 0.9 - Math.random() * r * 0.4, alpha: 0, scale: 0.3,
        duration: 600 + Math.random() * 260, ease: 'Sine.easeOut', onComplete: () => m.destroy(),
      });
    }
  }

  // Искры-частицы, разлетающиеся из точки (аддитивные, гаснут).
  private sparks(x: number, y: number, color: number, count: number, reach: number): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const d = reach * (0.5 + Math.random() * 0.5);
      const s = this.add.circle(x, y, 3 + Math.random() * 2, color, 0.95).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        scale: 0,
        alpha: 0,
        duration: 280 + Math.random() * 160,
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  // Фронтальный конус (дыхание/волна) — слои свечения + вылетающие частицы.
  private coneStrike(range: number, arc: number, input: HitInput, el: Element, color: number): void {
    const angle = this.player.facing.angle();
    const px = this.player.x, py = this.player.y;
    const g = this.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(color, 0.2); g.slice(px, py, range, angle - arc / 2, angle + arc / 2, false); g.fillPath();
    g.fillStyle(color, 0.3); g.slice(px, py, range * 0.7, angle - arc * 0.36, angle + arc * 0.36, false); g.fillPath();
    g.fillStyle(0xffffff, 0.28); g.slice(px, py, range * 0.4, angle - arc * 0.2, angle + arc * 0.2, false); g.fillPath();
    this.tweens.add({ targets: g, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
    // струя частиц наружу по направлению конуса
    for (let i = 0; i < 10; i++) {
      const a = angle + (Math.random() - 0.5) * arc;
      const d = range * (0.5 + Math.random() * 0.5);
      const m = this.add.circle(px, py, 2.5 + Math.random() * 2.5, color, 0.9).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: m, x: px + Math.cos(a) * d, y: py + Math.sin(a) * d, alpha: 0, scale: 0.2,
        duration: 240 + Math.random() * 120, ease: 'Cubic.easeOut', onComplete: () => m.destroy(),
      });
    }
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d > range) continue;
      const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) <= arc / 2) this.dealToEnemy(e, input, el);
    }
    if (this.boss && this.boss.active) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (d <= range && Math.abs(Phaser.Math.Angle.Wrap(a - angle)) <= arc / 2) this.dealToBoss(input, el);
    }
  }

  // Луч по направлению — слои свечения + дульная вспышка + бегущий импульс + взрыв в конце.
  private beamStrike(range: number, input: HitInput, el: Element, color: number): void {
    const angle = this.player.facing.angle();
    const sx = this.player.x, sy = this.player.y;
    const ex = sx + Math.cos(angle) * range;
    const ey = sy + Math.sin(angle) * range;
    const g = this.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(22, color, 0.22).lineBetween(sx, sy, ex, ey);
    g.lineStyle(12, color, 0.55).lineBetween(sx, sy, ex, ey);
    g.lineStyle(4, 0xffffff, 0.95).lineBetween(sx, sy, ex, ey);
    this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() });
    // дульная вспышка + бегущий по лучу импульс + всплеск на конце
    this.fxCircle(sx, sy, 44, color, 0.5);
    const pulse = this.add.circle(sx, sy, 11, 0xffffff, 0.9).setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: pulse, x: ex, y: ey, duration: 130, ease: 'Quad.easeOut',
      onComplete: () => { pulse.destroy(); this.novaRing(ex, ey, 90, color); },
    });
    const half = 34;
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (this.distToSegment(e.x, e.y, this.player.x, this.player.y, ex, ey) <= half + e.displayWidth / 3) this.dealToEnemy(e, input, el);
    }
    if (this.boss && this.boss.active && this.distToSegment(this.boss.x, this.boss.y, this.player.x, this.player.y, ex, ey) <= half + this.boss.displayWidth / 3) this.dealToBoss(input, el);
  }

  private distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Phaser.Math.Clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Цепная молния между ближайшими врагами.
  private chainLightning(jumps: number, input: HitInput, el: Element, lineCol = 0x9fe0ff): void {
    const targets: { x: number; y: number; e?: Enemy }[] = [];
    const used = new Set<Enemy>();
    let from = { x: this.player.x, y: this.player.y };
    for (let j = 0; j < jumps; j++) {
      let best: Enemy | null = null; let bd = 380;
      for (const e of this.enemies) {
        if (!e.active || used.has(e)) continue;
        const d = Phaser.Math.Distance.Between(from.x, from.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      used.add(best);
      targets.push({ x: best.x, y: best.y, e: best });
      from = { x: best.x, y: best.y };
    }
    // зазубренные разряды между узлами + вспышка на каждом попадании
    let prev = { x: this.player.x, y: this.player.y };
    for (const t of targets) {
      this.lightningBolt(prev.x, prev.y, t.x, t.y, lineCol, 6, 20);
      const f = this.add.circle(t.x, t.y, 15, 0xffffff, 0.9).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, scale: 0.2, alpha: 0, duration: 220, onComplete: () => f.destroy() });
      prev = t;
    }
    for (const t of targets) if (t.e && t.e.active) this.dealToEnemy(t.e, input, el);
    // добить босса, если рядом
    if (this.boss && this.boss.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y) < 420) this.dealToBoss(input, el);
  }

  // Рывок-удар к ближайшему врагу (иногда несколько прыжков).
  private blinkStrike(input: HitInput, el: Element, jumps: number): void {
    const doJump = (n: number) => {
      const t = this.nearestEnemyPos();
      if (!t) return;
      const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, t.x, t.y);
      const dist = Math.min(Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y), 320);
      this.player.setPosition(this.player.x + Math.cos(ang) * dist, this.player.y + Math.sin(ang) * dist);
      this.player.iframeT = Math.max(this.player.iframeT, 300);
      this.player.playAttack('melee');
      this.spinSlash(this.player.x, this.player.y, 150, 0xffffff, n);
      this.aoeBurst(this.player.x, this.player.y, 140, input, el, 0xffffff);
      if (n + 1 < jumps) this.time.delayedCall(120, () => doJump(n + 1));
    };
    doJump(0);
  }

  // Залипающая зона (яд/освящение) — контурное кольцо на земле + всплывающие клубы.
  private playerCloud(x: number, y: number, r: number, ticks: number, input: HitInput, el: Element = 'poison'): void {
    const color = el === 'radiance' ? 0xffe89a : el === 'poison' ? 0x8fd24a : ELEMENT_COLORS[el] ?? 0x8fd24a;
    this.fxCircle(x, y, r, color, 0.24);
    // маркер зоны на земле (мягкая заливка + пульсирующий контур)
    const zone = this.add.circle(x, y, r, color, 0.08).setDepth(3).setStrokeStyle(2, color, 0.5);
    this.tweens.add({ targets: zone, alpha: { from: 0.12, to: 0.05 }, yoyo: true, repeat: -1, duration: 500 });
    const puff = () => {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2; const rr = Math.random() * r * 0.9;
        const m = this.add.circle(x + Math.cos(a) * rr, y + r * 0.25, 3 + Math.random() * 3, color, 0.65)
          .setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: m, y: m.y - 26 - Math.random() * 30, alpha: 0, scale: 1.4, duration: 560, onComplete: () => m.destroy() });
      }
    };
    for (let i = 0; i < ticks; i++) {
      this.time.delayedCall(i * 400, () => {
        puff();
        for (const e of this.enemies) if (e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= r) this.dealToEnemy(e, input, el);
        if (this.boss && this.boss.active && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) <= r) this.dealToBoss(input, el);
      });
    }
    this.time.delayedCall(ticks * 400 + 120, () => { this.tweens.killTweensOf(zone); zone.destroy(); });
  }

  private freezeInRadius(x: number, y: number, r: number, ms: number): void {
    for (const e of this.enemies) if (e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= r) e.freeze(ms);
  }

  private randomNearbyEnemy(range: number): Enemy | null {
    const near = this.enemies.filter((e) => e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= range);
    if (near.length) return near[Math.floor(Math.random() * near.length)];
    return null;
  }

  // Временная турель/миньон: стреляет по ближайшему врагу.
  private spawnTurret(x: number, y: number, coef: number, dur: number): void {
    const spr = this.add.image(x, y, this.textures.exists('proj_orb') ? 'proj_orb' : 'circle').setDepth(7).setScale(1.6).setTint(0x9fe0ff);
    this.tweens.add({ targets: spr, scale: 1.9, yoyo: true, repeat: -1, duration: 500 });
    this.summons.push({ x, y, spr, until: this.lastTime + dur, cd: 0, coef });
  }

  // Тик турелей/миньонов: стреляют по ближайшему врагу, гаснут по таймеру.
  private updateSummons(dtMs: number, time: number): void {
    for (let i = this.summons.length - 1; i >= 0; i--) {
      const t = this.summons[i];
      if (time >= t.until) {
        this.tweens.killTweensOf(t.spr);
        t.spr.destroy();
        this.summons.splice(i, 1);
        continue;
      }
      t.cd -= dtMs;
      if (t.cd > 0) continue;
      // ближайший враг в радиусе
      let best: Enemy | null = null; let bd = 520;
      for (const e of this.enemies) {
        if (!e.active) continue;
        const d = Phaser.Math.Distance.Between(t.x, t.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      const target = best ?? (this.boss && this.boss.active && Phaser.Math.Distance.Between(t.x, t.y, this.boss.x, this.boss.y) < 520 ? this.boss : null);
      if (!target) continue;
      t.cd = 620;
      const ang = Phaser.Math.Angle.Between(t.x, t.y, target.x, target.y);
      const proj = this.getProjectile(this.pProj, this.pProjGroup);
      const payload = { owner: 'player' as const, raw: 0, element: this.skillElement(), isTrue: false, crit: false, pierce: 1 };
      (proj as Projectile & { hitInput?: HitInput }).hitInput = this.baseHitInput(t.coef * 0.4);
      proj.fire(t.x, t.y, Math.cos(ang) * 620, Math.sin(ang) * 620, payload, 10, 'proj_orb');
    }
  }

  private aoeBurst(x: number, y: number, radius: number, input: HitInput, el: Element, color: number): void {
    this.fxCircle(x, y, radius, color, 0.35);
    // лёгкая ударная волна по краю зоны (аддитивная), для читаемости площади
    const ring = this.add.circle(x, y, radius * 0.3, color, 0).setStrokeStyle(4, color, 0.7).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring, radius, alpha: 0, duration: 280, ease: 'Cubic.easeOut',
      onUpdate: () => ring.setStrokeStyle(4, color, ring.alpha), onComplete: () => ring.destroy(),
    });
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
  // Фиксированные логова боссов: по одному на кольцо, распределены по углам.
  private computeBossAnchors(): void {
    this.bossAnchors = [];
    const angles = [-Math.PI / 2, -Math.PI / 6, Math.PI / 2, Math.PI, Math.PI / 3];
    for (let ring = 1; ring <= RING_COUNT; ring++) {
      const def = BOSSES_BY_RING[ring];
      if (!def) continue;
      const innerR = ringOuterRadius(ring - 1);
      const r = innerR + (ringOuterRadius(ring) - innerR) * 0.62;
      const a = angles[(ring - 1) % angles.length];
      this.bossAnchors.push({
        ring,
        id: def.id,
        x: this.center.x + Math.cos(a) * r,
        y: this.center.y + Math.sin(a) * r,
      });
    }
  }

  // Декор биомов: генерируем чанки вокруг игрока, дальние — удаляем (без лагов).
  private updateDecorations(dt: number): void {
    this.decoTimer -= dt;
    if (this.decoTimer > 0) return;
    this.decoTimer = 0.2;
    const cs = DECO_CELL;
    const pcx = Math.floor(this.player.x / cs);
    const pcy = Math.floor(this.player.y / cs);
    const R = 2;
    const needed = new Set<string>();
    const missing: { gx: number; gy: number; key: string; d: number }[] = [];
    for (let gy = pcy - R; gy <= pcy + R; gy++) {
      for (let gx = pcx - R; gx <= pcx + R; gx++) {
        const key = gx + ',' + gy;
        needed.add(key);
        if (!this.decoCells.has(key)) missing.push({ gx, gy, key, d: Math.abs(gx - pcx) + Math.abs(gy - pcy) });
      }
    }
    // строим не больше 3 чанков за тик (ближние первыми) — без спайка-фриза
    missing.sort((a, b) => a.d - b.d);
    for (const m of missing.slice(0, 3)) this.buildDecoCell(m.gx, m.gy, m.key);
    // отсев дальних чанков
    for (const key of [...this.decoCells.keys()]) {
      if (needed.has(key)) continue;
      for (const s of this.decoCells.get(key)!) s.destroy();
      this.decoCells.delete(key);
      for (let i = this.chests.length - 1; i >= 0; i--) {
        if (this.chests[i].key.startsWith(key + '#')) {
          this.tweens.killTweensOf(this.chests[i].gfx);
          this.chests[i].gfx.destroy();
          this.chests.splice(i, 1);
        }
      }
    }
  }

  private buildDecoCell(gx: number, gy: number, key: string): void {
    const cs = DECO_CELL;
    const rng = new RNG(hashSeed('deco_' + gx + '_' + gy));
    const sprites: Phaser.GameObjects.Image[] = [];
    const count = rng.int(2, 4);
    for (let i = 0; i < count; i++) {
      const x = gx * cs + rng.float(0.08, 0.92) * cs;
      const y = gy * cs + rng.float(0.08, 0.92) * cs;
      const dc = Phaser.Math.Distance.Between(x, y, this.center.x, this.center.y);
      const ring = this.ringOf(dc);
      const set = DECO_SETS[ring];
      if (!set) continue; // хаб/вне мира — без декора
      // не заваливаем логова боссов
      if (this.bossAnchors.some((a) => Phaser.Math.Distance.Between(x, y, a.x, a.y) < 260)) continue;
      const tex = set[rng.int(0, set.length - 1)];
      if (!this.textures.exists(tex)) continue;
      const big = tex === 'prop_tree' || tex === 'deco_deadtree' || tex === 'deco_column';
      const spr = this.add.image(x, y, tex).setOrigin(0.5, 0.9).setDepth(4)
        .setScale(big ? rng.float(0.6, 0.85) : rng.float(0.4, 0.62));
      if (tex === 'deco_crystal') spr.setTint(ring >= 5 ? 0xb070ff : 0x9fd8ff);
      sprites.push(spr);
    }
    this.decoCells.set(key, sprites);
    // редкий сундук в чанке (кроме хаба и уже открытых)
    if (rng.chance(0.16)) {
      const x = gx * cs + rng.float(0.2, 0.8) * cs;
      const y = gy * cs + rng.float(0.2, 0.8) * cs;
      const ring = this.ringOf(Phaser.Math.Distance.Between(x, y, this.center.x, this.center.y));
      const ckey = key + '#chest';
      if (ring >= 1 && ring <= RING_COUNT && !this.openedChests.has(ckey)) {
        const gfx = this.add.image(x, y, 'deco_chest').setOrigin(0.5, 0.85).setDepth(5).setScale(0.5);
        this.tweens.add({ targets: gfx, y: y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.chests.push({ x, y, gfx, opened: false, key: ckey });
      }
    }
  }

  // Открытие сундука при подходе: золото + шанс зелья/оружия.
  private updateChests(): void {
    for (const c of this.chests) {
      if (c.opened) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y) > 46) continue;
      c.opened = true;
      this.openedChests.add(c.key);
      this.tweens.killTweensOf(c.gfx);
      c.gfx.setTexture('deco_chest_open');
      const ring = Math.max(1, this.ringOf(Phaser.Math.Distance.Between(c.x, c.y, this.center.x, this.center.y)));
      const gold = 40 * ring + Math.floor(Math.random() * 40 * ring);
      this.run.wallet.gold += gold;
      let msg = `Сундук: +${gold}⦿`;
      const roll = Math.random();
      if (roll < 0.4) {
        const k = Math.random() < 0.6 ? 'small_potion' : 'big_potion';
        this.run.heals[k] += 1;
        msg += ` · зелье`;
      } else if (roll < 0.62) {
        // оружие тира кольца
        const pool = WEAPON_ITEMS.filter((w) => w.rarity === (['uncommon', 'rare', 'epic', 'legendary', 'mythic'] as Rarity[])[Math.min(4, ring - 1)]);
        const weapon = Phaser.Utils.Array.GetRandom(pool.length ? pool : WEAPON_ITEMS);
        this.spawnWeaponPickup(weapon, ring, c.x + 30, c.y);
        msg += ` · оружие!`;
      }
      this.run.wallet.shards += 1;
      this.spawnPickupFx(c.x, c.y, 0xffd24a);
      this.flashBanner(msg, 2200);
    }
  }

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

    // босс агрится при подходе к своей фиксированной точке (логову)
    if (!this.boss) {
      for (const anc of this.bossAnchors) {
        if (this.run.bossesKilled.includes(anc.id)) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, anc.x, anc.y);
        if (d < BOSS_AGGRO_RANGE) {
          this.spawnBoss(anc.ring, anc.x, anc.y);
          break;
        }
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

  private spawnBoss(ring: number, bx: number, by: number): void {
    const def = BOSSES_BY_RING[ring];
    this.activeBossRing = ring;
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
    this.rollEnemyDrop(e);
    this.enemyGroup.remove(e);
    this.touchCd.delete(e);
    e.kill();
  }

  // Дроп снаряги/оружия из моба (редко; чаще с элиток и в дальних кольцах).
  private rollEnemyDrop(e: Enemy): void {
    const ring = Math.max(1, this.ringOf(Phaser.Math.Distance.Between(e.x, e.y, this.center.x, this.center.y)));
    const eliteMul = e.isElite ? 3.2 : 1;
    // редкость дропа растёт с кольцом (+шанс на ступень выше)
    const bump = Math.random() < 0.22 ? 1 : 0;
    const rarity = RARITY_ORDER[Phaser.Math.Clamp(ring - 1 + bump, 0, 5)];
    if (Math.random() < 0.06 * eliteMul) {
      // оружие
      const pool = WEAPON_ITEMS.filter((w) => w.rarity === rarity);
      const weapon = Phaser.Utils.Array.GetRandom(pool.length ? pool : WEAPON_ITEMS);
      this.spawnWeaponPickup(weapon, ring, e.x, e.y);
    } else if (Math.random() < 0.1 * eliteMul) {
      // броня случайного слота
      const slot = ARMOR_SLOTS[Phaser.Math.Between(0, ARMOR_SLOTS.length - 1)];
      const classId = this.run.loadout.classId;
      const setId = CLASS_SETS[classId] ? classId : 'warrior';
      const piece: ArmorPiece = { setId, slot, rarity, weight: nativeWeight(classId), tier: ring, enchant: 0 };
      this.spawnArmorPickup(piece, e.x, e.y);
    }
  }

  // «Уровень» брони = редкость + тир (зачар не учитывается — это отдельная
  // механика эффектов, которая не переносится на новую броню).
  private armorScore(p: ArmorPiece): number {
    return RARITY_ORDER.indexOf(p.rarity) * 10 + p.tier;
  }

  private spawnArmorPickup(piece: ArmorPiece, x: number, y: number): void {
    const color = RARITY_COLORS[piece.rarity] ?? 0x8fb0e0;
    const ring = this.add.circle(0, 0, 17, color, 0.85).setStrokeStyle(3, 0xffffff, 0.9);
    const key = 'armor_' + piece.slot;
    const icon: Phaser.GameObjects.GameObject = this.textures.exists(key)
      ? this.add.image(0, 0, key).setScale(0.34).setOrigin(0.5).setTint(color)
      : this.add.text(0, 0, '⛊', { fontFamily: 'system-ui', fontSize: '15px', color: '#fff' }).setOrigin(0.5);
    const c = this.add.container(x, y, [ring, icon]).setDepth(9);
    this.tweens.add({ targets: c, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.armorDrops.push({ x, y, piece, gfx: c });
  }

  private updateArmorPickups(): void {
    for (let i = this.armorDrops.length - 1; i >= 0; i--) {
      const d = this.armorDrops[i];
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, d.x, d.y) > 42) continue;
      const cur = this.run.build.armor[d.piece.slot];
      const better = !cur || this.armorScore(d.piece) > this.armorScore(cur);
      if (better) {
        this.run.equipArmor(d.piece.slot, d.piece);
        this.player.refreshFromStats();
        this.flashBanner(`Броня: ${ARMOR_SLOT_NAMES[d.piece.slot]} [${RARITY_NAMES[d.piece.rarity]}]`, 2200);
      } else {
        // хуже текущей — продаём за золото
        this.run.wallet.gold += 15 * (RARITY_ORDER.indexOf(d.piece.rarity) + 1);
        this.flashBanner('Броня продана (+золото)', 1400);
      }
      this.tweens.killTweensOf(d.gfx);
      d.gfx.destroy();
      this.armorDrops.splice(i, 1);
    }
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
    this.spawnWeaponPickup(weapon, ring, x, y);
  }

  // Наземный пикап конкретного оружия (босс/сундук).
  private spawnWeaponPickup(weapon: WeaponItemDef, tier: number, x: number, y: number): void {
    const color = ELEMENT_COLORS[weapon.element] ?? 0xf0c040;
    const ring2 = this.add.circle(0, 0, 18, color, 0.85).setStrokeStyle(3, 0xffffff, 0.9);
    const key = 'wpn_' + weapon.archetype;
    // тинт по стихии оружия — разные виды выглядят по-разному
    const eTint = weapon.element !== 'none' ? (ELEMENT_COLORS[weapon.element] ?? 0xffffff) : 0xffffff;
    const icon: Phaser.GameObjects.GameObject = this.textures.exists(key)
      ? this.add.image(0, 0, key).setScale(0.42).setOrigin(0.5).setTint(eTint)
      : this.add.text(0, 0, '⚔', { fontFamily: 'system-ui', fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    const c = this.add.container(x, y, [ring2, icon]).setDepth(9);
    this.tweens.add({ targets: c, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.pickups.push({ x, y, weapon, tier, gfx: c });
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
    }, 8, 'proj_orb');
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
      // фиксированные точки боссов (живых) — всегда на карте
      bossPoints: this.bossAnchors
        .filter((a) => !this.run.bossesKilled.includes(a.id))
        .map((a) => ({ x: a.x, y: a.y, active: this.activeBossRing === a.ring })),
    });
  }
}
