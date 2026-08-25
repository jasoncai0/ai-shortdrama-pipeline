#!/usr/bin/env node
/**
 * Convert exported PGC skill bundles into standard skill folders.
 *
 * The export format carries three things a general agent harness cannot use:
 *
 *  1. **Environment identity** — `us-pre` / `cn-pre` profile names, `xla-*`
 *     namespaces, export asset ids. Internal deployment detail.
 *  2. **Plaza / catalogue decoration** — `asset.json` (pin, categoryId, order,
 *     i18n titles, sample prompts) and `bundle.json` (sha256, exportedFrom).
 *     Storefront metadata, not instructions.
 *  3. **A foreign recall mechanism** — `route_profile` with
 *     positive/negative_triggers and `extended.tool_policy.allowed_tools`.
 *     A standard harness routes on `description` alone, so leaving these in
 *     both bloats the recall surface and advertises tools that do not exist.
 *
 * What comes out is `name` + `description` frontmatter and a body whose tool
 * references have been mapped to generic capability language.
 *
 * Usage:
 *   node tools/import-pgc-skills.mjs --src <export-dir> --out <skills-dir> [options]
 *
 *   --only a,b,c        import just these skill keys (default: the short-drama set)
 *   --all               import every skill found
 *   --split-over N      move `##` sections into references/ when SKILL.md
 *                       exceeds N lines (default 1200, 0 disables)
 *   --dry-run           report without writing
 */

