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
  private readonly radius = 94;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const w = scene.scale.width;
    const h = scene.scale.height;

    // до 3 одновременных касаний (стик + кнопки)
    scene.input.addPointer(2);

    this.joyBase = scene.add.circle(0, 0, this.radius, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.25).setDepth(50).setVisible(false).setScrollFactor(0);
    this.joyThumb = scene.add.circle(0, 0, this.radius * 0.42, 0xffffff, 0.22).setDepth(51).setVisible(false).setScrollFactor(0);

    // Кнопки действий (низ-право) — крупные, с рисованными иконками и подписью.
    this.actionButton(w - 96, h - 100, 60, 'icon_dash', 'Рывок', 0x3a5a8a, () => (touch.dash = true));
    this.actionButton(w - 214, h - 132, 52, 'icon_skill', 'Навык', 0x2f6a3a, () => (touch.skill = true));
    this.actionButton(w - 158, h - 224, 52, 'icon_ult', 'Ульта', 0x7a3a8a, () => (touch.ult = true));
    this.actionButton(w - 96, h - 220, 48, 'icon_heal', 'Хилка', 0x2f7a5a, () => (touch.heal = true));

    // Кнопки хаб/меню (верх-право под золотом).
    this.actionButton(w - 54, 162, 34, 'icon_hub', '', 0x394b8a, () => (touch.hub = true));
    this.actionButton(w - 54, 238, 34, 'icon_menu', '', 0x2a2a3f, () => (touch.menu = true));

    // Обработка джойстика.
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private actionButton(x: number, y: number, r: number, iconKey: string, label: string, color: number, press: () => void): void {
    const c = this.scene.add.circle(x, y, r, color, 0.55).setStrokeStyle(3, 0xffffff, 0.35).setDepth(50).setScrollFactor(0);
    // рисованная иконка (фолбэк на текст-метку, если текстуры нет)
    if (this.scene.textures.exists(iconKey)) {
      this.scene.add.image(x, y, iconKey).setScale((r * 1.1) / 96).setDepth(51).setScrollFactor(0);
    } else {
      this.scene.add.text(x, y, iconKey, { fontFamily: 'system-ui', fontSize: `${Math.round(r * 0.7)}px`, color: '#fff' }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    }
    if (label) {
      this.scene.add.text(x, y + r + 2, label, { fontFamily: 'system-ui', fontSize: '13px', color: '#e8ecff', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(51).setScrollFactor(0).setShadow(1, 1, '#000', 2);
    }
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
