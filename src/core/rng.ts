// Seedable RNG (mulberry32) + взвешенный роллер редкости (§1).
import {
  RARITY_ORDER,
  RARITY_WEIGHTS,
  type Rarity,
} from '../data/rarity';

export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  // mulberry32
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  // Взвешенный выбор индекса.
  weightedIndex(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}

// Ролл редкости со сдвигом от Удачи (§1). luck сдвигает распределение вправо.
export function rollRarity(rng: RNG, luck = 0): Rarity {
  // luck (0..~100) плавно перекачивает вес из низких тиров в высокие.
  const shift = Math.min(0.9, luck / 120);
  const weights = RARITY_ORDER.map((r, i) => {
    const base = RARITY_WEIGHTS[r];
    // чем выше индекс (реже), тем больше прибавка от удачи
    const luckFactor = 1 + shift * (i / (RARITY_ORDER.length - 1)) * 4;
    const dropFactor = 1 - shift * (1 - i / (RARITY_ORDER.length - 1)) * 0.6;
    return base * luckFactor * dropFactor;
  });
  return RARITY_ORDER[rng.weightedIndex(weights)];
}

// Выбрать случайный элемент из списка с учётом веса редкости каждого (для ролл-пулов).
export function rollFromPool<T extends { rarity: Rarity }>(
  rng: RNG,
  pool: T[],
  luck = 0,
): T {
  const targetRarity = rollRarity(rng, luck);
  const targetIdx = RARITY_ORDER.indexOf(targetRarity);
  // ищем предмет с ближайшей (<=) редкостью
  let best: T[] = [];
  for (let idx = targetIdx; idx >= 0 && best.length === 0; idx--) {
    best = pool.filter((p) => RARITY_ORDER.indexOf(p.rarity) === idx);
  }
  if (best.length === 0) best = pool;
  return rng.pick(best);
}

// Хеш строки → сид (для текстового сида мира).
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
