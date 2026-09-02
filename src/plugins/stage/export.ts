import { withHeartbeat } from './shared.js'
import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'
import { renderedClip } from '../../kernel/types.js'
import { episodeOrder } from '../../kernel/types.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Stage 8 — stitch the clips into a final cut, in episode + shot order.
 *
 * Missing clips are skipped rather than aborting: a partial cut of 6 of 8
 * shots is more useful for review than no cut at all. The count is logged so
 * the gap is never silent.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'export',
  create: () => ({
    name: 'export',
    id: 'export',
    needs: ['videos'],

    run: async (ctx) => {
      const { project, ports, log } = ctx

      const ordered = [...project.shots].sort((a, b) => {
        const byEpisode = episodeOrder(a.episodeId) - episodeOrder(b.episodeId)
        return byEpisode !== 0 ? byEpisode : a.order - b.order
      })

      // A voiced clip supersedes the silent one; the clean version stays in
      // the store under its own key, so this is a preference, not a loss.
      // Both routes carry a real voice: a dub we mixed, or a take the model
      // performed from our speech. Only shots with neither are silenced.
      const voiced = ordered.filter((shot) => shot.voicedClip || shot.lipSynced).length
      if (voiced > 0) {
        log.info(`export: ${voiced}/${ordered.length} shots use their dubbed audio`)
      }

      // A shot with no dub still carries the video model's invented
      // soundtrack, which routinely includes speech-like noise. Under a real
      // voice that track is a bed the mix ducks; alone it is heard in full, so
      // an empty 留白 insert sounds like it has a voice-over nobody recorded.
      // Silencing those shots leaves only the score over them.
      const silenceUnvoiced = ctx.options['silenceUnvoiced'] !== false
      const mute = ports.post?.muteAudio?.bind(ports.post)
      if (silenceUnvoiced && !mute && voiced < ordered.length) {
        log.warn(
          `export: post adapter "${ports.post?.name ?? 'none'}" cannot mute audio; ${ordered.length - voiced} unvoiced shot(s) keep the generated soundtrack`,
        )
      }

      const clips: AssetRef[] = []
      let muted = 0
      for (const shot of ordered) {
        const rendered = renderedClip(shot)
        if (!rendered) continue
        if (silenceUnvoiced && mute && !shot.voicedClip && !shot.lipSynced) {
          clips.push(await mute(rendered, ports.assetStore, project.id))
          muted += 1
          ctx.emit('progress', { note: `muting ${shot.id}` })
        } else {
          clips.push(rendered)
        }
      }
      if (muted > 0) {
        log.info(`export: silenced ${muted} shot(s) that carry no dubbed voice`)
      }

      const missing = ordered.length - clips.length
      if (missing > 0) {
        log.warn(`export: ${missing}/${ordered.length} shots have no clip and are skipped`)
      }

      const finalCut = await withHeartbeat(
        ctx,
        'concatenating the cut',
        ports.export.concat(
        clips,
        {
          ratio: project.ratio,
          fps: numberOption(ctx.options['fps'], 24),
          crf: numberOption(ctx.options['crf'], 20),
          outputLabel: `${project.id}-final`,
          // Every reported second of output is a liveness signal: a long
          // concat is otherwise indistinguishable from a hung encoder.
          onProgress: (seconds) => ctx.emit('progress', { note: `encoding ${Math.round(seconds)}s` }),
        },
        ports.assetStore,
        project.id,
      ),
      )

      const path = await ports.assetStore.localPath(finalCut).catch(() => finalCut.uri)
      log.info(`export: ${clips.length} clips → ${path}`)
      ctx.emit('export', { clips: clips.length, uri: finalCut.uri })

      return {
        kind: 'ok',
        project: { ...project, finalCut, updatedAt: new Date().toISOString() },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
