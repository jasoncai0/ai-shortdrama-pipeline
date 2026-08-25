import { definePlugin } from '../../kernel/registry.js'
import { judgeCamera, loadCameraGrammar, type CameraGrammar } from '../../lib/camera.js'
import type { GenerateMiddleware, VideoRequest } from '../../kernel/ports.js'

/**
 * Rewrites the camera language in every video request into physical phrasing
 * just before it reaches the provider.
 *
 * Why a middleware and not the prompt strategy: the strategy composes the
 * shot's *story*, and the same story should survive a change of video model.
 * How camera motion must be worded is a property of the model — Seedance reads
 * "slow" as a mood, a different model may read it as a speed — so it belongs
 * in the swappable layer next to retry and param overrides.
 *
 * Image requests are untouched: a still has no motion to describe.
 *
 * Options:
 *   grammar        path to the vocabulary, default "./prompts/camera/grammar.json"
 *   appendClauses  which grammar.clauses to append, default ["oneDominantMove"]
 *   strict         throw instead of warning when a move is unrecognised (default false)
 */
export default definePlugin<GenerateMiddleware>({
  port: 'middleware',
  name: 'camera-grammar',
  create: async (options, deps) => {
    const path =
      typeof options['grammar'] === 'string' ? options['grammar'] : './prompts/camera/grammar.json'
    const grammar: CameraGrammar = await loadCameraGrammar(deps.cwd, path)

    const clauseKeys = Array.isArray(options['appendClauses'])
      ? (options['appendClauses'] as unknown[]).filter(
          (k): k is keyof CameraGrammar['clauses'] => typeof k === 'string',
        )
      : (['oneDominantMove'] as (keyof CameraGrammar['clauses'])[])
    const clauses = clauseKeys
      .map((k) => grammar.clauses[k])
      .filter((c): c is string => Boolean(c))

    const strict = options['strict'] === true

    return {
      name: 'camera-grammar',

      video: async (req, ctx, next) => {
        const declared = ctx.shot?.cameraMove
        const verdict = judgeCamera(declared, grammar)

        for (const problem of verdict.problems) {
          const message = `camera-grammar: ${ctx.shot?.id ?? req.label ?? 'shot'}: ${problem}`
          if (strict && verdict.moves.length === 0) throw new Error(message)
          deps.log.warn(message)
        }

        // Nothing recognised: leave the prompt alone rather than bolting a
        // wrong physical description onto someone's deliberate wording.
        if (!verdict.phrase) return next(req)

        // Replace the shorthand where it appears; otherwise append. Either way
        // the vague original never reaches the model on its own.
        const canonical =
          declared && req.prompt.includes(declared)
            ? req.prompt.replace(declared, verdict.phrase)
            : `${req.prompt}, ${verdict.phrase}`

        const tuned: VideoRequest = {
          ...req,
          prompt: [canonical, ...clauses].join('. '),
        }
        deps.log.debug(`camera-grammar: ${verdict.moves[0]?.id} → physical phrasing`)
        return next(tuned)
      },
    }
  },
})
