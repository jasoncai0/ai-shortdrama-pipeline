import { definePlugin } from '../../kernel/registry.js'
import type { MusicCandidate, MusicPort } from '../../kernel/ports.js'

/**
 * Fans a music brief out across several sources and merges the candidates.
 *
 * The order is a cost ladder, and it short-circuits: owned library first (free,
 * already cleared), then openly-licensed search (free, needs a licence check),
 * then generation (costs money and minutes). Once `enough` usable candidates
 * exist the remaining sources are not consulted — which is the whole point of
 * putting generation last.
 *
 * Set `alwaysGenerate: true` when you want a bespoke cue in the running even
 * though library tracks were found.
 *
 * Options:
 *   sources         [{ impl, options }, …] in preference order
 *   enough          stop early once this many candidates exist (default 3)
 *   alwaysGenerate  never short-circuit a generating source (default false)
 */
export default definePlugin<MusicPort>({
  port: 'music',
  name: 'multi',
  create: async (options, deps) => {
    const specs = Array.isArray(options['sources'])
      ? (options['sources'] as unknown[]).flatMap((s) => {
          if (typeof s === 'string') return [{ impl: s, options: {} }]
          if (s && typeof s === 'object' && typeof (s as { impl?: unknown }).impl === 'string') {
            const raw = s as { impl: string; options?: Record<string, unknown> }
            return [{ impl: raw.impl, options: raw.options ?? {} }]
          }
          return []
        })
      : []

    const enough = numberOption(options['enough'], 3)
    const alwaysGenerate = options['alwaysGenerate'] === true

    const sources = await Promise.all(
      specs.map(async (spec) => ({
        impl: spec.impl,
        port: await deps.load<MusicPort>('music', spec.impl, spec.options),
      })),
    )

    return {
      name: `multi(${sources.map((s) => s.impl).join('→') || 'none'})`,
      caps: {
        canGenerate: sources.some((s) => s.port.caps.canGenerate),
        maxSeconds: sources.find((s) => s.port.caps.maxSeconds)?.port.caps.maxSeconds,
      },

      find: async (brief, limit) => {
        const collected: MusicCandidate[] = []

        for (const source of sources) {
          const generating = source.port.caps.canGenerate
          if (collected.length >= enough && !(generating && alwaysGenerate)) {
            deps.log.debug(`music/multi: skipping ${source.impl}, ${collected.length} candidates already`)
            continue
          }

          try {
            const found = await source.port.find(brief, Math.max(1, limit - collected.length))
            collected.push(...found)
            deps.log.debug(`music/multi: ${source.impl} → ${found.length}`)
          } catch (error) {
            // One dead source must not cost the run its score.
            deps.log.warn(`music/multi: ${source.impl} failed: ${String(error)}`)
          }
        }

        // Same track surfacing from two sources is one option, not two.
        const seen = new Set<string>()
        return collected.filter((c) => {
          const key = c.uri
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      },
    }
  },
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
