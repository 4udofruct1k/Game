import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StartRollScene } from './scenes/StartRollScene';
import { WorldScene } from './scenes/WorldScene';
import { HubScene } from './scenes/HubScene';
import { UIScene } from './scenes/UIScene';
import { MenuScene } from './scenes/MenuScene';
import { EndScene } from './scenes/EndScene';
import { COLORS } from './data/theme';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 640,
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
