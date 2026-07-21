// §5, §20, §30, §43 — архетипы оружия и именные предметы.
import type { Rarity } from './rarity';
import type { Element } from './elements';

export type WeaponArchetype =
  | 'sword' // Одноручное
  | 'greatsword' // Двуручное
  | 'daggers' // Парные
  | 'spear' // Копьё
  | 'bow' // Лук
  | 'staff' // Посох
  | 'claws' // Когти
  | 'whip' // Кнут
  | 'thrown' // Метательное
  | 'maul'; // Маул

// Паттерн атаки — как движок рисует/наносит удар.
export type AttackPattern =
  | 'melee_arc' // взмах дугой перед собой
  | 'melee_wide' // широкий медленный замах (двуруч/маул)
  | 'melee_thrust' // тычок по линии (копьё)
  | 'melee_flurry' // быстрая серия в упор (парные/когти)
  | 'projectile' // снаряд (посох/метательное)
  | 'charged_shot' // заряжаемый выстрел (лук)
  | 'boomerang'; // бросок с возвратом (метательное)

export interface WeaponArchetypeDef {
  id: WeaponArchetype;
  name: string;
  archBase: number; // §30 ARCH_BASE
  atkSpeedMult: number; // §20
  mobilityMult: number; // §20
  pattern: AttackPattern;
  range: number; // px — дальность/длина удара
  ranged: boolean; // тратит энергию (§39)
  feature: string; // текстовая фишка
}

// §20/§30 — ARCH_BASE и профили. Посох масштабируется силой магии (тот же archBase 12).
export const WEAPON_ARCHETYPES: Record<WeaponArchetype, WeaponArchetypeDef> = {
  sword: { id: 'sword', name: 'Одноручное', archBase: 12, atkSpeedMult: 1.0, mobilityMult: 1.0, pattern: 'melee_arc', range: 70, ranged: false, feature: 'быстрые взмахи дугой' },
  greatsword: { id: 'greatsword', name: 'Двуручное', archBase: 24, atkSpeedMult: 0.5, mobilityMult: 0.85, pattern: 'melee_wide', range: 90, ranged: false, feature: 'широкий замах, нокбэк, стаггер' },
  daggers: { id: 'daggers', name: 'Парные клинки', archBase: 6, atkSpeedMult: 2.2, mobilityMult: 1.1, pattern: 'melee_flurry', range: 55, ranged: false, feature: 'серия в упор, буст крита' },
  spear: { id: 'spear', name: 'Копьё', archBase: 14, atkSpeedMult: 0.9, mobilityMult: 1.0, pattern: 'melee_thrust', range: 120, ranged: false, feature: 'пробивает по линии' },
  bow: { id: 'bow', name: 'Лук', archBase: 15, atkSpeedMult: 0.8, mobilityMult: 0.95, pattern: 'charged_shot', range: 420, ranged: true, feature: 'заряжаемый выстрел, крит по дальним' },
  staff: { id: 'staff', name: 'Посох', archBase: 12, atkSpeedMult: 1.0, mobilityMult: 1.0, pattern: 'projectile', range: 380, ranged: true, feature: 'снаряды от силы магии, несёт стихию' },
  claws: { id: 'claws', name: 'Когти', archBase: 4, atkSpeedMult: 3.0, mobilityMult: 1.2, pattern: 'melee_flurry', range: 48, ranged: false, feature: 'вампиризм, комбо-множитель' },
  whip: { id: 'whip', name: 'Кнут', archBase: 13, atkSpeedMult: 0.7, mobilityMult: 1.0, pattern: 'melee_arc', range: 130, ranged: false, feature: 'контроль толпы, притягивание' },
  thrown: { id: 'thrown', name: 'Метательное', archBase: 12, atkSpeedMult: 1.1, mobilityMult: 1.0, pattern: 'boomerang', range: 340, ranged: true, feature: 'рикошет по нескольким целям' },
  maul: { id: 'maul', name: 'Тяжёлый маул', archBase: 30, atkSpeedMult: 0.4, mobilityMult: 0.7, pattern: 'melee_wide', range: 100, ranged: false, feature: 'слэм по площади, стан' },
};

