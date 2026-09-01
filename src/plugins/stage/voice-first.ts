import { providerError, stateError } from '../../kernel/errors.js'
import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { mapPool } from '../../lib/pool.js'
import { autoCastVoices } from '../../lib/autocast.js'
import { DEFAULT_TIMING, fitShotsToVoice } from '../../lib/voice-timing.js'
import { narrationPlacement, resolveCasting, spokenLine } from '../../lib/voice.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort } from '../../kernel/ports.js'
import type { AssetRef, Shot } from '../../kernel/types.js'

/**
 * Synthesises every line BEFORE the picture exists, and cuts each shot to the
 * length its line actually takes.
 *
 * The old order — picture first, voice afterwards — left the mix with two bad
 * options on every shot where the estimate was wrong: cut the voice at the end
 * of the clip (a speech stops mid-sentence) or freeze the last frame for the
 * remainder (a 12s shot holding a still for 31s). Neither is a fix, because by
 * then the picture is bought. Measuring the voice first makes the question go
 * away: `videos` is asked for a clip of exactly the right length.
 *
 * The synthesised takes are kept on the shots, so `dub` mixes them rather than
 * paying to say the same lines again.
 *
 * Runs after `shots` and before `videos`.
 *
 * Options: the casting and narration options are the same as `dub`
 * (`voices`, `narratorVoice`, `autoCastVoices`, `includeNarration`,
 * `narrationOpeningShots`, `narrationClosingShots`, `speed`), plus:
 *   minSeconds / maxSeconds  the video model's limits; defaults read from the
 *                            video adapter's caps, so a model swap re-times
 *                            without editing the config
 *   tailPadSeconds           breath after the last syllable, default 0.6
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'voice-first',
  create: () => ({
    name: 'voice-first',
    id: 'voice-first',
    needs: ['shots'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      if (!ports.speech) {
        throw stateError(
          'voice-first requires a speech port.',
          'Add a speech adapter, or drop the "voice-first" stage.',
        )
      }

      const speed = numberOption(ctx.options['speed'], 1)
      const cost = numberOption(ctx.options['cost'], 1)
      const includeNarration = ctx.options['includeNarration'] !== false

      const casting0 = resolveCasting(project, {
        voices: asRecord(ctx.options['voices']),
        narratorVoice: asString(ctx.options['narratorVoice']),
      })
      const narratorVoice = casting0.narratorVoice
      const cast =
        ctx.options['autoCastVoices'] !== false
          ? autoCastVoices(project.characters, project.shots, casting0.voices, narratorVoice)
          : { voices: casting0.voices, assigned: {}, unresolved: [], guessed: [] }
      const voices: Record<string, string> = { ...cast.voices }

      const assigned = Object.keys(cast.assigned)
      if (assigned.length > 0) {
        log.info(
          `voice-first: 自动配音色 ${assigned.length} 位 — ${assigned
            .map((n) => `${n}=${cast.assigned[n]}`)
            .join(', ')}`,
        )
      }

      const placement = narrationPlacement(project.shots, {
        openingShots: numberOption(ctx.options['narrationOpeningShots'], 1),
        closingShots: numberOption(ctx.options['narrationClosingShots'], 1),
      })

      const pending: { shot: Shot; text: string; voice?: string }[] = []
      for (const shot of project.shots) {
        if (shot.voice) continue
        const speakerName = shot.dialogue?.trim()
          ? shot.characterIds.map((id) => project.characters.find((c) => c.id === id)?.name).find(Boolean)
          : undefined
        const resolved = spokenLine(shot, {
          speakerVoice: speakerName ? voices[speakerName] : undefined,
          narratorVoice,
          includeNarration,
          narrationAllowed: placement.allowed.has(shot.id),
        })
        if ('skipped' in resolved) continue
        pending.push({ shot, text: resolved.text, ...(resolved.voice ? { voice: resolved.voice } : {}) })
      }

      if (pending.length === 0 && !project.shots.some((s) => s.voice)) {
        log.info('voice-first: no lines to say')
        return { kind: 'ok', project }
      }

      const limit = Math.min(2, ports.speech.caps.maxConcurrency)
      log.info(`voice-first: 先合成 ${pending.length} 条台词，再按实际时长定镜头长度`)

      const results = await mapPool(pending, limit, async ({ shot, text, voice }) => {
        const key = idempotencyKey('voice-first', shot.id, { text, voice, speed })
        const asset = await billedGenerate({
          ports,
          log,
          idempotencyKey: key,
          cost,
          reason: `voice ${shot.id}`,
          meta: {
            kind: 'other',
            mime: 'audio/mpeg',
            projectId: project.id,
            label: `${shot.id}-voice`,
          },
          produce: () =>
            ports.speech.synthesize({ text, voice, speed, idempotencyKey: key, label: shot.id }),
        })
        return { shotId: shot.id, asset }
      })

      const made = new Map<string, AssetRef>()
      const failures: { subject: string; error: unknown }[] = []
      results.forEach((r, i) => {
        if (r.ok) made.set(r.value.shotId, r.value.asset)
        else failures.push({ subject: pending[i]!.shot.id, error: r.error })
      })
      summarize(log, 'voice-first', pending.length, failures)

      // Measure what was actually said. An unmeasurable take is left alone
      // rather than timed from a guess — the guessing is what this replaces.
      const withVoice = project.shots.map((s) =>
        made.has(s.id) ? { ...s, voice: made.get(s.id) } : s,
      )
      const seconds = new Map<string, number>()
      for (const shot of withVoice) {
        if (!shot.voice) continue
        const measured = await measure(ports, shot.voice)
        if (measured !== undefined) seconds.set(shot.id, measured)
      }

      const caps = ports.video?.caps
      const timing = fitShotsToVoice(withVoice, seconds, {
        minSeconds: numberOption(ctx.options['minSeconds'], caps?.minSeconds ?? DEFAULT_TIMING.minSeconds),
        maxSeconds: numberOption(ctx.options['maxSeconds'], caps?.maxSeconds ?? DEFAULT_TIMING.maxSeconds),
        tailPadSeconds: numberOption(ctx.options['tailPadSeconds'], DEFAULT_TIMING.tailPadSeconds),
      })

      const changed = timing.timed.filter(
        (t) => project.shots.find((s) => s.id === t.shotId)?.durationSeconds !== t.planned,
      )
      log.info(
        `voice-first: 按语音重定时长 ${changed.length}/${timing.timed.length} 个镜头` +
          (timing.overflowing.length > 0
            ? `；${timing.overflowing.length} 条台词超过模型上限，将在 dub 阶段冻帧补足`
            : ''),
      )
      for (const t of timing.overflowing) {
        log.warn(
          `voice-first: ${t.shotId} 的台词需要 ${t.speechSeconds.toFixed(1)}s，超过单镜上限 ${t.planned}s — 建议拆镜`,
        )
      }
      ctx.emit('voice-first', { spoken: made.size, retimed: changed.length })

      return {
        kind: 'ok',
        project: { ...project, shots: timing.shots, updatedAt: new Date().toISOString() },
      }
    },
  }),
})

const measure = async (
  ports: Parameters<StagePort['run']>[0]['ports'],
  ref: AssetRef,
): Promise<number | undefined> => {
  if (!ports.post?.probeDuration) return undefined
  try {
    return await ports.post.probeDuration(ref, ports.assetStore)
  } catch (error) {
    throw providerError(
      `voice-first: cannot measure a synthesised take: ${String(error)}`,
      'The post adapter must be able to probe durations (post/ffmpeg).',
    )
  }
}

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
