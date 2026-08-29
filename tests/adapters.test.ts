import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { createLogger } from '../src/kernel/logger.js'
import { extractJson } from '../src/lib/chat.js'
import localfs from '../src/plugins/assetstore/localfs.js'
import localjson from '../src/plugins/state/localjson.js'
import localledger from '../src/plugins/ledger/localledger.js'
import noopLedger from '../src/plugins/ledger/noop.js'
import libtvImage from '../src/plugins/image/libtv.js'
import libtvVideo from '../src/plugins/video/libtv.js'
import libtvSpeech from '../src/plugins/speech/libtv.js'
import promptTune from '../src/plugins/middleware/prompt-tune.js'
import type { AssetStorePort, ImagePort, LedgerPort, SpeechPort, StatePort, VideoPort } from '../src/kernel/ports.js'
import type { PluginDeps } from '../src/kernel/registry.js'
import type { AssetRef, Project } from '../src/kernel/types.js'

const log = createLogger('silent')
let work = ''

const deps = (): PluginDeps => ({
  log,
  cwd: work,
  load: async () => {
    throw new Error('not used')
  },
})

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), 'duanju-ad-'))
})
afterAll(async () => {
  if (work) await rm(work, { recursive: true, force: true })
})

// ─── asset store ──────────────────────────────────────────────────────────

describe('localfs asset store', () => {
  const make = () => localfs.create({ root: './assets' }, deps()) as AssetStorePort

  test('is content-addressed: identical bytes reuse one id', async () => {
    const store = make()
    const bytes = new Uint8Array([1, 2, 3, 4])
    const a = await store.put(bytes, { kind: 'other', projectId: 'p', mime: 'image/png' })
    const b = await store.put(bytes, { kind: 'other', projectId: 'p', mime: 'image/png' })

    expect(a.id).toBe(b.id)
    expect(await store.get(a)).toEqual(bytes)
  })

  test('carries provider metadata through, so canvas wiring survives ingest', async () => {
    const store = make()
    const src = join(work, 'src.png')
    await writeFile(src, Buffer.from([9, 9, 9]))

    const ref = await store.ingest(`file://${src}`, {
      kind: 'still',
      projectId: 'p',
      mime: 'image/png',
      extra: { libtvNodeName: 'canvas-node-1' },
    })

    expect(ref.meta['libtvNodeName']).toBe('canvas-node-1')
    expect(ref.uri.startsWith('file://')).toBe(true)
  })

  test('rejects a non-local asset with an actionable message', async () => {
    const store = make()
    const remote: AssetRef = { id: 'x', uri: 'https://example.com/a.png', mime: 'image/png', meta: {} }
    await expect(store.localPath(remote)).rejects.toThrow(/not local/)
  })
})

// ─── state ────────────────────────────────────────────────────────────────

describe('localjson state', () => {
  const project = (id: string): Project => ({
    id,
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
    shots: [],
    stageState: {},
    adapterState: {},
  })

  test('round-trips and lists projects', async () => {
    const store = localjson.create({ root: './state' }, deps()) as StatePort
    await store.save(project('pa'))
    await store.save(project('pb'))

    expect((await store.load('pa'))?.id).toBe('pa')
    expect(await store.list()).toEqual(['pa', 'pb'])
  })

  test('returns null for an unknown project rather than throwing', async () => {
    const store = localjson.create({ root: './state' }, deps()) as StatePort
    expect(await store.load('nope')).toBeNull()
  })
})

// ─── ledger ───────────────────────────────────────────────────────────────

