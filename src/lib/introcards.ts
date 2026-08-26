import { renderedClip, type Character, type Project, type Shot } from '../kernel/types.js'

/**
 * Works out who to introduce, where, and for how long.
 *
 * Pure and separate from rendering because the interesting decisions are all
 * here — which shot counts as a first appearance, whether two characters
 * entering together should stack up on screen, what happens when a shot is too
 * short to read a card in — and each of them is a thing that can be wrong in a
 * way no screenshot would reveal.
 */

export interface IntroPlacement {
  readonly characterId: string
  readonly name: string
  readonly epithet?: string
  readonly shotId: string
  /** Seconds from the start of the cut. */
  readonly startSeconds: number
  readonly endSeconds: number
  readonly side: 'left' | 'right'
}

export interface PlanOptions {
  /** How long a card stays up, budget permitting. */
  readonly holdSeconds: number
  /** Delay after the shot starts, so the card does not clash with the cut. */
  readonly delaySeconds: number
  /** A card shorter than this is not worth showing; the character waits. */
  readonly minReadableSeconds: number
  /** `alternate` reads better than a fixed side when two people meet. */
  readonly side: 'left' | 'right' | 'alternate'
  /** Characters to skip — extras nobody needs introduced. */
  readonly skip: readonly string[]
  /** At most this many cards on screen at once. */
  readonly maxConcurrent: number
}

export const DEFAULT_PLAN: PlanOptions = {
  holdSeconds: 2.5,
  delaySeconds: 0.4,
  minReadableSeconds: 1.2,
  side: 'alternate',
  skip: [],
  maxConcurrent: 1,
}

/** Shots in the order `export` concatenates them, with a rendered clip. */
export const orderedShots = (project: Project): readonly Shot[] =>
  [...project.shots]
    .filter((s) => renderedClip(s))
    .sort((a, b) => {
      const byEpisode = a.episodeId.localeCompare(b.episodeId)
      return byEpisode !== 0 ? byEpisode : a.order - b.order
    })

export interface PlanInput {
  readonly project: Project
  /** Measured runtime per ordered shot — never the requested duration. */
  readonly durations: readonly number[]
  readonly options: PlanOptions
}

export interface PlanResult {
  readonly placements: readonly IntroPlacement[]
  /** Reported, not swallowed: a character nobody sees introduced is a bug. */
  readonly notes: readonly string[]
}

export const planIntroCards = ({ project, durations, options }: PlanInput): PlanResult => {
  const shots = orderedShots(project)
  const notes: string[] = []
  const placements: IntroPlacement[] = []
  const introduced = new Set<string>()
  const skip = new Set(options.skip)

  // Running offset over measured durations, exactly as the subtitles do — the
  // cut is the sum of what the clips actually are, not what was asked for.
  let offset = 0
  let sideFlip = 0

  shots.forEach((shot, index) => {
    const shotStart = offset
    const shotSeconds = durations[index] ?? 0
    offset += shotSeconds

    const entering = shot.characterIds
      .filter((id) => !introduced.has(id) && !skip.has(id))
      .map((id) => project.characters.find((c) => c.id === id))
      .filter((c): c is Character => Boolean(c))

    if (entering.length === 0) return

    // Two people entering on the same shot would overlap into an unreadable
    // stack, so the rest wait for their next appearance rather than being
    // crammed in or silently dropped.
    const shown = entering.slice(0, Math.max(1, options.maxConcurrent))
    const deferred = entering.slice(shown.length)
    for (const character of deferred) {
      notes.push(
        `${character.name} enters on ${shot.id} alongside ${shown.map((c) => c.name).join(', ')}; card deferred to their next shot`,
      )
    }

    const available = shotSeconds - options.delaySeconds
    if (available < options.minReadableSeconds) {
      notes.push(
        `${shot.id} is ${shotSeconds.toFixed(1)}s — too short to read a card; ${shown
          .map((c) => c.name)
          .join(', ')} deferred`,
      )
      return
    }

    for (const character of shown) {
      introduced.add(character.id)
      const start = shotStart + options.delaySeconds
      const end = start + Math.min(options.holdSeconds, available)
      const side =
        options.side === 'alternate' ? (sideFlip++ % 2 === 0 ? 'right' : 'left') : options.side

      placements.push({
        characterId: character.id,
        name: character.name,
        epithet: character.epithet,
        shotId: shot.id,
        startSeconds: start,
        endSeconds: end,
        side,
      })
    }
  })

  const missed = project.characters.filter(
    (c) => !introduced.has(c.id) && !skip.has(c.id) && appearsAnywhere(c.id, shots),
  )
  for (const character of missed) {
    notes.push(`${character.name} appears but never got a card — every shot they are in is too short`)
  }

  return { placements, notes }
}

const appearsAnywhere = (id: string, shots: readonly Shot[]): boolean =>
  shots.some((s) => s.characterIds.includes(id))
