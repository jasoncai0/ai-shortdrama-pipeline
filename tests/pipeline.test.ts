import { describe, expect, test, vi } from 'vitest'
import { assertCaps, runPipeline } from '../src/kernel/pipeline.js'
import { idempotencyKey, stableStringify } from '../src/kernel/idem.js'
import { createLogger } from '../src/kernel/logger.js'
import { parseJsonStdout } from '../src/lib/proc.js'
import type { NormalizedStage } from '../src/kernel/config.js'
import type { Ports, StagePort, StatePort } from '../src/kernel/ports.js'
import type { Project } from '../src/kernel/types.js'

const log = createLogger('silent')

const baseProject: Project = {
  id: 'p1',
  title: 't',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'i',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  episodes: [],
  characters: [],
  scenes: [],
  props: [],
  shots: [],
  stageState: {},
  adapterState: {},
}

const memoryState = (): StatePort & { saved: Project[] } => {
  const saved: Project[] = []
  return {
    name: 'memory',
    saved,
    load: async () => saved.at(-1) ?? null,
    save: async (p) => {
      saved.push(p)
    },
    list: async () => ['p1'],
  }
}

const portsWith = (state: StatePort): Ports =>
  ({ state } as unknown as Ports)

const stage = (
  id: string,
  needs: readonly string[],
  run: StagePort['run'],
): StagePort => ({ name: id, id, needs, run })

const stages = (...ids: string[]): NormalizedStage[] =>
  ids.map((id) => ({ id, use: id, options: {} }))

describe('runPipeline', () => {
  test('runs stages in order and persists after each', async () => {
    const order: string[] = []
    const state = memoryState()
    const plugins = new Map<string, StagePort>([
      ['a', stage('a', [], async (ctx) => {
        order.push('a')
        return { kind: 'ok', project: ctx.project }
      })],
      ['b', stage('b', ['a'], async (ctx) => {
        order.push('b')
        return { kind: 'ok', project: ctx.project }
      })],
    ])

    const result = await runPipeline(baseProject, {
      stages: stages('a', 'b'),
      plugins,
      ports: portsWith(state),
      log,
      concurrency: {},
      autoApprove: true,
    })

    expect(result.kind).toBe('complete')
    expect(order).toEqual(['a', 'b'])
    // running + done for each stage
    expect(state.saved.length).toBe(4)
  })

  test('skips stages already marked done — this is what makes resume free', async () => {
    const run = vi.fn(async (ctx: Parameters<StagePort['run']>[0]) => ({
      kind: 'ok' as const,
      project: ctx.project,
    }))
    const plugins = new Map<string, StagePort>([['a', stage('a', [], run)]])

    const done: Project = {
      ...baseProject,
      stageState: { a: { status: 'done' } },
    }

    await runPipeline(done, {
      stages: stages('a'),
      plugins,
      ports: portsWith(memoryState()),
      log,
      concurrency: {},
      autoApprove: true,
    })

    expect(run).not.toHaveBeenCalled()
  })

  test('force re-runs a completed stage', async () => {
    const run = vi.fn(async (ctx: Parameters<StagePort['run']>[0]) => ({
      kind: 'ok' as const,
      project: ctx.project,
    }))
    const plugins = new Map<string, StagePort>([['a', stage('a', [], run)]])

    await runPipeline(
      { ...baseProject, stageState: { a: { status: 'done' } } },
      {
        stages: stages('a'),
        plugins,
        ports: portsWith(memoryState()),
        log,
        concurrency: {},
        autoApprove: true,
        force: ['a'],
      },
    )

    expect(run).toHaveBeenCalledOnce()
  })

  test('halts at a gate and reports the question', async () => {
    const after = vi.fn()
    const plugins = new Map<string, StagePort>([
      ['g', stage('g', [], async (ctx) => ({
        kind: 'awaiting-input',
        project: ctx.project,
        question: 'ok?',
      }))],
      ['after', stage('after', [], async (ctx) => {
        after()
        return { kind: 'ok', project: ctx.project }
      })],
    ])

    const result = await runPipeline(baseProject, {
      stages: stages('g', 'after'),
      plugins,
      ports: portsWith(memoryState()),
      log,
      concurrency: {},
      autoApprove: false,
    })

    expect(result.kind).toBe('awaiting-input')
    if (result.kind === 'awaiting-input') expect(result.question).toBe('ok?')
    expect(after).not.toHaveBeenCalled()
  })

  test('a thrown stage fails the run and records the error in state', async () => {
    const state = memoryState()
    const plugins = new Map<string, StagePort>([
      ['boom', stage('boom', [], async () => {
        throw new Error('kaboom')
      })],
    ])

    const result = await runPipeline(baseProject, {
      stages: stages('boom'),
      plugins,
      ports: portsWith(state),
      log,
      concurrency: {},
      autoApprove: true,
    })

    expect(result.kind).toBe('failed')
    expect(state.saved.at(-1)?.stageState['boom']?.status).toBe('failed')
    expect(state.saved.at(-1)?.stageState['boom']?.error).toContain('kaboom')
  })

  test('refuses to run a stage whose dependency is unmet', async () => {
    const plugins = new Map<string, StagePort>([
      ['b', stage('b', ['a'], async (ctx) => ({ kind: 'ok', project: ctx.project }))],
    ])

    const result = await runPipeline(baseProject, {
      stages: stages('b'),
      plugins,
      ports: portsWith(memoryState()),
      log,
      concurrency: {},
      autoApprove: true,
    })

    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') expect(result.error).toContain('needs [a]')
  })
})

