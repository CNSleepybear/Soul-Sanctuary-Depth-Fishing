// ===== src/renderer/roguelike/ModifierEngine.ts =====
// Stat modification pipeline: stat_add → stat_mult → condition → clamp.
// All Charms, Relics, and Event effects flow through this engine.

import type { Modifier, ModifierEffect } from '../../shared/types';
import { BALANCE, type BalanceKey } from '../../shared/constants';

/** P2-6: Detected synergy — named combo with bonus effect. */
export interface Synergy {
  name: string;
  description: string;
  triggeredTags: string[];
}

/** Final computed stats after all modifiers applied. */
export interface ModifiedStats extends Record<BalanceKey, number> {
  // Stats computed by the engine, not present in base BALANCE
  maxCasts: number;
  lineDurability: number;
  rareBonus: number;
  hookChance: number;
  // Tags applied by modifiers
  tags: Set<string>;
  // P2-6: Active synergies detected from tag combinations
  synergies: Synergy[];
}

/** Mutation helper for accumulating stat changes. */
interface StatDelta {
  add: number;
  mult: number; // cumulative multiplier (starts at 1.0)
}

export class ModifierEngine {
  /**
   * Compute final stats from base BALANCE + active modifiers.
   * Order: stat_add → stat_mult → clamp
   */
  static compute(activeModifiers: Modifier[], eventCtx?: Record<string, unknown>): ModifiedStats {
    const deltas = new Map<string, StatDelta>();
    const tags = new Set<string>();

    // Helper: ensure a delta entry exists
    const ensure = (stat: string): StatDelta => {
      if (!deltas.has(stat)) deltas.set(stat, { add: 0, mult: 1.0 });
      return deltas.get(stat)!;
    };

    // Process all modifier effects
    for (const mod of activeModifiers) {
      for (const effect of mod.effects) {
        this._applyEffect(effect, ensure, tags, eventCtx);
      }
    }

    // Apply deltas to base BALANCE values (numeric keys only)
    const base = Object.fromEntries(
      Object.entries(BALANCE).filter(([, v]) => typeof v === 'number'),
    ) as Record<BalanceKey, number>;
    // Allow modifiers to introduce stats not present in BALANCE (e.g. rareBonus, hookChance)
    const raw: Record<string, number> = { ...base };

    for (const [stat, delta] of deltas) {
      const baseVal = raw[stat] ?? 0;
      // Order: add → multiply → clamp to [0, 999]
      let val = (baseVal + delta.add) * delta.mult;
      val = Math.max(0, Math.min(999, val));
      raw[stat] = val;
    }

    // P2-6: Detect tag-based synergies and apply their flat bonuses after modifiers
    const synergies = ModifierEngine._detectSynergies(activeModifiers);
    const synergyAdds = ModifierEngine._collectSynergyAdds(synergies);
    for (const [stat, add] of synergyAdds) {
      raw[stat] = Math.max(0, Math.min(999, (raw[stat] ?? 0) + add));
    }

    // Apply defaults for stats not present in base BALANCE
    raw.maxCasts ??= 16;
    raw.lineDurability ??= 100;
    raw.rareBonus ??= 0;
    raw.hookChance ??= 0;

    return {
      ...raw,
      tags,
      synergies,
    } as ModifiedStats;
  }

