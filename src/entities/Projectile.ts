import Phaser from 'phaser';
import type { Element } from '../data/elements';
import { ELEMENT_COLORS } from '../data/theme';

export interface ProjectilePayload {
  owner: 'player' | 'enemy';
  raw: number; // сырой урон (для игрока считается через пайплайн заранее)
  element: Element;
  isTrue: boolean;
  crit: boolean;
  pierce: number; // сколько целей может пробить
  homing?: boolean;
  boomerang?: boolean;
  returnTo?: () => Phaser.Math.Vector2;
}

export class Projectile extends Phaser.Physics.Arcade.Image {
  payload!: ProjectilePayload;
  born = 0;
  life = 1600; // мс
  hitSet = new Set<number>();
  private outbound = true;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'circle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
    this.disableBody(true, true); // тело выключено до fire() — не участвует в overlap
  }

  fire(
    x: number,
    y: number,
    vx: number,
    vy: number,
    payload: ProjectilePayload,
    radius: number,
  ): void {
    this.payload = payload;
    this.hitSet.clear();
    this.outbound = true;
    this.born = this.scene.time.now;
    this.enableBody(true, x, y, true, true);
    this.setActive(true).setVisible(true);
    const color = payload.owner === 'enemy' ? 0xff8080 : ELEMENT_COLORS[payload.element] ?? 0xffffff;
    this.setTint(color);
    this.setDisplaySize(radius * 2, radius * 2);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(
      32,
      32 - 32,
      32 - 32,
    );
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
  }

  // Вызывается из цикла WorldScene каждый кадр (Arcade.Image не имеет preUpdate).
  tick(time: number): void {
    if (!this.active) return;
    const age = time - this.born;
    if (this.payload.boomerang && this.payload.returnTo) {
      if (this.outbound && age > this.life * 0.4) {
        this.outbound = false;
      }
      if (!this.outbound) {
        const target = this.payload.returnTo();
        const ang = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        const speed = 420;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(
          Math.cos(ang) * speed,
          Math.sin(ang) * speed,
        );
        if (Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) < 24) {
          this.kill();
        }
      }
    }
    if (age > this.life) this.kill();
  }

  kill(): void {
    this.disableBody(true, true);
    this.setActive(false).setVisible(false);
  }
}
