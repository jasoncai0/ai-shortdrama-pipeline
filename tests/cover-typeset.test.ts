import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import plugin, { defaultIntro } from '../src/plugins/stage/cover-typeset.js'
import type { AssetRef, Project } from '../src/kernel/types.js'

/**
 * The whole point of this stage is that the words are exact — so the test
 * runs the real typesetter (python3 + Pillow, both present wherever the
 * pipeline itself can run) against a synthetic plate and checks the output
 * exists at the plate's own size, once per episode plus the poster.
 */

const log = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} }

const makePlate = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'plate-'))
  const path = join(dir, 'plate.png')
  // A 90x120 PNG via Pillow keeps the test dependency-honest: if Pillow is
  // missing here, the stage could never have worked either.
  const { execFileSync } = await import('node:child_process')
  execFileSync('python3', [
    '-c',
    `from PIL import Image; Image.new("RGB",(90,120),(200,190,170)).save(${JSON.stringify(path)})`,
  ])
  return path
}

const makeStore = () => {
  const puts: { label: string; bytes: number }[] = []
  return {
    puts,
    store: {
      localPath: async (ref: AssetRef) => ref.uri.replace('file://', ''),
      put: async (bytes: Uint8Array, meta: { label?: string }) => {
        puts.push({ label: meta.label ?? '', bytes: bytes.length })
        return { id: meta.label ?? 'x', uri: `mem://${meta.label}`, mime: 'image/jpeg' } as AssetRef
      },
    },
  }
}

const runStage = async (options: Record<string, unknown>) => {
  const plate = await makePlate()
  const { puts, store } = makeStore()
  const stage = plugin.create({}, { log, cwd: process.cwd() } as never)

  const project = {
    id: 'p1',
    title: '寒门贵子',
    plan: { title: '寒门贵子', logline: '现代驴友魂穿东靖朝，从寒门一路逆袭——护嫂、扬名。' },
    cover: { id: 'c', uri: `file://${plate}`, mime: 'image/png' },
    episodes: [
      { id: 'ep1', index: 1, title: '一' },
      { id: 'ep2', index: 2, title: '二' },
    ],
    shots: [],
    characters: [],
    scenes: [],
    stageState: {},
  } as unknown as Project

  const outcome = await stage.run({
    project,
    options,
    ports: { assetStore: store },
    log,
    emit: () => {},
  } as never)

  if (outcome.kind !== 'ok') throw new Error(outcome.kind)
  return { project: outcome.project, puts }
}

describe('cover typesetting', () => {
  test('emits one poster and one cover per episode, all non-empty', async () => {
    const { project, puts } = await runStage({ label: '01' })

    expect(puts.map((p) => p.label)).toEqual(['poster', 'cover-ep1', 'cover-ep2'])
    for (const p of puts) expect(p.bytes).toBeGreaterThan(500)
    expect(project.posters).toHaveLength(3)
  })

  test('perEpisode:false gives the poster alone', async () => {
    const { puts } = await runStage({ perEpisode: false })
    expect(puts.map((p) => p.label)).toEqual(['poster'])
  })

  test('a missing plate is a clear state error, not a python traceback', async () => {
    const stage = plugin.create({}, { log, cwd: process.cwd() } as never)
    await expect(
      stage.run({
        project: { id: 'p', episodes: [], stageState: {} } as unknown as Project,
        options: {},
        ports: {},
        log,
        emit: () => {},
      } as never),
    ).rejects.toThrow(/cover plate/)
  })
})

describe('defaultIntro', () => {
  test('splits a logline into at most three poster lines', () => {
    const lines = defaultIntro('现代驴友魂穿门阀林立的东靖朝,以一身千年后的才学,从寒门一路逆袭——护嫂、扬名、重振门楣。')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    expect(lines.length).toBeLessThanOrEqual(3)
    for (const line of lines) expect(line).not.toMatch(/^[,，。]/)
  })

  test('no logline means no synopsis block, not a crash', () => {
    expect(defaultIntro(undefined)).toEqual([])
  })
})
