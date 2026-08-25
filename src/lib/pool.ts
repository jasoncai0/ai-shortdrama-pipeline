/**
 * Bounded-concurrency map that never rejects: each item resolves to either
 * `{ ok: true, value }` or `{ ok: false, error }`. One failed shot must not
 * abort the other seven.
 */

export type Settled<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown }

export const mapPool = async <I, O>(
  items: readonly I[],
  limit: number,
  worker: (item: I, index: number) => Promise<O>,
): Promise<readonly Settled<O>[]> => {
  if (items.length === 0) return []
  const width = Math.max(1, Math.min(limit, items.length))
  const results = new Array<Settled<O>>(items.length)
  let cursor = 0

  const runner = async (): Promise<void> => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      const item = items[index] as I
      try {
        results[index] = { ok: true, value: await worker(item, index) }
      } catch (error) {
        results[index] = { ok: false, error }
      }
    }
  }

  await Promise.all(Array.from({ length: width }, runner))
  return results
}
