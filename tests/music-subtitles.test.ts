import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createLogger } from '../src/kernel/logger.js'
import { DEFAULT_POLICY, checkLicence, needsAttribution, parseCreativeCommons } from '../src/lib/licence.js'
import { buildSrt, formatTimestamp, wrap } from '../src/lib/srt.js'
import localMusic from '../src/plugins/music/local.js'
import multiMusic from '../src/plugins/music/multi.js'
import subtitlesStage from '../src/plugins/stage/subtitles.js'
import type { MusicPort, StagePort } from '../src/kernel/ports.js'
import type { PluginDeps } from '../src/kernel/registry.js'
import type { Project, Shot } from '../src/kernel/types.js'

const log = createLogger('silent')
let work = ''

const deps = (overrides: Partial<PluginDeps> = {}): PluginDeps => ({
  log,
  cwd: work,
  load: async () => {
    throw new Error('not used')
  },
  ...overrides,
})

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), 'duanju-ms-'))
})
afterAll(async () => {
  if (work) await rm(work, { recursive: true, force: true })
})

// ─── licence policy ───────────────────────────────────────────────────────

describe('licence policy', () => {
  test('CC0 passes: no restriction on commercial use or derivatives', () => {
    expect(checkLicence(parseCreativeCommons('cc0', '1.0')).ok).toBe(true)
  })

  test('BY passes but is flagged as needing a credit line', () => {
    const licence = { ...parseCreativeCommons('by', '4.0'), attribution: '"X" by Y…' }
    expect(checkLicence(licence).ok).toBe(true)
    expect(needsAttribution(licence)).toBe(true)
  })

  test('NC is refused — publishing a short drama is commercial use', () => {
    const verdict = checkLicence(parseCreativeCommons('by-nc', '3.0'))
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/commercial/)
  })

  test('ND is refused — scoring a video makes a derivative work', () => {
    const verdict = checkLicence(parseCreativeCommons('by-nd', '4.0'))
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/derivative/)
  })

  test('by-nc-nd, the shape a real search returns, fails on the first check', () => {
    expect(checkLicence(parseCreativeCommons('by-nc-nd', '3.0')).ok).toBe(false)
  })

  test('unknown terms are refused, not assumed permissive', () => {
    const verdict = checkLicence({
      code: 'mystery',
      commercialUse: 'unknown',
      derivativesAllowed: 'unknown',
    })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/unknown/)
  })

  test('CC0 and generated tracks need no credit line', () => {
    expect(needsAttribution({ code: 'cc0', attribution: 'x', commercialUse: true, derivativesAllowed: true })).toBe(false)
    expect(needsAttribution({ code: 'generated', commercialUse: true, derivativesAllowed: true })).toBe(false)
  })

  test('an explicit allow-list can be narrowed without changing the checks', () => {
    const cc0 = parseCreativeCommons('cc0', '1.0')
    expect(checkLicence(cc0, { ...DEFAULT_POLICY, allowed: ['by'] }).ok).toBe(false)
  })
})

// ─── srt ──────────────────────────────────────────────────────────────────

describe('SRT building', () => {
  test('timestamps use a comma before the milliseconds, as the format demands', () => {
    expect(formatTimestamp(0)).toBe('00:00:00,000')
    expect(formatTimestamp(4.096)).toBe('00:00:04,096')
    expect(formatTimestamp(3661.5)).toBe('01:01:01,500')
  })

  test('negative time is clamped rather than emitting a broken cue', () => {
    expect(formatTimestamp(-2)).toBe('00:00:00,000')
  })

  test('cues never overlap — an overlap stacks two lines on screen', () => {
    const srt = buildSrt([
      { start: 0, end: 5, text: 'first' },
      { start: 4, end: 8, text: 'second' },
    ])
    const [, firstRange] = srt.split('\n')
    expect(firstRange).toBe('00:00:00,000 --> 00:00:03,960')
  })

  test('a very short cue is held long enough to read', () => {
    const srt = buildSrt([{ start: 0, end: 0.1, text: 'go' }])
    expect(srt).toContain('00:00:00,000 --> 00:00:00,800')
  })

  test('empty text produces no cue instead of an empty box', () => {
    const srt = buildSrt([
      { start: 0, end: 2, text: '   ' },
      { start: 2, end: 4, text: 'real' },
    ])
    expect(srt.trim().split('\n')[0]).toBe('1')
    expect(srt).toContain('real')
    expect(srt).not.toMatch(/^2$/m)
  })

  test('indices are contiguous after empties are dropped', () => {
    const srt = buildSrt([
      { start: 0, end: 2, text: 'a' },
      { start: 2, end: 4, text: '' },
      { start: 4, end: 6, text: 'b' },
    ])
    expect(srt).toMatch(/^1$/m)
    expect(srt).toMatch(/^2$/m)
    expect(srt).not.toMatch(/^3$/m)
  })
})

