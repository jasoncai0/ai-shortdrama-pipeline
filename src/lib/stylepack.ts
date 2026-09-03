import { readFile, readdir } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'
import { configError } from '../kernel/errors.js'

/**
 * A style pack is one film school's house look, as data.
 *
 * Three layers, because a style that only rewrites prompts is a style the
 * audience cannot see:
 *
 *  - `look`   — what the generator is told: an anchor prepended to image
 *               prompts, a clause appended to video prompts, and the negatives
 *               that keep the wrong century out of frame.
 *  - `camera` — the school's blocking habits, biasing the shot grammar the
 *               same way `camera-check` lints it.
 *  - `grade`  — the pixels themselves. Prompt text nudges a model; a grade is
 *               deterministic, so the same pack applied twice looks the same
 *               twice. This is the difference between "asked for Shaw Brothers"
 *               and "looks like Shaw Brothers".
 *
 * Packs are JSON under `prompts/styles/`, not code, for the same reason prompt
 * profiles are: this is craft knowledge that gets tuned per project and per
 * model. A new school is a new file; a different styling *mechanism* (LUTs,
 * an img2img pass) is a different middleware or stage plugin.
 */

const gradeSchema = z
  .object({
    /**
     * Width:height of the visible picture window, masked inside the delivery
     * frame with real black bars. The frame size never changes, so every clip
     * in a cut stays the same resolution.
     *
     * Expressed against the *delivery* frame, so a vertical 9:16 short takes a
     * portrait-ish window ("3:4", "4:5") for a masked, cinematic look; "2.35"
     * is the scope value and only makes sense on a landscape delivery.
     */
    aspect: z.string().optional(),
    saturation: z.number().min(0).max(3).optional(),
    contrast: z.number().min(0).max(3).optional(),
    brightness: z.number().min(-1).max(1).optional(),
    gamma: z.number().min(0.1).max(3).optional(),
    /** Per-channel lift/gamma/gain, -1..1, as ffmpeg colorbalance takes them. */
    colorBalance: z
      .object({
        shadowsRed: z.number().min(-1).max(1).optional(),
        shadowsBlue: z.number().min(-1).max(1).optional(),
        midtonesRed: z.number().min(-1).max(1).optional(),
        midtonesBlue: z.number().min(-1).max(1).optional(),
        highlightsRed: z.number().min(-1).max(1).optional(),
        highlightsBlue: z.number().min(-1).max(1).optional(),
      })
      .optional(),
    /** Film grain strength, 0–100 in ffmpeg's `noise` terms. */
    grain: z.number().min(0).max(100).optional(),
    vignette: z.boolean().optional(),
    /** Extra raw ffmpeg filters, appended last. The escape hatch. */
    extraFilters: z.array(z.string()).optional(),
  })
  .strict()

export const stylePackSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** Where the look was studied from — packs make claims about real films. */
    source: z.string().optional(),
    look: z
      .object({
        image: z.string().optional(),
        video: z.string().optional(),
        negatives: z.string().optional(),
      })
      .strict()
      .default({}),
    camera: z
      .object({
        /** Moves this school actually uses; `style-check` reports the rest. */
        preferredMoves: z.array(z.string()).default([]),
        /** Appended to video prompts, e.g. "hold the frame, let the actor move". */
        clause: z.string().optional(),
      })
      .strict()
      .default({ preferredMoves: [] }),
    pacing: z
      .object({
        shotSeconds: z.number().min(1).max(30).optional(),
        note: z.string().optional(),
      })
      .strict()
      .optional(),
    grade: gradeSchema.optional(),
    notes: z.string().optional(),
  })
  .strict()

export type StylePack = z.infer<typeof stylePackSchema>
export type StyleGrade = z.infer<typeof gradeSchema>

