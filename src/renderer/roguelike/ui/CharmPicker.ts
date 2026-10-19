// ===== src/renderer/roguelike/ui/CharmPicker.ts =====
// Charm picker panel: 8 rolled charms, slot-aware selection, rerolls and
// synergy hints. Gold border = chosen; shared tags light up the synergy label.

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { ALL_CHARMS } from '../charm-data';
import { d, tooltip, toast } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { ModifierRarity } from '../../../shared/enums';
import { svgIcon, charmIconName, rarityPips } from '../../ui/icons';
import { rarityColor } from '../../ui/theme';
import type { Modifier } from '../../../shared/types';
import type { LocaleKey } from '../../i18n/locales';

export interface CharmPickerCallbacks {
  onConfirm: (charms: Modifier[]) => void;
  onCancel: () => void;
}

const TAG_KEYS: Record<string, LocaleKey> = {
  hook: 'tag.hook',
  tension: 'tag.tension',
  durability: 'tag.durability',
  progress: 'tag.progress',
  rare: 'tag.rare',
  spirit: 'tag.spirit',
  gold: 'tag.gold',
  cast: 'tag.cast',
  casts: 'tag.casts',
  cursed: 'tag.cursed',
  combo: 'tag.combo',
  wait: 'tag.wait',
  window: 'tag.window',
  size: 'tag.size',
  catch: 'tag.catch',
  burst: 'tag.burst',
  high_risk: 'tag.high_risk',
  random: 'tag.random',
  weather: 'tag.weather',
  event: 'tag.event',
};

export class CharmPicker {
  private gsm: GameStateManager;
  private sceneUI: SceneUI;
  private activePanel: DraggablePanel | null = null;

  constructor(gsm: GameStateManager, sceneUI: SceneUI) {
    this.gsm = gsm;
    this.sceneUI = sceneUI;
  }

  private _tagLabel(tag: string): string {
    const key = TAG_KEYS[tag];
    return key ? i18n.t(key) : `#${tag}`;
  }

  private _rarityLabel(rarity: ModifierRarity): string {
    switch (rarity) {
      case ModifierRarity.Rare:
        return i18n.t('picker.rarity.rare');
      case ModifierRarity.Uncommon:
        return i18n.t('picker.rarity.uncommon');
      case ModifierRarity.Cursed:
        return i18n.t('picker.rarity.cursed');
      default:
        return i18n.t('picker.rarity.common');
    }
  }

