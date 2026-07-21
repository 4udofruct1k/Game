// Единая модель модификаторов статов — накапливается из талантов/навыков/сетов/зачаров.
export interface StatMods {
  dmgPct?: number; // +% урона (складывается в Σ%)
  critChance?: number; // +абс. шанс крита (0..1)
  critDmg?: number; // +крит.урон (к множителю)
  armorPen?: number; // пробитие брони (0..1)
  bossDmgPct?: number; // +% урона по боссам
  hpPct?: number; // +% max HP
  armor?: number; // +плоская броня
  elemResPct?: number; // +сопр. всем стихиям (0..1)
  regen?: number; // +реген HP/с
  moveSpeedPct?: number; // +% скорости
  atkSpeedPct?: number; // +% скор.атаки
  dodge?: number; // +шанс уворота (0..1)
  dashCharges?: number; // +заряды рывка
  cdrPct?: number; // сокращение перезарядки (0..1)
  lifesteal?: number; // +вампиризм (0..1)
  luck?: number; // +удача
  goldPct?: number; // +% золота
  xpPct?: number; // +% опыта
  elemDmgPct?: number; // +% урона стихией
  skillDmgPct?: number; // +% урона навыков/ульты
}

export const EMPTY_MODS: StatMods = {};

// Сложить два набора модификаторов.
export function addMods(a: StatMods, b: StatMods): StatMods {
  const out: StatMods = { ...a };
  (Object.keys(b) as (keyof StatMods)[]).forEach((k) => {
    out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  });
  return out;
}

export function sumMods(list: StatMods[]): StatMods {
  return list.reduce((acc, m) => addMods(acc, m), {} as StatMods);
}
