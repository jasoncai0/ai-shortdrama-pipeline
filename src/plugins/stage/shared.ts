import { describeError } from '../../kernel/errors.js'
import type { AssetMeta, Logger, Ports } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * The reserve → generate → ingest → commit sequence, in one place.
 *
 * Three invariants every generating stage relies on:
 *  - `alreadySettled` short-circuits, so `--resume` re-runs cost nothing.
 *  - Provider output is ingested into the asset store immediately, so the
 *    project survives CDN expiry and provider swaps.
 *  - Failures refund the hold; one bad shot never blocks the rest.
 */
export const billedGenerate = async (args: {
  readonly ports: Ports
  readonly log: Logger
  readonly idempotencyKey: string
  readonly cost: number
  readonly reason: string
  readonly meta: AssetMeta
  readonly produce: () => Promise<readonly AssetRef[]>
}): Promise<AssetRef> => {
  const hold = await args.ports.ledger.reserve({
    idempotencyKey: args.idempotencyKey,
    amount: args.cost,
    reason: args.reason,
  })

  if (hold.alreadySettled) {
    // Billed before but the asset is gone from state (rollback, manual edit).
    // Regenerating is correct; billing twice is not.
    args.log.warn(`${args.reason}: already billed, regenerating without a new charge`)
  }

  try {
    const produced = await args.produce()
    const first = produced[0]
    if (!first) {
      throw new Error(`${args.reason}: provider returned no asset`)
    }

    // Carry provider metadata (e.g. libtv canvas node name) into the stored
    // ref, otherwise downstream stages cannot wire canvas edges.
    const stored = await args.ports.assetStore.ingest(first.uri, {
      ...args.meta,
      mime: args.meta.mime ?? first.mime,
      extra: { ...args.meta.extra, ...first.meta },
    })

    if (!hold.alreadySettled) await args.ports.ledger.commit(hold)
    return stored
  } catch (error) {
    if (!hold.alreadySettled) await args.ports.ledger.refund(hold, describeError(error))
    throw error
  }
}

/** Reports how a batch went without hiding partial failure. */
export const summarize = (
  log: Logger,
  what: string,
  total: number,
  failures: readonly { readonly subject: string; readonly error: unknown }[],
): void => {
  const ok = total - failures.length
  if (failures.length === 0) {
    log.info(`${what}: ${ok}/${total} succeeded`)
    return
  }
  log.warn(`${what}: ${ok}/${total} succeeded, ${failures.length} failed`)
  for (const failure of failures) {
    log.warn(`  ${failure.subject}: ${describeError(failure.error)}`)
  }
}

/**
 * Keeps the pipeline watchdog fed while a single long call is in flight.
 *
 * Most stages beat the watchdog naturally: they emit once per item, so a
 * 100-shot stage sends 100 liveness signals. The composite stages do not —
 * `export`, `music`, `intro-cards` and `subtitles` each make ONE ffmpeg call
 * that re-encodes the whole episode. On a 10-minute cut with ten overlays that
 * legitimately runs past the 15-minute stall timeout, and the watchdog fails a
 * stage whose ffmpeg is about to succeed — which is exactly what happened: the
 * finished mp4 landed two seconds after the stage was declared stalled.
 *
 * A periodic beat says the truth ("still working on one long operation")
 * without weakening the timeout for calls that really do hang: if the process
 * dies, the promise rejects and the beats stop with it.
 */
export const withHeartbeat = async <T>(
  ctx: { emit(event: string, payload?: unknown): void },
  label: string,
  work: Promise<T>,
  everyMs = 30_000,
): Promise<T> => {
  const started = Date.now()
  const timer = setInterval(() => {
    ctx.emit('progress', {
      note: `${label} — ${Math.round((Date.now() - started) / 1000)}s`,
    })
  }, everyMs)
  timer.unref?.()
  try {
    return await work
  } finally {
    clearInterval(timer)
  }
}
