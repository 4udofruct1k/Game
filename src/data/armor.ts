// §13, §44 — слоты брони, весовые классы, базовые статы, сет-бонусы.
import type { StatMods } from './mods';

export type ArmorSlot = 'helm' | 'shoulders' | 'chest' | 'gloves' | 'boots' | 'belt';

export const ARMOR_SLOTS: ArmorSlot[] = ['helm', 'shoulders', 'chest', 'gloves', 'boots', 'belt'];

export const ARMOR_SLOT_NAMES: Record<ArmorSlot, string> = {
  helm: 'Шлем',
  shoulders: 'Наплечники',
  chest: 'Нагрудник',
  gloves: 'Перчатки',
  boots: 'Сапоги',
  belt: 'Пояс',
};

// §44 — базовые статы слота (T1, обычн, средний вес): броня + профильный стат.
export const ARMOR_BASE: Record<ArmorSlot, { armor: number; profile: StatMods }> = {
  helm: { armor: 8, profile: { critChance: 0.03 } },
  shoulders: { armor: 6, profile: { dmgPct: 0.04 } },
  chest: { armor: 15, profile: { hpPct: 0.05 } },
  gloves: { armor: 5, profile: { atkSpeedPct: 0.05 } },
  boots: { armor: 6, profile: { moveSpeedPct: 0.05 } },
  belt: { armor: 5, profile: { regen: 1 } },
};

// §13/§44 — весовые классы.
export type WeightClass = 'heavy' | 'medium' | 'robe';

export const WEIGHT_CLASSES: Record<WeightClass, { name: string; armorMult: number; mods: StatMods }> = {
  heavy: { name: 'Тяжёлая', armorMult: 1.4, mods: { moveSpeedPct: -0.05 } },
  medium: { name: 'Средняя', armorMult: 1.0, mods: { critChance: 0.02, dodge: 0.02 } },
  robe: { name: 'Мантия', armorMult: 0.6, mods: { moveSpeedPct: 0.05, dmgPct: 0.05 } },
};

// «Родной» вес класса (аффинитет).
export const CLASS_WEIGHT: Record<string, WeightClass> = {
  warrior: 'heavy',
  paladin: 'heavy',
  barbarian: 'heavy',
  ranger: 'medium',
  rogue: 'medium',
  assassin: 'medium',
  berserker: 'medium',
  monk: 'medium',
  mage: 'robe',
  pyromancer: 'robe',
  cryomancer: 'robe',
  necromancer: 'robe',
  priest: 'robe',
};

// §13 — классовые сеты (2/4/6). Числа масштаба — в balance.ts (§39).
export interface SetDef {
  id: string;
  name: string;
  classId: string;
  bonus2: string;
  bonus4: string;
  bonus6: string;
  // тематический стат для числовых бонусов 2/4 (§39)
  themeMods2: StatMods;
  themeMods4: StatMods;
}

// В срезе — «родные» сеты 5 играбельных классов.
export const CLASS_SETS: Record<string, SetDef> = {
  warrior: { id: 'set_warrior', name: 'Латы Стойкости', classId: 'warrior', bonus2: '+HP', bonus4: '−15% получаемого урона', bonus6: 'Вихрь оглушает и лечит за каждого задетого', themeMods2: { hpPct: 0.1 }, themeMods4: { armor: 60 } },
  ranger: { id: 'set_ranger', name: 'Соколиный убор', classId: 'ranger', bonus2: '+крит', bonus4: '+50% дальность', bonus6: 'Мультивыстрел пробивает + авто-хедшот', themeMods2: { critChance: 0.1 }, themeMods4: { dmgPct: 0.1 } },
  mage: { id: 'set_mage', name: 'Одеяния Архимага', classId: 'mage', bonus2: '+сила магии', bonus4: '−перезарядка', bonus6: 'Заклинания оставляют лужу стихии', themeMods2: { dmgPct: 0.1 }, themeMods4: { cdrPct: 0.15 } },
  rogue: { id: 'set_rogue', name: 'Плащ теней', classId: 'rogue', bonus2: '+скорость', bonus4: '+уворот', bonus6: 'Рывок → невидимость + гарант-крит', themeMods2: { moveSpeedPct: 0.1 }, themeMods4: { dodge: 0.1 } },
  pyromancer: { id: 'set_pyromancer', name: 'Пепельное облачение', classId: 'pyromancer', bonus2: '+урон Горения', bonus4: 'поджоги распространяются', themeMods2: { elemDmgPct: 0.1 }, themeMods4: { elemDmgPct: 0.1 }, bonus6: 'Огненный шторм = вечное пламя' },
};
