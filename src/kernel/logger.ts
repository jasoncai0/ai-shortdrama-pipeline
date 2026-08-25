import type { Logger } from './ports.js'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

/**
 * Everything goes to stderr so stdout stays a clean JSON channel for pipes.
 */
export const createLogger = (level: LogLevel = 'info', prefix = ''): Logger => {
  const threshold = ORDER[level]

  const write = (lvl: LogLevel, msg: string, extra?: unknown): void => {
    if (ORDER[lvl] < threshold) return
    const tag = prefix ? `[${prefix}] ` : ''
    const detail =
      extra === undefined
        ? ''
        : ` ${typeof extra === 'string' ? extra : safeJson(extra)}`
    process.stderr.write(`${lvl.padEnd(5)} ${tag}${msg}${detail}\n`)
  }

  return {
    debug: (m, e) => write('debug', m, e),
    info: (m, e) => write('info', m, e),
    warn: (m, e) => write('warn', m, e),
    error: (m, e) => write('error', m, e),
  }
}

export const childLogger = (base: Logger, prefix: string): Logger => ({
  debug: (m, e) => base.debug(`[${prefix}] ${m}`, e),
  info: (m, e) => base.info(`[${prefix}] ${m}`, e),
  warn: (m, e) => base.warn(`[${prefix}] ${m}`, e),
  error: (m, e) => base.error(`[${prefix}] ${m}`, e),
})

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
