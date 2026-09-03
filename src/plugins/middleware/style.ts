import { definePlugin } from '../../kernel/registry.js'
import { loadStylePack, type StylePack } from '../../lib/stylepack.js'
import type { GenerateMiddleware } from '../../kernel/ports.js'

/**
 * Applies a style pack's look to every image and video request on the way to
 * the provider.
 *
 * A middleware rather than part of the prompt strategy, for the same reason
 * `camera-grammar` is: the strategy composes the shot's *story*, which must
 * survive a change of look. Switching a whole production from Shaw Brothers to
 * King Hu should be one line of config, not a re-run of the prompts stage.
 *
 * Unlike `camera-grammar` this touches images too — the look is carried mostly
 * by the keyframe, and a graded video over an ungraded still fights itself.
 *
 * Order matters in the chain: put `style` AFTER `camera-grammar` so the camera
 * rewrite sees the story's own wording, and the style clause lands last where
 * the model reads it as a constraint on the whole frame.
 *
 * Options:
 *   pack     pack id, default "none"
 *   dir      pack directory, default "./prompts/styles"
 *   image    apply to image requests (default true)
 *   video    apply to video requests (default true)
 */
export default definePlugin<GenerateMiddleware>({
  port: 'middleware',
  name: 'style',
  create: async (options, deps) => {
    const dir = typeof options['dir'] === 'string' ? options['dir'] : './prompts/styles'
    const packName = typeof options['pack'] === 'string' ? options['pack'] : 'none'
    const pack: StylePack = await loadStylePack(deps.cwd, dir, packName)
    const doImage = options['image'] !== false
    const doVideo = options['video'] !== false

    deps.log.debug(`style: ${pack.id} — ${pack.label}`)

    const join = (...parts: (string | undefined)[]): string =>
      parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p)).join(', ')

    return {
      name: `style(${pack.id})`,

      image: doImage
        ? async (req, _ctx, next) => {
            // The look anchor leads: models weight the head of a prompt most,
            // and the look is what the whole frame has to obey.
            const prompt = join(pack.look.image, req.prompt)
            const negativePrompt = join(req.negativePrompt, pack.look.negatives)
            return next({
              ...req,
              prompt,
              ...(negativePrompt ? { negativePrompt } : {}),
            })
          }
        : undefined,

      video: doVideo
        ? async (req, _ctx, next) => {
            // Motion clauses trail: the shot's own action must be read first,
            // then constrained by how this school moves a camera.
            const prompt = join(req.prompt, pack.look.video, pack.camera.clause)
            return next({ ...req, prompt })
          }
        : undefined,
    }
  },
})
