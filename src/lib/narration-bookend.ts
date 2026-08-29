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
   * Move the two survivors to the very ends of the cut.
   *
   * Keeping them where the script put them is still "only two lines", but a
   * line 17% in is not an opening. Relocated inserts are re-pictured to the
   * scene they now sit against, so the prologue looks like the place the story
   * starts and the epilogue like the place it ends.
   */
  readonly relocate: boolean
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

export const DEFAULT_BOOKEND: BookendOptions = { headShots: 3, tailShots: 3, relocate: true }

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
  sceneNameById: ReadonlyMap<string, string> = new Map(),
): BookendResult => {
  const opts = { ...DEFAULT_BOOKEND, ...options }
  const total = shots.length

  const carriers = shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => Boolean(shot.narration?.trim()))

  if (carriers.length === 0) return { shots, removedInserts: 0, strippedBeats: 0 }

  // The opening and the closing are the two the merged cut keeps, wherever
  // they happen to sit: a window test alone deletes every line when the
  // script puts none in the first or last few shots, which is not "bookends",
  // it is silence.
  const keep = new Set<number>([
    carriers[0]!.index,
    carriers[carriers.length - 1]!.index,
  ])
  // Anything genuinely inside the opening or closing run stays too — those
  // read as part of the same breath rather than an interruption.
  for (const { index } of carriers) {
    if (index < opts.headShots || index >= total - opts.tailShots) keep.add(index)
  }

  let removedInserts = 0
  let strippedBeats = 0

  const kept = shots.flatMap((shot, index) => {
    if (!shot.narration || keep.has(index)) return [shot]

    if (isNarrationInsert(shot)) {
      removedInserts += 1
      return []
    }

    strippedBeats += 1
    const { narration: _dropped, ...rest } = shot
    return [rest as Shot]
  })

  const placed = opts.relocate ? relocateToEnds(kept, sceneNameById) : kept

  // Order fields are the cut's own numbering, so they are renumbered per
  // episode after a removal — a gap in `order` breaks the export sort.
  const perEpisode = new Map<string, number>()
  const renumbered = placed.map((shot) => {
    const next = (perEpisode.get(shot.episodeId) ?? 0) + 1
    perEpisode.set(shot.episodeId, next)
    return shot.order === next ? shot : { ...shot, order: next }
  })

  return { shots: renumbered, removedInserts, strippedBeats }
}

/** Re-pictures a moved insert so it shows where it now sits. */
const repicture = (insert: Shot, neighbour: Shot, sceneNameById: ReadonlyMap<string, string>): Shot => {
  const sceneId = neighbour.sceneId
  const sceneName = sceneId ? sceneNameById.get(sceneId) : undefined
  return {
    ...insert,
    episodeId: neighbour.episodeId,
    ...(sceneId ? { sceneId } : {}),
    lightingAndAtmosphere: neighbour.lightingAndAtmosphere,
    ...(sceneName
      ? { plotDescription: `${sceneName}的空镜留白, 无人物, 环境静物与光线` }
      : {}),
  }
}

/**
 * Lifts the first and last narration inserts out of the body and re-seats them
 * at the head and tail of the cut. Inserts only: a story beat cannot be moved
 * without breaking the scene it belongs to, so one carrying narration stays
 * where it is.
 */
const relocateToEnds = (
  shots: readonly Shot[],
  sceneNameById: ReadonlyMap<string, string>,
): readonly Shot[] => {
  const movable = shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => isNarrationInsert(shot) && Boolean(shot.narration?.trim()))

  if (movable.length === 0) return shots

  const first = movable[0]!
  const last = movable[movable.length - 1]!
  const lifted = new Set<number>([first.index, last.index])
  const body = shots.filter((_shot, index) => !lifted.has(index))
  if (body.length === 0) return shots

  const head = repicture(first.shot, body[0]!, sceneNameById)
  const tail =
    last.index === first.index
      ? undefined
      : repicture(last.shot, body[body.length - 1]!, sceneNameById)

  return tail ? [head, ...body, tail] : [head, ...body]
}
