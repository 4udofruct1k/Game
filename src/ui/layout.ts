import Phaser from 'phaser';
import { BASE_W } from '../data/balance';

// Центрирует контент UI-сцены (сверстанной под ширину BASE_W) внутри
// динамически широкого канваса — сдвигом камеры. Ввод учитывает сдвиг.
export function centerUICamera(scene: Phaser.Scene): void {
  const ox = Math.round((scene.scale.width - BASE_W) / 2);
  if (ox > 0) scene.cameras.main.setScroll(-ox, 0);
}

// Кнопка «на весь экран» (прячет панель браузера на телефоне). Фиксирована к экрану.
export function addFullscreenButton(scene: Phaser.Scene): void {
  const x = scene.scale.width - 26;
  const y = 22;
  const btn = scene.add
    .text(x, y, '⛶', { fontFamily: 'system-ui', fontSize: '22px', color: '#9aa0c0' })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(1000)
    .setInteractive({ useHandCursor: true });
  btn.on('pointerup', () => toggleFullscreen(scene));
}

// Красивая кнопка: скруглённый корпус, верхний блик-бевел, рамка, тень,
// жирный текст, состояния наведения/нажатия. Возвращает контейнер [g, txt].
export function styledButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  color: number,
  cb: () => void,
  fontSize?: number,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const rad = Math.min(12, h / 2);
  const draw = (c: number, pressed: boolean) => {
    const dy = pressed ? 2 : 0;
    g.clear();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, rad); // тень
    g.fillStyle(c, 1).fillRoundedRect(-w / 2, -h / 2 + dy, w, h, rad); // корпус
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 3, -h / 2 + 3 + dy, w - 6, h * 0.42, rad - 3); // блик сверху
    g.lineStyle(2, 0xffffff, 0.4).strokeRoundedRect(-w / 2, -h / 2 + dy, w, h, rad); // рамка
  };
  draw(color, false);
  const fs = fontSize ?? (h >= 40 ? 16 : 12);
  const txt = scene.add
    .text(0, 0, label, { fontFamily: 'system-ui', fontSize: `${fs}px`, color: '#ffffff', fontStyle: 'bold', align: 'center' })
    .setOrigin(0.5)
    .setShadow(1, 1, '#00000088', 3);
  const c = scene.add.container(cx, cy, [g, txt]).setSize(w, h).setInteractive({ useHandCursor: true });
  const lit = Phaser.Display.Color.IntegerToColor(color).lighten(16).color;
  c.on('pointerover', () => draw(lit, false));
  c.on('pointerout', () => { draw(color, false); txt.setY(0); });
  c.on('pointerdown', () => { draw(color, true); txt.setY(2); cb(); });
  c.on('pointerup', () => { draw(lit, false); txt.setY(0); });
  return c;
}

export function toggleFullscreen(scene: Phaser.Scene): void {
  if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
  else scene.scale.startFullscreen();
}

// На первом касании (мобилки) — запросить полноэкранный режим один раз.
export function requestFullscreenOnFirstTap(scene: Phaser.Scene): void {
  if (!scene.sys.game.device.input.touch) return;
  const once = () => {
    if (!scene.scale.isFullscreen) {
      try {
        scene.scale.startFullscreen();
      } catch {
        /* некоторые браузеры требуют иной жест — игнор */
      }
    }
  };
  scene.input.once('pointerdown', once);
}
