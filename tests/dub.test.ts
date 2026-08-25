import { describe, expect, test, vi } from 'vitest'
import { createLogger } from '../src/kernel/logger.js'
import { renderedClip } from '../src/kernel/types.js'
import dubStage from '../src/plugins/stage/dub.js'
import type { Ports, SpeechPort, StagePort } from '../src/kernel/ports.js'
import type { PluginDeps } from '../src/kernel/registry.js'
import type { AssetRef, Project, Shot } from '../src/kernel/types.js'

/**
 * Tests for the dubbing stage, which arrived without any.
 *
 * The interesting behaviour is casting and the seam with export: a dubbed shot
 * carries two clips, and everything downstream has to agree on which one is
 * the picture.
 */

const log = createLogger('silent')
const deps = (): PluginDeps => ({
  log,
  cwd: '/tmp',
  load: async () => {
    throw new Error('not used')
  },
})

const ref = (id: string): AssetRef => ({
  id,
  uri: `file:///${id}.mp4`,
  mime: 'video/mp4',
  meta: {},
})

const shot = (over: Partial<Shot> = {}): Shot => ({
  id: 's1',
  episodeId: 'ep1',
  order: 1,
  durationSeconds: 4,
  plotDescription: 'x',
  characterIds: [],
  propIds: [],
  status: 'clipped',
  clip: ref('clip-s1'),
  ...over,
})

const project = (shots: readonly Shot[], characters: Project['characters'] = []): Project => ({
  id: 'p1',
  title: 't',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'i',
  createdAt: 'x',
  updatedAt: 'x',
  episodes: [],
  characters,
  scenes: [],
  props: [],
  shots,
  stageState: {},
  adapterState: {},
})

interface Harness {
  readonly ports: Ports
  readonly synthesized: { text: string; voice?: string }[]
  readonly mixed: string[]
}

const harness = (overrides: { mixVoice?: unknown } = {}): Harness => {
  const synthesized: { text: string; voice?: string }[] = []
  const mixed: string[] = []

  const speech: SpeechPort = {
    name: 'fake',
    caps: { maxChars: 10_000, maxConcurrency: 4, voices: [] },
    synthesize: async (req) => {
      synthesized.push({ text: req.text, voice: req.voice })
      return [{ id: `voice-${req.label}`, uri: 'file:///v.mp3', mime: 'audio/mpeg', meta: {} }]
    },
  }

  const post = {
    name: 'fake',
    mixMusic: async () => ref('unused'),
    buildSubtitles: async () => ref('unused'),
    burnSubtitles: async () => ref('unused'),
    ...('mixVoice' in overrides
      ? { mixVoice: overrides.mixVoice }
      : {
          mixVoice: async (clip: AssetRef) => {
            mixed.push(clip.id)
            return ref(`voiced-${clip.id}`)
          },
        }),
  }

  const ports = {
    speech,
    post,
    assetStore: {
      name: 'fake',
      ingest: async (uri: string) => ({ id: `stored-${uri}`, uri, mime: 'audio/mpeg', meta: {} }),
      put: async () => ref('put'),
      get: async () => new Uint8Array(),
      localPath: async () => '/tmp/x',
    },
    ledger: {
      name: 'fake',
      reserve: async (c: { idempotencyKey: string; amount: number }) => ({
        idempotencyKey: c.idempotencyKey,
        amount: c.amount,
        alreadySettled: false,
      }),
      commit: async () => {},
      refund: async () => {},
      balance: async () => Infinity,
    },
  } as unknown as Ports

  return { ports, synthesized, mixed }
}

const run = async (
  proj: Project,
  options: Record<string, unknown> = {},
  h: Harness = harness(),
) => {
  const stage = dubStage.create({}, deps()) as StagePort
  const outcome = await stage.run({
    project: proj,
    ports: h.ports,
    log,
    options,
    concurrency: {},
    autoApprove: true,
    emit: () => {},
  })
  return { outcome, h }
}

