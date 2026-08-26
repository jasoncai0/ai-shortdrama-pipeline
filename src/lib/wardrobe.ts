import type { Character, WardrobeLook } from '../kernel/types.js'

/**
 * Deciding who gets wardrobe variants, and whether the variants are any good.
 *
 * Pure, and separate from generation, because both judgements are cheap to get
 * wrong in ways the images will not reveal. A character billed as a lead by
 * accident costs four images. Three "different" outfits that are all
 * 「深色长袍」 cost four images and look like a bug in the pipeline rather than
 * what they are — a bad brief.
 */

export interface CastingOptions {
  /** Names the config explicitly promotes, whatever the story said. */
  readonly leadNames: readonly string[]
  /** When nothing marks a lead, take this many from the top of the cast. */
  readonly fallbackLeads: number
  /** Never dress these, however they are billed. */
  readonly skipNames: readonly string[]
}

export const DEFAULT_CASTING: CastingOptions = {
  leadNames: [],
  fallbackLeads: 1,
  skipNames: [],
}

export interface CastingResult {
  readonly leads: readonly Character[]
  readonly notes: readonly string[]
}

/**
 * Picks who gets dressed.
 *
 * Explicit config wins over the story's own billing, because the story's
 * billing is an LLM's guess and the config is a decision. When neither says
 * anything, the top of the cast list is used and that fallback is announced —
 * silently dressing whoever happened to be listed first is the kind of default
 * that quietly spends money on the wrong character.
 */
export const castForWardrobe = (
  characters: readonly Character[],
  options: CastingOptions = DEFAULT_CASTING,
): CastingResult => {
  const notes: string[] = []
  const skip = new Set(options.skipNames)
  const eligible = characters.filter((c) => !skip.has(c.name))

  const named = options.leadNames.length > 0
    ? eligible.filter((c) => options.leadNames.includes(c.name))
    : []

  const unknownNames = options.leadNames.filter(
    (n) => !characters.some((c) => c.name === n),
  )
  for (const name of unknownNames) {
    notes.push(`configured lead "${name}" is not in the cast`)
  }

  if (named.length > 0) return { leads: named, notes }

  const billed = eligible.filter((c) => c.billing === 'lead')
  if (billed.length > 0) return { leads: billed, notes }

  const fallback = eligible.slice(0, Math.max(0, options.fallbackLeads))
  if (fallback.length > 0) {
    notes.push(
      `nobody is billed as a lead; dressing the first ${fallback.length} of the cast (${fallback
        .map((c) => c.name)
        .join(', ')}). Set billing, or name leads in the stage options.`,
    )
  }
  return { leads: fallback, notes }
}

/**
 * Flags looks that are not actually different from each other.
 *
 * The whole point of the feature is variety within a stable identity. Two
 * descriptions that share most of their vocabulary will produce two images
 * that share most of their pixels, and paying twice for that is worse than
 * having asked for one.
 */
export const findDuplicateLooks = (
  looks: readonly WardrobeLook[],
  threshold = 0.6,
): readonly string[] => {
  const problems: string[] = []
  for (let i = 0; i < looks.length; i += 1) {
    for (let j = i + 1; j < looks.length; j += 1) {
      const a = looks[i] as WardrobeLook
      const b = looks[j] as WardrobeLook
      const overlap = jaccard(tokenise(a.description), tokenise(b.description))
      if (overlap >= threshold) {
        problems.push(
          `"${a.label}" and "${b.label}" are ${Math.round(overlap * 100)}% the same description`,
        )
      }
    }
  }
  return problems
}

/**
 * Words that describe the person rather than the clothes.
 *
 * A look that repeats them is re-specifying the identity the base reference
 * already fixes, which is how a wardrobe change turns into a different actor.
 */
const IDENTITY_WORDS = [
  'face', 'facial', 'eyes', 'nose', 'jaw', 'cheekbones', 'complexion', 'skin tone',
  'hairstyle', 'haircut', 'hair', 'beard', 'age', 'year-old', 'build', 'height',
  'body type', 'physique', '脸', '五官', '发型', '身材', '年龄',
]

export const findIdentityLeaks = (look: WardrobeLook): readonly string[] => {
  const text = look.description.toLowerCase()
  return IDENTITY_WORDS.filter((word) => text.includes(word))
}

const tokenise = (text: string): ReadonlySet<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9一-鿿]+/)
      .filter((w) => w.length > 2),
  )

const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  if (a.size === 0 && b.size === 0) return 1
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}
