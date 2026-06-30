// ===== src/shared/logger.ts =====
// Unified logger with runtime level switch.
// Default level is INFO; production builds should call logger.setLevel(LogLevel.WARN)
// on startup (e.g. in renderer/index.ts when import.meta.env.PROD is true).
// Level can be persisted via localStorage key 'soulsanctuary_log_level'.

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

function isLogLevelName(raw: string): raw is keyof typeof LogLevel {
  return raw in LogLevel && typeof LogLevel[raw as keyof typeof LogLevel] === 'number';
}

function logLevelFromName(raw: string): LogLevel {
  return LogLevel[raw as keyof typeof LogLevel] as LogLevel;
}

export function isLogLevelValue(value: number): value is LogLevel {
  return value in LogLevel && typeof LogLevel[value] === 'string';
}

export class Logger {
  private level: LogLevel;

  constructor(
    private prefix = 'SoulSanctuary',
    level?: LogLevel,
  ) {
    if (level !== undefined) {
      this.level = level;
    } else {
      const stored = this._readStoredLevel();
      this.level = stored ?? LogLevel.INFO;
    }
  }

  private _readStoredLevel(): LogLevel | null {
    try {
      const raw = localStorage.getItem('soulsanctuary_log_level');
      if (raw && isLogLevelName(raw)) {
        return logLevelFromName(raw);
      }
    } catch {
      /* localStorage unavailable or no window */
    }
    return null;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
    try {
      localStorage.setItem('soulsanctuary_log_level', LogLevel[level]);
    } catch {
      /* ignore */
    }
  }

  debug(...args: unknown[]): void {
    this._emit(LogLevel.DEBUG, 'debug', args);
  }
  info(...args: unknown[]): void {
    this._emit(LogLevel.INFO, 'info', args);
  }
  warn(...args: unknown[]): void {
    this._emit(LogLevel.WARN, 'warn', args);
  }
  error(...args: unknown[]): void {
    this._emit(LogLevel.ERROR, 'error', args);
  }

  private _emit(
    level: LogLevel,
    method: 'debug' | 'info' | 'warn' | 'error',
    args: unknown[],
  ): void {
    if (level < this.level) return;
    // eslint-disable-next-line no-console
    const fn = console[method];
    if (fn) fn(`[${this.prefix}]`, ...args);
  }
}

// Global singleton. Import this instance everywhere.
export const logger = new Logger();
