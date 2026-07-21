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
  attacks: BossAttackDef[];
  reward: {
    weaponTier: number;
    evolutionStage: number; // разблокирует ступень класса
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

export const BOSSES_BY_RING: Record<number, BossDef> = {
  1: TREE_WARDEN,
};

// §40 — модификаторы элиток/микробоссов/боссов.
export const ELITE_MULT = { hp: 3, dmg: 1.5, loot: 3 };
export const MINIBOSS_MULT = { hp: 6, dmg: 2 };
export const BOSS_MULT = { hp: 20, dmg: 3 };
