// ===== src/renderer/roguelike/ui/ResultPanel.ts =====
// Run result panel: rewards, relic discovery, retry/camp buttons.

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { RunManager } from '../RunManager';
import { ALL_RELICS } from '../relic-data';
import { d } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { THEME } from '../../ui/theme';
import type { RunRewards } from '../../../shared/types';

export interface ResultPanelCallbacks {
  onBackToCamp: () => void;
  onFishAgain: () => void;
}

export class ResultPanel {
  private gsm: GameStateManager;
  private runManager: RunManager;
  private sceneUI: SceneUI;
  private activePanel: DraggablePanel | null = null;

  constructor(gsm: GameStateManager, runManager: RunManager, sceneUI: SceneUI) {
    this.gsm = gsm;
    this.runManager = runManager;
    this.sceneUI = sceneUI;
  }

  show(rewards: RunRewards, callbacks: ResultPanelCallbacks): void {
    // Roll relic discovery
    const fishCaught = this.runManager.fishCaughtThisRun;
    const relicId = this.gsm.rollRelicDiscovery(fishCaught);
    if (relicId) {
      rewards.relicDiscovered = ALL_RELICS.find((r) => r.id === relicId) ?? null;
    }

    this.close();
    this.sceneUI.showBackdrop();

    // Emotion grading based on rewards
    const isGreat = rewards.gold >= 150;
    const isGood = rewards.gold >= 50;
    const titleLabel = isGreat
      ? i18n.t('camp.expeditionSuccess')
      : isGood
        ? i18n.t('camp.expeditionComplete')
        : i18n.t('camp.shortTrip');
    const titleColor = isGreat ? THEME.accent.gold : isGood ? '#ccc' : '#887766';

    const panel = new DraggablePanel(titleLabel, 280);
    panel.setPosition(window.innerWidth / 2 - 140, 70);
    const body = panel.getBody();

    const charms = this.runManager.charms.map((c) => c.icon).join(' ');

    let html = `<div style="color:#888;font-size:7px;margin-bottom:8px;">${charms}</div>
       🐟 ${rewards.fishCaught} · ⭐${rewards.perfectCatches}<br>
       💰 +${rewards.gold} · ✨ +${rewards.spiritEssence}`;

    if (rewards.relicDiscovered) {
      html += `<br><br><span style="color:${THEME.accent.gold};">🔮 Discovered: ${rewards.relicDiscovered.icon} ${rewards.relicDiscovered.name}!</span>`;
    }

    if (!isGood) {
      html += `<br><br><span style="color:#887766;font-size:8px;">${i18n.t('camp.shortTripEncourage')}</span>`;
    }

    body.append(
      d(`text-align: center; color: ${titleColor}; font-size: 9px; line-height: 1.8;`, html),
    );

    const camp = d(
      `
      margin-top: 6px; padding: 5px 0; text-align: center;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      color: #aaa; font-size: 9px; cursor: pointer; border-radius: ${THEME.radius.md};
    `,
      i18n.t('camp.backToCamp'),
    );
    camp.addEventListener('click', () => {
      panel.remove();
      callbacks.onBackToCamp();
    });
    body.appendChild(camp);

    const retry = d(
      `
      margin-top: 4px; padding: 5px 0; text-align: center;
      background: rgba(68,221,136,0.12); border: 1px solid rgba(68,221,136,0.25);
      color: ${THEME.accent.green}; font-size: 9px; cursor: pointer; border-radius: ${THEME.radius.md};
    `,
      i18n.t('camp.fishAgain'),
    );
    retry.addEventListener('click', () => {
      panel.remove();
      callbacks.onFishAgain();
    });
    body.appendChild(retry);

    const pediaCount = Object.keys(this.gsm.fishpedia).length;
    body.append(
      d(
        'text-align: center; color: #555; font-size: 7px; margin-top: 6px;',
        i18n.t('camp.fishpediaStat', { '0': pediaCount, '1': this.gsm.totalCatches }),
      ),
    );

    panel.getCloseBtn().addEventListener('click', () => {
      panel.remove();
      this.sceneUI.hideBackdrop();
      this.sceneUI.showStart();
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
