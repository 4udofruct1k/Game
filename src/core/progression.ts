// §37, §38 — опыт, уровни, кап, рост статов.
import {
  LEVEL_CAP_BASE,
  xpToNext,
  HP_PER_LEVEL,
  DMG_PER_LEVEL,
  REGEN_PER_LEVEL,
} from '../data/balance';
import { CLASS_RARITY_LEVELCAP } from '../data/rarity';
import type { StartLoadout } from './startRoll';

// §38 — расчёт капа уровня из стартового ролла (складывается).
export function computeLevelCap(loadout: StartLoadout): number {
  let cap = LEVEL_CAP_BASE;
  cap += CLASS_RARITY_LEVELCAP[loadout.classRarity];
  cap += loadout.race.levelCap ?? 0;
  cap += loadout.blessing.levelCap ?? 0;
  cap += loadout.curse?.levelCap ?? 0;
  cap += loadout.relic?.levelCap ?? 0;
  cap += loadout.potential; // до +20
  return cap;
}

export { xpToNext };

// Прибавить XP, вернуть новое состояние {level, xp, xpNext, levelsGained}.
export interface LevelState {
  level: number;
  xp: number; // накоплено к текущему уровню
  xpNext: number;
}

export function initLevelState(): LevelState {
  return { level: 1, xp: 0, xpNext: xpToNext(1) };
}

export function addXP(
  state: LevelState,
  amount: number,
  cap: number,
): { state: LevelState; levelsGained: number } {
  let { level, xp } = state;
  let levelsGained = 0;
  xp += amount;
  while (level < cap && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levelsGained += 1;
  }
  if (level >= cap) xp = 0;
  return {
    state: { level, xp, xpNext: xpToNext(level) },
    levelsGained,
  };
}

// §37 — множители роста от уровня.
export function hpLevelMult(level: number): number {
  return 1 + HP_PER_LEVEL * (level - 1);
}

export function dmgLevelBonus(level: number): number {
  return DMG_PER_LEVEL * (level - 1); // добавка в pctBonuses
}

export function regenLevel(level: number): number {
  return 1 + REGEN_PER_LEVEL * (level - 1);
}
