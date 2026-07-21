import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StartRollScene } from './scenes/StartRollScene';
import { WorldScene } from './scenes/WorldScene';
import { HubScene } from './scenes/HubScene';
import { UIScene } from './scenes/UIScene';
import { MenuScene } from './scenes/MenuScene';
import { EndScene } from './scenes/EndScene';
import { COLORS } from './data/theme';
import { BASE_W, BASE_H } from './data/balance';

// Базовый размер: фиксированная высота, ширина подстраивается под соотношение
// экрана устройства — так канвас заполняет телефон почти без чёрных полос.
// UI-сцены центрируют свой контент (ширина верстки = BASE_W) сдвигом камеры.
function designWidth(): number {
  const aspect = window.innerWidth / window.innerHeight;
  return Math.round(Phaser.Math.Clamp(BASE_H * aspect, BASE_W, 1700));
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: designWidth(),
    height: BASE_H,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  scene: [BootScene, StartRollScene, WorldScene, HubScene, UIScene, MenuScene, EndScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
