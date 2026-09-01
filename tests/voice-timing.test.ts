import { describe, expect, test } from 'vitest'
import { fitShotsToVoice } from '../src/lib/voice-timing.js'
import type { Shot } from '../src/kernel/types.js'

/**
 * Measured against the real failure: a 154-character speech was billed at 5
 * characters a second (31s), clamped to a 12s shot, and took 43s to say. The
 * mix cut it at 12s, so the speech stopped mid-sentence and the next shot
 * began someone else's line. The opposite fault was just as common: 「是。」
 * is 0.8s of speech under a 4s clip — three seconds of a character moving in
 * silence.
 */

const shot = (id: string, durationSeconds: number, over: Partial<Shot> = {}): Shot =>
  ({ id, episodeId: 'ep1', order: 1, durationSeconds, ...over }) as unknown as Shot

const opts = { minSeconds: 4, maxSeconds: 15, tailPadSeconds: 0.6 }

describe('a shot is cut to the line it carries', () => {
  test('a long line gets a long shot instead of being cut off', () => {
    const { shots } = fitShotsToVoice([shot('s1', 12)], new Map([['s1', 13.2]]), opts)
    expect(shots[0]?.durationSeconds).toBe(14)
  })

  test('a short line gets a short shot instead of trailing silence', () => {
    const { shots } = fitShotsToVoice([shot('s1', 12)], new Map([['s1', 0.8]]), opts)
    // The model's own floor, not 12s of someone moving without a voice.
    expect(shots[0]?.durationSeconds).toBe(4)
  })

  test('the tail pad means a shot never cuts on the final consonant', () => {
    const { shots } = fitShotsToVoice([shot('s1', 4)], new Map([['s1', 6.0]]), opts)
    expect(shots[0]?.durationSeconds).toBe(7)
  })

  test('a line longer than any clip the model makes is reported, not silently clipped', () => {
    const { shots, overflowing } = fitShotsToVoice([shot('s1', 12)], new Map([['s1', 43.2]]), opts)

    expect(shots[0]?.durationSeconds).toBe(15)
    expect(overflowing.map((o) => o.shotId)).toEqual(['s1'])
    expect(overflowing[0]?.speechSeconds).toBe(43.2)
  })

  test('a line that fits exactly is not flagged', () => {
    const { overflowing } = fitShotsToVoice([shot('s1', 12)], new Map([['s1', 14.0]]), opts)
    expect(overflowing).toEqual([])
  })
})

describe('shots with no line are left to the edit', () => {
  test('a silent beat keeps the duration the pacing pass gave it', () => {
    const { shots, timed } = fitShotsToVoice([shot('quiet', 9)], new Map(), opts)

    expect(shots[0]?.durationSeconds).toBe(9)
    expect(timed).toEqual([])
  })

  test('a measured zero is treated as no line, not a zero-length shot', () => {
    const { shots } = fitShotsToVoice([shot('s1', 9)], new Map([['s1', 0]]), opts)
    expect(shots[0]?.durationSeconds).toBe(9)
  })

  test('an unchanged shot is not rewritten', () => {
    const input = [shot('s1', 4)]
    const { shots } = fitShotsToVoice(input, new Map([['s1', 3.0]]), opts)
    expect(shots[0]).toBe(input[0])
  })
})

describe('the model’s limits come from the model', () => {
  test('a model with a wider range gets the longer shot', () => {
    const { shots, overflowing } = fitShotsToVoice([shot('s1', 12)], new Map([['s1', 20.0]]), {
      ...opts,
      maxSeconds: 30,
    })

    expect(shots[0]?.durationSeconds).toBe(21)
    expect(overflowing).toEqual([])
  })

  test('a model with a higher floor lifts the short shots', () => {
    const { shots } = fitShotsToVoice([shot('s1', 4)], new Map([['s1', 1.0]]), {
      ...opts,
      minSeconds: 6,
    })
    expect(shots[0]?.durationSeconds).toBe(6)
  })
})
