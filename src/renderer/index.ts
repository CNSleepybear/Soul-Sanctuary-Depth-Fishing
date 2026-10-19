// ===== src/renderer/index.ts =====
// Transparent floating widget — island visible, rest is desktop.

import { EventBus } from './core/EventBus';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { GameRenderer } from './rendering/Renderer';
import { RenderPipeline } from './rendering/Pipeline';
import { CameraController } from './rendering/CameraController';
import { LocationManager } from './locations/LocationManager';
import { FishingSystem } from './fishing/FishingSystem';
import { RunManager } from './roguelike/RunManager';
import { GameStateManager } from './core/GameStateManager';
import { RunUI } from './roguelike/RunUI';
import { FishingSceneManager } from './fishing/FishingSceneManager';
import { SceneUI } from './ui/SceneUI';
import { FishingUI } from './ui/FishingUI';
import { Fishpedia } from './ui/Fishpedia';
import { SoulSanctuaryPanel } from './ui/SoulSanctuaryPanel';
import { SoulSanctuaryManager } from './locations/SoulSanctuaryManager';
import { DraggablePanel } from './ui/DraggablePanel';
import { DailySystem } from './data/DailySystem';
import { audio, AmbientType } from './audio'; // AUDIO: centralized audio engine
import {
  APP_VERSION,
  RESOLUTION_PRESETS,
  RENDER_WIDTH,
  RENDER_HEIGHT,
  DAILY_ENABLED,
} from '../shared/constants';
import { logger, LogLevel, isLogLevelValue } from '../shared/logger';

