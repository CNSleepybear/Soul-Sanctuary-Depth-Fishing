// ===== src/renderer/ui/icons.ts =====
// Unified linear SVG icon set: 16x16 artboard, 1.25px stroke, currentColor.
// Every icon is a pure function of the current text colour, so state styling
// (gold selected / coral danger / dim disabled) is done purely in CSS.
//
// Usage:
//   el.innerHTML = svgIcon('coin', 13);
//   setIcon(btn, 'close', 12);
//   row.innerHTML = `${svgIcon(charmIconName(charm.tags), 12)} ${name}`;

import { rarityColor, RARITY_PIPS } from './theme';

export type IconName =
  | 'rod'
  | 'play'
  | 'close'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronUp'
  | 'book'
  | 'fish'
  | 'soul'
  | 'sparkle'
  | 'settings'
  | 'coin'
  | 'charm'
  | 'relic'
  | 'bait'
  | 'reel'
  | 'tension'
  | 'durability'
  | 'back'
  | 'check'
  | 'pin'
  | 'lock'
  | 'hook'
  | 'rarity'
  | 'link'
  | 'camp'
  | 'daily'
  | 'save'
  | 'trophy'
  | 'export'
  | 'import'
  | 'warn'
  | 'anchor';

const ICONS: Record<IconName, string> = {
  // Fishing rod with reel + line (start / cast).
  rod: '<path d="M2.5 13.5 13 3"/><circle cx="5.1" cy="10.7" r="1.55"/><path d="M13 3c.4 2.9-.2 5.3-1.9 6.7"/><path d="M11.1 9.7a1.35 1.35 0 1 0 1.35 1.35"/>',
  play: '<path d="M5.6 3.2 12.6 8l-7 4.8Z"/>',
  close: '<path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8"/>',
  chevronLeft: '<path d="M10 3.2 5.2 8 10 12.8"/>',
  chevronRight: '<path d="M6 3.2 10.8 8 6 12.8"/>',
  chevronUp: '<path d="M3.2 10 8 5.2 12.8 10"/>',
  // Open field guide.
  book: '<path d="M2.8 4.2c1.9-.9 3.6-.9 5.2 0 1.6-.9 3.3-.9 5.2 0v8.1c-1.9-.9-3.6-.9-5.2 0-1.6-.9-3.3-.9-5.2 0Z"/><path d="M8 4.2v8.1"/>',
  fish: '<path d="M2.4 8c2-2.6 5.6-2.9 8.3-.4l3.1-2.3v5.4l-3.1-2.3C8 11 4.4 10.6 2.4 8Z"/><circle cx="5.6" cy="7.6" r=".55" fill="currentColor" stroke="none"/>',
  // Spirit flame.
  soul: '<path d="M8 2.2c2.3 2.6 4 4.9 4 7.1a4 4 0 0 1-8 0c0-2.2 1.7-4.5 4-7.1Z"/><path d="M8 8.2a2 2 0 0 0 0 4 2 2 0 0 0 0-4Z"/>',
  // Essence spark.
  sparkle:
    '<path d="M8 2.4c.7 2.8 2.8 4.9 5.6 5.6-2.8.7-4.9 2.8-5.6 5.6-.7-2.8-2.8-4.9-5.6-5.6 2.8-.7 4.9-2.8 5.6-5.6Z"/>',
  settings:
    '<path d="M2.6 4.5h10.8M2.6 8h10.8M2.6 11.5h10.8"/><circle cx="6" cy="4.5" r="1.5"/><circle cx="10" cy="8" r="1.5"/><circle cx="5.2" cy="11.5" r="1.5"/>',
  coin: '<circle cx="8" cy="8" r="5.4"/><path d="M9.7 6.2c-.4-.6-1-.9-1.7-.9-1 0-1.7.5-1.7 1.3 0 1.7 3.4 1 3.4 2.9 0 .8-.7 1.4-1.8 1.4-.8 0-1.5-.3-1.9-.9"/>',
  charm:
    '<path d="M8 2.4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 1 1 0-3.8Z"/><path d="M8 6.2v1.5"/><path d="M8 7.7 11 10l-3 3.6L5 10Z"/>',
  relic: '<path d="M5.4 3h5.2L13.6 6.3 8 13.2 2.4 6.3Z"/><path d="M2.4 6.3h11.2"/>',
  bait: '<path d="M2.8 10.6c1.4 0 1.9-1.3 3-2.1 1.2-.9 2.8-.8 3.5.4.7 1.2.1 2.4-1.1 2.7"/><path d="M10.6 5.8c1.5.5 2.4 1.8 2.4 3.2"/><circle cx="10.4" cy="4.9" r="1.05"/>',
  reel: '<circle cx="8" cy="8" r="5.2"/><circle cx="8" cy="8" r="1.4"/><path d="M8 8l3.4-3.4M11.4 4.6h2.2M12.6 4.6v1.8"/>',
  tension:
    '<path d="M2.6 12a5.4 5.4 0 1 1 10.8 0"/><path d="M8 10.4 10.8 6.8"/><circle cx="8" cy="10.4" r="1.1"/>',
  durability:
    '<path d="M8 2.2 13 4v4.1c0 3-2.1 5.3-5 6.4-2.9-1.1-5-3.4-5-6.4V4Z"/><path d="M5.8 7.9 7.4 9.5l2.9-3"/>',
  back: '<path d="M13 8H3.5M7.2 4 3.2 8l4 4"/>',
  check: '<path d="M3 8.4 6.4 11.8 13 4.6"/>',
  pin: '<path d="M8 2.3c-2.5 0-4.5 2-4.5 4.5 0 3.2 4.5 7 4.5 7s4.5-3.8 4.5-7c0-2.5-2-4.5-4.5-4.5Z"/><circle cx="8" cy="6.8" r="1.7"/>',
  lock: '<path d="M5.2 7V5.7a2.8 2.8 0 0 1 5.6 0V7"/><rect x="3.4" y="7" width="9.2" height="6.2" rx="1.6"/>',
  hook: '<path d="M8 2.2v7.3a2.9 2.9 0 0 0 5.8 0"/><path d="M13.8 9.5 12 11.3"/>',
  rarity: '<path d="M8 2.4 13.6 8 8 13.6 2.4 8Z"/><path d="M8 5.6 10.4 8 8 10.4 5.6 8Z"/>',
  link: '<path d="M6.6 9.4 9.4 6.6"/><path d="M5.6 7.8 3.9 9.5a2.3 2.3 0 0 0 3.3 3.3l1.7-1.7"/><path d="M10.4 8.2l1.7-1.7a2.3 2.3 0 0 0-3.3-3.3L7.1 4.9"/>',
  camp: '<path d="M8 3 14 13H2Z"/><path d="M8 8.2V13"/>',
  daily:
    '<circle cx="8" cy="8" r="2.7"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2"/>',
  save: '<path d="M3 3h8.2L13 4.8V13H3Z"/><path d="M5.2 3v3.6h5.4V3"/><path d="M5.2 9.4h5.6V13H5.2Z"/>',
  trophy:
    '<path d="M5.2 3.2h5.6v2.6a2.8 2.8 0 0 1-5.6 0Z"/><path d="M5.2 4.2H3.2v1a2 2 0 0 0 2 2M10.8 4.2h2v1a2 2 0 0 1-2 2"/><path d="M8 8.6v2.6M5.4 13h5.2"/>',
  export: '<path d="M8 10V2.6M4.6 6 8 2.6 11.4 6"/><path d="M3 10.2V13h10v-2.8"/>',
  import: '<path d="M8 2.6V10M4.6 6.6 8 10l3.4-3.4"/><path d="M3 10.2V13h10v-2.8"/>',
  warn: '<path d="M8 2.8 14 13H2Z"/><path d="M8 6.4v3.2"/><circle cx="8" cy="11.4" r=".55" fill="currentColor" stroke="none"/>',
  anchor: '<circle cx="8" cy="4" r="1.6"/><path d="M8 5.6V13M5 8h6M3.4 10.4a4.7 4.7 0 0 0 9.2 0"/>',
};