  show(callbacks: CharmPickerCallbacks): void {
    const maxSlots = this.gsm.campManager.getMeta().charmSlots;
    const panel = new DraggablePanel(i18n.t('camp.chooseCharms', { '0': maxSlots }), 368, 'charm');
    panel.el.id = 'charm-picker';
    panel.setPosition((window.innerWidth - 368) / 2, (window.innerHeight - 380) / 2);
    const body = panel.getBody();

    // ── Hint + selection counter ──
    const hint = d();
    hint.className = 'picker-hint';
    hint.innerHTML = `${svgIcon('check', 10)}<span>${i18n.t('picker.charmHint')}</span><span class="picker-count" id="charm-count"></span>`;
    body.appendChild(hint);

    let rerolls = this.gsm.campManager.getLevel('charm_rerolls');
    const picked: Modifier[] = [];
    const pool = [...ALL_CHARMS].sort(() => Math.random() - 0.5).slice(0, 8);

    // ── Card grid ──
    const grid = d();
    grid.className = 'charm-grid';
    body.appendChild(grid);

    const countEl = hint.querySelector('#charm-count') as HTMLSpanElement;

    const updateConfirm = () => {
      countEl.textContent = i18n.t('picker.charmCount', {
        '0': String(picked.length),
        '1': String(maxSlots),
      });
      const ready = picked.length === maxSlots;
      confirm.dataset.disabled = String(!ready);
      confirm.innerHTML = `${svgIcon(ready ? 'check' : 'charm', 12)}<span>${i18n.t('camp.embark', {
        '0': String(picked.length),
        '1': String(maxSlots),
      })}</span>`;
    };

    const renderCards = () => {
      grid.innerHTML = '';
      const pickedTags = new Set<string>();
      picked.forEach((c) => c.tags.forEach((tag: string) => pickedTags.add(tag)));

      pool.forEach((charm) => {
        const ci18n = i18n.charm(charm.id);
        const sel = picked.includes(charm);
        const sharedTags = charm.tags.filter((tag: string) => pickedTags.has(tag));
        const hasSynergyHint = !sel && sharedTags.length > 0 && picked.length > 0;
        const color = rarityColor(charm.rarity);

        const card = d();
        card.className = 'charm-card';
        card.dataset.testid = 'charm-card';
        card.dataset.selected = String(sel);
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', ci18n.name);
        card.setAttribute('aria-pressed', String(sel));
        card.tabIndex = 0;
        card.style.setProperty('--rarity-color', color);
        card.innerHTML = `
          ${sel ? `<span class="charm-card__badge">${svgIcon('check', 9)}</span>` : ''}
          <span class="charm-card__icon" style="color:${color}">${svgIcon(
            charmIconName(charm.tags),
            15,
          )}</span>
          <span class="charm-card__name">${ci18n.name}</span>
          <span class="charm-card__desc">${ci18n.desc}</span>
          <span class="charm-card__foot">${
            hasSynergyHint
              ? `<span class="charm-card__synergy">${svgIcon('link', 9)}${i18n.t(
                  'picker.synergyTags',
                  { '0': sharedTags.map((tag: string) => this._tagLabel(tag)).join(' · ') },
                )}</span>`
              : `<span class="charm-card__rarity" style="color:${color}">${this._rarityLabel(
                  charm.rarity,
                )}</span><span class="charm-card__rarity" style="color:${color}">${rarityPips(
                  charm.rarity,
                )}</span>`
          }</span>`;

        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            card.click();
          }
        });
        card.addEventListener('click', () => {
          const idx = picked.indexOf(charm);
          if (idx >= 0) picked.splice(idx, 1);
          else if (picked.length < maxSlots) picked.push(charm);
          updateConfirm();
          renderCards();
        });
        card.addEventListener('mouseenter', () => {
          const tipHtml = `
            <div class="ss-tooltip__head">
              <span style="color:${color};line-height:0">${svgIcon(
                charmIconName(charm.tags),
                15,
              )}</span>
              <span class="ss-tooltip__name">${ci18n.name}</span>
              <span class="ss-tooltip__rarity" style="color:${color}">${this._rarityLabel(
                charm.rarity,
              )}</span>
            </div>
            <div class="ss-tooltip__desc">${ci18n.desc}</div>
            <div class="ss-tooltip__row">${svgIcon('rarity', 9)}${rarityPips(charm.rarity, 8)}</div>
            <div class="ss-tooltip__row">${svgIcon('link', 9)}${i18n.t('picker.tags')} · ${charm.tags
              .map((tag: string) => this._tagLabel(tag))
              .join(' / ')}</div>
            ${
              hasSynergyHint
                ? `<div class="ss-tooltip__synergy">${i18n.t('picker.synergy')} · ${sharedTags
                    .map((tag: string) => this._tagLabel(tag))
                    .join(' · ')}</div>`
                : ''
            }`;
          tooltip.show(tipHtml, card);
        });
        card.addEventListener('mouseleave', () => tooltip.hide());
        card.addEventListener('focus', () => {
          tooltip.show(
            `<div class="ss-tooltip__head"><span class="ss-tooltip__name">${ci18n.name}</span><span class="ss-tooltip__rarity" style="color:${color}">${this._rarityLabel(
              charm.rarity,
            )}</span></div><div class="ss-tooltip__desc">${ci18n.desc}</div>`,
            card,
          );
        });
        card.addEventListener('blur', () => tooltip.hide());
        grid.appendChild(card);
      });
    };

    // ── Reroll ──
    const reroll = d();
    reroll.className = 'picker-reroll';
    const renderReroll = () => {
      reroll.dataset.empty = String(rerolls <= 0);
      reroll.innerHTML = `${svgIcon('reel', 10)}<span>${i18n.t('picker.reroll', {
        '0': String(rerolls),
      })}</span>`;
    };
    reroll.addEventListener('click', () => {
      if (rerolls <= 0) return;
      rerolls--;
      renderReroll();
      pool.length = 0;
      pool.push(...[...ALL_CHARMS].sort(() => Math.random() - 0.5).slice(0, 8));
      picked.length = 0;
      updateConfirm();
      renderCards();
    });
    body.appendChild(reroll);

    // ── Confirm ──
    const confirm = d();
    confirm.id = 'btn-embark';
    confirm.className = 'ss-btn ss-btn--gold';
    confirm.style.marginTop = '7px';
    confirm.addEventListener('click', () => {
      if (picked.length < maxSlots) {
        toast(i18n.t('notify.pickCharms', { '0': maxSlots - picked.length }), 'charm');
        return;
      }
      tooltip.destroy();
      panel.remove();
      this.sceneUI.hideBackdrop();
      callbacks.onConfirm(picked);
    });
    body.appendChild(confirm);

    renderCards();
    renderReroll();
    updateConfirm();

    panel.getCloseBtn().addEventListener('click', () => {
      tooltip.destroy();
      panel.remove();
      callbacks.onCancel();
    });
    document.body.appendChild(panel.el);
    this.activePanel = panel;
  }

  close(): void {
    if (this.activePanel) {
      tooltip.destroy();
      this.activePanel.remove();
      this.activePanel = null;
    }
  }

  dispose(): void {
    this.close();
  }
}