describe('wrapping', () => {
  test('wraps CJK on width — it has no spaces to break on', () => {
    expect(wrap('一二三四五六七八九十一二', 5)).toBe('一二三四五\n六七八九十\n一二')
  })

  test('wraps latin on word boundaries', () => {
    expect(wrap('the courier freezes mid step', 12)).toBe('the courier\nfreezes mid\nstep')
  })

  test('short text is left alone', () => {
    expect(wrap('ok', 20)).toBe('ok')
  })
})

// ─── music sources ────────────────────────────────────────────────────────

describe('music/local', () => {
  test('an absent library returns nothing rather than throwing', async () => {
    const port = (await localMusic.create({ dir: './nope' }, deps())) as MusicPort
    expect(await port.find(brief(), 3)).toEqual([])
  })

  test('ranks by filename tag overlap when no sidecar exists', async () => {
    const dir = join(work, 'music')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'track_03.mp3'), 'x')
    await writeFile(join(dir, 'tense-strings-loop.mp3'), 'x')

    const port = (await localMusic.create({ dir }, deps())) as MusicPort
    const found = await port.find({ ...brief(), keywords: ['tense', 'strings'] }, 2)

    expect(found[0]?.title).toBe('tense-strings-loop')
    expect(found[0]?.licence.code).toBe('user-provided')
  })

  test('a sidecar supplies the metadata a filename cannot', async () => {
    const dir = join(work, 'music2')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'a.mp3'), 'x')
    await writeFile(
      join(dir, 'a.json'),
      JSON.stringify({ title: 'Rain Theme', tags: ['dread'], seconds: 96, licence: { code: 'licensed' } }),
    )

    const port = (await localMusic.create({ dir }, deps())) as MusicPort
    const [track] = await port.find({ ...brief(), keywords: ['dread'] }, 1)

    expect(track?.title).toBe('Rain Theme')
    expect(track?.seconds).toBe(96)
    expect(track?.licence.code).toBe('licensed')
  })
})

