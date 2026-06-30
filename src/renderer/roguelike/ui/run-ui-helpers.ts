// ===== src/renderer/roguelike/ui/run-ui-helpers.ts =====
// Shared DOM helpers for RunUI sub-panels.

import { THEME } from '../../ui/theme';

/** Create a div with inline style and optional HTML. */
export function d(style: string, html?: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = style;
  if (html) el.innerHTML = html;
  return el;
}

/** Floating tooltip used by charm picker for full details. */
export const tooltip = (() => {
  let el: HTMLDivElement | null = null;
  const ensure = () => {
    if (!el) {
      el = document.createElement('div');
      el.style.cssText = `
        position: fixed; z-index: 300; pointer-events: none;
        max-width: 220px; padding: 8px 10px;
        background: ${THEME.panel.bg};
        border: ${THEME.panel.border};
        border-radius: ${THEME.panel.radius}; color: ${THEME.text.primary};
        font-size: 10px; line-height: 1.45;
        box-shadow: 0 6px 24px rgba(0,0,0,0.5);
        opacity: 0; transition: opacity 0.12s;
      `;
      document.body.appendChild(el);
    }
    return el;
  };
  return {
    show(html: string, anchor: HTMLElement) {
      const t = ensure();
      t.innerHTML = html;
      t.style.display = 'block';
      const rect = anchor.getBoundingClientRect();
      const tRect = t.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tRect.width / 2;
      let top = rect.top - tRect.height - 8;
      if (left < 8) left = 8;
      if (left + tRect.width > window.innerWidth - 8) left = window.innerWidth - tRect.width - 8;
      if (top < 8) top = rect.bottom + 8;
      t.style.left = `${left}px`;
      t.style.top = `${top}px`;
      t.style.opacity = '1';
    },
    hide() {
      if (el) el.style.opacity = '0';
    },
    destroy() {
      if (el && el.parentElement) el.parentElement.removeChild(el);
      el = null;
    },
  };
})();

/** Uniform charm card sizing. */
export const CARD_STYLE = `
  padding: 6px;
  background: rgba(255,255,255,0.06);
  border: ${THEME.panel.border};
  border-radius: ${THEME.panel.radius}; cursor: pointer; text-align: center;
  color: ${THEME.text.primary};
  display: flex; flex-direction: column; align-items: center;
  height: 102px;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.1s;
`;

/** Show a transient toast message. */
export function toast(msg: string): void {
  const t = d(
    `
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
    padding: 6px 16px; background: rgba(0,0,0,0.9);
    border: ${THEME.panel.border};
    color: ${THEME.text.white}; font-size: 10px; font-weight: bold; z-index: 260;
    pointer-events: none; font-family: ${THEME.panel.font};
    border-radius: ${THEME.radius.md}; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  `,
    msg,
  );
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 400);
  }, 2000);
}
