import Phaser from 'phaser';
import type { MobDef } from '../data/mobs';
import type { Element } from '../data/elements';
import {
  createStatusState,
  tickStatus,
  slowFactor,
  isDisabled,
  type StatusState,
} from '../core/statusEngine';

export interface EnemyContext {
  playerPos(): Phaser.Math.Vector2;
  shoot(x: number, y: number, tx: number, ty: number, dmg: number, element: Element): void;
}

export class Enemy extends Phaser.Physics.Arcade.Image {
  def!: MobDef;
  hp = 1;
  maxHp = 1;
  armor = 0;
  res = 0;
  dmg = 1;
  xp = 0;
  gold = 0;
  speed = 60;
  status: StatusState = createStatusState();
  isElite = false;
  private atkTimer = 0;
  private chargeState: 'approach' | 'charging' | 'recover' = 'approach';
  private chargeTimer = 0;
  private hpBar?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'circle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  spawn(
    def: MobDef,
    x: number,
    y: number,
    stats: { hp: number; dmg: number; armor: number; xp: number; gold: number },
    elite = false,
  ): void {
    this.def = def;
    this.isElite = elite;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.armor = stats.armor;
    this.res = 0;
    this.dmg = stats.dmg;
    this.xp = stats.xp;
    this.gold = stats.gold;
    this.speed = def.speed * (elite ? 1.05 : 1);
    this.status = createStatusState();
    this.atkTimer = 0;
    this.chargeState = 'approach';
    this.enableBody(true, x, y, true, true);
    this.setActive(true).setVisible(true);
    this.setTint(def.color);
    const r = def.radius * (elite ? 1.5 : 1);
    this.setDisplaySize(r * 2, r * 2);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(32, 0, 0);
  }

  applyDamage(amount: number): void {
    this.hp -= amount;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  update(dt: number, ctx: EnemyContext): void {
    if (!this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Статусы (DoT + контроль).
    const dot = tickStatus(this.status, dt);
    if (dot > 0) this.hp -= dot;

    if (isDisabled(this.status)) {
      body.setVelocity(0, 0);
      this.setAlpha(0.6);
      return;
    }
    this.setAlpha(1);

    const p = ctx.playerPos();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
    const ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
    const slow = slowFactor(this.status);
    const spd = this.speed * slow;

    this.atkTimer -= dt;

    switch (this.def.ai) {
      case 'chaser':
      case 'swarm':
      case 'tank':
        this.moveToward(ang, spd);
        break;
      case 'shooter':
      case 'caster': {
        const preferred = this.def.ai === 'caster' ? 220 : 260;
        if (dist > preferred + 30) this.moveToward(ang, spd);
        else if (dist < preferred - 40) this.moveToward(ang + Math.PI, spd * 0.8);
        else body.setVelocity(0, 0);
        if (this.atkTimer <= 0 && dist < 420) {
          ctx.shoot(this.x, this.y, p.x, p.y, this.dmg, this.def.element);
          this.atkTimer = this.def.ai === 'caster' ? 2.0 : 1.6;
        }
        break;
      }
      case 'charger': {
        if (this.chargeState === 'approach') {
          this.moveToward(ang, spd);
          if (dist < 180 && this.atkTimer <= 0) {
            this.chargeState = 'charging';
            this.chargeTimer = 0.35;
            body.setVelocity(Math.cos(ang) * spd * 3.2, Math.sin(ang) * spd * 3.2);
          }
        } else if (this.chargeState === 'charging') {
          this.chargeTimer -= dt;
          if (this.chargeTimer <= 0) {
            this.chargeState = 'recover';
            this.chargeTimer = 0.6;
            body.setVelocity(0, 0);
          }
        } else {
          this.chargeTimer -= dt;
          if (this.chargeTimer <= 0) {
            this.chargeState = 'approach';
            this.atkTimer = 1.4;
          }
        }
        break;
      }
    }

    this.updateHpBar();
  }

  private moveToward(ang: number, spd: number): void {
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
  }

  private updateHpBar(): void {
    if (this.hp >= this.maxHp) {
      this.hpBar?.setVisible(false);
      return;
    }
    const w = this.displayWidth;
    if (!this.hpBar) {
      this.hpBar = this.scene.add.rectangle(this.x, this.y - this.displayHeight / 2 - 6, w, 3, 0xff5555).setDepth(5);
    }
    this.hpBar.setVisible(true);
    this.hpBar.setPosition(this.x, this.y - this.displayHeight / 2 - 6);
    this.hpBar.width = w * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  kill(): void {
    this.hpBar?.destroy();
    this.hpBar = undefined;
    this.disableBody(true, true);
    this.setActive(false).setVisible(false);
  }
}
