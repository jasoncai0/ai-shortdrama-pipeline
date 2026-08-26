import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import plugin from '../src/plugins/stage/import-script.js'
import type { Project } from '../src/kernel/types.js'

/**
 * The screenplay tells us who exists; it does not tell us who is worth paying
 * for, nor what anyone looks like. Those two judgements are what this covers —
 * both fail silently and expensively (a portrait of a name that never appears,
 * or a prompt made of personality notes).
 */

const SCRIPT = `# 试片

## 人物表(主要角色)

| 姓名 | 身份 | 一句话人设 |
|---|---|---|
| 甲 | 男主 | 现代灵魂+神仙容貌 |
| 乙 | 女主 | 心思深 |
| 丙 | 兄长 | 只被提到 |

# 第1集 开场(约90秒)

【场1·荒山·日】
甲与乙在山道相遇。
甲:"丙哪儿去了。"
乙:"不知道。"
`

const log = () => {
  const lines: string[] = []
  const sink = { info: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) }
  return { lines, log: { ...sink, debug: sink.info, error: sink.warn } }
}

const runImport = async (options: Record<string, unknown>, script = SCRIPT) => {
  const dir = await mkdtemp(join(tmpdir(), 'import-cast-'))
  const file = join(dir, 's.md')
  await writeFile(file, script, 'utf8')

  const sink = log()
  const stage = plugin.create({ file, episodes: [1], ...options }, {
    log: sink.log,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const project = {
    id: 'p1',
    title: 't',
    ratio: '9:16',
    kind: 'shortdrama',
    stageState: {},
    episodes: [],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
  } as unknown as Project

  const outcome = await stage.run({
    project,
    options: {},
    log: sink.log,
    emit: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  if (outcome.kind !== 'ok') throw new Error(`import failed: ${outcome.kind}`)
  return { project: outcome.project, lines: sink.lines }
}

describe('who gets a design image', () => {
  test('a name only spoken about never gets a portrait — 「丙哪儿去了」 says 丙 is absent', async () => {
    const { project } = await runImport({})

    expect(project.characters.map((c) => c.name)).toEqual(['甲', '乙'])
  })

  test('and is not attached to the shot where they are discussed', async () => {
    const { project } = await runImport({})
    const named = new Set(project.shots.flatMap((s) => s.characterIds ?? []))

    expect(named.size).toBeGreaterThan(0)
    expect([...named]).not.toContain('ch3')
  })

  test('a name in an action line does get one — that one is on camera', async () => {
    const { project } = await runImport({}, SCRIPT.replace('甲与乙在山道相遇。', '丙牵着甲走上山道。'))

    expect(project.characters.map((c) => c.name)).toContain('丙')
  })
})

describe('appearance', () => {
  test('without an override it falls back to the cast table — personality and all', async () => {
    const { project } = await runImport({})
    expect(project.characters[0]?.appearance).toContain('现代灵魂')
  })

  test('characterVisuals replaces it wholesale, so nothing characterising reaches the prompt', async () => {
    const visual = '15-year-old boy, hemp robe, topknot'
    const { project } = await runImport({ characterVisuals: { 甲: visual } })

    expect(project.characters[0]?.appearance).toBe(visual)
    expect(project.characters[0]?.appearance).not.toContain('现代灵魂')
  })
})

describe('epithet and billing', () => {
  test('the 身份 column is the default epithet', async () => {
    const { project } = await runImport({})
    expect(project.characters[0]?.epithet).toBe('男主')
  })

  test('an override wins — 「男主」 is a production label, not a card', async () => {
    const { project } = await runImport({ epithets: { 甲: '寒门少年' } })
    expect(project.characters[0]?.epithet).toBe('寒门少年')
  })

  test('billing is unset unless configured, so casting stays explicit', async () => {
    const plain = await runImport({})
    expect(plain.project.characters[0]?.billing).toBeUndefined()

    const cast = await runImport({ billing: { 甲: 'lead' } })
    expect(cast.project.characters[0]?.billing).toBe('lead')
  })
})

describe('hand-authored wardrobe', () => {
  test('looks are attached so the wardrobe stage need not ask an LLM', async () => {
    const { project } = await runImport({
      wardrobe: { 甲: [{ label: '常服', description: 'hemp robe', occasion: '日常' }] },
    })

    expect(project.characters[0]?.wardrobe).toEqual([
      { id: 'w1', label: '常服', description: 'hemp robe', occasion: '日常' },
    ])
  })

  test('a look missing its description is dropped rather than rendered blank', async () => {
    const { project } = await runImport({
      wardrobe: { 甲: [{ label: '常服' }, { label: '夜行', description: 'dark tunic' }] },
    })

    expect(project.characters[0]?.wardrobe?.map((w) => w.label)).toEqual(['夜行'])
  })

  test('wardrobe for someone not in the cast is ignored, not a crash', async () => {
    const { project } = await runImport({
      wardrobe: { 不存在: [{ label: 'x', description: 'y' }] },
    })
    expect(project.characters.every((c) => c.wardrobe === undefined)).toBe(true)
  })
})
