import { readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'
import { configError } from '../kernel/errors.js'

/**
 * A "prompt profile" is the production knowledge that decides how a shot is
 * described to a model: identity anchors, negative anchors, and the specs for
 * character/location/cover assets.
 *
 * It lives in editable JSON under `prompts/profiles/` rather than in code,
 * because this is craft knowledge that gets tuned per project and per model —
 * not program logic. The shipped profiles are transcribed from the
 * `pgc-skills-export` short-drama skills; each file cites its source.
 */

const assetSpec = z.object({
  spec: z.string().min(1),
  note: z.string().optional(),
  ratio: z.string().optional(),
  safeMarginPercent: z.number().optional(),
})

export const profileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.string().optional(),
  anchors: z
    .object({
      global: z.string().optional(),
      characterBase: z.string().optional(),
      characterSheet: z.string().optional(),
      keyframe: z.string().optional(),
      location: z.string().optional(),
      cover: z.string().optional(),
    })
    .default({}),
  negatives: z
    .object({
      shared: z.string().optional(),
      photoreal: z.string().optional(),
      characterBase: z.string().optional(),
      keyframe: z.string().optional(),
      cover: z.string().optional(),
    })
    .default({}),
  characterBase: assetSpec.optional(),
  characterSheet: assetSpec.optional(),
  location: assetSpec.optional(),
  cover: assetSpec.optional(),
  continuityClause: z.string().optional(),
})

export type PromptProfile = z.infer<typeof profileSchema>

export const loadProfile = async (
  cwd: string,
  dir: string,
  name: string,
): Promise<PromptProfile> => {
  const base = isAbsolute(dir) ? dir : resolve(cwd, dir)
  const path = name.endsWith('.json') ? resolve(base, name) : join(base, `${name}.json`)

  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    throw configError(
      `Prompt profile "${name}" not found at ${path}.`,
      'Shipped profiles live in prompts/profiles/. Set the stage option `profile` to one of their ids, or "none" to skip.',
    )
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw configError(`Prompt profile ${path} is not valid JSON: ${String(error)}`)
  }

  const parsed = profileSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw configError(`Prompt profile ${path} failed validation:\n${issues}`)
  }
  return parsed.data
}

/** `"none"` disables profile anchoring without removing the option. */
export const maybeLoadProfile = async (
  cwd: string,
  dir: string,
  name: unknown,
): Promise<PromptProfile | undefined> => {
  if (typeof name !== 'string' || name.length === 0 || name === 'none') return undefined
  return loadProfile(cwd, dir, name)
}

/** Joins non-empty fragments into a single comma-separated prompt. */
export const joinPrompt = (...parts: readonly (string | undefined)[]): string =>
  parts
    .flatMap((p) => (p ?? '').split(','))
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(', ')
