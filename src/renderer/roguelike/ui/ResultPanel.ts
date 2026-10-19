// ===== src/renderer/roguelike/ui/ResultPanel.ts =====
// Run result panel: emotion-graded headline, reward stats, relic discovery and
// the two exits (back to camp / fish again).

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { RunManager } from '../RunManager';
import { ALL_RELICS } from '../relic-data';
import { d } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { svgIcon, charmIconName, relicIconName } from '../../ui/icons';
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

    const isGreat = rewards.gold >= 150;
    const isGood = rewards.gold >= 50;
    const title = isGreat
      ? i18n.t('result.gradeSuccess')
      : isGood
        ? i18n.t('result.gradeComplete')
        : i18n.t('result.gradeShort');
    const titleColor = isGreat ? THEME.accent.gold : isGood ? THEME.text.primary : THEME.text.muted;

    const panel = new DraggablePanel(i18n.t('camp.runComplete'), 296, 'trophy');
    panel.setPosition((window.innerWidth - 296) / 2, (window.innerHeight - 380) / 2);
    const body = panel.getBody();

    // ── Hero ──
    const hero = d();
    hero.className = 'result-hero';
    hero.innerHTML = `
      <span class="result-hero__icon" style="color:${titleColor}">${svgIcon(
        isGreat ? 'trophy' : isGood ? 'check' : 'sparkle',
        22,
      )}</span>
      <span class="result-hero__title" style="color:${titleColor}">${title}</span>
      <span class="result-hero__sub">${i18n.t('camp.runComplete')}</span>`;
    body.appendChild(hero);

    // ── Equipped charms ──
    if (this.runManager.charms.length > 0) {
      const charms = d();
      charms.className = 'result-charms';
      charms.innerHTML = this.runManager.charms
        .map(
          (charm) =>
            `<span title="${i18n.charm(charm.id).name}" style="line-height:0">${svgIcon(
              charmIconName(charm.tags),
              12,
            )}</span>`,
        )
        .join('');
      body.appendChild(charms);
    }

    // ── Reward stats ──
    const stats = d();
    stats.className = 'result-stats';
    const stat = (icon: 'fish' | 'sparkle' | 'coin' | 'relic', value: number, label: string) => `
      <div class="result-stat">
        <span class="result-stat__icon">${svgIcon(icon, 13)}</span>
        <span class="result-stat__main">
          <span class="result-stat__value">${value}</span>
          <span class="result-stat__label">${label}</span>
        </span>
      </div>`;
    stats.innerHTML = [
      stat('fish', rewards.fishCaught, i18n.t('result.fish')),
      stat('sparkle', rewards.perfectCatches, i18n.t('result.perfectCount')),
      stat('coin', rewards.gold, i18n.t('result.goldGain')),
      stat('relic', rewards.spiritEssence, i18n.t('result.essenceGain')),
    ].join('');
    body.appendChild(stats);

    // ── Relic discovery ──
    if (rewards.relicDiscovered) {
      const relic = d();
      relic.className = 'result-relic';
      relic.innerHTML = `
        <span style="line-height:0">${svgIcon(relicIconName(rewards.relicDiscovered.id), 16)}</span>
        <span class="result-relic__main">
          <span class="result-relic__eyebrow">${i18n.t('result.relicFound')}</span>
          <span class="result-relic__name">${i18n.relic(rewards.relicDiscovered.id).name}</span>
        </span>`;
      body.appendChild(relic);
    }

    if (!isGood) {
      const encourage = d();
      encourage.className = 'result-encourage';
      encourage.textContent = i18n.t('result.encourage');
      body.appendChild(encourage);
    }

    // ── Actions ──
    const actions = d();
    actions.className = 'result-actions';

    const retry = d();
    retry.className = 'ss-btn ss-btn--gold';
    retry.innerHTML = `${svgIcon('rod', 12)}<span>${i18n.t('result.fishAgain')}</span>`;
    retry.addEventListener('click', () => {
      panel.remove();
      callbacks.onFishAgain();
    });

    const camp = d();
    camp.className = 'ss-btn ss-btn--ghost';
    camp.innerHTML = `${svgIcon('camp', 11)}<span>${i18n.t('result.backCamp')}</span>`;
    camp.addEventListener('click', () => {
      panel.remove();
      callbacks.onBackToCamp();
    });

    actions.append(retry, camp);
    body.appendChild(actions);

    const foot = d();
    foot.className = 'result-foot';
    foot.textContent = i18n.t('result.pedia', {
      '0': Object.keys(this.gsm.fishpedia).length,
      '1': this.gsm.totalCatches,
    });
    body.appendChild(foot);

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
