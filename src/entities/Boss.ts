import Phaser from 'phaser';
import type { BossDef, BossAttackDef } from '../data/bosses';
import type { Element } from '../data/elements';
import {
  createStatusState,
  tickStatus,
  isDisabled,
  type StatusState,
} from '../core/statusEngine';

export interface BossContext {
  playerPos(): Phaser.Math.Vector2;
  telegraphCircle(x: number, y: number, radius: number, delay: number, onHit: () => void): void;
  shootFan(x: number, y: number, tx: number, ty: number, count: number, dmg: number, element: Element): void;
  summonAdds(x: number, y: number, count: number): void;
  onPhaseChange(): void;
}

export class Boss extends Phaser.Physics.Arcade.Image {
  def!: BossDef;
  hp = 1;
  maxHp = 1;
  armor = 0;
  res = 0;
  dmg = 1;
  status: StatusState = createStatusState();
  phase = 1;
  private cooldowns = new Map<string, number>();
  private globalGate = 0; // пока телеграфится атака — не начинать новую

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'circle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  spawn(def: BossDef, x: number, y: number, stats: { hp: number; dmg: number; armor: number }): void {
    this.def = def;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.armor = stats.armor;
    this.dmg = stats.dmg;
    this.res = 0;
    this.phase = 1;
    this.status = createStatusState();
    this.cooldowns.clear();
    for (const a of def.attacks) this.cooldowns.set(a.kind, a.cooldown * 0.4);
    this.globalGate = 800;
    this.enableBody(true, x, y, true, true);
    this.setActive(true).setVisible(true);
    this.setTint(def.color);
    this.setDisplaySize(def.radius * 2, def.radius * 2);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(32, 0, 0);
    (this.body as Phaser.Physics.Arcade.Body).setImmovable(true);
  }

  applyDamage(amount: number): void {
    this.hp -= amount;
    if (this.phase === 1 && this.hp <= this.maxHp * this.def.phaseThreshold) {
      this.phase = 2;
    }
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  update(dtMs: number, ctx: BossContext): void {
    if (!this.active) return;
    const dt = dtMs / 1000;
    const dot = tickStatus(this.status, dt);
    if (dot > 0) this.hp -= dot;

    if (this.phase === 2 && !this.phaseAnnounced) {
      this.phaseAnnounced = true;
      ctx.onPhaseChange();
    }

    this.globalGate -= dtMs;
    for (const a of this.def.attacks) {
      const cd = (this.cooldowns.get(a.kind) ?? 0) - dtMs;
      this.cooldowns.set(a.kind, cd);
    }

    if (isDisabled(this.status)) return;
    if (this.globalGate > 0) return;

    // выбрать готовую атаку (учитывая фазу)
    const ready = this.def.attacks.filter(
      (a) => (this.cooldowns.get(a.kind) ?? 0) <= 0 && (!a.phaseOnly || this.phase === 2),
    );
    if (ready.length === 0) return;
    const attack = Phaser.Utils.Array.GetRandom(ready);
    this.performAttack(attack, ctx);
    this.cooldowns.set(attack.kind, attack.cooldown);
    this.globalGate = attack.telegraph + 250;
  }

  private phaseAnnounced = false;

  private performAttack(a: BossAttackDef, ctx: BossContext): void {
    const p = ctx.playerPos();
    switch (a.kind) {
      case 'root_slam':
        ctx.telegraphCircle(p.x, p.y, a.radius ?? 80, a.telegraph, () => {
          /* урон применяется сценой через зону телеграфа */
        });
        break;
      case 'roots_arena':
        // несколько корней вокруг игрока
        for (let i = 0; i < 3; i++) {
          const ox = p.x + Phaser.Math.Between(-120, 120);
          const oy = p.y + Phaser.Math.Between(-120, 120);
          ctx.telegraphCircle(ox, oy, a.radius ?? 70, a.telegraph, () => {});
        }
        break;
      case 'spore_fan':
        this.scene.time.delayedCall(a.telegraph, () => {
          if (this.active) ctx.shootFan(this.x, this.y, p.x, p.y, a.count ?? 8, this.dmg * (a.dmgMult ?? 0.6), this.def.element);
        });
        break;
      case 'summon_adds':
        this.scene.time.delayedCall(a.telegraph, () => {
          if (this.active) ctx.summonAdds(this.x, this.y, a.count ?? 3);
        });
        break;
    }
  }

  kill(): void {
    this.disableBody(true, true);
    this.setActive(false).setVisible(false);
  }
}
