// ===== src/renderer/fishing/FishingSceneManager.ts =====
// Orchestrates all fishing 3D visuals: bobber, line, splash, fish model.
// Subscribes to fishing events and updates visual state per frame.

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { Bobber } from '../rendering/Bobber';
import { FishingLine } from '../rendering/FishingLine';
import { SplashEffect } from '../rendering/SplashEffect';
import { VoxelFishModel } from '../rendering/VoxelFishModel';
import { Fisherman } from '../rendering/Fisherman';
import { GameEvents } from '../../shared/events';
import { FishRarity, CatchQuality } from '../../shared/enums';
import { LOCATIONS } from '../data/location-data';
import type { SpiritFish } from '../../shared/types';

// World-space reference points
const CAST_TARGET = new THREE.Vector3(4, -2.0, -1.5);
const IDLE_POS = new THREE.Vector3(4, -2.0, -1.5);
// Fisherman position on island edge
const FISHERMAN_POS = new THREE.Vector3(-3, 1.5, -2.5);

export class FishingSceneManager {
  private eventBus: EventBus;
  private scene: THREE.Scene;

  readonly bobber: Bobber;
  readonly line: FishingLine;
  readonly splash: SplashEffect;
  readonly fisherman: Fisherman;

  private fishModel: VoxelFishModel | null = null;
  private fishModelGroup: THREE.Group | null = null;
  private fishVisible = false;
  private fishThrashPhase = 0;
  private _showFishDuringReel = true;
  private _splashColor = 0xaaddff;
  private _mythicGlow: THREE.PointLight | null = null;