// §43 — именной предмет оружия.
export interface WeaponItemDef {
  id: string;
  name: string;
  archetype: WeaponArchetype;
  rarity: Rarity;
  element: Element; // врождённая стихия (none = нет)
  affixText: string;
}

// §43 — пул именного оружия (по одному ряду редкостей на архетип из среза).
export const WEAPON_ITEMS: WeaponItemDef[] = [
  // Одноручное
  { id: 'rusty_sword', name: 'Ржавый меч', archetype: 'sword', rarity: 'common', element: 'none', affixText: '—' },
  { id: 'steel_blade', name: 'Стальной клинок', archetype: 'sword', rarity: 'uncommon', element: 'none', affixText: '+8% скор.атаки' },
  { id: 'warden_blade', name: 'Клинок Стража', archetype: 'sword', rarity: 'rare', element: 'none', affixText: '+12% крит' },
  { id: 'flame_estoc', name: 'Пламенный эсток', archetype: 'sword', rarity: 'epic', element: 'fire', affixText: 'Огонь-инфузия (Горение)' },
  { id: 'dawn_blade', name: 'Клинок Зари', archetype: 'sword', rarity: 'legendary', element: 'radiance', affixText: 'Сияние-инфузия, +15% ко всему урону' },
  { id: 'worldcleaver', name: 'Разрубатель Миров', archetype: 'sword', rarity: 'mythic', element: 'none', affixText: 'крит = истинный урон + волна' },
  // Двуручное
  { id: 'heavy_axe', name: 'Тяжёлый топор', archetype: 'greatsword', rarity: 'common', element: 'none', affixText: '—' },
  { id: 'war_axe', name: 'Секира воина', archetype: 'greatsword', rarity: 'uncommon', element: 'none', affixText: '+10% урон нокбэка' },
  { id: 'crusher_hammer', name: 'Молот-Дробитель', archetype: 'greatsword', rarity: 'rare', element: 'none', affixText: 'оглушение при крите' },
  { id: 'ice_guillotine', name: 'Ледяная гильотина', archetype: 'greatsword', rarity: 'epic', element: 'ice', affixText: 'Лёд-инфузия (Заморозка)' },
  { id: 'titan_wrath', name: 'Гнев Титанов', archetype: 'greatsword', rarity: 'legendary', element: 'none', affixText: 'удар создаёт шоквейв' },
  { id: 'heaven_split', name: 'Раскол Небес', archetype: 'greatsword', rarity: 'mythic', element: 'none', affixText: 'каждый 3-й удар = метеор' },
  // Парные
  { id: 'pair_daggers', name: 'Пара кинжалов', archetype: 'daggers', rarity: 'common', element: 'none', affixText: '—' },
  { id: 'twin_blades', name: 'Клинки-близнецы', archetype: 'daggers', rarity: 'uncommon', element: 'none', affixText: '+15% скор.атаки' },
  { id: 'hunter_claws', name: 'Когти охотника', archetype: 'daggers', rarity: 'rare', element: 'none', affixText: '+20% крит' },
  { id: 'poison_sickles', name: 'Ядовитые серпы', archetype: 'daggers', rarity: 'epic', element: 'poison', affixText: 'Яд-инфузия' },
  { id: 'shadow_dance', name: 'Танец Теней', archetype: 'daggers', rarity: 'legendary', element: 'none', affixText: 'каждый 5-й удар удваивается' },
  { id: 'abyss_fangs', name: 'Клыки Бездны', archetype: 'daggers', rarity: 'mythic', element: 'void', affixText: 'удары накладывают Разлом' },
  // Копьё
  { id: 'simple_spear', name: 'Простое копьё', archetype: 'spear', rarity: 'common', element: 'none', affixText: '—' },
  { id: 'guard_pike', name: 'Пика стражника', archetype: 'spear', rarity: 'uncommon', element: 'none', affixText: '+10% дальность' },
  { id: 'whirl_glaive', name: 'Глефа вихря', archetype: 'spear', rarity: 'rare', element: 'none', affixText: 'тычок пробивает +2 цели' },
  { id: 'storm_spear', name: 'Грозовое копьё', archetype: 'spear', rarity: 'epic', element: 'lightning', affixText: 'Молния-инфузия (Заряд)' },
  { id: 'fate_spear', name: 'Копьё Судьбы', archetype: 'spear', rarity: 'legendary', element: 'none', affixText: 'пронзает всю линию' },
  { id: 'world_axis', name: 'Ось Мира', archetype: 'spear', rarity: 'mythic', element: 'void', affixText: 'тычок открывает разлом на линии' },
  // Лук
  { id: 'hunt_bow', name: 'Охотничий лук', archetype: 'bow', rarity: 'common', element: 'none', affixText: '—' },
  { id: 'yew_bow', name: 'Тисовый лук', archetype: 'bow', rarity: 'uncommon', element: 'none', affixText: '+12% дальность' },
  { id: 'ranger_bow', name: 'Лук следопыта', archetype: 'bow', rarity: 'rare', element: 'none', affixText: '+20% крит по дальним' },
  { id: 'flame_bow', name: 'Пламя-лук', archetype: 'bow', rarity: 'epic', element: 'fire', affixText: 'Огонь-инфузия, стрелы взрываются' },
  { id: 'falcon_eye', name: 'Соколиный глаз', archetype: 'bow', rarity: 'legendary', element: 'none', affixText: 'авто-хедшот по цели <50% HP' },
  { id: 'sky_rain', name: 'Небесный Ливень', archetype: 'bow', rarity: 'mythic', element: 'none', affixText: 'выстрел = веер из 3, наводится' },
  // Посох
  { id: 'wood_staff', name: 'Деревянный посох', archetype: 'staff', rarity: 'common', element: 'none', affixText: '—' },
  { id: 'apprentice_staff', name: 'Посох ученика', archetype: 'staff', rarity: 'uncommon', element: 'none', affixText: '+10% сила магии' },
  { id: 'element_wand', name: 'Жезл стихий', archetype: 'staff', rarity: 'rare', element: 'none', affixText: 'снаряды несут стихию' },
  { id: 'inferno_staff', name: 'Посох инферно', archetype: 'staff', rarity: 'epic', element: 'fire', affixText: 'Огонь-инфузия, +урон Горения' },
  { id: 'archmage_scepter', name: 'Скипетр Архимага', archetype: 'staff', rarity: 'legendary', element: 'none', affixText: 'заклинания бьют по площади' },
  { id: 'primordial_staff', name: 'Посох Первоосновы', archetype: 'staff', rarity: 'mythic', element: 'arcane', affixText: 'каждый каст триггерит реакцию' },
  // Метательное
  { id: 'throw_knives', name: 'Метательные ножи', archetype: 'thrown', rarity: 'common', element: 'none', affixText: '—' },
  { id: 'chakram', name: 'Чакрам', archetype: 'thrown', rarity: 'uncommon', element: 'none', affixText: 'возврат ранит повторно' },
  { id: 'boomerang_blade', name: 'Бумеранг-клинок', archetype: 'thrown', rarity: 'rare', element: 'none', affixText: 'рикошет +2 цели' },
  { id: 'ice_stars', name: 'Ледяные звёзды', archetype: 'thrown', rarity: 'epic', element: 'ice', affixText: 'Лёд-инфузия' },
  { id: 'blade_swarm', name: 'Рой лезвий', archetype: 'thrown', rarity: 'legendary', element: 'none', affixText: 'бросок = 3 снаряда веером' },
  { id: 'void_shards', name: 'Осколки Пустоты', archetype: 'thrown', rarity: 'mythic', element: 'void', affixText: 'игнор брони + возврат' },
];

export function weaponsForArchetype(a: WeaponArchetype): WeaponItemDef[] {
  return WEAPON_ITEMS.filter((w) => w.archetype === a);
}
