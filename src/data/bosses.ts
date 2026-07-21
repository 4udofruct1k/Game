// §26 — большие боссы. В срезе полностью прописан Древо-Страж (Кольцо 1).
import type { Element } from './elements';

export type BossAttackKind =
  | 'root_slam' // удар корнем (телеграф-круг)
  | 'spore_fan' // веер споровых снарядов
  | 'summon_adds' // призыв саженцев
  | 'roots_arena'; // корни по всей арене (фаза <50%)

export interface BossAttackDef {
  kind: BossAttackKind;
  name: string;
  telegraph: number; // мс индикатора перед ударом
  cooldown: number; // мс между использованиями
  radius?: number;
  count?: number; // снаряды/адды
  dmgMult?: number; // множитель к урону босса
  phaseOnly?: boolean; // только в фазе <50%
}

export interface BossDef {
  id: string;
  name: string;
  ring: number;
  recLevel: number;
  element: Element;
  radius: number;
  color: number;
  hpMult: number; // ×20 к базе кольца (§40)
  dmgMult: number; // ×3
  phaseThreshold: number; // доля HP для фазы
  final?: boolean; // финальный босс → победа
  attacks: BossAttackDef[];
  reward: {
    weaponTier: number;
    evolutionStage: number; // разблокирует ступень класса (0 = нет)
    core: boolean; // ядро босса
  };
}

export const TREE_WARDEN: BossDef = {
  id: 'tree_warden',
  name: 'Древо-Страж',
  ring: 1,
  recLevel: 20,
  element: 'poison',
  radius: 42,
  color: 0x4f7a3a,
  hpMult: 20,
  dmgMult: 3,
  phaseThreshold: 0.5,
  attacks: [
    { kind: 'root_slam', name: 'Удар корнем', telegraph: 900, cooldown: 3200, radius: 90, dmgMult: 1.0 },
    { kind: 'spore_fan', name: 'Веер спор', telegraph: 700, cooldown: 4200, count: 9, dmgMult: 0.6 },
    { kind: 'summon_adds', name: 'Призыв саженцев', telegraph: 1000, cooldown: 9000, count: 3 },
    { kind: 'roots_arena', name: 'Корни по арене', telegraph: 1100, cooldown: 5000, radius: 70, dmgMult: 1.2, phaseOnly: true },
  ],
  reward: { weaponTier: 2, evolutionStage: 1, core: true },
};

// §26 — Гнилой Левиафан (Кольцо 2).
export const ROT_LEVIATHAN: BossDef = {
  id: 'rot_leviathan',
  name: 'Гнилой Левиафан',
  ring: 2,
  recLevel: 40,
  element: 'poison',
  radius: 48,
  color: 0x5a8a3a,
  hpMult: 20,
  dmgMult: 3,
  phaseThreshold: 0.5,
  attacks: [
    { kind: 'root_slam', name: 'Прыжок-слэм', telegraph: 850, cooldown: 3000, radius: 110, dmgMult: 1.1 },
    { kind: 'spore_fan', name: 'Волна яда', telegraph: 700, cooldown: 3800, count: 11, dmgMult: 0.6 },
    { kind: 'summon_adds', name: 'Пиявки', telegraph: 1000, cooldown: 9000, count: 3 },
    { kind: 'roots_arena', name: 'Ядовитые лужи', telegraph: 1000, cooldown: 4500, radius: 80, dmgMult: 1.2, phaseOnly: true },
  ],
  reward: { weaponTier: 3, evolutionStage: 2, core: true },
};

// §26 — Владыка Пепла (Кольцо 3).
export const ASH_LORD: BossDef = {
  id: 'ash_lord',
  name: 'Владыка Пепла',
  ring: 3,
  recLevel: 60,
  element: 'fire',
  radius: 46,
  color: 0xd0562a,
  hpMult: 20,
  dmgMult: 3,
  phaseThreshold: 0.5,
  attacks: [
    { kind: 'root_slam', name: 'Огненные столбы', telegraph: 800, cooldown: 2800, radius: 95, dmgMult: 1.1 },
    { kind: 'spore_fan', name: 'Рывок-полоса огня', telegraph: 650, cooldown: 3600, count: 9, dmgMult: 0.7 },
    { kind: 'summon_adds', name: 'Пепельные твари', telegraph: 900, cooldown: 9000, count: 4 },
    { kind: 'roots_arena', name: 'Метеоры', telegraph: 950, cooldown: 4000, radius: 85, dmgMult: 1.3, phaseOnly: true },
  ],
  reward: { weaponTier: 4, evolutionStage: 3, core: true },
};

// §26 — Ледяной Титан (Кольцо 4).
export const ICE_TITAN: BossDef = {
  id: 'ice_titan',
  name: 'Ледяной Титан',
  ring: 4,
  recLevel: 80,
  element: 'ice',
  radius: 52,
  color: 0x7ab0d8,
  hpMult: 22,
  dmgMult: 3,
  phaseThreshold: 0.5,
  attacks: [
    { kind: 'spore_fan', name: 'Ледяные копья', telegraph: 700, cooldown: 3200, count: 9, dmgMult: 0.8 },
    { kind: 'root_slam', name: 'Топот (заморозка)', telegraph: 900, cooldown: 3400, radius: 130, dmgMult: 1.2 },
    { kind: 'summon_adds', name: 'Ледяные големы', telegraph: 1000, cooldown: 10000, count: 3 },
    { kind: 'roots_arena', name: 'Метель', telegraph: 1000, cooldown: 4500, radius: 90, dmgMult: 1.2, phaseOnly: true },
  ],
  reward: { weaponTier: 5, evolutionStage: 0, core: true },
};

// §26 — Пожиратель Миров (Кольцо 5, ФИНАЛ).
export const WORLD_EATER: BossDef = {
  id: 'world_eater',
  name: 'Пожиратель Миров',
  ring: 5,
  recLevel: 100,
  element: 'void',
  radius: 58,
  color: 0x7a2aca,
  hpMult: 30,
  dmgMult: 3,
  phaseThreshold: 0.66,
  final: true,
  attacks: [
    { kind: 'spore_fan', name: 'Щупальца Пустоты', telegraph: 650, cooldown: 2600, count: 13, dmgMult: 0.7 },
    { kind: 'root_slam', name: 'Разлом', telegraph: 800, cooldown: 2800, radius: 120, dmgMult: 1.3 },
    { kind: 'summon_adds', name: 'Порталы с адд', telegraph: 900, cooldown: 8000, count: 4 },
    { kind: 'roots_arena', name: 'Хаос-снаряды', telegraph: 850, cooldown: 3500, radius: 95, dmgMult: 1.4, phaseOnly: true },
  ],
  reward: { weaponTier: 5, evolutionStage: 0, core: true },
};

export const BOSSES_BY_RING: Record<number, BossDef> = {
  1: TREE_WARDEN,
  2: ROT_LEVIATHAN,
  3: ASH_LORD,
  4: ICE_TITAN,
  5: WORLD_EATER,
};

// §40 — модификаторы элиток/микробоссов/боссов.
export const ELITE_MULT = { hp: 3, dmg: 1.5, loot: 3 };
export const MINIBOSS_MULT = { hp: 6, dmg: 2 };
export const BOSS_MULT = { hp: 20, dmg: 3 };
