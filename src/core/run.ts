// Рантайм-контекст одного «мира»/забега. Живёт между сценами (singleton).
import { rollStart, type StartLoadout } from './startRoll';
import {
  computeStats,
  type PlayerBuild,
  type ResolvedStats,
  type ArmorPiece,
} from './stats';
import {
  computeLevelCap,
  initLevelState,
  addXP,
  type LevelState,
} from './progression';
import { createWallet, type Wallet } from './economy';
import { HEALS, type HealKind } from '../data/items';
import type { ArmorSlot } from '../data/armor';
import {
  saveWorld,
  getWorld,
  newWorldId,
  type WorldSave,
} from './save';

export class Run {
  loadout: StartLoadout;
  build: PlayerBuild;
  wallet: Wallet;
  levelState: LevelState;
  levelCap: number;
  talentPoints = 0;
  skillPoints = 0;
  heals: Record<HealKind, number> = {
    small_potion: 2,
    big_potion: 0,
    regen_flask: 0,
    elixir: 0,
  };
  selectedHeal: HealKind = 'small_potion';
  worldId: string;
  startedAt: number;
  playtimeMs = 0;
  bossesKilled: string[] = [];
  currentHP = 0;
  reviveUsed = false;

  constructor(loadout: StartLoadout, worldId?: string) {
    this.loadout = loadout;
    this.worldId = worldId ?? newWorldId();
    this.startedAt = Date.now();
    this.levelState = initLevelState();
    this.levelCap = computeLevelCap(loadout);
    this.wallet = createWallet();
    this.build = {
      loadout,
      level: 1,
      weapon: loadout.weapon,
      weaponTier: 1,
      weaponEnchant: 0,
      armor: {},
      allocatedTalents: new Set(),
      allocatedSkills: new Set(),
      evolutionStage: 0,
    };
    this.currentHP = this.stats().maxHP;
  }

  private _statsCache: ResolvedStats | null = null;
  private _statsSig = '';

  // Мемоизация: пересчитываем тяжёлый пайплайн статов только при смене входов.
  // stats() зовётся много раз за кадр (HUD, урон, реген) — кэш убирает лаги.
  stats(): ResolvedStats {
    this.build.level = this.levelState.level;
    const b = this.build;
    let armorSig = '';
    for (const k in b.armor) {
      const p = b.armor[k as ArmorSlot];
      if (p) armorSig += k + p.slot + p.rarity + p.enchant + '|';
    }
    const sig =
      b.level + ':' + b.weapon.name + ':' + b.weaponTier + ':' + b.weaponEnchant + ':' + b.evolutionStage +
      ':' + b.allocatedTalents.size + ':' + b.allocatedSkills.size + ':' + armorSig;
    if (sig !== this._statsSig || !this._statsCache) {
      this._statsSig = sig;
      this._statsCache = computeStats(b);
    }
    return this._statsCache;
  }

  gainXP(amount: number): number {
    const bonus = 1 + this.stats().xpPct;
    const res = addXP(this.levelState, amount * bonus, this.levelCap);
    if (res.levelsGained > 0) {
      this.levelState = res.state;
      this.talentPoints += res.levelsGained;
      this.skillPoints += res.levelsGained;
    } else {
      this.levelState = res.state;
    }
    return res.levelsGained;
  }

  equipArmor(slot: ArmorSlot, piece: ArmorPiece): void {
    this.build.armor[slot] = piece;
    // подлечить пропорционально росту max HP не требуется — просто клампим
    this.currentHP = Math.min(this.currentHP, this.stats().maxHP);
  }

  allocTalent(nodeId: string): boolean {
    if (this.talentPoints <= 0) return false;
    if (this.build.allocatedTalents.has(nodeId)) return false;
    this.build.allocatedTalents.add(nodeId);
    this.talentPoints -= 1;
    return true;
  }

  allocSkill(nodeId: string): boolean {
    if (this.skillPoints <= 0) return false;
    if (this.build.allocatedSkills.has(nodeId)) return false;
    this.build.allocatedSkills.add(nodeId);
    this.skillPoints -= 1;
    return true;
  }

  evolve(stage: number): void {
    this.build.evolutionStage = Math.max(this.build.evolutionStage, stage);
  }

  addPlaytime(ms: number): void {
    this.playtimeMs += ms;
  }

  useHeal(): number {
    const kind = this.selectedHeal;
    if (this.heals[kind] <= 0) return 0;
    const def = HEALS[kind];
    const max = this.stats().maxHP;
    // Нежить не лечится зельями (§15)
    if (this.loadout.race.flag === 'undead') return 0;
    let healed = 0;
    if (def.fullHeal) {
      healed = max - this.currentHP;
      this.currentHP = max;
    } else if (def.healPct) {
      const weak = this.loadout.curse?.flag === 'no_regen' ? 0.5 : 1;
      healed = max * def.healPct * weak;
      this.currentHP = Math.min(max, this.currentHP + healed);
    }
    // healOverTime обрабатывается в WorldScene
    this.heals[kind] -= 1;
    return healed;
  }

  toSave(dead = false): WorldSave {
    return {
      id: this.worldId,
      seedText: this.loadout.seedText,
      classId: this.loadout.classId,
      classRarity: this.loadout.classRarity,
      createdAt: this.startedAt,
      updatedAt: Date.now(),
      level: this.levelState.level,
      xp: this.levelState.xp,
      gold: this.wallet.gold,
      evolutionStage: this.build.evolutionStage,
      bossesKilled: this.bossesKilled,
      playtimeMs: this.playtimeMs,
      allocatedTalents: [...this.build.allocatedTalents],
      allocatedSkills: [...this.build.allocatedSkills],
      talentPoints: this.talentPoints,
      skillPoints: this.skillPoints,
      dead,
    };
  }

  persist(dead = false): void {
    saveWorld(this.toSave(dead));
  }

  static fromSave(id: string): Run | null {
    const w = getWorld(id);
    if (!w) return null;
    const loadout = rollStart(w.seedText);
    const run = new Run(loadout, w.id);
    run.startedAt = w.createdAt;
    run.playtimeMs = w.playtimeMs;
    run.levelState = { level: w.level, xp: w.xp, xpNext: 0 };
    // восстановить xpNext
    run.levelState.xpNext = require_xpNext(w.level);
    run.wallet.gold = w.gold;
    run.bossesKilled = w.bossesKilled ?? [];
    run.build.evolutionStage = w.evolutionStage;
    run.build.allocatedTalents = new Set(w.allocatedTalents ?? []);
    run.build.allocatedSkills = new Set(w.allocatedSkills ?? []);
    run.talentPoints = w.talentPoints ?? 0;
    run.skillPoints = w.skillPoints ?? 0;
    run.currentHP = run.stats().maxHP;
    return run;
  }
}

import { xpToNext } from '../data/balance';
function require_xpNext(level: number): number {
  return xpToNext(level);
}

// ---- Singleton текущего забега ----
let current: Run | null = null;
export function setCurrentRun(run: Run): void {
  current = run;
}
export function getCurrentRun(): Run {
  if (!current) throw new Error('Нет активного забега');
  return current;
}
export function hasCurrentRun(): boolean {
  return current !== null;
}
export function clearCurrentRun(): void {
  current = null;
}
