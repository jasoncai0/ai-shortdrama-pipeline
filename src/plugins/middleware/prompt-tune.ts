import { definePlugin } from '../../kernel/registry.js'
import type { GenerateMiddleware, ImageRequest, VideoRequest } from '../../kernel/ports.js'

/**
 * TUNING SEAM #2a — rewrite prompts and params on the way to the provider,
 * without touching the strategy or the adapter.
 *
 * Config:
 * {
 *   "impl": "prompt-tune",
 *   "options": {
 *     "image": { "prefix": "...", "suffix": "...", "replace": [["cheap","budget"]], "params": {"quality":"2K"} },
 *     "video": { "suffix": ", steady camera, 24fps cinematic", "params": {"resolution":"1080p"} },
 *     "negativePrompt": "..."          // overrides whatever the strategy set
 *   }
 * }
 *
 * This is the knob you reach for when a model needs a house style appended to
 * every prompt — the change lands in one place instead of every template.
 */

interface KindTuning {
  readonly prefix?: string
  readonly suffix?: string
  readonly replace?: readonly (readonly [string, string])[]
  readonly params?: Record<string, unknown>
}

export default definePlugin<GenerateMiddleware>({
  port: 'middleware',
  name: 'prompt-tune',
  create: (options, deps) => {
    const image = asKind(options['image'])
    const video = asKind(options['video'])
    const negativePrompt =
      typeof options['negativePrompt'] === 'string' ? options['negativePrompt'] : undefined

    const applyText = (text: string, tuning: KindTuning | undefined): string => {
      if (!tuning) return text
      let out = text
      for (const [from, to] of tuning.replace ?? []) {
        out = out.split(from).join(to)
      }
      return [tuning.prefix, out, tuning.suffix].filter(Boolean).join(', ').trim()
    }

    return {
      name: 'prompt-tune',

      image: async (req, _ctx, next) => {
        const tuned: ImageRequest = {
          ...req,
          prompt: applyText(req.prompt, image),
          negativePrompt: negativePrompt ?? req.negativePrompt,
          params: { ...req.params, ...image?.params },
        }
        if (tuned.prompt !== req.prompt) deps.log.debug(`prompt-tune image: ${tuned.prompt}`)
        return next(tuned)
      },

      video: async (req, _ctx, next) => {
        const tuned: VideoRequest = {
          ...req,
          prompt: applyText(req.prompt, video),
          negativePrompt: negativePrompt ?? req.negativePrompt,
          params: { ...req.params, ...video?.params },
        }
        if (tuned.prompt !== req.prompt) deps.log.debug(`prompt-tune video: ${tuned.prompt}`)
        return next(tuned)
      },
    }
  },
})

const asKind = (value: unknown): KindTuning | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  return {
    prefix: typeof raw['prefix'] === 'string' ? raw['prefix'] : undefined,
    suffix: typeof raw['suffix'] === 'string' ? raw['suffix'] : undefined,
    replace: Array.isArray(raw['replace'])
      ? (raw['replace'] as unknown[]).flatMap((pair) =>
          Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string'
            ? [[pair[0], pair[1]] as const]
            : [],
        )
      : undefined,
    params:
      raw['params'] && typeof raw['params'] === 'object'
        ? (raw['params'] as Record<string, unknown>)
        : undefined,
  }
}
