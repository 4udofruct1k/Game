// §41 — золото, цены, покупки, зачарование.
import { HEALS, type HealKind } from '../data/items';
import { TIER_SCALE } from '../data/balance';
import { RARITY_MULT, type Rarity } from '../data/rarity';

export interface Wallet {
  gold: number;
  shards: number;
  essence: number;
  bossCores: number;
  rerollDust: number;
}

export function createWallet(): Wallet {
  return { gold: 0, shards: 0, essence: 0, bossCores: 0, rerollDust: 0 };
}

// §41 — цена брони по слоту в кольце (базовый диапазон × TIER_SCALE^(ring-1)).
export function armorPrice(ring: number, rarity: Rarity): number {
  const base = 100; // середина 50–150
  return Math.round(base * Math.pow(TIER_SCALE, ring - 1) * RARITY_MULT[rarity]);
}

// §41 — зачарование: 100 × уровень золота + осколки.
export function enchantCost(level: number): { gold: number; shards: number } {
  return { gold: 100 * level, shards: level };
}

export const REROLL_COST = { gold: 80, dust: 1 };

export function healPrice(kind: HealKind): number {
  return HEALS[kind].price;
}

// Попытка списать золото.
export function spend(wallet: Wallet, gold: number): boolean {
  if (wallet.gold < gold) return false;
  wallet.gold -= gold;
  return true;
}

// Начислить награду за убийство (§41).
export function grantKillReward(
  wallet: Wallet,
  baseGold: number,
  goldPct: number,
  rng: () => number,
): number {
  const g = Math.round(baseGold * (0.5 + rng()) * (1 + goldPct));
  wallet.gold += g;
  return g;
}
