import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'
import type { Shot } from '../../kernel/types.js'

/**
 * Stage 5 — compile every shot's prompts through the configured prompt
 * strategy. Cheap, deterministic, and free: re-run it after editing a
 * character or a template to refresh every shot at once.
 *
 * Hand-edited prompts are preserved unless `--force prompts` is passed with
 * `overwrite: true`, so manual tuning is not silently clobbered.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'prompts',
  create: () => ({
    name: 'prompts',
    id: 'prompts',
    needs: ['shots'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const overwrite = ctx.options['overwrite'] === true

      const compiled: Shot[] = []
      let recompiled = 0

      for (const shot of project.shots) {
        if (!overwrite && shot.imagePrompt && shot.videoPrompt) {
          compiled.push(shot)
          continue
        }
        const result = await ports.promptStrategy.compile(shot, project)
        recompiled += 1
        compiled.push({
          ...shot,
          imagePrompt: result.imagePrompt,
          videoPrompt: result.videoPrompt,
          negativePrompt: result.negativePrompt,
          imageParams: result.imageParams,
          videoParams: result.videoParams,
          status: shot.status === 'draft' ? 'prompted' : shot.status,
        })
      }

      log.info(
        `prompts: compiled ${recompiled}/${project.shots.length} via strategy "${ports.promptStrategy.name}"`,
      )
      if (recompiled > 0 && compiled[0]?.imagePrompt) {
        log.debug(`prompts: sample → ${compiled[0].imagePrompt}`)
      }
      ctx.emit('prompts', { recompiled })

      return {
        kind: 'ok',
        project: { ...project, shots: compiled, updatedAt: new Date().toISOString() },
      }
    },
  }),
})
