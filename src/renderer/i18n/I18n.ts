// ===== src/renderer/i18n/I18n.ts =====
// Lightweight i18n service — no framework dependency.
// Language is read from UserSettings (localStorage), defaults to 'zh'.
// Add new languages by appending to LOCALE_MAP in locales.ts.

import { LOCALE_ZH, LOCALE_EN } from './locales';
import type { LocaleKey } from './locales';

export type Language = 'zh' | 'en';

const LOCALE_MAP: Record<Language, Record<LocaleKey, string>> = {
  zh: LOCALE_ZH,
  en: LOCALE_EN,
};

const STORAGE_KEY = 'soulsanctuary_language';

/**
 * Singleton i18n service.
 * Usage: i18n.t('ui.start') → '▶ 开始' (zh) or '▶ START' (en)
 * Interpolation: i18n.t('camp.embark', { '0': '3', '1': '3' }) → '出发 (3/3)'
 */
class I18nService {
  private _lang: Language = 'zh';

  constructor() {
    // Read persisted preference
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') {
        this._lang = saved;
      }
    } catch {
      // localStorage not available (e.g., SSR) — use default
    }
  }

  get lang(): Language {
    return this._lang;
  }

  /** Switch language and persist. */
  setLanguage(lang: Language): void {
    this._lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* */
    }
  }

  /**
   * Translate a key with optional placeholder interpolation.
   * Placeholders: {0}, {1}, ... — replaced by values from `args`.
   */
  t(key: LocaleKey, args?: Record<string, string | number>): string {
    const locale = LOCALE_MAP[this._lang];
    let text = locale[key] ?? key;
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }

  /**
   * Translate a charm name/desc by ID.
   */
  charm(id: string): { name: string; desc: string } {
    const nameKey = `charm.${id}.name` as LocaleKey;
    const descKey = `charm.${id}.desc` as LocaleKey;
    return { name: this.t(nameKey), desc: this.t(descKey) };
  }

  /**
   * Translate a relic name/desc by ID.
   */
  relic(id: string): { name: string; desc: string } {
    return {
      name: this.t(`relic.${id}.name` as LocaleKey),
      desc: this.t(`relic.${id}.desc` as LocaleKey),
    };
  }

  /**
   * Translate an achievement name/desc by ID.
   */
  achievement(id: string): { name: string; desc: string } {
    return {
      name: this.t(`ach.${id}.name` as LocaleKey),
      desc: this.t(`ach.${id}.desc` as LocaleKey),
    };
  }

  /**
   * Translate an event name/desc by ID.
   */
  event(id: string): { name: string; desc: string } {
    return {
      name: this.t(`evt.${id}.name` as LocaleKey),
      desc: this.t(`evt.${id}.desc` as LocaleKey),
    };
  }

  /**
   * Translate an upgrade name/desc by ID.
   */
  upgrade(id: string): { name: string; desc: string } {
    return {
      name: this.t(`upgrade.${id}.name` as LocaleKey),
      desc: this.t(`upgrade.${id}.desc` as LocaleKey),
    };
  }

  /**
   * Get quest description by template index.
   */
  questDesc(type: string, target: string | number): string {
    // Map quest type + target to locale key
    const mapping: Record<string, string> = {
      'catch_count:3': 'quest.catch_3_common',
      'catch_count:5': 'quest.catch_5_any',
      'catch_count:4': 'quest.catch_4_any',
      'catch_rarity:Uncommon': 'quest.catch_2_uncommon',
      'catch_rarity:Rare': 'quest.catch_1_rare',
      'catch_rarity:Legendary': 'quest.catch_1_legendary',
      'catch_rarity:Mythic': 'quest.catch_1_mythic',
      'perfect_catch:2': 'quest.perfect_2',
      'catch_location:hotspot': 'quest.fish_hotspot',
      'catch_rarity:Uncommon:3': 'quest.catch_3_uncommon_plus',
    };
    const key = `${type}:${target}`;
    if (mapping[key]) return this.t(mapping[key] as LocaleKey);
    // Fallback
    return `${type}: ${target}`;
  }
}

/** Global singleton — import and use directly */
export const i18n = new I18nService();
