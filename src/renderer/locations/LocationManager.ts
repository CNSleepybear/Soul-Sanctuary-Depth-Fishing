// ===== src/renderer/locations/LocationManager.ts =====
// Registry of all 12 locations. Handles switching with fade transition.

import * as THREE from 'three';
import { LOCATIONS } from '../data/location-data';
import { BaseLocation } from './BaseLocation';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../../shared/events';
import { KyotoJapan } from './KyotoJapan';
import { ChinaBamboo } from './ChinaBamboo';
import { USACyberpunk } from './USACyberpunk';
import { UKThames } from './UKThames';
import { FranceSeine } from './FranceSeine';
import { GermanyBlackForest } from './GermanyBlackForest';
import { ItalyVenice } from './ItalyVenice';
import { DenmarkNyhavn } from './DenmarkNyhavn';
import { IcelandAurora } from './IcelandAurora';
import { ThailandChaoPhraya } from './ThailandChaoPhraya';
import { EgyptValleyKings } from './EgyptValleyKings';
import { GreeceSantorini } from './GreeceSantorini';
import { logger } from '../../shared/logger';
import type { LocationData } from '../../shared/types';

type LocationConstructor = new (scene: THREE.Scene) => BaseLocation;

export class LocationManager {
  private scene: THREE.Scene;
  private eventBus?: EventBus;
  private registry = new Map<string, LocationConstructor>();
  private current: BaseLocation | null = null;
  private currentId: string | null = null;
  private locationIds: string[] = [];
  private index = 0;

  constructor(scene: THREE.Scene, eventBus?: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;

    // Register all 12 sanctuary locations
    this._register('japan', KyotoJapan);
    this._register('china', ChinaBamboo);
    this._register('usa', USACyberpunk);
    this._register('uk', UKThames);
    this._register('france', FranceSeine);
    this._register('germany', GermanyBlackForest);
    this._register('italy', ItalyVenice);
    this._register('denmark', DenmarkNyhavn);
    this._register('iceland', IcelandAurora);
    this._register('thailand', ThailandChaoPhraya);
    this._register('egypt', EgyptValleyKings);
    this._register('greece', GreeceSantorini);

    this.locationIds = Array.from(this.registry.keys());
  }

  private _register(id: string, ctor: LocationConstructor): void {
    this.registry.set(id, ctor);
  }

  get currentLocationData(): LocationData | null {
    if (!this.currentId) return null;
    return LOCATIONS.find((l) => l.id === this.currentId) ?? null;
  }

  get currentLocation(): BaseLocation | null {
    return this.current;
  }
  get currentLocationId(): string | null {
    return this.currentId;
  }

  loadLocation(id: string): void {
    const Ctor = this.registry.get(id);
    if (!Ctor) {
      logger.warn(`[LocationManager] Unknown location: ${id}`);
      return;
    }

    // Destroy current
    if (this.current) {
      this.current.destroy();
    }

    // Build new
    this.current = new Ctor(this.scene);
    this.current.build();
    this.currentId = id;
    this.index = this.locationIds.indexOf(id);

    logger.info(`[LocationManager] Loaded: ${this.current.data.name.zh}`);
    this.eventBus?.emit(GameEvents.GAME_LOCATION_CHANGE, { locationId: id });
  }

  nextLocation(): void {
    this.index = (this.index + 1) % this.locationIds.length;
    this.loadLocation(this.locationIds[this.index]);
  }

  prevLocation(): void {
    this.index = (this.index - 1 + this.locationIds.length) % this.locationIds.length;
    this.loadLocation(this.locationIds[this.index]);
  }

  update(dt: number): void {
    if (this.current) {
      this.current.update(dt, performance.now() / 1000);
    }
  }

  destroy(): void {
    if (this.current) {
      this.current.destroy();
      this.current = null;
    }
  }
}
