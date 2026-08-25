import { readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'
import { configError } from '../kernel/errors.js'

/**
 * Camera grammar: a controlled vocabulary that turns a director's shorthand
 * ("slow dolly-in") into the observable physics a video model can actually
 * reproduce ("travels forward at a constant slow walking pace, subject
 * distance decreasing steadily, focal length unchanged").
 *
 * The point is repeatability. "Cinematic" and "smooth" are style words whose
 * implied speed changes between generations, so two shots asking for the same
 * move get two different moves. Physical phrasing is the fix.
 *
 * Everything here is pure and data-driven — the vocabulary lives in
 * `prompts/camera/grammar.json` and is editable without a rebuild.
 */

const moveSchema = z.object({
  aliases: z.array(z.string()).default([]),
  phrase: z.string().min(1),
})

export const cameraGrammarSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.string().optional(),
  why: z.string().optional(),
  moves: z.record(moveSchema),
  vagueTerms: z.array(z.string()).default([]),
  clauses: z
    .object({
      oneDominantMove: z.string().optional(),
      noEditing: z.string().optional(),
      noEaseOut: z.string().optional(),
      alreadyMoving: z.string().optional(),
    })
    .default({}),
})

export type CameraGrammar = z.infer<typeof cameraGrammarSchema>

export const loadCameraGrammar = async (
  cwd: string,
  path: string,
): Promise<CameraGrammar> => {
  const abs = isAbsolute(path) ? path : resolve(cwd, path)
  const file = abs.endsWith('.json') ? abs : join(abs, 'grammar.json')

  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch {
    throw configError(
      `Camera grammar not found at ${file}.`,
      'The shipped vocabulary is prompts/camera/grammar.json. Point `grammar` at it, or disable the camera plugin.',
    )
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw configError(`Camera grammar ${file} is not valid JSON: ${String(error)}`)
  }

  const parsed = cameraGrammarSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw configError(`Camera grammar ${file} failed validation:\n${issues}`)
  }
  return parsed.data
}

export interface CameraMatch {
  /** Canonical move id, e.g. "dolly-in". */
  readonly id: string
  readonly phrase: string
  /** The text that matched — the alias or the id itself. */
  readonly matched: string
}

const normalize = (text: string): string => text.toLowerCase().replace(/[_\s]+/g, '-')

/**
 * Finds every known move mentioned in a phrase, longest match first so
 * "slow dolly-in" resolves to `dolly-in` rather than partially matching a
 * shorter alias of a different move.
 */
export const matchMoves = (
  text: string,
  grammar: CameraGrammar,
): readonly CameraMatch[] => {
  const haystack = normalize(text)
  const candidates: CameraMatch[] = []

  for (const [id, move] of Object.entries(grammar.moves)) {
    const needles = [id, ...move.aliases]
      .map((n) => ({ raw: n, norm: normalize(n) }))
      .sort((a, b) => b.norm.length - a.norm.length)

    const hit = needles.find((n) => haystack.includes(n.norm))
    if (hit) candidates.push({ id, phrase: move.phrase, matched: hit.raw })
  }

  // A longer alias of one move can contain a shorter alias of another
  // ("tracking shot" contains "track"); keep the more specific match.
  return candidates.filter(
    (c) =>
      !candidates.some(
        (other) => other.id !== c.id && normalize(other.matched).includes(normalize(c.matched)),
      ),
  )
}

export const findVagueTerms = (
  text: string,
  grammar: CameraGrammar,
): readonly string[] => {
  const haystack = text.toLowerCase()
  return grammar.vagueTerms.filter((term) => haystack.includes(term.toLowerCase()))
}

export interface CameraVerdict {
  readonly moves: readonly CameraMatch[]
  readonly vague: readonly string[]
  /** Canonical physical phrasing, or undefined when nothing was recognised. */
  readonly phrase?: string
  readonly problems: readonly string[]
}

/**
 * Judges one shot's camera description.
 *
 * When several moves are named we keep the first and report the rest: the
 * blocking-board spec allows one dominant movement per unit, and the
 * continuity failure matrix attributes "sudden pan or orbit" to exactly this —
 * too many camera instructions in one request.
 */
export const judgeCamera = (
  cameraMove: string | undefined,
  grammar: CameraGrammar,
): CameraVerdict => {
  const text = (cameraMove ?? '').trim()
  if (text.length === 0) {
    return { moves: [], vague: [], problems: [] }
  }

  const moves = matchMoves(text, grammar)
  const vague = findVagueTerms(text, grammar)
  const problems: string[] = []

  if (moves.length === 0) {
    problems.push(
      `unrecognised camera move "${text}" — it will reach the model as-is, with no guaranteed meaning`,
    )
  }
  if (moves.length > 1) {
    problems.push(
      `${moves.length} camera moves in one shot (${moves.map((m) => m.id).join(' + ')}) — keep one dominant movement`,
    )
  }
  if (vague.length > 0) {
    problems.push(
      `vague camera language (${vague.join(', ')}) — implied speed varies between generations`,
    )
  }

  return { moves, vague, phrase: moves[0]?.phrase, problems }
}

/** A stable key for "is this the same camera setup as the previous shot". */
export const setupKey = (
  shotSize: string | undefined,
  cameraMove: string | undefined,
): string => `${normalize(shotSize ?? '')}|${normalize(cameraMove ?? '')}`
