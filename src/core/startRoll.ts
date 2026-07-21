// §2 — стартовый ролл (слот-машина). Детерминирован от сида мира.
import { RNG, rollRarity, rollFromPool, hashSeed } from './rng';
import { bumpRarity, type Rarity } from '../data/rarity';
import {
  CLASS_STATS,
  CLASS_ABILITIES,
  PLAYABLE_CLASSES,
} from '../data/classes';
import {
  WEAPON_ITEMS,
  weaponsForArchetype,
  type WeaponItemDef,
  type WeaponArchetype,
} from '../data/weapons';
import { BASE_ELEMENTS, type Element } from '../data/elements';
import {
  RACES,
  BLESSINGS,
  CURSES,
  RELICS,
  type RollEntry,
} from '../data/rollPools';

export interface StartLoadout {
  seed: number;
  seedText: string;
  classId: string;
  classRarity: Rarity;
  abilitySkill: string;
  weapon: WeaponItemDef;
  element: Element; // стартовый аффинитет/инфузия (none = нет)
  blessing: RollEntry;
  curse: RollEntry | null;
  relic: RollEntry | null;
  race: RollEntry;
  potential: number; // 0..20 (скрытый), даёт до +20 к капу
}

const CURSE_CHANCE = 0.15; // §2 «редко»
const RELIC_CHANCE = 0.05; // §2 «оч. редко»
const NO_ELEMENT_CHANCE = 0.35; // §2 «может выпасть нет»

// Выбрать играбельный класс редкости targetRarity (или ближайшей ниже).
function rollPlayableClass(rng: RNG, luck: number): { id: string; rarity: Rarity } {
  const target = rollRarity(rng, luck);
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  const ti = order.indexOf(target);
  for (let i = ti; i >= 0; i--) {
    const pool = PLAYABLE_CLASSES.filter(
      (c) => CLASS_STATS[c].rarity === order[i],
    );
    if (pool.length) {
      const id = rng.pick(pool);
      return { id, rarity: CLASS_STATS[id].rarity };
    }
  }
  const id = rng.pick(PLAYABLE_CLASSES);
  return { id, rarity: CLASS_STATS[id].rarity };
}

// Архетипы, для которых в срезе есть именные предметы.
const AVAILABLE_ARCHETYPES = Array.from(new Set(WEAPON_ITEMS.map((w) => w.archetype)));

// §2 — оружие из пула класса, +1 ступень к редкости.
function rollWeapon(
  rng: RNG,
  classId: string,
  luck: number,
): WeaponItemDef {
  // родные архетипы, у которых есть предметы (иначе любой доступный)
  const native = CLASS_STATS[classId].native.filter((a) => AVAILABLE_ARCHETYPES.includes(a));
  const nativePool = native.length ? native : AVAILABLE_ARCHETYPES;
  // 70% — родной архетип, иначе любой доступный
  const arch: WeaponArchetype = rng.chance(0.7)
    ? rng.pick(nativePool)
    : rng.pick(AVAILABLE_ARCHETYPES);
  const pool = weaponsForArchetype(arch);
  const rolled = rollFromPool(rng, pool, luck);
  const targetRarity = bumpRarity(rolled.rarity, 1);
  // подобрать предмет того же архетипа желаемой (bump) редкости, иначе исходный
  const bumped = pool.find((w) => w.rarity === targetRarity);
  return bumped ?? rolled;
}

export function rollStart(seedText: string): StartLoadout {
  const seed = hashSeed(seedText);
  const rng = new RNG(seed);

  // Потенциал (скрытый) влияет на кап; немного влияет на удачу ролла.
  const potential = rng.int(0, 20);
  const luck = potential * 0.5;

  const cls = rollPlayableClass(rng, luck);
  const abilities = CLASS_ABILITIES[cls.id];
  const weapon = rollWeapon(rng, cls.id, luck);

  // Стихия/аффинитет: класс с врождённой стихией тянет к ней, иначе ролл.
  const classAffinity = CLASS_STATS[cls.id].affinity;
  let element: Element = 'none';
  if (!rng.chance(NO_ELEMENT_CHANCE)) {
    element =
      classAffinity !== 'none' && rng.chance(0.6)
        ? classAffinity
        : rng.pick(BASE_ELEMENTS);
  }

  const blessing = rollFromPool(rng, BLESSINGS, luck);
  const curse = rng.chance(CURSE_CHANCE) ? rollFromPool(rng, CURSES, luck) : null;
  const relic = rng.chance(RELIC_CHANCE) ? rollFromPool(rng, RELICS, luck) : null;
  const race = rollFromPool(rng, RACES, luck);

  return {
    seed,
    seedText,
    classId: cls.id,
    classRarity: cls.rarity,
    abilitySkill: abilities.skill,
    weapon,
    element,
    blessing,
    curse,
    relic,
    race,
    potential,
  };
}

// Случайный текстовый сид (для «нового мира»).
export function randomSeedText(): string {
  const words = ['ash', 'void', 'ember', 'frost', 'storm', 'rune', 'grim', 'dawn', 'hex', 'fang'];
  const a = words[Math.floor(Math.random() * words.length)];
  const b = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `${a}-${b}-${n}`;
}
