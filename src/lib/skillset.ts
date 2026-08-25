import { readFile, readdir } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'
import { configError } from '../kernel/errors.js'

/**
 * Reads imported production skills so an LLM call can be given the relevant
 * pages of one, inline.
 *
 * The skills are long — `real-short-drama` alone is 98 sections and ~19k lines
 * — so "use the skill" can never mean "paste the skill". What actually helps a
 * planning call is a handful of named sections: the writing core, the
 * anti-boredom rules, the cliffhanger library. Everything else is either
 * platform plumbing or advice for a stage that is not running.
 *
 * Selection is therefore explicit and budgeted, and a truncated selection says
 * so out loud — silently dropping half the guidance would leave a run that
 * looks guided and is not.
 */

export interface SkillSection {
  /** Reference filename, e.g. `79-4-14-写作内核-决定剧好不好看.md`. */
  readonly file: string
  readonly heading: string
  readonly text: string
  readonly chars: number
}

export interface LoadedSkill {
  readonly name: string
  readonly description: string
  /** SKILL.md without its frontmatter — the entry point and section index. */
  readonly body: string
  readonly sections: readonly SkillSection[]
}

const sectionEntry = z.object({
  skill: z.string().min(1),
  /** Case-insensitive substrings matched against filename and heading. */
  sections: z.array(z.string()).default([]),
  /** Inline SKILL.md itself; off by default since it is mostly an index. */
  includeBody: z.boolean().default(false),
})

export const inlineMapSchema = z.object({
  /** Total characters of skill text allowed into one call. */
  budgetChars: z.number().int().min(0).default(12_000),
  purposes: z.record(z.array(sectionEntry)).default({}),
})

export type InlineMap = z.infer<typeof inlineMapSchema>

const stripFrontmatter = (text: string): string => {
  if (!text.startsWith('---')) return text
  const end = text.indexOf('\n---', 3)
  return end === -1 ? text : text.slice(end + 4).replace(/^\r?\n/, '')
}

const readDescription = (text: string): string => {
  const match = /^description:\s*"?(.*?)"?\s*$/m.exec(text.split('---')[1] ?? '')
  return match?.[1] ?? ''
}

const firstHeading = (text: string): string =>
  /^#{1,3}\s+(.+)$/m.exec(text)?.[1]?.trim() ?? ''

export const loadSkill = async (
  cwd: string,
  dir: string,
  name: string,
): Promise<LoadedSkill> => {
  const root = isAbsolute(dir) ? dir : resolve(cwd, dir)
  const skillDir = join(root, name)
  const skillPath = join(skillDir, 'SKILL.md')

  let raw: string
  try {
    raw = await readFile(skillPath, 'utf8')
  } catch {
    throw configError(
      `Skill "${name}" not found at ${skillPath}.`,
      'Import it first: node tools/import-pgc-skills.mjs --src <export> --out ./skills',
    )
  }

  const files = await readdir(join(skillDir, 'references')).catch(() => [] as string[])
  const sections = await Promise.all(
    files
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map(async (file) => {
        const text = await readFile(join(skillDir, 'references', file), 'utf8')
        return { file, heading: firstHeading(text) || file, text, chars: text.length }
      }),
  )

  return {
    name,
    description: readDescription(raw),
    body: stripFrontmatter(raw),
    sections,
  }
}

/** Case-insensitive substring match over filename and heading. */
export const selectSections = (
  skill: LoadedSkill,
  patterns: readonly string[],
): readonly SkillSection[] => {
  if (patterns.length === 0) return []
  const wanted = patterns.map((p) => p.toLowerCase())
  return skill.sections.filter((s) =>
    wanted.some(
      (p) => s.file.toLowerCase().includes(p) || s.heading.toLowerCase().includes(p),
    ),
  )
}

export interface AssembledContext {
  readonly text: string
  readonly chars: number
  readonly included: readonly string[]
  /** Sections that did not fit. Reported, never dropped in silence. */
  readonly omitted: readonly string[]
}

/**
 * Packs selected sections into one block, largest-last so the budget trims the
 * bulkiest guidance rather than losing several small, dense rules to one long
 * one.
 */
export const assemble = (
  parts: readonly { readonly skill: string; readonly section: SkillSection }[],
  budgetChars: number,
): AssembledContext => {
  const ordered = [...parts].sort((a, b) => a.section.chars - b.section.chars)
  const chunks: string[] = []
  const included: string[] = []
  const omitted: string[] = []
  let used = 0

  for (const part of ordered) {
    const header = `\n### ${part.skill} › ${part.section.heading}\n\n`
    const cost = header.length + part.section.chars
    if (used + cost > budgetChars) {
      omitted.push(`${part.skill}›${part.section.heading}`)
      continue
    }
    chunks.push(header + part.section.text)
    included.push(`${part.skill}›${part.section.heading}`)
    used += cost
  }

  return { text: chunks.join('\n'), chars: used, included, omitted }
}

export const loadInlineMap = async (cwd: string, path: string): Promise<InlineMap> => {
  const abs = isAbsolute(path) ? path : resolve(cwd, path)
  let text: string
  try {
    text = await readFile(abs, 'utf8')
  } catch {
    throw configError(
      `Skill inline map not found at ${abs}.`,
      'The shipped map is skills/inline-map.json.',
    )
  }
  const parsed = inlineMapSchema.safeParse(JSON.parse(text))
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw configError(`Skill inline map ${abs} failed validation:\n${issues}`)
  }
  return parsed.data
}
