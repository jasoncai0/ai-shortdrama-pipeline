import type { Shot } from '../kernel/types.js'

/**
 * Confines narration to the opening and closing of a merged cut.
 *
 * The pacing pass places narration per episode, which is right when each
 * episode ships on its own. Merge five episodes into one video and the same
 * rule scatters a voice-over through the middle every couple of minutes: the
 * story keeps stopping to be explained to. In a merged cut the narrator earns
 * a place in exactly two spots — setting the premise before the drama starts,
 * and closing it after the drama ends.
 *
 * A narration insert exists only to carry its line, so one outside the
 * bookends is dropped whole rather than left as a silent shot of sky. A story
 * beat that somehow carries narration keeps its picture and loses the words.
 *
 * Pure and deterministic: shots in, shots out, nothing mutated.
 */

export interface BookendOptions {
  /**
   * How many shots at each end count as "the opening" / "the closing".
   *
   * Counted in shots rather than seconds because that is what the caller can
   * verify by eye in the shot list, and a breathing insert's duration is not
   * final until the dub stage measures the spoken line.
   */
  readonly headShots: number
  readonly tailShots: number
}

export const DEFAULT_BOOKEND: BookendOptions = { headShots: 3, tailShots: 3 }

export interface BookendResult {
  readonly shots: readonly Shot[]
  /** Narration insert shots removed entirely. */
  readonly removedInserts: number
  /** Story beats that kept their picture but lost a narration line. */
  readonly strippedBeats: number
}

const isNarrationInsert = (shot: Shot): boolean =>
  shot.kind === 'insert' && shot.insertRole === 'narration'

/**
 * `shots` must already be in final playback order — the merged cut's order,
 * across every episode. Ordering is the caller's job because only the caller
 * knows how the episodes are concatenated.
 */
export const bookendNarration = (
  shots: readonly Shot[],
  options: Partial<BookendOptions> = {},
): BookendResult => {
  const opts = { ...DEFAULT_BOOKEND, ...options }
  const total = shots.length

  // Overlapping windows on a very short cut would let everything through,
  // which is the correct reading of "the whole thing is the opening".
  const inBookend = (index: number): boolean =>
    index < opts.headShots || index >= total - opts.tailShots

  let removedInserts = 0
  let strippedBeats = 0

  const kept = shots.flatMap((shot, index) => {
    if (!shot.narration || inBookend(index)) return [shot]

    if (isNarrationInsert(shot)) {
      removedInserts += 1
      return []
    }

    strippedBeats += 1
    const { narration: _dropped, ...rest } = shot
    return [rest as Shot]
  })

  // Order fields are the cut's own numbering, so they are renumbered per
  // episode after a removal — a gap in `order` breaks the export sort.
  const perEpisode = new Map<string, number>()
  const renumbered = kept.map((shot) => {
    const next = (perEpisode.get(shot.episodeId) ?? 0) + 1
    perEpisode.set(shot.episodeId, next)
    return shot.order === next ? shot : { ...shot, order: next }
  })

  return { shots: renumbered, removedInserts, strippedBeats }
}
