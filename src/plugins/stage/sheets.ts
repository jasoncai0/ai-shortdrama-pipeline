import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { mapPool } from '../../lib/pool.js'
import { joinPrompt, maybeLoadProfile } from '../../lib/profile.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Optional stage — the `@sheet` half of the two-tier character asset.
 *
 * `refs` produces `@base` (identity truth, one clean figure). This stage adds
 * a performance board: expressions, head angles, acting poses, hand gestures.
 *
 * Two rules from the source skills that the code enforces rather than merely
 * documents:
 *
 *  1. **base before sheet.** A character with no confirmed `@base` is skipped,
 *     not generated from text. Generating a sheet from a description would
 *     invent a second face for the same person.
 *  2. **a sheet is never an identity reference.** Nothing downstream reads
 *     `sheetImage`; `images`/`videos` only ever pass `refImage`. Feeding a
 *     multi-panel board to a generator leaks the grid into the frame.
 *
 * Cost is real (one image per character) and the output is for human review
 * and prompt authoring, so this stage is off by default.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'sheets',
  create: () => ({
    name: 'sheets',
    id: 'sheets',
    needs: ['refs'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const cost = numberOption(ctx.options['cost'], 1)
      const limit = Math.min(ctx.concurrency['refs'] ?? 3, ports.image.caps.maxConcurrency)
      const ratio = typeof ctx.options['ratio'] === 'string' ? ctx.options['ratio'] : '1:1'

      const profile = await maybeLoadProfile(
        process.cwd(),
        typeof ctx.options['profileDir'] === 'string'
          ? ctx.options['profileDir']
          : './prompts/profiles',
        ctx.options['profile'] ?? 'photoreal-drama',
      )

      const withoutBase = project.characters.filter((c) => !c.refImage)
      if (withoutBase.length > 0) {
        log.warn(
          `sheets: skipping ${withoutBase.length} character(s) with no confirmed @base: ${withoutBase
            .map((c) => c.name)
            .join(', ')}`,
        )
      }

      const pending = project.characters.filter((c) => c.refImage && !c.sheetImage)
      if (pending.length === 0) {
        log.info('sheets: nothing to do')
        return { kind: 'ok', project }
      }
      log.info(`sheets: generating ${pending.length} performance boards`)

      const results = await mapPool(pending, limit, async (character) => {
        const prompt = joinPrompt(
          profile?.anchors.characterSheet,
          profile?.characterSheet?.spec ??
            'character performance board: expressions, head angles, poses, hands',
          project.plan?.styleGuide,
          character.appearance,
        )
        const negativePrompt =
          joinPrompt(
            profile?.negatives.shared,
            profile?.negatives.photoreal,
            profile?.negatives.characterBase,
          ) || undefined

        const base = character.refImage as AssetRef
        const key = idempotencyKey('sheets', character.id, { prompt, ratio, base: base.id })

        const sheet = await billedGenerate({
          ports,
          log,
          idempotencyKey: key,
          cost,
          reason: `character sheet ${character.name}`,
          meta: { kind: 'other', projectId: project.id, label: `${character.name} sheet` },
          produce: () =>
            ports.image.generate({
              prompt,
              negativePrompt,
              // The confirmed base is the identity input; the sheet inherits
              // that face rather than inventing one.
              refs: [base],
              ratio,
              idempotencyKey: key,
              label: `sheet-${character.id}`,
            }),
        })
        return { id: character.id, sheet }
      })

      const resolved = new Map<string, AssetRef>()
      const failures: { subject: string; error: unknown }[] = []
      results.forEach((settled, index) => {
        const subject = pending[index]?.name ?? `character#${index}`
        if (settled.ok) resolved.set(settled.value.id, settled.value.sheet)
        else failures.push({ subject, error: settled.error })
      })

      summarize(log, 'sheets', pending.length, failures)
      ctx.emit('sheets', { ok: resolved.size })

      return {
        kind: 'ok',
        project: {
          ...project,
          characters: project.characters.map((c) =>
            resolved.has(c.id) ? { ...c, sheetImage: resolved.get(c.id) } : c,
          ),
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
