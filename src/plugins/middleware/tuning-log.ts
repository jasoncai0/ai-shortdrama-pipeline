import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { definePlugin } from '../../kernel/registry.js'
import type { GenerateMiddleware } from '../../kernel/ports.js'

/**
 * TUNING SEAM #2b — records the EXACT request that reached the provider plus
 * the resulting asset, as NDJSON. This is what makes prompt tuning empirical:
 * you can diff two runs and see which wording changed which output.
 *
 * Placed last in the middleware chain it logs the final, fully-rewritten
 * request; placed first it logs what the strategy originally produced.
 */
export default definePlugin<GenerateMiddleware>({
  port: 'middleware',
  name: 'tuning-log',
  create: (options, deps) => {
    const rawFile = typeof options['file'] === 'string' ? options['file'] : './.duanju/tuning.ndjson'
    const file = isAbsolute(rawFile) ? rawFile : resolve(deps.cwd, rawFile)

    const write = async (entry: Record<string, unknown>): Promise<void> => {
      try {
        await mkdir(dirname(file), { recursive: true })
        await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8')
      } catch (error) {
        // Never let observability break a paid generation.
        deps.log.warn(`tuning-log: cannot write ${file}: ${String(error)}`)
      }
    }

    return {
      name: 'tuning-log',

      image: async (req, ctx, next) => {
        const startedAt = Date.now()
        try {
          const out = await next(req)
          await write({
            at: new Date().toISOString(),
            kind: 'image',
            ok: true,
            ms: Date.now() - startedAt,
            projectId: ctx.project.id,
            shotId: ctx.shot?.id,
            label: req.label,
            prompt: req.prompt,
            negativePrompt: req.negativePrompt,
            ratio: req.ratio,
            params: req.params,
            refs: req.refs?.map((r) => r.id),
            result: out.map((a) => ({ id: a.id, uri: a.uri })),
          })
          return out
        } catch (error) {
          await write({
            at: new Date().toISOString(),
            kind: 'image',
            ok: false,
            ms: Date.now() - startedAt,
            projectId: ctx.project.id,
            shotId: ctx.shot?.id,
            label: req.label,
            prompt: req.prompt,
            error: String(error),
          })
          throw error
        }
      },

      video: async (req, ctx, next) => {
        const startedAt = Date.now()
        try {
          const out = await next(req)
          await write({
            at: new Date().toISOString(),
            kind: 'video',
            ok: true,
            ms: Date.now() - startedAt,
            projectId: ctx.project.id,
            shotId: ctx.shot?.id,
            label: req.label,
            mode: req.mode,
            prompt: req.prompt,
            negativePrompt: req.negativePrompt,
            seconds: req.seconds,
            ratio: req.ratio,
            params: req.params,
            firstFrame: req.firstFrame?.id,
            identityRefs: req.identityRefs?.map((r) => r.id),
            result: out.map((a) => ({ id: a.id, uri: a.uri })),
          })
          return out
        } catch (error) {
          await write({
            at: new Date().toISOString(),
            kind: 'video',
            ok: false,
            ms: Date.now() - startedAt,
            projectId: ctx.project.id,
            shotId: ctx.shot?.id,
            label: req.label,
            prompt: req.prompt,
            error: String(error),
          })
          throw error
        }
      },
    }
  },
})