describe('localledger', () => {
  const make = async (root: string, maxCredits = 0) =>
    (await localledger.create({ root, maxCredits }, deps())) as LedgerPort

  test('a committed key short-circuits on the next reserve', async () => {
    const first = await make('./ledger-a')
    const hold = await first.reserve({ idempotencyKey: 'k1', amount: 5, reason: 'r' })
    expect(hold.alreadySettled).toBe(false)
    await first.commit(hold)

    // A fresh instance must rebuild that knowledge from the file.
    const second = await make('./ledger-a')
    expect((await second.reserve({ idempotencyKey: 'k1', amount: 5, reason: 'r' })).alreadySettled).toBe(true)
  })

  test('double commit does not inflate spend', async () => {
    const ledger = await make('./ledger-b', 100)
    const hold = await ledger.reserve({ idempotencyKey: 'k', amount: 10, reason: 'r' })
    await ledger.commit(hold)
    await ledger.commit(hold)

    expect(await ledger.balance()).toBe(90)
  })

  test('refunded work does not count against the budget', async () => {
    const ledger = await make('./ledger-c', 100)
    const hold = await ledger.reserve({ idempotencyKey: 'k', amount: 10, reason: 'r' })
    await ledger.refund(hold, 'provider failed')

    expect(await ledger.balance()).toBe(100)
  })

  test('exceeding the budget aborts before the provider is called', async () => {
    const ledger = await make('./ledger-d', 10)
    const hold = await ledger.reserve({ idempotencyKey: 'k1', amount: 8, reason: 'r' })
    await ledger.commit(hold)

    await expect(ledger.reserve({ idempotencyKey: 'k2', amount: 5, reason: 'r' })).rejects.toThrow(
      /Budget exceeded/,
    )
  })
})

describe('noop ledger', () => {
  const make = async () => (await noopLedger.create({}, deps())) as LedgerPort

  test('never blocks work and writes nothing to disk', async () => {
    const ledger = await make()
    const hold = await ledger.reserve({ idempotencyKey: 'k', amount: 999_999, reason: 'r' })

    expect(hold.alreadySettled).toBe(false)
    await expect(ledger.commit(hold)).resolves.toBeUndefined()
    await expect(ledger.refund(hold, 'x')).resolves.toBeUndefined()
    expect(await ledger.balance()).toBe(Number.POSITIVE_INFINITY)
  })

  test('has no budget ceiling — any amount is admitted', async () => {
    const ledger = await make()
    for (const amount of [1, 10_000, 1e9]) {
      await expect(
        ledger.reserve({ idempotencyKey: `k${amount}`, amount, reason: 'r' }),
      ).resolves.toBeDefined()
    }
  })

  test('does NOT dedupe: the same key reserves again (documented trade-off)', async () => {
    const ledger = await make()
    const first = await ledger.reserve({ idempotencyKey: 'same', amount: 1, reason: 'r' })
    await ledger.commit(first)
    const second = await ledger.reserve({ idempotencyKey: 'same', amount: 1, reason: 'r' })

    expect(second.alreadySettled).toBe(false)
  })
})

// ─── libtv adapters (fake CLI) ────────────────────────────────────────────

/**
 * A stand-in `libtv` binary that records its argv and replies with the two
 * pretty-printed JSON documents the real CLI emits. This is where the real
 * bugs were, so the argv contract is worth pinning down.
 */
const fakeLibtv = async (name: string, url: string): Promise<{ bin: string; argsFile: string }> => {
  const bin = join(work, `${name}.sh`)
  const argsFile = join(work, `${name}.args`)
  await writeFile(
    bin,
    [
      '#!/bin/sh',
      `printf '%s\\n' "$@" > ${JSON.stringify(argsFile)}`,
      `cat <<'JSON'`,
      '{',
      '  "nodeKey": "n-created",',
      '  "data": { "url": [] }',
      '}',
      '{',
      '  "nodeKey": "n-final",',
      '  "status": 2,',
      `  "data": { "url": ["${url}"] }`,
      '}',
      'JSON',
    ].join('\n'),
    'utf8',
  )
  await chmod(bin, 0o755)
  return { bin, argsFile }
}

const argsOf = async (file: string): Promise<string[]> =>
  (await readFile(file, 'utf8')).split('\n').filter((l) => l.length > 0)

