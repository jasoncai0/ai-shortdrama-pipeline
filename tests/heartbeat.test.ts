import { describe, expect, test, vi } from 'vitest'
import { withHeartbeat } from '../src/plugins/stage/shared.js'

/**
 * The composite stages make one long ffmpeg call each, so they have nothing to
 * report per item — and the watchdog read that silence as a hang, failing a
 * stage whose output landed two seconds later.
 */

const collector = () => {
  const events: { event: string; payload?: unknown }[] = []
  return { events, ctx: { emit: (event: string, payload?: unknown) => events.push({ event, payload }) } }
}

describe('withHeartbeat', () => {
  test('beats while the work is pending, and the beats are progress events', async () => {
    vi.useFakeTimers()
    const { events, ctx } = collector()
    let resolve!: (v: string) => void
    const work = new Promise<string>((r) => { resolve = r })

    const guarded = withHeartbeat(ctx, 'mixing', work, 1000)
    await vi.advanceTimersByTimeAsync(3500)
    expect(events).toHaveLength(3)
    expect(events[0]?.event).toBe('progress')
    expect(String((events[0]?.payload as { note: string }).note)).toContain('mixing')

    resolve('done')
    await expect(guarded).resolves.toBe('done')
    vi.useRealTimers()
  })

  test('stops beating once the work settles — a dead call must still time out', async () => {
    vi.useFakeTimers()
    const { events, ctx } = collector()

    await withHeartbeat(ctx, 'x', Promise.resolve(1), 1000)
    await vi.advanceTimersByTimeAsync(5000)

    expect(events).toHaveLength(0)
    vi.useRealTimers()
  })

  test('a rejecting call stops the beats and propagates', async () => {
    vi.useFakeTimers()
    const { events, ctx } = collector()

    await expect(withHeartbeat(ctx, 'x', Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom')
    await vi.advanceTimersByTimeAsync(5000)

    expect(events).toHaveLength(0)
    vi.useRealTimers()
  })
})
