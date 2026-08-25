import { definePlugin } from '../../kernel/registry.js'
import { pngPlaceholder } from '../../lib/placeholder.js'
import type { ImagePort } from '../../kernel/ports.js'

/**
 * Deterministic offline image adapter. Produces a real (tiny) PNG so the whole
 * pipeline — including ffmpeg export — runs end to end in CI for free.
 *
 * This is not a convenience: without it the orchestration logic is untestable.
 */
export default definePlugin<ImagePort>({
  port: 'image',
  name: 'stub',
  create: (options, deps) => {
    const delayMs = typeof options['delayMs'] === 'number' ? options['delayMs'] : 0

    return {
      name: 'stub',
      caps: {
        refImages: 8,
        ratios: ['9:16', '16:9', '1:1', '4:3', '3:4'],
        maxConcurrency: 8,
      },
      generate: async (req) => {
        if (delayMs > 0) await sleep(delayMs)
        deps.log.debug(`stub image: ${req.label ?? req.idempotencyKey}`)
        const bytes = pngPlaceholder(req.idempotencyKey)
        return [
          {
            id: req.idempotencyKey,
            uri: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
            mime: 'image/png',
            bytes: bytes.byteLength,
            meta: { provider: 'stub', prompt: req.prompt, ratio: req.ratio },
          },
        ]
      },
    }
  },
})

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