describe('libtv image adapter', () => {
  test('switches to image2image when references are attached', async () => {
    const { bin, argsFile } = await fakeLibtv('img-refs', 'https://cdn/x.png')
    const port = (await libtvImage.create(
      { bin, canvas: 'c-uuid', model: 'General image V2' },
      deps(),
    )) as ImagePort

    const ref: AssetRef = {
      id: 'r1',
      uri: 'https://cdn.example/r1.png',
      mime: 'image/png',
      meta: { libtvNodeName: 'canvas-ref-1' },
    }
    await port.generate({ prompt: 'p', refs: [ref], ratio: '9:16', idempotencyKey: 'k', label: 's01' })

    const args = await argsOf(argsFile)
    expect(args).toContain('modeType=image2image')
    expect(args).toContain('--left')
    expect(args).toContain('canvas-ref-1')
    // Model name must survive as ONE argv entry despite the space.
    expect(args).toContain('model=General image V2')
  })

  test('stays text2image with no references', async () => {
    const { bin, argsFile } = await fakeLibtv('img-plain', 'https://cdn/y.png')
    const port = (await libtvImage.create({ bin, canvas: 'c-uuid' }, deps())) as ImagePort

    await port.generate({ prompt: 'p', ratio: '9:16', idempotencyKey: 'k' })

    const args = await argsOf(argsFile)
    expect(args).toContain('modeType=text2image')
    expect(args).not.toContain('--left')
  })

  test('drops references that have no canvas node instead of failing silently', async () => {
    const { bin, argsFile } = await fakeLibtv('img-orphan', 'https://cdn/z.png')
    const port = (await libtvImage.create({ bin, canvas: 'c-uuid' }, deps())) as ImagePort

    const orphan: AssetRef = { id: 'r', uri: 'https://cdn.example/r.png', mime: 'image/png', meta: {} }
    await port.generate({ prompt: 'p', refs: [orphan], idempotencyKey: 'k' })

    expect(await argsOf(argsFile)).toContain('modeType=text2image')
  })

  test('a local-file reference is uploaded and wired by the uploaded node key', async () => {
    const { bin, argsFile } = await fakeLibtv('img-upload', 'https://cdn/u.png')
    const port = (await libtvImage.create({ bin, canvas: 'c-uuid' }, deps())) as ImagePort

    // A real file on disk, because the adapter now uploads the bytes it has
    // instead of trusting a canvas node that may have been re-keyed.
    const local = join(work, 'ref-upload.png')
    await writeFile(local, Buffer.from([1]))
    const ref: AssetRef = {
      id: 'ref-upload-asset',
      uri: `file://${local}`,
      mime: 'image/png',
      meta: { libtvNodeName: 'stale-node-name' },
    }
    await port.generate({ prompt: 'p', refs: [ref], idempotencyKey: 'k', label: 'up1' })

    const args = await argsOf(argsFile)
    expect(args).toContain('modeType=image2image')
    // n-final is what the fake bin returns as the uploaded node's key — the
    // stale canvas name must NOT be used.
    expect(args).toContain('n-final')
    expect(args).not.toContain('stale-node-name')
  })

  test('returns the URL from the terminal JSON document, not the created one', async () => {
    const { bin } = await fakeLibtv('img-terminal', 'https://cdn/final.png')
    const port = (await libtvImage.create({ bin, canvas: 'c-uuid' }, deps())) as ImagePort

    const [asset] = await port.generate({ prompt: 'p', idempotencyKey: 'k' })
    expect(asset?.uri).toBe('https://cdn/final.png')
    expect(asset?.meta['libtvNodeName']).toBeTruthy()
  })
})

describe('libtv video adapter', () => {
  test('clamps duration into the model range and wires the still as first frame', async () => {
    const { bin, argsFile } = await fakeLibtv('vid', 'https://cdn/a.mp4')
    const port = (await libtvVideo.create(
      { bin, canvas: 'c', model: 'Seedance 2.0 Mini', minSeconds: 4, maxSeconds: 15 },
      deps(),
    )) as VideoPort

    const still: AssetRef = {
      id: 's',
      uri: 'https://cdn.example/s.png',
      mime: 'image/png',
      meta: { libtvNodeName: 'canvas-still-1' },
    }
    await port.generate({
      mode: 'singleImage2video',
      prompt: 'p',
      firstFrame: still,
      seconds: 1,
      ratio: '9:16',
      idempotencyKey: 'k',
    })

    const args = await argsOf(argsFile)
    expect(args).toContain('duration=4')
    expect(args).toContain('modeType=singleImage2video')
    expect(args).toContain('canvas-still-1')
  })

  test('a null param drops an adapter default, so a per-shot model swap works', async () => {
    const { bin, argsFile } = await fakeLibtv('vid-swap', 'https://cdn/c.mp4')
    const port = (await libtvVideo.create(
      { bin, canvas: 'c', model: 'Seedance 2.0 Mini', resolution: '720p' },
      deps(),
    )) as VideoPort

    await port.generate({
      mode: 'text2video',
      prompt: 'p',
      ratio: '9:16',
      idempotencyKey: 'k',
      // Another model has a different settings vocabulary entirely.
      params: { model: 'Minimax H3', resolution: '768P', ratio: 'adaptive', enableSound: null },
    })

    const args = await argsOf(argsFile)
    expect(args).toContain('model=Minimax H3')
    expect(args).toContain('resolution=768P')
    expect(args).toContain('ratio=adaptive')
    expect(args).not.toContain('resolution=720p')
    expect(args.some((a) => a.startsWith('enableSound'))).toBe(false)
  })

  test('refuses image-to-video when the still has no canvas node', async () => {
    const { bin } = await fakeLibtv('vid-noref', 'https://cdn/b.mp4')
    const port = (await libtvVideo.create({ bin, canvas: 'c' }, deps())) as VideoPort

    const orphan: AssetRef = { id: 's', uri: 'https://cdn.example/s.png', mime: 'image/png', meta: {} }
    await expect(
      port.generate({ mode: 'singleImage2video', prompt: 'p', firstFrame: orphan, idempotencyKey: 'k' }),
    ).rejects.toThrow(/no canvas node/)
  })
})

