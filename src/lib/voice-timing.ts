import type { Shot } from '../kernel/types.js'

/**
 * Fits every shot to the line it has to carry, measured rather than estimated.
 *
 * The pipeline used to guess: `spokenSeconds` counted characters at a fixed
 * rate and clamped the result to `maxShotSeconds`. Both halves were wrong in
 * production. The rate was 40% fast — a 154-character speech billed at 5
 * characters a second needs 31s and actually took 43 — and the clamp meant a
 * long line was *guaranteed* to outrun its picture. The mix then cut the voice
 * at the end of the shot, so a speech stopped mid-sentence and the next shot
 * began someone else's line. Short lines had the opposite fault: 「是。」 is
 * 0.8s of speech under a 4s clip, leaving three seconds of a character moving
 * in silence.
 *
 * So the voice is synthesised first and the shot is cut to it. What remains is
 * arithmetic over real durations: no model in the loop, nothing to estimate.
 */

export interface TimingOptions {
  /** Shortest clip the video model will generate. */
  readonly minSeconds: number
  /** Longest clip the video model will generate. */
  readonly maxSeconds: number
  /**
   * Breath after the last syllable. Cutting on the final consonant sounds
   * clipped even when the audio is complete.
   */
  readonly tailPadSeconds: number
}

export const DEFAULT_TIMING: TimingOptions = {
  minSeconds: 4,
  maxSeconds: 15,
  tailPadSeconds: 0.6,
}

export interface TimedShot {
  readonly shotId: string
  readonly speechSeconds: number
  readonly planned: number
  /** Speech longer than the model's ceiling: the picture cannot cover it. */
  readonly overflow: boolean
}

export interface TimingResult {
  readonly shots: readonly Shot[]
  readonly timed: readonly TimedShot[]
  /** Shots whose line is longer than any clip the model can make. */
  readonly overflowing: readonly TimedShot[]
}

/**
 * `speechSeconds` maps shot id → measured duration of that shot's synthesised
 * line. A shot missing from the map keeps whatever duration it had: silent
 * beats and inserts are paced by the edit, not by a voice.
 */
export const fitShotsToVoice = (
  shots: readonly Shot[],
  speechSeconds: ReadonlyMap<string, number>,
  options: Partial<TimingOptions> = {},
): TimingResult => {
  const opts = { ...DEFAULT_TIMING, ...options }
  const timed: TimedShot[] = []

  const out = shots.map((shot) => {
    const speech = speechSeconds.get(shot.id)
    if (speech === undefined || speech <= 0) return shot

    const wanted = speech + opts.tailPadSeconds
    const planned = Math.min(Math.max(Math.ceil(wanted), opts.minSeconds), opts.maxSeconds)
    timed.push({
      shotId: shot.id,
      speechSeconds: speech,
      planned,
      overflow: wanted > opts.maxSeconds,
    })

    return shot.durationSeconds === planned ? shot : { ...shot, durationSeconds: planned }
  })

  return { shots: out, timed, overflowing: timed.filter((t) => t.overflow) }
}
