import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'

/**
 * Human-in-the-loop checkpoint.
 *
 * The whole product thesis is "AI does the heavy lifting, the human decides",
 * so approval is a first-class pipeline element rather than a CLI prompt
 * buried in a stage. Gates halt the run and persist state; `duanju resume`
 * continues past them.
 *
 * A gate id must be unique per pipeline position — use `"id": "gate"` with an
 * explicit `label` option, or distinct ids like `gate-story` / `gate-assets`.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'gate',
  create: (options) => {
    const label = typeof options['label'] === 'string' ? options['label'] : 'gate'
    const question =
      typeof options['prompt'] === 'string' ? options['prompt'] : 'Approve and continue?'

    return {
      name: 'gate',
      id: typeof options['id'] === 'string' ? options['id'] : 'gate',
      needs: [],

      run: async (ctx) => {
        if (ctx.autoApprove) {
          ctx.log.info(`gate "${label}": auto-approved`)
          return { kind: 'ok', project: ctx.project }
        }
        ctx.log.info(`gate "${label}": waiting for approval`)
        return { kind: 'awaiting-input', project: ctx.project, question }
      },
    }
  },
})
