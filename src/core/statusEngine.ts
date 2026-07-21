// §34, §35 — статусы (DoT/замедл./метки) и реакции стихий.
import {
  STATUS_DEFS,
  ELEMENT_STATUS,
  findReaction,
  REACTIONS,
  type Element,
  type StatusKind,
  type ReactionKind,
} from '../data/elements';

export interface ActiveStatus {
  kind: StatusKind;
  element: Element;
  remaining: number; // сек
  stacks: number;
  sourceAV: number; // AV наносящего — для расчёта DoT
}

export interface StatusState {
  statuses: Map<StatusKind, ActiveStatus>;
  stunT: number; // сек стана
  freezeFullT: number; // сек полного стопа (2 стака льда)
}

export function createStatusState(): StatusState {
  return { statuses: new Map(), stunT: 0, freezeFullT: 0 };
}

export interface ReactionEvent {
  kind: ReactionKind;
  mult: number;
  radius: number;
  stun: number;
  element: Element;
}

// Наложить стихию удара. Может вызвать реакцию (§35).
// Возвращает событие реакции для сцены (burst-урон/AoE), либо null.
export function applyElement(
  state: StatusState,
  element: Element,
  sourceAV: number,
  opts: { arcanePrimed?: boolean; doubleReaction?: boolean } = {},
): ReactionEvent | null {
  if (element === 'none') return null;

  // Сначала ищем реакцию с любым уже висящим статусом другой стихии.
  for (const active of state.statuses.values()) {
    const reactionKind = findReaction(element, active.element);
    if (reactionKind && reactionKind !== 'amplify' && reactionKind !== 'resonance') {
      return triggerReaction(state, reactionKind, element, active, opts);
    }
    if (reactionKind === 'amplify' && active.element === element) {
      // усиление: продлить/усилить существующий статус
      active.remaining = statusDuration(active.kind) * 1.5;
      active.stacks = Math.min(active.stacks + 1, maxStacks(active.kind));
      active.sourceAV = Math.max(active.sourceAV, sourceAV);
      return { kind: 'amplify', mult: 1, radius: 0, stun: 0, element };
    }
  }

  // Аркан — резонанс: помечаем следующую реакцию как удвоенную (через отдельный статус arcane).
  // Просто накладываем статус этой стихии.
  applyStatus(state, element, sourceAV);
  return null;
}

function triggerReaction(
  state: StatusState,
  kind: ReactionKind,
  triggerElement: Element,
  consumed: ActiveStatus,
  opts: { arcanePrimed?: boolean; doubleReaction?: boolean },
): ReactionEvent {
  const def = REACTIONS[kind];
  let mult = def.mult;

  // Резонанс от ранее наложенного Аркана — удваивает реакцию (§35).
  const arcane = state.statuses.get('arcane');
  if (arcane) {
    mult *= 2;
    state.statuses.delete('arcane');
  }
  if (opts.arcanePrimed) mult *= 2;
  if (opts.doubleReaction) mult *= 2; // Сфера Бесконечности / Око Бесконечности

  // Обморожение (§35): усиливает тики Яда/Горения + замедление — оставляем статус, помечаем.
  if (kind === 'frostbite') {
    // усилить существующие DoT
    for (const s of state.statuses.values()) {
      if (s.kind === 'burn' || s.kind === 'poison') s.sourceAV *= 1.5;
    }
  } else {
    // прочие реакции снимают участвовавший статус
    state.statuses.delete(consumed.kind);
  }

  if (def.stun) state.stunT = Math.max(state.stunT, def.stun);

  return {
    kind,
    mult,
    radius: def.radius,
    stun: def.stun ?? 0,
    element: triggerElement,
  };
}

function applyStatus(state: StatusState, element: Element, sourceAV: number): void {
  const kind = ELEMENT_STATUS[element];
  if (!kind) return;
  const existing = state.statuses.get(kind);
  if (existing) {
    existing.remaining = statusDuration(kind);
    existing.stacks = Math.min(existing.stacks + 1, maxStacks(kind));
    existing.sourceAV = Math.max(existing.sourceAV, sourceAV);
  } else {
    state.statuses.set(kind, {
      kind,
      element,
      remaining: statusDuration(kind),
      stacks: 1,
      sourceAV,
    });
  }
  // Лёд: 2 стака -> полный стоп 1с.
  if (kind === 'freeze' && (state.statuses.get('freeze')?.stacks ?? 0) >= 2) {
    state.freezeFullT = Math.max(state.freezeFullT, 1);
  }
}

function statusDuration(kind: StatusKind): number {
  return (STATUS_DEFS as Record<string, { dur: number }>)[kind]?.dur ?? 3;
}
function maxStacks(kind: StatusKind): number {
  return (STATUS_DEFS as Record<string, { maxStacks?: number }>)[kind]?.maxStacks ?? 1;
}

// Тик статусов. Возвращает нанесённый DoT-урон за dt.
export function tickStatus(state: StatusState, dt: number): number {
  let dot = 0;
  for (const [k, s] of state.statuses) {
    s.remaining -= dt;
    if (s.kind === 'burn') {
      dot += STATUS_DEFS.burn.dotCoef * s.sourceAV * dt;
    } else if (s.kind === 'poison') {
      dot += STATUS_DEFS.poison.dotCoef * s.sourceAV * s.stacks * dt;
    }
    if (s.remaining <= 0) state.statuses.delete(k);
  }
  if (state.stunT > 0) state.stunT -= dt;
  if (state.freezeFullT > 0) state.freezeFullT -= dt;
  return dot;
}

// Замедление от Заморозки (§34). 1 = норма, <1 = медленнее.
export function slowFactor(state: StatusState): number {
  if (state.freezeFullT > 0 || state.stunT > 0) return 0;
  const freeze = state.statuses.get('freeze');
  if (freeze) return 1 - STATUS_DEFS.freeze.slow;
  return 1;
}

export function isDisabled(state: StatusState): boolean {
  return state.freezeFullT > 0 || state.stunT > 0;
}

// Множитель получаемого урона от статуса Разлом (§34).
export function vulnMult(state: StatusState): number {
  const rift = state.statuses.get('rift');
  return rift ? 1 + STATUS_DEFS.rift.vuln : 1;
}
