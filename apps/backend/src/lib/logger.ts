type LogLevel = "debug" | "info" | "warn" | "error"

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  debug: (ctx: LogContext | string, message?: string) => void
  info: (ctx: LogContext | string, message?: string) => void
  warn: (ctx: LogContext | string, message?: string) => void
  error: (ctx: LogContext | string, message?: string) => void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? "info"]

function formatMessage(
  level: LogLevel,
  namespace: string,
  ctx: LogContext | string,
  message?: string
): string {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${namespace}]`

  if (typeof ctx === "string") {
    return `${prefix} ${ctx}`
  }

  const contextStr = Object.entries(ctx)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ")

  return message ? `${prefix} ${message} ${contextStr}` : `${prefix} ${contextStr}`
}

function log(level: LogLevel, namespace: string, ctx: LogContext | string, message?: string): void {
  if (LOG_LEVELS[level] < currentLevel) return

  const formatted = formatMessage(level, namespace, ctx, message)

  switch (level) {
    case "debug":
      console.debug(formatted)
      break
    case "info":
      console.info(formatted)
      break
    case "warn":
      console.warn(formatted)
      break
    case "error":
      console.error(formatted)
      break
  }
}

export function createLogger(namespace: string): Logger {
  return {
    debug: (ctx, message) => log("debug", namespace, ctx, message),
    info: (ctx, message) => log("info", namespace, ctx, message),
    warn: (ctx, message) => log("warn", namespace, ctx, message),
    error: (ctx, message) => log("error", namespace, ctx, message),
  }
}
