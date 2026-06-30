// ===== src/renderer/core/EventBus.ts =====
// Typed pub/sub event system. All inter-system communication flows through this.

import { logger } from '../../shared/logger';
import type { GameEventMap, GameEventName } from '../../shared/events';

type EventHandler<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<GameEventName, Set<EventHandler<unknown>>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends GameEventName>(event: K, handler: EventHandler<GameEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  /** Subscribe to an event once. Auto-unsubscribes after first fire. */
  once<K extends GameEventName>(event: K, handler: EventHandler<GameEventMap[K]>): () => void {
    const wrapper: EventHandler<GameEventMap[K]> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  /** Unsubscribe from an event. */
  off<K extends GameEventName>(event: K, handler: EventHandler<GameEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler as EventHandler<unknown>);
      if (set.size === 0) this.listeners.delete(event);
    }
  }

  /** Emit an event to all subscribers. Errors in handlers are caught and logged. */
  emit<K extends GameEventName>(event: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (e) {
        logger.error(`[EventBus] Error in handler for "${event}":`, e);
      }
    }
  }

  /** Remove all listeners for all events. Use when destroying the app. */
  clear(): void {
    this.listeners.clear();
  }

  /** Debug: count listeners for an event. */
  listenerCount(event: GameEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
