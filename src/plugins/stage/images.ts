import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { findCharacter, findLook, findScene } from '../../kernel/types.js'
import { mapPool } from '../../lib/pool.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort } from '../../kernel/ports.js'
import type { AssetRef, Project, Shot } from '../../kernel/types.js'

/**
 * Stage 6 — one still per shot, with the shot's referenced character/scene
 * reference images attached so faces and locations stay stable.
 *
 * Failures are per-shot: a failed still marks that shot `failed` and the batch
 * continues. Re-running the stage retries only the failures (settled keys are
 * short-circuited by the ledger).
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'images',
  create: () => ({
    name: 'images',
    id: 'images',
    needs: ['prompts'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const cost = numberOption(ctx.options['cost'], 1)
      const limit = Math.min(ctx.concurrency['images'] ?? 3, ports.image.caps.maxConcurrency)

      const pending = project.shots
        .filter((shot) => !shot.still)
        .slice(0, ctx.limitShots ?? undefined)

      if (pending.length === 0) {
        log.info('images: nothing to do')
        return { kind: 'ok', project }
      }
      log.info(`images: generating ${pending.length} stills (concurrency ${limit})`)

      let completed = 0
      const results = await mapPool(pending, limit, async (shot) => {
        const prompt = shot.imagePrompt
        if (!prompt) throw new Error(`shot ${shot.id} has no imagePrompt`)

        const refs = referencesFor(shot, project, ports.image.caps.refImages)
        const key = idempotencyKey('images', shot.id, {
          prompt,
          ratio: project.ratio,
          params: shot.imageParams,
          refs: refs.map((r) => r.id),
        })

        const still = await billedGenerate({
          ports,
          log,
          idempotencyKey: key,
          cost,
          reason: `still ${shot.id}`,
          meta: { kind: 'still', projectId: project.id, label: shot.id },
          produce: () =>
            ports.image.generate({
              prompt,
              negativePrompt: shot.negativePrompt,
              refs,
              ratio: project.ratio,
              params: shot.imageParams,
              idempotencyKey: key,
              label: shot.id,
            }),
        })
        completed += 1
        ctx.emit('progress', { item: completed, total: pending.length, note: shot.id })
        return { shotId: shot.id, still }
      })

      const stills = new Map<string, AssetRef>()
      const failed = new Map<string, string>()
      const failures: { subject: string; error: unknown }[] = []

      results.forEach((settled, index) => {
        const shot = pending[index]
        if (!shot) return
        if (settled.ok) stills.set(settled.value.shotId, settled.value.still)
        else {
          failed.set(shot.id, String(settled.error))
          failures.push({ subject: shot.id, error: settled.error })
        }
      })

      summarize(log, 'images', pending.length, failures)
      ctx.emit('images', { ok: stills.size, failed: failed.size })

      return {
        kind: 'ok',
        project: {
          ...project,
          shots: project.shots.map((shot) => {
            const still = stills.get(shot.id)
            if (still) return { ...shot, still, status: 'stilled' as const, failure: undefined }
            const failure = failed.get(shot.id)
            return failure ? { ...shot, status: 'failed' as const, failure } : shot
          }),
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

/**
 * Reference budget is finite, so order matters: characters carry identity and
 * are the most valuable anchors; the scene comes last.
 */
const referencesFor = (shot: Shot, project: Project, budget: number): readonly AssetRef[] => {
  // Base first, then the outfit. The base is the identity and must survive the
  // reference budget; the look only says what they are wearing, and a shot
  // that names one is showing that costume, not the default.
  const characterRefs = shot.characterIds.flatMap((id) => {
    const character = findCharacter(project, id)
    if (!character?.refImage) return []
    const look = findLook(character, shot.wardrobeId)
    return look?.image ? [character.refImage, look.image] : [character.refImage]
  })

  const sceneRef = shot.sceneId ? findScene(project, shot.sceneId)?.refImage : undefined
  const all = sceneRef ? [...characterRefs, sceneRef] : characterRefs
  return all.slice(0, Math.max(0, budget))
}

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
