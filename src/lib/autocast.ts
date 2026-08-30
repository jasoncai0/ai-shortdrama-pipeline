import type { Character, Shot } from '../kernel/types.js'

/**
 * Casts a voice for every speaking character that the config forgot.
 *
 * A missing `voices` map used to be a warning: `dub` said "no voice cast for
 * 陈瑜之, 丁幼薇, …" and then dubbed all of them with the speech adapter's
 * default. The result is a whole episode in one timbre — a narrator reading
 * the play rather than a cast performing it — and four episodes shipped that
 * way before anyone watched far enough to hear it. A warning nobody reads is
 * not a safeguard, so casting now happens whether or not the config supplies
 * it.
 *
 * Assignment is deterministic and derived from the 人设 the pipeline already
 * has: appearance text states age and sex plainly ("15-year-old Chinese boy",
 * "55-year-old Chinese woman"), which is exactly the information a casting
 * director uses first. Explicit config always wins; the narrator's timbre is
 * never handed to a character; and voices are not reused while the pool has
 * anything left.
 */

export interface VoicePool {
  readonly boy: readonly string[]
  readonly girl: readonly string[]
  readonly youngMale: readonly string[]
  readonly youngFemale: readonly string[]
  readonly matureMale: readonly string[]
  readonly matureFemale: readonly string[]
  readonly elderMale: readonly string[]
  readonly elderFemale: readonly string[]
}

/**
 * Minimax voice ids available on the libtv speech adapter, grouped by the
 * bucket they actually suit. Ordered best-first inside each bucket: the first
 * character to need a bucket gets its most characteristic voice.
 */
export const DEFAULT_VOICE_POOL: VoicePool = {
  boy: ['clever_boy', 'cute_boy', 'male-qn-daxuesheng'],
  girl: ['lovely_girl', 'tianxin_xiaoling', 'female-tianmei'],
  youngMale: [
    'male-qn-qingse',
    'male-qn-jingying',
    'male-qn-daxuesheng',
    'junlang_nanyou',
    'chunzhen_xuedi',
    'bingjiao_didi',
  ],
  youngFemale: [
    'female-shaonv',
    'female-tianmei',
    'diadia_xuemei',
    'danya_xuejie',
    'qiaopi_mengmei',
  ],
  matureMale: ['male-qn-badao', 'presenter_male', 'badao_shaoye', 'lengdan_xiongzhang'],
  matureFemale: ['female-yujie', 'presenter_female', 'wumei_yujie'],
  elderMale: ['audiobook_male_2', 'audiobook_male_1', 'presenter_male'],
  elderFemale: ['female-chengshu', 'audiobook_female_1', 'audiobook_female_2'],
}

type Bucket = keyof VoicePool

const FEMALE_WORDS = [
  'woman', 'girl', 'noblewoman', 'maidservant', 'lady', 'female',
  '女', '娘', '妇', '婢', '媛',
]
const MALE_WORDS = [
  'man', 'boy', 'youth', 'monk', 'official', 'gentleman', 'servant', 'male',
  '男', '公', '翁', '叟',
]

/** Reads the age the 人设 states outright, e.g. "8-year-old Chinese boy". */
const ageOf = (text: string): number | undefined => {
  const match = /(\d{1,3})\s*[- ]?year[- ]?old/i.exec(text) ?? /(\d{1,3})\s*岁/.exec(text)
  const age = match?.[1] ? Number(match[1]) : undefined
  return age !== undefined && Number.isFinite(age) ? age : undefined
}

const isFemale = (text: string): boolean => {
  const lower = text.toLowerCase()
  const female = FEMALE_WORDS.some((w) => lower.includes(w))
  const male = MALE_WORDS.some((w) => lower.includes(w))
  // "boy" is inside neither list's counterpart, but "noblewoman" contains
  // "man" — so an explicit female word wins over an incidental male match.
  return female && !(male && !female)
}

