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

// §24 — Кольцо 2 (Топи и пещеры).
export const RING2_MOBS: MobDef[] = [
  { id: 'slime', name: 'Слизень', ai: 'tank', element: 'poison', ring: 2, radius: 15, color: 0x6ab04a, hpMult: 1.2, dmgMult: 1.0, speed: 45, gimmick: 'делится при уроне' },
  { id: 'spider', name: 'Паук', ai: 'charger', element: 'none', ring: 2, radius: 13, color: 0x6a4a6a, hpMult: 0.9, dmgMult: 1.1, speed: 100, gimmick: 'паутина замедляет' },
  { id: 'skeleton', name: 'Скелет', ai: 'chaser', element: 'none', ring: 2, radius: 13, color: 0xcfc8b0, hpMult: 1.0, dmgMult: 1.0, speed: 70, gimmick: 'воскресает раз' },
  { id: 'flying_swarm', name: 'Летучий рой', ai: 'swarm', element: 'none', ring: 2, radius: 9, color: 0x8a7a9a, hpMult: 0.4, dmgMult: 0.7, speed: 95, gimmick: 'окружает' },
  { id: 'bog_spitter', name: 'Болотник-плевок', ai: 'shooter', element: 'poison', ring: 2, radius: 14, color: 0x4a7a3a, hpMult: 0.9, dmgMult: 1.1, speed: 50, gimmick: 'плевки-лужи' },
];

// §24 — Кольцо 3 (Выжженные пустоши).
export const RING3_MOBS: MobDef[] = [
  { id: 'fire_elemental', name: 'Огненный элементаль', ai: 'shooter', element: 'fire', ring: 3, radius: 14, color: 0xff6a2a, hpMult: 0.9, dmgMult: 1.1, speed: 55, gimmick: 'огнешары' },
  { id: 'demon_raider', name: 'Демон-налётчик', ai: 'charger', element: 'none', ring: 3, radius: 14, color: 0xa03030, hpMult: 1.0, dmgMult: 1.2, speed: 105, gimmick: 'рывок-когти' },
  { id: 'magma_golem', name: 'Магма-голем', ai: 'tank', element: 'fire', ring: 3, radius: 17, color: 0xd0502a, hpMult: 1.3, dmgMult: 1.0, speed: 45, gimmick: 'слэм, лава' },
  { id: 'ash_swarm', name: 'Пепельный рой', ai: 'swarm', element: 'fire', ring: 3, radius: 9, color: 0xd08a5a, hpMult: 0.4, dmgMult: 0.7, speed: 95, gimmick: 'поджигает' },
  { id: 'demon_cultist', name: 'Демон-культист', ai: 'caster', element: 'arcane', ring: 3, radius: 14, color: 0xa050d0, hpMult: 1.1, dmgMult: 1.0, speed: 48, gimmick: 'порталы с адд' },
];

// §24 — Кольцо 4 (Мёрзлые руины).
export const RING4_MOBS: MobDef[] = [
  { id: 'ice_golem', name: 'Ледяной голем', ai: 'tank', element: 'ice', ring: 4, radius: 17, color: 0x7ab0d0, hpMult: 1.3, dmgMult: 1.0, speed: 45, gimmick: 'замедляющий топот' },
  { id: 'ghost', name: 'Призрак', ai: 'charger', element: 'none', ring: 4, radius: 13, color: 0xa0c0d0, hpMult: 0.8, dmgMult: 1.1, speed: 110, gimmick: 'сквозь стены, засады' },
  { id: 'undead_knight', name: 'Рыцарь-нежить', ai: 'chaser', element: 'none', ring: 4, radius: 15, color: 0x8a8aa0, hpMult: 1.2, dmgMult: 1.0, speed: 60, gimmick: 'щит, блокирует фронт' },
  { id: 'shard_swarm', name: 'Осколочный рой', ai: 'swarm', element: 'ice', ring: 4, radius: 9, color: 0xa0d0e0, hpMult: 0.4, dmgMult: 0.7, speed: 95, gimmick: 'ледяные осколки' },
  { id: 'necro_mage', name: 'Некро-маг', ai: 'caster', element: 'void', ring: 4, radius: 14, color: 0x6a4a8a, hpMult: 1.1, dmgMult: 1.0, speed: 48, gimmick: 'поднимает нежить' },
];

// §24 — Кольцо 5 (Край Бездны).
export const RING5_MOBS: MobDef[] = [
  { id: 'void_spawn', name: 'Порождение Пустоты', ai: 'charger', element: 'void', ring: 5, radius: 14, color: 0x6a2a9a, hpMult: 1.0, dmgMult: 1.2, speed: 110, gimmick: 'куски истинного урона' },
  { id: 'chaos_beast', name: 'Хаос-тварь', ai: 'caster', element: 'chaos', ring: 5, radius: 15, color: 0xff2ad0, hpMult: 1.1, dmgMult: 1.1, speed: 60, gimmick: 'меняет поведение' },
  { id: 'abyss_guard', name: 'Страж Бездны', ai: 'tank', element: 'void', ring: 5, radius: 18, color: 0x4a2a7a, hpMult: 1.4, dmgMult: 1.0, speed: 42, gimmick: 'щит Пустоты, игнор урона' },
  { id: 'shadow_swarm', name: 'Рой теней', ai: 'swarm', element: 'none', ring: 5, radius: 9, color: 0x3a2a5a, hpMult: 0.45, dmgMult: 0.8, speed: 100, gimmick: 'вытягивает энергию' },
  { id: 'abyss_cultist', name: 'Культист Бездны', ai: 'caster', element: 'void', ring: 5, radius: 14, color: 0x8a3aca, hpMult: 1.1, dmgMult: 1.0, speed: 48, gimmick: 'открывает разломы' },
];

export const MOBS_BY_RING: Record<number, MobDef[]> = {
  1: RING1_MOBS,
  2: RING2_MOBS,
  3: RING3_MOBS,
  4: RING4_MOBS,
  5: RING5_MOBS,
};

// §40 — рост стата внутри кольца по уровню моба.
export function ringLevelScale(ring: number, mobLevel: number): number {
  const min = RING_STATS[ring]?.minLevel ?? 1;
  return 1 + 0.03 * Math.max(0, mobLevel - min);
}
