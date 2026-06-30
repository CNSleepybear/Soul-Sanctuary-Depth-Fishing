// ===== src/renderer/core/StateMachine.ts =====
// Generic finite state machine with guards and enter/exit hooks.

export class StateMachine<S extends string, C = void> {
  private _current: S;
  private transitions = new Map<S, Map<S, (ctx: C) => boolean>>();
  private enterHooks = new Map<S, (ctx: C) => void>();
  private exitHooks = new Map<S, (ctx: C) => void>();

  constructor(initial: S) {
    this._current = initial;
  }

  get current(): S {
    return this._current;
  }

  /** Add a transition with an optional guard. */
  addTransition(from: S, to: S, guard?: (ctx: C) => boolean): this {
    if (!this.transitions.has(from)) {
      this.transitions.set(from, new Map());
    }
    this.transitions.get(from)!.set(to, guard ?? (() => true));
    return this;
  }

  /** Hook called when entering a state. */
  onEnter(state: S, fn: (ctx: C) => void): this {
    this.enterHooks.set(state, fn);
    return this;
  }

  /** Hook called when exiting a state. */
  onExit(state: S, fn: (ctx: C) => void): this {
    this.exitHooks.set(state, fn);
    return this;
  }

  /** Attempt to transition to a new state. Returns false if guard blocks. */
  transition(to: S, ctx: C): boolean {
    const fromMap = this.transitions.get(this._current);
    if (!fromMap) return false;

    const guard = fromMap.get(to);
    if (!guard || !guard(ctx)) return false;

    // Exit old state
    const exitHook = this.exitHooks.get(this._current);
    if (exitHook) exitHook(ctx);

    // Change state
    this._current = to;

    // Enter new state
    const enterHook = this.enterHooks.get(to);
    if (enterHook) enterHook(ctx);

    return true;
  }

  /** Force a state change, bypassing guards and hooks. */
  forceState(state: S): void {
    this._current = state;
  }

  /** Check if a transition is valid (without executing it). */
  canTransition(to: S, ctx: C): boolean {
    const fromMap = this.transitions.get(this._current);
    if (!fromMap) return false;
    const guard = fromMap.get(to);
    return guard ? guard(ctx) : false;
  }
}
