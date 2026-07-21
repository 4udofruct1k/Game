import { describe, it, expect } from 'vitest';
import { RNG, rollRarity, hashSeed } from '../rng';
import {
  weaponAV,
  damageReduction,
  resReduction,
  applyMitigation,
  computeHit,
  type HitInput,
} from '../damage';
import { xpToNext, addXP, initLevelState, computeLevelCap } from '../progression';
import {
  createStatusState,
  applyElement,
  tickStatus,
} from '../statusEngine';
import { rollStart } from '../startRoll';
import { WEAPON_ITEMS } from '../../data/weapons';
import { RARITY_MULT } from '../../data/rarity';
import { TIER_SCALE } from '../../data/balance';
import { CLASS_STATS, CLASS_ABILITIES } from '../../data/classes';
import { CLASS_SKILL_TREES } from '../../data/skills';

describe('RNG', () => {
  it('детерминирован от сида', () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    expect(a.next()).toBeCloseTo(b.next());
    expect(a.int(1, 100)).toBe(b.int(1, 100));
  });

  it('hashSeed стабилен', () => {
    expect(hashSeed('ash-void-1000')).toBe(hashSeed('ash-void-1000'));
  });

  it('rollRarity возвращает валидный тир, удача сдвигает вправо', () => {
    const rng = new RNG(1);
    const r = rollRarity(rng, 0);
    expect(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).toContain(r);
    // с большой удачей мификов заметно больше, чем без
    let mythLow = 0;
    let mythHigh = 0;
    for (let i = 0; i < 20000; i++) {
      if (rollRarity(new RNG(i), 0) === 'mythic') mythLow++;
      if (rollRarity(new RNG(i), 100) === 'mythic') mythHigh++;
    }
    expect(mythHigh).toBeGreaterThan(mythLow);
  });
});

describe('AV (§30)', () => {
  it('AV одноручного T1 обычн = ARCH_BASE', () => {
    const sword = WEAPON_ITEMS.find((w) => w.id === 'rusty_sword')!;
    expect(weaponAV(sword, 1, 0)).toBeCloseTo(12);
  });

  it('редкость и тир масштабируют AV канонично', () => {
    const sword = WEAPON_ITEMS.find((w) => w.id === 'rusty_sword')!;
    expect(weaponAV(sword, 2, 0)).toBeCloseTo(12 * TIER_SCALE);
    // эпик множитель
    expect(RARITY_MULT.epic).toBe(2.2);
  });

  it('зачарование +5 даёт +40%', () => {
    const sword = WEAPON_ITEMS.find((w) => w.id === 'rusty_sword')!;
    expect(weaponAV(sword, 1, 5)).toBeCloseTo(12 * 1.4);
  });
});

describe('Митигейт (§36)', () => {
  it('броня 400 → 50% DR', () => {
    expect(damageReduction(400)).toBeCloseTo(0.5);
    expect(damageReduction(1200)).toBeCloseTo(0.75);
  });
  it('сопротивление кап 75%', () => {
    expect(resReduction(1e9)).toBeCloseTo(0.75);
  });
  it('истинный урон игнорирует броню', () => {
    expect(applyMitigation(100, true, 1200, 0, 0)).toBeCloseTo(100);
    expect(applyMitigation(100, false, 400, 0, 0)).toBeCloseTo(50);
  });
  it('пробитие снижает эффективную броню', () => {
    const withPen = applyMitigation(100, false, 400, 0, 0.5);
    const noPen = applyMitigation(100, false, 400, 0, 0);
    expect(withPen).toBeGreaterThan(noPen);
  });
});

describe('Урон-пайплайн (§29)', () => {
  it('усиление стихии ×1.35 при совпадении инфузии и оружия', () => {
    const base: HitInput = {
      av: 100,
      classDmgMult: 1,
      classPowerMult: 1,
      pctBonuses: 0,
      coef: 1,
      critChance: 0,
      critMult: 1.5,
      weaponElement: 'fire',
      infusion: 'fire',
      armorPen: 0,
    };
    const matched = computeHit(base, () => 1);
    const neutral = computeHit({ ...base, infusion: 'none' }, () => 1);
    expect(matched.raw / neutral.raw).toBeCloseTo(1.35);
  });

  it('крит применяет множитель', () => {
    const inp: HitInput = {
      av: 100,
      classDmgMult: 1,
      classPowerMult: 1,
      pctBonuses: 0,
      coef: 1,
      critChance: 1,
      critMult: 2,
      weaponElement: 'none',
      infusion: 'none',
      armorPen: 0,
    };
    const r = computeHit(inp, () => 0); // rollCrit<critChance → крит
    expect(r.crit).toBe(true);
    expect(r.raw).toBeCloseTo(200);
  });
});

describe('Опыт и кап (§38)', () => {
  it('xpToNext по формуле', () => {
    expect(xpToNext(1)).toBe(Math.round(20 * Math.pow(1, 1.3)));
    expect(xpToNext(10)).toBe(Math.round(20 * Math.pow(10, 1.3)));
  });

  it('addXP повышает уровень и уважает кап', () => {
    const st = initLevelState();
    const r = addXP(st, 100000, 5);
    expect(r.state.level).toBe(5);
    expect(r.levelsGained).toBe(4);
  });

  it('кап уровня складывается из ролла', () => {
    const l = rollStart('cap-test-seed');
    const cap = computeLevelCap(l);
    expect(cap).toBeGreaterThanOrEqual(100);
    expect(cap).toBeLessThanOrEqual(210);
  });
});

describe('Стихии и реакции (§34-35)', () => {
  it('Огонь+Лёд = Пар (реакция, ×2.5)', () => {
    const s = createStatusState();
    expect(applyElement(s, 'fire', 100)).toBeNull(); // накладывает Горение
    const reaction = applyElement(s, 'ice', 100); // должна сработать реакция
    expect(reaction).not.toBeNull();
    expect(reaction!.kind).toBe('steam');
    expect(reaction!.mult).toBeCloseTo(2.5);
  });

  it('Горение тикает DoT от AV', () => {
    const s = createStatusState();
    applyElement(s, 'fire', 200);
    const dot = tickStatus(s, 1); // 1 секунда
    expect(dot).toBeCloseTo(0.15 * 200);
  });

  it('редкие стихии (Пустота) не реагируют', () => {
    const s = createStatusState();
    applyElement(s, 'fire', 100);
    const r = applyElement(s, 'void', 100);
    expect(r).toBeNull();
  });

  it('Аркан удваивает следующую реакцию (резонанс)', () => {
    const s = createStatusState();
    applyElement(s, 'arcane', 100); // висит Аркан
    applyElement(s, 'fire', 100); // висит Горение
    const r = applyElement(s, 'ice', 100); // Пар, но с резонансом ×2
    expect(r).not.toBeNull();
    expect(r!.mult).toBeCloseTo(5.0);
  });
});

describe('Стартовый ролл (§2)', () => {
  it('детерминирован от текстового сида', () => {
    const a = rollStart('same-seed');
    const b = rollStart('same-seed');
    expect(a.classId).toBe(b.classId);
    expect(a.weapon.id).toBe(b.weapon.id);
    expect(a.race.id).toBe(b.race.id);
  });

  it('класс всегда валиден (любой из 30)', () => {
    for (let i = 0; i < 200; i++) {
      const l = rollStart('seed-' + i);
      expect(Object.keys(CLASS_STATS)).toContain(l.classId);
      // у каждого класса есть дерево навыков и способности
      expect(CLASS_SKILL_TREES[l.classId]).toBeTruthy();
      expect(CLASS_ABILITIES[l.classId]).toBeTruthy();
    }
  });
});
