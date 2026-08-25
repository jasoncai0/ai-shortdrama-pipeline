import { stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { StagePort, SubtitleCue } from '../../kernel/ports.js'
import { renderedClip } from '../../kernel/types.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Subtitles — the last thing that happens, and only to a cut somebody approved.
 *
 * That ordering is enforced here rather than merely documented. Burning text
 * into a picture is the one irreversible step in the pipeline: the frames are
 * re-encoded and the clean version is only still available because we kept it
 * under a different key. Doing it to a cut nobody has watched means paying for
 * a re-encode of footage that is about to be regenerated, and — worse — makes
 * the subtitled file look like the finished article when the picture underneath
 * has not been signed off.
 *
 * So the stage refuses to run until the named gate has been cleared. The gate
 * id comes from config because the pipeline names its own stages.
 *
 * Timing is measured from the clips by the post port, not taken from the
 * requested durations. Text comes from each shot's `dialogue`; shots without
 * any produce no cue rather than an empty box on screen.
 *
 * Options:
 *   confirmGate  gate whose completion authorises this, default "gate-cut"
 *                (set to false only if approval happens outside this pipeline)
 *   burn         hardsub into the picture, default true
 *   fontSize / marginVertical / primaryColour / outlineColour / fontName
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'subtitles',
  create: () => ({
    name: 'subtitles',
    id: 'subtitles',
    needs: ['export'],

    run: async (ctx) => {
      const { project, ports, log } = ctx

      const gateOption = ctx.options['confirmGate']
      const confirmGate = gateOption === false ? undefined : stringOption(gateOption, 'gate-cut')

      if (confirmGate) {
        const gate = project.stageState[confirmGate]
        if (!gate) {
          throw stateError(
            `subtitles: no stage named "${confirmGate}" has run, so the cut has not been confirmed.`,
            `Add a gate before this stage — { "id": "${confirmGate}", "use": "gate", "options": { "prompt": "这一版画面确认了吗？" } } — or set confirmGate:false if approval happens elsewhere.`,
          )
        }
        if (gate.status !== 'done') {
          throw stateError(
            `subtitles: gate "${confirmGate}" is ${gate.status}, not done.`,
            'Subtitles are burned in and the re-encode is not free; confirm the picture first (`duanju resume <projectId>`).',
          )
        }
      } else {
        log.warn('subtitles: confirmation gate disabled — burning into an unapproved cut')
      }

      // Subtitle whatever was approved: the scored cut when there is one.
      const target = project.scoredCut ?? project.finalCut
      if (!target) {
        throw stateError('subtitles stage requires a finished cut.', 'Run "export" first.')
      }

      const ordered = [...project.shots]
        .filter((s) => renderedClip(s))
        .sort((a, b) => {
          const byEpisode = a.episodeId.localeCompare(b.episodeId)
          return byEpisode !== 0 ? byEpisode : a.order - b.order
        })

      const clips = ordered.map((shot) => {
        const text = shot.dialogue?.trim()
        const cue: SubtitleCue | undefined = text ? { shotId: shot.id, text } : undefined
        // The same clip export concatenated — a dubbed shot's voiced mix can
        // be longer than its silent original.
        return { ref: renderedClip(shot) as AssetRef, cue }
      })

      const withText = clips.filter((c) => c.cue).length
      if (withText === 0) {
        log.warn(
          `subtitles: none of the ${clips.length} shots carry dialogue — nothing to caption`,
        )
        return { kind: 'ok', project }
      }
      log.info(`subtitles: ${withText}/${clips.length} shots have dialogue`)

      const srt = await ports.post.buildSubtitles(clips, ports.assetStore, project.id)
      const srtPath = await ports.assetStore.localPath(srt).catch(() => srt.uri)
      log.info(`subtitles: wrote ${srtPath}`)

      if (ctx.options['burn'] === false) {
        log.info('subtitles: sidecar only, picture untouched')
        return {
          kind: 'ok',
          project: { ...project, subtitleFile: srt, deliverable: target, updatedAt: new Date().toISOString() },
        }
      }

      const deliverable = await ports.post.burnSubtitles(
        target,
        srt,
        {
          fontSize: numberOption(ctx.options['fontSize'], 18),
          marginVertical: numberOption(ctx.options['marginVertical'], 60),
          primaryColour: stringOption(ctx.options['primaryColour'], '#FFFFFF'),
          outlineColour: stringOption(ctx.options['outlineColour'], '#000000'),
          ...(typeof ctx.options['fontName'] === 'string'
            ? { fontName: ctx.options['fontName'] }
            : {}),
        },
        ports.assetStore,
        project.id,
      )

      const path = await ports.assetStore.localPath(deliverable).catch(() => deliverable.uri)
      log.info(`subtitles: deliverable → ${path}`)
      ctx.emit('subtitles', { cues: withText, burned: true })

      return {
        kind: 'ok',
        project: {
          ...project,
          subtitleFile: srt,
          deliverable,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const stringOption = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback
