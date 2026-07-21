import Phaser from 'phaser';
import { touch, resetTouchMove } from '../core/touchInput';

// Экранные сенсорные контролы: плавающий джойстик слева + кнопки действий справа.
// Рендерятся поверх HUD (в UIScene). Пишут в синглтон touch.
export class TouchControls {
  private scene: Phaser.Scene;
  private joyBase: Phaser.GameObjects.Arc;
  private joyThumb: Phaser.GameObjects.Arc;
  private joyPointerId = -1;
  private joyOrigin = new Phaser.Math.Vector2();
  private readonly radius = 72;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const w = scene.scale.width;
    const h = scene.scale.height;

    // до 3 одновременных касаний (стик + кнопки)
    scene.input.addPointer(2);

    this.joyBase = scene.add.circle(0, 0, this.radius, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.25).setDepth(50).setVisible(false).setScrollFactor(0);
    this.joyThumb = scene.add.circle(0, 0, this.radius * 0.42, 0xffffff, 0.22).setDepth(51).setVisible(false).setScrollFactor(0);

    // Кнопки действий (низ-право) — крупные для пальцев.
    this.actionButton(w - 74, h - 82, 46, 'РЫВ', 0x3a5a8a, () => (touch.dash = true));
    this.actionButton(w - 162, h - 128, 42, 'J', 0x2f6a3a, () => (touch.skill = true));
    this.actionButton(w - 190, h - 56, 40, 'K', 0x7a3a8a, () => (touch.ult = true));
    this.actionButton(w - 74, h - 178, 40, 'H', 0x2f7a5a, () => (touch.heal = true));

    // Кнопки хаб/меню (верх-право под золотом).
    this.actionButton(w - 46, 132, 30, 'E', 0x394b8a, () => (touch.hub = true));
    this.actionButton(w - 46, 200, 30, '≡', 0x2a2a3f, () => (touch.menu = true));

    // Обработка джойстика.
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private actionButton(x: number, y: number, r: number, label: string, color: number, press: () => void): void {
    const c = this.scene.add.circle(x, y, r, color, 0.55).setStrokeStyle(2, 0xffffff, 0.3).setDepth(50).setScrollFactor(0);
    this.scene.add.text(x, y, label, { fontFamily: 'system-ui', fontSize: `${Math.round(r * 0.7)}px`, color: '#ffffff' }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', (p: Phaser.Input.Pointer) => {
      touch.enabled = true;
      press();
      c.setFillStyle(color, 0.9);
      // помечаем этот указатель как «занятый кнопкой», чтобы не стартовал джойстик
      (p as Phaser.Input.Pointer & { _btn?: boolean })._btn = true;
    });
    c.on('pointerup', () => c.setFillStyle(color, 0.55));
    c.on('pointerout', () => c.setFillStyle(color, 0.55));
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if ((pointer as Phaser.Input.Pointer & { _btn?: boolean })._btn) return;
    // джойстик — только левая половина и не в самом верху
    if (pointer.x > this.scene.scale.width * 0.55) return;
    if (this.joyPointerId !== -1) return;
    touch.enabled = true;
    this.joyPointerId = pointer.id;
    this.joyOrigin.set(pointer.x, pointer.y);
    this.joyBase.setPosition(pointer.x, pointer.y).setVisible(true);
    this.joyThumb.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.joyPointerId) return;
    const dx = pointer.x - this.joyOrigin.x;
    const dy = pointer.y - this.joyOrigin.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.radius);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.joyThumb.setPosition(this.joyOrigin.x + nx * clamped, this.joyOrigin.y + ny * clamped);
    const dead = 0.15;
    if (len / this.radius > dead) {
      touch.moveX = nx;
      touch.moveY = ny;
      touch.moving = true;
    } else {
      resetTouchMove();
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    (pointer as Phaser.Input.Pointer & { _btn?: boolean })._btn = false;
    if (pointer.id !== this.joyPointerId) return;
    this.joyPointerId = -1;
    this.joyBase.setVisible(false);
    this.joyThumb.setVisible(false);
    resetTouchMove();
  }
}