// Vite env types (kept minimal; extend here if more env vars are used)
declare global {
  interface ImportMetaEnv {
    PROD: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// In production builds, default to WARN to keep the console quiet.
if (import.meta.env.PROD === true) {
  logger.setLevel(LogLevel.WARN);
}
import { FishingState } from '../shared/enums';
import { GameEvents } from '../shared/events';
import { i18n } from './i18n/I18n';

import '../styles/main.css';
import '@fontsource/vt323/index.css'; // REF-4: pixel font for consistent retro UI
import '@shared/ipc'; // shared ElectronAPI global type

// Resolution persistence
const RES_KEY = 'soulsanctuary_resolution';
function getStoredResolution(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(RES_KEY);
    if (raw) {
      const [w, h] = raw.split('x').map(Number);
      const match = RESOLUTION_PRESETS.find((p) => p.w === w && p.h === h);
      if (match) return { w, h };
    }
  } catch {
    /* */
  }
  return { w: RENDER_WIDTH, h: RENDER_HEIGHT };
}

async function applyResolution(w: number, h: number, renderer: GameRenderer): Promise<void> {
  localStorage.setItem(RES_KEY, `${w}x${h}`);
  logger.debug('[Resolution] Switching to', w, 'x', h);
  // 1. Resize Electron window shell
  await window.electronAPI?.setWindowSize(w, h);
  logger.debug('[Resolution] Window resize requested');
  // 2. Resize Three.js renderer (includes camera update)
  renderer.resize(w, h);
  // No reload — window and renderer are already resized
}

async function initApp(): Promise<void> {
  const app = document.getElementById('app')!;

  // Drag bar
  const dragBar = document.createElement('div');
  dragBar.id = 'drag-bar';
  const orb = document.createElement('div');
  orb.id = 'drag-orb';
  orb.title = i18n.t('ui.dragHint');
  dragBar.appendChild(orb);
  const closeBtn = document.createElement('div');
  closeBtn.id = 'btn-close';
  closeBtn.title = '退出 Soul Sanctuary';
  closeBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.electronAPI) {
      window.electronAPI.quit().catch((err: unknown) => {
        logger.warn('[Renderer] quit failed:', err);
      });
    } else {
      window.close();
    }
  });
  dragBar.appendChild(closeBtn);
  document.body.appendChild(dragBar);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  app.appendChild(canvas);
  RenderPipeline.apply(canvas);

  // Core systems
  const eventBus = new EventBus();
  const gameLoop = new GameLoop(update);
  const inputManager = new InputManager(eventBus);
  const renderer = new GameRenderer(canvas);
  const locationManager = new LocationManager(renderer.getScene(), eventBus);

  // AUDIO: Unlock AudioContext on first user interaction (browser autoplay policy)
  const unlockAudio = () => {
    audio.ensureContext();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  // Apply stored resolution
  const storedRes = getStoredResolution();
  await applyResolution(storedRes.w, storedRes.h, renderer);

  // Persistent state
  const activeSlot = parseInt(localStorage.getItem('soulsanctuary_active_slot') ?? '0', 10);
  const gameState = new GameStateManager(eventBus, isNaN(activeSlot) ? 0 : activeSlot);
  // P0: load file-based save in Electron builds (falls back to localStorage)
  if (window.electronAPI) {
    await gameState.loadFromElectron();
  }

  // Game systems
  const fishingSystem = new FishingSystem(eventBus, 42);
  const sceneUI = new SceneUI(eventBus, true);
  const fishingUI = new FishingUI(eventBus);
  const fishpedia = new Fishpedia(eventBus, gameState);
  const soulPanel = new SoulSanctuaryPanel(eventBus, gameState);
  new SoulSanctuaryManager(eventBus, locationManager, gameState);
  const fishingScene = new FishingSceneManager(eventBus, renderer.getScene());
  const cameraController = new CameraController(renderer.getCamera(), dragBar);
  // DAILY-2: Daily system — daily quests, streaks, hotspot, free bait
  const dailySystem = new DailySystem(
    eventBus,
    gameState._loadedDailyState,
    (state) => gameState.updateDailyState(state),
    DAILY_ENABLED,
  );
  const runManager = new RunManager(eventBus, fishingSystem, Date.now());
  runManager.setHotspotLocation(dailySystem.hotspotLocation);
  const runUI = new RunUI(eventBus, runManager, gameState, sceneUI, locationManager, dailySystem);

  // Fishing mode indicator
  let isFishingMode = false;
  const fishingIndicator = document.createElement('div');
  fishingIndicator.style.cssText =
    'position:absolute;top:4px;left:8px;z-index:100;font-size:8px;color:rgba(255,100,100,0.6);display:none;font-family:monospace;pointer-events:none;';
  fishingIndicator.textContent = i18n.t('fishing.fishing');
  document.body.appendChild(fishingIndicator);

  locationManager.loadLocation('japan');

  // Dev helper: external capture scripts can switch locations without exposing internals
  window.addEventListener('soul:dev', (e: Event) => {
    if (!(e instanceof CustomEvent)) return;
    const detail = e.detail as { type?: string; locationId?: string } | undefined;
    if (detail?.type === 'loadLocation' && typeof detail.locationId === 'string') {
      locationManager.loadLocation(detail.locationId);
    }
  });

  // Art review harness: read-only probe (draw calls, triangles, active scene).
  (window as unknown as { __soul?: unknown }).__soul = {
    stats: () => ({
      ...renderer.getStats(),
      locationId: locationManager.currentLocationId,
      camera: {
        x: renderer.getCamera().position.x,
        y: renderer.getCamera().position.y,
        z: renderer.getCamera().position.z,
      },
    }),
  };

  // AUDIO: Brand logo + ambient on startup
  setTimeout(() => {
    audio.playBrandLogo();
    audio.playAmbient(AmbientType.Wind);
  }, 800);

  eventBus.on('game:location_change', (p) => {
    if (p.locationId) {
      fishpedia.setActiveLocation(p.locationId);
      // AUDIO: switch ambient based on location
      const ambMap: Record<string, AmbientType> = {
        japan: AmbientType.Bamboo,
        china: AmbientType.Bamboo,
        germany: AmbientType.Wind,
        iceland: AmbientType.Aurora,
        uk: AmbientType.Rain,
      };
      audio.playAmbient(ambMap[p.locationId] || AmbientType.Water);
    }
  });
  inputManager.attach(canvas);

  // Electron IPC
  if (window.electronAPI) {
    window.electronAPI.setInteractive(true).catch((err: unknown) => {
      logger.warn('[Renderer] setInteractive(true) failed:', err);
    });

    // Pause rendering loop while widget is hidden/minimized/blurred to save GPU
    const pauseOnHide = () => {
      gameLoop.pause();
    };
    const resumeOnShow = () => {
      gameLoop.resume();
    };
    window.electronAPI.onBlur(pauseOnHide);
    window.electronAPI.onFocus(resumeOnShow);
    // Also respect browser page visibility (dev / non-Electron)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pauseOnHide();
      } else {
        resumeOnShow();
      }
    });

    window.electronAPI.onShortcut(({ key }) => {
      if (key === 'toggle_fish') {
        isFishingMode = !isFishingMode;
        const promise = isFishingMode
          ? window.electronAPI?.setInteractive(true)
          : window.electronAPI?.setInteractive(false);
        promise?.catch((err: unknown) => {
          logger.warn('[Renderer] setInteractive shortcut failed:', err);
        });
        inputManager.setEnabled(isFishingMode);
        fishingIndicator.style.display = isFishingMode ? 'block' : 'none';
      } else if (key === 'change_location') {
        locationManager.nextLocation();
        eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
          message: '🌍 Switched sanctuary',
          type: 'info',
        });
      }
    });
    window.electronAPI.onRequestSave(() => {
      const json = gameState.exportJSON();
      window.electronAPI
        ?.saveData(activeSlot, json)
        .then((ok) => {
          logger.info('[Renderer] Save to disk:', ok ? 'OK' : 'FAILED');
          window.electronAPI?.notifySaveComplete();
        })
        .catch((err: unknown) => {
          logger.error('[Renderer] saveData failed:', err);
          window.electronAPI?.notifySaveComplete();
        });
    });
  }

  // SceneUI callbacks
  sceneUI.onStart = () => runUI.showCampPanel();
  sceneUI.onScenePrev = () => locationManager.prevLocation();
  sceneUI.onSceneNext = () => locationManager.nextLocation();
  sceneUI.onFishpedia = () => fishpedia.toggle();
  sceneUI.onSouls = () => soulPanel.toggle();
  sceneUI.onSettings = () => {
    const panel = new DraggablePanel(i18n.t('settings.title'), 260);
    panel.setPosition(window.innerWidth / 2 - 130, 100);
    const body = panel.getBody();
    const curRes = getStoredResolution();
    body.innerHTML = [
      `<div style="color:#ccc;font-size:9px;line-height:2;text-align:center;">`,
      `${i18n.t('settings.about')} v${APP_VERSION}<br><br>`,
      `<span style="color:#888;">${i18n.t('settings.castTip')}</span><br>`,
      `<span style="color:#888;">${i18n.t('settings.slackTip')}</span><br>`,
      `<span style="color:#888;">${i18n.t('settings.fishpediaKey')}</span><br>`,
      `<span style="color:#888;">${i18n.t('settings.escKey')}</span><br><br>`,
      `<span style="color:#888;">Resolution:</span>`,
      `<select id="res-switch" style="margin-left:4px;background:#222;color:#aaa;border:1px solid rgba(255,255,255,0.12);font-size:8px;cursor:pointer;">`,
      RESOLUTION_PRESETS.map(
        (p) =>
          `<option value="${p.w}x${p.h}" ${curRes.w === p.w ? 'selected' : ''}>${p.label}</option>`,
      ).join(''),
      `</select><br>`,
      `<span style="color:#888;">Language:</span>`,
      `<select id="lang-switch" style="margin-left:4px;background:#222;color:#aaa;border:1px solid rgba(255,255,255,0.12);font-size:8px;cursor:pointer;">`,
      `<option value="zh" ${i18n.lang === 'zh' ? 'selected' : ''}>中文</option>`,
      `<option value="en" ${i18n.lang === 'en' ? 'selected' : ''}>English</option>`,
      `</select><br>`,
      `<span style="color:#888;">Log Level:</span>`,
      `<select id="log-level-switch" style="margin-left:4px;background:#222;color:#aaa;border:1px solid rgba(255,255,255,0.12);font-size:8px;cursor:pointer;">`,
      Object.values(LogLevel)
        .filter((v) => typeof v === 'number')
        .map(
          (lvl) =>
            `<option value="${lvl}" ${logger.getLevel() === lvl ? 'selected' : ''}>${LogLevel[lvl as number]}</option>`,
        )
        .join(''),
      `</select>`,
      `</div>`,
    ].join('');
    document.body.appendChild(panel.el);
    setTimeout(() => {
      const langSel = document.getElementById('lang-switch') as HTMLSelectElement | null;
      if (langSel)
        langSel.addEventListener('change', () => {
          i18n.setLanguage(langSel.value as 'zh' | 'en');
          location.reload();
        });
      const resSel = document.getElementById('res-switch') as HTMLSelectElement | null;
      if (resSel)
        resSel.addEventListener('change', () => {
          const [w, h] = resSel.value.split('x').map(Number);
          applyResolution(w, h, renderer).catch((err: unknown) => {
            logger.error('[Renderer] applyResolution failed:', err);
          });
        });
      const logSel = document.getElementById('log-level-switch') as HTMLSelectElement | null;
      if (logSel)
        logSel.addEventListener('change', () => {
          const lvl = Number(logSel.value);
          if (isLogLevelValue(lvl)) {
            logger.setLevel(lvl);
            logger.info('[Settings] Log level set to', LogLevel[lvl]);
          }
        });
    }, 100);
    panel.getCloseBtn().addEventListener('click', () => panel.remove());
  };
  sceneUI.showStart();

  gameLoop.start();
  logger.info('[SoulSanctuary] Ready. Res:', storedRes.w, 'x', storedRes.h);

  function update(dt: number): void {
    const now = performance.now();
    inputManager.update(dt);
    locationManager.update(dt);
    if (sceneUI.autoRotate) cameraController.update(dt);
    runManager.update(dt, now);
    fishingScene.update(dt);
    fishingUI.update(
      fishingSystem.castPower,
      fishingSystem.state === FishingState.Casting,
      fishingSystem.probesRemaining,
    );
    renderer.render();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp().catch((err: unknown) => {
    logger.error('[Renderer] Failed to initialize app:', err);
  });
});
