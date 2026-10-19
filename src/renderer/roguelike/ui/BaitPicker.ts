// ===== src/renderer/roguelike/ui/BaitPicker.ts =====
// Bait selection panel shown between the charm picker and embark.
// Bait cards carry their rare/wait/hook bonuses; charge count uses a gold slider.

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { d, toast } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { BAITS } from '../../../shared/constants';
import { svgIcon, baitIconName } from '../../ui/icons';
import type { Modifier } from '../../../shared/types';

export interface BaitPickerCallbacks {
  onConfirm: (baitId: string, charges: number, charms: Modifier[]) => void;
  onCancel: () => void;
}

export class BaitPicker {
  private gsm: GameStateManager;
  private sceneUI: SceneUI;
  private activePanel: DraggablePanel | null = null;

  constructor(gsm: GameStateManager, sceneUI: SceneUI) {
    this.gsm = gsm;
    this.sceneUI = sceneUI;
  }

  show(charms: Modifier[], callbacks: BaitPickerCallbacks): void {
    const pouchSize = this.gsm.campManager.getMeta().baitPouchSize;
    const panel = new DraggablePanel(i18n.t('picker.baitTitle'), 368, 'bait');
    panel.el.id = 'bait-picker';
    panel.setPosition((window.innerWidth - 368) / 2, (window.innerHeight - 360) / 2);
    const body = panel.getBody();

    const hint = d();
    hint.className = 'picker-hint';
    hint.innerHTML = `${svgIcon('bait', 10)}<span>${i18n.t('picker.baitHint', {
      '0': String(pouchSize),
    })}</span>`;
    body.appendChild(hint);

    const grid = d();
    grid.className = 'bait-grid';
    body.appendChild(grid);

    let selectedBaitId = 'bait_worm';
    let selectedAmount = Math.min(pouchSize, this.gsm.getBaitCount('bait_worm'));
    if (selectedAmount <= 0) selectedAmount = 1;

    const renderCards = () => {
      grid.innerHTML = '';
      BAITS.forEach((bait) => {
        const owned = this.gsm.getBaitCount(bait.id);
        const selected = selectedBaitId === bait.id;
        const unavailable = owned <= 0;
        const name = i18n.lang === 'zh' ? bait.name.zh : bait.name.en;

        const card = document.createElement('div');
        card.className = 'picker-bait-card';
        card.dataset.selected = String(selected);
        card.dataset.unavailable = String(unavailable);
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', name);
        card.setAttribute('aria-pressed', String(selected));
        card.tabIndex = 0;
        card.innerHTML = `
          <span class="picker-bait-card__icon">${svgIcon(baitIconName(bait.id), 15)}</span>
          <span class="picker-bait-card__main">
            <span class="picker-bait-card__name">${name}</span>
            <span class="picker-bait-card__stats">
              <span class="is-rare">${i18n.t('picker.rare', { '0': bait.rareBonus })}</span>
              <span class="is-wait">${i18n.t('picker.wait', { '0': bait.waitReduction })}</span>
              <span class="is-hook">${i18n.t('picker.hook', { '0': bait.hookWindowBonus })}</span>
            </span>
          </span>
          <span class="picker-bait-card__owned">${i18n.t('picker.owned', { '0': owned })}</span>`;

        const choose = () => {
          if (unavailable) {
            toast(i18n.t('bait.outOfStock'), 'bait');
            return;
          }
          selectedBaitId = bait.id;
          selectedAmount = Math.min(pouchSize, owned);
          slider.value = String(selectedAmount);
          renderCards();
          updateAmount(selectedAmount);
        };
        card.addEventListener('click', choose);
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose();
          }
        });
        card.addEventListener('mouseenter', () => {
          if (!unavailable) card.style.borderColor = 'rgba(224,185,120,0.4)';
        });
        card.addEventListener('mouseleave', () => {
          if (!unavailable && !selected) card.style.borderColor = '';
        });
        grid.appendChild(card);
      });
    };

    // ── Charge slider ──
    const amountRow = d();
    amountRow.className = 'picker-amount';
    const amountLabel = document.createElement('span');
    amountLabel.className = 'picker-amount__label';
    amountLabel.innerHTML = `${svgIcon('bait', 11)}<span></span>`;
    const amountText = amountLabel.querySelector('span') as HTMLSpanElement;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'ss-range';
    slider.min = '1';
    slider.max = String(pouchSize);
    slider.value = String(selectedAmount);

    const updateAmount = (val: number) => {
      selectedAmount = Math.max(
        1,
        Math.min(val, pouchSize, Math.max(1, this.gsm.getBaitCount(selectedBaitId))),
      );
      amountText.textContent = i18n.t('picker.charges', {
        '0': String(selectedAmount),
        '1': String(pouchSize),
      });
    };
    slider.addEventListener('input', () => updateAmount(Number(slider.value)));
    amountRow.append(amountLabel, slider);
    body.appendChild(amountRow);
    updateAmount(selectedAmount);

    // ── Confirm ──
    const confirm = d();
    confirm.id = 'btn-confirm-bait';
    confirm.className = 'ss-btn ss-btn--gold';
    confirm.style.marginTop = '8px';
    confirm.innerHTML = `${svgIcon('rod', 12)}<span>${i18n.t('camp.startRun')}</span>`;
    confirm.addEventListener('click', () => {
      const owned = this.gsm.getBaitCount(selectedBaitId);
      if (owned <= 0) {
        toast(i18n.t('bait.outOfStock'), 'bait');
        return;
      }
      const charges = Math.min(selectedAmount, owned, pouchSize);
      this.gsm.consumeBait(selectedBaitId, charges);
      panel.remove();
      this.sceneUI.hideBackdrop();
      callbacks.onConfirm(selectedBaitId, charges, charms);
    });
    body.appendChild(confirm);

    renderCards();

    panel.getCloseBtn().addEventListener('click', () => {
      panel.remove();
      callbacks.onCancel();
    });
    document.body.appendChild(panel.el);
    this.activePanel = panel;
  }

  close(): void {
    if (this.activePanel) {
      this.activePanel.remove();
      this.activePanel = null;
    }
  }

  dispose(): void {
    this.close();
  }
}
