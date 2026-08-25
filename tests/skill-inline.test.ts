import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { createLogger } from '../src/kernel/logger.js'
import { assemble, loadSkill, selectSections } from '../src/lib/skillset.js'
import skillInline from '../src/plugins/llm/skill-inline.js'
import type { LLMPort } from '../src/kernel/ports.js'
import type { PluginDeps } from '../src/kernel/registry.js'

const log = createLogger('silent')
let work = ''

/** Records what the decorated adapter actually received. */
const capture = () => {
  const seen: { system?: string; purpose?: string }[] = []
  const port: LLMPort = {
    name: 'capture',
    complete: async (req) => {
      seen.push({ system: req.system, purpose: req.purpose })
      return { data: '{}' as never, raw: '{}' }
    },
  }
  return { seen, port }
}

const deps = (inner: LLMPort, onLoad?: (name: string) => void): PluginDeps => ({
  log,
  cwd: work,
  load: async (_port, impl) => {
    onLoad?.(impl)
    return inner as never
  },
})

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), 'duanju-si-'))

  const skill = join(work, 'skills', 'demo-skill')
  await mkdir(join(skill, 'references'), { recursive: true })
  await writeFile(
    join(skill, 'SKILL.md'),
    '---\nname: demo-skill\ndescription: "demo"\n---\n\n# Demo\n\nBODY-MARKER\n',
    'utf8',
  )
  await writeFile(join(skill, 'references', '01-写作内核.md'), '## 写作内核\n\nSMALL-A\n', 'utf8')
  await writeFile(join(skill, 'references', '02-节奏引擎.md'), `## 节奏引擎\n\n${'B'.repeat(400)}\n`, 'utf8')
  await writeFile(join(skill, 'references', '03-huge.md'), `## Huge\n\n${'C'.repeat(5000)}\n`, 'utf8')

  const other = join(work, 'skills', 'never-used')
  await mkdir(other, { recursive: true })
  await writeFile(other + '/SKILL.md', '---\nname: never-used\ndescription: "x"\n---\n\nNOPE\n', 'utf8')

  await writeFile(
    join(work, 'skills', 'map.json'),
    JSON.stringify({
      budgetChars: 1000,
      purposes: {
        plan: [{ skill: 'demo-skill', sections: ['写作内核', '节奏引擎', 'huge'] }],
        assets: [{ skill: 'demo-skill', includeBody: true, sections: [] }],
        typo: [{ skill: 'demo-skill', sections: ['no-such-section'] }],
      },
    }),
    'utf8',
  )
})

afterAll(async () => {
  if (work) await rm(work, { recursive: true, force: true })
})

const make = async (inner: LLMPort, onLoad?: (n: string) => void, over?: Record<string, unknown>) =>
  (await skillInline.create(
    { inner: { impl: 'capture' }, dir: './skills', map: './skills/map.json', ...over },
    deps(inner, onLoad),
  )) as LLMPort

// ─── section selection ────────────────────────────────────────────────────

describe('selectSections', () => {
  test('matches on filename and on heading, case-insensitively', async () => {
    const skill = await loadSkill(work, './skills', 'demo-skill')
    expect(selectSections(skill, ['写作内核']).map((s) => s.heading)).toEqual(['写作内核'])
    expect(selectSections(skill, ['HUGE']).map((s) => s.heading)).toEqual(['Huge'])
  })

  test('no patterns selects nothing — inlining a whole skill must be deliberate', async () => {
    const skill = await loadSkill(work, './skills', 'demo-skill')
    expect(selectSections(skill, [])).toEqual([])
  })
})

describe('assemble', () => {
  const part = (name: string, chars: number) => ({
    skill: 's',
    section: { file: `${name}.md`, heading: name, text: 'x'.repeat(chars), chars },
  })

  test('keeps the small dense rules and drops the one bulky section', () => {
    const out = assemble([part('big', 900), part('a', 50), part('b', 60)], 400)
    expect(out.included).toEqual(['s›a', 's›b'])
    expect(out.omitted).toEqual(['s›big'])
  })

  test('reports what it dropped rather than trimming in silence', () => {
    const out = assemble([part('big', 5000)], 100)
    expect(out.text).toBe('')
    expect(out.omitted).toEqual(['s›big'])
  })

  test('everything fits when the budget allows', () => {
    const out = assemble([part('a', 50), part('b', 60)], 10_000)
    expect(out.omitted).toEqual([])
    expect(out.chars).toBeGreaterThan(110)
  })
})

// ─── the decorator ────────────────────────────────────────────────────────

