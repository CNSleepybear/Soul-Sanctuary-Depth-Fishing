// ===== src/renderer/ui/theme.ts =====
// Design tokens — single source of truth for every UI surface.
// Palette, type scale, radii, borders, shadows and motion follow
// docs/art-direction-v2.md §6 (ink / paper / gold / sage / coral / sky).
// CSS mirrors these values as custom properties in src/styles/main.css.

/** Core palette. Never use pure white or pure black. */
export const PALETTE = {
  ink: '#16191a',
  inkDeep: '#101314',
  inkRaised: '#1e2324',
  inkSoft: 'rgba(22,25,26,0.94)',
  paper: '#efe7d6',
  paperDim: '#b9b4a6',
  paperFaint: 'rgba(239,231,214,0.5)',
  gold: '#e0b978',
  goldDim: 'rgba(224,185,120,0.55)',
  goldSoft: 'rgba(224,185,120,0.14)',
  sage: '#a9c3a0',
  sageSoft: 'rgba(169,195,160,0.14)',
  coral: '#dd8a7a',
  coralSoft: 'rgba(221,138,122,0.14)',
  sky: '#9db6cf',
  skySoft: 'rgba(157,182,207,0.14)',
  line: 'rgba(239,231,214,0.14)',
  lineSoft: 'rgba(239,231,214,0.08)',
  lineStrong: 'rgba(239,231,214,0.26)',
  shadow: 'rgba(8,10,11,0.55)',
} as const;

/** Font stacks: numbers / latin labels use VT323, Chinese uses system sans. */
export const FONT = {
  pixel: "'VT323', monospace",
  sans: "'Microsoft YaHei', 'PingFang SC', 'Segoe UI', sans-serif",
} as const;

/** Type scale — seven steps only (window is tiny). */
export const TYPE = {
  xxs: '7px',
  xs: '8px',
  sm: '9px',
  md: '11px',
  lg: '13px',
  xl: '16px',
  xxl: '20px',
} as const;

/** Corner radii: small 3 / medium 6 / large 10. */
export const RADIUS = {
  sm: '3px',
  md: '6px',
  lg: '10px',
  pill: '999px',
} as const;

export const SHADOW = {
  panel:
    '0 18px 48px rgba(8,10,11,0.55), 0 2px 8px rgba(8,10,11,0.35), inset 0 1px rgba(239,231,214,0.06)',
  card: 'inset 0 1px rgba(239,231,214,0.05), 0 1px 2px rgba(0,0,0,0.35)',
  goldGlow: '0 0 0 1px rgba(224,185,120,0.65), 0 0 16px rgba(224,185,120,0.22)',
  goldGlowStrong: '0 0 0 1px rgba(224,185,120,0.85), 0 0 22px rgba(224,185,120,0.35)',
  tooltip: '0 10px 30px rgba(8,10,11,0.6)',
  insetTop: 'inset 0 1px rgba(239,231,214,0.06)',
} as const;

export const BORDER = {
  hairline: '1px solid rgba(239,231,214,0.14)',
  soft: '1px solid rgba(239,231,214,0.08)',
  strong: '1px solid rgba(239,231,214,0.26)',
  gold: '1px solid rgba(224,185,120,0.7)',
} as const;

/** Motion — 150–220ms, one shared easing curve. */
export const MOTION = {
  fast: '150ms',
  base: '190ms',
  slow: '220ms',
  ease: 'cubic-bezier(0.22,0.61,0.36,1)',
} as const;

/** Fish rarity colour script (matches the pips + card borders). */
export const RARITY = {
  common: PALETTE.paperDim,
  uncommon: PALETTE.sage,
  rare: PALETTE.sky,
  legendary: PALETTE.gold,
  mythic: PALETTE.coral,
} as const;

/** How many pips each rarity badge shows. */
export const RARITY_PIPS: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 4,
  mythic: 5,
};

/** Map a FishRarity / ModifierRarity string to its UI colour. */
export function rarityColor(rarity: string): string {
  if (rarity === 'uncommon') return RARITY.uncommon;
  if (rarity === 'rare') return RARITY.rare;
  if (rarity === 'legendary') return RARITY.legendary;
  if (rarity === 'mythic') return RARITY.mythic;
  if (rarity === 'cursed') return PALETTE.coral;
  return RARITY.common;
}

/**
 * Aggregated theme object. Kept in the legacy shape so every module can
 * import a single `THEME` handle; the fields below map 1:1 to the tokens.
 */
export const THEME = {
  palette: PALETTE,
  font: FONT,
  type: TYPE,
  radiusToken: RADIUS,
  shadow: SHADOW,
  borderToken: BORDER,
  motion: MOTION,
  rarity: RARITY,
  panel: {
    bg: PALETTE.ink,
    bgSoft: PALETTE.inkSoft,
    border: BORDER.hairline,
    radius: RADIUS.lg,
    radiusTop: `${RADIUS.lg} ${RADIUS.lg} 0 0`,
    font: FONT.sans,
    shadow: SHADOW.panel,
  },
  text: {
    primary: PALETTE.paper,
    secondary: PALETTE.paperDim,
    muted: PALETTE.paperFaint,
    dark: 'rgba(239,231,214,0.32)',
    white: '#f7f2e6',
  },
  accent: {
    green: PALETTE.sage,
    greenLight: '#c2d8b9',
    greenDark: '#7f9c77',
    gold: PALETTE.gold,
    goldText: PALETTE.gold,
    amber: '#d9b284',
    yellow: '#e6cf94',
    red: PALETTE.coral,
    redLight: '#eaa89a',
    cyan: PALETTE.sky,
    blue: PALETTE.sky,
    purple: '#b9a9c9',
    pink: '#d8a7bf',
    orange: '#dc9a72',
  },
  border: {
    subtle: PALETTE.lineSoft,
    light: PALETTE.line,
    medium: PALETTE.line,
    strong: PALETTE.lineStrong,
  },
  radius: {
    sm: RADIUS.sm,
    md: RADIUS.md,
    lg: RADIUS.lg,
  },
} as const;

/** Full-width hairline used by section eyebrows. */
export const HAIRLINE = `linear-gradient(90deg, ${PALETTE.line}, transparent)`;
