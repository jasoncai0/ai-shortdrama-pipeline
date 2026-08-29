import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { findCharacter } from '../../kernel/types.js'
import { mapPool } from '../../lib/pool.js'
import { describeError } from '../../kernel/errors.js'
import { billedGenerate, summarize } from './shared.js'
import { narrationPlacement, resolveCasting, spokenLine, validateVoiceCasting } from '../../lib/voice.js'
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
 * The narrator is kept strictly out of the drama: a shot carrying a line is
 * voiced by that character alone (narration written into it is dropped, never
 * mixed in), and narration is only ever spoken in the opening and closing
 * shots of the cut. Both are decided here, before synthesis, so the middle of
 * the video is never paid for in narrator takes.
 *
 * Runs after `videos` and before `export`, which prefers `voicedClip`.
 *
 * Options:
 *   voices          { "陈瑜之": "male-qn-jingying", … } — overrides the
 *                   voiceId designed into each character (character.voice)
 *   narratorVoice   voice id for narration lines — overrides project.narrator
 *   speed           0.5–2, default 1
 *   voiceGainDb     default 0
 *   bedGainDb       clip's own audio while the voice plays, default -12.
 *                   Ignored unless muteSourceAudio is false.
 *   muteSourceAudio strip the video model's invented audio from every clip,
 *                   dubbed or not. Default true: that track performs the same
 *                   line we are dubbing, so it is a second voice under the
 *                   scene — and the only voice on shots with no dialogue.
 *   padToVoice      hold the last frame when a line outruns the shot (default false)
 *   includeNarration speak `shot.narration` too (default true)
 *   narrationOpeningShots  how many head shots may carry narration (default 1)
 *   narrationClosingShots  how many tail shots may carry narration (default 1)
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

      // Where the narrator may speak at all — head and tail of the cut only.
      const placement = narrationPlacement(
        project.shots,
        {
          openingShots: numberOption(ctx.options['narrationOpeningShots'], 1),
          closingShots: numberOption(ctx.options['narrationClosingShots'], 1),
        },
        project.episodes.map((e) => e.id),
      )
      for (const finding of placement.findings) log.warn(`dub: ${finding}`)

      // Resolve what each shot says, and in whose voice, before spending.
      const lines = new Map<string, { text: string; voice?: string; role: string }>()
      for (const shot of project.shots) {
        const speakerName = shot.dialogue?.trim()
          ? shot.characterIds.map((id) => findCharacter(project, id)?.name).find(Boolean)
          : undefined
        const speakerVoice = speakerName ? asString(voices[speakerName]) : undefined
        const resolved = spokenLine(shot, {
          speakerVoice,
          narratorVoice,
          includeNarration,
          narrationAllowed: placement.allowed.has(shot.id),
        })
        if ('skipped' in resolved) continue
        if (resolved.role === 'dialogue' && speakerName && !speakerVoice) uncast.add(speakerName)
        lines.set(shot.id, resolved)
      }

      // A generative video model invents its own audio, and that take performs
      // the very line being dubbed — a second voice under every shot, and the
      // ONLY voice on shots that are never dubbed. When the pipeline owns the
      // audio layer, the model's track comes off every clip.
      const muteSourceAudio = ctx.options['muteSourceAudio'] !== false
      const bedGain = muteSourceAudio ? -120 : bedGainDb

      const pending = project.shots
        .filter((shot) => !shot.voicedClip && shot.clip)
        .filter((shot) => lines.has(shot.id) || muteSourceAudio)
        .slice(0, ctx.limitShots ?? undefined)

      if (pending.length === 0) {
        log.info('dub: nothing to do')
        return { kind: 'ok', project }
      }
      log.info(`dub: voicing ${pending.length} shots via ${ports.speech.name}`)

      const results = await mapPool(pending, limit, async (shot) => {
        const resolved = lines.get(shot.id)

        // Nothing to say here: the shot still needs the model's invented audio
        // taken off, or it plays over the score with a voice nobody cast.
        if (!resolved) {
          const muted = ports.post.stripAudio
            ? await ports.post.stripAudio(shot.clip as AssetRef, ports.assetStore, project.id)
            : (shot.clip as AssetRef)
          return { shotId: shot.id, voice: undefined, voicedClip: muted }
        }

        const text = resolved.text
        const voice = resolved.voice

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
          // A re-mix — silencing the bed, say — must not pay for the same
          // take twice: the first pass left the speech asset on the shot.
          track = shot.voice ?? (await say(text, ''))
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
          { voiceGainDb, bedGainDb: bedGain, padToVoice },
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
          // A muted clip carries no voice — only shots with a line do.
          if (settled.value.voice) voiceById.set(settled.value.shotId, settled.value.voice)
          voicedById.set(settled.value.shotId, settled.value.voicedClip)
        } else failures.push({ subject: shot.id, error: settled.error })
      })

      if (uncast.size > 0) {
        log.warn(
          `dub: no voice cast for ${[...uncast].join(', ')} — the adapter default was used, so they may share a voice`,
        )
      }
      summarize(log, 'dub', pending.length, failures)
      ctx.emit('dub', {
        voiced: voicedById.size,
        uncast: [...uncast],
        narrationSkipped: { mixed: placement.mixed, middle: placement.middle },
      })

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
