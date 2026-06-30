// ===== src/renderer/roguelike/event-data.ts =====
// 10 Run Events — random occurrences during fishing with choices.

import type { RunEvent } from '../../shared/types';

export const ALL_EVENTS: RunEvent[] = [
  {
    id: 'evt_blessing',
    name: 'Spirit Blessing',
    description: 'A benevolent water spirit offers you a gift.',
    effect: 'choice',
    choices: [
      { label: 'Accept blessing (+3 progress rate)', outcome: 'blessing_progress' },
      { label: 'Ask for protection (-2 line wear rate)', outcome: 'blessing_protection' },
    ],
    statModifiers: {},
  },
  {
    id: 'evt_storm',
    name: 'Storm Front',
    description: 'Dark clouds gather. The water churns.',
    effect: 'curse',
    statModifiers: { tensionReelRate: 3 },
    duration: 3,
  },
  {
    id: 'evt_frenzy',
    name: 'Fish Frenzy',
    description: 'Fish are biting like crazy! Bites come much faster.',
    effect: 'blessing',
    statModifiers: { waitDurationMin: -1, waitDurationMax: -5 },
    duration: 5,
  },
  {
    id: 'evt_ancient_relic',
    name: 'Ancient Relic',
    description: 'Something glimmers in the depths...',
    effect: 'choice',
    choices: [
      { label: 'Dive for it (risky)', outcome: 'relic_risk' },
      { label: 'Leave it be', outcome: 'relic_pass' },
    ],
    statModifiers: {},
  },
  {
    id: 'evt_mysterious_stranger',
    name: 'Mysterious Stranger',
    description: 'A cloaked figure approaches along the shore.',
    effect: 'choice',
    choices: [
      { label: 'Trade 5 casts for a rare charm', outcome: 'trade_casts' },
      { label: 'Politely decline', outcome: 'stranger_pass' },
    ],
    statModifiers: {},
  },
  {
    id: 'evt_floating_chest',
    name: 'Floating Chest',
    description: 'A locked chest drifts by. Try to open it?',
    effect: 'choice',
    choices: [
      { label: 'Force it open (50% gold, 50% curse)', outcome: 'chest_gamble' },
      { label: 'Ignore it', outcome: 'chest_pass' },
    ],
    statModifiers: {},
  },
  {
    id: 'evt_moonlight',
    name: 'Moonlight Reflection',
    description: 'The moon reflects perfectly on the still water.',
    effect: 'blessing',
    statModifiers: { spiritVariantChance: 0.1 },
    duration: 4,
  },
  {
    id: 'evt_tangled_line',
    name: 'Tangled Line',
    description: 'Your line is hopelessly tangled!',
    effect: 'choice',
    choices: [
      { label: 'Cut and retie (-2 casts)', outcome: 'tangle_cut' },
      { label: 'Patiently untangle (-4 line durability)', outcome: 'tangle_patient' },
    ],
    statModifiers: {},
  },
  {
    id: 'evt_school',
    name: 'Passing School',
    description: 'A massive school of fish swims beneath you.',
    effect: 'blessing',
    statModifiers: { rareBonus: 25 },
    duration: 3,
  },
  {
    id: 'evt_whirlpool',
    name: 'Whirlpool',
    description: 'A sudden whirlpool forms! Quick — what do you do?',
    effect: 'choice',
    choices: [
      { label: 'Reel in fast (tension spike)', outcome: 'whirlpool_reel' },
      { label: 'Slack line and wait (lose 3 casts)', outcome: 'whirlpool_slack' },
    ],
    statModifiers: {},
  },
];
