import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { findCharacter } from '../../kernel/types.js'
import { mapPool } from '../../lib/pool.js'
import { describeError } from '../../kernel/errors.js'
import { billedGenerate, summarize } from './shared.js'
import { resolveCasting, validateVoiceCasting } from '../../lib/voice.js'
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
 *   voices          { "陈瑜之": "male-qn-jingying", … } — overrides the
 *                   voiceId designed into each character (character.voice)
 *   narratorVoice   voice id for narration lines — overrides project.narrator
 *   speed           0.5–2, default 1
 *   voiceGainDb     default 0
 *   bedGainDb       clip's own audio while the voice plays, default -12
 *   padToVoice      hold the last frame when a line outruns the shot (default false)
 *   includeNarration speak `shot.narration` too (default true)
 *   strictCasting   fail when casting rules are violated (default true):
 *                   narration without a dedicated narratorVoice, or a
 *                   character cast on the narrator's timbre
 *   splitOnFailure  when a whole line wedges the provider, say it in clauses
 *                   and join the takes (default true). Some phrasings hang a
 *                   provider's moderation path indefinitely while each clause
 *                   on its own is fine; splitting keeps every character rather
 *                   than leaving the line silent.
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
      const splitOnFailure = ctx.options['splitOnFailure'] !== false
      // The voice designed into each character's 人设 is the default casting;
      // stage options override per run without editing the character.
      const casting0 = resolveCasting(project, {
        voices: asRecord(ctx.options['voices']),
        narratorVoice: asString(ctx.options['narratorVoice']),
      })
      const voices: Record<string, unknown> = { ...casting0.voices }
      const narratorVoice = casting0.narratorVoice
      const limit = Math.min(2, ports.speech.caps.maxConcurrency)

      // Casting rules are hard constraints, checked before anything is spent:
      // narration requires its own timbre, and no character may borrow it.
      const casting = validateVoiceCasting({
        characters: project.characters,
        // With includeNarration off, narration is never synthesised here, so
        // the narrator-timbre requirement does not apply to this run.
        shots: includeNarration
          ? project.shots
          : project.shots.map((s) => ({ ...s, narration: undefined })),
        voices,
        narratorVoice,
        briefs: casting0.briefs,
      })
      if (casting.errors.length > 0 && ctx.options['strictCasting'] !== false) {
        throw new Error(`dub: 声音约束不满足 — ${casting.errors.join(' | ')}`)
      }
      for (const w of casting.warnings) log.warn(`dub: ${w}`)

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

        const say = (body: string, suffix: string): Promise<AssetRef> => {
          const key = idempotencyKey('dub', `${shot.id}${suffix}`, { text: body, voice, speed })
          return billedGenerate({
            ports,
            log,
            idempotencyKey: key,
            cost,
            reason: `voice ${shot.id}${suffix}`,
            meta: {
              kind: 'other',
              mime: 'audio/mpeg',
              projectId: project.id,
              label: `${shot.id}${suffix}-voice`,
            },
            produce: () =>
              ports.speech.synthesize({
                text: body,
                voice,
                speed,
                idempotencyKey: key,
                label: `${shot.id}${suffix}`,
              }),
          })
        }

        let track: AssetRef
        try {
          track = await say(text, '')
        } catch (error) {
          const clauses = splitOnFailure ? clauseSplit(text) : []
          if (!ports.post.concatAudio || clauses.length < 2) throw error

          // A provider that hangs on one phrasing will usually say each clause
          // without complaint. Spoken in pieces and rejoined, not one
          // character of script is lost.
          log.warn(
            `dub: ${shot.id} failed as one take; retrying as ${clauses.length} clauses — ${describeError(error)}`,
          )
          const takes: AssetRef[] = []
          for (const [i, clause] of clauses.entries()) {
            takes.push(await say(clause, `-p${i + 1}`))
          }
          track = await ports.post.concatAudio(takes, ports.assetStore, project.id)
          log.info(`dub: ${shot.id} recovered from ${clauses.length} clause takes`)
        }

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

/**
 * Splits a line at sentence-and-clause punctuation, keeping the terminator with
 * its clause so each take still sounds like speech rather than a fragment.
 */
export const clauseSplit = (text: string): readonly string[] => {
  const parts = text.match(/[^。！？!?…，,、；;：:]*[。！？!?…，,、；;：:]+|[^。！？!?…，,、；;：:]+/g)
  return (parts ?? []).map((p) => p.trim()).filter((p) => p.length > 0)
}
