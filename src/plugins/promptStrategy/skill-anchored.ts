import { isAbsolute, join, resolve } from 'node:path'
import { definePlugin } from '../../kernel/registry.js'
import { joinPrompt, maybeLoadProfile } from '../../lib/profile.js'
import { buildVars, loadTemplateFile, render } from './template.js'
import type { CompiledPrompt, PromptStrategyPort } from '../../kernel/ports.js'
import type { Project, Shot } from '../../kernel/types.js'

/**
 * `template` plus a prompt profile.
 *
 * The templates still decide WHICH story facts enter the prompt; the profile
 * decides HOW the frame is framed to the model — the identity anchor that says
 * "this is a generated micro-drama frame, not a shooting reference", the
 * continuity clause, and the negative list.
 *
 * Split this way because the two change on different clocks: templates get
 * edited per project, profiles per model/genre. Profiles live in editable JSON
 * (`prompts/profiles/*.json`) and are re-read every run.
 *
 * Options:
 *   profile        profile id, or "none" to behave exactly like `template`
 *   profileDir     default "./prompts/profiles"
 *   dir            template dir, default "./prompts"
 *   negativePrompt overrides the profile's negatives entirely
 */
export default definePlugin<PromptStrategyPort>({
  port: 'promptStrategy',
  name: 'skill-anchored',
  create: (options, deps) => {
    const rawDir = typeof options['dir'] === 'string' ? options['dir'] : './prompts'
    const dir = isAbsolute(rawDir) ? rawDir : resolve(deps.cwd, rawDir)
    const profileDir =
      typeof options['profileDir'] === 'string' ? options['profileDir'] : './prompts/profiles'
    const profileName = options['profile'] ?? 'photoreal-drama'
    const negativeOverride =
      typeof options['negativePrompt'] === 'string' ? options['negativePrompt'] : undefined
    const imageParams = asRecord(options['imageParams'])
    const videoParams = asRecord(options['videoParams'])

    return {
      name: 'skill-anchored',

      compile: async (shot: Shot, project: Project): Promise<CompiledPrompt> => {
        const [imageTmpl, videoTmpl, profile] = await Promise.all([
          loadTemplateFile(join(dir, 'image.tmpl'), deps.log),
          loadTemplateFile(join(dir, 'video.tmpl'), deps.log, 'video'),
          maybeLoadProfile(deps.cwd, profileDir, profileName),
        ])

        const vars = buildVars(shot, project)
        const body = render(imageTmpl, vars)

        // Anchor first, story second, continuity last: models weight the head
        // of the prompt most, and the continuity clause reads as a constraint
        // rather than a subject when it trails the description.
        const imagePrompt = joinPrompt(
          profile?.anchors.keyframe ?? profile?.anchors.global,
          body,
          profile?.continuityClause,
        )

        const videoPrompt = joinPrompt(render(videoTmpl, vars))

        const profileNegatives = joinPrompt(
          profile?.negatives.shared,
          profile?.negatives.photoreal,
          profile?.negatives.keyframe,
        )
        const negativePrompt = negativeOverride ?? (profileNegatives || undefined)

        return {
          imagePrompt,
          videoPrompt,
          negativePrompt,
          imageParams,
          videoParams,
        }
      },
    }
  },
})

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
