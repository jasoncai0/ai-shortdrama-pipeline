import { describe, expect, test, vi } from 'vitest'
import { createLogger } from '../src/kernel/logger.js'
import {
  findVagueTerms,
  judgeCamera,
  loadCameraGrammar,
  matchMoves,
  setupKey,
} from '../src/lib/camera.js'
import cameraGrammarMw from '../src/plugins/middleware/camera-grammar.js'
import cameraCheck from '../src/plugins/stage/camera-check.js'
import type { GenerateMiddleware, StagePort } from '../src/kernel/ports.js'
import type { PluginDeps } from '../src/kernel/registry.js'
import type { CameraGrammar } from '../src/lib/camera.js'
import type { Project, Shot } from '../src/kernel/types.js'

const log = createLogger('silent')
const repo = new URL('..', import.meta.url).pathname
const deps = (): PluginDeps => ({
  log,
  cwd: repo,
  load: async () => {
    throw new Error('not used')
  },
})

const grammar = async (): Promise<CameraGrammar> =>
  loadCameraGrammar(repo, './prompts/camera/grammar.json')

const shot = (over: Partial<Shot> = {}): Shot => ({
  id: 'ep1-s01',
  episodeId: 'ep1',
  order: 1,
  durationSeconds: 4,
  plotDescription: 'courier freezes',
  characterIds: [],
  propIds: [],
  status: 'prompted',
  ...over,
})

const project = (shots: readonly Shot[]): Project => ({
  id: 'p1',
  title: 't',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'i',
  createdAt: 'x',
  updatedAt: 'x',
  episodes: [{ id: 'ep1', index: 1, title: 'e', synopsis: 's' }],
  characters: [],
  scenes: [],
  props: [],
  shots,
  stageState: {},
  adapterState: {},
})

describe('camera vocabulary', () => {
  test('resolves a canonical id, an English alias, and a Chinese alias to one move', async () => {
    const g = await grammar()
    for (const text of ['dolly-in', 'slow push in', '推近']) {
      expect(matchMoves(text, g).map((m) => m.id)).toEqual(['dolly-in'])
    }
  })

  test('prefers the more specific alias when two overlap', async () => {
    const g = await grammar()
    // "tracking shot" contains "track", an alias of truck-left/right.
    expect(matchMoves('tracking shot', g).map((m) => m.id)).toEqual(['steadicam-follow'])
  })

  test('a pan and a dolly in one line are both reported', async () => {
    const g = await grammar()
    expect(matchMoves('pan left then dolly-in', g).map((m) => m.id).sort()).toEqual([
      'dolly-in',
      'pan-left',
    ])
  })

  test('flags style words whose implied speed is not reproducible', async () => {
    const g = await grammar()
    expect(findVagueTerms('smooth cinematic dolly-in', g).sort()).toEqual([
      'cinematic',
      'smooth',
    ])
  })
})

describe('judgeCamera', () => {
  test('a single clean move yields physical phrasing and no complaints', async () => {
    const verdict = judgeCamera('slow dolly-in', await grammar())
    expect(verdict.problems).toEqual([])
    expect(verdict.phrase).toContain('travels forward at a constant')
    expect(verdict.phrase).not.toContain('slow dolly-in')
  })

  test('reports two moves as a single-dominant-movement violation', async () => {
    const verdict = judgeCamera('pan left then orbit', await grammar())
    expect(verdict.problems.join(' ')).toMatch(/2 camera moves/)
  })

  test('an unknown move is reported rather than silently passed through', async () => {
    const verdict = judgeCamera('vibe cam', await grammar())
    expect(verdict.phrase).toBeUndefined()
    expect(verdict.problems.join(' ')).toMatch(/unrecognised/)
  })

  test('an empty camera field is not an error — it is simply absent', async () => {
    expect(judgeCamera(undefined, await grammar()).problems).toEqual([])
  })
})