import { mkdir, readFile, readdir, rm, writeFile, cp, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

// ── the short-drama / camera working set ──────────────────────────────────
const DEFAULT_SET = [
  'real-short-drama',
  'character-sheet-design',
  'manga-character-sheet',
  'short-drama-cover-design',
  'cover-design-director',
  'video-storyboard',
  'generate-camera-blocking-board',
  'longpoll-consistant',
  'smart-title-sequence',
  'video-remake',
  'costume-visual-design',
  'viral-short-video-production-studio',
  'product-tvc-advertisement-generator',
  'universal-multi-angle-grid',
]

/**
 * Internal platform tools → neutral tool-shaped names.
 *
 * They stay *names*, not descriptive phrases. An earlier version mapped
 * `generate_text` to "a written file", which turned a section heading into
 * "0.1P GENERATE_TEXT ... / a written file 真实 Canvas 文本节点持久化锁" —
 * grammatical nonsense. A token that appears as a noun, in headings, and in
 * prose can only be replaced safely by another token.
 *
 * Order matters: longer names first so `generate_media_v2` is not partially
 * rewritten by a rule for `generate_media`.
 */
const TOOL_MAP = [
  ['media_finishing_agent', 'FinishingTool'],
  ['open_connector_picker', 'ConnectorPicker'],
  ['generate_media_v2', 'GenerateMedia'],
  ['edit_media_v2', 'EditMedia'],
  ['grounded_search', 'WebSearch'],
  ['asset_factory', 'AssetStore'],
  ['generate_text', 'WriteFile'],
  ['skill_file', 'SkillFile'],
  ['ask_human', 'AskUser'],
  ['web_fetch', 'WebFetch'],
  ['image_gen', 'GenerateImage'],
  ['fs_grep', 'Grep'],
  ['fs_list', 'Glob'],
  ['fs_read', 'Read'],
]

/** Environment / deployment identifiers that must not survive the import. */
const ENV_PATTERNS = [
  [/\bus[-_]pre\b/gi, 'the source export'],
  [/\bcn[-_]pre\b/gi, 'the source export'],
  [/\bxla-industry\b/g, 'industry'],
  [/\bskillctl\b/g, 'the export tool'],
  // Cross-skill routes are written namespaced (`industry/banner-design-director`).
  // The namespace is a catalogue concept; a standard harness resolves by bare name.
  [/\b(?:xla-)?industry\/(?=[a-z0-9-]+)/g, ''],
]

/**
 * Descriptions the source shipped too thin to route on. Recall matches the
 * description and nothing else, so a skill described as "Skill for 古装视觉设计."
 * can never fire. These are written from the skill's own body text.
 */
const DESCRIPTION_OVERRIDES = {
  'costume-visual-design':
    '中华古风视觉设计规范：为正史考据、架空古偶、仙侠玄幻、江湖武侠四条赛道提供统一的服化道、场景陈设、传统配色与光影标准，输出结构化视觉设定与含负面清单的 AI 绘画提示词。Use when the user asks for 古装/国风/古风 costume, hairstyle, set dressing, colour palette or art direction for a specific dynasty (秦汉/魏晋/唐/宋/明) or an invented one, or wants Chinese-period-drama visual specs and prompts. Enforces dynasty-correct garment forms, rank-appropriate motifs, and exclusion of Japanese/Korean/Western/modern-influencer styling.',
}

const STRIP_FRONTMATTER_KEYS = new Set([
  'namespace',
  'route_profile',
  'extended',
  'title',
  'version',
  'license',
])

// ── frontmatter ───────────────────────────────────────────────────────────

const splitFrontmatter = (text) => {
  if (!text.startsWith('---')) return { frontmatter: '', body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: '', body: text }
  const frontmatter = text.slice(4, end)
  const rest = text.slice(end + 4)
  return { frontmatter, body: rest.replace(/^\r?\n/, '') }
}

/**
 * Reads only the top-level scalar keys we keep. A full YAML parse is
 * unnecessary — and would tempt us into preserving the nested blocks that are
 * the whole reason for this conversion.
 */
const readTopLevelScalars = (frontmatter) => {
  const out = {}
  const lines = frontmatter.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const match = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    if (rawValue.trim().length === 0) continue // nested block, skip

    let value = rawValue.trim()
    // Fold a quoted value that continues on following indented lines.
    if ((value.startsWith('"') && !value.endsWith('"')) || value === '>' || value === '|') {
      const parts = value === '>' || value === '|' ? [] : [value]
      for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j += 1) {
        parts.push(lines[j].trim())
        i = j
      }
      value = parts.join(' ')
    }
    out[key] = value.replace(/^["']|["']$/g, '').trim()
  }
  return out
}

const yamlQuote = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

// ── desensitising ─────────────────────────────────────────────────────────

const desensitise = (text) => {
  let out = text
  const hits = {}

  for (const [name, replacement] of TOOL_MAP) {
    // Case-insensitive: the same tool appears as `generate_text` in prose and
    // GENERATE_TEXT in headings. Uppercase occurrences keep an uppercase form
    // so headings still read as headings.
    const re = new RegExp(`\\b${name}\\b`, 'gi')
    const count = (out.match(re) ?? []).length
    if (count > 0) {
      hits[name] = count
      out = out.replace(re, (match) =>
        match === match.toUpperCase() ? replacement.toUpperCase() : replacement,
      )
    }
  }
  for (const [pattern, replacement] of ENV_PATTERNS) {
    const count = (out.match(pattern) ?? []).length
    if (count > 0) {
      hits[String(pattern)] = count
      out = out.replace(pattern, replacement)
    }
  }
  return { text: out, hits }
}

// ── splitting oversized skills ────────────────────────────────────────────

const slugify = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section'

/**
 * Version-change blockquotes (`> **v0.1.2 变更说明**：…`) are the largest thing
 * in some preambles and the least useful at runtime: they explain how the
 * skill's rules got to their current state, not what those rules are. They go
 * to a reference file so the history stays available without being reloaded
 * on every invocation.
 */
const extractChangelog = (preamble) => {
  const lines = preamble.split('\n')
  const kept = []
  const changelog = []
  let inEntry = false
  for (const line of lines) {
    if (/^>\s*\*\*v[\d.]+\s*(变更说明|changelog)/i.test(line)) {
      inEntry = true
      changelog.push(line)
      continue
    }
    // A changelog entry can wrap onto further quoted lines.
    if (inEntry && /^>/.test(line)) {
      changelog.push(line)
      continue
    }
    inEntry = false
    kept.push(line)
  }
  return {
    kept: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    changelog: changelog.join('\n\n').trim(),
  }
}

/**
 * A skill whose SKILL.md is thousands of lines defeats its own recall: the
 * whole file is pulled into context the moment it is invoked. Sections are
 * moved into `references/` and replaced by an index, so the agent reads the
 * map first and opens only what it needs.
 *
 * The first section stays inline — it is the skill's actual entry point.
 */
const splitSections = (rawBody, limitLines) => {
  // Strip the changelog wherever it sits — in some skills it trails the first
  // section rather than the preamble, so scoping this to the preamble missed it.
  const { kept: body, changelog } = extractChangelog(rawBody)
  const lines = body.split('\n')
  if (limitLines <= 0 || lines.length <= limitLines) return { body: rawBody, references: [] }

  const marks = []
  let inFence = false
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) inFence = !inFence
    if (!inFence && /^##\s+\S/.test(line)) marks.push(index)
  })
  if (marks.length < 3) return { body: rawBody, references: [] }

  const preamble = lines.slice(0, marks[0]).join('\n')
  const sections = marks.map((start, i) => {
    const end = i + 1 < marks.length ? marks[i + 1] : lines.length
    return {
      heading: lines[start].replace(/^##\s+/, '').trim(),
      content: lines.slice(start, end).join('\n').trim(),
    }
  })

  // Keep the first section inline; it is the "read this first" part.
  const inline = sections[0]
  const moved = sections.slice(1)

  const references = moved.map((section, i) => ({
    file: `${String(i + 1).padStart(2, '0')}-${slugify(section.heading)}.md`,
    heading: section.heading,
    content: `${section.content}\n`,
  }))

  if (changelog) {
    references.unshift({
      file: '00-changelog.md',
      heading: 'Version history',
      content: `# Version history\n\n${changelog}\n`,
    })
  }

  const index = [
    '## Reference index',
    '',
    'This skill is large. The sections below live in `references/` — read the one',
    'you need rather than loading the whole thing.',
    '',
    ...references.map((r) => `- [${r.heading}](references/${r.file})`),
    '',
  ].join('\n')

  return {
    body: [preamble, inline.content, '', index].filter(Boolean).join('\n\n').trim() + '\n',
    references,
  }
}

