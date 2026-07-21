// §15–18 — расы, благословения, проклятия, реликвии (стартовый ролл §2).
import type { Rarity } from './rarity';
import type { StatMods } from './mods';

export interface RollEntry {
  id: string;
  name: string;
  rarity: Rarity;
  desc: string;
  mods?: StatMods; // числовые эффекты (что можно смоделировать в срезе)
  levelCap?: number; // вклад в кап уровня (§38)
  flag?: string; // особая механика-маркер
}

// §15 — расы.
export const RACES: RollEntry[] = [
  { id: 'human', name: 'Человек', rarity: 'common', desc: 'Сбалансирован, +5% опыта', mods: { xpPct: 0.05 } },
  { id: 'beastkin', name: 'Зверолюд', rarity: 'common', desc: '+скорость, +уворот; −max HP', mods: { moveSpeedPct: 0.1, dodge: 0.08, hpPct: -0.15 } },
  { id: 'dwarf', name: 'Дворф', rarity: 'uncommon', desc: '+броня, +эффект зачарований; −скорость', mods: { armor: 40, moveSpeedPct: -0.1 } },
  { id: 'undead', name: 'Нежить', rarity: 'uncommon', desc: 'Не лечится зельями; иммун к яду; +вампиризм', mods: { lifesteal: 0.1 }, flag: 'undead' },
  { id: 'demon', name: 'Демон', rarity: 'rare', desc: '+урон, +урон стихией; −сопротивления', mods: { dmgPct: 0.15, elemDmgPct: 0.15, elemResPct: -0.15 } },
  { id: 'elf', name: 'Эльф/Древний', rarity: 'rare', desc: '+сила магии, +15 к капу, +Удача; −HP', mods: { dmgPct: 0.1, luck: 15, hpPct: -0.1 }, levelCap: 15 },
  { id: 'golem', name: 'Голем', rarity: 'epic', desc: '+HP/броня, иммун к замедлению; −скорость/атака', mods: { hpPct: 0.4, armor: 80, moveSpeedPct: -0.25, atkSpeedPct: -0.15 }, flag: 'slow_immune' },
  { id: 'dragonkin', name: 'Драконид', rarity: 'legendary', desc: 'Резист всех стихий, дыхание-конус, +HP', mods: { elemResPct: 0.25, hpPct: 0.2 }, flag: 'breath' },
];

// §16 — благословения.
export const BLESSINGS: RollEntry[] = [
  { id: 'berserk_grace', name: 'Берсеркова милость', rarity: 'common', desc: 'Больше урона при низком HP', flag: 'lowhp_dmg' },
  { id: 'merchant_grace', name: 'Милость торговца', rarity: 'common', desc: '+50% золота', mods: { goldPct: 0.5 } },
  { id: 'insight', name: 'Прозрение', rarity: 'common', desc: '+50% опыта', mods: { xpPct: 0.5 } },
  { id: 'vampirism', name: 'Вампиризм', rarity: 'uncommon', desc: '+10% вампиризма', mods: { lifesteal: 0.1 } },
  { id: 'elem_kinship', name: 'Стихийное родство', rarity: 'uncommon', desc: '+25% урона стартовой стихией', mods: { elemDmgPct: 0.25 } },
  { id: 'fortune', name: 'Милость Фортуны', rarity: 'rare', desc: 'Большой +Удача', mods: { luck: 30 } },
  { id: 'heritage', name: 'Наследие', rarity: 'rare', desc: '+25 к капу уровня', levelCap: 25 },
  { id: 'double_soul', name: 'Двойная душа', rarity: 'epic', desc: '+1 заряд рывка и навыка', mods: { dashCharges: 1 }, flag: 'extra_skill_charge' },
  { id: 'guardian', name: 'Хранитель', rarity: 'epic', desc: 'Периодический щит на один удар', flag: 'periodic_shield' },
  { id: 'ascension_blessing', name: 'Благословение Вознесения', rarity: 'legendary', desc: 'Каждые 10 ур. случайный перк легендарного тира', flag: 'ascension' },
];