describe('camera-grammar middleware', () => {
  const run = async (
    cameraMove: string | undefined,
    prompt: string,
    options: Record<string, unknown> = {},
  ) => {
    const mw = (await cameraGrammarMw.create(options, deps())) as GenerateMiddleware
    const next = vi.fn(async () => [])
    await mw.video?.(
      { mode: 'text2video', prompt, idempotencyKey: 'k' },
      { project: project([]), shot: cameraMove ? shot({ cameraMove }) : undefined, log },
      next,
    )
    return (next.mock.calls[0]?.[0] as unknown as { prompt: string } | undefined)?.prompt ?? ''
  }

  test('replaces the shorthand in place, keeping the rest of the prompt', async () => {
    const out = await run('slow dolly-in', 'courier freezes, slow dolly-in, neon rimlight')
    expect(out).toContain('courier freezes')
    expect(out).toContain('neon rimlight')
    expect(out).toContain('travels forward at a constant')
    expect(out).not.toContain('slow dolly-in')
  })

  test('appends the phrasing when the shorthand is not literally in the prompt', async () => {
    const out = await run('orbit', 'courier freezes')
    expect(out).toContain('courier freezes')
    expect(out).toContain('arcs around the subject')
  })

  test('appends the one-dominant-movement clause by default', async () => {
    const out = await run('orbit', 'x')
    expect(out).toContain('one dominant camera movement')
  })

  test('appends only the clauses asked for', async () => {
    const out = await run('orbit', 'x', { appendClauses: ['noEaseOut'] })
    expect(out).toContain('ends during uninterrupted motion')
    expect(out).not.toContain('one dominant camera movement')
  })

  test('leaves a deliberate unrecognised description untouched', async () => {
    const out = await run('a very specific bespoke move', 'x')
    expect(out).toBe('x')
  })

  test('strict mode refuses to spend on an unrecognised move', async () => {
    const mw = (await cameraGrammarMw.create({ strict: true }, deps())) as GenerateMiddleware
    await expect(
      mw.video?.(
        { mode: 'text2video', prompt: 'x', idempotencyKey: 'k' },
        { project: project([]), shot: shot({ cameraMove: 'vibe cam' }), log },
        async () => [],
      ),
    ).rejects.toThrow(/unrecognised/)
  })
})

describe('camera-check stage', () => {
  const run = async (shots: readonly Shot[], options: Record<string, unknown> = {}) => {
    const stage = cameraCheck.create({}, deps()) as StagePort
    const emitted: unknown[] = []
    const outcome = await stage.run({
      project: project(shots),
      ports: {} as never,
      log,
      options,
      concurrency: {},
      autoApprove: true,
      emit: (_e, payload) => emitted.push(payload),
    })
    expect(outcome.kind).toBe('ok')
    return (emitted[0] as { findings: string[] }).findings
  }

  test('passes a varied, well-described shot list', async () => {
    const findings = await run([
      shot({ id: 'a', order: 1, shotSize: 'wide shot', cameraMove: 'static' }),
      shot({ id: 'b', order: 2, shotSize: 'medium shot', cameraMove: 'dolly-in' }),
      shot({ id: 'c', order: 3, shotSize: 'close-up', cameraMove: 'handheld follow' }),
    ])
    expect(findings).toEqual([])
  })

  test('catches a run of identical setups that would cut like a slideshow', async () => {
    const findings = await run([
      shot({ id: 'a', order: 1, shotSize: 'medium shot', cameraMove: 'static' }),
      shot({ id: 'b', order: 2, shotSize: 'medium shot', cameraMove: 'static' }),
      shot({ id: 'c', order: 3, shotSize: 'medium shot', cameraMove: 'static' }),
    ])
    expect(findings.join(' ')).toMatch(/consecutive shots share one setup/)
  })

  test('does not count a repeat across an episode boundary', async () => {
    const findings = await run([
      shot({ id: 'a', episodeId: 'ep1', order: 1, shotSize: 'medium shot', cameraMove: 'static' }),
      shot({ id: 'b', episodeId: 'ep1', order: 2, shotSize: 'medium shot', cameraMove: 'static' }),
      shot({ id: 'c', episodeId: 'ep2', order: 1, shotSize: 'medium shot', cameraMove: 'static' }),
      shot({ id: 'd', episodeId: 'ep2', order: 2, shotSize: 'medium shot', cameraMove: 'static' }),
    ])
    expect(findings).toEqual([])
  })

  test('reports shots with no camera plan at all', async () => {
    const findings = await run([shot({ id: 'a', cameraMove: undefined })])
    expect(findings.join(' ')).toMatch(/declare no camera move/)
  })

  test('failOn:"problems" stops the run before any image is paid for', async () => {
    const stage = cameraCheck.create({}, deps()) as StagePort
    await expect(
      stage.run({
        project: project([shot({ cameraMove: 'vibe cam' })]),
        ports: {} as never,
        log,
        options: { failOn: 'problems' },
        concurrency: {},
        autoApprove: true,
        emit: () => {},
      }),
    ).rejects.toThrow(/camera-check found/)
  })
})

describe('setupKey', () => {
  test('ignores case and separator noise', () => {
    expect(setupKey('Medium Shot', 'Dolly_In')).toBe(setupKey('medium shot', 'dolly-in'))
  })
})
