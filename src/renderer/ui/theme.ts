// ===== src/renderer/ui/theme.ts =====
// Unified visual constants for all UI panels and roguelike screens.

export const THEME = {
  panel: {
    bg: 'rgba(10,12,20,0.96)',
    border: '1px solid rgba(255,255,255,0.12)',
    radius: '6px',
    radiusTop: '6px 6px 0 0',
    font: "'Courier New', monospace",
    shadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  text: {
    primary: '#e2e8f0',
    secondary: 'rgba(255,255,255,0.55)',
    muted: 'rgba(255,255,255,0.35)',
    dark: '#555',
    white: '#ffffff',
  },
  accent: {
    green: '#44dd88',
    greenLight: '#4ade80',
    greenDark: '#22c55e',
    gold: '#ffd700',
    amber: '#fbbf24',
    yellow: '#ffcc00',
    goldText: '#facc15',
    red: '#ff4444',
    redLight: '#ff6666',
    cyan: '#2288cc',
    blue: '#4488ff',
    purple: '#a78bfa',
    pink: '#ff44cc',
    orange: '#ff8800',
  },
  rarity: {
    common: '#aabbcc',
    uncommon: '#44dd88',
    rare: '#4488ff',
    legendary: '#ff8800',
    mythic: '#ff44cc',
  },
  border: {
    subtle: 'rgba(255,255,255,0.08)',
    light: 'rgba(255,255,255,0.12)',
    medium: 'rgba(255,255,255,0.15)',
    strong: 'rgba(255,255,255,0.25)',
  },
  radius: {
    sm: '2px',
    md: '4px',
    lg: '6px',
    xl: '8px',
    full: '50%',
  },
} as const;
