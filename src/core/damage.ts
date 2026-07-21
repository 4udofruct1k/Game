// §29–36 — пайплайн урона, крит, митигейт.
import {
  TIER_SCALE,
  ENCHANT_PER_LEVEL,
  ARMOR_K,
  RES_K,
  RES_CAP,
  CRIT_BASE_MULT,
} from '../data/balance';
import { RARITY_MULT, type Rarity } from '../data/rarity';
import { WEAPON_ARCHETYPES, type WeaponItemDef } from '../data/weapons';
import { ELEM_MATCH_MULT, type Element } from '../data/elements';

// §30 — AV предмета оружия.
export function weaponAV(
  weapon: WeaponItemDef,
  tier: number,
  enchantLevel = 0,
  magicPower = 1,
): number {
  const arch = WEAPON_ARCHETYPES[weapon.archetype];
  const base = arch.archBase * (weapon.archetype === 'staff' ? magicPower : 1);
  return (
    base *
    Math.pow(TIER_SCALE, tier - 1) *
    RARITY_MULT[weapon.rarity] *
    (1 + ENCHANT_PER_LEVEL * enchantLevel)
  );
}

export interface HitInput {
  av: number;
  classDmgMult: number; // §31
  classPowerMult: number; // §32
  pctBonuses: number; // Σ% (таланты+навыки+сеты+зачары+уровень)
  coef: number; // 1.0 обычная атака / skillCoef / ultCoef
  critChance: number; // 0..1
  critMult: number; // §34
  weaponElement: Element;
  infusion: Element; // инфузия класса/чара (none = нет)
  armorPen: number; // 0..1 — доля игнора брони (пробитие)
}

export interface HitResult {
  raw: number; // до митигейта
  crit: boolean;
  element: Element; // итоговая стихия удара (для статуса)
  isTrue: boolean; // истинный урон (Пустота)
}

// §34 — итоговая стихия удара и множитель совпадения инфузии/оружия.
export function resolveElement(
  weaponElement: Element,
  infusion: Element,
): { element: Element; matchMult: number } {
  if (infusion !== 'none' && weaponElement !== 'none' && infusion === weaponElement) {
    return { element: weaponElement, matchMult: ELEM_MATCH_MULT }; // усиление
  }
  // если разные — статус наложит наносящий; для «главной» стихии удара берём оружие, иначе инфузию
  const element = weaponElement !== 'none' ? weaponElement : infusion;
  return { element, matchMult: 1.0 };
}

// §29 — вычислить сырой урон удара (до митигейта цели).
export function computeHit(input: HitInput, rollCrit: () => number): HitResult {
  const { element, matchMult } = resolveElement(input.weaponElement, input.infusion);
  const crit = rollCrit() < input.critChance;
  let hit =
    input.av *
    input.classDmgMult *
    input.classPowerMult *
    (1 + input.pctBonuses) *
    input.coef *
    matchMult;
  if (crit) hit *= input.critMult;
  const isTrue = element === 'void';
  return { raw: hit, crit, element, isTrue };
}

// §36 — снижение урона броней/сопротивлением.
export function damageReduction(armor: number): number {
  return armor / (armor + ARMOR_K);
}

export function resReduction(resist: number): number {
  return Math.min(RES_CAP, resist / (resist + RES_K));
}

// Применить митигейт цели к сырому урону.
export function applyMitigation(
  raw: number,
  isTrue: boolean,
  targetArmor: number,
  targetRes: number,
  armorPen: number,
): number {
  if (isTrue) return raw; // истинный урон игнорирует броню
  const effectiveArmor = targetArmor * (1 - armorPen);
  const dr = damageReduction(effectiveArmor);
  const res = resReduction(targetRes);
  const mitigation = 1 - (1 - dr) * (1 - res);
  return raw * (1 - mitigation);
}

// §34 — множитель крита из бонусов.
export function critMultFrom(critDmgBonus: number): number {
  return CRIT_BASE_MULT + critDmgBonus;
}

// Полная свёртка: сырой урон → по цели.
export function fullHit(
  input: HitInput,
  target: { armor: number; res: number },
  rollCrit: () => number,
): { dealt: number; crit: boolean; element: Element; isTrue: boolean } {
  const r = computeHit(input, rollCrit);
  const dealt = applyMitigation(r.raw, r.isTrue, target.armor, target.res, input.armorPen);
  return { dealt, crit: r.crit, element: r.element, isTrue: r.isTrue };
}

export { RARITY_MULT };
export type { Rarity };
