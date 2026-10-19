// ===== src/renderer/roguelike/ui/run-ui-helpers.ts =====
// Shared DOM helpers for the run sub-panels (camp, pickers, result).
// Presentation lives in main.css; helpers only build structure.

import { svgIcon } from '../../ui/icons';
import type { IconName } from '../../ui/icons';

/** Create a div with optional inline style and optional HTML payload. */
export function d(style = '', html?: string): HTMLDivElement {
  const el = document.createElement('div');
  if (style) el.style.cssText = style;
  if (html) el.innerHTML = html;
  return el;
}

/** Create a span/div with a class + HTML. */
export function el(
  tag: 'div' | 'span',
  className: string,
  html?: string,
): HTMLDivElement | HTMLSpanElement {
  const node = document.createElement(tag);
  node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

/** Icon + label markup helper. */
export function iconLabel(icon: IconName, text: string, size = 11): string {
  return `${svgIcon(icon, size)}<span>${text}</span>`;
}

/** Section header with leading icon and trailing hairline. */
export function sectionTitle(icon: IconName, text: string, count?: string): HTMLDivElement {
  const row = d();
  row.className = 'ss-section-title';
  row.innerHTML = svgIcon(icon, 11) + `<span>${text}</span>`;
  if (count) {
    const badge = document.createElement('span');
    badge.className = 'ss-section-count';
    badge.textContent = count;
    row.appendChild(badge);
  }
  return row;
}

/** Floating tooltip used by the charm/bait pickers for full details. */
export const tooltip = (() => {
  let node: HTMLDivElement | null = null;
  const ensure = (): HTMLDivElement => {
    if (!node) {
      node = document.createElement('div');
      node.className = 'ss-tooltip';
      document.body.appendChild(node);
    }
    return node;
  };
  return {
    show(html: string, anchor: HTMLElement) {
      const t = ensure();
      t.innerHTML = html;
      t.style.left = '0px';
      t.style.top = '0px';
      t.style.opacity = '1';
      const rect = anchor.getBoundingClientRect();
      const tRect = t.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tRect.width / 2;
      let top = rect.top - tRect.height - 8;
      if (left < 8) left = 8;
      if (left + tRect.width > window.innerWidth - 8) left = window.innerWidth - tRect.width - 8;
      if (top < 8) top = rect.bottom + 8;
      if (top + tRect.height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - tRect.height - 8);
      }
      t.style.left = `${left}px`;
      t.style.top = `${top}px`;
    },
    hide() {
      if (node) node.style.opacity = '0';
    },
    destroy() {
      if (node && node.parentElement) node.parentElement.removeChild(node);
      node = null;
    },
  };
})();

/** Transient toast message (single line, bottom centre). */
export function toast(msg: string, icon: IconName = 'sparkle'): void {
  const node = d();
  node.className = 'ss-toast';
  node.innerHTML = `${svgIcon(icon, 12)}<span>${msg}</span>`;
  document.body.appendChild(node);
  window.setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity 220ms cubic-bezier(0.22,0.61,0.36,1)';
    window.setTimeout(() => node.remove(), 260);
  }, 2000);
}