// ── conversion ────────────────────────────────────────────────────────────

const exists = async (path) => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Copies a tree, rewriting every text file on the way through. */
const copyDesensitised = async (from, to) => {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dst = join(to, entry.name)
    if (entry.isDirectory()) {
      await copyDesensitised(src, dst)
      continue
    }
    const text = await readFile(src, 'utf8').catch(() => null)
    if (text === null) await cp(src, dst)
    else await writeFile(dst, desensitise(text).text, 'utf8')
  }
}

const convertOne = async (sourceDir, key, outDir, options) => {
  const filesDir = join(sourceDir, 'files')
  const skillPath = join(filesDir, 'SKILL.md')
  if (!(await exists(skillPath))) {
    return { key, skipped: 'no files/SKILL.md' }
  }

  const raw = await readFile(skillPath, 'utf8')
  const { frontmatter, body } = splitFrontmatter(raw)
  const scalars = readTopLevelScalars(frontmatter)

  const name = scalars.name ?? key
  const sourceDescription = scalars.description
  if (!sourceDescription) return { key, skipped: 'no description in frontmatter' }

  const dropped = Object.keys(scalars)
    .filter((k) => STRIP_FRONTMATTER_KEYS.has(k))
    .concat(
      ['route_profile', 'extended'].filter((k) => new RegExp(`^${k}:`, 'm').test(frontmatter)),
    )

  const override = DESCRIPTION_OVERRIDES[key]
  if (override) {
    process.stderr.write(`note  ${key}: description replaced (source was too thin to route on)\n`)
  }
  const description = override ?? sourceDescription
  if (description.trim().length < 60) {
    // Recall is description-matching. "Skill for 古装视觉设计." routes on
    // nothing, so flag it rather than importing a skill that can never fire.
    process.stderr.write(
      `warn  ${key}: description is ${description.trim().length} chars — too thin to route on\n`,
    )
  }
  const cleanDescription = desensitise(description)
  const cleanBody = desensitise(body)
  const hits = { ...cleanDescription.hits }
  for (const [k, v] of Object.entries(cleanBody.hits)) hits[k] = (hits[k] ?? 0) + v

  const split = splitSections(cleanBody.text, options.splitOver)

  const out = join(outDir, key)
  const header = ['---', `name: ${name}`, `description: ${yamlQuote(cleanDescription.text)}`, '---', '']
  const finalSkill = `${header.join('\n')}\n${split.body}`

  if (!options.dryRun) {
    await rm(out, { recursive: true, force: true })
    await mkdir(out, { recursive: true })
    await writeFile(join(out, 'SKILL.md'), finalSkill, 'utf8')

    for (const ref of split.references) {
      await mkdir(join(out, 'references'), { recursive: true })
      await writeFile(join(out, 'references', ref.file), ref.content, 'utf8')
    }

    // Carry over real payload directories; drop platform wiring (`agents/`).
    // Recurses: an early version copied nested folders verbatim, which let an
    // `extensions/` subtree keep its internal tool names.
    for (const dir of ['references', 'scripts', 'assets']) {
      const from = join(filesDir, dir)
      if (await exists(from)) await copyDesensitised(from, join(out, dir))
    }
  }

  return {
    key,
    name,
    lines: finalSkill.split('\n').length,
    originalLines: raw.split('\n').length,
    movedSections: split.references.length,
    droppedFrontmatter: [...new Set(dropped)],
    rewrites: hits,
  }
}

