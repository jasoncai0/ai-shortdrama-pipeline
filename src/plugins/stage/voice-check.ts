import { definePlugin } from '../../kernel/registry.js'
import { configError } from '../../kernel/errors.js'
import { narrationReport, validateVoiceCasting } from '../../lib/voice.js'
import type { StagePort } from '../../kernel/ports.js'

/**
 * Voice lint — the audio counterpart of `camera-check`. Free and instant, so
 * it runs right after `shots`, when fixing a narration-heavy breakdown costs
 * one cheap regeneration instead of a re-dub of paid clips.
 *
 * Checks (see src/lib/voice.ts for the rules):
 *  - narration ratio and consecutive narration runs (旁白仅作过渡)
 *  - casting: narrator timbre present when narration exists, no character on
 *    the narrator's voice, duplicate/missing character voices
 *
 * Options:
 *   voices           character name → voice id (same shape as dub's option)
 *   narratorVoice    the dedicated narrator timbre
 *   maxNarrationRatio  default 0.3
 *   maxNarrationRun    default 2
 *   failOn           "never" (default) | "errors" | "findings"
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'voice-check',
  create: () => ({
    name: 'voice-check',
    id: 'voice-check',
    needs: ['shots'],

    run: async (ctx) => {
      const { project, log } = ctx

      const voices =
        ctx.options['voices'] && typeof ctx.options['voices'] === 'object'
          ? (ctx.options['voices'] as Record<string, unknown>)
          : {}
      const narratorVoice =
        typeof ctx.options['narratorVoice'] === 'string' ? ctx.options['narratorVoice'] : undefined
      const failOn =
        ctx.options['failOn'] === 'errors' || ctx.options['failOn'] === 'findings'
          ? ctx.options['failOn']
          : 'never'

      const narration = narrationReport(project.shots, {
        maxRatio: numberOption(ctx.options['maxNarrationRatio'], 0.3),
        maxRun: numberOption(ctx.options['maxNarrationRun'], 2),
      })
      const casting = validateVoiceCasting({
        characters: project.characters,
        shots: project.shots,
        voices,
        narratorVoice,
      })

      const errors = [...casting.errors]
      const warnings = [...narration.findings, ...casting.warnings]

      log.info(
        `voice-check: ${narration.narrated}/${narration.total} shots narrated (${Math.round(narration.ratio * 100)}%)`,
      )
      for (const e of errors) log.error(`  ${e}`)
      for (const w of warnings) log.warn(`  ${w}`)
      if (errors.length === 0 && warnings.length === 0) log.info('voice-check: no findings')

      ctx.emit('voice-check', { errors, warnings, narrationRatio: narration.ratio })

      if (
        (failOn === 'errors' && errors.length > 0) ||
        (failOn === 'findings' && errors.length + warnings.length > 0)
      ) {
        throw configError(
          `voice-check: ${errors.length} error(s), ${warnings.length} warning(s).`,
          [...errors, ...warnings].slice(0, 5).join(' | '),
        )
      }

      return { kind: 'ok', project }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
