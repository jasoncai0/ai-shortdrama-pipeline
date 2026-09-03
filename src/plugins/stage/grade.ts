import { definePlugin } from '../../kernel/registry.js'
import { stateError } from '../../kernel/errors.js'
import { buildGradeFilter, loadStylePack } from '../../lib/stylepack.js'
import type { StagePort } from '../../kernel/ports.js'

/**
 * Stage — burns the style pack's grade into the assembled cut.
 *
 * This is the half of stylisation the audience can actually see. Prompt
 * anchors ask a model for a look and get an approximation that drifts shot to
 * shot; a grade is arithmetic on pixels, so the same pack produces the same
 * look on every frame of every run.
 *
 * Runs on `finalCut` after `export`, in a single pass: one re-encode for the
 * whole cut rather than one per clip, because each re-encode is generation
 * loss and forty of them is a visibly softer picture.
 *
 * Placed before `music` and `subtitles` on purpose — grading burnt-in
 * subtitles would push the text colour around, and the score is not a picture.
 *
 * A pack with no `grade` block (like `none`) is a no-op that leaves `finalCut`
 * untouched: naming the stage must never cost a re-encode by itself.
 *
 * Options:
 *   pack     pack id, default "none"
 *   dir      pack directory, default "./prompts/styles"
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'grade',
  create: () => ({
    name: 'grade',
    id: 'grade',
    needs: ['export'],

    run: async (ctx) => {
      const { project, ports, log } = ctx

      const dir = typeof ctx.options['dir'] === 'string' ? ctx.options['dir'] : './prompts/styles'
      const packName = typeof ctx.options['pack'] === 'string' ? ctx.options['pack'] : 'none'
      const pack = await loadStylePack(process.cwd(), dir, packName)

      const filter = buildGradeFilter(pack.grade)
      if (!filter) {
        log.info(`grade: pack "${pack.id}" asks for no grade — leaving the cut untouched`)
        return { kind: 'ok', project }
      }

      if (!project.finalCut) {
        throw stateError('grade stage requires a finalCut.', 'Run the "export" stage first.')
      }
      if (!ports.post.applyFilter) {
        throw new Error(
          `post adapter "${ports.post.name}" cannot apply a video filter. Use post/ffmpeg, or drop the "grade" stage.`,
        )
      }

      log.info(`grade: applying "${pack.label}"`)
      log.debug(`grade: filter → ${filter}`)
      ctx.emit('progress', { item: 1, total: 1, note: pack.id })

      const graded = await ports.post.applyFilter(
        project.finalCut,
        filter,
        ports.assetStore,
        project.id,
        `graded-${pack.id}`,
      )

      log.info(`grade: ${graded.uri}`)
      ctx.emit('grade', { pack: pack.id, filter, uri: graded.uri })

      return {
        kind: 'ok',
        project: {
          ...project,
          // The graded cut replaces the picture everything downstream works on
          // (music, subtitles, delivery). The ungraded original stays in the
          // asset store under its own id, so a regrade never needs a re-render.
          finalCut: graded,
          style: { pack: pack.id, label: pack.label, filter },
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})
