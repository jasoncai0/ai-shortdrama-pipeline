/**
 * SRT generation.
 *
 * Kept as a pure function because subtitle timing is the kind of thing that
 * breaks quietly — an off-by-one in the index, a comma where a full stop
 * belongs in the timestamp, an overlap that makes two cues fight — and none of
 * that is visible until someone watches the whole cut.
 */

export interface SubtitleEntry {
  /** Seconds from the start of the cut. */
  readonly start: number
  readonly end: number
  readonly text: string
}

/** `HH:MM:SS,mmm` — SRT wants a comma before the milliseconds, not a period. */
export const formatTimestamp = (seconds: number): string => {
  const clamped = Math.max(0, seconds)
  const totalMs = Math.round(clamped * 1000)
  const ms = totalMs % 1000
  const totalSeconds = (totalMs - ms) / 1000
  const s = totalSeconds % 60
  const totalMinutes = (totalSeconds - s) / 60
  const m = totalMinutes % 60
  const h = (totalMinutes - m) / 60

  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

export interface SrtOptions {
  /** Shortest a cue may stay up, so a one-word line is still readable. */
  readonly minCueSeconds: number
  /** Gap left between adjacent cues so they never overlap. */
  readonly gapSeconds: number
  /** Wrap长 lines; 0 disables. */
  readonly maxCharsPerLine: number
}

const DEFAULTS: SrtOptions = { minCueSeconds: 0.8, gapSeconds: 0.04, maxCharsPerLine: 20 }

export const buildSrt = (
  entries: readonly SubtitleEntry[],
  options: Partial<SrtOptions> = {},
): string => {
  const opts = { ...DEFAULTS, ...options }
  const usable = entries.filter((e) => e.text.trim().length > 0)

  const blocks = usable.map((entry, index) => {
    const next = usable[index + 1]
    // Never let a cue run into the next one: overlapping SRT entries render as
    // two stacked lines in most players.
    const hardEnd = next ? Math.min(entry.end, next.start - opts.gapSeconds) : entry.end
    const end = Math.max(hardEnd, entry.start + opts.minCueSeconds)

    return [
      String(index + 1),
      `${formatTimestamp(entry.start)} --> ${formatTimestamp(end)}`,
      wrap(entry.text.trim(), opts.maxCharsPerLine),
      '',
    ].join('\n')
  })

  return blocks.join('\n')
}

/**
 * Wraps on width, counting CJK as one character.
 *
 * Splitting on spaces alone leaves a full line of Chinese dialogue unwrapped,
 * which on a 9:16 frame runs off both edges.
 */
export const wrap = (text: string, maxChars: number): string => {
  if (maxChars <= 0 || text.length <= maxChars) return text

  const hasSpaces = /\s/.test(text)
  if (hasSpaces) {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      if (line.length === 0) line = word
      else if (line.length + 1 + word.length <= maxChars) line = `${line} ${word}`
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines.join('\n')
  }

  const lines: string[] = []
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars))
  }
  return lines.join('\n')
}
