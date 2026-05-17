type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const env = (process.env.LOG_LEVEL || "info").toLowerCase() as Level;
  return LEVELS[env] ?? LEVELS.info;
}

function emit(level: Level, msg: string, fields: LogFields = {}): void {
  if (LEVELS[level] < minLevel()) return;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),

  /**
   * Returns a child logger that injects the given fields into every entry.
   * Useful for per-request loggers carrying a requestId.
   */
  with(fields: LogFields) {
    return {
      debug: (msg: string, extra?: LogFields) => emit("debug", msg, { ...fields, ...extra }),
      info: (msg: string, extra?: LogFields) => emit("info", msg, { ...fields, ...extra }),
      warn: (msg: string, extra?: LogFields) => emit("warn", msg, { ...fields, ...extra }),
      error: (msg: string, extra?: LogFields) => emit("error", msg, { ...fields, ...extra }),
    };
  },
};
