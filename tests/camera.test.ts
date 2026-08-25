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

describe('spokenSeconds', () => {
  const opts = { charsPerSecond: 5, fallback: 5, min: 3, max: 12 }

  test('a silent beat falls back to the fixed length', async () => {
    const { spokenSeconds } = await import('../src/plugins/stage/import-script.js')
    expect(spokenSeconds(undefined, opts)).toBe(5)
    expect(spokenSeconds('   ', opts)).toBe(5)
  })

  test('a short retort is shorter than a long speech', async () => {
    const { spokenSeconds } = await import('../src/plugins/stage/import-script.js')
    const short = spokenSeconds('你做梦!', opts)
    const long = spokenSeconds(
      '瑜之,你娘在为你想办法——明年你满十六,按《靖律》要编入丁籍,每年至少服役二十日。你身子骨弱,如何扛得住?',
      opts,
    )
    expect(short).toBeLessThan(long)
    expect(short).toBe(opts.min)
    // A 50-hanzi line with 5 pauses lands near the ceiling without being clamped.
    expect(long).toBeGreaterThanOrEqual(10)
    expect(long).toBeLessThanOrEqual(opts.max)
  })

  test('a Latin word buys more airtime than one hanzi', async () => {
    const { spokenSeconds } = await import('../src/plugins/stage/import-script.js')
    // 10 words vs 10 hanzi: the words should need more time.
    expect(spokenSeconds('one two three four five six seven eight nine ten', opts)).toBeGreaterThan(
      spokenSeconds('一二三四五六七八九十', opts),
    )
  })

  test('sentence breaks add breathing room', async () => {
    const { spokenSeconds } = await import('../src/plugins/stage/import-script.js')
    const flat = '甲乙丙丁戊己庚辛壬癸甲乙丙丁戊己庚辛壬癸'
    const punctuated = '甲乙丙丁戊,己庚辛壬癸。甲乙丙丁戊,己庚辛壬癸。'
    expect(spokenSeconds(punctuated, opts)).toBeGreaterThanOrEqual(spokenSeconds(flat, opts))
  })

  test('stays inside the clamp every video model would apply anyway', async () => {
    const { spokenSeconds } = await import('../src/plugins/stage/import-script.js')
    expect(spokenSeconds('啊', opts)).toBe(3)
    expect(spokenSeconds('字'.repeat(400), opts)).toBe(12)
  })
})

describe('spreadNarration', () => {
  const load = async () => (await import('../src/plugins/stage/import-script.js')).spreadNarration
  const opts = { maxSeconds: 5, charsPerSecond: 5 }  // 25 chars per shot

  test('leaves narration that already fits where it is', async () => {
    const spread = await load()
    const out = spread([{ narration: '短旁白。' }, {}], opts)
    expect(out[0]?.narration).toBe('短旁白。')
    expect(out[1]?.narration).toBeUndefined()
  })

  test('moves the overflow onto later shots instead of truncating it', async () => {
    const spread = await load()
    const long = '第一句话在这里。第二句话在这里。第三句话在这里。第四句话在这里。'
    const out = spread([{ narration: long }, {}, {}], opts)

    const rejoined = out.map((e) => e.narration ?? '').join('')
    expect(rejoined).toBe(long)          // nothing lost
    expect(out[1]?.narration).toBeTruthy() // and it did move
  })

  test('breaks only at sentence ends, never mid-sentence', async () => {
    const spread = await load()
    const out = spread([{ narration: '甲乙丙丁戊己庚辛壬癸。子丑寅卯辰巳午未申酉。' }, {}], opts)
    for (const e of out) {
      if (e.narration) expect(e.narration).toMatch(/[。！？…]$/)
    }
  })

  test('splits a comma-spliced sentence no shot could hold', async () => {
    const spread = await load()
    const monster = '甲乙丙丁,戊己庚辛,壬癸子丑,寅卯辰巳,午未申酉,戌亥甲乙,丙丁戊己。'
    const out = spread([{ narration: monster }, {}, {}, {}], opts)

    expect(out.map((e) => e.narration ?? '').join('')).toBe(monster)
    expect(out.filter((e) => e.narration).length).toBeGreaterThan(1)
  })

  test('dialogue eats into what narration a shot can carry', async () => {
    const spread = await load()
    const narration = '第一句。第二句。第三句。'
    const withTalk = spread([{ narration, dialogue: '这是一句很长的台词占满了这个镜头' }, {}], opts)
    const without = spread([{ narration }, {}], opts)

    expect((withTalk[0]?.narration ?? '').length).toBeLessThanOrEqual(
      (without[0]?.narration ?? '').length,
    )
  })

  test('closing narration lands on the last shot rather than being dropped', async () => {
    const spread = await load()
    const long = '一句。'.repeat(20)
    const out = spread([{ narration: long }, {}], opts)
    expect(out.map((e) => e.narration ?? '').join('')).toBe(long)
  })
})

describe('spreadNarration order', () => {
  test('never reorders narration to make a later sentence fit', async () => {
    const { spreadNarration } = await import('../src/plugins/stage/import-script.js')
    // Middle sentence is long; the short one after it must NOT jump ahead.
    const narration = '第一。' + '中间很长的一句话反复出现'.repeat(6) + '。最后一句。'
    const out = spreadNarration([{ narration }, {}, {}, {}, {}], {
      maxSeconds: 5,
      charsPerSecond: 5,
    })

    const rejoined = out.map((e) => e.narration ?? '').join('')
    expect(rejoined).toBe(narration)                       // nothing lost
    expect(rejoined.indexOf('第一。')).toBe(0)              // and nothing overtakes
    expect(rejoined.endsWith('最后一句。')).toBe(true)
  })

  test('reading the shots in order reproduces the script exactly', async () => {
    const { spreadNarration } = await import('../src/plugins/stage/import-script.js')
    const a = '承平二年,东靖。'
    const b = '书圣王希之在兰亭与友人雅集,写下了《兰亭叙》;谢晏还隐居在会稽东山,携妓优游。'
    const c = '已经两次北伐,打到了故都洛京。'
    const out = spreadNarration([{ narration: a + b + c }, {}, {}, {}], {
      maxSeconds: 12,
      charsPerSecond: 5,
    })
    expect(out.map((e) => e.narration ?? '').join('')).toBe(a + b + c)
  })
})

describe('speech middleware', () => {
  test('retry covers speech, so one timeout does not lose a line', async () => {
    const retry = (await import('../src/plugins/middleware/retry.js')).default
    const mw = (await retry.create({ attempts: 3, baseDelayMs: 1 }, deps())) as GenerateMiddleware

    let calls = 0
    const out = await mw.speech?.(
      { text: '你!目无尊长!', idempotencyKey: 'k', label: 'ep3-s09' },
      { project: project([]), log },
      async () => {
        calls += 1
        if (calls < 3) throw new Error('请求超时，请稍后重试')
        return [{ id: 'a', uri: 'file:///v.mp3', mime: 'audio/mpeg', meta: {} }]
      },
    )

    expect(calls).toBe(3)
    expect(out?.[0]?.id).toBe('a')
  })
})
