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
      const clips = ordered
        .map(renderedClip)
        .filter((clip): clip is AssetRef => Boolean(clip))
      const voiced = ordered.filter((shot) => shot.voicedClip).length
      if (voiced > 0) {
        log.info(`export: ${voiced}/${ordered.length} shots use their dubbed audio`)
      }

      const missing = ordered.length - clips.length
      if (missing > 0) {
        log.warn(`export: ${missing}/${ordered.length} shots have no clip and are skipped`)
      }

      const finalCut = await ports.export.concat(
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
