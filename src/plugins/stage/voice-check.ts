import { definePlugin } from '../../kernel/registry.js'
import { configError } from '../../kernel/errors.js'
import { narrationPlacement, narrationReport, resolveCasting, validateVoiceCasting } from '../../lib/voice.js'
import type { StagePort } from '../../kernel/ports.js'

/**
 * Voice lint — the audio counterpart of `camera-check`. Free and instant, so
 * it runs right after `shots`, when fixing a narration-heavy breakdown costs
 * one cheap regeneration instead of a re-dub of paid clips.
 *
 * Checks (see src/lib/voice.ts for the rules):
 *  - narration ratio and consecutive narration runs (旁白仅作过渡)
 *  - narration placement: only the opening and closing shots of the cut may
 *    carry it, and never a shot that already has a line
 *  - casting: narrator timbre present when narration exists, no character on
 *    the narrator's voice, duplicate/missing character voices
 *
 * Options:
 *   voices           character name → voice id (same shape as dub's option)
 *   narratorVoice    the dedicated narrator timbre
 *   maxNarrationRatio  default 0.3
 *   maxNarrationRun    default 2
 *   narrationOpeningShots  default 1
 *   narrationClosingShots  default 1
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

      const casting0 = resolveCasting(project, {
        voices:
          ctx.options['voices'] && typeof ctx.options['voices'] === 'object'
            ? (ctx.options['voices'] as Record<string, unknown>)
            : {},
        narratorVoice:
          typeof ctx.options['narratorVoice'] === 'string' ? ctx.options['narratorVoice'] : undefined,
      })
      const voices = casting0.voices
      const narratorVoice = casting0.narratorVoice
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
        briefs: casting0.briefs,
      })

      const placement = narrationPlacement(
        project.shots,
        {
          openingShots: numberOption(ctx.options['narrationOpeningShots'], 1),
          closingShots: numberOption(ctx.options['narrationClosingShots'], 1),
        },
        project.episodes.map((e) => e.id),
      )

      const errors = [...casting.errors]
      const warnings = [...placement.findings, ...narration.findings, ...casting.warnings]
      const hasNarration = project.shots.some((s) => s.narration?.trim())
      if (hasNarration && !casting0.narratorBrief) {
        warnings.push('旁白无音色人设（project.narrator.profile）— 旁白也是一个角色，先写人设再选音。')
      }

      log.info(
        `voice-check: ${narration.narrated}/${narration.total} shots narrated (${Math.round(narration.ratio * 100)}%)`,
      )
      for (const e of errors) log.error(`  ${e}`)
      for (const w of warnings) log.warn(`  ${w}`)
      if (errors.length === 0 && warnings.length === 0) log.info('voice-check: no findings')

      ctx.emit('voice-check', {
        errors,
        warnings,
        narrationRatio: narration.ratio,
        narrationMisplaced: { mixed: placement.mixed, middle: placement.middle },
      })

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