describe('dub stage', () => {
  test('says nothing to do when no shot carries speech', async () => {
    const { outcome, h } = await run(project([shot()]))
    expect(outcome.kind).toBe('ok')
    expect(h.synthesized).toEqual([])
  })

  test('casts a character to their configured voice', async () => {
    const h = harness()
    await run(
      project([shot({ dialogue: '你看见了什么', characterIds: ['ch1'] })], [
        { id: 'ch1', name: '林默', appearance: 'x' },
      ]),
      { voices: { 林默: 'male-qn-jingying' } },
      h,
    )

    expect(h.synthesized).toEqual([{ text: '你看见了什么', voice: 'male-qn-jingying' }])
  })

  test('an uncast character still gets voiced, and the run says so', async () => {
    const warn = vi.fn()
    const stage = dubStage.create({}, { ...deps(), log: { ...log, warn } }) as StagePort
    const h = harness()

    await stage.run({
      project: project([shot({ dialogue: 'line', characterIds: ['ch1'] })], [
        { id: 'ch1', name: '陈宗之', appearance: 'x' },
      ]),
      ports: h.ports,
      log: { ...log, warn },
      options: {},
      concurrency: {},
      autoApprove: true,
      emit: () => {},
    })

    expect(h.synthesized[0]?.voice).toBeUndefined()
    expect(warn.mock.calls.flat().join(' ')).toMatch(/陈宗之/)
  })

  test('narration uses the narrator voice, not the character on screen', async () => {
    const h = harness()
    await run(
      project([shot({ narration: '一个来自一千六百年后的灵魂', characterIds: ['ch1'] })], [
        { id: 'ch1', name: '林默', appearance: 'x' },
      ]),
      { voices: { 林默: 'male-1' }, narratorVoice: 'narrator-1' },
      h,
    )

    expect(h.synthesized).toEqual([
      { text: '一个来自一千六百年后的灵魂', voice: 'narrator-1' },
    ])
  })

  test('includeNarration:false leaves exposition unspoken', async () => {
    const h = harness()
    await run(project([shot({ narration: 'exposition' })]), { includeNarration: false }, h)
    expect(h.synthesized).toEqual([])
  })

  test('records the voiced clip on the shot, leaving the silent one intact', async () => {
    const { outcome } = await run(project([shot({ dialogue: 'line' })]))
    expect(outcome.kind).toBe('ok')
    if (outcome.kind !== 'ok') return

    const dubbed = outcome.project.shots[0]
    expect(dubbed?.clip?.id).toBe('clip-s1')
    expect(dubbed?.voicedClip?.id).toBe('voiced-clip-s1')
    expect(dubbed?.voice).toBeDefined()
  })

  test('one failed line does not cost the other shots their voices', async () => {
    const h = harness()
    let call = 0
    ;(h.ports.speech as { synthesize: unknown }).synthesize = async (req: { label?: string }) => {
      call += 1
      if (call === 1) throw new Error('provider timeout')
      return [{ id: `voice-${req.label}`, uri: 'file:///v.mp3', mime: 'audio/mpeg', meta: {} }]
    }

    const { outcome } = await run(
      project([
        shot({ id: 's1', order: 1, dialogue: 'a', clip: ref('clip-s1') }),
        shot({ id: 's2', order: 2, dialogue: 'b', clip: ref('clip-s2') }),
      ]),
      {},
      h,
    )

    expect(outcome.kind).toBe('ok')
    if (outcome.kind !== 'ok') return
    const voiced = outcome.project.shots.filter((s) => s.voicedClip)
    expect(voiced.length).toBe(1)
  })

  test('refuses a post adapter that cannot mix voice, naming the fix', async () => {
    const h = harness({ mixVoice: undefined })
    await expect(run(project([shot({ dialogue: 'line' })]), {}, h)).rejects.toThrow(
      /cannot mix voice/,
    )
  })

  test('an already-dubbed shot is not re-voiced on a re-run', async () => {
    const h = harness()
    await run(
      project([shot({ dialogue: 'line', voicedClip: ref('voiced-clip-s1') })]),
      {},
      h,
    )
    expect(h.synthesized).toEqual([])
  })
})

describe('renderedClip — the export/subtitles seam', () => {
  test('a dubbed shot renders as its voiced mix', () => {
    expect(renderedClip(shot({ voicedClip: ref('voiced') }))?.id).toBe('voiced')
  })

  test('an undubbed shot renders as its silent clip', () => {
    expect(renderedClip(shot())?.id).toBe('clip-s1')
  })

  test('a shot with neither renders as nothing', () => {
    expect(renderedClip(shot({ clip: undefined }))).toBeUndefined()
  })
})