export const loadStylePack = async (
  cwd: string,
  dir: string,
  name: string,
): Promise<StylePack> => {
  const base = isAbsolute(dir) ? dir : resolve(cwd, dir)
  const path = name.endsWith('.json') ? resolve(base, name) : join(base, `${name}.json`)

  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    const available = await listStylePacks(cwd, dir)
    throw configError(
      `Style pack "${name}" not found at ${path}.`,
      available.length > 0
        ? `Available packs: ${available.join(', ')}`
        : `Put packs in ${base}, or set the option "dir".`,
    )
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw configError(`Style pack ${path} is not valid JSON: ${String(error)}`)
  }

  const parsed = stylePackSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw configError(`Style pack ${path} failed validation:\n${issues}`)
  }
  return parsed.data
}

export const listStylePacks = async (cwd: string, dir: string): Promise<readonly string[]> => {
  const base = isAbsolute(dir) ? dir : resolve(cwd, dir)
  try {
    return (await readdir(base))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort()
  } catch {
    return []
  }
}

/**
 * The ffmpeg filter chain for a grade, or `undefined` when the pack asks for
 * nothing — in which case the caller must stream-copy rather than re-encode a
 * picture for no reason.
 *
 * Order is deliberate: geometry, then colour, then texture. Grain added before
 * a contrast push gets crushed; a vignette applied before letterboxing darkens
 * the bars instead of the picture.
 */
export const buildGradeFilter = (grade: StyleGrade | undefined): string | undefined => {
  if (!grade) return undefined
  const filters: string[] = []

  const mask = letterboxFilter(grade.aspect)
  if (mask) filters.push(mask)

  const eq: string[] = []
  if (grade.contrast !== undefined) eq.push(`contrast=${grade.contrast}`)
  if (grade.brightness !== undefined) eq.push(`brightness=${grade.brightness}`)
  if (grade.saturation !== undefined) eq.push(`saturation=${grade.saturation}`)
  if (grade.gamma !== undefined) eq.push(`gamma=${grade.gamma}`)
  if (eq.length > 0) filters.push(`eq=${eq.join(':')}`)

  const cb = grade.colorBalance
  if (cb) {
    const parts: string[] = []
    if (cb.shadowsRed !== undefined) parts.push(`rs=${cb.shadowsRed}`)
    if (cb.shadowsBlue !== undefined) parts.push(`bs=${cb.shadowsBlue}`)
    if (cb.midtonesRed !== undefined) parts.push(`rm=${cb.midtonesRed}`)
    if (cb.midtonesBlue !== undefined) parts.push(`bm=${cb.midtonesBlue}`)
    if (cb.highlightsRed !== undefined) parts.push(`rh=${cb.highlightsRed}`)
    if (cb.highlightsBlue !== undefined) parts.push(`bh=${cb.highlightsBlue}`)
    if (parts.length > 0) filters.push(`colorbalance=${parts.join(':')}`)
  }

  if (grade.vignette) filters.push('vignette')
  if (grade.grain) filters.push(`noise=alls=${Math.round(grade.grain)}:allf=t+u`)
  if (grade.extraFilters) filters.push(...grade.extraFilters)

  return filters.length > 0 ? filters.join(',') : undefined
}

/**
 * The mask bars as their own filter.
 *
 * Bars are drawn over the picture rather than cropped-and-padded so the output
 * keeps the delivery resolution exactly — a cut assembled by the concat
 * demuxer refuses clips whose dimensions disagree.
 */
export const letterboxFilter = (aspect: string | undefined): string | undefined => {
  const ratio = parseAspect(aspect)
  if (ratio === undefined) return undefined
  // Keep the frame size; blank the top and bottom to the target ratio. Drawing
  // bars rather than cropping keeps every delivery at the same resolution,
  // which matters when the cut is assembled from clips of one size.
  return `drawbox=x=0:y=0:w=iw:h=(ih-iw/${ratio})/2:color=black@1:t=fill,` +
    `drawbox=x=0:y=ih-(ih-iw/${ratio})/2:w=iw:h=(ih-iw/${ratio})/2:color=black@1:t=fill`
}

const parseAspect = (aspect: string | undefined): number | undefined => {
  if (!aspect) return undefined
  const colon = aspect.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/)
  if (colon) {
    const w = Number(colon[1])
    const h = Number(colon[2])
    return h > 0 ? w / h : undefined
  }
  const plain = Number(aspect)
  return Number.isFinite(plain) && plain > 0 ? plain : undefined
}
