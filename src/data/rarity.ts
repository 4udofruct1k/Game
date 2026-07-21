// §1 — единая лестница редкости. Применяется ко всему.

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

export const RARITY_NAMES: Record<Rarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
  mythic: 'Мифический',
};

// Вес ролла (§1). Нормализуется в роллере.
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  uncommon: 28,
  rare: 14,
  epic: 6,
  legendary: 1.8,
  mythic: 0.2,
};

// §30/§44 — RARITY_MULT: множитель статов предметов (канон).
export const RARITY_MULT: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.3,
  rare: 1.7,
  epic: 2.2,
  legendary: 3.0,
  mythic: 4.0,
};

// §32 — множитель силы по редкости класса (мягче, т.к. класс даёт ещё перки/кап).
export const CLASS_POWER_MULT: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.1,
  rare: 1.25,
  epic: 1.4,
  legendary: 1.5,
  mythic: 1.6,
};

// §38 — вклад редкости класса в кап уровня.
export const CLASS_RARITY_LEVELCAP: Record<Rarity, number> = {
  common: 0,
  uncommon: 0,
  rare: 10,
  epic: 20,
  legendary: 35,
  mythic: 50,
};

export function rarityIndex(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

// Сдвиг редкости на N ступеней вверх (с клампом). §2 — оружие +1 ступень.
export function bumpRarity(r: Rarity, steps: number): Rarity {
  const i = Phaser_clamp(rarityIndex(r) + steps, 0, RARITY_ORDER.length - 1);
  return RARITY_ORDER[i];
}

function Phaser_clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
