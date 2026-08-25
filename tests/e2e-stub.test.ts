import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { configSchema } from '../src/kernel/config.js'
import { createLogger } from '../src/kernel/logger.js'
import { runPipeline } from '../src/kernel/pipeline.js'
import type { Project } from '../src/kernel/types.js'

/**
 * Whole-pipeline run on stub adapters: no network, no credits, real files.
 * This is the test that would catch an orchestration regression — everything
 * else only checks a piece in isolation.
 */

const log = createLogger('silent')
let workDir = ''

const config = configSchema.parse({
  ports: {
    llm: { impl: 'stub', options: { seed: 'test' } },
    image: { impl: 'stub' },
    video: { impl: 'stub' },
    assetStore: { impl: 'localfs', options: { root: './assets' } },
    state: { impl: 'localjson', options: { root: './state' } },
    ledger: { impl: 'localledger', options: { root: './ledger' } },
    export: { impl: 'ffmpeg' },
    promptStrategy: { impl: 'template', options: { dir: './prompts' } },
  },
  middleware: [{ impl: 'tuning-log', options: { file: './tuning.ndjson' } }],
  pipeline: ['plan', 'assets', 'refs', 'shots', 'prompts', 'images', 'videos', 'export'],
  concurrency: { images: 4, videos: 4, refs: 4 },
  budget: { maxCredits: 0, failFast: false },
  defaults: { ratio: '9:16', kind: 'shortdrama', shotSeconds: 2, shotsPerEpisode: 2 },
})

const newProject = (): Project => ({
  id: 'ptest',
  title: 'Untitled',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'a courier witnesses a murder',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  episodes: [],
  characters: [],
  scenes: [],
  props: [],
  shots: [],
  stageState: {},
  adapterState: {},
})

const runAll = async (project: Project) => {
  const app = await buildApp(config, log, workDir)
  return runPipeline(project, {
    stages: app.stages.map((s) => ({
      ...s,
      options: { episodes: 1, shotsPerEpisode: 2, shotSeconds: 2, ...s.options },
    })),
    plugins: app.stagePlugins,
    ports: app.ports,
    log,
    concurrency: config.concurrency,
    autoApprove: true,
    onProject: (p) => app.setProject(p),
  })
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'duanju-e2e-'))
})

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true })
})

describe('end-to-end on stubs', () => {
  test('produces a playable final cut and marks every stage done', async () => {
    const result = await runAll(newProject())

    expect(result.kind).toBe('complete')
    if (result.kind !== 'complete') return

    const { project } = result
    expect(project.plan).toBeDefined()
    expect(project.characters.length).toBeGreaterThan(0)
    expect(project.shots.length).toBeGreaterThan(0)
    expect(project.shots.every((s) => s.still)).toBe(true)
    expect(project.shots.every((s) => s.clip)).toBe(true)
    expect(project.finalCut).toBeDefined()

    for (const id of ['plan', 'assets', 'refs', 'shots', 'prompts', 'images', 'videos', 'export']) {
      expect(project.stageState[id]?.status).toBe('done')
    }

    // The mp4 must actually exist on disk with real bytes.
    const path = fileURLToPath(project.finalCut?.uri ?? '')
    const bytes = await readFile(path)
    expect(bytes.byteLength).toBeGreaterThan(1000)
  }, 120_000)

  test('every shot prompt is compiled from its referenced entities', async () => {
    const result = await runAll({ ...newProject(), id: 'ptest2' })
    expect(result.kind).toBe('complete')
    if (result.kind !== 'complete') return

    for (const shot of result.project.shots) {
      expect(shot.imagePrompt).toBeTruthy()
      expect(shot.videoPrompt).toBeTruthy()
      expect(shot.imagePrompt).not.toContain('{{')
      expect(shot.imagePrompt).not.toContain(', ,')
    }
  }, 120_000)

  test('re-running is free: the ledger records no new charges', async () => {
    const first = await runAll({ ...newProject(), id: 'ptest3' })
    expect(first.kind).toBe('complete')
    if (first.kind !== 'complete') return

    const ledgerPath = join(workDir, 'ledger', 'ledger.ndjson')
    const before = (await readFile(ledgerPath, 'utf8')).split('\n').length

    // Force every generating stage to run again.
    const replayed: Project = {
      ...first.project,
      stageState: Object.fromEntries(
        Object.entries(first.project.stageState).map(([k]) => [k, { status: 'pending' as const }]),
      ),
    }
    const app = await buildApp(config, log, workDir)
    await runPipeline(replayed, {
      stages: app.stages,
      plugins: app.stagePlugins,
      ports: app.ports,
      log,
      concurrency: config.concurrency,
      autoApprove: true,
      onProject: (p) => app.setProject(p),
    })

    const after = (await readFile(ledgerPath, 'utf8')).split('\n').length
    expect(after).toBe(before)
  }, 180_000)

  test('runs end to end with the noop ledger (the shipped default)', async () => {
    const noopConfig = configSchema.parse({
      ...config,
      ports: { ...config.ports, ledger: { impl: 'noop', options: {} } },
    })
    const app = await buildApp(noopConfig, log, workDir)
    const result = await runPipeline(
      { ...newProject(), id: 'ptest-noop' },
      {
        stages: app.stages,
        plugins: app.stagePlugins,
        ports: app.ports,
        log,
        concurrency: noopConfig.concurrency,
        autoApprove: true,
        onProject: (p) => app.setProject(p),
      },
    )

    expect(result.kind).toBe('complete')
    if (result.kind !== 'complete') return
    expect(result.project.finalCut).toBeDefined()
    expect(result.project.shots.every((s) => s.clip)).toBe(true)
  }, 120_000)

  test('prompt template files on disk override the built-in defaults', async () => {
    const promptsDir = join(workDir, 'prompts')
    await writeFile(join(promptsDir, 'image.tmpl'), 'MARKER, {{plotDescription}}', 'utf8').catch(
      async () => {
        const { mkdir } = await import('node:fs/promises')
        await mkdir(promptsDir, { recursive: true })
        await writeFile(join(promptsDir, 'image.tmpl'), 'MARKER, {{plotDescription}}', 'utf8')
      },
    )

    const result = await runAll({ ...newProject(), id: 'ptest4' })
    expect(result.kind).toBe('complete')
    if (result.kind !== 'complete') return

    expect(result.project.shots[0]?.imagePrompt).toContain('MARKER')
  }, 120_000)
})
