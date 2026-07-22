import Phaser from 'phaser';
import { Run } from '../core/run';
import { GAMEPLAY } from '../data/balance';
import { COLORS, ELEMENT_COLORS } from '../data/theme';
import { CLASS_STATS } from '../data/classes';
import { applySprite } from './sprites';

// тинт брони по редкости (оверлеи поверх героя)
const RARITY_TINT: Record<string, number> = {
  common: 0xffffff,
  uncommon: 0x9fe0a0,
  rare: 0x7fb0ff,
  epic: 0xc79bff,
  legendary: 0xffb454,
  mythic: 0xff6a6a,
};

export class Player extends Phaser.Physics.Arcade.Image {
  run: Run;
  facing = new Phaser.Math.Vector2(1, 0);
  iframeT = 0;
  private dashT = 0;
  private dashCd = 0;
  dashCharges: number;
  maxDashCharges: number;
  private dashRecharge = 0;
  attackCd = 0;
  private baseSpeed: number;
  // визуал экипировки поверх героя
  private weaponSpr!: Phaser.GameObjects.Image;
  private helmSpr!: Phaser.GameObjects.Image;
  private chestSpr!: Phaser.GameObjects.Image;
  private shouldersSpr!: Phaser.GameObjects.Image;
  private atkT = 0;
  private atkDur = 0;
  private atkKind: 'melee' | 'ranged' = 'melee';
  // анимация ходьбы (2 кадра) + наклон в сторону движения + аура
  private walkFrames: [string, string] = ['hero', 'hero'];
  private walkFrame = 0;
  private walkT = 0;
  private leanRot = 0;
  private auraSpr!: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, run: Run) {
    super(scene, x, y, 'circle');
    this.run = run;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const r = GAMEPLAY.playerRadius;
    // текстура героя по расе (кадр 0), фолбэк на общий 'hero'
    const race = run.loadout.race.id;
    const f0 = 'hero_' + race + '_0';
    this.walkFrames = scene.textures.exists(f0)
      ? [f0, 'hero_' + race + '_1']
      : ['hero', 'hero'];
    applySprite(this, this.walkFrames[0], COLORS.player, r, 4.6);
    (this.body as Phaser.Physics.Arcade.Body).setDamping(true);
    const s = run.stats();
    this.baseSpeed = s.moveSpeed;
    this.maxDashCharges = s.dashCharges;
    this.dashCharges = s.dashCharges;
    this.createOverlays(scene);
    this.refreshVisuals();
  }

  // Цвет ауры: стихия оружия → стартовая инфузия → аффинитет класса.
  private auraColor(): number {
    const wEl = this.run.loadout.weapon.element;
    const inf = this.run.loadout.element;
    const el = wEl !== 'none' ? wEl : inf !== 'none' ? inf : CLASS_STATS[this.run.loadout.classId].affinity;
    return ELEMENT_COLORS[el] ?? 0x9fb4ff;
  }

  private createOverlays(scene: Phaser.Scene): void {
    // аура по стихии/способности — светящийся ореол позади героя
    this.auraSpr = scene.add
      .image(this.x, this.y, scene.textures.exists('aura') ? 'aura' : 'circle')
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.auraColor())
      .setAlpha(0.4);
    scene.tweens.add({
      targets: this.auraSpr,
      alpha: { from: 0.28, to: 0.55 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    const mk = (key: string, depth: number): Phaser.GameObjects.Image => {
      const k = scene.textures.exists(key) ? key : 'circle';
      return scene.add.image(this.x, this.y, k).setDepth(depth).setVisible(false);
    };
    // броня — тем же холстом, что герой → выставляем ту же позицию/масштаб
    this.helmSpr = mk('worn_helm', 12);
    this.chestSpr = mk('worn_chest', 12);
    this.shouldersSpr = mk('worn_shoulders', 12);
    // оружие в руке
    const wk = 'wpn_' + this.run.loadout.weapon.archetype;
    this.weaponSpr = scene.add
      .image(this.x, this.y, scene.textures.exists(wk) ? wk : 'circle')
      .setDepth(13)
      .setOrigin(0.5, 0.85);
  }

  // Обновить текстуру оружия и видимость брони (после смены оружия/надевания).
  refreshVisuals(): void {
    const wk = 'wpn_' + this.run.loadout.weapon.archetype;
    if (this.scene.textures.exists(wk)) this.weaponSpr.setTexture(wk);
    const arm = this.run.build.armor;
    const setPiece = (spr: Phaser.GameObjects.Image, key: keyof typeof arm) => {
      const p = arm[key];
      spr.setVisible(!!p);
      spr.setTint(p ? RARITY_TINT[p.rarity] ?? 0xffffff : 0xffffff);
    };
    setPiece(this.helmSpr, 'helm');
    setPiece(this.chestSpr, 'chest');
    setPiece(this.shouldersSpr, 'shoulders');
  }

  // Запустить анимацию атаки (взмах для мили, выпад для дальнего).
  playAttack(kind: 'melee' | 'ranged'): void {
    this.atkKind = kind;
    this.atkDur = kind === 'melee' ? 220 : 160;
    this.atkT = this.atkDur;
  }

  // Позиционирование оверлеев экипировки каждый кадр.
  private syncOverlays(): void {
    const flip = this.flipX;
    const a = this.alpha;
    // аура позади героя (пульс альфы задан твином)
    const w = this.displayWidth;
    this.auraSpr.setPosition(this.x, this.y).setDisplaySize(w * 2.2, w * 2.2);
    // броня повторяет позицию/масштаб/зеркало/наклон героя (рисовалась тем же холстом)
    for (const spr of [this.chestSpr, this.shouldersSpr, this.helmSpr]) {
      if (!spr.visible) continue;
      spr.setPosition(this.x, this.y).setScale(this.scaleX, this.scaleY).setFlipX(flip).setRotation(this.rotation).setAlpha(a);
    }
    // оружие сбоку от героя, с наклоном; анимация атаки
    const side = flip ? -1 : 1;
    let ox = side * w * 0.34;
    let oy = w * 0.04;
    let rot = side * 0.5; // покой: слегка отведено
    if (this.atkT > 0) {
      const p = 1 - this.atkT / this.atkDur; // 0..1
      if (this.atkKind === 'melee') {
        // взмах дугой: от заноса назад к удару вперёд
        const swing = -1.4 + 2.6 * Math.sin(p * Math.PI);
        rot = side * swing;
        ox = side * w * (0.28 + 0.14 * Math.sin(p * Math.PI));
      } else {
        // выпад вперёд (по стороне)
        ox = side * w * (0.34 + 0.34 * Math.sin(p * Math.PI));
        rot = side * (0.5 - 0.9 * Math.sin(p * Math.PI));
      }
    }
    this.weaponSpr
      .setPosition(this.x + ox, this.y + oy)
      .setDisplaySize(w * 0.5, w * 0.62)
      .setFlipX(flip)
      .setRotation(rot)
      .setAlpha(a);
  }

  get invulnerable(): boolean {
    return this.iframeT > 0;
  }

  refreshFromStats(): void {
    const s = this.run.stats();
    this.baseSpeed = s.moveSpeed;
    this.maxDashCharges = s.dashCharges;
    if (this.dashCharges > this.maxDashCharges) this.dashCharges = this.maxDashCharges;
    this.refreshVisuals();
  }

  handleMovement(dir: Phaser.Math.Vector2, dtMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.dashT > 0) {
      this.dashT -= dtMs;
      return; // во время рывка скорость зафиксирована
    }
    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.facing.copy(dir);
      body.setVelocity(dir.x * this.baseSpeed, dir.y * this.baseSpeed);
      // зеркалим модельку в сторону бега (право/лево)
      if (Math.abs(dir.x) > 0.1) this.setFlipX(dir.x < 0);
    } else {
      body.setVelocity(0, 0);
    }
  }

  tryDash(): boolean {
    if (this.dashCd > 0 || this.dashCharges <= 0) return false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const d = this.facing.clone().normalize();
    body.setVelocity(d.x * GAMEPLAY.dashSpeed, d.y * GAMEPLAY.dashSpeed);
    this.dashT = GAMEPLAY.dashDuration;
    this.dashCd = GAMEPLAY.dashCooldown;
    this.iframeT = Math.max(this.iframeT, GAMEPLAY.dashIFrames);
    this.dashCharges -= 1;
    return true;
  }

  tick(dtMs: number): void {
    if (this.iframeT > 0) this.iframeT -= dtMs;
    if (this.dashCd > 0) this.dashCd -= dtMs;
    if (this.attackCd > 0) this.attackCd -= dtMs;
    // перезарядка зарядов рывка
    if (this.dashCharges < this.maxDashCharges) {
      this.dashRecharge += dtMs;
      if (this.dashRecharge >= 2500) {
        this.dashRecharge = 0;
        this.dashCharges += 1;
      }
    }
    this.setAlpha(this.invulnerable ? 0.5 : 1);
    if (this.atkT > 0) this.atkT -= dtMs;
    this.animateWalk(dtMs);
    this.syncOverlays();
  }

  // Смена кадров ходьбы + наклон корпуса в сторону движения (зеркалится флипом).
  private animateWalk(dtMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const spd = Math.hypot(body.velocity.x, body.velocity.y);
    if (spd > 24) {
      this.walkT += dtMs;
      if (this.walkT > 130) {
        this.walkT = 0;
        this.walkFrame ^= 1;
        this.setTexture(this.walkFrames[this.walkFrame]);
      }
      const lean = Phaser.Math.Clamp(body.velocity.x / (this.baseSpeed || 1), -1, 1) * 0.12;
      this.leanRot += (lean - this.leanRot) * 0.25;
    } else {
      if (this.walkFrame !== 0) {
        this.walkFrame = 0;
        this.setTexture(this.walkFrames[0]);
      }
      this.leanRot *= 0.8;
    }
    this.setRotation(this.leanRot);
  }

  // Урон по игроку с учётом уворота/неуязвимости. Возвращает фактический урон.
  takeDamage(amount: number, dodgeRoll: number): number {
    if (this.invulnerable) return 0;
    const s = this.run.stats();
    if (dodgeRoll < s.dodge) return 0;
    this.run.currentHP -= amount;
    this.iframeT = Math.max(this.iframeT, 350); // короткая i-frame после урона
    return amount;
  }
}
