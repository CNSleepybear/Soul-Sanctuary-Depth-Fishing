// ===== src/renderer/ui/Fishpedia.ts =====
// Field guide overlay: per-location fish grid with rarity-coloured cards,
// discovered / undiscovered states, keyboard browsing and an orthographic,
// pixel-perfect voxel preview of the selected fish.

import { EventBus } from '../core/EventBus';
import { GameStateManager } from '../core/GameStateManager';
import { FISH_BY_LOCATION, FISH_DATABASE } from '../data/fish-database';
import { LOCATIONS } from '../data/location-data';
import { VoxelFishModel } from '../rendering/VoxelFishModel';
import { FishRarity } from '../../shared/enums';
import { BAITS } from '../../shared/constants';
import { i18n } from '../i18n/I18n';
import type { SpiritFish, FishpediaEntry } from '../../shared/types';
import { THEME, rarityColor } from './theme';
import { svgIcon, rarityPips } from './icons';
import * as THREE from 'three';

const LOCATION_ORDER = [
  'japan',
  'china',
  'usa',
  'uk',
  'france',
  'germany',
  'italy',
  'denmark',
  'iceland',
  'thailand',
  'egypt',
  'greece',
];

export class Fishpedia {
  private eventBus: EventBus;
  private container: HTMLDivElement;
  private visible = false;

  // State
  private entries: Map<string, FishpediaEntry> = new Map();
  private selectedFishId: string | null = null;
  private _lastLocationId = 'japan';
  private _currentLocationId = 'japan';
  private _fishList: SpiritFish[] = [];
  private _gridEl: HTMLDivElement | null = null;
  private _countEl: HTMLDivElement | null = null;

  // 3D preview
  private previewContainer: HTMLDivElement | null = null;
  private previewCanvasWrap: HTMLDivElement | null = null;
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.OrthographicCamera | null = null;
  private previewModel: VoxelFishModel | null = null;
  private previewAnimId: number | null = null;

  private unsubs: (() => void)[] = [];
  private gsm: GameStateManager;

