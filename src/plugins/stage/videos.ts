import { idempotencyKey } from '../../kernel/idem.js'
import { AUDIO_MAX_SECONDS, AUDIO_MIN_SECONDS, audioIsRegisterable } from '../../lib/compliance.js'
import { definePlugin } from '../../kernel/registry.js'
import { findCharacter, findLook } from '../../kernel/types.js'
import { mapPool } from '../../lib/pool.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort, VideoMode } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Stage 7 — one clip per shot.
 *
 * Mode is chosen from what is actually available: if the shot has a still we
 * animate it (image-to-video, far better continuity); otherwise we fall back
 * to text-to-video. That means removing the "images" stage from the pipeline
 * still produces a film, just with weaker consistency.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'videos',
  create: () => ({
    name: 'videos',
    id: 'videos',
    needs: ['prompts'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const cost = numberOption(ctx.options['cost'], 5)
      const limit = Math.min(ctx.concurrency['videos'] ?? 2, ports.video.caps.maxConcurrency)

      const pending = project.shots
        .filter((shot) => !shot.clip)
        .filter((shot) => shot.status !== 'failed' || Boolean(shot.still))
        .slice(0, ctx.limitShots ?? undefined)

      if (pending.length === 0) {
        log.info('videos: nothing to do')
        return { kind: 'ok', project }
      }
      log.info(`videos: generating ${pending.length} clips (concurrency ${limit})`)

      // Lip sync costs a compliance filing per shot and cannot be undone once
      // the clip exists, so it is opt-out rather than silent.
      const lipSyncEnabled = ctx.options['lipSync'] !== false
      let completed = 0
      const results = await mapPool(pending, limit, async (shot) => {
        const prompt = shot.videoPrompt ?? shot.plotDescription

        // `videoParams.mode` is consumed here, not forwarded to the adapter:
        // a provider may reject a shot's still (portrait compliance, moderation)
        // while still being able to animate it from text alone. Forcing
        // text2video for that one shot is the escape hatch.
        const { mode: modeOverride, ...providerParams } = (shot.videoParams ?? {}) as {
          mode?: string
        } & Record<string, unknown>

        const mode: VideoMode =
          isVideoMode(modeOverride) && ports.video.caps.modes.includes(modeOverride)
            ? modeOverride
            : shot.still && ports.video.caps.modes.includes('singleImage2video')
              ? 'singleImage2video'
              : 'text2video'

        const firstFrame = mode === 'text2video' ? undefined : shot.still

        // The still fixes composition; it does NOT carry identity. A face can
        // drift or be cropped out of frame zero, so the character's confirmed
        // @base rides along separately and keeps the person the same person.
        const identityRefs = shot.characterIds.flatMap((id) => {
          const character = findCharacter(project, id)
          if (!character?.refImage) return []
          // The costume image carries the same face plus the right clothes, so
          // it anchors both when the shot names a look.
          const look = findLook(character, shot.wardrobeId)
          return look?.image ? [character.refImage, look.image] : [character.refImage]
        })

        // Speech drives the mouth when the provider can take it and the line
        // fits the register's duration window. Outside it the shot keeps the
        // old route: generated picture, dubbed afterwards.
        const speech = lipSyncEnabled && shot.voice && ports.video.caps.audio ? shot.voice : undefined
        const speechSeconds = speech ? await ports.post.probeDuration(speech, ports.assetStore) : undefined
        const voiceTrack =
          speech && speechSeconds !== undefined && audioIsRegisterable(speechSeconds)
            ? speech
            : undefined
        if (speech && !voiceTrack && speechSeconds !== undefined) {
          log.info(
            `videos: ${shot.id} 语音 ${speechSeconds.toFixed(1)}s 不在合规窗口 ${AUDIO_MIN_SECONDS}–${AUDIO_MAX_SECONDS}s，改用后期配音`,
          )
        }

        const key = idempotencyKey('videos', shot.id, {
          prompt,
          mode,
          seconds: shot.durationSeconds,
          ratio: project.ratio,
          params: providerParams,
          still: firstFrame?.id,
          voice: voiceTrack?.id,
          identityRefs: identityRefs.map((r) => r.id),
        })

        const clip = await billedGenerate({
          ports,
          log,
          idempotencyKey: key,
          cost,
          reason: `clip ${shot.id}`,
          meta: { kind: 'clip', projectId: project.id, label: shot.id },
          produce: () =>
            ports.video.generate({
              mode,
              prompt,
              negativePrompt: shot.negativePrompt,
              firstFrame,
              identityRefs,
              ...(voiceTrack ? { voiceTrack } : {}),
              seconds: shot.durationSeconds,
              ratio: project.ratio,
              params: providerParams,
              idempotencyKey: key,
              label: shot.id,
            }),
        })
        completed += 1
        ctx.emit('progress', { item: completed, total: pending.length, note: shot.id })
        return { shotId: shot.id, clip, lipSynced: Boolean(voiceTrack) }
      })

      const clips = new Map<string, AssetRef>()
      // Clips the model performed from our speech: their audio already matches
      // the mouth, so the dub stage must leave them alone.
      const lipSynced = new Set<string>()
      const failed = new Map<string, string>()
      const failures: { subject: string; error: unknown }[] = []

      results.forEach((settled, index) => {
        const shot = pending[index]
        if (!shot) return
        if (settled.ok) {
          clips.set(settled.value.shotId, settled.value.clip)
          if (settled.value.lipSynced) lipSynced.add(settled.value.shotId)
        }
        else {
          failed.set(shot.id, String(settled.error))
          failures.push({ subject: shot.id, error: settled.error })
        }
      })

      summarize(log, 'videos', pending.length, failures)
      if (lipSynced.size > 0) {
        log.info(`videos: ${lipSynced.size}/${clips.size} 个镜头由语音驱动生成，口型与台词同步`)
      }
      ctx.emit('videos', { ok: clips.size, failed: failed.size, lipSynced: lipSynced.size })

      return {
        kind: 'ok',
        project: {
          ...project,
          shots: project.shots.map((shot) => {
            const clip = clips.get(shot.id)
            if (clip)
              return {
                ...shot,
                clip,
                ...(lipSynced.has(shot.id) ? { lipSynced: true } : {}),
                status: 'clipped' as const,
                failure: undefined,
              }
            const failure = failed.get(shot.id)
            return failure ? { ...shot, status: 'failed' as const, failure } : shot
          }),
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const VIDEO_MODES: readonly VideoMode[] = [
  'text2video',
  'singleImage2video',
  'frames2video',
  'image2video',
]

const isVideoMode = (value: unknown): value is VideoMode =>
  typeof value === 'string' && (VIDEO_MODES as readonly string[]).includes(value)

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
