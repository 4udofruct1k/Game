import Phaser from 'phaser';
import { rollStart, randomSeedText, type StartLoadout } from '../core/startRoll';
import { Run, setCurrentRun } from '../core/run';
import { computeLevelCap } from '../core/progression';
import { RARITY_COLORS } from '../data/theme';
import { RARITY_NAMES, RARITY_MULT, CLASS_POWER_MULT } from '../data/rarity';
import { ELEMENT_NAMES } from '../data/elements';
import { CLASS_STATS, CLASS_ABILITIES, CLASS_EVOLUTIONS } from '../data/classes';
import { WEAPON_ARCHETYPES } from '../data/weapons';
import { listWorlds, listRecords, deleteWorld } from '../core/save';
import { BASE_W } from '../data/balance';
import { centerUICamera, addFullscreenButton, requestFullscreenOnFirstTap } from '../ui/layout';

export class StartRollScene extends Phaser.Scene {
  private current!: StartLoadout;
  private seedText = '';
  private panelTexts: Phaser.GameObjects.Text[] = [];
  private descText!: Phaser.GameObjects.Text;
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
    this.buildDescriptionPanel();
    this.buildWorldsRecords();

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
    this.add.rectangle(x - 20, y0 - 16, 450, rowH * this.labels.length + 24, 0x141420).setOrigin(0, 0);
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
    const y = 110 + 34 * this.labels.length + 16;
    this.makeButton(40, y, 'КРУТИТЬ 🎰', 0x394b8a, () => this.spin());
    this.makeButton(196, y, 'НОВЫЙ СИД', 0x2a2a3f, () => {
      this.seedText = randomSeedText();
      this.current = rollStart(this.seedText);
      this.renderLoadout();
    });
    this.makeButton(352, y, 'В МИР ▶', 0x2f7a3a, () => this.startWorld());
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    color: number,
    cb: () => void,
    w = 148,
    h = 50,
  ): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, w, h, color).setStrokeStyle(2, 0x6a6a9a);
    const txt = this.add
      .text(0, 0, label, { fontFamily: 'system-ui', fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
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
    set(2, `${l.weapon.name} [${RARITY_NAMES[l.weapon.rarity]}]`, l.weapon.rarity);
    set(3, l.element === 'none' ? 'нет' : ELEMENT_NAMES[l.element]);
    set(4, `${l.blessing.name} [${RARITY_NAMES[l.blessing.rarity]}]`, l.blessing.rarity);
    set(5, l.curse ? `${l.curse.name} [${RARITY_NAMES[l.curse.rarity]}]` : '—', l.curse?.rarity);
    set(6, l.relic ? `${l.relic.name} [${RARITY_NAMES[l.relic.rarity]}]` : '—', l.relic?.rarity);
    set(7, `${l.race.name} [${RARITY_NAMES[l.race.rarity]}]`, l.race.rarity);
    set(8, spinning ? '??' : `${computeLevelCap(l)} (сид: ${l.seedText})`);
    this.updateDescription(spinning);
  }

  // Панель справа: подробное описание того, что выпало.
  private buildDescriptionPanel(): void {
    const x = 512;
    const y = 104;
    const w = 424;
    const h = 392;
    this.add.rectangle(x, y, w, h, 0x141420).setOrigin(0, 0).setStrokeStyle(1, 0x2a2a3f);
    this.add.text(x + 14, y + 10, 'ЧТО ВЫПАЛО', { fontFamily: 'system-ui', fontSize: '15px', color: '#f0c040' });
    this.descText = this.add.text(x + 14, y + 36, '', {
      fontFamily: 'system-ui',
      fontSize: '12.5px',
      color: '#dfe0ee',
      lineSpacing: 3,
      wordWrap: { width: w - 28 },
    });
  }

  private updateDescription(spinning = false): void {
    if (!this.descText) return;
    if (spinning) {
      this.descText.setText('...');
      return;
    }
    const l = this.current;
    const cls = CLASS_STATS[l.classId];
    const ab = CLASS_ABILITIES[l.classId];
    const ev = CLASS_EVOLUTIONS[l.classId] ?? [cls.name];
    const arch = WEAPON_ARCHETYPES[l.weapon.archetype];
    const avT1 = (arch.archBase * RARITY_MULT[l.weapon.rarity]).toFixed(1);
    const pow = CLASS_POWER_MULT[l.classRarity].toFixed(2);
    const pct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;
    const modLine = (m?: Record<string, number>): string => {
      if (!m) return '';
      const parts: string[] = [];
      const map: Record<string, (v: number) => string> = {
        dmgPct: (v) => `урон ${pct(v)}`,
        hpPct: (v) => `HP ${pct(v)}`,
        armor: (v) => `броня +${v}`,
        critChance: (v) => `крит ${pct(v)}`,
        moveSpeedPct: (v) => `скорость ${pct(v)}`,
        atkSpeedPct: (v) => `скор.атаки ${pct(v)}`,
        lifesteal: (v) => `вампиризм ${pct(v)}`,
        elemDmgPct: (v) => `урон стихией ${pct(v)}`,
        elemResPct: (v) => `сопр. ${pct(v)}`,
        luck: (v) => `Удача +${v}`,
        goldPct: (v) => `золото ${pct(v)}`,
        xpPct: (v) => `опыт ${pct(v)}`,
        cdrPct: (v) => `КД ${pct(-v)}`,
        armorPen: (v) => `пробитие ${pct(v)}`,
        dodge: (v) => `уворот ${pct(v)}`,
        dashCharges: (v) => `+${v} рывок`,
      };
      for (const k of Object.keys(m)) if (map[k]) parts.push(map[k](m[k]));
      return parts.join(', ');
    };

    const L: string[] = [];
    L.push(`◆ КЛАСС: ${cls.name} [${RARITY_NAMES[l.classRarity]}]  ×сила ${pow}`);
    if (ab) {
      L.push(`  Пассив: ${ab.passive}`);
      L.push(`  Навык: ${ab.skill}  ·  Ульта: ${ab.ult}`);
    }
    L.push(`  Статы: HP ×${cls.hp} · Урон ×${cls.dmg} · Ат.ск ×${cls.atkSpeed} · Моб ×${cls.mobility}`);
    L.push(`  Коэф: навык ×${cls.skillCoef}, ульта ×${cls.ultCoef}`);
    L.push(`  Эволюция: ${ev.slice(1).join(' → ')}`);
    L.push('');
    L.push(`◆ ОРУЖИЕ: ${l.weapon.name} [${RARITY_NAMES[l.weapon.rarity]}]`);
    L.push(`  ${arch.name} — ${arch.feature}`);
    L.push(`  AV(тир1) ${avT1} · урон ×${arch.atkSpeedMult < 1 ? '↑' : ''}, скор.атаки ×${arch.atkSpeedMult}, моб ×${arch.mobilityMult}`);
    if (l.weapon.affixText !== '—') L.push(`  Аффикс: ${l.weapon.affixText}`);
    L.push('');
    L.push(`◆ СТИХИЯ: ${l.element === 'none' ? 'нет' : ELEMENT_NAMES[l.element]}${l.element !== 'none' ? ' (инфузия → усиление/реакции)' : ''}`);
    L.push(`◆ РАСА: ${l.race.name} — ${l.race.desc}`);
    L.push(`◆ БЛАГО: ${l.blessing.name} — ${l.blessing.desc}`);
    if (l.curse) L.push(`◆ ПРОКЛЯТИЕ: ${l.curse.name} — ${l.curse.desc}`);
    if (l.relic) L.push(`◆ РЕЛИКВИЯ: ${l.relic.name} — ${l.relic.desc}`);
    L.push(`◆ Потенциал: ${l.potential}/20 (+${l.potential} к капу) · Кап уровня: ${computeLevelCap(l)}`);
    void modLine;
    this.descText.setText(L.join('\n'));
  }

  // Продолжить миры + рекорды (компактно, снизу).
  private buildWorldsRecords(): void {
    const yTop = 508;
    // миры
    this.add.text(46, yTop, 'ПРОДОЛЖИТЬ МИР', { fontFamily: 'system-ui', fontSize: '14px', color: '#f0c040' });
    const worlds = listWorlds().slice(0, 4);
    if (worlds.length === 0) {
      this.add.text(46, yTop + 22, 'нет сохранённых миров', { fontFamily: 'system-ui', fontSize: '12px', color: '#666' });
    }
    worlds.forEach((w, i) => {
      const y = yTop + 22 + i * 26;
      const label = `${CLASS_STATS[w.classId]?.name ?? w.classId} ур.${w.level} ${w.dead ? '☠' : ''}`;
      const t = this.add
        .text(46, y, label, { fontFamily: 'system-ui', fontSize: '13px', color: w.dead ? '#a05555' : '#8fd08f', backgroundColor: '#1a1a28', padding: { x: 6, y: 3 } })
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

    // рекорды
    this.add.text(500, yTop, 'РЕКОРДЫ', { fontFamily: 'system-ui', fontSize: '14px', color: '#f0c040' });
    const recs = listRecords().slice(0, 4);
    if (recs.length === 0) {
      this.add.text(500, yTop + 22, 'ещё нет клиров', { fontFamily: 'system-ui', fontSize: '12px', color: '#666' });
    }
    recs.forEach((r, i) => {
      const y = yTop + 22 + i * 24;
      const mins = Math.floor(r.timeMs / 60000);
      const secs = Math.floor((r.timeMs % 60000) / 1000);
      const status = r.victory ? '🏆' : '☠';
      this.add.text(
        500,
        y,
        `${status} ${CLASS_STATS[r.classId]?.name ?? r.classId} · ур.${r.level} · ${mins}:${secs
          .toString()
          .padStart(2, '0')} · боссов ${r.bossesKilled}`,
        { fontFamily: 'system-ui', fontSize: '12px', color: '#cfcfe0' },
      );
    });
  }

  private startWorld(): void {
    const run = new Run(this.current);
    setCurrentRun(run);
    run.persist();
    this.scene.start('Hub', { fromStart: true });
  }

}