export const bucketFor = (character: Character): Bucket => {
  // Sex comes from `appearance` alone. An epithet like 「冯家父女」 (a father
  // AND his daughter) contains 女 and cast a 58-year-old male clerk as an
  // elderly woman — production labels describe a relationship, not a person.
  const appearance = character.appearance ?? ''
  const female = isFemale(appearance)
  const age = ageOf(`${appearance} ${character.personality ?? ''}`) ?? 30

  if (age < 14) return female ? 'girl' : 'boy'
  if (age < 30) return female ? 'youngFemale' : 'youngMale'
  if (age < 55) return female ? 'matureFemale' : 'matureMale'
  return female ? 'elderFemale' : 'elderMale'
}

export interface AutoCastResult {
  /** character name → voice id, config casting merged with what was inferred. */
  readonly voices: Readonly<Record<string, string>>
  /** name → voice id, only the ones this pass invented. */
  readonly assigned: Readonly<Record<string, string>>
  /** Speaking characters left uncast because every pool was exhausted. */
  readonly unresolved: readonly string[]
  /**
   * Characters whose 人设 stated neither age nor sex, so the bucket is a
   * default rather than a reading. A 6-year-old girl whose appearance fell
   * back to the style guide was cast as a cold elder brother; that is worth
   * saying out loud rather than shipping.
   */
  readonly guessed: readonly string[]
}

/**
 * Only characters that actually speak are cast — an extra with no line costs
 * a voice slot that a speaking character then cannot have.
 */
export const autoCastVoices = (
  characters: readonly Character[],
  shots: readonly Shot[],
  existing: Readonly<Record<string, string>>,
  narratorVoice?: string,
  pool: VoicePool = DEFAULT_VOICE_POOL,
): AutoCastResult => {
  const speakingIds = new Set(
    shots.filter((s) => s.dialogue?.trim()).flatMap((s) => s.characterIds ?? []),
  )

  const taken = new Set<string>(Object.values(existing))
  if (narratorVoice) taken.add(narratorVoice)

  const voices: Record<string, string> = { ...existing }
  const assigned: Record<string, string> = {}
  const unresolved: string[] = []
  const guessed: string[] = []

  // Leads first: when a bucket runs dry the character who carries the story
  // should already hold its most characteristic voice.
  const rank = (c: Character) => (c.billing === 'lead' ? 0 : c.billing === 'supporting' ? 1 : 2)
  const needing = characters
    .filter((c) => speakingIds.has(c.id) && !voices[c.name])
    .sort((a, b) => rank(a) - rank(b))

  for (const character of needing) {
    if (!describesAPerson(character)) guessed.push(character.name)
    const bucket = bucketFor(character)
    // Fall through to the neighbouring buckets of the same sex rather than
    // leaving a speaking character on the adapter default, which is the exact
    // failure this module exists to prevent.
    const female = bucket.toLowerCase().includes('female') || bucket === 'girl'
    const order: readonly Bucket[] = female
      ? [bucket, 'youngFemale', 'matureFemale', 'elderFemale', 'girl']
      : [bucket, 'youngMale', 'matureMale', 'elderMale', 'boy']

    const pick = order
      .flatMap((b) => pool[b])
      .find((voice) => !taken.has(voice))

    if (!pick) {
      unresolved.push(character.name)
      continue
    }
    taken.add(pick)
    voices[character.name] = pick
    assigned[character.name] = pick
  }

  return { voices, assigned, unresolved, guessed }
}

/**
 * True when the appearance says something a casting director could use. An
 * appearance that is only the project's style guide (「古装历史剧, 东晋风格,
 * 电影级画质…」) describes the film, not the person.
 */
export const describesAPerson = (character: Character): boolean => {
  const text = (character.appearance ?? '').toLowerCase()
  const hasAge = ageOf(text) !== undefined
  const hasSex = FEMALE_WORDS.some((w) => text.includes(w)) || MALE_WORDS.some((w) => text.includes(w))
  return hasAge || hasSex
}
