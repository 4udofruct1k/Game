import Phaser from 'phaser';
import { rollStart, randomSeedText, type StartLoadout } from '../core/startRoll';
import { Run, setCurrentRun } from '../core/run';
import { computeLevelCap } from '../core/progression';
import { RARITY_COLORS } from '../data/theme';
import { RARITY_NAMES } from '../data/rarity';
import { ELEMENT_NAMES } from '../data/elements';
import { CLASS_STATS, CLASS_ABILITIES } from '../data/classes';
import { WEAPON_ARCHETYPES } from '../data/weapons';
import { listWorlds, listRecords, deleteWorld } from '../core/save';
import { BASE_W } from '../data/balance';
import { centerUICamera, addFullscreenButton, requestFullscreenOnFirstTap } from '../ui/layout';

export class StartRollScene extends Phaser.Scene {
  private current!: StartLoadout;
  private seedText = '';
  private panelTexts: Phaser.GameObjects.Text[] = [];
  private spinning = false;

  constructor() {
    super('StartRoll');
  }

  create(): void {
    const width = BASE_W;
    // фон на весь экран (не зависит от центрирования)
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0a0a12).setOrigin(0).setScrollFactor(0);
    this.add
      .text(width / 2, 34, 'ROGUE RINGS', {
        fontFamily: 'system-ui',
        fontSize: '34px',
        color: '#f0c040',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 66, 'экшн-рогалик · слот-машина судьбы', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#9a9ab0',
      })
      .setOrigin(0.5);

    this.buildRollPanel();
    this.buildButtons();
    this.buildSidePanels();

    this.seedText = randomSeedText();
    this.current = rollStart(this.seedText);
    this.renderLoadout();

