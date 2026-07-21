// §14 — расходники (хилки) и материалы. §41 — цены.
export type HealKind = 'small_potion' | 'big_potion' | 'regen_flask' | 'elixir';

export interface HealDef {
  id: HealKind;
  name: string;
  desc: string;
  healPct?: number; // мгновенный % max HP
  healOverTime?: { pct: number; dur: number }; // % за dur сек
  fullHeal?: boolean;
  invuln?: number; // сек неуязвимости
  cooldown: number; // мс КД использования
  price: number; // золото (§41)
}

export const HEALS: Record<HealKind, HealDef> = {
  small_potion: { id: 'small_potion', name: 'Малое зелье', desc: 'Мгновенно +25% HP', healPct: 0.25, cooldown: 3000, price: 20 },
  big_potion: { id: 'big_potion', name: 'Большое зелье', desc: '+60% HP', healPct: 0.6, cooldown: 3000, price: 60 },
  regen_flask: { id: 'regen_flask', name: 'Реген-фляга', desc: '+40% HP за 8с', healOverTime: { pct: 0.4, dur: 8 }, cooldown: 3000, price: 90 },
  elixir: { id: 'elixir', name: 'Эликсир', desc: 'Полный хил + 5с неуязвимости', fullHeal: true, invuln: 5, cooldown: 3000, price: 200 },
};

// §14 — материалы (валюта улучшений).
export type MaterialKind = 'shard' | 'essence' | 'boss_core' | 'reroll_dust';

export const MATERIAL_NAMES: Record<MaterialKind, string> = {
  shard: 'Осколки',
  essence: 'Эссенция стихии',
  boss_core: 'Ядро босса',
  reroll_dust: 'Пыль реролла',
};