describe('llm/skill-inline', () => {
  test('a call with no purpose is passed straight through', async () => {
    const { seen, port } = capture()
    const decorated = await make(port)
    await decorated.complete({ system: 'CONTRACT', messages: [{ role: 'user', content: 'x' }] })

    expect(seen[0]?.system).toBe('CONTRACT')
  })

  test('an unmapped purpose is passed straight through', async () => {
    const { seen, port } = capture()
    const decorated = await make(port)
    await decorated.complete({
      purpose: 'music-select',
      system: 'CONTRACT',
      messages: [{ role: 'user', content: 'x' }],
    })

    expect(seen[0]?.system).toBe('CONTRACT')
  })

  test('a mapped purpose gets its sections, and only its sections', async () => {
    const { seen, port } = capture()
    const decorated = await make(port)
    await decorated.complete({
      purpose: 'plan',
      system: 'CONTRACT',
      messages: [{ role: 'user', content: 'x' }],
    })

    const system = seen[0]?.system ?? ''
    expect(system).toContain('SMALL-A')
    expect(system).toContain('节奏引擎')
    // 5000 chars against a 1000 budget: dropped, not squeezed in.
    expect(system).not.toContain('CCCC')
  })

  test('the stage contract stays last, so the output format is the final word', async () => {
    const { seen, port } = capture()
    const decorated = await make(port)
    await decorated.complete({
      purpose: 'plan',
      system: 'CONTRACT',
      messages: [{ role: 'user', content: 'x' }],
    })

    expect(seen[0]?.system?.trimEnd().endsWith('CONTRACT')).toBe(true)
  })

  test('includeBody inlines SKILL.md for skills that have no sections', async () => {
    const { seen, port } = capture()
    const decorated = await make(port)
    await decorated.complete({
      purpose: 'assets',
      system: 'CONTRACT',
      messages: [{ role: 'user', content: 'x' }],
    })

    expect(seen[0]?.system).toContain('BODY-MARKER')
  })

  test('a section pattern that matches nothing is reported, not ignored', async () => {
    const warn = vi.fn()
    const { port } = capture()
    const decorated = (await skillInline.create(
      { inner: { impl: 'capture' }, dir: './skills', map: './skills/map.json' },
      { ...deps(port), log: { ...log, warn } },
    )) as LLMPort

    await decorated.complete({
      purpose: 'typo',
      system: 'CONTRACT',
      messages: [{ role: 'user', content: 'x' }],
    })

    expect(warn.mock.calls.flat().join(' ')).toMatch(/no section matching "no-such-section"/)
  })

  test('nothing is read until a mapped purpose asks for it', async () => {
    // Observed through the load log rather than by spying on fs: the point is
    // that a run with no `plan` stage never opens the skill, which is a
    // behaviour, not an implementation detail.
    const debug = vi.fn()
    const { port } = capture()
    const decorated = (await skillInline.create(
      { inner: { impl: 'capture' }, dir: './skills', map: './skills/map.json' },
      { ...deps(port), log: { ...log, debug } },
    )) as LLMPort

    expect(debug.mock.calls.flat().join(' ')).not.toMatch(/loaded demo-skill/)

    await decorated.complete({ system: 'C', messages: [{ role: 'user', content: 'x' }] })
    expect(debug.mock.calls.flat().join(' ')).not.toMatch(/loaded demo-skill/)

    await decorated.complete({ purpose: 'plan', system: 'C', messages: [{ role: 'user', content: 'x' }] })
    expect(debug.mock.calls.flat().join(' ')).toMatch(/loaded demo-skill/)
  })

  test('a skill referenced by no exercised purpose is never opened', async () => {
    const debug = vi.fn()
    const { port } = capture()
    const decorated = (await skillInline.create(
      { inner: { impl: 'capture' }, dir: './skills', map: './skills/map.json' },
      { ...deps(port), log: { ...log, debug } },
    )) as LLMPort

    await decorated.complete({ purpose: 'plan', system: 'C', messages: [{ role: 'user', content: 'x' }] })
    expect(debug.mock.calls.flat().join(' ')).not.toMatch(/never-used/)
  })

  test('a skill is read once and reused across calls', async () => {
    const debug = vi.fn()
    const { port } = capture()
    const decorated = (await skillInline.create(
      { inner: { impl: 'capture' }, dir: './skills', map: './skills/map.json' },
      { ...deps(port), log: { ...log, debug } },
    )) as LLMPort

    for (let i = 0; i < 3; i += 1) {
      await decorated.complete({ purpose: 'plan', system: 'C', messages: [{ role: 'user', content: 'x' }] })
    }

    const loads = debug.mock.calls.flat().filter((m) => String(m).includes('loaded demo-skill'))
    expect(loads.length).toBe(1)
  })

  test('refuses to be configured without an inner adapter', async () => {
    const { port } = capture()
    await expect(
      skillInline.create({ dir: './skills' }, deps(port)),
    ).rejects.toThrow(/inner must be/)
  })
})

// ─── the shipped map ──────────────────────────────────────────────────────

describe('the shipped inline map', () => {
  test('every section pattern it names still resolves', async () => {
    const repo = new URL('..', import.meta.url).pathname
    const { loadInlineMap } = await import('../src/lib/skillset.js')
    const map = await loadInlineMap(repo, './skills/inline-map.json')

    for (const [purpose, entries] of Object.entries(map.purposes)) {
      for (const entry of entries) {
        const skill = await loadSkill(repo, './skills', entry.skill)
        for (const pattern of entry.sections) {
          const hit = selectSections(skill, [pattern])
          expect(hit.length, `${purpose} → ${entry.skill} › "${pattern}"`).toBeGreaterThan(0)
        }
      }
    }
  })
})
