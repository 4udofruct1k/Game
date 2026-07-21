// Сборка итоговых статов игрока из всех источников (§29–39).
import { sumMods, type StatMods } from '../data/mods';
import { CLASS_STATS } from '../data/classes';
import { CLASS_POWER_MULT, RARITY_MULT, type Rarity } from '../data/rarity';
import {
  BASE_HP,
  BASE_MOVE_SPEED,
  BASE_REGEN,
  ENCHANT_PER_LEVEL,
  SET_BONUS_2,
  SET_BONUS_4,
  SET_BONUS_6_MAIN,
  GAMEPLAY,
} from '../data/balance';
import {
  ARMOR_BASE,
  WEIGHT_CLASSES,
  CLASS_WEIGHT,
  CLASS_SETS,
  type ArmorSlot,
  type WeightClass,
} from '../data/armor';
import { TALENT_TREE, CLASS_SKILL_TREES } from '../data/skills';
import { EVOLUTION_MULT } from '../data/classes';
import {
  hpLevelMult,
  dmgLevelBonus,
  regenLevel,
} from './progression';
import { weaponAV } from './damage';
import type { StartLoadout } from './startRoll';
import type { WeaponItemDef } from '../data/weapons';

export interface ArmorPiece {
  setId: string; // ключ CLASS_SETS или универсальный
  slot: ArmorSlot;
  rarity: Rarity;
  weight: WeightClass;
  tier: number;
  enchant: number;
}

export interface PlayerBuild {
  loadout: StartLoadout;
  level: number;
  weapon: WeaponItemDef;
  weaponTier: number;
  weaponEnchant: number;
  armor: Partial<Record<ArmorSlot, ArmorPiece>>;
  allocatedTalents: Set<string>;
  allocatedSkills: Set<string>;
  evolutionStage: number; // 0..3
}

export interface ResolvedStats {
  maxHP: number;
  regen: number;
  moveSpeed: number; // px/с
  atkSpeedMult: number;
  armor: number;
  elemRes: number;
  critChance: number;
  critDmg: number; // добавка к множителю крита
  lifesteal: number;
  cdrPct: number;
  armorPen: number;
  dodge: number;
  luck: number;
  goldPct: number;
  xpPct: number;
  dashCharges: number;
  // боевые множители
  classDmgMult: number;
  classPowerMult: number;
  av: number;
  pctBonuses: number; // Σ% для обычной атаки (dmgPct + уровень)
  skillDmgPct: number; // доп. для навыков/ульты
  elemDmgPct: number; // доп. для стихийных ударов
  evolutionMult: number; // множитель ядра класса
  mods: StatMods; // сырой суммарный набор (для флагов/дебага)
}

// Собрать все StatMods (без деривации).
function collectMods(build: PlayerBuild): StatMods {
  const list: StatMods[] = [];
  const l = build.loadout;

  // Ролл: раса/благо/проклятие/реликвия.
  if (l.race.mods) list.push(l.race.mods);
  if (l.blessing.mods) list.push(l.blessing.mods);
  if (l.curse?.mods) list.push(l.curse.mods);
  if (l.relic?.mods) list.push(l.relic.mods);

  // Таланты.
  for (const b of TALENT_TREE.branches) {
    for (const n of b.nodes) {
      if (build.allocatedTalents.has(n.id)) list.push(n.mods);
    }
  }
  // Классовые навыки.
  const tree = CLASS_SKILL_TREES[l.classId];
  if (tree) {
    for (const b of tree.branches) {
      for (const n of b.nodes) {
        if (build.allocatedSkills.has(n.id)) list.push(n.mods);
      }
    }
  }

  // Броня: база слота + профиль + вес + зачар, всё × RARITY_MULT.
  const setCounts = new Map<string, number>();
  for (const slot of Object.keys(build.armor) as ArmorSlot[]) {
    const piece = build.armor[slot]!;
    const baseDef = ARMOR_BASE[slot];
    const weight = WEIGHT_CLASSES[piece.weight];
    const rm = RARITY_MULT[piece.rarity];
    const ench = 1 + ENCHANT_PER_LEVEL * piece.enchant;
    const armorVal =
      baseDef.armor * weight.armorMult * rm * ench;
    list.push({ armor: armorVal });
    // профильный стат слота
    list.push(scaleMods(baseDef.profile, rm * ench));
    // модификаторы веса
    list.push(weight.mods);
    setCounts.set(piece.setId, (setCounts.get(piece.setId) ?? 0) + 1);
  }

  // Сет-бонусы 2/4/6 (§39).
  for (const [setId, count] of setCounts) {
    const set = CLASS_SETS[setId];
    if (!set) continue;
    const rm = RARITY_MULT[bestSetRarity(build, setId)];
    if (count >= 2) list.push(scaleMods(set.themeMods2, (SET_BONUS_2 / 0.1) * rm));
    if (count >= 4) list.push(scaleMods(set.themeMods4, (SET_BONUS_4 / 0.2) * rm));
    if (count >= 6) {
      // поведенческий мод ядра + бонус к главному стату
      list.push({ dmgPct: SET_BONUS_6_MAIN * rm });
    }
  }

  return sumMods(list);
}