// ─── middleware ───────────────────────────────────────────────────────────

describe('prompt-tune middleware', () => {
  test('rewrites the prompt and merges params before the provider sees them', async () => {
    const mw = promptTune.create(
      {
        video: { prefix: 'PRE', suffix: 'SUF', params: { resolution: '1080p' } },
        negativePrompt: 'NEG',
      },
      deps(),
    )
    const next = vi.fn(async () => [])

    await mw.video?.(
      { mode: 'text2video', prompt: 'core', idempotencyKey: 'k', params: { duration: 5 } },
      { project: {} as Project, log },
      next,
    )

    const sent = next.mock.calls[0]?.[0] as unknown as {
      prompt: string
      negativePrompt: string
      params: Record<string, unknown>
    }
    expect(sent.prompt).toBe('PRE, core, SUF')
    expect(sent.negativePrompt).toBe('NEG')
    expect(sent.params).toEqual({ duration: 5, resolution: '1080p' })
  })
})

// ─── chat helpers ─────────────────────────────────────────────────────────

describe('extractJson', () => {
  test('unwraps a fenced code block', () => {
    expect(extractJson('here you go:\n```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  test('strips prose around a bare object', () => {
    expect(extractJson('Sure! {"a":1} hope that helps')).toBe('{"a":1}')
  })

  test('leaves clean JSON untouched', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}')
  })
})

// ─── skill-derived integration ────────────────────────────────────────────

describe('libtv video adapter — identity references', () => {
  test('promotes singleImage2video to mixed2video and keeps BOTH inputs', async () => {
    const { bin, argsFile } = await fakeLibtv('vid-identity', 'https://cdn/c.mp4')
    const port = (await libtvVideo.create({ bin, canvas: 'c' }, deps())) as VideoPort

    const still: AssetRef = {
      id: 'still',
      uri: 'https://cdn.example/s.png',
      mime: 'image/png',
      meta: { libtvNodeName: 'canvas-still-1' },
    }
    const base: AssetRef = {
      id: 'base',
      uri: 'https://cdn.example/b.png',
      mime: 'image/png',
      meta: { libtvNodeName: 'canvas-base-1' },
    }

    await port.generate({
      mode: 'singleImage2video',
      prompt: 'p',
      firstFrame: still,
      identityRefs: [base],
      idempotencyKey: 'k',
    })

    const args = await argsOf(argsFile)
    // The still must NOT be replaced by the identity anchor — both go in.
    expect(args).toContain('canvas-still-1')
    expect(args).toContain('canvas-base-1')
    expect(args).toContain('modeType=mixed2video')
  })

  test('never sends the same canvas node twice', async () => {
    const { bin, argsFile } = await fakeLibtv('vid-dedupe', 'https://cdn/d.mp4')
    const port = (await libtvVideo.create({ bin, canvas: 'c' }, deps())) as VideoPort

    const shared: AssetRef = {
      id: 'x',
      uri: 'https://cdn.example/x.png',
      mime: 'image/png',
      meta: { libtvNodeName: 'canvas-shared' },
    }
    await port.generate({
      mode: 'singleImage2video',
      prompt: 'p',
      firstFrame: shared,
      identityRefs: [shared],
      idempotencyKey: 'k',
    })

    const args = await argsOf(argsFile)
    expect(args.filter((a) => a === 'canvas-shared')).toHaveLength(1)
  })

  test('stays text2video with no frames and no identity anchors', async () => {
    const { bin, argsFile } = await fakeLibtv('vid-t2v', 'https://cdn/e.mp4')
    const port = (await libtvVideo.create({ bin, canvas: 'c' }, deps())) as VideoPort

    await port.generate({ mode: 'text2video', prompt: 'p', idempotencyKey: 'k' })
    expect(await argsOf(argsFile)).toContain('modeType=text2video')
  })
})

