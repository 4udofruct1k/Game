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
