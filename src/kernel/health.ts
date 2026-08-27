import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { timeoutError } from './errors.js'
import type { Logger } from './ports.js'

/**
 * Progress reporting + stall detection for long-running generation.
 *
 * Two failure modes this file exists for:
 *  - the user cannot tell what a running pipeline is doing ("is it stuck on
 *    shot 3 or still uploading?") — solved by an atomically-written snapshot
 *    file an external `duanju progress <id>` can read at any time;
 *  - a provider call hangs forever and silently blocks the whole run — solved
 *    by a watchdog that fails the stage when no progress signal (stage event,
 *    per-item tick, heartbeat) arrives within `stallTimeoutMs`.
 *
 * Every progress signal is also a heartbeat: a stage that reports item 3/8
 * has, by doing so, proven it is alive.
 */

export interface ProgressSnapshot {
  readonly projectId: string
  readonly pid: number
  /** Stage currently running, or the last one to finish. */
  readonly stage: string
  readonly status: 'running' | 'done' | 'failed' | 'stalled' | 'idle'
  readonly item?: number
  readonly total?: number
  readonly note?: string
  readonly error?: string
  readonly startedAt: string
  readonly updatedAt: string
  readonly heartbeatAt: string
}

export interface ProgressReporter {
  stageStart(stage: string): void
  /** Per-item progress inside a stage. Also counts as a heartbeat. */
  tick(stage: string, info: { item?: number; total?: number; note?: string }): void
  /** Liveness only — "still working, nothing new to show". */
  beat(): void
  stageDone(stage: string): void
  stageFailed(stage: string, error: string, stalled?: boolean): void
  /** Millis since the last signal of any kind. */
  idleMs(): number
  close(): Promise<void>
}

export const progressFile = (root: string, projectId: string): string =>
  join(root, `${projectId.replace(/[^\w.-]/g, '_')}.json`)

export const createProgressReporter = (opts: {
  root: string
  projectId: string
  log: Logger
}): ProgressReporter => {
  const file = progressFile(opts.root, opts.projectId)
  const startedAt = new Date().toISOString()
  let snapshot: ProgressSnapshot = {
    projectId: opts.projectId,
    pid: process.pid,
    stage: '',
    status: 'idle',
    startedAt,
    updatedAt: startedAt,
    heartbeatAt: startedAt,
  }
  let lastSignal = Date.now()
  // Serialize writes so a fast tick stream cannot interleave tmp files.
  let chain: Promise<void> = Promise.resolve()

  const flush = (): void => {
    const current = snapshot
    chain = chain.then(async () => {
      try {
        await mkdir(opts.root, { recursive: true })
        const tmp = `${file}.${process.pid}.tmp`
        await writeFile(tmp, JSON.stringify(current, null, 2), 'utf8')
        await rename(tmp, file)
      } catch (error) {
        // Reporting must never take down the pipeline it reports on.
        opts.log.debug(`progress write failed: ${String(error)}`)
      }
    })
  }

  const update = (patch: Partial<ProgressSnapshot>): void => {
    const now = new Date().toISOString()
    lastSignal = Date.now()
    snapshot = { ...snapshot, ...patch, updatedAt: now, heartbeatAt: now }
    flush()
  }

  return {
    stageStart: (stage) =>
      update({ stage, status: 'running', item: undefined, total: undefined, note: undefined, error: undefined }),
    tick: (stage, info) => update({ stage, status: 'running', ...info }),
    beat: () => update({}),
    stageDone: (stage) => update({ stage, status: 'done' }),
    stageFailed: (stage, error, stalled) =>
      update({ stage, status: stalled ? 'stalled' : 'failed', error }),
    idleMs: () => Date.now() - lastSignal,
    close: async () => {
      await chain
    },
  }
}

export const readProgress = async (
  root: string,
  projectId: string,
): Promise<ProgressSnapshot | null> => {
  try {
    return JSON.parse(await readFile(progressFile(root, projectId), 'utf8')) as ProgressSnapshot
  } catch {
    return null
  }
}

/** True when the recorded pid still exists on this machine. */
export const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export interface Watchdog {
  /** Any progress signal resets the stall timer. */
  beat(): void
  /**
   * Race `work` against the stall timer. Rejects with E_TIMEOUT when no beat
   * arrives for `stallTimeoutMs` — the hung provider call keeps running in the
   * background (it cannot be cancelled from here), but the pipeline gets its
   * thread of control back and can fail the stage instead of blocking forever.
   */
  guard<T>(label: string, work: Promise<T>): Promise<T>
}

export const createWatchdog = (stallTimeoutMs: number): Watchdog => {
  let lastBeat = Date.now()
  return {
    beat: () => {
      lastBeat = Date.now()
    },
    guard: async <T>(label: string, work: Promise<T>): Promise<T> => {
      lastBeat = Date.now()
      let timer: NodeJS.Timeout | undefined
      const stall = new Promise<never>((_, reject) => {
        const check = (): void => {
          const idle = Date.now() - lastBeat
          if (idle >= stallTimeoutMs) {
            reject(
              timeoutError(
                `${label} stalled: no progress for ${Math.round(idle / 1000)}s (stallTimeoutMs=${stallTimeoutMs}).`,
                'The stage was failed to unblock the pipeline; the underlying call may still be running.',
              ),
            )
            return
          }
          timer = setTimeout(check, Math.min(stallTimeoutMs - idle + 50, stallTimeoutMs))
          timer.unref?.()
        }
        check()
      })
      try {
        return await Promise.race([work, stall])
      } finally {
        if (timer) clearTimeout(timer)
        // A guarded promise that lost the race must not crash the process
        // later as an unhandled rejection.
        work.catch(() => {})
      }
    },
  }
}
