import Phaser from 'phaser';
import { Run } from '../core/run';
import { GAMEPLAY } from '../data/balance';
import { COLORS } from '../data/theme';
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

  constructor(scene: Phaser.Scene, x: number, y: number, run: Run) {
    super(scene, x, y, 'circle');
    this.run = run;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const r = GAMEPLAY.playerRadius;
    applySprite(this, 'hero', COLORS.player, r, 4.6);
    (this.body as Phaser.Physics.Arcade.Body).setDamping(true);
    const s = run.stats();
    this.baseSpeed = s.moveSpeed;
    this.maxDashCharges = s.dashCharges;
    this.dashCharges = s.dashCharges;
    this.createOverlays(scene);
    this.refreshVisuals();
  }

  private createOverlays(scene: Phaser.Scene): void {
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
    // броня повторяет позицию/масштаб/зеркало героя (рисовалась тем же холстом)
    for (const spr of [this.chestSpr, this.shouldersSpr, this.helmSpr]) {
      if (!spr.visible) continue;
      spr.setPosition(this.x, this.y).setScale(this.scaleX, this.scaleY).setFlipX(flip).setAlpha(a);
    }
    // оружие сбоку от героя, с наклоном; анимация атаки
    const w = this.displayWidth;
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
    this.syncOverlays();
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
