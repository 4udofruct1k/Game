import Phaser from 'phaser';
import { rollStart, randomSeedText, type StartLoadout } from '../core/startRoll';
import { Run, setCurrentRun } from '../core/run';
import { computeLevelCap } from '../core/progression';
import { RARITY_COLORS, ELEMENT_COLORS } from '../data/theme';
import { RARITY_NAMES, RARITY_MULT, CLASS_POWER_MULT } from '../data/rarity';
import { ELEMENT_NAMES } from '../data/elements';
import { CLASS_STATS, CLASS_ABILITIES, CLASS_EVOLUTIONS } from '../data/classes';
import { WEAPON_ARCHETYPES } from '../data/weapons';
import { listWorlds, listRecords, deleteWorld } from '../core/save';
import { BASE_W } from '../data/balance';
import { centerUICamera, addFullscreenButton, requestFullscreenOnFirstTap } from '../ui/layout';

interface Reel {
  items: Phaser.GameObjects.Text[];
  cy: number;
  itemH: number;
  winH: number;
  strip: Phaser.GameObjects.Container;
}

export class StartRollScene extends Phaser.Scene {
  private current!: StartLoadout;
  private seedText = '';
  private descText!: Phaser.GameObjects.Text;
  private spinning = false;
  private reels: Reel[] = [];
  private readonly reelLabels = ['Класс', 'Способность', 'Оружие', 'Стихия', 'Благо', 'Раса'];

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

    this.buildSlotMachine();
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

  // Слот-машина: горизонтальный корпус с вертикальными барабанами + рычаг.
  private buildSlotMachine(): void {
    const fx = 92, fy = 92, fw = 812, fh = 192;
    // корпус машины
    this.add.rectangle(fx - 6, fy - 6, fw + 12, fh + 12, 0x2a1c2e).setOrigin(0, 0).setStrokeStyle(3, 0xf0c040, 0.9);
    this.add.rectangle(fx, fy, fw, fh, 0x101018).setOrigin(0, 0);
    const cols = this.reelLabels.length;
    const pad = 8;
    const reelW = (fw - pad * 2) / cols;
    const innerW = reelW - 8;
    const winH = fh - 16;
    const cy = fy + fh / 2;
    const itemH = winH / 3;
    for (let i = 0; i < cols; i++) {
      const cx = fx + pad + i * reelW + reelW / 2;
      // окно барабана
      this.add.rectangle(cx, cy, innerW, winH, i % 2 ? 0x191922 : 0x14141d).setStrokeStyle(1, 0x3a3a52);
      const items: Phaser.GameObjects.Text[] = [];
      const strip = this.add.container(cx, 0);
      for (let k = 0; k < 11; k++) {
        const t = this.add.text(0, k * itemH, '', {
          fontFamily: 'system-ui', fontSize: '13px', color: '#e8e8f0', fontStyle: 'bold',
          align: 'center', wordWrap: { width: innerW - 6 },
        }).setOrigin(0.5);
        items.push(t);
        strip.add(t);
      }
      this.reels.push({ items, cy, itemH, winH, strip });
      // подпись барабана
      this.add.text(cx, fy + fh + 6, this.reelLabels[i], { fontFamily: 'system-ui', fontSize: '12px', color: '#9a9ab0' }).setOrigin(0.5, 0);
    }
    // линия выигрыша (центр)
    this.add.rectangle(fx, cy, fw, 2, 0xf0c040, 0.35).setOrigin(0, 0.5);
    // рычаг — крепится к правому боку корпуса (кронштейн + ось), ручка сверху
    const lx = fx + fw + 6, ly = cy + 40;
    this.add.rectangle(lx - 8, ly - 18, 26, 36, 0x2a1c2e).setOrigin(0, 0).setStrokeStyle(2, 0xf0c040, 0.9); // кронштейн на корпусе
    this.add.circle(lx + 5, ly, 6, 0x5a3a2a).setStrokeStyle(2, 0x2a1c2e); // ось
    const rod = this.add.rectangle(0, 0, 11, 96, 0x8a5a3a).setStrokeStyle(2, 0x5a3a2a).setOrigin(0.5, 1);
    const knob = this.add.circle(0, -96, 15, 0xd83a3a).setStrokeStyle(2, 0xffe0a0, 0.8);
    this.lever = this.add.container(lx + 5, ly, [rod, knob]);
  }

  private lever!: Phaser.GameObjects.Container;

  // Значение барабана i из лоадаута: текст + цвет по редкости.
  private reelValue(l: StartLoadout, i: number): { text: string; color: string } {
    const rc = (r: keyof typeof RARITY_COLORS) => '#' + RARITY_COLORS[r].toString(16).padStart(6, '0');
    switch (i) {
      case 0: return { text: CLASS_STATS[l.classId].name, color: rc(l.classRarity) };
      case 1: return { text: CLASS_ABILITIES[l.classId]?.skill ?? l.abilitySkill, color: '#dfe0ee' };
      case 2: return { text: l.weapon.name, color: rc(l.weapon.rarity) };
      case 3: return { text: l.element === 'none' ? 'нет' : ELEMENT_NAMES[l.element], color: l.element === 'none' ? '#888' : (ELEMENT_COLORS[l.element] ? '#' + ELEMENT_COLORS[l.element].toString(16).padStart(6, '0') : '#dfe0ee') };
      case 4: return { text: l.blessing.name, color: rc(l.blessing.rarity) };
      case 5: return { text: l.race.name, color: rc(l.race.rarity) };
      default: return { text: '', color: '#fff' };
    }
  }