describe('music/multi', () => {
  const fakeSource = (name: string, canGenerate: boolean, count: number, calls: string[]): MusicPort => ({
    name,
    caps: { canGenerate },
    find: async () => {
      calls.push(name)
      return Array.from({ length: count }, (_v, i) => ({
        id: `${name}-${i}`,
        title: `${name} ${i}`,
        source: canGenerate ? ('generated' as const) : ('local' as const),
        uri: `file:///${name}-${i}.mp3`,
        mime: 'audio/mpeg',
        tags: [],
        licence: { code: 'cc0', commercialUse: true as const, derivativesAllowed: true as const },
      }))
    },
  })

  const withSources = (calls: string[], sources: Record<string, MusicPort>) =>
    deps({ load: async (_port, impl) => sources[impl] as never })

  test('stops before the paid source once cheap ones supplied enough', async () => {
    const calls: string[] = []
    const sources = {
      local: fakeSource('local', false, 3, calls),
      gen: fakeSource('gen', true, 1, calls),
    }
    const port = (await multiMusic.create(
      { sources: ['local', 'gen'], enough: 3 },
      withSources(calls, sources),
    )) as MusicPort

    await port.find(brief(), 4)
    expect(calls).toEqual(['local'])
  })

  test('alwaysGenerate keeps a bespoke cue in the running', async () => {
    const calls: string[] = []
    const sources = {
      local: fakeSource('local', false, 3, calls),
      gen: fakeSource('gen', true, 1, calls),
    }
    const port = (await multiMusic.create(
      { sources: ['local', 'gen'], enough: 3, alwaysGenerate: true },
      withSources(calls, sources),
    )) as MusicPort

    await port.find(brief(), 4)
    expect(calls).toEqual(['local', 'gen'])
  })

  test('one dead source does not cost the run its score', async () => {
    const calls: string[] = []
    const broken: MusicPort = {
      name: 'broken',
      caps: { canGenerate: false },
      find: async () => {
        throw new Error('network down')
      },
    }
    const sources = { broken, local: fakeSource('local', false, 2, calls) }
    const port = (await multiMusic.create(
      { sources: ['broken', 'local'], enough: 5 },
      withSources(calls, sources),
    )) as MusicPort

    expect((await port.find(brief(), 4)).length).toBe(2)
  })

  test('the same track from two sources is one option', async () => {
    const calls: string[] = []
    const same = (name: string): MusicPort => ({
      name,
      caps: { canGenerate: false },
      find: async () => [
        {
          id: `${name}-dup`,
          title: 'dup',
          source: 'local' as const,
          uri: 'file:///same.mp3',
          mime: 'audio/mpeg',
          tags: [],
          licence: { code: 'cc0', commercialUse: true as const, derivativesAllowed: true as const },
        },
      ],
    })
    const port = (await multiMusic.create(
      { sources: ['a', 'b'], enough: 99 },
      withSources(calls, { a: same('a'), b: same('b') }),
    )) as MusicPort

    expect((await port.find(brief(), 4)).length).toBe(1)
  })
})

// ─── subtitles gating ─────────────────────────────────────────────────────

describe('subtitles stage — confirmation gating', () => {
  const runStage = (project: Project, options: Record<string, unknown> = {}) => {
    const stage = subtitlesStage.create({}, deps()) as StagePort
    return stage.run({
      project,
      ports: {} as never,
      log,
      options,
      concurrency: {},
      autoApprove: true,
      emit: () => {},
    })
  }

  test('refuses when the confirmation gate never ran', async () => {
    await expect(runStage(projectWith({ export: { status: 'done' } }))).rejects.toThrow(
      /has not been confirmed/,
    )
  })

  test('refuses while the gate is still awaiting input', async () => {
    await expect(
      runStage(projectWith({ export: { status: 'done' }, 'gate-cut': { status: 'awaiting-input' } })),
    ).rejects.toThrow(/awaiting-input, not done/)
  })

  test('names the gate it is waiting on so the fix is obvious', async () => {
    await expect(
      runStage(projectWith({ export: { status: 'done' } }), { confirmGate: 'gate-picture' }),
    ).rejects.toThrow(/gate-picture/)
  })

  test('proceeds once the gate is done', async () => {
    // No dialogue, so it stops early — but past the gate check, which is the point.
    const outcome = await runStage(
      projectWith({ export: { status: 'done' }, 'gate-cut': { status: 'done' } }),
    )
    expect(outcome.kind).toBe('ok')
  })

  test('confirmGate:false is an explicit opt-out, not the default', async () => {
    const outcome = await runStage(projectWith({ export: { status: 'done' } }), {
      confirmGate: false,
    })
    expect(outcome.kind).toBe('ok')
  })
})

// ─── helpers ──────────────────────────────────────────────────────────────

const brief = () => ({
  genre: 'noir',
  mood: 'dread',
  styleGuide: 'teal and orange',
  seconds: 40,
  keywords: [] as string[],
})

const shot = (over: Partial<Shot> = {}): Shot => ({
  id: 'ep1-s01',
  episodeId: 'ep1',
  order: 1,
  durationSeconds: 4,
  plotDescription: 'x',
  characterIds: [],
  propIds: [],
  status: 'clipped',
  ...over,
})

const projectWith = (stageState: Project['stageState']): Project => ({
  id: 'p1',
  title: 't',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'i',
  createdAt: 'x',
  updatedAt: 'x',
  episodes: [],
  characters: [],
  scenes: [],
  props: [],
  shots: [shot()],
  finalCut: { id: 'cut', uri: 'file:///cut.mp4', mime: 'video/mp4', meta: {} },
  stageState,
  adapterState: {},
})