function bestSetRarity(build: PlayerBuild, setId: string): Rarity {
  let best: Rarity = 'common';
  const order: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  for (const slot of Object.keys(build.armor) as ArmorSlot[]) {
    const p = build.armor[slot]!;
    if (p.setId === setId && order.indexOf(p.rarity) > order.indexOf(best)) best = p.rarity;
  }
  return best;
}

function scaleMods(m: StatMods, factor: number): StatMods {
  const out: StatMods = {};
  (Object.keys(m) as (keyof StatMods)[]).forEach((k) => {
    out[k] = (m[k] ?? 0) * factor;
  });
  return out;
}

// Итоговые статы.
export function computeStats(build: PlayerBuild): ResolvedStats {
  const cls = CLASS_STATS[build.loadout.classId];
  const mods = collectMods(build);
  const level = build.level;

  const hpPct = mods.hpPct ?? 0;
  const maxHP =
    BASE_HP * cls.hp * (1 + hpPct) * hpLevelMult(level);

  const regen =
    (regenLevel(level) + (mods.regen ?? 0)) *
    (build.loadout.curse?.flag === 'no_regen' || build.loadout.race.flag === 'undead' ? 0 : 1);

  const moveSpeed =
    BASE_MOVE_SPEED * cls.mobility * (1 + (mods.moveSpeedPct ?? 0)) *
    (build.weapon ? weaponMobility(build.weapon) : 1) * GAMEPLAY.moveSpeedScale; // масштаб в px/с

  const atkSpeedMult =
    cls.atkSpeed * (1 + (mods.atkSpeedPct ?? 0)) * weaponAtkSpeed(build.weapon);

  const av = weaponAV(
    build.weapon,
    build.weaponTier,
    build.weaponEnchant,
    magicPower(cls.id, mods),
  );

  const pctBonuses = (mods.dmgPct ?? 0) + dmgLevelBonus(level);

  return {
    maxHP,
    regen: Math.max(0, regen + BASE_REGEN - 1),
    moveSpeed,
    atkSpeedMult,
    armor: mods.armor ?? 0,
    elemRes: (mods.elemResPct ?? 0) * 300, // перевод в «плоский резист» для формулы §36
    critChance: Math.min(1, 0.05 + (mods.critChance ?? 0)),
    critDmg: mods.critDmg ?? 0,
    lifesteal: mods.lifesteal ?? 0,
    cdrPct: Math.min(0.7, mods.cdrPct ?? 0),
    armorPen: Math.min(1, mods.armorPen ?? 0),
    dodge: Math.min(0.75, mods.dodge ?? 0),
    luck: mods.luck ?? 0,
    goldPct: mods.goldPct ?? 0,
    xpPct: mods.xpPct ?? 0,
    dashCharges: 1 + (mods.dashCharges ?? 0),
    classDmgMult: cls.dmg,
    classPowerMult: CLASS_POWER_MULT[build.loadout.classRarity],
    av,
    pctBonuses,
    skillDmgPct: mods.skillDmgPct ?? 0,
    elemDmgPct: mods.elemDmgPct ?? 0,
    evolutionMult: EVOLUTION_MULT[Math.min(3, build.evolutionStage)],
    mods,
  };
}

// Профильные множители оружия для скорости/моб. (импорт из data/weapons через архетип).
import { WEAPON_ARCHETYPES } from '../data/weapons';
function weaponMobility(w: WeaponItemDef): number {
  return WEAPON_ARCHETYPES[w.archetype].mobilityMult;
}
function weaponAtkSpeed(w: WeaponItemDef): number {
  return WEAPON_ARCHETYPES[w.archetype].atkSpeedMult;
}
function magicPower(classId: string, mods: StatMods): number {
  // Посох масштабируется силой магии: базовая 1 + бонусы урона у кастеров.
  const casters = ['mage', 'pyromancer', 'cryomancer', 'necromancer', 'priest'];
  const base = casters.includes(classId) ? 1.2 : 1.0;
  return base * (1 + (mods.elemDmgPct ?? 0) * 0.5);
}

// Native weight helper (для UI брони).
export function nativeWeight(classId: string): WeightClass {
  return CLASS_WEIGHT[classId] ?? 'medium';
}
