// §3, §34, §35 — стихии, статусы, реакции.

export type Element =
  | 'none'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'poison'
  | 'arcane'
  | 'void'
  | 'radiance'
  | 'chaos';

export const BASE_ELEMENTS: Element[] = [
  'fire',
  'ice',
  'lightning',
  'poison',
  'arcane',
];

// Редкие стихии — не реагируют, сила front-loaded (§12/§34).
export const RARE_ELEMENTS: Element[] = ['void', 'radiance', 'chaos'];

export const ELEMENT_NAMES: Record<Element, string> = {
  none: 'Нет',
  fire: 'Огонь',
  ice: 'Лёд',
  lightning: 'Молния',
  poison: 'Яд',
  arcane: 'Аркан',
  void: 'Пустота',
  radiance: 'Сияние',
  chaos: 'Хаос',
};

// Статус, который накладывает базовая стихия (§34).
export type StatusKind =
  | 'burn'
  | 'freeze'
  | 'charge'
  | 'poison'
  | 'arcane'
  | 'rift'; // Разлом от Пустоты

export const ELEMENT_STATUS: Partial<Record<Element, StatusKind>> = {
  fire: 'burn',
  ice: 'freeze',
  lightning: 'charge',
  poison: 'poison',
  arcane: 'arcane',
  void: 'rift',
};

// §34 — параметры статусов (числа от AV наносящего).
export const STATUS_DEFS = {
  burn: { dur: 4, dotCoef: 0.15, name: 'Горение' },
  poison: { dur: 5, dotCoef: 0.1, maxStacks: 5, name: 'Отравление' },
  freeze: { dur: 3, slow: 0.4, name: 'Заморозка' },
  charge: { dur: 4, bonusDmg: 0.15, name: 'Заряд' },
  arcane: { dur: 4, name: 'Аркан' },
  rift: { dur: 5, vuln: 0.15, name: 'Разлом' },
} as const;

// §35 — реакции. Пара базовых стихий -> тип реакции + множитель к удару-триггеру.
export type ReactionKind =
  | 'steam' // Пар
  | 'detonate' // Детонация
  | 'overheat' // Перегрев
  | 'paralysis' // Паралич
  | 'frostbite' // Обморожение
  | 'spread' // Растекание
  | 'resonance' // Резонанс (Аркан)
  | 'amplify'; // Усиление (одинаковые)

export interface ReactionDef {
  kind: ReactionKind;
  name: string;
  mult: number; // множитель к урону-триггеру
  radius: number; // радиус AoE (0 = только цель)
  stun?: number; // длительность стана, с
}

export const REACTIONS: Record<ReactionKind, ReactionDef> = {
  steam: { kind: 'steam', name: 'Пар', mult: 2.5, radius: 70 },
  detonate: { kind: 'detonate', name: 'Детонация', mult: 2.5, radius: 90 },
  overheat: { kind: 'overheat', name: 'Перегрев', mult: 2.5, radius: 80 },
  paralysis: { kind: 'paralysis', name: 'Паралич', mult: 1.5, radius: 60, stun: 1.5 },
  frostbite: { kind: 'frostbite', name: 'Обморожение', mult: 1.2, radius: 0 },
  spread: { kind: 'spread', name: 'Растекание', mult: 1.2, radius: 90 },
  resonance: { kind: 'resonance', name: 'Резонанс', mult: 1.0, radius: 0 },
  amplify: { kind: 'amplify', name: 'Усиление', mult: 1.0, radius: 0 },
};

// Таблица пар (симметрична). Ключ — отсортированная пара стихий.
const pairKey = (a: Element, b: Element) => [a, b].sort().join('+');

const REACTION_TABLE: Record<string, ReactionKind> = {
  [pairKey('fire', 'ice')]: 'steam',
  [pairKey('fire', 'poison')]: 'detonate',
  [pairKey('fire', 'lightning')]: 'overheat',
  [pairKey('ice', 'lightning')]: 'paralysis',
  [pairKey('ice', 'poison')]: 'frostbite',
  [pairKey('lightning', 'poison')]: 'spread',
};

// Определить реакцию между двумя стихиями (§3).
export function findReaction(a: Element, b: Element): ReactionKind | null {
  if (a === 'none' || b === 'none') return null;
  if (a === b) return 'amplify';
  if (a === 'arcane' || b === 'arcane') return 'resonance';
  // редкие стихии не реагируют
  if (RARE_ELEMENTS.includes(a) || RARE_ELEMENTS.includes(b)) return null;
  return REACTION_TABLE[pairKey(a, b)] ?? null;
}

// §34 — совпадение инфузии и стихии оружия -> усиление урона.
export const ELEM_MATCH_MULT = 1.35;
