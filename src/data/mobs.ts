// §23, §24, §40 — AI-архетипы, мобы Кольца 1, статы мобов по кольцам.
import type { Element } from './elements';

// §23 — переиспользуемые типы поведения.
export type AIArchetype =
  | 'chaser' // Догоняющий
  | 'shooter' // Стрелок
  | 'charger' // Налётчик
  | 'swarm' // Рой
  | 'tank' // Танк
  | 'caster'; // Кастер

export interface MobDef {
  id: string;
  name: string;
  ai: AIArchetype;
  element: Element;
  ring: number;
  radius: number; // px placeholder
  color: number;
  hpMult: number; // множитель к базе кольца
  dmgMult: number;
  speed: number; // px/с
  gimmick: string;
}

// §40 — база моба по кольцам: [hp, dmg, armor, xp, gold].
export interface RingStats {
  hp: number;
  dmg: number;
  armor: number;
  xp: number;
  gold: number;
  minLevel: number;
}

export const RING_STATS: Record<number, RingStats> = {
  1: { hp: 30, dmg: 5, armor: 20, xp: 25, gold: 5, minLevel: 1 },
  2: { hp: 120, dmg: 15, armor: 40, xp: 90, gold: 15, minLevel: 20 },
  3: { hp: 400, dmg: 40, armor: 60, xp: 250, gold: 40, minLevel: 40 },
  4: { hp: 1200, dmg: 90, armor: 80, xp: 600, gold: 90, minLevel: 60 },
  5: { hp: 3500, dmg: 180, armor: 100, xp: 1400, gold: 180, minLevel: 80 },
};

// §24 — мобы Кольца 1 (Зелёные равнины).
export const RING1_MOBS: MobDef[] = [
  { id: 'goblin_melee', name: 'Гоблин-рубака', ai: 'chaser', element: 'none', ring: 1, radius: 13, color: 0x6aa84f, hpMult: 1.0, dmgMult: 1.0, speed: 70, gimmick: 'базовый ближник' },
  { id: 'goblin_archer', name: 'Гоблин-лучник', ai: 'shooter', element: 'none', ring: 1, radius: 12, color: 0x93c47d, hpMult: 0.8, dmgMult: 1.1, speed: 55, gimmick: 'залпы стрел' },
  { id: 'wolf', name: 'Волк', ai: 'charger', element: 'none', ring: 1, radius: 14, color: 0x9aa0a6, hpMult: 0.9, dmgMult: 1.2, speed: 95, gimmick: 'рывки, ходит стаей' },
  { id: 'rat_swarm', name: 'Крыса', ai: 'swarm', element: 'none', ring: 1, radius: 8, color: 0x7a6a55, hpMult: 0.35, dmgMult: 0.6, speed: 85, gimmick: 'слабые, числом' },
  { id: 'goblin_shaman', name: 'Гоблин-шаман', ai: 'caster', element: 'fire', ring: 1, radius: 13, color: 0xe06666, hpMult: 1.1, dmgMult: 1.0, speed: 50, gimmick: 'баффает, слабые фаерболы' },
];

export const MOBS_BY_RING: Record<number, MobDef[]> = {
  1: RING1_MOBS,
};

// §40 — рост стата внутри кольца по уровню моба.
export function ringLevelScale(ring: number, mobLevel: number): number {
  const min = RING_STATS[ring]?.minLevel ?? 1;
  return 1 + 0.03 * Math.max(0, mobLevel - min);
}
