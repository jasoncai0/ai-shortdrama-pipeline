import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadConfig, normalizeStages } from '../src/kernel/config.js'
import type { Config } from '../src/kernel/config.js'

/**
 * Two ways a config was wrong without saying so, both hit while setting up a
 * real paid run. Silence is the defect here: the pipeline ran, money was spent,
 * and the result was not what the config described.
 */

const write = async (config: unknown) => {
  const dir = await mkdtemp(join(tmpdir(), 'duanju-cfg-'))
  const path = join(dir, 'c.json')
  await writeFile(path, JSON.stringify(config), 'utf8')
  return path
}

const PORTS = {
  llm: { impl: 'stub' },
  image: { impl: 'stub' },
  video: { impl: 'stub' },
  assetStore: { impl: 'localfs' },
  state: { impl: 'localjson' },
  ledger: { impl: 'noop' },
  export: { impl: 'ffmpeg' },
  promptStrategy: { impl: 'template' },
}

describe('duplicate stage ids', () => {
  const withPipeline = (pipeline: unknown) =>
    ({ pipeline, middleware: [] }) as unknown as Config

  test('two gates sharing one id are rejected — state is keyed by id', () => {
    expect(() =>
      normalizeStages(
        withPipeline([
          { id: 'gate', options: { label: 'story' } },
          { id: 'gate', options: { label: 'picture' } },
        ]),
      ),
    ).toThrow(/Duplicate pipeline stage id/)
  })

  test('the same plugin twice under distinct ids is fine — that is what `use` is for', () => {
    const stages = normalizeStages(
      withPipeline([
        { id: 'gate-story', use: 'gate', options: {} },
        { id: 'gate-picture', use: 'gate', options: {} },
      ]),
    )

    expect(stages.map((s) => s.use)).toEqual(['gate', 'gate'])
    expect(stages.map((s) => s.id)).toEqual(['gate-story', 'gate-picture'])
  })

  test('a bare string entry collides with an explicit entry of the same name', () => {
    expect(() => normalizeStages(withPipeline(['refs', { id: 'refs', options: {} }]))).toThrow(
      /Duplicate/,
    )
  })
})

describe('middleware entries', () => {
  test('the "id" spelling is rejected with the field it actually wants', async () => {
    const path = await write({
      ports: PORTS,
      pipeline: ['plan'],
      middleware: [{ id: 'retry', options: {} }],
    })

    // The hint is a separate field, because that is where an actionable fix
    // belongs — the message names the path, the hint names the field.
    await expect(loadConfig(path)).rejects.toMatchObject({
      code: 'E_CONFIG',
      hint: expect.stringContaining('"impl"'),
    })
  })

  test('the "impl" spelling loads', async () => {
    const path = await write({
      ports: PORTS,
      pipeline: ['plan'],
      middleware: [{ impl: 'retry', options: {} }],
    })

    await expect(loadConfig(path)).resolves.toMatchObject({
      middleware: [{ impl: 'retry' }],
    })
  })
})

describe('aspect ratio is never guessed', () => {
  test('a config with no defaults.ratio loads with it unset, not filled in', async () => {
    const path = await write({ ports: PORTS, pipeline: ['plan'] })
    const config = await loadConfig(path)

    // 9:16 and 16:9 compose every shot differently, so a silent default means
    // reshooting the whole production when the guess is wrong.
    expect(config.defaults.ratio).toBeUndefined()
  })

  test('an explicit ratio is kept', async () => {
    const path = await write({ ports: PORTS, pipeline: ['plan'], defaults: { ratio: '16:9' } })
    await expect(loadConfig(path)).resolves.toMatchObject({ defaults: { ratio: '16:9' } })
  })

  test('the scaffolded config does not decide framing for the user', async () => {
    const { DEFAULT_CONFIG } = await import('../src/default-config.js')
    expect(DEFAULT_CONFIG.defaults).not.toHaveProperty('ratio')
  })
})

describe('SRT markup never reaches the picture', () => {
  test('an <i> cue is stripped and flagged as narration', async () => {
    const { parseSrt } = await import('../src/plugins/post/ffmpeg.js')
    const cues = parseSrt('1\n00:00:00,000 --> 00:00:02,000\n<i>三个月前。</i>\n')

    expect(cues[0]?.text).toBe('三个月前。')
    expect(cues[0]?.italic).toBe(true)
  })

  test('a plain dialogue cue is untouched', async () => {
    const { parseSrt } = await import('../src/plugins/post/ffmpeg.js')
    const cues = parseSrt('1\n00:00:00,000 --> 00:00:02,000\n陈母李氏：跪下。\n')

    expect(cues[0]?.text).toBe('陈母李氏：跪下。')
    expect(cues[0]?.italic).toBe(false)
  })
})
