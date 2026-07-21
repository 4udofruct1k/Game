import Phaser from 'phaser';
import { getCurrentRun, clearCurrentRun } from '../core/run';
import { addRecord, deleteWorld } from '../core/save';
import { CLASS_STATS } from '../data/classes';
import { RARITY_NAMES } from '../data/rarity';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(data: { victory: boolean }): void {
    const run = getCurrentRun();
    const { width, height } = this.scale;
    const victory = !!data?.victory;

    this.add.rectangle(width / 2, height / 2, width, height, victory ? 0x0c1810 : 0x180c0c);

    // записать рекорд
    addRecord({
      classId: run.loadout.classId,
      classRarity: run.loadout.classRarity,
      timeMs: run.playtimeMs,
      level: run.levelState.level,
      bossesKilled: run.bossesKilled.length,
      seedText: run.loadout.seedText,
      date: Date.now(),
      victory,
    });
    // пермадеч: мир стирается при смерти
    if (!victory) {
      run.persist(true);
      deleteWorld(run.worldId);
    } else {
      run.persist(false);
    }

    this.add
      .text(width / 2, 100, victory ? '🏆 ДЕМО-ПОБЕДА' : '☠ СМЕРТЬ', {
        fontFamily: 'system-ui',
        fontSize: '46px',
        color: victory ? '#8fe0a0' : '#e08080',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 150, victory ? 'Древо-Страж повержен — кольцо 1 зачищено (срез демо).' : 'Мир стёрт (пермадеч). Прогресс между мирами не копится.', {
        fontFamily: 'system-ui',
        fontSize: '14px',
        color: '#c0c0d0',
      })
      .setOrigin(0.5);

    const mins = Math.floor(run.playtimeMs / 60000);
    const secs = Math.floor((run.playtimeMs % 60000) / 1000);
    const cls = CLASS_STATS[run.loadout.classId];
    const lines = [
      `Класс: ${cls.name} [${RARITY_NAMES[run.loadout.classRarity]}]`,
      `Уровень: ${run.levelState.level} / ${run.levelCap}`,
      `Боссов убито: ${run.bossesKilled.length}`,
      `Чистое время: ${mins}:${secs.toString().padStart(2, '0')}`,
      `Сид: ${run.loadout.seedText}`,
    ];
    this.add.text(width / 2, 210, lines.join('\n'), { fontFamily: 'system-ui', fontSize: '16px', color: '#dfe0ee', align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0);

    const btn = this.add
      .text(width / 2, height - 80, 'В ГЛАВНОЕ МЕНЮ', { fontFamily: 'system-ui', fontSize: '18px', color: '#fff', backgroundColor: '#2f5a8a', padding: { x: 20, y: 10 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      clearCurrentRun();
      this.scene.start('StartRoll');
    });
  }
}
