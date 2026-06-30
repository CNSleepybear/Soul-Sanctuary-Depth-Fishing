// ===== src/renderer/roguelike/ui/BaitPicker.ts =====
// Bait selection panel before embarking on a run.

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { d, toast, tooltip } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { BAITS } from '../../../shared/constants';
import { THEME } from '../../ui/theme';
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
    const panel = new DraggablePanel('🪱 Choose Bait', 360);
    panel.setPosition(window.innerWidth / 2 - 180, 50);
    const body = panel.getBody();

    body.append(
      d(
        'color: ${THEME.text.secondary}; font-size: 10px; text-align: center; margin-bottom: 10px;',
        `Carry up to ${pouchSize} bait charges per run`,
      ),
    );

    const cardContainer = d('display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;', '');
    body.appendChild(cardContainer);

    let selectedBaitId = 'bait_worm';
    let selectedAmount = Math.min(pouchSize, this.gsm.getBaitCount('bait_worm'));
    if (selectedAmount <= 0) selectedAmount = Math.min(pouchSize, 1);

    const renderCards = () => {
      cardContainer.innerHTML = '';
      BAITS.forEach((bait) => {
        const owned = this.gsm.getBaitCount(bait.id);
        const selected = selectedBaitId === bait.id;
        const name = i18n.lang === 'zh' ? bait.name.zh : bait.name.en;
        const unavailable = owned <= 0;

        const card = document.createElement('div');
        card.style.cssText = `
          padding: 8px; text-align: left; cursor: ${unavailable ? 'default' : 'pointer'};
          background: ${selected ? 'rgba(68,221,136,0.15)' : unavailable ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)'};
          border: 1px solid ${selected ? 'rgba(68,221,136,0.65)' : unavailable ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.15)'};
          ${selected ? 'box-shadow: 0 0 12px rgba(68,221,136,0.25);' : ''}
          border-radius: ${THEME.radius.lg}; color: ${unavailable ? '#555' : '${THEME.text.primary}'};
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
          display: flex; align-items: center; gap: 8px;
        `;

        const icon = d('font-size: 22px; line-height: 1; flex-shrink: 0;', '🪱');
        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';
        info.innerHTML = `
          <div style="font-size: 11px; font-weight: bold; color: ${unavailable ? '#777' : '#fff'}; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
          <div style="display: flex; gap: 6px; font-size: 9px; color: ${unavailable ? '#555' : '#9ca3af'}; margin-bottom: 4px;">
            <span style="color: ${unavailable ? '#555' : '${THEME.accent.amber}'}">Rare +${bait.rareBonus}%</span>
            <span style="color: ${unavailable ? '#555' : '${THEME.accent.blue}'}">Wait -${bait.waitReduction}s</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px;">
            <span style="color: ${unavailable ? '#444' : '${THEME.accent.greenLight}'};">Hook +${bait.hookWindowBonus}s</span>
            <span style="color: ${unavailable ? '#444' : '${THEME.accent.goldText}'}; font-weight: bold;">×${owned}</span>
          </div>
        `;

        card.append(icon, info);
        card.addEventListener('mouseenter', () => {
          if (unavailable) {
            tooltip.show(i18n.t('bait.outOfStock'), card);
          } else if (!selected) {
            card.style.background = 'rgba(255,255,255,0.14)';
            card.style.borderColor = 'rgba(255,255,255,0.28)';
          }
        });
        card.addEventListener('mouseleave', () => {
          tooltip.hide();
          if (!unavailable && !selected) {
            card.style.background = 'rgba(255,255,255,0.08)';
            card.style.borderColor = 'rgba(255,255,255,0.15)';
          }
        });
        card.addEventListener('click', () => {
          if (unavailable) return;
          selectedBaitId = bait.id;
          selectedAmount = Math.min(pouchSize, owned);
          renderCards();
          updateAmount(selectedAmount);
        });
        cardContainer.appendChild(card);
      });
    };
    renderCards();

    // Amount slider
    const amountRow = d(
      'display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 12px; font-size: 10px; color: ${THEME.text.primary};',
    );
    const amountLabel = document.createElement('span');
    const updateAmount = (val: number) => {
      selectedAmount = Math.max(1, Math.min(val, pouchSize, this.gsm.getBaitCount(selectedBaitId)));
      amountLabel.textContent = `Charges: ${selectedAmount}/${pouchSize}`;
    };
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = String(pouchSize);
    slider.value = String(selectedAmount);
    slider.style.cssText = 'width: 160px; accent-color: ${THEME.accent.green};';
    slider.addEventListener('input', () => updateAmount(Number(slider.value)));
    amountRow.append(amountLabel, slider);
    body.appendChild(amountRow);
    updateAmount(selectedAmount);

    const confirm = d(
      `
      margin-top: 12px; padding: 8px 0; text-align: center;
      background: rgba(68,221,136,0.2); border: 1px solid rgba(68,221,136,0.45);
      color: ${THEME.accent.green}; font-size: 11px; font-weight: bold; cursor: pointer; border-radius: ${THEME.radius.lg};
      transition: background 0.15s, box-shadow 0.15s;
    `,
      'Start Run',
    );
    confirm.addEventListener('mouseenter', () => {
      confirm.style.background = 'rgba(68,221,136,0.32)';
      confirm.style.boxShadow = '0 0 16px rgba(68,221,136,0.25)';
    });
    confirm.addEventListener('mouseleave', () => {
      confirm.style.background = 'rgba(68,221,136,0.2)';
      confirm.style.boxShadow = 'none';
    });
    confirm.addEventListener('click', () => {
      const owned = this.gsm.getBaitCount(selectedBaitId);
      if (owned <= 0) {
        toast('No bait selected!');
        return;
      }
      const charges = Math.min(selectedAmount, owned, pouchSize);
      this.gsm.consumeBait(selectedBaitId, charges);
      panel.remove();
      this.sceneUI.hideBackdrop();
      callbacks.onConfirm(selectedBaitId, charges, charms);
    });
    body.appendChild(confirm);

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
