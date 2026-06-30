// ===== src/renderer/ui/SoulSanctuaryPanel.ts =====
// Collection of mythic fish souls, their memories, and unfolding stories.

import { EventBus } from '../core/EventBus';
import { GameStateManager } from '../core/GameStateManager';
import { FISH_DATABASE } from '../data/fish-database';
import { LOCATIONS } from '../data/location-data';
import { SOUL_STORIES } from '../data/soul-stories';
import { GameEvents } from '../../shared/events';
import { FishRarity } from '../../shared/enums';
import { i18n } from '../i18n/I18n';
import { THEME } from './theme';

export class SoulSanctuaryPanel {
  private eventBus: EventBus;
  private gsm: GameStateManager;
  private container: HTMLDivElement;
  private visible = false;
  private expandedFishId: string | null = null;
  private unreadFishIds = new Set<string>();
  private unsubs: (() => void)[] = [];

  constructor(eventBus: EventBus, gsm: GameStateManager) {
    this.eventBus = eventBus;
    this.gsm = gsm;

    this.container = document.createElement('div');
    this.container.id = 'soul-sanctuary-panel';
    this.container.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 460px; max-width: 92vw; max-height: 85vh;
      background: ${THEME.panel.bg};
      border: ${THEME.panel.border};
      border-radius: ${THEME.panel.radius};
      z-index: 310; display: none; pointer-events: all;
      font-family: ${THEME.panel.font};
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) this.hide();
    });
    document.addEventListener('keydown', this._onKeyDown);
    document.body.appendChild(this.container);

    this._subscribe();
  }

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on(GameEvents.GAME_MYTHIC_CAUGHT, (p) => {
        if (p.isNewDiscovery) this.unreadFishIds.add(p.fishId as string);
        if (this.visible) this._build();
      }),
      this.eventBus.on(GameEvents.GAME_STORY_FRAGMENT_UNLOCKED, (p) => {
        this.unreadFishIds.add(p.fishId as string);
        if (this.visible) this._build();
      }),
      this.eventBus.on(GameEvents.GAME_LOAD, () => {
        if (this.visible) this._build();
      }),
    );
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.hide();
  };

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'block';
    this._build();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.expandedFishId = null;
  }

  private _build(): void {
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      font-size: 11px; color: ${THEME.text.secondary};
      letter-spacing: 2px; margin-bottom: 12px;
      border-bottom: 1px solid ${THEME.border.subtle};
      padding: 12px 16px 8px;
    `;
    header.textContent = i18n.lang === 'zh' ? '灵魂圣地' : 'SOUL SANCTUARY';
    this.container.appendChild(header);

    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = `
      position: absolute; top: 8px; right: 12px;
      color: ${THEME.text.secondary}; font-size: 16px;
      cursor: pointer; pointer-events: all;
    `;
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hide());
    this.container.appendChild(closeBtn);

    const mythicFish = FISH_DATABASE.filter((f) => f.rarity === FishRarity.Mythic);
    const collectedCount = mythicFish.filter((f) => this.gsm.soulCollection[f.id]).length;

    // Soul progress
    const soulProgress = document.createElement('div');
    soulProgress.style.cssText = `
      font-size: 9px; color: ${THEME.accent.pink};
      padding: 0 16px 4px;
    `;
    soulProgress.textContent =
      i18n.lang === 'zh'
        ? `已收集灵魂: ${collectedCount}/${mythicFish.length}`
        : `Souls collected: ${collectedCount}/${mythicFish.length}`;
    this.container.appendChild(soulProgress);

    // Fragment progress
    const totalFragments = mythicFish.reduce((sum, fish) => {
      const story = SOUL_STORIES.find((s) => s.fishId === fish.id);
      return sum + (story?.fragments.length ?? 0);
    }, 0);
    const unlockedFragments = Object.values(this.gsm.soulCollection).reduce(
      (sum, entry) => sum + (entry.storyProgress ?? 0),
      0,
    );
    const fragmentProgress = document.createElement('div');
    fragmentProgress.style.cssText = `
      font-size: 8px; color: ${THEME.text.muted};
      padding: 0 16px 12px;
    `;
    fragmentProgress.textContent =
      i18n.lang === 'zh'
        ? `记忆碎片: ${unlockedFragments}/${totalFragments}`
        : `Memory fragments: ${unlockedFragments}/${totalFragments}`;
    this.container.appendChild(fragmentProgress);

    // Grid of soul cards
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 8px; padding: 0 16px 16px;
    `;

    for (const fish of mythicFish) {
      const soul = this.gsm.soulCollection[fish.id];
      const story = SOUL_STORIES.find((s) => s.fishId === fish.id);
      const isExpanded = this.expandedFishId === fish.id;
      const isUnread = this.unreadFishIds.has(fish.id);
      const loc = LOCATIONS.find((l) => l.id === fish.location);

      const card = document.createElement('div');
      card.style.cssText = `
        background: ${soul ? 'rgba(255,68,204,0.08)' : 'rgba(255,255,255,0.03)'};
        border: 1px solid ${isExpanded ? 'rgba(255,215,0,0.5)' : soul ? 'rgba(255,68,204,0.3)' : 'rgba(255,255,255,0.06)'};
        border-radius: ${THEME.radius.md}; padding: 8px;
        min-height: ${isExpanded ? 'auto' : '90px'};
        cursor: ${soul ? 'pointer' : 'default'};
        pointer-events: ${soul ? 'all' : 'none'};
        transition: background 0.15s, border-color 0.15s;
        grid-column: ${isExpanded ? '1 / -1' : 'auto'};
      `;

      if (soul) {
        card.addEventListener('click', () => {
          this.expandedFishId = isExpanded ? null : fish.id;
          this.unreadFishIds.delete(fish.id);
          this._build();
        });
      }

      // Header row: name + NEW badge
      const nameRow = document.createElement('div');
      nameRow.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 4px;
      `;

      const name = document.createElement('div');
      name.style.cssText = `
        font-size: 10px; color: ${soul ? THEME.accent.gold : THEME.text.dark};
        font-weight: bold;
      `;
      name.textContent = soul ? (i18n.lang === 'zh' ? fish.name.zh : fish.name.en) : '???';
      nameRow.appendChild(name);

      if (isUnread) {
        const badge = document.createElement('span');
        badge.style.cssText = `
          font-size: 7px; color: ${THEME.accent.green}; background: rgba(68,221,136,0.12);
          padding: 1px 4px; border-radius: ${THEME.radius.sm};
        `;
        badge.textContent = 'NEW';
        nameRow.appendChild(badge);
      }
      card.appendChild(nameRow);

      const locName = document.createElement('div');
      locName.style.cssText = `
        font-size: 8px; color: ${soul ? 'rgba(255,255,255,0.5)' : '#444'};
        margin-bottom: 6px;
      `;
      locName.textContent = soul
        ? i18n.lang === 'zh'
          ? (loc?.country ?? '')
          : (loc?.name.en ?? '')
        : i18n.lang === 'zh'
          ? '未觉醒'
          : 'Dormant';
      card.appendChild(locName);

      if (isExpanded && soul && story) {
        // Story reader
        const storyTitle = document.createElement('div');
        storyTitle.style.cssText = `
          font-size: 9px; color: ${THEME.accent.gold};
          margin: 8px 0 6px; letter-spacing: 1px;
          border-bottom: 1px solid rgba(255,215,0,0.15);
          padding-bottom: 4px;
        `;
        storyTitle.textContent = i18n.lang === 'zh' ? story.title.zh : story.title.en;
        card.appendChild(storyTitle);

        const progress = document.createElement('div');
        progress.style.cssText = `
          font-size: 7px; color: rgba(255,255,255,0.35);
          margin-bottom: 8px;
        `;
        progress.textContent =
          i18n.lang === 'zh'
            ? `解锁进度: ${soul.storyProgress}/${story.fragments.length}`
            : `Unlocked: ${soul.storyProgress}/${story.fragments.length}`;
        card.appendChild(progress);

        story.fragments.forEach((fragment, idx) => {
          const unlocked = idx < soul.storyProgress;
          const para = document.createElement('div');
          para.style.cssText = `
            font-size: 7px; line-height: 1.5;
            color: ${unlocked ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.15)'};
            font-style: ${unlocked ? 'italic' : 'normal'};
            margin-bottom: 8px;
            padding-left: 8px;
            border-left: 2px solid ${unlocked ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.06)'};
          `;
          para.textContent = unlocked ? (i18n.lang === 'zh' ? fragment.zh : fragment.en) : '……';
          card.appendChild(para);
        });

        const hint = document.createElement('div');
        hint.style.cssText = `
          font-size: 6px; color: rgba(255,255,255,0.25);
          margin-top: 6px;
        `;
        hint.textContent =
          soul.storyProgress >= story.fragments.length
            ? i18n.lang === 'zh'
              ? '故事已完整'
              : 'Story complete'
            : i18n.lang === 'zh'
              ? `再次捕获 ${fish.name.zh} 可解锁下一段`
              : `Catch ${fish.name.en} again to unlock the next fragment`;
        card.appendChild(hint);
      } else {
        const memory = document.createElement('div');
        memory.style.cssText = `
          font-size: 7px; line-height: 1.4;
          color: ${soul ? 'rgba(255,255,255,0.55)' : '#333'};
          font-style: italic;
        `;
        memory.textContent = soul && fish.mythologyNote ? fish.mythologyNote : '...';
        card.appendChild(memory);
      }

      if (soul && !isExpanded) {
        const date = document.createElement('div');
        date.style.cssText = `
          font-size: 6px; color: rgba(255,255,255,0.3);
          margin-top: 6px;
        `;
        date.textContent = new Date(soul.caughtAt).toLocaleDateString();
        card.appendChild(date);
      }

      grid.appendChild(card);
    }

    this.container.appendChild(grid);
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    document.removeEventListener('keydown', this._onKeyDown);
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
