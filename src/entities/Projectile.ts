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
    shape = 'proj_orb',
  ): void {
    this.payload = payload;
    this.hitSet.clear();
    this.outbound = true;
    this.born = this.scene.time.now;
    this.enableBody(true, x, y, true, true);
    this.setActive(true).setVisible(true);
    // форма снаряда (фолбэк на круг), тинт по стихии/владельцу
    if (this.scene.textures.exists(shape)) this.setTexture(shape);
    else this.setTexture('circle');
    const color = payload.owner === 'enemy' ? 0xff8080 : ELEMENT_COLORS[payload.element] ?? 0xffffff;
    this.setTint(color);
    // направленные снаряды (стрела/болт/звезда) смотрят по вектору скорости
    this.directional = shape === 'proj_arrow' || shape === 'proj_bolt';
    if (shape === 'proj_star') {
      this.spin = 0.4;
    } else {
      this.spin = 0;
    }
    if (this.directional) this.setRotation(Math.atan2(vy, vx));
    else this.setRotation(0);
    // круглый хитбокс по source-текстуре (Arcade масштабирует его вместе с displaySize)
    const src = this.width || 64;
    (this.body as Phaser.Physics.Arcade.Body).setCircle(src / 2, 0, 0);
    // визуал крупнее хитбокса → «зона поражения» чуть щедрее
    const disp = radius * (this.directional ? 2.6 : 2.2);
    this.setDisplaySize(disp, disp);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
  }

  private directional = false;
  private spin = 0;

  // Вызывается из цикла WorldScene каждый кадр (Arcade.Image не имеет preUpdate).
  tick(time: number): void {
    if (!this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.spin) this.rotation += this.spin;
    else if (this.directional && (body.velocity.x || body.velocity.y)) {
      this.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
    }
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
