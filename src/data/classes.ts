// §4, §31 — классы. Стат-таблица всех 30 (data-driven), детали + деревья у 5 играбельных в срезе.
import type { Rarity } from './rarity';
import type { Element } from './elements';
import type { WeaponArchetype } from './weapons';

export type ResourceKind = 'none' | 'energy' | 'hp' | 'chi' | 'souls' | 'adaptive';

export interface ClassStats {
  id: string;
  name: string;
  rarity: Rarity;
  hp: number; // HP×
  dmg: number; // DMG×
  atkSpeed: number; // Атк.ск×
  mobility: number; // Моб×
  resource: ResourceKind;
  skillCoef: number;
  ultCoef: number;
  native: WeaponArchetype[]; // «родное» оружие (аффинитет)
  affinity: Element; // склонность к стихии (none = нет)
}

// §31 — точная таблица множителей всех 30 классов.
export const CLASS_STATS: Record<string, ClassStats> = {
  warrior: { id: 'warrior', name: 'Воин', rarity: 'common', hp: 1.45, dmg: 1.0, atkSpeed: 0.95, mobility: 0.95, resource: 'none', skillCoef: 2.5, ultCoef: 6.0, native: ['sword', 'greatsword'], affinity: 'none' },
  ranger: { id: 'ranger', name: 'Следопыт', rarity: 'common', hp: 0.85, dmg: 1.1, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.2, ultCoef: 5.5, native: ['bow'], affinity: 'none' },
  mage: { id: 'mage', name: 'Маг', rarity: 'common', hp: 0.72, dmg: 1.0, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 3.0, ultCoef: 7.0, native: ['staff'], affinity: 'arcane' },
  rogue: { id: 'rogue', name: 'Разбойник', rarity: 'common', hp: 0.85, dmg: 0.95, atkSpeed: 1.2, mobility: 1.15, resource: 'none', skillCoef: 2.8, ultCoef: 6.0, native: ['daggers', 'claws'], affinity: 'none' },
  priest: { id: 'priest', name: 'Жрец', rarity: 'common', hp: 0.9, dmg: 0.85, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.4, ultCoef: 6.0, native: ['staff', 'sword'], affinity: 'radiance' },
  barbarian: { id: 'barbarian', name: 'Варвар', rarity: 'common', hp: 1.4, dmg: 1.05, atkSpeed: 0.95, mobility: 0.95, resource: 'none', skillCoef: 2.6, ultCoef: 6.5, native: ['greatsword', 'maul'], affinity: 'none' },
  paladin: { id: 'paladin', name: 'Паладин', rarity: 'uncommon', hp: 1.4, dmg: 0.95, atkSpeed: 0.95, mobility: 0.95, resource: 'energy', skillCoef: 2.4, ultCoef: 6.0, native: ['sword'], affinity: 'radiance' },
  pyromancer: { id: 'pyromancer', name: 'Пиромант', rarity: 'uncommon', hp: 0.72, dmg: 1.0, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 3.2, ultCoef: 7.5, native: ['staff'], affinity: 'fire' },
  cryomancer: { id: 'cryomancer', name: 'Криомант', rarity: 'uncommon', hp: 0.75, dmg: 0.9, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.8, ultCoef: 6.5, native: ['staff'], affinity: 'ice' },
  assassin: { id: 'assassin', name: 'Ассасин', rarity: 'uncommon', hp: 0.8, dmg: 1.15, atkSpeed: 1.2, mobility: 1.15, resource: 'none', skillCoef: 3.2, ultCoef: 7.0, native: ['daggers'], affinity: 'poison' },
  beastmaster: { id: 'beastmaster', name: 'Зверолов', rarity: 'uncommon', hp: 0.9, dmg: 0.8, atkSpeed: 1.0, mobility: 1.05, resource: 'energy', skillCoef: 2.2, ultCoef: 5.5, native: ['bow', 'spear'], affinity: 'none' },
  berserker: { id: 'berserker', name: 'Берсерк', rarity: 'uncommon', hp: 0.95, dmg: 1.05, atkSpeed: 1.25, mobility: 1.05, resource: 'none', skillCoef: 2.6, ultCoef: 6.0, native: ['daggers', 'greatsword'], affinity: 'none' },
  necromancer: { id: 'necromancer', name: 'Некромант', rarity: 'rare', hp: 0.75, dmg: 0.85, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.4, ultCoef: 6.5, native: ['staff'], affinity: 'void' },
  elementalist: { id: 'elementalist', name: 'Элементалист', rarity: 'rare', hp: 0.72, dmg: 1.0, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 3.0, ultCoef: 7.5, native: ['staff'], affinity: 'arcane' },
  spellblade: { id: 'spellblade', name: 'Чароклинок', rarity: 'rare', hp: 1.0, dmg: 1.05, atkSpeed: 1.05, mobility: 1.0, resource: 'energy', skillCoef: 2.8, ultCoef: 6.5, native: ['sword'], affinity: 'arcane' },
  druid: { id: 'druid', name: 'Друид', rarity: 'rare', hp: 1.1, dmg: 0.95, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.6, ultCoef: 6.0, native: ['staff', 'claws'], affinity: 'none' },
  engineer: { id: 'engineer', name: 'Механик', rarity: 'rare', hp: 0.8, dmg: 0.9, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.4, ultCoef: 6.5, native: ['thrown', 'bow'], affinity: 'none' },
  bloodmage: { id: 'bloodmage', name: 'Кровопийца', rarity: 'rare', hp: 1.05, dmg: 1.1, atkSpeed: 1.05, mobility: 1.0, resource: 'hp', skillCoef: 2.8, ultCoef: 6.0, native: ['sword', 'daggers'], affinity: 'none' },
  monk: { id: 'monk', name: 'Монах', rarity: 'rare', hp: 0.85, dmg: 1.0, atkSpeed: 1.25, mobility: 1.15, resource: 'chi', skillCoef: 2.6, ultCoef: 6.5, native: ['claws', 'staff'], affinity: 'none' },
  chronomancer: { id: 'chronomancer', name: 'Хрономант', rarity: 'epic', hp: 0.75, dmg: 0.95, atkSpeed: 1.0, mobility: 1.05, resource: 'energy', skillCoef: 2.8, ultCoef: 7.0, native: ['staff'], affinity: 'arcane' },
  plague: { id: 'plague', name: 'Чумной', rarity: 'epic', hp: 0.75, dmg: 0.9, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.6, ultCoef: 7.0, native: ['staff', 'thrown'], affinity: 'poison' },
  warlock: { id: 'warlock', name: 'Чернокнижник', rarity: 'epic', hp: 0.72, dmg: 1.05, atkSpeed: 1.0, mobility: 1.0, resource: 'hp', skillCoef: 3.0, ultCoef: 7.5, native: ['staff'], affinity: 'void' },
  stormcaller: { id: 'stormcaller', name: 'Буревестник', rarity: 'epic', hp: 0.75, dmg: 1.0, atkSpeed: 1.05, mobility: 1.05, resource: 'energy', skillCoef: 2.8, ultCoef: 7.0, native: ['staff', 'spear'], affinity: 'lightning' },
  illusionist: { id: 'illusionist', name: 'Иллюзионист', rarity: 'epic', hp: 0.75, dmg: 0.9, atkSpeed: 1.0, mobility: 1.05, resource: 'energy', skillCoef: 2.4, ultCoef: 6.5, native: ['staff', 'daggers'], affinity: 'arcane' },
  dragonborn: { id: 'dragonborn', name: 'Драконорождённый', rarity: 'legendary', hp: 1.2, dmg: 1.2, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 3.0, ultCoef: 8.0, native: ['sword', 'spear'], affinity: 'fire' },
  runeweaver: { id: 'runeweaver', name: 'Руновяз', rarity: 'legendary', hp: 0.9, dmg: 1.1, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.8, ultCoef: 7.5, native: ['sword', 'staff'], affinity: 'arcane' },
  reaper: { id: 'reaper', name: 'Жнец душ', rarity: 'legendary', hp: 1.0, dmg: 1.15, atkSpeed: 1.0, mobility: 1.0, resource: 'souls', skillCoef: 2.8, ultCoef: 7.0, native: ['greatsword'], affinity: 'void' },
  ascended: { id: 'ascended', name: 'Вознесённый', rarity: 'mythic', hp: 1.1, dmg: 1.25, atkSpeed: 1.05, mobility: 1.05, resource: 'adaptive', skillCoef: 3.0, ultCoef: 8.0, native: ['sword', 'staff'], affinity: 'radiance' },
  puppeteer: { id: 'puppeteer', name: 'Кукловод', rarity: 'mythic', hp: 0.85, dmg: 0.9, atkSpeed: 1.0, mobility: 1.0, resource: 'energy', skillCoef: 2.4, ultCoef: 7.0, native: ['staff', 'thrown'], affinity: 'arcane' },
  architect: { id: 'architect', name: 'Зодчий', rarity: 'mythic', hp: 0.95, dmg: 0.9, atkSpeed: 1.0, mobility: 0.95, resource: 'energy', skillCoef: 2.4, ultCoef: 7.0, native: ['sword', 'staff'], affinity: 'none' },
};