// §17 — проклятия (размен).
export const CURSES: RollEntry[] = [
  { id: 'glass_cannon', name: 'Стеклянная пушка', rarity: 'rare', desc: '+50% урона; −50% max HP', mods: { dmgPct: 0.5, hpPct: -0.5 } },
  { id: 'brittle', name: 'Хрупкость', rarity: 'uncommon', desc: '−30% брони; +20% скор.атаки', mods: { atkSpeedPct: 0.2 }, flag: 'brittle' },
  { id: 'cursed_greed', name: 'Проклятая жадность', rarity: 'rare', desc: '+100% золота/дропа; враги +20% сильнее', mods: { goldPct: 1.0, luck: 20 }, flag: 'enemies_stronger' },
  { id: 'blood_bond', name: 'Кровавые узы', rarity: 'uncommon', desc: 'Нет пассив. регена, зелья слабее; +25% урона', mods: { dmgPct: 0.25 }, flag: 'no_regen' },
  { id: 'marked', name: 'Меченый', rarity: 'rare', desc: 'Боссы бьют +30%; дают +100% лута', flag: 'boss_marked' },
  { id: 'shackles', name: 'Оковы', rarity: 'uncommon', desc: '−25% скорости; +30% урона', mods: { moveSpeedPct: -0.25, dmgPct: 0.3 } },
  { id: 'hunger', name: 'Голод', rarity: 'uncommon', desc: 'HP тает вне боя; +крит', mods: { critChance: 0.1 }, flag: 'hunger' },
  { id: 'obsession', name: 'Одержимость', rarity: 'rare', desc: 'Иногда теряешь контроль; +40% урона', mods: { dmgPct: 0.4 }, flag: 'obsession' },
];

// §18 — реликвии (билд-дефайнинг).
export const RELICS: RollEntry[] = [
  { id: 'chronos_shard', name: 'Осколок Хроноса', rarity: 'rare', desc: '−25% всех перезарядок', mods: { cdrPct: 0.25 } },
  { id: 'soul_lantern', name: 'Душа-фонарь', rarity: 'rare', desc: 'Убийства лечат на 3% max HP', flag: 'kill_heal' },
  { id: 'bottomless_bag', name: 'Бездонная сумка', rarity: 'rare', desc: 'Двойной дроп материалов/золота', mods: { goldPct: 1.0 } },
  { id: 'infinity_orb', name: 'Сфера Бесконечности', rarity: 'epic', desc: 'Реакции срабатывают дважды', flag: 'double_reaction' },
  { id: 'void_heart', name: 'Сердце Пустоты', rarity: 'epic', desc: 'Часть урона становится истинной', mods: { armorPen: 0.25 } },
  { id: 'twin_mirror', name: 'Зеркало Двойника', rarity: 'epic', desc: 'Постоянный бой-двойник (30% урона)', flag: 'twin' },
  { id: 'berserk_totem', name: 'Тотем Берсерка', rarity: 'epic', desc: 'При уроне по тебе — вспышка урона по площади', flag: 'retaliate' },
  { id: 'phoenix_feather', name: 'Перо Феникса', rarity: 'legendary', desc: 'Раз за мир: смертельный удар → воскрешение 50% HP', flag: 'revive' },
  { id: 'growth_rune', name: 'Руна Роста', rarity: 'legendary', desc: '+25 к капу уровня и +опыт', mods: { xpPct: 0.2 }, levelCap: 25 },
  { id: 'element_prism', name: 'Призма Стихий', rarity: 'legendary', desc: 'Оружие несёт все 5 базовых стихий', flag: 'all_elements' },
];

// §38 — скрытый ролл «Потенциал»: до +20 к капу.
export interface PotentialRoll {
  value: number; // 0..20
  levelCap: number;
}
