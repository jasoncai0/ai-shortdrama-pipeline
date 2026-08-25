import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createLogger } from '../src/kernel/logger.js'
import importStage from '../src/plugins/stage/import.js'
import type { StageContext, StagePort } from '../src/kernel/ports.js'
import type { Project } from '../src/kernel/types.js'

/**
 * The screenplay-import path: a writer's finished script goes in, nothing is
 * invented, and entity references resolve to ids exactly as the LLM path does.
 */

const log = createLogger('silent')
let work = ''

const SCREENPLAY = {
  title: '白身',
  genre: '古装',
  logline: 'l',
  mainPlot: 'm',
  styleGuide: 'ink-wash, 35mm',
  characters: [
    { name: '江砚', appearance: 'boy in hemp robe' },
    { name: '卫昭宁', appearance: 'noblewoman in celadon silk' },
  ],
  scenes: [{ name: '书楼', visualDescription: 'candlelit scriptorium' }],
  props: [{ name: '残谱', description: 'silk music scroll' }],
  episodes: [
    {
      title: '一字',
      synopsis: 's1',
      shots: [
        {
          plotDescription: 'boy lifts his head',
          characters: ['江砚'],
          scene: '书楼',
          props: ['残谱'],
          durationSeconds: 6,
        },
        { plotDescription: 'she stops mid-step', characters: ['卫昭宁'], scene: '书楼' },
      ],
    },
    {
      title: '双手',
      synopsis: 's2',
      shots: [{ plotDescription: 'two brushes at once', characters: ['江砚'] }],
    },
  ],
}

const project = (): Project => ({
  id: 'p1',
  title: 'Untitled',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'x',
  createdAt: 'x',
  updatedAt: 'x',
  episodes: [],
  characters: [],
  scenes: [],
  props: [],
  shots: [],
  stageState: {},
  adapterState: {},
})

const runImport = async (
  file: string,
  options: Record<string, unknown> = {},
): Promise<Project> => {
  const stage = importStage.create({}, { log, cwd: work, load: async () => ({}) }) as StagePort
  const ctx = {
    project: project(),
    log,
    options: { file, ...options },
    concurrency: {},
    autoApprove: true,
    emit: () => {},
  } as unknown as StageContext

  const outcome = await stage.run(ctx)
  if (outcome.kind !== 'ok') throw new Error('expected ok')
  return outcome.project
}

const writeScreenplay = async (name: string, body: unknown): Promise<string> => {
  const file = join(work, name)
  await writeFile(file, JSON.stringify(body), 'utf8')
  return file
}

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), 'duanju-import-'))
})
afterAll(async () => {
  if (work) await rm(work, { recursive: true, force: true })
})

describe('import stage', () => {
  test('ingests the whole screenplay verbatim', async () => {
    const result = await runImport(await writeScreenplay('a.json', SCREENPLAY))

    expect(result.title).toBe('白身')
    expect(result.plan?.styleGuide).toBe('ink-wash, 35mm')
    expect(result.episodes).toHaveLength(2)
    expect(result.shots).toHaveLength(3)
    expect(result.characters.map((c) => c.name)).toEqual(['江砚', '卫昭宁'])
  })

  test('resolves entity names to ids so consistency anchors survive', async () => {
    const result = await runImport(await writeScreenplay('b.json', SCREENPLAY))
    const first = result.shots[0]

    expect(first?.characterIds).toEqual(['ch1'])
    expect(first?.sceneId).toBe('sc1')
    expect(first?.propIds).toEqual(['pr1'])
    // A shot with no scene stays undefined rather than pointing at a wrong one.
    expect(result.shots[2]?.sceneId).toBeUndefined()
  })

  test('keeps per-shot duration and falls back for the rest', async () => {
    const result = await runImport(await writeScreenplay('c.json', SCREENPLAY), { shotSeconds: 4 })

    expect(result.shots[0]?.durationSeconds).toBe(6)
    expect(result.shots[1]?.durationSeconds).toBe(4)
  })

  test('numbers shots per episode, not globally', async () => {
    const result = await runImport(await writeScreenplay('d.json', SCREENPLAY))

    expect(result.shots.map((s) => s.id)).toEqual(['ep1-s01', 'ep1-s02', 'ep2-s01'])
    expect(result.shots[2]?.order).toBe(1)
  })

  test('imports every episode when no cap is given — no silent truncation', async () => {
    const result = await runImport(await writeScreenplay('e.json', SCREENPLAY))
    expect(result.episodes).toHaveLength(2)
  })

  test('an explicit episode cap truncates deliberately', async () => {
    const result = await runImport(await writeScreenplay('f.json', SCREENPLAY), { episodes: 1 })

    expect(result.episodes).toHaveLength(1)
    expect(result.shots).toHaveLength(2)
  })

  test('drops unknown entity names instead of inventing ids', async () => {
    const broken = {
      ...SCREENPLAY,
      episodes: [
        {
          title: 'x',
          synopsis: 'x',
          shots: [{ plotDescription: 'p', characters: ['查无此人'], scene: '不存在的场景' }],
        },
      ],
    }
    const result = await runImport(await writeScreenplay('g.json', broken))

    expect(result.shots[0]?.characterIds).toEqual([])
    expect(result.shots[0]?.sceneId).toBeUndefined()
  })

  test('rejects a malformed screenplay with the failing field named', async () => {
    const bad = { ...SCREENPLAY, characters: [{ name: '江砚' }] }
    await expect(runImport(await writeScreenplay('h.json', bad))).rejects.toThrow(/appearance/)
  })

  test('reports a missing file rather than throwing a raw fs error', async () => {
    await expect(runImport(join(work, 'nope.json'))).rejects.toThrow(/Cannot read screenplay/)
  })

  test('stands in for plan, assets and shots', () => {
    const stage = importStage.create({}, { log, cwd: work, load: async () => ({}) }) as StagePort
    expect(stage.provides).toEqual(['plan', 'assets', 'shots'])
  })
})
