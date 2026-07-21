import Phaser from 'phaser';
import { Run } from '../core/run';
import { GAMEPLAY } from '../data/balance';
import { COLORS } from '../data/theme';
import { applySprite } from './sprites';

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
  }

  get invulnerable(): boolean {
    return this.iframeT > 0;
  }

  refreshFromStats(): void {
    const s = this.run.stats();
    this.baseSpeed = s.moveSpeed;
    this.maxDashCharges = s.dashCharges;
    if (this.dashCharges > this.maxDashCharges) this.dashCharges = this.maxDashCharges;
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
