import { describe, expect, test, vi } from 'vitest'
import {
  AUDIO_MAX_SECONDS,
  AUDIO_MIN_SECONDS,
  audioIsRegisterable,
  checkAssets,
  registerAsset,
} from '../src/lib/compliance.js'

/**
 * The register is the gate on lip-sync: get it wrong and Seedance refuses the
 * shot after the picture is already paid for. Two behaviours matter — a rate
 * limit is a wait rather than a failure, and audio outside the platform's
 * duration window is refused locally instead of burning a submission slot.
 */

const creds = { token: 't', webid: 'w', projectUuid: 'p' }

const jsonOnce = (...bodies: readonly unknown[]) => {
  let i = 0
  return vi.fn(async () => ({ json: async () => bodies[Math.min(i++, bodies.length - 1)] })) as unknown as typeof fetch
}

describe('duration window', () => {
  test('a one-word retort is refused before it costs a submission', () => {
    // "好!" at 0.8s — DurationTooShort, and no amount of retrying changes it.
    expect(audioIsRegisterable(0.8)).toBe(false)
  })

  test('a long lecture is refused too', () => {
    expect(audioIsRegisterable(43.2)).toBe(false)
  })

  test('the boundaries themselves are allowed', () => {
    expect(audioIsRegisterable(AUDIO_MIN_SECONDS)).toBe(true)
    expect(audioIsRegisterable(AUDIO_MAX_SECONDS)).toBe(true)
  })

  test('an ordinary line passes', () => {
    expect(audioIsRegisterable(4.47)).toBe(true)
  })
})

describe('registering', () => {
  test('a success reports the uuid', async () => {
    const fetchImpl = jsonOnce({ code: 0, data: { uuid: 'abc' } })
    await expect(registerAsset('u', 'audio', creds, { fetchImpl })).resolves.toEqual({
      ok: true,
      uuid: 'abc',
    })
  })

  test('a rate limit is waited out, not reported as failure', async () => {
    const fetchImpl = jsonOnce({ code: 10026, msg: '提交较频繁' }, { code: 0, data: { uuid: 'ok' } })
    const result = await registerAsset('u', 'audio', creds, { fetchImpl, waitMs: 0 })

    expect(result).toEqual({ ok: true, uuid: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  test('a persistent rate limit eventually gives up, saying so', async () => {
    const fetchImpl = jsonOnce({ code: 10026, msg: '提交较频繁' })
    const result = await registerAsset('u', 'audio', creds, { fetchImpl, waitMs: 0, attempts: 3 })

    expect(result).toEqual({ ok: false, reason: 'rate limited after 3 attempts' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  test('a real error is returned immediately rather than retried', async () => {
    const fetchImpl = jsonOnce({ code: 10002, msg: 'assetUrl is required' })
    const result = await registerAsset('', 'audio', creds, { fetchImpl, waitMs: 0 })

    expect(result).toEqual({ ok: false, reason: 'assetUrl is required' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('the request carries the url and type the register wants', async () => {
    const fetchImpl = jsonOnce({ code: 0, data: {} })
    await registerAsset('https://cdn/a.mp3', 'audio', creds, { fetchImpl })

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      assetUrl: 'https://cdn/a.mp3',
      assetType: 'audio',
    })
  })
})

describe('checking', () => {
  test('a rejection surfaces the platform reason, not just a status number', async () => {
    const fetchImpl = jsonOnce({
      data: {
        list: [
          {
            uuid: 'u1',
            assetUrl: 'https://cdn/short.mp3',
            assetType: 'audio',
            status: 2,
            error_json: { Code: 'InvalidParameter.DurationTooShort' },
          },
        ],
      },
    })
    const [entry] = await checkAssets(['https://cdn/short.mp3'], creds, fetchImpl)

    expect(entry?.status).toBe(2)
    expect(entry?.error?.Code).toBe('InvalidParameter.DurationTooShort')
  })

  test('only the asked-for urls come back', async () => {
    const fetchImpl = jsonOnce({
      data: {
        list: [
          { uuid: 'a', assetUrl: 'https://cdn/mine.mp3', assetType: 'audio', status: 1 },
          { uuid: 'b', assetUrl: 'https://cdn/someone-else.png', assetType: 'image', status: 1 },
        ],
      },
    })
    const rows = await checkAssets(['https://cdn/mine.mp3'], creds, fetchImpl)

    expect(rows.map((r) => r.assetUrl)).toEqual(['https://cdn/mine.mp3'])
  })

  test('an empty ask returns the whole register', async () => {
    const fetchImpl = jsonOnce({
      data: { list: [{ uuid: 'a', assetUrl: 'x', assetType: 'audio', status: 0 }] },
    })
    expect(await checkAssets([], creds, fetchImpl)).toHaveLength(1)
  })
})

describe('a lip-synced clip owns its soundtrack', () => {
  test('renderedClip hands the export the model’s own take, not a dub', async () => {
    const { renderedClip } = await import('../src/kernel/types.js')
    const lipSynced = { id: 's1', clip: { id: 'c' }, lipSynced: true } as never

    // dub never runs on these, so there is no voicedClip to prefer — and if a
    // stale one ever survived, preferring it would undo the synchronisation.
    expect(renderedClip(lipSynced)).toEqual({ id: 'c' })
  })
})

describe('the generator has a tighter ceiling than the register', () => {
  test('the register accepts 26s but a 15s model cannot drive from it', () => {
    // Registering succeeds, then generation fails with "总时长均不可超过 15 秒"
    // and the shot is lost. The lower of the two ceilings is the real one.
    const registerOk = audioIsRegisterable(26.6)
    const modelMax = 15
    expect(registerOk).toBe(true)
    expect(26.6 <= Math.min(AUDIO_MAX_SECONDS, modelMax)).toBe(false)
  })

  test('an ordinary line clears both', () => {
    expect(audioIsRegisterable(4.47) && 4.47 <= Math.min(AUDIO_MAX_SECONDS, 15)).toBe(true)
  })
})