const SVG_ATTRS =
  'viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

/** Return inline SVG markup for an icon. */
export function svgIcon(name: IconName, size = 16, className = ''): string {
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} width="${size}" height="${size}" ${SVG_ATTRS}>${ICONS[name]}</svg>`;
}

/** Replace an element's content with a single icon. */
export function setIcon(container: Element, name: IconName, size = 16): void {
  container.innerHTML = svgIcon(name, size);
}

/** Build a detached SVG element (for appending to flex rows). */
export function iconEl(name: IconName, size = 16, className = ''): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = svgIcon(name, size, className);
  return template.content.firstElementChild as SVGSVGElement;
}

const CHARM_TAG_ICONS: Record<string, IconName> = {
  hook: 'hook',
  tension: 'tension',
  durability: 'durability',
  progress: 'reel',
  combo: 'link',
  rare: 'sparkle',
  spirit: 'soul',
  gold: 'coin',
  cast: 'rod',
  casts: 'rod',
  bait: 'bait',
  wait: 'tension',
  window: 'hook',
  size: 'fish',
  catch: 'fish',
  burst: 'warn',
  cursed: 'warn',
  high_risk: 'warn',
  random: 'sparkle',
  weather: 'daily',
};

/** Pick a representative icon for a run charm from its tag list. */
export function charmIconName(tags: readonly string[]): IconName {
  for (const tag of tags) {
    const found = CHARM_TAG_ICONS[tag];
    if (found) return found;
  }
  return 'charm';
}

/** Pick an icon for a permanent relic id. */
export function relicIconName(id: string): IconName {
  switch (id) {
    case 'relic_compass':
      return 'pin';
    case 'relic_lantern':
      return 'soul';
    case 'relic_hook':
      return 'hook';
    case 'relic_line':
      return 'reel';
    case 'relic_coin':
      return 'coin';
    case 'relic_anchor':
      return 'anchor';
    case 'relic_feather':
      return 'sparkle';
    case 'relic_echo':
      return 'link';
    default:
      return 'relic';
  }
}

/** Pick an icon for a bait id. */
export function baitIconName(id: string): IconName {
  if (id === 'bait_worm' || id === 'bait_shrimp') return 'bait';
  if (id === 'bait_bread') return 'coin';
  if (id === 'bait_lure_spoon') return 'hook';
  if (id === 'bait_spirit_paste') return 'sparkle';
  return 'bait';
}

/** Achievement icons are emoji in data files — map them to the linear set. */
export function achievementIconName(id: string): IconName {
  if (id.startsWith('pedia')) return 'book';
  if (id === 'catch_rare') return 'rarity';
  if (id === 'catch_legend') return 'trophy';
  if (id === 'catch_mythic') return 'soul';
  if (id.startsWith('perfect')) return 'check';
  if (id.startsWith('total')) return 'fish';
  if (id.startsWith('relic')) return 'relic';
  if (id.startsWith('location')) return 'pin';
  if (id.startsWith('streak')) return 'daily';
  if (id.startsWith('gold')) return 'coin';
  return 'trophy';
}

const PIP_SVG =
  '<svg width="7" height="7" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2.5 13.5 8 8 13.5 2.5 8Z"/></svg>';

/** Rarity pips (1–5 filled diamonds) in the rarity colour. */
export function rarityPips(rarity: string, size = 7): string {
  const count = RARITY_PIPS[rarity] ?? 1;
  const pip =
    size === 7
      ? PIP_SVG
      : `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2.5 13.5 8 8 13.5 2.5 8Z"/></svg>`;
  return `<span class="ss-pips" style="color:${rarityColor(rarity)}" aria-hidden="true">${pip.repeat(count)}</span>`;
}
