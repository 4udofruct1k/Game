import Phaser from 'phaser';
import { getCurrentRun } from '../core/run';
import { HEALS, type HealKind } from '../data/items';
import { armorPrice, enchantCost, REROLL_COST } from '../core/economy';
import { ARMOR_SLOTS, ARMOR_SLOT_NAMES, CLASS_SETS, type ArmorSlot } from '../data/armor';
import { nativeWeight } from '../core/stats';
import { ENCHANT_MAX } from '../data/balance';
import { RARITY_NAMES, RARITY_ORDER, type Rarity } from '../data/rarity';
import { RARITY_COLORS } from '../data/theme';
import { BASE_W, BASE_H } from '../data/balance';
import { centerUICamera, addFullscreenButton, styledButton } from '../ui/layout';

export class HubScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private rows: { refresh: () => void }[] = [];

  constructor() {
    super('Hub');
  }

  create(): void {
    const run = getCurrentRun();
    const width = BASE_W;
    const height = BASE_H;
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x10131f).setOrigin(0).setScrollFactor(0);
    this.add.text(width / 2, 24, 'ХАБ-ГОРОД · безопасная зона', { fontFamily: 'system-ui', fontSize: '22px', color: '#8fb0e0' }).setOrigin(0.5);
    this.goldText = this.add.text(width - 20, 20, '', { fontFamily: 'system-ui', fontSize: '16px', color: '#f0c040' }).setOrigin(1, 0);
    this.msgText = this.add.text(width / 2, height - 60, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#9fe0a0' }).setOrigin(0.5);

    this.rows = [];
    this.buildHealShop(40, 70);
    this.buildArmorShop(360, 70);
    this.buildSmith(680, 70);

    this.makeButton(width / 2 - 110, height - 54, 300, 46, '◀ В МИР (кольцо 1)', 0x2f7a3a, () => {
      run.persist();
      this.scene.start('World');
    });
    this.makeButton(20, height - 54, 150, 46, 'Меню (статы)', 0x2a2a3f, () => {
      this.scene.launch('Menu', { from: 'Hub' });
      this.scene.pause();
    });

    this.refresh();

    centerUICamera(this);
    addFullscreenButton(this);
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
      this.add.image(x + 12, yy + 10, 'item_' + k).setOrigin(0.5).setScale(0.22);
      const label = this.add.text(x + 30, yy, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#e0e0ee' });
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
      const armorIcon = this.add.image(x + 11, yy + 7, 'armor_' + slot).setOrigin(0.5).setScale(0.22);
      const label = this.add.text(x + 28, yy, '', { fontFamily: 'system-ui', fontSize: '12px', color: '#e0e0ee' });
      // цена/редкость следующей покупки — на ступень выше текущей
      const nextRarity = (): Rarity => {
        const eq = run.build.armor[slot];
        const idx = eq ? Math.min(5, RARITY_ORDER.indexOf(eq.rarity) + 1) : Math.min(5, run.bossesKilled.length);
        return RARITY_ORDER[idx];
      };
      const btn = this.makeButton(x + 200, yy - 4, 96, 26, '', 0x394b8a, () => {
        const rar = nextRarity();
        const eq = run.build.armor[slot];
        if (eq && RARITY_ORDER.indexOf(eq.rarity) >= 5) { this.flash('Уже мифическая'); return; }
        const price = armorPrice(run.bossesKilled.length + 1, rar);
        if (run.wallet.gold >= price) {
          run.wallet.gold -= price;
          // новая броня начинается с чистого зачара — эффекты старой не переносятся
          run.equipArmor(slot, { setId, slot, rarity: rar, weight, tier: run.bossesKilled.length + 1, enchant: 0 });
          this.flash(`${ARMOR_SLOT_NAMES[slot]}: ${RARITY_NAMES[rar]}`);
          this.refresh();
        } else this.flash('Мало золота');
      });
      const btnLabel = (btn.list[1] as Phaser.GameObjects.Text);
      this.rows.push({
        refresh: () => {
          const eq = run.build.armor[slot];
          label.setText(`${ARMOR_SLOT_NAMES[slot]} ${eq ? `[${RARITY_NAMES[eq.rarity]}] +${eq.enchant}` : '(пусто)'}`);
          label.setColor(eq ? '#8fd08f' : '#999');
          armorIcon.setTint(eq ? (RARITY_COLORS[eq.rarity] ?? 0xffffff) : 0x888888);
          const maxed = eq && RARITY_ORDER.indexOf(eq.rarity) >= 5;
          btnLabel.setText(maxed ? 'макс' : `${armorPrice(run.bossesKilled.length + 1, nextRarity())}⦿`);
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

    this.makeButton(x, y + 108, 220, 30, 'Зачаровать оружие (эффект)', 0x7a5a2a, () => {
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

    this.makeButton(x, y + 146, 220, 30, `Зачаровать броню (эффект) (${REROLL_COST.gold}⦿ + пыль)`, 0x394b8a, () => {
      const equipped = Object.values(run.build.armor).filter(Boolean);
      if (equipped.length === 0) { this.flash('Сначала надень броню'); return; }
      if (run.wallet.gold >= REROLL_COST.gold && run.wallet.rerollDust >= REROLL_COST.dust) {
        run.wallet.gold -= REROLL_COST.gold;
        run.wallet.rerollDust -= REROLL_COST.dust;
        for (const p of equipped) if (p && p.enchant < ENCHANT_MAX) p.enchant += 1;
        this.flash('Вся броня зачарована +1');
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
    return styledButton(this, x + w / 2, y + h / 2, w, h, label, color, cb);
  }
}