  constructor(eventBus: EventBus, gsm: GameStateManager) {
    this.eventBus = eventBus;
    this.gsm = gsm;
    this.container = document.createElement('div');
    this.container.id = 'fishpedia';
    this.container.style.display = 'none';
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) this.hide();
    });
    document.addEventListener('keydown', this._onKeyDown);
    document.body.appendChild(this.container);

    for (const [id, entry] of Object.entries(this.gsm.fishpedia)) {
      this.entries.set(id, entry);
    }

    this._subscribe();
  }

  // ── Event subscriptions ──

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on('game:fishpedia_update', (p) => {
        if (p.entry) {
          this.entries.set(p.entry.fishId, {
            ...this.entries.get(p.entry.fishId),
            ...p.entry,
          } as FishpediaEntry);
        }
        if (this.visible) this._buildLayout(this._currentLocationId);
      }),
      this.eventBus.on('input:shortcut', (p) => {
        if (p.key === 'f' || p.key === 'F') this.toggle();
      }),
    );
  }

  // ── Keyboard ──

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.visible) this.hide();
      return;
    }
    if (!this.visible) return;
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -2,
      ArrowDown: 2,
    };
    const delta = deltas[e.key];
    if (delta === undefined || this._fishList.length === 0) return;
    e.preventDefault();
    const current = this._fishList.findIndex((f) => f.id === this.selectedFishId);
    const base = current < 0 ? 0 : current;
    let next = base + delta;
    if (next < 0) next = this._fishList.length - 1;
    if (next >= this._fishList.length) next = 0;
    this._selectFish(this._fishList[next], true);
  };

  // ── Toggle ──

  /** Update the default location for the next toggle (called externally). */
  setActiveLocation(locationId: string): void {
    this._lastLocationId = locationId;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show(this._lastLocationId);
  }

  show(locationId: string): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this._buildLayout(locationId);
    this._startPreview();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
    this._stopPreview();
    this.container.innerHTML = '';
  }

  // ── Layout ──

  private _buildLayout(locationId: string): void {
    this._stopPreview();
    this._currentLocationId = locationId;
    this.container.innerHTML = '';
    this._gridEl = null;
    this._countEl = null;

    // ── Head ──
    const head = document.createElement('div');
    head.className = 'pedia-head';
    head.innerHTML = `
      <span class="pedia-title">
        <span class="pedia-title__icon">${svgIcon('book', 15)}</span>
        <span class="pedia-title__text">${i18n.t('fishpedia.title')}</span>
      </span>
      <span class="pedia-progress">
        <span class="ss-bar"><i class="is-score" style="transform:scaleX(0)"></i></span>
        <span class="pedia-progress__label"></span>
      </span>`;
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
    head.appendChild(closeBtn);
    this.container.appendChild(head);

    // ── Location tabs ──
    const tabs = document.createElement('div');
    tabs.className = 'pedia-tabs';
    LOCATION_ORDER.forEach((lid) => {
      const loc = LOCATIONS.find((l) => l.id === lid);
      const fish = FISH_BY_LOCATION.get(lid) ?? [];
      const discovered = fish.filter((f) => this.entries.get(f.id)?.discovered).length;
      const tab = document.createElement('div');
      tab.className = 'pedia-tab';
      tab.dataset.active = String(lid === locationId);
      tab.setAttribute('role', 'button');
      tab.tabIndex = 0;
      tab.title = loc?.name[i18n.lang] ?? lid;
      tab.innerHTML = `<span>${
        i18n.lang === 'zh' ? (loc?.country ?? lid.toUpperCase()) : lid.toUpperCase()
      }</span><span class="pedia-tab__count">${discovered}/${fish.length}</span>`;
      const activate = () => {
        this.selectedFishId = null;
        this.show(lid);
      };
      tab.addEventListener('click', activate);
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
      tabs.appendChild(tab);
    });
    this.container.appendChild(tabs);

    // ── Body layout ──
    const layout = document.createElement('div');
    layout.className = 'pedia-layout';

    const listPanel = document.createElement('div');
    listPanel.className = 'pedia-list';

    this._fishList = FISH_BY_LOCATION.get(locationId) ?? [];
    const discoveredCount = this._fishList.filter((f) => this.entries.get(f.id)?.discovered).length;

    this._countEl = document.createElement('div');
    this._countEl.className = 'pedia-count';
    this._countEl.innerHTML = `${svgIcon('fish', 10)}<span>${i18n.t('pedia.progress', {
      '0': discoveredCount,
      '1': this._fishList.length,
    })}</span>`;
    listPanel.appendChild(this._countEl);

    if (discoveredCount === 0) {
      const banner = document.createElement('div');
      banner.className = 'pedia-empty-banner';
      banner.innerHTML = `${svgIcon('lock', 10)}<span>${i18n.t('pedia.emptyHint')}</span>`;
      listPanel.appendChild(banner);
    }

    this._gridEl = document.createElement('div');
    this._gridEl.className = 'pedia-grid';
    this._fishList.forEach((fish) => {
      this._gridEl!.appendChild(this._makeCard(fish));
    });
    listPanel.appendChild(this._gridEl);
    layout.appendChild(listPanel);

    // ── Preview column ──
    this.previewContainer = document.createElement('div');
    this.previewContainer.className = 'pedia-preview';
    this.previewCanvasWrap = document.createElement('div');
    this.previewCanvasWrap.className = 'pedia-canvas-wrap';
    this.previewContainer.appendChild(this.previewCanvasWrap);
    layout.appendChild(this.previewContainer);

    this.container.appendChild(layout);

    // ── Foot ──
    const foot = document.createElement('div');
    foot.className = 'pedia-foot';
    const total = FISH_DATABASE.length;
    const totalDiscovered = Object.values(this.gsm.fishpedia).filter((e) => e.discovered).length;
    foot.innerHTML = `<span>${i18n.t('pedia.browse')}</span><span>${svgIcon(
      'fish',
      9,
    )} ${totalDiscovered}/${total}</span>`;
    this.container.appendChild(foot);

    // Update head progress
    const pct = this._fishList.length ? discoveredCount / this._fishList.length : 0;
    const headBar = head.querySelector('.pedia-progress .ss-bar > i') as HTMLElement | null;
    if (headBar) headBar.style.transform = `scaleX(${pct})`;
    const headLabel = head.querySelector('.pedia-progress__label') as HTMLElement | null;
    if (headLabel) {
      headLabel.textContent = `${discoveredCount}/${this._fishList.length}`;
    }

    // Pick a sensible initial selection.
    const selected =
      this._fishList.find((fish) => fish.id === this.selectedFishId) ??
      this._fishList.find((fish) => this.entries.get(fish.id)?.discovered) ??
      this._fishList[0];
    if (selected) this._selectFish(selected);
    else this._renderPreviewEmpty();
  }

  private _makeCard(fish: SpiritFish): HTMLDivElement {
    const entry = this.entries.get(fish.id);
    const discovered = entry?.discovered ?? false;
    const color = rarityColor(fish.rarity);
    const card = document.createElement('div');
    card.className = 'pedia-card';
    card.dataset.fishId = fish.id;
    card.dataset.selected = String(this.selectedFishId === fish.id);
    card.dataset.discovered = String(discovered);
    card.style.borderLeftColor = discovered ? color : 'rgba(239,231,214,0.16)';
    card.setAttribute('role', 'button');
    card.setAttribute(
      'aria-label',
      discovered ? fish.name[i18n.lang] : i18n.t('pedia.undiscovered'),
    );
    card.tabIndex = 0;
    card.innerHTML = `
      <span class="pedia-card__name" style="color:${
        discovered ? color : 'rgba(239,231,214,0.3)'
      }">${discovered ? fish.name[i18n.lang] : '???'}</span>
      <span class="pedia-card__meta">
        ${
          discovered
            ? `<span>${this._rarityLabel(fish.rarity)}</span><span class="ss-pips" style="color:${color}">${rarityPips(
                fish.rarity,
              )}</span>`
            : `<span class="pedia-card__lock">${svgIcon('lock', 9)}${i18n.t(
                'pedia.undiscovered',
              )}</span>`
        }
      </span>`;
    card.addEventListener('click', () => this._selectFish(fish, true));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._selectFish(fish, true);
      }
    });
    return card;
  }

  private _rarityLabel(rarity: FishRarity): string {
    const labels: Record<string, string> = {
      [FishRarity.Common]: i18n.t('rarity.common'),
      [FishRarity.Uncommon]: i18n.t('rarity.uncommon'),
      [FishRarity.Rare]: i18n.t('rarity.rare'),
      [FishRarity.Legendary]: i18n.t('rarity.legendary'),
      [FishRarity.Mythic]: i18n.t('rarity.mythic'),
    };
    return labels[rarity] ?? rarity;
  }

  // ── Fish selection ──

  private _selectFish(fish: SpiritFish, scroll = false): void {
    this.selectedFishId = fish.id;
    if (this._gridEl) {
      this._gridEl.querySelectorAll<HTMLElement>('.pedia-card').forEach((card) => {
        card.dataset.selected = String(card.dataset.fishId === fish.id);
      });
    }
    if (scroll) {
      const card = this._gridEl?.querySelector<HTMLElement>(
        `.pedia-card[data-fish-id="${fish.id}"]`,
      );
      card?.scrollIntoView({ block: 'nearest' });
    }
    this._buildPreview(fish);
  }

  // ── 3D Preview ──

  private _buildPreview(fish: SpiritFish): void {
    if (!this.previewContainer || !this.previewCanvasWrap) return;
    const entry = this.entries.get(fish.id);
    const discovered = entry?.discovered ?? false;
    const color = rarityColor(fish.rarity);

    // Canvas / renderer are lazily created once per panel lifetime.
    this._ensurePreviewRenderer();

    const oldInfo = this.previewContainer.querySelector('.pedia-info');
    if (oldInfo) oldInfo.remove();
    const oldEmpty = this.previewCanvasWrap.querySelector('.pedia-empty');
    if (oldEmpty) oldEmpty.remove();

    // Silhouette lock for undiscovered fish.
    if (!discovered) {
      const empty = document.createElement('div');
      empty.className = 'pedia-empty';
      empty.style.cssText = 'position:absolute; inset:0; justify-content:center;';
      empty.innerHTML = `<span class="pedia-empty__icon">${svgIcon('lock', 22)}</span><span>${i18n.t(
        'pedia.undiscovered',
      )}</span>`;
      this.previewCanvasWrap.appendChild(empty);
      this._disposePreviewModel();
      this._renderInfo(fish, false);
      return;
    }

    this._disposePreviewModel();
    this.previewModel = new VoxelFishModel(fish);
    this.previewScene?.add(this.previewModel.group);
    this._renderInfo(fish, true);
    this.previewContainer.style.setProperty('--rarity-glow', color);
  }

  private _renderInfo(fish: SpiritFish, discovered: boolean): void {
    if (!this.previewContainer) return;
    const entry = this.entries.get(fish.id);
    const color = rarityColor(fish.rarity);
    const info = document.createElement('div');
    info.className = 'pedia-info';
    const baitNames =
      fish.baitRequired
        ?.map((bId) => {
          const b = BAITS.find((x) => x.id === bId);
          return b ? (i18n.lang === 'zh' ? b.name.zh : b.name.en) : bId;
        })
        .join(' / ') ?? '';

    info.innerHTML = `
      <span class="pedia-info__name" style="color:${discovered ? color : THEME.text.dark}">${
        discovered ? fish.name[i18n.lang] : '???'
      }</span>
      <span class="pedia-info__en">${
        discovered
          ? i18n.lang === 'zh'
            ? fish.name.en
            : fish.name.zh
          : i18n.t('pedia.undiscovered')
      }</span>
      <span class="pedia-info__rarity" style="color:${color}">
        ${rarityPips(fish.rarity, 8)}<span>${this._rarityLabel(fish.rarity)}</span>
      </span>
      <span class="pedia-info__desc">${
        discovered
          ? fish.description
          : i18n.lang === 'zh'
            ? '在水边等待一场新的相遇。'
            : 'A new encounter awaits by the water.'
      }</span>
      <span class="pedia-info__stats">
        <span class="pedia-stat">${svgIcon('fish', 8)}${i18n.t('pedia.size', {
          '0': fish.size.min,
          '1': fish.size.max,
        })}</span>
        ${
          discovered
            ? `<span class="pedia-stat">${svgIcon('reel', 8)}${i18n.t('pedia.caught', {
                '0': entry?.timesCaught ?? 0,
              })}</span>
               <span class="pedia-stat">${svgIcon('trophy', 8)}${i18n.t('pedia.largest', {
                 '0': (entry?.largestSize ?? 0) > 0 ? entry!.largestSize.toFixed(1) : '—',
               })}</span>`
            : ''
        }
        ${
          baitNames
            ? `<span class="pedia-stat">${svgIcon('bait', 8)}${i18n.t('pedia.baitNeed', {
                '0': baitNames,
              })}</span>`
            : ''
        }
      </span>`;
    this.previewContainer.appendChild(info);
  }

  private _renderPreviewEmpty(): void {
    if (!this.previewContainer || !this.previewCanvasWrap) return;
    const empty = document.createElement('div');
    empty.className = 'pedia-empty';
    empty.innerHTML = `<span class="pedia-empty__icon">${svgIcon('fish', 26)}</span><span>${i18n.t(
      'pedia.empty',
    )}</span><span>${i18n.t('pedia.emptyHint')}</span>`;
    this.previewCanvasWrap.appendChild(empty);
  }

  /** Create canvas, renderer, scene, camera and lights once. */
  private _ensurePreviewRenderer(): void {
    if (this.previewRenderer || !this.previewCanvasWrap) return;

    this.previewCanvasWrap.style.position = 'relative';
    const canvas = document.createElement('canvas');
    canvas.id = 'fishpedia-preview-canvas';
    canvas.width = 160;
    canvas.height = 160;
    canvas.className = 'pixelated';
    this.previewCanvasWrap.appendChild(canvas);

    // Orthographic + no AA to match the in-game voxel pixel style.
    this.previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    this.previewRenderer.setSize(160, 160, false);
    this.previewRenderer.setClearColor(0x000000, 0);

    this.previewScene = new THREE.Scene();
    const viewSize = 2.1;
    this.previewCamera = new THREE.OrthographicCamera(
      -viewSize,
      viewSize,
      viewSize,
      -viewSize,
      0.1,
      50,
    );
    this.previewCamera.position.set(2.6, 1.9, 2.9);
    this.previewCamera.lookAt(0, 0.1, 0);

    // Warm key + cool rim, matching the diorama lighting script.
    const ambient = new THREE.AmbientLight(0xefe7d6, 1.25);
    this.previewScene.add(ambient);
    const key = new THREE.DirectionalLight(0xffe0b8, 1.35);
    key.position.set(3, 5, 4);
    this.previewScene.add(key);
    const rim = new THREE.DirectionalLight(0x9db6cf, 0.7);
    rim.position.set(-4, 2, -3);
    this.previewScene.add(rim);

    this._animatePreview();
  }

  private _animatePreview(): void {
    const loop = (time: number) => {
      if (!this.previewRenderer || !this.previewScene || !this.previewCamera) return;
      this.previewAnimId = requestAnimationFrame(loop);
      if (this.previewModel) {
        this.previewModel.update(time * 0.001);
        this.previewModel.group.rotation.y += 0.012;
        this.previewModel.group.position.y = Math.sin(time * 0.0016) * 0.04;
      }
      this.previewRenderer.render(this.previewScene, this.previewCamera);
    };
    this.previewAnimId = requestAnimationFrame(loop);
  }

  private _disposePreviewModel(): void {
    if (this.previewModel) {
      this.previewScene?.remove(this.previewModel.group);
      this.previewModel.dispose();
      this.previewModel = null;
    }
  }

  private _startPreview(): void {
    // Renderer is created lazily on first fish selection.
  }

  private _stopPreview(): void {
    if (this.previewAnimId !== null) {
      cancelAnimationFrame(this.previewAnimId);
      this.previewAnimId = null;
    }
    this._disposePreviewModel();
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
  }

  // ── Public API ──

  /** Update entry after catching a fish */
  updateEntry(fishId: string, partial: Partial<FishpediaEntry>): void {
    const existing = this.entries.get(fishId) ?? {
      fishId,
      discovered: false,
      timesCaught: 0,
      largestSize: 0,
      smallestSize: Infinity,
      hasTrophy: false,
      hasSpiritVariant: false,
      firstCaughtTimestamp: null,
    };
    this.entries.set(fishId, { ...existing, ...partial });
  }

  getEntry(fishId: string): FishpediaEntry | undefined {
    return this.entries.get(fishId);
  }

  /** Export all entries for save */
  exportEntries(): Record<string, FishpediaEntry> {
    return Object.fromEntries(this.entries);
  }

  /** Import entries from save */
  importEntries(data: Record<string, FishpediaEntry>): void {
    this.entries = new Map(Object.entries(data));
  }

  dispose(): void {
    document.removeEventListener('keydown', this._onKeyDown);
    this.unsubs.forEach((fn) => fn());
    this._stopPreview();
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