    centerUICamera(this);
    addFullscreenButton(this);
    requestFullscreenOnFirstTap(this);
  }

  private labels = [
    'Класс',
    'Способность',
    'Оружие',
    'Стихия',
    'Благословение',
    'Проклятие',
    'Реликвия',
    'Раса',
    'Кап уровня',
  ];

  private buildRollPanel(): void {
    const x = 60;
    const y0 = 110;
    const rowH = 34;
    this.add.rectangle(x - 20, y0 - 16, 470, rowH * this.labels.length + 24, 0x141420).setOrigin(0, 0);
    this.labels.forEach((lab, i) => {
      this.add.text(x, y0 + i * rowH, lab, {
        fontFamily: 'system-ui',
        fontSize: '14px',
        color: '#9a9ab0',
      });
      const val = this.add.text(x + 150, y0 + i * rowH, '—', {
        fontFamily: 'system-ui',
        fontSize: '15px',
        color: '#e8e8f0',
        fontStyle: 'bold',
      });
      this.panelTexts.push(val);
    });
  }

  private buildButtons(): void {
    const y = 110 + 34 * this.labels.length + 18;
    this.makeButton(80, y, 'КРУТИТЬ 🎰', 0x394b8a, () => this.spin());
    this.makeButton(230, y, 'НОВЫЙ СИД', 0x2a2a3f, () => {
      this.seedText = randomSeedText();
      this.current = rollStart(this.seedText);
      this.renderLoadout();
    });
    this.makeButton(370, y, 'В МИР ▶', 0x2f7a3a, () => this.startWorld());
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    color: number,
    cb: () => void,
  ): Phaser.GameObjects.Container {
    const w = 130;
    const h = 40;
    const bg = this.add.rectangle(0, 0, w, h, color).setStrokeStyle(1, 0x555577);
    const txt = this.add
      .text(0, 0, label, { fontFamily: 'system-ui', fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5);
    const c = this.add.container(x + w / 2, y + h / 2, [bg, txt]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.IntegerToColor(color).lighten(15).color));
    c.on('pointerout', () => bg.setFillStyle(color));
    c.on('pointerdown', cb);
    return c;
  }

  private spin(): void {
    if (this.spinning) return;
    this.spinning = true;
    let ticks = 0;
    const timer = this.time.addEvent({
      delay: 60,
      repeat: 14,
      callback: () => {
        this.current = rollStart(randomSeedText());
        this.renderLoadout(true);
        ticks++;
        if (timer.getRepeatCount() === 0) {
          this.seedText = randomSeedText();
          this.current = rollStart(this.seedText);
          this.renderLoadout();
          this.spinning = false;
        }
      },
    });
    void ticks;
  }

  private renderLoadout(spinning = false): void {
    const l = this.current;
    const cls = CLASS_STATS[l.classId];
    const ab = CLASS_ABILITIES[l.classId];
    const set = (i: number, text: string, rarity?: keyof typeof RARITY_COLORS) => {
      const t = this.panelTexts[i];
      t.setText(text);
      t.setColor(rarity ? '#' + RARITY_COLORS[rarity].toString(16).padStart(6, '0') : '#e8e8f0');
    };
    set(0, `${cls.name} [${RARITY_NAMES[l.classRarity]}]`, l.classRarity);
    set(1, ab?.skill ?? l.abilitySkill);
    set(
      2,
      `${l.weapon.name} (${WEAPON_ARCHETYPES[l.weapon.archetype].name}) [${RARITY_NAMES[l.weapon.rarity]}]`,
      l.weapon.rarity,
    );
    set(3, l.element === 'none' ? 'нет' : ELEMENT_NAMES[l.element]);
    set(4, `${l.blessing.name} [${RARITY_NAMES[l.blessing.rarity]}]`, l.blessing.rarity);
    set(5, l.curse ? `${l.curse.name} [${RARITY_NAMES[l.curse.rarity]}]` : '—', l.curse?.rarity);
    set(6, l.relic ? `${l.relic.name} [${RARITY_NAMES[l.relic.rarity]}]` : '—', l.relic?.rarity);
    set(7, `${l.race.name} [${RARITY_NAMES[l.race.rarity]}]`, l.race.rarity);
    set(8, spinning ? '??' : `${computeLevelCap(l)} (сид: ${l.seedText})`);
  }

  private startWorld(): void {
    const run = new Run(this.current);
    setCurrentRun(run);
    run.persist();
    this.scene.start('Hub', { fromStart: true });
  }

  // Боковая панель: продолжить миры + рекорды.
  private buildSidePanels(): void {
    const x = 560;
    this.add.text(x, 96, 'ПРОДОЛЖИТЬ МИР', { fontFamily: 'system-ui', fontSize: '15px', color: '#f0c040' });
    const worlds = listWorlds().slice(0, 5);
    if (worlds.length === 0) {
      this.add.text(x, 122, 'нет сохранённых миров', { fontFamily: 'system-ui', fontSize: '12px', color: '#666' });
    }
    worlds.forEach((w, i) => {
      const y = 122 + i * 30;
      const label = `${CLASS_STATS[w.classId]?.name ?? w.classId} ур.${w.level} ${w.dead ? '☠' : ''}`;
      const t = this.add
        .text(x, y, label, { fontFamily: 'system-ui', fontSize: '13px', color: w.dead ? '#a05555' : '#8fd08f' })
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        if (w.dead) {
          deleteWorld(w.id);
          this.scene.restart();
          return;
        }
        const run = Run.fromSave(w.id);
        if (run) {
          setCurrentRun(run);
          this.scene.start('Hub', { fromStart: false });
        }
      });
    });

    this.add.text(x, 300, 'РЕКОРДЫ', { fontFamily: 'system-ui', fontSize: '15px', color: '#f0c040' });
    const recs = listRecords().slice(0, 6);
    if (recs.length === 0) {
      this.add.text(x, 326, 'ещё нет клиров', { fontFamily: 'system-ui', fontSize: '12px', color: '#666' });
    }
    recs.forEach((r, i) => {
      const y = 326 + i * 24;
      const mins = Math.floor(r.timeMs / 60000);
      const secs = Math.floor((r.timeMs % 60000) / 1000);
      const status = r.victory ? '🏆' : '☠';
      this.add.text(
        x,
        y,
        `${status} ${CLASS_STATS[r.classId]?.name ?? r.classId} · ур.${r.level} · ${mins}:${secs
          .toString()
          .padStart(2, '0')} · боссов ${r.bossesKilled}`,
        { fontFamily: 'system-ui', fontSize: '12px', color: '#cfcfe0' },
      );
    });
  }
}
