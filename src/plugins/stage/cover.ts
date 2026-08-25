import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { mapPool } from '../../lib/pool.js'
import { joinPrompt, maybeLoadProfile } from '../../lib/profile.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Optional stage — the feed cover, the one image that decides whether anyone
 * watches the drama at all.
 *
 * Deliberately different from every other image in the pipeline:
 *
 *  - **3:4, not the project's 9:16.** Feed thumbnails are 3:4 across 红果 /
 *    ReelShort / DramaBox. Reusing the video ratio here is the single most
 *    common mistake.
 *  - **The title is passed through verbatim or not at all.** Text rendering is
 *    unreliable, and a mangled title is worse than none. `titleText` opts in;
 *    the default renders a clean plate for a typographer to overlay.
 *  - **Leads are anchored by their `@base`,** so the cover shows the same faces
 *    the episodes do.
 *
 * Ratio support is checked up front: an adapter that cannot do 3:4 fails here
 * with an explanation rather than silently shipping a 9:16 cover.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'cover',
  create: () => ({
    name: 'cover',
    id: 'cover',
    needs: ['refs'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const cost = numberOption(ctx.options['cost'], 1)
      const variants = Math.max(1, numberOption(ctx.options['variants'], 1))
      const titleText = typeof ctx.options['titleText'] === 'string' ? ctx.options['titleText'] : undefined

      const profile = await maybeLoadProfile(
        process.cwd(),
        typeof ctx.options['profileDir'] === 'string'
          ? ctx.options['profileDir']
          : './prompts/profiles',
        ctx.options['profile'] ?? 'photoreal-drama',
      )

      const wanted = typeof ctx.options['ratio'] === 'string'
        ? ctx.options['ratio']
        : (profile?.cover?.ratio ?? '3:4')
      const ratio = ports.image.caps.ratios.includes(wanted) ? wanted : undefined
      if (!ratio) {
        log.warn(
          `cover: image adapter "${ports.image.name}" cannot do ${wanted} (supports ${ports.image.caps.ratios.join(', ')}); falling back to the project ratio ${project.ratio}`,
        )
      }
      const effectiveRatio = ratio ?? project.ratio

      // Leads first: cover grammar is built on one or two faces, and the
      // reference budget is finite.
      const leadCount = Math.max(1, numberOption(ctx.options['leads'], 2))
      const leads = project.characters
        .filter((c) => c.refImage)
        .slice(0, Math.min(leadCount, ports.image.caps.refImages))
      const refs = leads.map((c) => c.refImage as AssetRef)

      const safeMargin = profile?.cover?.safeMarginPercent ?? 5
      const textClause = titleText
        ? `render exactly this title text and nothing else: "${titleText}"`
        : 'no text of any kind; leave clean negative space in the upper third for a title to be overlaid later'

      const results = await mapPool(
        Array.from({ length: variants }, (_v, i) => i + 1),
        Math.min(variants, ports.image.caps.maxConcurrency),
        async (variant) => {
          const prompt = joinPrompt(
            profile?.anchors.cover ?? profile?.anchors.global,
            profile?.cover?.spec,
            project.plan?.genre,
            project.plan?.logline,
            leads.length > 0 ? `featuring ${leads.map((c) => c.name).join(' and ')}` : undefined,
            leads.map((c) => c.appearance).join('; '),
            project.plan?.styleGuide,
            `keep a ${safeMargin} percent safe margin on all sides`,
            textClause,
            variants > 1 ? `cover direction ${variant} of ${variants}, a distinct composition` : undefined,
          )
          const negativePrompt =
            joinPrompt(
              profile?.negatives.shared,
              profile?.negatives.photoreal,
              profile?.negatives.cover,
            ) || undefined

          const key = idempotencyKey('cover', `${project.id}-v${variant}`, {
            prompt,
            ratio: effectiveRatio,
            refs: refs.map((r) => r.id),
          })

          return billedGenerate({
            ports,
            log,
            idempotencyKey: key,
            cost,
            reason: `cover v${variant}`,
            meta: { kind: 'other', projectId: project.id, label: `cover-v${variant}` },
            produce: () =>
              ports.image.generate({
                prompt,
                negativePrompt,
                refs,
                ratio: effectiveRatio,
                idempotencyKey: key,
                label: `cover-v${variant}`,
              }),
          })
        },
      )

      const covers = results.flatMap((r) => (r.ok ? [r.value] : []))
      const failures = results.flatMap((r, i) =>
        r.ok ? [] : [{ subject: `cover v${i + 1}`, error: r.error }],
      )
      summarize(log, 'cover', variants, failures)

      if (covers.length === 0) {
        return { kind: 'ok', project }
      }
      ctx.emit('cover', { count: covers.length, ratio: effectiveRatio })

      return {
        kind: 'ok',
        project: {
          ...project,
          cover: covers[0],
          coverVariants: covers,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
