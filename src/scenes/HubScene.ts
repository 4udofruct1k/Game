import Phaser from 'phaser';
import { getCurrentRun } from '../core/run';
import { HEALS, type HealKind } from '../data/items';
import { armorPrice, enchantCost, REROLL_COST } from '../core/economy';
import { ARMOR_SLOTS, ARMOR_SLOT_NAMES, CLASS_SETS, type ArmorSlot } from '../data/armor';
import { nativeWeight } from '../core/stats';
import { ENCHANT_MAX } from '../data/balance';
import { RARITY_NAMES } from '../data/rarity';

export class HubScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private rows: { refresh: () => void }[] = [];

  constructor() {
    super('Hub');
  }

  create(): void {
    const run = getCurrentRun();
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x10131f);
    this.add.text(width / 2, 24, 'ХАБ-ГОРОД · безопасная зона', { fontFamily: 'system-ui', fontSize: '22px', color: '#8fb0e0' }).setOrigin(0.5);
    this.goldText = this.add.text(width - 20, 20, '', { fontFamily: 'system-ui', fontSize: '16px', color: '#f0c040' }).setOrigin(1, 0);
    this.msgText = this.add.text(width / 2, height - 60, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#9fe0a0' }).setOrigin(0.5);

    this.rows = [];
    this.buildHealShop(40, 70);
    this.buildArmorShop(360, 70);
    this.buildSmith(680, 70);

    this.makeButton(width / 2 - 70, height - 40, 260, 34, '◀ В МИР (кольцо 1)', 0x2f7a3a, () => {
      run.persist();
      this.scene.start('World');
    });
    this.makeButton(20, height - 40, 130, 34, 'Меню (статы)', 0x2a2a3f, () => {
      this.scene.launch('Menu', { from: 'Hub' });
      this.scene.pause();
    });

    this.refresh();
  }

  private section(x: number, y: number, title: string): void {
    this.add.text(x, y, title, { fontFamily: 'system-ui', fontSize: '15px', color: '#f0c040' });
  }

  private buildHealShop(x: number, y: number): void {
    this.section(x, y, 'ЗЕЛЬЯ');
    const kinds: HealKind[] = ['small_potion', 'big_potion', 'regen_flask', 'elixir'];
    kinds.forEach((k, i) => {
      const def = HEALS[k];
      const yy = y + 30 + i * 44;
      const label = this.add.text(x, yy, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#e0e0ee' });
      const btn = this.makeButton(x + 180, yy - 4, 90, 28, `${def.price}⦿`, 0x394b8a, () => {
        const run = getCurrentRun();
        if (run.wallet.gold >= def.price) {
          run.wallet.gold -= def.price;
          run.heals[k] += 1;
          this.flash(`Куплено: ${def.name}`);
          this.refresh();
        } else this.flash('Мало золота');
      });
      void btn;
      const row = {
        refresh: () => {
          const run = getCurrentRun();
          label.setText(`${def.name} ×${run.heals[k]}\n${def.desc}`);
        },
      };
      this.rows.push(row);
    });
  }

  private buildArmorShop(x: number, y: number): void {
    this.section(x, y, 'БРОНЯ (родной сет класса)');
    const run = getCurrentRun();
    const classId = run.loadout.classId;
    const set = CLASS_SETS[classId];
    const setId = set ? classId : 'warrior';
    const weight = nativeWeight(classId);
    ARMOR_SLOTS.forEach((slot: ArmorSlot, i) => {
      const yy = y + 30 + i * 38;
      const price = armorPrice(1, 'common');
      const label = this.add.text(x, yy, '', { fontFamily: 'system-ui', fontSize: '12px', color: '#e0e0ee' });
      this.makeButton(x + 210, yy - 4, 80, 26, `${price}⦿`, 0x394b8a, () => {
        if (run.wallet.gold >= price) {
          run.wallet.gold -= price;
          run.equipArmor(slot, { setId, slot, rarity: 'common', weight, tier: 1, enchant: 0 });
          this.flash(`Надето: ${ARMOR_SLOT_NAMES[slot]}`);
          this.refresh();
        } else this.flash('Мало золота');
      });
      this.rows.push({
        refresh: () => {
          const eq = run.build.armor[slot];
          label.setText(`${ARMOR_SLOT_NAMES[slot]} ${eq ? `[${RARITY_NAMES[eq.rarity]}] +${eq.enchant}` : '(пусто)'}`);
          label.setColor(eq ? '#8fd08f' : '#999');
        },
      });
    });
    if (set) {
      this.add.text(x, y + 30 + 6 * 38 + 6, `Сет: ${set.name}\n2: ${set.bonus2} · 4: ${set.bonus4}`, {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#9a9ab0',
        wordWrap: { width: 280 },
      });
    }
  }

  private buildSmith(x: number, y: number): void {
    this.section(x, y, 'КУЗНЕЦ-ЗАЧАРОВАТЕЛЬ');
    const run = getCurrentRun();
    const wLabel = this.add.text(x, y + 30, '', { fontFamily: 'system-ui', fontSize: '12px', color: '#e0e0ee', wordWrap: { width: 250 } });
    const costLabel = this.add.text(x, y + 84, '', { fontFamily: 'system-ui', fontSize: '12px', color: '#c0c0d0' });

    this.makeButton(x, y + 108, 220, 30, 'Зачаровать оружие (+тир)', 0x7a5a2a, () => {
      if (run.build.weaponEnchant >= ENCHANT_MAX) {
        this.flash('Максимальный тир зачара');
        return;
      }
      const cost = enchantCost(run.build.weaponEnchant + 1);
      if (run.wallet.gold >= cost.gold && run.wallet.shards >= cost.shards) {
        run.wallet.gold -= cost.gold;
        run.wallet.shards -= cost.shards;
        run.build.weaponEnchant += 1;
        this.flash(`Оружие зачаровано до +${run.build.weaponEnchant}`);
        this.refresh();
      } else this.flash('Не хватает золота/осколков');
    });

    this.makeButton(x, y + 146, 220, 30, `Реролл суб-статов (${REROLL_COST.gold}⦿ + пыль)`, 0x394b8a, () => {
      if (run.wallet.gold >= REROLL_COST.gold && run.wallet.rerollDust >= REROLL_COST.dust) {
        run.wallet.gold -= REROLL_COST.gold;
        run.wallet.rerollDust -= REROLL_COST.dust;
        this.flash('Суб-статы перекатаны');
        this.refresh();
      } else this.flash('Нужна пыль реролла');
    });

    const matLabel = this.add.text(x, y + 190, '', { fontFamily: 'system-ui', fontSize: '11px', color: '#9a9ab0' });

    this.rows.push({
      refresh: () => {
        wLabel.setText(`Оружие: ${run.loadout.weapon.name}\nзачар +${run.build.weaponEnchant}/${ENCHANT_MAX}`);
        const c = enchantCost(run.build.weaponEnchant + 1);
        costLabel.setText(`След. зачар: ${c.gold}⦿ + ${c.shards} осколков`);
        matLabel.setText(`Осколки: ${run.wallet.shards} · Пыль: ${run.wallet.rerollDust} · Ядра: ${run.wallet.bossCores}`);
      },
    });
  }

  private refresh(): void {
    const run = getCurrentRun();
    this.goldText.setText(`⦿ ${Math.floor(run.wallet.gold)}`);
    this.rows.forEach((r) => r.refresh());
  }

  private flash(text: string): void {
    this.msgText.setText(text);
    this.time.delayedCall(1600, () => this.msgText.setText(''));
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, color: number, cb: () => void): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, w, h, color).setStrokeStyle(1, 0x555577);
    const txt = this.add.text(0, 0, label, { fontFamily: 'system-ui', fontSize: '12px', color: '#fff' }).setOrigin(0.5);
    const c = this.add.container(x + w / 2, y + h / 2, [bg, txt]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.IntegerToColor(color).lighten(12).color));
    c.on('pointerout', () => bg.setFillStyle(color));
    c.on('pointerdown', cb);
    return c;
  }
}