  // P2-6: Auto-detect charm synergies from shared tags across active modifiers
  private static _detectSynergies(modifiers: Modifier[]): Synergy[] {
    const tagCounts = new Map<string, number>();
    for (const mod of modifiers) {
      for (const tag of mod.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const synergies: Synergy[] = [];

    // 3+ 'tension' tags → "Tension Mastery": green zone +10
    if ((tagCounts.get('tension') ?? 0) >= 3) {
      synergies.push({
        name: 'Tension Mastery',
        description: 'Green zone expanded by 10%',
        triggeredTags: ['tension'],
      });
    }

    // 2+ 'hook' tags → "Keen Senses": hook window +0.3s
    if ((tagCounts.get('hook') ?? 0) >= 2) {
      synergies.push({
        name: 'Keen Senses',
        description: 'Hook window +0.3s',
        triggeredTags: ['hook'],
      });
    }

    // 'tension' + 'durability' → "Balanced Approach": slack rate +3
    if ((tagCounts.get('tension') ?? 0) >= 1 && (tagCounts.get('durability') ?? 0) >= 1) {
      synergies.push({
        name: 'Balanced Approach',
        description: 'Slack tension drops 3/s faster',
        triggeredTags: ['tension', 'durability'],
      });
    }

    // 2+ 'progress' tags → "Momentum": progress rate +2
    if ((tagCounts.get('progress') ?? 0) >= 2) {
      synergies.push({
        name: 'Momentum',
        description: 'Base progress rate +2',
        triggeredTags: ['progress'],
      });
    }

    // 2+ 'cast' tags → "Deep Casting": cast depth +15%
    if ((tagCounts.get('cast') ?? 0) >= 2) {
      synergies.push({
        name: 'Deep Casting',
        description: 'Cast depth +15%',
        triggeredTags: ['cast'],
      });
    }

    return synergies;
  }

  // P2-6: Collect flat numerical bonuses from detected synergies.
  // These are applied after modifiers so they are not multiplied by stat_mult effects.
  private static _collectSynergyAdds(synergies: Synergy[]): Map<string, number> {
    const adds = new Map<string, number>();
    const add = (stat: string, value: number): void => {
      adds.set(stat, (adds.get(stat) ?? 0) + value);
    };
    for (const synergy of synergies) {
      switch (synergy.name) {
        case 'Tension Mastery':
          add('tensionGreenMax', 10);
          break;
        case 'Keen Senses':
          add('hookWindowBase', 0.3);
          break;
        case 'Balanced Approach':
          add('tensionSlackRate', 3);
          break;
        case 'Momentum':
          add('fishProgressRate', 2);
          break;
        case 'Deep Casting':
          add('castDepthMult', 0.15);
          break;
      }
    }
    return adds;
  }

  /** Recursively apply a single effect. */
  private static _applyEffect(
    effect: ModifierEffect,
    ensure: (stat: string) => StatDelta,
    tags: Set<string>,
    eventCtx?: Record<string, unknown>,
  ): void {
    switch (effect.type) {
      case 'stat_add': {
        const d = ensure(effect.stat);
        d.add += effect.value;
        break;
      }
      case 'stat_mult': {
        const d = ensure(effect.stat);
        d.mult *= effect.multiplier;
        break;
      }
      case 'condition': {
        // Simple condition check: "tension>50", "isReeling", etc.
        if (this._checkCondition(effect.condition, eventCtx)) {
          for (const sub of effect.then) {
            this._applyEffect(sub, ensure, tags, eventCtx);
          }
        }
        break;
      }
      case 'trigger': {
        // Triggers are event-driven; stored as tags for external checking
        // For now, just process sub-effects unconditionally as a baseline
        for (const sub of effect.action) {
          this._applyEffect(sub, ensure, tags, eventCtx);
        }
        break;
      }
      case 'tag_add': {
        tags.add(effect.tag);
        break;
      }
    }
  }

  /** Simple condition evaluator. */
  private static _checkCondition(cond: string, ctx?: Record<string, unknown>): boolean {
    if (!ctx) return true; // no context = assume true
    // Support: "stat>N", "stat<N", "stat==N" (numeric) and "tag==value" (string)
    const match = cond.match(/^(\w+)\s*(>| <|>=|<=|==|!=)\s*(.+)$/);
    if (match) {
      const [, stat, op, valStr] = match;
      const actualRaw = ctx[stat];
      const actualNum = Number(actualRaw);
      const expectedNum = parseFloat(valStr);

      // Numeric comparison when both sides are numbers
      if (!Number.isNaN(actualNum) && !Number.isNaN(expectedNum)) {
        switch (op) {
          case '>':
            return actualNum > expectedNum;
          case '<':
            return actualNum < expectedNum;
          case '>=':
            return actualNum >= expectedNum;
          case '<=':
            return actualNum <= expectedNum;
          case '==':
            return actualNum === expectedNum;
          case '!=':
            return actualNum !== expectedNum;
        }
      }

      // String comparison (e.g. weather==rain)
      const actualStr = String(actualRaw);
      switch (op) {
        case '==':
          return actualStr === valStr;
        case '!=':
          return actualStr !== valStr;
      }
    }
    // Fallback: check if tag exists in context
    return !!ctx[cond];
  }
}
