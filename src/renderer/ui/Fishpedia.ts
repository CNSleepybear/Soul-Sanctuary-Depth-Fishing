// ===== src/renderer/ui/Fishpedia.ts =====
// Fishpedia overlay — DOM-based compendium of discovered fish.
// Shows list of all fish per location, with discovery status,
// and a 3D voxel model preview of selected fish.

import { EventBus } from '../core/EventBus';
import { GameStateManager } from '../core/GameStateManager';
import { FISH_BY_LOCATION } from '../data/fish-database';
import { LOCATIONS } from '../data/location-data';
import { VoxelFishModel } from '../rendering/VoxelFishModel';
import { FishRarity } from '../../shared/enums';
import { BAITS } from '../../shared/constants';
import { i18n } from '../i18n/I18n';
import type { SpiritFish, FishpediaEntry } from '../../shared/types';
import { THEME } from './theme';
import * as THREE from 'three';

const RARITY_COLORS: Record<string, string> = {
  [FishRarity.Common]: THEME.rarity.common,
  [FishRarity.Uncommon]: THEME.rarity.uncommon,
  [FishRarity.Rare]: THEME.rarity.rare,
  [FishRarity.Legendary]: THEME.rarity.legendary,
  [FishRarity.Mythic]: THEME.rarity.mythic,
};

const RARITY_STARS: Record<string, string> = {
  [FishRarity.Common]: '★',
  [FishRarity.Uncommon]: '★★',
  [FishRarity.Rare]: '★★★',
  [FishRarity.Legendary]: '★★★★',
  [FishRarity.Mythic]: '★★★★★',
};

export class Fishpedia {
  private eventBus: EventBus;
  private container: HTMLDivElement;
  private visible = false;

  // State
  private entries: Map<string, FishpediaEntry> = new Map();
  private selectedFishId: string | null = null;