describe('assertCaps', () => {
  const caps = (overrides: Partial<Ports>): Ports =>
    ({
      image: { name: 'i', caps: { refImages: 2, ratios: ['9:16'], maxConcurrency: 2 } },
      video: {
        name: 'v',
        caps: {
          modes: ['singleImage2video'],
          maxSeconds: 15,
          minSeconds: 4,
          ratios: ['9:16'],
          audio: true,
          maxConcurrency: 2,
        },
      },
      ...overrides,
    }) as unknown as Ports

  test('passes when adapters cover the pipeline', () => {
    expect(() => assertCaps(stages('images', 'videos'), caps({}), '9:16')).not.toThrow()
  })

  test('rejects an unsupported ratio before anything is spent', () => {
    expect(() => assertCaps(stages('images'), caps({}), '16:9')).toThrow(/does not support ratio/)
  })

  test('rejects a text-only video adapter when the pipeline generates stills', () => {
    const textOnly = caps({
      video: {
        name: 'v',
        caps: {
          modes: ['text2video'],
          maxSeconds: 15,
          minSeconds: 4,
          ratios: ['9:16'],
          audio: false,
          maxConcurrency: 1,
        },
        generate: async () => [],
      },
    })
    expect(() => assertCaps(stages('images', 'videos'), textOnly, '9:16')).toThrow(
      /singleImage2video/,
    )
  })
})

describe('idempotencyKey', () => {
  test('is stable regardless of object key order', () => {
    expect(idempotencyKey('s', 'shot1', { a: 1, b: 2 })).toBe(
      idempotencyKey('s', 'shot1', { b: 2, a: 1 }),
    )
  })

  test('changes when the prompt changes — a retuned shot is billed anew', () => {
    expect(idempotencyKey('s', 'shot1', { prompt: 'a' })).not.toBe(
      idempotencyKey('s', 'shot1', { prompt: 'b' }),
    )
  })

  test('ignores undefined values so optional params do not split the key', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }))
  })
})

describe('parseJsonStdout', () => {
  test('takes the terminal value when libtv emits two pretty-printed documents', () => {
    const stdout = [
      '{\n  "nodeKey": "n1",\n  "data": { "url": [] }\n}',
      '{\n  "nodeKey": "n1",\n  "status": 2,\n  "data": { "url": ["https://x/y.png"] }\n}',
    ].join('\n')

    const node = parseJsonStdout<{ status: number; data: { url: string[] } }>(stdout, 'test')
    expect(node.status).toBe(2)
    expect(node.data.url[0]).toBe('https://x/y.png')
  })

  test('is not confused by braces inside string values', () => {
    const stdout = '{"prompt":"a {curly} prompt \\" with quote","status":2}'
    expect(parseJsonStdout<{ status: number }>(stdout, 'test').status).toBe(2)
  })

  test('reports a helpful error instead of throwing SyntaxError on junk', () => {
    expect(() => parseJsonStdout('not json at all', 'ctx')).toThrow(/no JSON value found/)
  })
})