// ─── openverse against a stub server ──────────────────────────────────────

describe('music/openverse', () => {
  const startServer = async (
    handler: (query: string) => { results: unknown[] } | { status: number; body: string },
  ) => {
    const { createServer } = await import('node:http')
    const seen: string[] = []
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const query = url.searchParams.get('q') ?? ''
      seen.push(query)
      const out = handler(query)
      if ('status' in out) {
        res.writeHead(out.status, { 'content-type': 'application/json' })
        res.end(out.body)
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(out))
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port
    return { endpoint: `http://127.0.0.1:${port}/v1/audio/`, seen, close: () => server.close() }
  }

  const track = (over: Record<string, unknown> = {}) => ({
    id: 't1',
    title: 'Noir Bed',
    url: 'https://cdn.example/t1.mp3',
    creator: 'someone',
    license: 'cc0',
    license_version: '1.0',
    duration: 40_000,
    tags: [{ name: 'noir' }],
    ...over,
  })

  test('widens the query when Openverse ANDs the brief into zero results', async () => {
    const server = await startServer((q) => ({
      results: q.split(' ').length > 2 ? [] : [track()],
    }))
    try {
      const { default: openverse } = await import('../src/plugins/music/openverse.js')
      const port = (await openverse.create({ endpoint: server.endpoint }, deps())) as MusicPort
      const found = await port.find(
        { ...brief(), keywords: ['instrumental', 'suspense'] },
        3,
      )

      expect(found.length).toBe(1)
      // Narrowest first, then progressively fewer terms.
      expect(server.seen[0]?.split(' ').length).toBeGreaterThan(2)
      expect(server.seen.at(-1)?.split(' ').length).toBe(2)
    } finally {
      server.close()
    }
  })

  test('drops NC and ND results even when the API returns them', async () => {
    const server = await startServer(() => ({
      results: [
        track({ id: 'nc', license: 'by-nc' }),
        track({ id: 'nd', license: 'by-nd' }),
        track({ id: 'ok', license: 'cc0' }),
      ],
    }))
    try {
      const { default: openverse } = await import('../src/plugins/music/openverse.js')
      const port = (await openverse.create({ endpoint: server.endpoint }, deps())) as MusicPort
      const found = await port.find(brief(), 5)

      expect(found.map((f) => f.id)).toEqual(['ov-ok'])
    } finally {
      server.close()
    }
  })

  test('drops tracks outside the runtime window', async () => {
    const server = await startServer(() => ({
      results: [track({ id: 'short', duration: 3_000 }), track({ id: 'fine', duration: 45_000 })],
    }))
    try {
      const { default: openverse } = await import('../src/plugins/music/openverse.js')
      const port = (await openverse.create(
        { endpoint: server.endpoint, minSeconds: 20, maxSeconds: 600 },
        deps(),
      )) as MusicPort

      expect((await port.find(brief(), 5)).map((f) => f.id)).toEqual(['ov-fine'])
    } finally {
      server.close()
    }
  })

  test('retries a transient failure rather than losing the run', async () => {
    let calls = 0
    const server = await startServer(() => {
      calls += 1
      return calls === 1 ? { status: 502, body: '{"detail":"bad gateway"}' } : { results: [track()] }
    })
    try {
      const { default: openverse } = await import('../src/plugins/music/openverse.js')
      const port = (await openverse.create(
        { endpoint: server.endpoint, attempts: 3 },
        deps(),
      )) as MusicPort

      expect((await port.find(brief(), 2)).length).toBe(1)
      expect(calls).toBeGreaterThan(1)
    } finally {
      server.close()
    }
  })

  test('carries the attribution line through for licences that need one', async () => {
    const server = await startServer(() => ({
      results: [track({ license: 'by', attribution: '"Noir Bed" by someone …' })],
    }))
    try {
      const { default: openverse } = await import('../src/plugins/music/openverse.js')
      const port = (await openverse.create({ endpoint: server.endpoint }, deps())) as MusicPort
      const [found] = await port.find(brief(), 1)

      expect(found?.licence.attribution).toContain('by someone')
      expect(needsAttribution(found!.licence)).toBe(true)
    } finally {
      server.close()
    }
  })
})
