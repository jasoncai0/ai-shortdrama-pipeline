import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { findCharacter } from '../../kernel/types.js'
import { mapPool } from '../../lib/pool.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort } from '../../kernel/ports.js'
import type { AssetRef, Shot } from '../../kernel/types.js'

/**
 * Dubbing — synthesised speech for each shot, mixed onto that shot's clip.
 *
 * Per shot rather than one track for the whole cut, because sync is the whole
 * job: shot lengths come back from the video model with fractional drift
 * (a 4s request returns 4.096s), and a single track laid over a concatenation
 * of those drifts is out of step within a minute.
 *
 * Casting matters as much as it does for faces. `voices` maps character name →
 * provider voice id, so one character keeps one voice across every episode;
 * `narratorVoice` is deliberately separate, since the (OS) voice is not a
 * person in the scene. An uncast character falls back to the adapter default
 * and is reported — a silent fallback would let two brothers share a voice
 * without anyone noticing.
 *
 * Runs after `videos` and before `export`, which prefers `voicedClip`.
 *
 * Options:
 *   voices          { "陈瑜之": "male-qn-jingying", … }
 *   narratorVoice   voice id for narration lines
 *   speed           0.5–2, default 1
 *   voiceGainDb     default 0
 *   bedGainDb       clip's own audio while the voice plays, default -12
 *   padToVoice      hold the last frame when a line outruns the shot (default false)
 *   includeNarration speak `shot.narration` too (default true)
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'dub',
  create: () => ({
    name: 'dub',
    id: 'dub',
    needs: ['videos'],

    run: async (ctx) => {
      const { project, ports, log } = ctx

      if (!ports.post.mixVoice) {
        throw new Error(
          `post adapter "${ports.post.name}" cannot mix voice. Use post/ffmpeg, or drop the "dub" stage.`,
        )
      }
      const mixVoice = ports.post.mixVoice.bind(ports.post)

      const cost = numberOption(ctx.options['cost'], 1)
      const speed = numberOption(ctx.options['speed'], 1)
      const voiceGainDb = numberOption(ctx.options['voiceGainDb'], 0)
      const bedGainDb = numberOption(ctx.options['bedGainDb'], -12)
      const padToVoice = ctx.options['padToVoice'] === true
      const includeNarration = ctx.options['includeNarration'] !== false
      const voices = asRecord(ctx.options['voices'])
      const narratorVoice = asString(ctx.options['narratorVoice'])
      const limit = Math.min(2, ports.speech.caps.maxConcurrency)

      const uncast = new Set<string>()

      const pending = project.shots
        .filter((shot) => !shot.voicedClip && shot.clip)
        .filter((shot) => spoken(shot, includeNarration).length > 0)
        .slice(0, ctx.limitShots ?? undefined)

      if (pending.length === 0) {
        log.info('dub: nothing to do')
        return { kind: 'ok', project }
      }
      log.info(`dub: voicing ${pending.length} shots via ${ports.speech.name}`)

      const results = await mapPool(pending, limit, async (shot) => {
        const text = spoken(shot, includeNarration)

        // Narration is the narrator's, even in a shot that also has dialogue:
        // whoever speaks first owns the take.
        const speakerName = shot.dialogue?.trim()
          ? shot.characterIds.map((id) => findCharacter(project, id)?.name).find(Boolean)
          : undefined
        const voice = speakerName ? asString(voices[speakerName]) : narratorVoice
        if (speakerName && !voice) uncast.add(speakerName)

        const voiceKey = idempotencyKey('dub', shot.id, { text, voice, speed })
        const track = await billedGenerate({
          ports,
          log,
          idempotencyKey: voiceKey,
          cost,
          reason: `voice ${shot.id}`,
          meta: { kind: 'other', mime: 'audio/mpeg', projectId: project.id, label: `${shot.id}-voice` },
          produce: () =>
            ports.speech.synthesize({
              text,
              voice,
              speed,
              idempotencyKey: voiceKey,
              label: shot.id,
            }),
        })

        const voiced = await mixVoice(
          shot.clip as AssetRef,
          track,
          { voiceGainDb, bedGainDb, padToVoice },
          ports.assetStore,
          project.id,
        )
        return { shotId: shot.id, voice: track, voicedClip: voiced }
      })

      const voiceById = new Map<string, AssetRef>()
      const voicedById = new Map<string, AssetRef>()
      const failures: { subject: string; error: unknown }[] = []

      results.forEach((settled, index) => {
        const shot = pending[index]
        if (!shot) return
        if (settled.ok) {
          voiceById.set(settled.value.shotId, settled.value.voice)
          voicedById.set(settled.value.shotId, settled.value.voicedClip)
        } else failures.push({ subject: shot.id, error: settled.error })
      })

      if (uncast.size > 0) {
        log.warn(
          `dub: no voice cast for ${[...uncast].join(', ')} — the adapter default was used, so they may share a voice`,
        )
      }
      summarize(log, 'dub', pending.length, failures)
      ctx.emit('dub', { voiced: voicedById.size, uncast: [...uncast] })

      return {
        kind: 'ok',
        project: {
          ...project,
          shots: project.shots.map((shot) =>
            voicedById.has(shot.id)
              ? { ...shot, voice: voiceById.get(shot.id), voicedClip: voicedById.get(shot.id) }
              : shot,
          ),
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

/** Dialogue first, then narration — the order they would be heard. */
const spoken = (shot: Shot, includeNarration: boolean): string =>
  [shot.dialogue?.trim(), includeNarration ? shot.narration?.trim() : undefined]
    .filter((part): part is string => Boolean(part))
    .join(' ')

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
