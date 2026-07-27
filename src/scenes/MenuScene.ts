import Phaser from 'phaser';
import { getCurrentRun, Run } from '../core/run';
import { TALENT_TREE, CLASS_SKILL_TREES, tierThreshold, type SkillTree, type SkillBranch } from '../data/skills';
import { CLASS_STATS, CLASS_ABILITIES } from '../data/classes';
import { RARITY_NAMES } from '../data/rarity';
import { RARITY_COLORS, ELEMENT_COLORS } from '../data/theme';
import { ELEMENT_NAMES } from '../data/elements';
import { ARMOR_SLOT_NAMES, type ArmorSlot } from '../data/armor';
import { HEALS, type HealKind } from '../data/items';
import { BASE_W, BASE_H } from '../data/balance';
import { centerUICamera } from '../ui/layout';

type Tab = 'stats' | 'talents' | 'skills' | 'inventory';

export class MenuScene extends Phaser.Scene {
  private from = 'World';
  private tab: Tab = 'stats';
  private container!: Phaser.GameObjects.Container;

  constructor() {
    super('Menu');
  }

  create(data: { from?: string }): void {
    this.from = data?.from ?? 'World';
    const width = BASE_W;
    const height = BASE_H;
    void height;
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x05060c, 0.92).setOrigin(0).setScrollFactor(0);
    this.add.text(width / 2, 20, 'МЕНЮ ПЕРСОНАЖА', { fontFamily: 'system-ui', fontSize: '20px', color: '#f0c040' }).setOrigin(0.5);