  // Поставить барабан статично на итоговое значение (центр).
  private setReelStatic(i: number, l: StartLoadout): void {
    const r = this.reels[i];
    const v = this.reelValue(l, i);
    const kc = 5;
    // центр = итог (ярко), соседи — случайные значения (тускло), чтобы было
    // непонятно, что рядом на барабане
    r.items.forEach((t, k) => {
      if (k === kc) {
        t.setText(v.text).setColor(v.color).setAlpha(1);
      } else {
        const rv = this.reelValue(rollStart(randomSeedText()), i);
        t.setText(rv.text).setColor(rv.color).setAlpha(0.32);
      }
    });
    r.strip.y = r.cy - kc * r.itemH;
    this.clipReel(r);
  }

  // Прячем элементы вне окна барабана (замена маске — она сбивается камерой).
  private clipReel(r: Reel): void {
    for (let k = 0; k < r.items.length; k++) {
      const worldY = r.strip.y + k * r.itemH;
      r.items[k].setVisible(Math.abs(worldY - r.cy) <= r.winH / 2 + 2);
    }
  }

  private buildButtons(): void {
    const y = 312;
    this.makeButton(92, y, 'КРУТИТЬ 🎰', 0x394b8a, () => this.spin());
    this.makeButton(258, y, 'НОВЫЙ СИД', 0x2a2a3f, () => {
      this.seedText = randomSeedText();
      this.current = rollStart(this.seedText);
      this.renderLoadout();
    });
    this.makeButton(424, y, 'В МИР ▶', 0x2f7a3a, () => this.startWorld());
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
    this.seedText = randomSeedText();
    const final = rollStart(this.seedText);
    this.pullLever();
    this.updateDescription(true);
    let stopped = 0;
    const total = this.reels.length;
    this.reels.forEach((r, i) => {
      // барабан крутится сверху вниз; последний элемент = итог, лендинг по центру
      const N = r.items.length;
      const kc = N - 1;
      r.items.forEach((t, k) => {
        const v = this.reelValue(k === kc ? final : rollStart(randomSeedText()), i);
        t.setText(v.text).setColor(v.color).setAlpha(1);
      });
      r.strip.y = r.cy; // показываем item 0 сверху
      this.tweens.add({
        targets: r.strip,
        y: r.cy - kc * r.itemH, // прокрутка до итога
        duration: 900 + i * 260,
        ease: 'Cubic.easeOut',
        onUpdate: () => this.clipReel(r),
        onComplete: () => {
          // мигание фиксации
          const it = r.items[kc];
          it.setAlpha(0.35);
          this.tweens.add({ targets: it, alpha: 1, duration: 200 });
          stopped++;
          if (stopped >= total) {
            this.current = final;
            // проставить статично (кадр-в-кадр) и показать описание
            for (let j = 0; j < total; j++) this.setReelStatic(j, final);
            this.updateDescription(false);
            this.spinning = false;
          }
        },
      });
    });
  }

  // Рычаг слот-машины: дёргается вниз при спине.
  private pullLever(): void {
    if (!this.lever) return;
    this.tweens.killTweensOf(this.lever);
    this.lever.setAngle(-20);
    this.tweens.add({ targets: this.lever, angle: 20, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
  }

  private renderLoadout(spinning = false): void {
    for (let i = 0; i < this.reels.length; i++) this.setReelStatic(i, this.current);
    this.updateDescription(spinning);
  }

  // Панель справа: подробное описание того, что выпало.
  private buildDescriptionPanel(): void {
    const x = 40;
    const y = 372;
    const w = 590;
    const h = 250;
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

  // Продолжить миры + рекорды (правая колонка).
  private buildWorldsRecords(): void {
    const cx = 656;
    const yTop = 372;
    // миры
    this.add.text(cx, yTop, 'ПРОДОЛЖИТЬ МИР', { fontFamily: 'system-ui', fontSize: '14px', color: '#f0c040' });
    const worlds = listWorlds().slice(0, 4);
    if (worlds.length === 0) {
      this.add.text(cx, yTop + 22, 'нет сохранённых миров', { fontFamily: 'system-ui', fontSize: '12px', color: '#666' });
    }
    worlds.forEach((w, i) => {
      const y = yTop + 22 + i * 26;
      const label = `${CLASS_STATS[w.classId]?.name ?? w.classId} ур.${w.level} ${w.dead ? '☠' : ''}`;
      const t = this.add
        .text(cx, y, label, { fontFamily: 'system-ui', fontSize: '13px', color: w.dead ? '#a05555' : '#8fd08f', backgroundColor: '#1a1a28', padding: { x: 6, y: 3 } })
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

    // рекорды (ниже миров в той же колонке)
    const recY = yTop + 22 + 4 * 26 + 14;
    this.add.text(cx, recY, 'РЕКОРДЫ', { fontFamily: 'system-ui', fontSize: '14px', color: '#f0c040' });
    const recs = listRecords().slice(0, 4);
    if (recs.length === 0) {
      this.add.text(cx, recY + 22, 'ещё нет клиров', { fontFamily: 'system-ui', fontSize: '12px', color: '#666' });
    }
    recs.forEach((r, i) => {
      const y = recY + 22 + i * 24;
      const mins = Math.floor(r.timeMs / 60000);
      const secs = Math.floor((r.timeMs % 60000) / 1000);
      const status = r.victory ? '🏆' : '☠';
      this.add.text(
        cx,
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
