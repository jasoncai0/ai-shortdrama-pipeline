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