// ── cli ───────────────────────────────────────────────────────────────────

const parseArgs = (argv) => {
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      i += 1
    } else {
      flags[key] = true
    }
  }
  return flags
}

const main = async () => {
  const flags = parseArgs(process.argv.slice(2))
  const src = resolve(flags.src ?? '.')
  const out = resolve(flags.out ?? './imported-skills')
  const splitOver = flags['split-over'] === undefined ? 1200 : Number(flags['split-over'])
  const dryRun = flags['dry-run'] === true

  const profiles = (await readdir(src, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const wanted = flags.all
    ? null
    : new Set(String(flags.only ?? DEFAULT_SET.join(',')).split(',').map((s) => s.trim()))

  // Same skill exported from several environments: identical once the
  // environment-specific metadata is stripped, so take the first and verify.
  const found = new Map()
  for (const profile of profiles) {
    const dir = join(src, profile)
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue
      if (wanted && !wanted.has(entry.name)) continue
      if (!found.has(entry.name)) found.set(entry.name, [])
      found.get(entry.name).push(join(dir, entry.name))
    }
  }

  if (found.size === 0) {
    process.stderr.write(`No matching skills under ${src}\n`)
    process.exitCode = 1
    return
  }

  const report = []
  for (const [key, dirs] of [...found].sort()) {
    const result = await convertOne(dirs[0], key, out, { splitOver, dryRun })
    result.sources = dirs.length
    result.sourceDirs = dirs.map((d) => basename(resolve(d, '..')))

    // Prove the duplicate claim instead of assuming it.
    if (dirs.length > 1) {
      const bodies = await Promise.all(
        dirs.map(async (d) =>
          splitFrontmatter(await readFile(join(d, 'files', 'SKILL.md'), 'utf8')).body,
        ),
      )
      result.duplicatesIdentical = bodies.every((b) => b === bodies[0])
    }
    report.push(result)
  }

  process.stdout.write(`${JSON.stringify({ out, dryRun, skills: report }, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack ?? error)}\n`)
  process.exitCode = 1
})
