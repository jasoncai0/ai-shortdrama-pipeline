import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  createProgressReporter,
  createWatchdog,
  isPidAlive,
  readProgress,
} from '../src/kernel/health.js'
import { createLogger } from '../src/kernel/logger.js'

const log = createLogger('silent')

describe('progress reporter', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'duanju-health-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('writes a readable snapshot through a stage lifecycle', async () => {
    // Arrange
    const reporter = createProgressReporter({ root, projectId: 'p1', log })

    // Act
    reporter.stageStart('images')
    reporter.tick('images', { item: 3, total: 8, note: 'ep1-s03' })
    reporter.stageDone('images')
    await reporter.close()

    // Assert
    const snap = await readProgress(root, 'p1')
    expect(snap).not.toBeNull()
    expect(snap?.stage).toBe('images')
    expect(snap?.status).toBe('done')
    expect(snap?.item).toBe(3)
    expect(snap?.total).toBe(8)
    expect(snap?.pid).toBe(process.pid)
  })

  test('marks a stalled stage as stalled, a plain failure as failed', async () => {
    // Arrange
    const reporter = createProgressReporter({ root, projectId: 'p2', log })

    // Act
    reporter.stageStart('videos')
    reporter.stageFailed('videos', 'no progress for 900s', true)
    await reporter.close()

    // Assert
    const snap = await readProgress(root, 'p2')
    expect(snap?.status).toBe('stalled')
    expect(snap?.error).toContain('no progress')
  })

  test('returns null when no run has recorded progress', async () => {
    expect(await readProgress(root, 'nope')).toBeNull()
  })
})

describe('watchdog', () => {
  test('fails a silent stage with E_TIMEOUT after the stall window', async () => {
    // Arrange
    const dog = createWatchdog(60)
    const never = new Promise<string>(() => {})

    // Act / Assert
    await expect(dog.guard('stage videos', never)).rejects.toMatchObject({
      code: 'E_TIMEOUT',
    })
  })

  test('a heartbeat keeps a slow stage alive past the stall window', async () => {
    // Arrange
    const dog = createWatchdog(80)
    const beats = setInterval(() => dog.beat(), 20)
    const slow = new Promise<string>((resolveSlow) => setTimeout(() => resolveSlow('done'), 200))

    // Act
    const result = await dog.guard('stage images', slow).finally(() => clearInterval(beats))

    // Assert
    expect(result).toBe('done')
  })

  test('a fast stage passes its value straight through', async () => {
    const dog = createWatchdog(1000)
    expect(await dog.guard('stage plan', Promise.resolve(42))).toBe(42)
  })

  test('the guarded promise rejection wins over the stall timer', async () => {
    const dog = createWatchdog(1000)
    await expect(dog.guard('stage plan', Promise.reject(new Error('boom')))).rejects.toThrow('boom')
  })
})

describe('pid probe', () => {
  test('sees the current process as alive and a bogus pid as dead', () => {
    expect(isPidAlive(process.pid)).toBe(true)
    expect(isPidAlive(2 ** 30)).toBe(false)
  })
})

describe('pipeline stall integration', () => {
  test('a hung stage fails with E_TIMEOUT instead of blocking the run', async () => {
    // Arrange — a stage that never resolves and never emits
    const { runPipeline } = await import('../src/kernel/pipeline.js')
    const saved: unknown[] = []
    const ports = {
      state: { name: 'memory', load: async () => null, save: async (p: unknown) => { saved.push(p) }, list: async () => [] },
    } as never
    const project = {
      id: 'p9', title: 't', kind: 'shortdrama', ratio: '9:16', idea: 'i',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [], characters: [], scenes: [], props: [], shots: [],
      stageState: {}, adapterState: {},
    } as never
    const plugins = new Map([
      ['hang', { name: 'hang', id: 'hang', needs: [], run: () => new Promise(() => {}) }],
    ]) as never

    // Act
    const result = await runPipeline(project, {
      stages: [{ id: 'hang', use: 'hang', options: {} }],
      plugins,
      ports,
      log,
      concurrency: {},
      autoApprove: true,
      health: { stallTimeoutMs: 60 },
    })

    // Assert — pipeline got control back and marked the stage failed
    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') expect(result.error).toContain('stalled')
  })

  test('a stage that keeps emitting progress survives a tight stall window', async () => {
    const { runPipeline } = await import('../src/kernel/pipeline.js')
    const ports = {
      state: { name: 'memory', load: async () => null, save: async () => {}, list: async () => [] },
    } as never
    const project = {
      id: 'p10', title: 't', kind: 'shortdrama', ratio: '9:16', idea: 'i',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [], characters: [], scenes: [], props: [], shots: [],
      stageState: {}, adapterState: {},
    } as never
    const plugins = new Map([
      ['slow', {
        name: 'slow', id: 'slow', needs: [],
        run: async (ctx: { project: unknown; emit: (e: string, p?: unknown) => void }) => {
          for (let i = 1; i <= 5; i += 1) {
            await new Promise((r) => setTimeout(r, 30))
            ctx.emit('progress', { item: i, total: 5 })
          }
          return { kind: 'ok', project: ctx.project }
        },
      }],
    ]) as never

    const result = await runPipeline(project, {
      stages: [{ id: 'slow', use: 'slow', options: {} }],
      plugins,
      ports,
      log,
      concurrency: {},
      autoApprove: true,
      health: { stallTimeoutMs: 80 },
    })

    expect(result.kind).toBe('complete')
  })
})