// Активные способности класса (§4).
export interface ClassAbilities {
  passive: string;
  skill: string; // навык (по кнопке)
  ult: string; // ульта
  branches: [string, string, string]; // темы 3 веток дерева навыков
}

// Детали способностей — для играбельных классов среза (остальные добавим батчами).
export const CLASS_ABILITIES: Record<string, ClassAbilities> = {
  warrior: { passive: '+HP и броня', skill: 'Рассекающий удар (дуга)', ult: 'Вихрь клинков', branches: ['Латник', 'Берсерк', 'Знаменосец'] },
  ranger: { passive: '+дальность, крит по дальним', skill: 'Мультивыстрел', ult: 'Ливень стрел', branches: ['Меткость', 'Ловушки', 'Компаньон'] },
  mage: { passive: '+сила магии', skill: 'Огненный шар', ult: 'Метеор', branches: ['Стихии', 'Чары', 'Барьеры'] },
  rogue: { passive: '+крит, +скорость', skill: 'Удар в спину (рывок-удар)', ult: 'Теневой шквал', branches: ['Скрытность', 'Кровопускание', 'Проворство'] },
  pyromancer: { passive: '+урон Горения', skill: 'Огненная волна', ult: 'Огненный шторм', branches: ['Пламя', 'Пепел', 'Взрыв'] },
};

// §33 — эволюция класса от боссов колец 1-3 (кумулятивный множитель к ядру класса).
export const EVOLUTION_MULT = [1.0, 1.25, 1.5, 2.0]; // ступень 0..3

// Названия ступеней эволюции у играбельных классов.
export const CLASS_EVOLUTIONS: Record<string, string[]> = {
  warrior: ['Воин', 'Джаггернаут', 'Полководец', 'Титан'],
  ranger: ['Следопыт', 'Егерь', 'Мастер лука', 'Соколиный владыка'],
  mage: ['Маг', 'Чародей', 'Архимаг', 'Магистр стихий'],
  rogue: ['Разбойник', 'Головорез', 'Тень', 'Мастер клинков'],
  pyromancer: ['Пиромант', 'Поджигатель', 'Инферналист', 'Владыка пламени'],
};

// Классы, доступные в стартовом ролле среза.
export const PLAYABLE_CLASSES = ['warrior', 'ranger', 'mage', 'rogue', 'pyromancer'];

export function isPlayable(id: string): boolean {
  return PLAYABLE_CLASSES.includes(id);
}
