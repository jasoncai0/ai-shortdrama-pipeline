import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'
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
        const byEpisode = a.episodeId.localeCompare(b.episodeId)
        return byEpisode !== 0 ? byEpisode : a.order - b.order
      })

      const clips = ordered
        .map((shot) => shot.clip)
        .filter((clip): clip is AssetRef => Boolean(clip))

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
