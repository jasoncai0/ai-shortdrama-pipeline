import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { mapPool } from '../../lib/pool.js'
import { joinPrompt, maybeLoadProfile } from '../../lib/profile.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort } from '../../kernel/ports.js'
import type { Character, Scene } from '../../kernel/types.js'

/**
 * Stage 3 — generate the `@base` identity reference for each character, plus a
 * plate for each location.
 *
 * `@base` is the identity truth source, and the ONLY character image fed to
 * keyframes and image-to-video. It is deliberately boring: one figure, white
 * cutout background, hair-to-footwear, no scene, no text. Anything else in the
 * frame is something the model can mistake for the shot's content.
 *
 * The spec and the negative list come from the configured prompt profile
 * (`prompts/profiles/*.json`), transcribed from the short-drama production
 * skills; see `docs/skills-integration.md`.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'refs',
  create: () => ({
    name: 'refs',
    id: 'refs',
    needs: ['assets'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const cost = numberOption(ctx.options['cost'], 1)
      const includeScenes = ctx.options['scenes'] !== false
      const limit = Math.min(ctx.concurrency['refs'] ?? 3, ports.image.caps.maxConcurrency)

      const profile = await maybeLoadProfile(
        process.cwd(),
        typeof ctx.options['profileDir'] === 'string' ? ctx.options['profileDir'] : './prompts/profiles',
        ctx.options['profile'] ?? 'photoreal-drama',
      )
      const styleGuide = project.plan?.styleGuide ?? ''
      const failures: { subject: string; error: unknown }[] = []

      const pendingCharacters = project.characters.filter((c) => !c.refImage)
      const characterResults = await mapPool(pendingCharacters, limit, async (character) => {
        const prompt = joinPrompt(
          profile?.anchors.characterBase,
          profile?.characterBase?.spec ?? 'character reference, neutral background, full body',
          styleGuide,
          character.appearance,
        )
        const negativePrompt =
          joinPrompt(
            profile?.negatives.shared,
            profile?.negatives.photoreal,
            profile?.negatives.characterBase,
          ) || undefined
        const key = idempotencyKey('refs', character.id, { prompt, ratio: project.ratio })

        const ref = await billedGenerate({
          ports,
          log,
          idempotencyKey: key,
          cost,
          reason: `character ref ${character.name}`,
          meta: { kind: 'character-ref', projectId: project.id, label: character.name },
          produce: () =>
            ports.image.generate({
              prompt,
              negativePrompt,
              ratio: project.ratio,
              idempotencyKey: key,
              label: `ref-${character.id}`,
            }),
        })
        return { id: character.id, ref }
      })

      const pendingScenes = includeScenes ? project.scenes.filter((s) => !s.refImage) : []
      const sceneResults = await mapPool(pendingScenes, limit, async (scene) => {
        const prompt = joinPrompt(
          profile?.anchors.location,
          profile?.location?.spec ?? 'establishing shot, no people',
          styleGuide,
          scene.visualDescription,
        )
        const negativePrompt =
          joinPrompt(profile?.negatives.shared, profile?.negatives.photoreal) || undefined
        const key = idempotencyKey('refs', scene.id, { prompt, ratio: project.ratio })

        const ref = await billedGenerate({
          ports,
          log,
          idempotencyKey: key,
          cost,
          reason: `scene ref ${scene.name}`,
          meta: { kind: 'scene-ref', projectId: project.id, label: scene.name },
          produce: () =>
            ports.image.generate({
              prompt,
              negativePrompt,
              ratio: project.ratio,
              idempotencyKey: key,
              label: `ref-${scene.id}`,
            }),
        })
        return { id: scene.id, ref }
      })

      const resolvedCharacters = new Map<string, Character['refImage']>()
      characterResults.forEach((settled, index) => {
        const subject = pendingCharacters[index]?.name ?? `character#${index}`
        if (settled.ok) resolvedCharacters.set(settled.value.id, settled.value.ref)
        else failures.push({ subject, error: settled.error })
      })

      const resolvedScenes = new Map<string, Scene['refImage']>()
      sceneResults.forEach((settled, index) => {
        const subject = pendingScenes[index]?.name ?? `scene#${index}`
        if (settled.ok) resolvedScenes.set(settled.value.id, settled.value.ref)
        else failures.push({ subject, error: settled.error })
      })

      summarize(
        log,
        'refs',
        pendingCharacters.length + pendingScenes.length,
        failures,
      )

      return {
        kind: 'ok',
        project: {
          ...project,
          characters: project.characters.map((c) =>
            resolvedCharacters.has(c.id) ? { ...c, refImage: resolvedCharacters.get(c.id) } : c,
          ),
          scenes: project.scenes.map((s) =>
            resolvedScenes.has(s.id) ? { ...s, refImage: resolvedScenes.get(s.id) } : s,
          ),
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