  private unsubs: (() => void)[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(eventBus: EventBus, scene: THREE.Scene) {
    this.eventBus = eventBus;
    this.scene = scene;

    // Create visual elements
    this.bobber = new Bobber();
    this.line = new FishingLine();
    this.splash = new SplashEffect();
    this.fisherman = new Fisherman();

    // Position fisherman on island edge
    this.fisherman.group.position.copy(FISHERMAN_POS);
    // Face outward (toward +X)
    this.fisherman.group.rotation.y = -0.8;

    // Add to scene
    scene.add(this.bobber.group);
    scene.add(this.line.group);
    scene.add(this.splash.group);
    scene.add(this.fisherman.group);

    // Init line from fisherman's rod tip
    this.line.setRodTip(this.fisherman.getWorldRodTip());

    // Idle bobber
    this.bobber.showIdle(IDLE_POS);
    this.line.setTarget(IDLE_POS);
    this.line.show();

    this._subscribe();

    // REF-4: update splash color to match location theme
    this.unsubs.push(
      this.eventBus.on(GameEvents.GAME_LOCATION_CHANGE, (p) => {
        const loc = LOCATIONS.find((l) => l.id === p.locationId);
        if (loc?.theme) {
          this._splashColor = loc.theme.waterColor;
        }
      }),
    );
  }

  // Water surface removed — too abstract as a ring

  // ── Event subscriptions ──

  private _subscribe(): void {
    this.unsubs.push(
      // Cast start
      this.eventBus.on(GameEvents.FISHING_CAST_START, () => {
        this.bobber.hide();
        this.line.hide();
      }),

      // Cast released — animate flight, splash on landing
      this.eventBus.on(GameEvents.FISHING_CAST, (p) => {
        const power = p.power || 0.3;
        const target = CAST_TARGET.clone();
        target.x += power * 3;
        target.z -= power * 1.5;
        this.bobber.startFlight(this.fisherman.getWorldRodTip(), target);
        this.line.hide();
        // Splash will trigger when bobber lands (via update check)
      }),

      // Nibble — bobber twitch
      this.eventBus.on(GameEvents.FISHING_NIBBLE, () => {
        this.bobber.twitch();
      }),

      // Bite — sink bobber, splash
      this.eventBus.on(GameEvents.FISHING_BITE, (p) => {
        this.bobber.startSink();
        const pos = this.bobber.getWorldPosition();
        const isMythic = p.fish?.rarity === FishRarity.Mythic;
        if (isMythic) {
          this.splash.burst(pos, 40, 0xff44cc, 3, 4);
        } else {
          this.splash.burst(pos, 20, this._splashColor, 2, 3);
        }
        // Show fish model
        if (p.fish && this._showFishDuringReel) {
          this._spawnFishModel(p.fish);
        }
      }),

      // Hook set — line to fish, begin reel visuals
      this.eventBus.on(GameEvents.FISHING_HOOK_SET, (p) => {
        this.line.show();
        this.line.setTarget(this._getFishWorldPos());
        if (p.fish && !this.fishModel && this._showFishDuringReel) {
          this._spawnFishModel(p.fish);
        }
      }),

      // Reel update — tension colors, fish thrash
      this.eventBus.on(GameEvents.FISHING_REEL_UPDATE, (p) => {
        this.line.setTension(p.tension || 0);
        this.line.setTarget(this._getFishWorldPos());
        this.fisherman.setTension(p.tension || 0);
        // Fish thrash animation
        if (this.fishVisible) {
          this.fishThrashPhase += 0.05;
        }
      }),

      // Catch — fish leaps, sparkle
      this.eventBus.on(GameEvents.FISHING_CATCH, (p) => {
        this.fisherman.setTension(0);
        const pos = this._getFishWorldPos();
        pos.y += 1;
        const isMythic = p.fish?.rarity === FishRarity.Mythic;
        const isPerfect = p.quality === CatchQuality.Perfect;
        if (isMythic) {
          this.splash.burst(pos, 60, 0xffd700, 4, 5);
          this._triggerMythicGlow(pos);
        } else if (isPerfect) {
          this.splash.burst(pos, 40, 0xffd700, 3, 4.5);
        } else {
          this.splash.burst(pos, 20, 0xaaddff, 2, 3);
        }
        this._hideFishModel();
        this.line.hide();
        this.bobber.hide();
      }),

      // Escape — bobber resurfaces, fish darts away
      this.eventBus.on(GameEvents.FISHING_ESCAPE, () => {
        this.fisherman.setTension(0);
        const pos = this._getFishWorldPos();
        this.splash.burst(pos, 15, this._splashColor, 1.5, 2);
        this._hideFishModel();
        this.bobber.resurface(CAST_TARGET);
        this.line.setTarget(CAST_TARGET);
        const t = setTimeout(() => {
          this.line?.setTension(0);
        }, 500);
        this.timers.push(t);
      }),

      // Line break
      this.eventBus.on(GameEvents.FISHING_LINE_BREAK, () => {
        const pos = this.bobber.getWorldPosition();
        this.splash.burst(pos, 20, 0xff8844, 2, 3);
        this._hideFishModel();
        this.line.hide();
        this.bobber.resurface(CAST_TARGET);
        const t = setTimeout(() => {
          this.line?.setTarget(CAST_TARGET);
          this.line?.show();
        }, 800);
        this.timers.push(t);
      }),

      // Idle — show bobber
      this.eventBus.on(GameEvents.FISHING_IDLE, () => {
        this.bobber.showIdle(IDLE_POS);
        this.line.setTarget(IDLE_POS);
        this.line.setTension(0);
        this.line.show();
        this._hideFishModel();
      }),
    );
  }

  // ── Fish model ──

  private _spawnFishModel(fish: SpiritFish): void {
    this._hideFishModel();
    this.fishModel = new VoxelFishModel(fish);
    this.fishModelGroup = this.fishModel.group;

    // Position underwater near bobber
    const pos = CAST_TARGET.clone();
    pos.y -= 0.8; // closer to surface, more visible
    pos.x += (Math.random() - 0.5) * 2;
    pos.z += (Math.random() - 0.5) * 2;
    // Scale up for visibility
    this.fishModelGroup.scale.set(1.5, 1.5, 1.5);
    this.fishModelGroup.position.copy(pos);
    this.fishModelGroup.visible = true;
    this.scene.add(this.fishModelGroup);
    this.fishVisible = true;
    this.fishThrashPhase = 0;
  }

  private _hideFishModel(): void {
    if (this.fishModel) {
      if (this.fishModelGroup) this.scene.remove(this.fishModelGroup);
      this.fishModel.dispose();
      this.fishModel = null;
      this.fishModelGroup = null;
      this.fishVisible = false;
    }
  }

  private _getFishWorldPos(): THREE.Vector3 {
    if (this.fishModelGroup) {
      const pos = new THREE.Vector3();
      this.fishModelGroup.getWorldPosition(pos);
      return pos;
    }
    return CAST_TARGET.clone().add(new THREE.Vector3(0, -1.5, 0));
  }

  // ── Per-frame update ──

  private _wasFlying = false;

  update(dt: number): void {
    const time = performance.now() * 0.001;

    this.fisherman.update(time);
    // Always update line rod tip to track fisherman animation
    this.line.setRodTip(this.fisherman.getWorldRodTip());

    this.bobber.update(dt);
    this.line.update();
    this.splash.update(dt);

    // REF-4: fade mythic glow after trigger
    if (this._mythicGlow && this._mythicGlow.intensity > 0) {
      this._mythicGlow.intensity = Math.max(0, this._mythicGlow.intensity - dt * 2);
    }

    // Reconnect line when bobber lands after flight
    if (this._wasFlying && this.bobber.state === 'waiting') {
      const pos = this.bobber.getWorldPosition();
      this.line.setTarget(pos);
      this.line.setTension(0);
      this.line.show();
      // Landing splash
      this.splash.burst(pos.clone(), 10, this._splashColor, 1, 1.5);
    }
    this._wasFlying = this.bobber.state === 'flying';

    // Fish thrash during reel — absolute positioning, no drift
    if (this.fishVisible && this.fishModelGroup) {
      const basePos = CAST_TARGET.clone();
      basePos.y -= 1.5;
      const thrash = Math.sin(this.fishThrashPhase * 8) * 0.4;
      const sway = Math.cos(this.fishThrashPhase * 5) * 0.3;
      this.fishModelGroup.position.set(
        basePos.x + thrash,
        basePos.y + Math.sin(this.fishThrashPhase * 6) * 0.3,
        basePos.z + sway,
      );
      this.fishModelGroup.rotation.z = thrash * 0.5;

      // Call model's own update for idle animation
      if (this.fishModel) {
        this.fishModel.update(performance.now() * 0.001);
      }
    }
  }

  private _triggerMythicGlow(pos: THREE.Vector3): void {
    if (!this._mythicGlow) {
      this._mythicGlow = new THREE.PointLight(0xffd700, 0, 20);
      this.scene.add(this._mythicGlow);
    }
    this._mythicGlow.position.copy(pos);
    this._mythicGlow.intensity = 5;
  }

  dispose(): void {
    this.unsubs.forEach((fn) => fn());
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this._hideFishModel();
    if (this._mythicGlow) {
      this.scene.remove(this._mythicGlow);
      this._mythicGlow = null;
    }
    this.bobber.dispose();
    this.line.dispose();
    this.splash.dispose();
    this.fisherman.dispose();
    this.scene.remove(this.bobber.group);
    this.scene.remove(this.line.group);
    this.scene.remove(this.splash.group);
    this.scene.remove(this.fisherman.group);
  }
}