    const tabs: [Tab, string][] = [
      ['stats', 'Статы'],
      ['talents', 'Таланты'],
      ['skills', 'Навыки'],
      ['inventory', 'Инвентарь'],
    ];
    tabs.forEach(([id, label], i) => {
      const x = 60 + i * 130;
      const btn = this.add
        .text(x, 54, label, { fontFamily: 'system-ui', fontSize: '15px', color: '#cfd0e0', backgroundColor: '#20233a', padding: { x: 12, y: 6 } })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.tab = id;
        this.render();
      });
    });

    this.add
      .text(width - 60, 54, 'Закрыть (Esc)', { fontFamily: 'system-ui', fontSize: '14px', color: '#ff9a9a', backgroundColor: '#2a1520', padding: { x: 10, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());

    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.input.keyboard!.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.close();
    });

    this.container = this.add.container(0, 0);
    this.render();

    centerUICamera(this);
  }

  private close(): void {
    this.scene.stop('Menu');
    if (this.from === 'World') this.scene.resume('World');
    else this.scene.resume('Hub');
  }

  private render(): void {
    this.container.removeAll(true);
    const run = getCurrentRun();
    switch (this.tab) {
      case 'stats':
        this.renderStats(run);
        break;
      case 'talents':
        this.renderTree(run, TALENT_TREE, 'talent');
        break;
      case 'skills': {
        const tree = CLASS_SKILL_TREES[run.loadout.classId];
        if (tree) this.renderTree(run, tree, 'skill');
        else this.add.text(60, 100, 'Дерево навыков этого класса будет в след. батче.', { fontFamily: 'system-ui', fontSize: '14px', color: '#999' });
        break;
      }
      case 'inventory':
        this.renderInventory(run);
        break;
    }
  }

  private add2(obj: Phaser.GameObjects.GameObject): void {
    this.container.add(obj);
  }

  private renderStats(run: Run): void {
    const s = run.stats();
    const cls = CLASS_STATS[run.loadout.classId];
    const ab = CLASS_ABILITIES[run.loadout.classId];
    const l = run.loadout;
    const lines: string[] = [
      `Класс: ${cls.name} [${RARITY_NAMES[l.classRarity]}] · ступень эволюции ${run.build.evolutionStage} (×${s.evolutionMult.toFixed(2)})`,
      `Раса: ${l.race.name} · Стихия: ${l.element === 'none' ? 'нет' : ELEMENT_NAMES[l.element]}`,
      `Оружие: ${l.weapon.name} +${run.build.weaponEnchant} · ${l.weapon.affixText}`,
      `Благословение: ${l.blessing.name}${l.curse ? ` · Проклятие: ${l.curse.name}` : ''}${l.relic ? ` · Реликвия: ${l.relic.name}` : ''}`,
      '',
      `HP: ${Math.round(s.maxHP)}  ·  Реген: ${s.regen.toFixed(1)}/с`,
      `AV (сила атаки): ${s.av.toFixed(1)}`,
      `Множ. урона класса: ×${s.classDmgMult.toFixed(2)} · сила редкости: ×${s.classPowerMult.toFixed(2)}`,
      `Бонус урона: +${Math.round(s.pctBonuses * 100)}%  ·  навыки +${Math.round(s.skillDmgPct * 100)}%  ·  стихия +${Math.round(s.elemDmgPct * 100)}%`,
      `Крит: ${Math.round(s.critChance * 100)}% / ×${(1.5 + s.critDmg).toFixed(2)}`,
      `Скор.атаки: ×${s.atkSpeedMult.toFixed(2)}  ·  Скорость: ${Math.round(s.moveSpeed)}`,
      `Броня: ${Math.round(s.armor)} (DR ${Math.round((s.armor / (s.armor + 400)) * 100)}%)  ·  Сопр.стихий: ${Math.round((s.elemRes / (s.elemRes + 300)) * 100)}%`,
      `Вампиризм: ${Math.round(s.lifesteal * 100)}%  ·  Пробитие: ${Math.round(s.armorPen * 100)}%  ·  Уворот: ${Math.round(s.dodge * 100)}%`,
      `Сокр. КД: ${Math.round(s.cdrPct * 100)}%  ·  Удача: ${Math.round(s.luck)}  ·  +Золото ${Math.round(s.goldPct * 100)}%  ·  +Опыт ${Math.round(s.xpPct * 100)}%`,
      `Рывки: ${s.dashCharges}`,
      '',
      `Способность: ${ab?.skill ?? '—'} · Ульта: ${ab?.ult ?? '—'}`,
    ];
    this.add2(this.add.text(60, 90, lines.join('\n'), { fontFamily: 'system-ui', fontSize: '14px', color: '#dfe0ee', lineSpacing: 5 }));
  }

  private renderTree(run: Run, tree: SkillTree, kind: 'talent' | 'skill'): void {
    const points = kind === 'talent' ? run.talentPoints : run.skillPoints;
    const allocated = kind === 'talent' ? run.build.allocatedTalents : run.build.allocatedSkills;
    this.add2(
      this.add.text(60, 84, `Свободных очков: ${points}. Тир открывается за 3 вложенных очка в ветку.`, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#f0c040',
      }),
    );

    // сетка колонок в пределах BASE_W (сцена центрируется камерой) — крайняя не режется
    const cols = tree.branches.length;
    const marginL = 40;
    const colW = (BASE_W - marginL * 2) / cols;
    const cardW = colW - 14;
    tree.branches.forEach((branch: SkillBranch, bi) => {
      const x = marginL + bi * colW;
      this.add2(this.add.text(x, 116, branch.name, { fontFamily: 'system-ui', fontSize: '15px', color: '#9fd0ff' }));
      const invested = branch.nodes.filter((n) => allocated.has(n.id)).length;
      branch.nodes.forEach((node, ni) => {
        const y = 144 + ni * 68;
        const taken = allocated.has(node.id);
        const unlocked = invested >= tierThreshold(node.tier);
        const canBuy = !taken && unlocked && points > 0;
        const color = taken ? 0x2f6a3a : canBuy ? 0x394b8a : 0x24263a;
        const bg = this.add.rectangle(x, y, cardW, 60, color).setOrigin(0, 0).setStrokeStyle(1, node.key ? 0xf0a040 : 0x445);
        this.add2(bg);
        this.add2(
          this.add.text(x + 8, y + 6, `T${node.tier} ${node.name}${node.key ? ' ★' : ''}`, {
            fontFamily: 'system-ui',
            fontSize: '13px',
            color: taken ? '#a8e0a8' : '#e0e0ee',
            fontStyle: node.key ? 'bold' : 'normal',
          }),
        );
        this.add2(
          this.add.text(x + 8, y + 26, node.desc, { fontFamily: 'system-ui', fontSize: '11px', color: '#b0b0c4', wordWrap: { width: cardW - 16 } }),
        );
        if (canBuy) {
          bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            const ok = kind === 'talent' ? run.allocTalent(node.id) : run.allocSkill(node.id);
            if (ok) this.render();
          });
        }
      });
    });
  }

  // Плитка экипировки: рамка по редкости + иконка + подпись.
  private gearTile(x: number, y: number, iconKey: string, tint: number, border: number, title: string, sub: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x161a28, 1).fillRoundedRect(x, y, 104, 100, 8);
    g.lineStyle(2, border, 0.95).strokeRoundedRect(x, y, 104, 100, 8);
    this.add2(g);
    if (this.textures.exists(iconKey)) this.add2(this.add.image(x + 52, y + 38, iconKey).setScale(0.5).setOrigin(0.5).setTint(tint));
    this.add2(this.add.text(x + 52, y + 68, title, { fontFamily: 'system-ui', fontSize: '11px', color: '#e8e8f0', fontStyle: 'bold', align: 'center', wordWrap: { width: 98 } }).setOrigin(0.5, 0));
    if (sub) this.add2(this.add.text(x + 52, y + 88, sub, { fontFamily: 'system-ui', fontSize: '10px', color: '#' + border.toString(16).padStart(6, '0') }).setOrigin(0.5, 0));
  }

  private renderInventory(run: Run): void {
    const l = run.loadout;
    // ЭКИПИРОВКА — плитки оружия + брони
    this.add2(this.add.text(60, 84, 'ЭКИПИРОВКА', { fontFamily: 'system-ui', fontSize: '16px', color: '#f0c040', fontStyle: 'bold' }));
    const x0 = 60, y0 = 112, tw = 118;
    const wTint = l.weapon.element !== 'none' ? (ELEMENT_COLORS[l.weapon.element] ?? 0xffffff) : 0xffffff;
    this.gearTile(x0, y0, 'wpn_' + l.weapon.archetype, wTint, RARITY_COLORS[l.weapon.rarity] ?? 0x888888,
      l.weapon.name, `+${run.build.weaponEnchant} зачар`);
    (Object.keys(ARMOR_SLOT_NAMES) as ArmorSlot[]).forEach((slot, i) => {
      const p = run.build.armor[slot];
      const bx = x0 + (i + 1) * tw;
      const border = p ? (RARITY_COLORS[p.rarity] ?? 0x888888) : 0x3a4054;
      this.gearTile(bx, y0, 'armor_' + slot, p ? border : 0x556, border,
        ARMOR_SLOT_NAMES[slot], p ? `${RARITY_NAMES[p.rarity]} +${p.enchant}` : 'пусто');
    });

    // РАСХОДНИКИ — зелья с иконками
    this.add2(this.add.text(60, 240, 'РАСХОДНИКИ', { fontFamily: 'system-ui', fontSize: '16px', color: '#f0c040', fontStyle: 'bold' }));
    let cx = 60;
    (Object.keys(run.heals) as HealKind[]).forEach((k) => {
      const cnt = run.heals[k];
      const g = this.add.graphics();
      g.fillStyle(0x161a28, 1).fillRoundedRect(cx, 268, 150, 54, 8).lineStyle(1, 0x3a4054).strokeRoundedRect(cx, 268, 150, 54, 8);
      this.add2(g);
      if (this.textures.exists('item_' + k)) this.add2(this.add.image(cx + 28, 295, 'item_' + k).setScale(0.42).setOrigin(0.5));
      this.add2(this.add.text(cx + 52, 278, HEALS[k].name, { fontFamily: 'system-ui', fontSize: '12px', color: cnt > 0 ? '#e8e8f0' : '#666' }));
      this.add2(this.add.text(cx + 52, 298, `×${cnt}`, { fontFamily: 'system-ui', fontSize: '13px', color: '#8fe0a0', fontStyle: 'bold' }));
      cx += 166;
    });

    // МАТЕРИАЛЫ
    this.add2(this.add.text(60, 344, 'МАТЕРИАЛЫ', { fontFamily: 'system-ui', fontSize: '16px', color: '#f0c040', fontStyle: 'bold' }));
    const mats = [`Осколки: ${run.wallet.shards}`, `Пыль: ${run.wallet.rerollDust}`, `Ядра боссов: ${run.wallet.bossCores}`, `Золото: ${Math.floor(run.wallet.gold)}`];
    mats.forEach((m, i) => {
      const mx = 60 + (i % 4) * 210;
      const g = this.add.graphics();
      g.fillStyle(0x161a28, 1).fillRoundedRect(mx, 372, 196, 40, 8).lineStyle(1, 0x3a4054).strokeRoundedRect(mx, 372, 196, 40, 8);
      this.add2(g);
      this.add2(this.add.text(mx + 12, 384, m, { fontFamily: 'system-ui', fontSize: '13px', color: '#cfd6ee' }));
    });
  }
}
