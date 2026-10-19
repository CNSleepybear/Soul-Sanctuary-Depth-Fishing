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
import { svgIcon } from './icons';

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
    this.container.className = 'collection-panel';
    this.container.style.display = 'none';

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
    this.container.style.display = 'flex';
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

    const header = document.createElement('div');
    header.className = 'soul-head';
    const title = document.createElement('div');
    title.className = 'soul-title';
    title.innerHTML = `
      <span class="soul-title__icon">${svgIcon('soul', 15)}</span>
      <span class="soul-title__text">${i18n.t('soul.title')}</span>
    `;
    header.appendChild(title);

    const closeBtn = document.createElement('div');
    closeBtn.className = 'pedia-close';
    closeBtn.setAttribute('role', 'button');
    closeBtn.setAttribute('aria-label', i18n.t('ui.close'));
    closeBtn.tabIndex = 0;
    closeBtn.innerHTML = svgIcon('close', 12);
    const close = () => this.hide();
    closeBtn.addEventListener('click', close);
    closeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        close();
      }
    });
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    const mythicFish = FISH_DATABASE.filter((f) => f.rarity === FishRarity.Mythic);
    const collectedCount = mythicFish.filter((f) => this.gsm.soulCollection[f.id]).length;
    const totalFragments = mythicFish.reduce((sum, fish) => {
      const story = SOUL_STORIES.find((s) => s.fishId === fish.id);
      return sum + (story?.fragments.length ?? 0);
    }, 0);
    const unlockedFragments = Object.values(this.gsm.soulCollection).reduce(
      (sum, entry) => sum + (entry.storyProgress ?? 0),
      0,
    );

    const stats = document.createElement('div');
    stats.className = 'soul-stats';
    const addStat = (icon: 'soul' | 'sparkle', text: string, ratio: number): void => {
      const stat = document.createElement('div');
      stat.className = 'soul-stat';
      stat.innerHTML = `
        <span class="soul-stat__icon">${svgIcon(icon, 13)}</span>
        <div class="soul-stat__main">
          <div class="soul-stat__value"></div>
          <span class="ss-bar"><i></i></span>
        </div>
      `;
      const value = stat.querySelector('.soul-stat__value');
      if (value) value.textContent = text;
      const bar = stat.querySelector<HTMLElement>('.ss-bar > i');
      if (bar) bar.style.transform = `scaleX(${ratio})`;
      stats.appendChild(stat);
    };
    addStat(
      'soul',
      i18n.t('soul.collected', { '0': collectedCount, '1': mythicFish.length }),
      mythicFish.length ? collectedCount / mythicFish.length : 0,
    );
    addStat(
      'sparkle',
      i18n.t('soul.fragments', { '0': unlockedFragments, '1': totalFragments }),
      totalFragments ? unlockedFragments / totalFragments : 0,
    );
    this.container.appendChild(stats);

    const grid = document.createElement('div');
    grid.className = 'soul-grid';

    for (const fish of mythicFish) {
      const soul = this.gsm.soulCollection[fish.id];
      const story = SOUL_STORIES.find((s) => s.fishId === fish.id);
      const isExpanded = this.expandedFishId === fish.id;
      const isUnread = this.unreadFishIds.has(fish.id);
      const loc = LOCATIONS.find((l) => l.id === fish.location);

      const card = document.createElement('div');
      card.className = 'soul-card';
      card.dataset.collected = String(!!soul);
      card.dataset.expanded = String(isExpanded);

      if (soul) {
        card.addEventListener('click', () => {
          if (isExpanded) {
            this.expandedFishId = null;
          } else {
            this.expandedFishId = fish.id;
            this.unreadFishIds.delete(fish.id);
          }
          this._build();
        });
      }

      const nameRow = document.createElement('div');
      nameRow.className = 'soul-card__head';
      const cardIcon = document.createElement('span');
      cardIcon.className = 'soul-card__icon';
      cardIcon.innerHTML = svgIcon(soul ? 'soul' : 'lock', 11);
      nameRow.appendChild(cardIcon);

      const name = document.createElement('div');
      name.className = 'soul-card__name';
      const nameText = soul ? (i18n.lang === 'zh' ? fish.name.zh : fish.name.en) : '???';
      name.textContent = nameText;
      name.title = nameText;
      nameRow.appendChild(name);

      if (isUnread) {
        const badge = document.createElement('span');
        badge.className = 'soul-card__badge';
        badge.textContent = i18n.t('soul.new');
        nameRow.appendChild(badge);
      }
      card.appendChild(nameRow);

      const locName = document.createElement('div');
      locName.className = 'soul-card__loc';
      locName.innerHTML = svgIcon(soul ? 'pin' : 'lock', 9);
      const locText = document.createElement('span');
      locText.textContent = soul
        ? i18n.lang === 'zh'
          ? (loc?.country ?? '')
          : (loc?.name.en ?? '')
        : i18n.t('soul.dormant');
      locName.appendChild(locText);
      card.appendChild(locName);

      if (isExpanded && soul && story) {
        const storyReader = document.createElement('div');
        storyReader.className = 'soul-story';

        const storyTitle = document.createElement('div');
        storyTitle.className = 'soul-story__title';
        storyTitle.innerHTML = svgIcon('book', 10);
        const storyTitleText = document.createElement('span');
        storyTitleText.textContent = i18n.lang === 'zh' ? story.title.zh : story.title.en;
        storyTitle.appendChild(storyTitleText);
        storyReader.appendChild(storyTitle);

        const progress = document.createElement('div');
        progress.className = 'soul-story__progress';
        progress.textContent = i18n.t('soul.unlocked', {
          '0': soul.storyProgress,
          '1': story.fragments.length,
        });
        storyReader.appendChild(progress);

        story.fragments.forEach((fragment, idx) => {
          const unlocked = idx < soul.storyProgress;
          const para = document.createElement('div');
          para.className = 'soul-fragment';
          para.dataset.locked = String(!unlocked);
          para.textContent = unlocked ? (i18n.lang === 'zh' ? fragment.zh : fragment.en) : '……';
          storyReader.appendChild(para);
        });

        const hint = document.createElement('div');
        hint.className = 'soul-hint';
        hint.textContent =
          soul.storyProgress >= story.fragments.length
            ? i18n.t('soul.storyComplete')
            : i18n.t('soul.catchAgain', {
                '0': i18n.lang === 'zh' ? fish.name.zh : fish.name.en,
              });
        storyReader.appendChild(hint);
        card.appendChild(storyReader);
      } else {
        const memory = document.createElement('div');
        memory.className = 'soul-card__memory';
        const memoryText = soul && fish.mythologyNote ? fish.mythologyNote : '...';
        memory.textContent = memoryText;
        memory.title = memoryText;
        card.appendChild(memory);
      }

      if (soul && !isExpanded) {
        const date = document.createElement('div');
        date.className = 'soul-card__date';
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