describe('prompt profiles', () => {
  test('the shipped profiles parse and carry the anchors stages rely on', async () => {
    const { loadProfile } = await import('../src/lib/profile.js')
    const repo = new URL('..', import.meta.url).pathname

    for (const id of ['photoreal-drama', 'manga-drama']) {
      const profile = await loadProfile(repo, './prompts/profiles', id)
      expect(profile.id).toBe(id)
      expect(profile.anchors.keyframe).toBeTruthy()
      expect(profile.anchors.characterBase).toBeTruthy()
      expect(profile.characterBase?.spec).toBeTruthy()
      expect(profile.cover?.ratio).toBe('3:4')
      expect(profile.negatives.shared).toBeTruthy()
    }
  })

  test('"none" disables anchoring instead of erroring', async () => {
    const { maybeLoadProfile } = await import('../src/lib/profile.js')
    expect(await maybeLoadProfile(work, './prompts/profiles', 'none')).toBeUndefined()
  })

  test('an unknown profile fails loudly with the available location', async () => {
    const { loadProfile } = await import('../src/lib/profile.js')
    await expect(loadProfile(work, './prompts/profiles', 'nope')).rejects.toThrow(/not found/)
  })
})

describe('libtv speech adapter', () => {
  test('sends the voice id under the schema field the model actually wants', async () => {
    const { bin, argsFile } = await fakeLibtv('tts', 'https://cdn/a.mp3')
    const port = (await libtvSpeech.create({ bin, canvas: 'c' }, deps())) as SpeechPort

    await port.synthesize({ text: '你看见了什么', voice: 'male-qn-jingying', idempotencyKey: 'k', label: 's1' })

    const args = await argsOf(argsFile)
    // Not `voice=`: the schema exposes it as voice_setting_voice_id.
    expect(args).toContain('voice_setting_voice_id=male-qn-jingying')
    expect(args).toContain('-t')
    expect(args).toContain('audio')
    // The model needs its catalogue scene named explicitly.
    expect(args).toContain('scene=Text-to-Speech')
  })

  test('clamps speed into the range the provider accepts', async () => {
    const { bin, argsFile } = await fakeLibtv('tts-speed', 'https://cdn/b.mp3')
    const port = (await libtvSpeech.create({ bin, canvas: 'c' }, deps())) as SpeechPort

    await port.synthesize({ text: 'x', speed: 9, idempotencyKey: 'k' })
    expect(await argsOf(argsFile)).toContain('speed=2')
  })

  test('omits the voice field entirely when none is cast', async () => {
    const { bin, argsFile } = await fakeLibtv('tts-novoice', 'https://cdn/c.mp3')
    const port = (await libtvSpeech.create({ bin, canvas: 'c' }, deps())) as SpeechPort

    await port.synthesize({ text: 'x', idempotencyKey: 'k' })
    expect((await argsOf(argsFile)).some((a) => a.startsWith('voice_setting_voice_id='))).toBe(false)
  })

  test('carries the voice through on the returned asset, for later audit', async () => {
    const { bin } = await fakeLibtv('tts-meta', 'https://cdn/d.mp3')
    const port = (await libtvSpeech.create({ bin, canvas: 'c' }, deps())) as SpeechPort

    const [asset] = await port.synthesize({ text: 'x', voice: 'female-yujie', idempotencyKey: 'k' })
    expect(asset?.meta['voice']).toBe('female-yujie')
    expect(asset?.uri).toBe('https://cdn/d.mp3')
  })
})
