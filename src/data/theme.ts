// Общая палитра и цвета placeholder-графики.
export const COLORS = {
  bg: '#0a0a0f',
  hubGround: 0x1c2233,
  ringGround: 0x14301c,
  panel: 0x141420,
  panelBorder: 0x2a2a3f,
  text: '#e8e8f0',
  textDim: '#9a9ab0',
  hp: 0xd64550,
  hpBg: 0x3a1518,
  xp: 0x4fa8e0,
  energy: 0x4fd0e0,
  gold: 0xf0c040,
  ult: 0xc060f0,
  player: 0xf0f0f0,
  telegraph: 0xff4040,
} as const;

// Цвета редкости (лестница §1).
export const RARITY_COLORS: Record<string, number> = {
  common: 0x9aa0a6,
  uncommon: 0x4fae4f,
  rare: 0x4f8fe0,
  epic: 0xa050e0,
  legendary: 0xf0902a,
  mythic: 0xe0403a,
};

// Цвета стихий (§3).
export const ELEMENT_COLORS: Record<string, number> = {
  none: 0xcccccc,
  fire: 0xff5a2a,
  ice: 0x6fd0ff,
  lightning: 0xf5e14a,
  poison: 0x8fdc4a,
  arcane: 0xc060f0,
  void: 0x6a2a9a,
  radiance: 0xfff3b0,
  chaos: 0xff2ad0,
};