  // 3D preview
  private previewContainer: HTMLDivElement | null = null;
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
    this.container.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 400px; max-height: 85vh;
      background: ${THEME.panel.bg};
      border: ${THEME.panel.border};
      border-radius: ${THEME.panel.radius};
      z-index: 300; display: none; pointer-events: all;
      font-family: ${THEME.panel.font};
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;
    // Click on dark background to close
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) this.hide();
    });
    // ESC key to close
    document.addEventListener('keydown', this._onKeyDown);
    document.body.appendChild(this.container);

    // Load existing entries from persistent state
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
        // Refresh the visible panel so the player immediately sees new discoveries
        if (this.visible) {
          this._buildLayout(this._lastLocationId);
        }
      }),
      this.eventBus.on('input:shortcut', (p) => {
        if (p.key === 'f' || p.key === 'F') {
          this.toggle();
        }
      }),
    );
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.hide();
  };

  // ── Toggle ──

  private _lastLocationId = 'japan';

  /** Update the default location for next toggle (called externally). */
  setActiveLocation(locationId: string): void {
    this._lastLocationId = locationId;
  }

  toggle(): void {
    this.visible ? this.hide() : this.show(this._lastLocationId);
  }

  show(locationId: string): void {
    this.visible = true;
    this.container.style.display = 'block';
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
    // Dispose any existing preview before wiping DOM; a fresh previewContainer
    // will be created below and the renderer will be lazily rebuilt on demand.
    this._stopPreview();
    this.container.innerHTML = '';

    // Main layout: list on left, preview on right
    const layout = document.createElement('div');
    layout.style.cssText = `
      display: flex; width: 100%; height: 100%;
    `;

    // ── Left: fish list ──
    const listPanel = document.createElement('div');
    listPanel.style.cssText = `
      flex: 1; overflow-y: auto; padding: 12px;
      border-right: 1px solid ${THEME.border.subtle};
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      font-size: 11px; color: ${THEME.text.secondary};
      letter-spacing: 2px; margin-bottom: 12px;
      border-bottom: 1px solid ${THEME.border.subtle};
      padding-bottom: 8px;
    `;
    header.textContent = i18n.t('fishpedia.title');
    listPanel.appendChild(header);

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

    // Location tabs
    const locIds = [
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
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
      display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;
    `;
    locIds.forEach((lid) => {
      const tab = document.createElement('span');
      tab.style.cssText = `
        font-size: 8px; padding: 2px 6px;
        background: ${lid === locationId ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)'};
        color: ${lid === locationId ? THEME.text.white : 'rgba(255,255,255,0.4)'};
        cursor: pointer; pointer-events: all;
        border-radius: ${THEME.radius.sm};
      `;
      const locData = LOCATIONS.find((l) => l.id === lid);
      tab.textContent =
        i18n.lang === 'zh'
          ? (locData?.country ?? lid.toUpperCase())
          : (locData?.name.en?.split(':')[0] ?? lid.toUpperCase());
      tab.addEventListener('click', () => this.show(lid));
      tabBar.appendChild(tab);
    });
    listPanel.appendChild(tabBar);

    // Fish entries
    const fishList = FISH_BY_LOCATION.get(locationId) ?? [];
    const discoveredCount = fishList.filter((f) => this.entries.get(f.id)?.discovered).length;
    const countLabel = document.createElement('div');
    countLabel.style.cssText = `
      font-size: 8px; color: ${THEME.text.muted}; margin-bottom: 8px;
    `;
    countLabel.textContent = i18n.t('fishpedia.discovered', {
      '0': discoveredCount,
      '1': fishList.length,
    });
    listPanel.appendChild(countLabel);

    fishList.forEach((fish) => {
      const entry = this.entries.get(fish.id);
      const discovered = entry?.discovered ?? false;

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; align-items: center; padding: 4px 6px;
        margin-bottom: 2px; cursor: pointer; pointer-events: all;
        border-radius: ${THEME.radius.sm};
        ${this.selectedFishId === fish.id ? 'background: rgba(255,255,255,0.1);' : ''}
      `;
      row.addEventListener('click', () => this._selectFish(fish));
      row.addEventListener('mouseover', () => {
        row.style.background = 'rgba(255,255,255,0.06)';
      });
      row.addEventListener('mouseout', () => {
        if (this.selectedFishId !== fish.id) {
          row.style.background = 'transparent';
        }
      });

      // Rarity color dot
      const dot = document.createElement('span');
      dot.style.cssText = `
        width: 6px; height: 6px; border-radius: 50%;
        background: ${discovered ? RARITY_COLORS[fish.rarity] : '#333'};
        margin-right: 6px; flex-shrink: 0;
      `;
      row.appendChild(dot);

      // Name
      const name = document.createElement('span');
      name.style.cssText = `
        font-size: 9px; flex: 1;
        color: ${discovered ? '#ddd' : THEME.text.dark};
      `;
      name.textContent = discovered ? (i18n.lang === 'zh' ? fish.name.zh : fish.name.en) : '???';
      row.appendChild(name);

      // Stars
      const stars = document.createElement('span');
      stars.style.cssText = `
        font-size: 7px; color: ${discovered ? RARITY_COLORS[fish.rarity] : '#333'};
      `;
      stars.textContent = RARITY_STARS[fish.rarity] || '';
      row.appendChild(stars);

      // Bait hint
      if (fish.baitRequired && fish.baitRequired.length > 0) {
        const baitHint = document.createElement('span');
        const baitNames = fish.baitRequired
          .map((bId) => {
            const b = BAITS.find((x) => x.id === bId);
            return b ? (i18n.lang === 'zh' ? b.name.zh : b.name.en) : bId;
          })
          .join('/');
        baitHint.style.cssText = `
          font-size: 6px; color: ${discovered ? THEME.accent.yellow : '#333'};
          margin-left: 4px; opacity: 0.8;
        `;
        baitHint.textContent = `🪱 ${baitNames}`;
        row.appendChild(baitHint);
      }

      listPanel.appendChild(row);
    });

    layout.appendChild(listPanel);

    // ── Right: 3D preview ──
    this.previewContainer = document.createElement('div');
    this.previewContainer.style.cssText = `
      width: 180px; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    `;
    layout.appendChild(this.previewContainer);

    this.container.appendChild(layout);
  }

  // ── Fish selection ──

  private _selectFish(fish: SpiritFish): void {
    this.selectedFishId = fish.id;
    this._buildPreview(fish);
  }

  // ── 3D Preview ──

  private _buildPreview(fish: SpiritFish): void {
    if (!this.previewContainer) return;

    // Lazily create renderer/scene/camera once per panel lifetime.
    this._ensurePreviewRenderer();

    // Replace previous info text (keep the canvas).
    const oldInfo = this.previewContainer.querySelector('.fishpedia-preview-info');
    if (oldInfo) oldInfo.remove();

    const entry = this.entries.get(fish.id);
    const discovered = entry?.discovered ?? false;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'fishpedia-preview-info';
    infoDiv.style.cssText = `
      text-align: center; margin-top: 8px;
      font-size: ${discovered ? '10px' : '8px'};
      color: ${discovered ? '#ddd' : '#444'};
    `;
    infoDiv.innerHTML = `
      <div>${discovered ? (i18n.lang === 'zh' ? fish.name.zh : fish.name.en) : '???'}</div>
      <div style="font-size: 7px; color: ${RARITY_COLORS[fish.rarity]}; margin-top: 2px;">
        ${RARITY_STARS[fish.rarity]}
      </div>
      <div style="font-size: 7px; color: #666; margin-top: 4px;">
        ${fish.description.slice(0, 60)}...
      </div>
      ${
        fish.baitRequired && fish.baitRequired.length > 0
          ? `<div style="font-size: 7px; color: #ffcc00; margin-top: 4px;">🪱 Requires: ${fish.baitRequired
              .map((bId) => {
                const b = BAITS.find((x) => x.id === bId);
                return b ? (i18n.lang === 'zh' ? b.name.zh : b.name.en) : bId;
              })
              .join(' / ')}</div>`
          : ''
      }
    `;
    this.previewContainer.appendChild(infoDiv);

    // Swap model: remove old, add new — renderer/scene/camera stay alive.
    if (this.previewModel) {
      this.previewScene?.remove(this.previewModel.group);
      this.previewModel.dispose();
    }
    this.previewModel = new VoxelFishModel(fish);
    this.previewScene?.add(this.previewModel.group);
  }

  /** Create canvas, renderer, scene, camera and lights once. */
  private _ensurePreviewRenderer(): void {
    if (this.previewRenderer || !this.previewContainer) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'fishpedia-preview-canvas';
    canvas.width = 160;
    canvas.height = 160;
    canvas.className = 'pixelated';
    canvas.style.cssText = 'border-radius: ${THEME.radius.md};';
    canvas.style.display = 'block';
    this.previewContainer.appendChild(canvas);

    // REF-4: orthographic + no AA to match the in-game voxel pixel style
    this.previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    this.previewRenderer.setSize(160, 160);
    this.previewRenderer.setClearColor(0x000000, 0);

    this.previewScene = new THREE.Scene();
    const viewSize = 2.8;
    this.previewCamera = new THREE.OrthographicCamera(
      -viewSize,
      viewSize,
      viewSize,
      -viewSize,
      0.1,
      50,
    );
    this.previewCamera.position.set(3, 2, 3);
    this.previewCamera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    this.previewScene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(3, 5, 3);
    this.previewScene.add(dir);

    this._animatePreview();
  }

  private _animatePreview(): void {
    const loop = (time: number) => {
      if (!this.previewRenderer || !this.previewScene || !this.previewCamera) return;
      this.previewAnimId = requestAnimationFrame(loop);

      if (this.previewModel) {
        this.previewModel.update(time * 0.001);
        this.previewModel.group.rotation.y += 0.015;
      }

      this.previewRenderer.render(this.previewScene, this.previewCamera);
    };
    this.previewAnimId = requestAnimationFrame(loop);
  }

  private _startPreview(): void {
    // Preview started when a fish is selected; renderer is created lazily.
  }

  private _stopPreview(): void {
    if (this.previewAnimId !== null) {
      cancelAnimationFrame(this.previewAnimId);
      this.previewAnimId = null;
    }
    if (this.previewModel) {
      this.previewScene?.remove(this.previewModel.group);
      this.previewModel.dispose();
      this.previewModel = null;
    }
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
