import { configError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import {
  assemble,
  loadInlineMap,
  loadSkill,
  selectSections,
  type InlineMap,
  type LoadedSkill,
} from '../../lib/skillset.js'
import type { CompleteRequest, LLMPort, LLMResult } from '../../kernel/ports.js'

/**
 * Wraps another LLM adapter and hands each call the pages of a production
 * skill that its `purpose` actually needs.
 *
 * A decorator rather than a new port: what the model is asked stays the
 * stage's business, what it is told first is a matter of which house rules
 * apply here, and those change on different clocks. Composing through
 * `deps.load` also means the skills ride along with DeepSeek, a local model,
 * or the stub without any of them knowing.
 *
 * **On demand, not up front.** Nothing is read until a call with a mapped
 * purpose arrives; a run with no `plan` stage never opens `real-short-drama`.
 * Each skill is read once and cached for the process.
 *
 * **Selected, not pasted.** `real-short-drama` is 98 sections and ~19k lines.
 * Inlining it whole is impossible and would be wrong anyway — most of it is
 * advice for a stage that is not running. The map names a few sections per
 * purpose; a character budget trims what still does not fit, smallest-first,
 * and says which sections it dropped.
 *
 * Options:
 *   inner       { impl, options } — the adapter that actually talks to a model
 *   dir         skills directory, default "./skills"
 *   map         inline map path, default "./skills/inline-map.json"
 *   budgetChars overrides the map's own budget
 */
export default definePlugin<LLMPort>({
  port: 'llm',
  name: 'skill-inline',
  create: async (options, deps) => {
    const innerSpec = options['inner']
    if (
      !innerSpec ||
      typeof innerSpec !== 'object' ||
      typeof (innerSpec as { impl?: unknown }).impl !== 'string'
    ) {
      throw configError(
        'ports.llm.options.inner must be { impl, options } for the skill-inline adapter.',
        'It decorates a real adapter — for example { "impl": "deepseek" }.',
      )
    }
    const spec = innerSpec as { impl: string; options?: Record<string, unknown> }
    const inner = await deps.load<LLMPort>('llm', spec.impl, spec.options ?? {})

    const dir = typeof options['dir'] === 'string' ? options['dir'] : './skills'
    const mapPath =
      typeof options['map'] === 'string' ? options['map'] : './skills/inline-map.json'
    const budgetOverride =
      typeof options['budgetChars'] === 'number' ? options['budgetChars'] : undefined

    // The map is small and always needed; the skills it points at are not.
    let map: InlineMap | undefined
    const cache = new Map<string, LoadedSkill>()

    const skillFor = async (name: string): Promise<LoadedSkill> => {
      const hit = cache.get(name)
      if (hit) return hit
      const loaded = await loadSkill(deps.cwd, dir, name)
      cache.set(name, loaded)
      deps.log.debug(`skill-inline: loaded ${name} (${loaded.sections.length} sections)`)
      return loaded
    }

    const contextFor = async (purpose: string): Promise<string | undefined> => {
      map ??= await loadInlineMap(deps.cwd, mapPath)
      const entries = map.purposes[purpose]
      if (!entries || entries.length === 0) return undefined

      const parts: { skill: string; section: ReturnType<typeof selectSections>[number] }[] = []
      for (const entry of entries) {
        const skill = await skillFor(entry.skill)

        if (entry.includeBody) {
          parts.push({
            skill: skill.name,
            section: {
              file: 'SKILL.md',
              heading: 'overview',
              text: skill.body,
              chars: skill.body.length,
            },
          })
        }

        const picked = selectSections(skill, entry.sections)
        const missed = entry.sections.filter(
          (p) =>
            !picked.some(
              (s) =>
                s.file.toLowerCase().includes(p.toLowerCase()) ||
                s.heading.toLowerCase().includes(p.toLowerCase()),
            ),
        )
        if (missed.length > 0) {
          // A renamed section would otherwise quietly stop being applied.
          deps.log.warn(
            `skill-inline: ${skill.name} has no section matching ${missed.map((m) => `"${m}"`).join(', ')}`,
          )
        }
        for (const section of picked) parts.push({ skill: skill.name, section })
      }
      if (parts.length === 0) return undefined

      const built = assemble(parts, budgetOverride ?? map.budgetChars)
      deps.log.info(
        `skill-inline: ${purpose} ← ${built.included.length} section(s), ${built.chars} chars` +
          (built.omitted.length > 0 ? ` (${built.omitted.length} over budget)` : ''),
      )
      for (const dropped of built.omitted) {
        deps.log.warn(`skill-inline: over budget, not applied — ${dropped}`)
      }
      return built.text
    }

    return {
      name: `skill-inline(${inner.name})`,

      complete: async <T>(req: CompleteRequest<T>): Promise<LLMResult<T>> => {
        if (!req.purpose) return inner.complete(req)

        const context = await contextFor(req.purpose)
        if (!context) return inner.complete(req)

        // House rules first, then the stage's own instruction: the stage knows
        // the output contract, the skill knows the craft, and the contract has
        // to be the last word or the model starts narrating instead of
        // returning JSON.
        const system = [
          '以下是本项目的短剧生产规范节选，用于指导你这一步的判断。它们是约束，不是输出格式：',
          context,
          '---',
          req.system ?? '',
        ]
          .filter(Boolean)
          .join('\n\n')

        return inner.complete({ ...req, system })
      },
    }
  },
})
