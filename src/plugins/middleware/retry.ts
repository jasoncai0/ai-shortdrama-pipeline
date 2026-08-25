import { describeError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { GenerateMiddleware } from '../../kernel/ports.js'

/**
 * Retries transient provider failures with exponential backoff.
 *
 * Deliberately a middleware and not adapter logic: retry policy is an
 * operational decision that differs per provider and per budget, and it must
 * be composable with the tuning log (place tuning-log inside to see attempts).
 */
export default definePlugin<GenerateMiddleware>({
  port: 'middleware',
  name: 'retry',
  create: (options, deps) => {
    const attempts = typeof options['attempts'] === 'number' ? Math.max(1, options['attempts']) : 3
    const baseDelayMs = typeof options['baseDelayMs'] === 'number' ? options['baseDelayMs'] : 2000

    const withRetry = async <T>(what: string, fn: () => Promise<T>): Promise<T> => {
      let lastError: unknown
      for (let i = 1; i <= attempts; i += 1) {
        try {
          return await fn()
        } catch (error) {
          lastError = error
          if (i === attempts) break
          const delay = baseDelayMs * 2 ** (i - 1)
          // Log the reason, not just the fact: a swallowed first-attempt error
          // makes the final "already exists" style failure impossible to debug.
          deps.log.warn(
            `retry: ${what} failed (attempt ${i}/${attempts}): ${describeError(error)}; retrying in ${delay}ms`,
          )
          await sleep(delay)
        }
      }
      throw lastError
    }

    return {
      name: 'retry',
      image: (req, _ctx, next) => withRetry(`image ${req.label ?? req.idempotencyKey}`, () => next(req)),
      video: (req, _ctx, next) => withRetry(`video ${req.label ?? req.idempotencyKey}`, () => next(req)),
      speech: (req, _ctx, next) =>
        withRetry(`speech ${req.label ?? req.idempotencyKey}`, () => next(req)),
    }
  },
})

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
