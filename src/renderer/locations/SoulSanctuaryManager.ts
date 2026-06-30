// ===== src/renderer/locations/SoulSanctuaryManager.ts =====
// Watches mythic catches and evolves sanctuary ambience based on collected souls.

import { EventBus } from '../core/EventBus';
import { LocationManager } from './LocationManager';
import { GameStateManager } from '../core/GameStateManager';
import { GameEvents } from '../../shared/events';
import { FISH_DATABASE } from '../data/fish-database';
import { i18n } from '../i18n/I18n';

export class SoulSanctuaryManager {
  private eventBus: EventBus;
  private locationManager: LocationManager;
  private gsm: GameStateManager;
  private unsubs: (() => void)[] = [];

  constructor(eventBus: EventBus, locationManager: LocationManager, gsm: GameStateManager) {
    this.eventBus = eventBus;
    this.locationManager = locationManager;
    this.gsm = gsm;
    this._subscribe();
  }

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on(GameEvents.GAME_MYTHIC_CAUGHT, (p) => {
        this._onMythicCaught(
          p.fishId as string,
          p.locationId as string,
          p.isNewDiscovery as boolean,
        );
      }),
      this.eventBus.on(GameEvents.GAME_LOCATION_CHANGE, (p) => {
        this._applyAmbientSouls(p.locationId as string);
      }),
    );
  }

  private _onMythicCaught(fishId: string, locationId: string, isNewDiscovery: boolean): void {
    const currentId = this.locationManager.currentLocationId;
    const loc = this.locationManager.currentLocation;

    if (currentId === locationId && loc) {
      loc.applySoulAwakening();
    }

    const fish = FISH_DATABASE.find((f) => f.id === fishId);
    const name = fish?.name[i18n.lang] ?? fish?.name.en ?? fishId;

    if (isNewDiscovery) {
      this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
        message:
          i18n.lang === 'zh'
            ? `✨ ${name} 的灵魂已回归圣地`
            : `✨ The soul of ${name} has returned to the sanctuary`,
        type: 'rare',
      });
    }

    // Re-apply persistent ambience for current location after awakening fades
    setTimeout(() => {
      if (this.locationManager.currentLocationId === locationId) {
        this._applyAmbientSouls(locationId);
      }
    }, 5200);
  }

  private _applyAmbientSouls(locationId: string): void {
    const loc = this.locationManager.currentLocation;
    if (!loc) return;

    const soulsHere = Object.values(this.gsm.soulCollection).filter(
      (s) => s.locationId === locationId,
    ).length;

    if (soulsHere > 0) {
      loc.applySoulAmbience(soulsHere);
    }
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }
}
