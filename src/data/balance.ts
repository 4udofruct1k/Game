// §29–39 — числовые константы формул. Единственный источник правды для баланса.

// Базовый размер верстки UI (канвас масштабируется под экран, см. main.ts).
export const BASE_W = 960;
export const BASE_H = 640;

// §30 — AV.
export const TIER_SCALE = 2.4; // ×за кольцо
export const ENCHANT_PER_LEVEL = 0.08; // +8% статов за уровень зачара
export const ENCHANT_MAX = 5; // до +40% (высокая редкость — до 8)
export const SP_UNARMED = 10; // маг без оружия

// §34 — стихии.
export const CRIT_BASE_CHANCE = 0.05;
export const CRIT_BASE_MULT = 1.5;

// §36 — броня/сопротивления.
export const ARMOR_K = 400; // DR = armor/(armor+400)
export const RES_K = 300;
export const RES_CAP = 0.75;

// §37 — рост героя.
export const BASE_HP = 100;
export const BASE_DMG_AV = 10;
export const BASE_MOVE_SPEED = 100; // условные ед. → px/с масштабируется в Player
export const BASE_REGEN = 1;
export const HP_PER_LEVEL = 0.08; // +8%/ур
export const DMG_PER_LEVEL = 0.02; // +2%/ур (часть pctBonuses)
export const REGEN_PER_LEVEL = 0.05;

// §38 — опыт и кап.
export const LEVEL_CAP_BASE = 100;
export function xpToNext(level: number): number {
  return Math.round(20 * Math.pow(level, 1.3));
}

// §39 — ресурсы.
export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 15; // /с
export const ENERGY_COST = { bowShot: 8, thrown: 6, cast: 12, skill: 25 };
export const ULT_CHARGE_FULL = 1000;
export const ULT_CHARGE_PER_DMG = 0.2; // +1 за 5 урона
export const ULT_CHARGE_PER_KILL = 50;

// §39 — существа (доля от статов игрока).
export const PET_DMG_PCT = 0.4;
export const PET_HP_PCT = 0.35;
export const MINION_DMG_PCT = 0.15;
export const MINION_HP_PCT = 0.12;
export const TURRET_DMG_PCT = 0.3;

// §39 — сет-бонусы (масштаб × RARITY_MULT).
export const SET_BONUS_2 = 0.1; // ×RARITY_MULT
export const SET_BONUS_4 = 0.2;
export const SET_BONUS_6_MAIN = 0.25;

// §33 — эволюция (реэкспорт для удобства см. classes.ts EVOLUTION_MULT).

// Общие геймплей-тюнинги среза (не из спеки напрямую — разумные дефолты).
export const GAMEPLAY = {
  dashSpeed: 1200, // px/с
  dashDuration: 175, // мс
  dashCooldown: 900, // мс
  dashIFrames: 190, // мс неуязвимости на рывке
  playerRadius: 13,
  // Очень крупная карта: биомы-кольца ~×10, до края бежать долго. Хаб — прежний.
  worldRadius: 31000, // радиус круглой карты
  hubRadius: 520, // радиус безопасного хаба (не меняем)
  ring1Inner: 640,
  ring1Outer: 6600,
  projectileSpeed: 700,
  enemyProjectileSpeed: 360,
  moveSpeedScale: 6.0, // множитель перевода базовой скорости в px/с (компенсирует масштаб)
};

// 5 концентрических колец между хабом и краем мира.
export const RING_COUNT = 5;
export function ringOuterRadius(i: number): number {
  const band = (GAMEPLAY.worldRadius - GAMEPLAY.hubRadius) / RING_COUNT;
  return GAMEPLAY.hubRadius + i * band;
}
// Название биома по кольцу (0 = хаб).
export const BIOME_NAMES = [
  'Хаб',
  'Зелёные равнины',
  'Топи и пещеры',
  'Выжженные пустоши',
  'Мёрзлые руины',
  'Край Бездны',
];
