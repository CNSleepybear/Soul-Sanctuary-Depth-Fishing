// ===== src/renderer/roguelike/achievement-data.ts =====
// 15 milestone achievements across 5 categories.

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: 'fishpedia' | 'rarity' | 'mastery' | 'collection' | 'dedication';
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // ── Fishpedia ──
  {
    id: 'pedia_10',
    name: 'Novice Angler',
    desc: 'Discover 10 fish',
    icon: '📖',
    category: 'fishpedia',
  },
  {
    id: 'pedia_25',
    name: 'Scholar Angler',
    desc: 'Discover 25 fish',
    icon: '📚',
    category: 'fishpedia',
  },
  {
    id: 'pedia_50',
    name: 'Master Angler',
    desc: 'Discover 50 fish',
    icon: '📕',
    category: 'fishpedia',
  },
  {
    id: 'pedia_100',
    name: 'Sage Angler',
    desc: 'Discover 100 fish',
    icon: '📒',
    category: 'fishpedia',
  },

  // ── Rarity ──
  {
    id: 'catch_rare',
    name: 'Rare Find',
    desc: 'Catch your first Rare fish',
    icon: '💎',
    category: 'rarity',
  },
  {
    id: 'catch_legend',
    name: 'Legend Hunter',
    desc: 'Catch your first Legendary fish',
    icon: '👑',
    category: 'rarity',
  },
  {
    id: 'catch_mythic',
    name: 'Mythic Touch',
    desc: 'Catch your first Mythic fish',
    icon: '🌟',
    category: 'rarity',
  },

  // ── Mastery ──
  {
    id: 'perfect_10',
    name: 'Perfect Form',
    desc: 'Land 10 perfect catches',
    icon: '🎯',
    category: 'mastery',
  },
  {
    id: 'total_100',
    name: 'Hundred Haul',
    desc: 'Catch 100 fish total',
    icon: '💯',
    category: 'mastery',
  },
  {
    id: 'total_500',
    name: 'Veteran Fisher',
    desc: 'Catch 500 fish total',
    icon: '🏆',
    category: 'mastery',
  },

  // ── Collection ──
  {
    id: 'relic_3',
    name: 'Relic Collector',
    desc: 'Own 3 relics',
    icon: '🔮',
    category: 'collection',
  },
  { id: 'relic_5', name: 'Relic Hunter', desc: 'Own 5 relics', icon: '💠', category: 'collection' },
  {
    id: 'location_all',
    name: 'World Traveler',
    desc: 'Unlock all 12 sanctuaries',
    icon: '🌍',
    category: 'collection',
  },

  // ── Dedication ──
  {
    id: 'streak_7',
    name: 'Devoted',
    desc: 'Log in 7 days in a row',
    icon: '🔥',
    category: 'dedication',
  },
  {
    id: 'gold_5000',
    name: 'Golden Rod',
    desc: 'Accumulate 5,000 gold',
    icon: '💰',
    category: 'dedication',
  },
];

// Achievement requirements (computed at check time)
export function checkAchievements(
  fishpediaCount: number,
  totalCatches: number,
  perfectCatches: number,
  ownedRelics: number,
  unlockedLocations: number,
  streakDays: number,
  gold: number,
  unlockedIds: Set<string>,
): string[] {
  const newly: string[] = [];
  const add = (id: string) => {
    if (!unlockedIds.has(id)) {
      unlockedIds.add(id);
      newly.push(id);
    }
  };

  if (fishpediaCount >= 10) add('pedia_10');
  if (fishpediaCount >= 25) add('pedia_25');
  if (fishpediaCount >= 50) add('pedia_50');
  if (fishpediaCount >= 100) add('pedia_100');

  if (perfectCatches >= 10) add('perfect_10');
  if (totalCatches >= 100) add('total_100');
  if (totalCatches >= 500) add('total_500');

  if (ownedRelics >= 3) add('relic_3');
  if (ownedRelics >= 5) add('relic_5');
  if (unlockedLocations >= 12) add('location_all');

  if (streakDays >= 7) add('streak_7');
  if (gold >= 5000) add('gold_5000');

  return newly;
}
