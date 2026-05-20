/**
 * Tiny structured JSON logger — no external deps.
 *
 * In production: one JSON line per log call.
 * In dev: ANSI-coloured pretty output for readability.
 *
 * Field redaction: sensitive keys (password, token, authorization, cookie,
 * set-cookie, secret, jwt) are stripped from every log line before output
 * so accidental `logger.info("ctx", req.headers)` calls don't leak creds
 * into the log stream.
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVEL_RANK: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI colour codes — no chalk dependency.
const ANSI: Record<Level, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

const isDev = process.env.NODE_ENV !== "production";
const minLevel: Level = (process.env.LOG_LEVEL as Level | undefined) ?? "info";

// Keys whose values must never reach the log output. Match is
// case-insensitive on the key name; values are replaced by "[REDACTED]".
const REDACT_KEYS = new Set([
  "password",
  "passwd",
  "token",
  "authorization",
  "auth",
  "cookie",
  "set-cookie",
  "secret",
  "jwt",
  "api_key",
  "apikey",
  "session",
]);

function shouldLog(level: Level): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

function write(level: Level, msg: string, fields: Fields): void {
  if (!shouldLog(level)) return;

  const safe = redact(fields) as Fields;

  if (isDev) {
    const colour = ANSI[level];
    const ts = new Date().toISOString();
    const extra =
      Object.keys(safe).length > 0
        ? " " + DIM + JSON.stringify(safe) + RESET
        : "";
     
    console.log(
      `${DIM}${ts}${RESET} ${colour}${level.toUpperCase().padEnd(5)}${RESET} ${msg}${extra}`
    );
  } else {
    const line: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...safe,
    };
     
    console.log(JSON.stringify(line));
  }
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  with(fields: Fields): Logger;
}

function createLogger(baseFields: Fields = {}): Logger {
  return {
    debug(msg, fields = {}) {
      write("debug", msg, { ...baseFields, ...fields });
    },
    info(msg, fields = {}) {
      write("info", msg, { ...baseFields, ...fields });
    },
    warn(msg, fields = {}) {
      write("warn", msg, { ...baseFields, ...fields });
    },
    error(msg, fields = {}) {
      write("error", msg, { ...baseFields, ...fields });
    },
    with(fields) {
      return createLogger({ ...baseFields, ...fields });
    },
  };
}

const logger = createLogger();
export default logger;
