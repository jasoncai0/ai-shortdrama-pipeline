import { describe, expect, test } from 'vitest'
import { DEFAULT_VOICE_POOL, autoCastVoices, bucketFor } from '../src/lib/autocast.js'
import type { Character, Shot } from '../src/kernel/types.js'

/**
 * The failure this replaces: `voices` was missing from a config, `dub` warned
 * about it, and the whole episode was dubbed in the speech adapter's single
 * default voice — a narrator reading the play instead of a cast performing
 * it. Four episodes shipped that way. So the property that matters is not
 * "casting is plausible" but "no speaking character is ever left uncast, and
 * no two of them share a timbre".
 */

const character = (name: string, appearance: string, over: Partial<Character> = {}): Character =>
  ({ id: name, name, appearance, ...over }) as Character

const speaks = (id: string): Shot =>
  ({ id: `s-${id}`, characterIds: [id], dialogue: '台词。' }) as unknown as Shot

const silent = (id: string): Shot =>
  ({ id: `q-${id}`, characterIds: [id], plotDescription: 'x' }) as unknown as Shot

describe('bucketing reads the 人设', () => {
  test('age and sex are taken from the appearance the pipeline already has', () => {
    expect(bucketFor(character('甲', '15-year-old Chinese boy, slender'))).toBe('youngMale')
    expect(bucketFor(character('乙', '26-year-old Chinese noblewoman, tall'))).toBe('youngFemale')
    expect(bucketFor(character('丙', '48-year-old Chinese man, heavy-set'))).toBe('matureMale')
    expect(bucketFor(character('丁', '70-year-old Chinese woman'))).toBe('elderFemale')
  })

  test('children get child voices', () => {
    expect(bucketFor(character('宗之', '8-year-old Chinese boy'))).toBe('boy')
    expect(bucketFor(character('润儿', '6-year-old Chinese girl'))).toBe('girl')
  })

  test('「noblewoman」 contains 「man」 and is still a woman', () => {
    expect(bucketFor(character('女', '30-year-old Chinese noblewoman'))).toBe('matureFemale')
  })

  test('a 人设 with no stated age is treated as an adult, not a child', () => {
    expect(bucketFor(character('某', 'Chinese man, wide-sleeved robe'))).toBe('matureMale')
  })
})

describe('every speaking character ends up cast', () => {
  const cast = [
    character('陈瑜之', '15-year-old Chinese boy', { billing: 'lead' }),
    character('丁幼薇', '26-year-old Chinese noblewoman', { billing: 'lead' }),
    character('陈母李氏', '55-year-old Chinese woman'),
    character('陈满', '48-year-old Chinese man'),
  ]
  const shots = cast.map((c) => speaks(c.id))

  test('an empty config casts everyone, not nobody', () => {
    const { voices, assigned, unresolved } = autoCastVoices(cast, shots, {})

    expect(Object.keys(voices).sort()).toEqual(cast.map((c) => c.name).sort())
    expect(Object.keys(assigned)).toHaveLength(4)
    expect(unresolved).toEqual([])
  })

  test('no two characters share a timbre', () => {
    const { voices } = autoCastVoices(cast, shots, {})
    const used = Object.values(voices)
    expect(new Set(used).size).toBe(used.length)
  })

  test('the narrator timbre is never handed to a character', () => {
    const narrator = DEFAULT_VOICE_POOL.elderMale[0]!
    const { voices } = autoCastVoices(cast, shots, {}, narrator)

    expect(Object.values(voices)).not.toContain(narrator)
  })

  test('explicit config wins and is not reassigned', () => {
    const { voices, assigned } = autoCastVoices(cast, shots, { 陈瑜之: 'my-own-voice' })

    expect(voices['陈瑜之']).toBe('my-own-voice')
    expect(assigned).not.toHaveProperty('陈瑜之')
  })

  test('a character with no line is not cast — a voice slot is not spent on silence', () => {
    const extras = [...cast, character('路人', '30-year-old Chinese man')]
    const { voices } = autoCastVoices(extras, shots, {})

    expect(voices).not.toHaveProperty('路人')
  })

  test('a character who only appears silently is likewise skipped', () => {
    const { voices } = autoCastVoices(cast, [speaks('陈瑜之'), silent('陈满')], {})

    expect(voices).toHaveProperty('陈瑜之')
    expect(voices).not.toHaveProperty('陈满')
  })

  test('casting is deterministic — the same cast twice gives the same voices', () => {
    expect(autoCastVoices(cast, shots, {}).voices).toEqual(autoCastVoices(cast, shots, {}).voices)
  })

  test('leads are cast before extras, so a drained pool never costs the lead', () => {
    const many = [
      character('配角', '20-year-old Chinese man'),
      character('主角', '20-year-old Chinese man', { billing: 'lead' }),
    ]
    const tiny = { ...DEFAULT_VOICE_POOL, youngMale: ['only-one'], matureMale: [], elderMale: [], boy: [] }
    const { voices, unresolved } = autoCastVoices(many, many.map((c) => speaks(c.id)), {}, undefined, tiny)

    expect(voices['主角']).toBe('only-one')
    expect(unresolved).toEqual(['配角'])
  })

  test('an exhausted pool is reported, never silently shared', () => {
    const two = [
      character('甲', '20-year-old Chinese man'),
      character('乙', '20-year-old Chinese man'),
    ]
    const tiny = { ...DEFAULT_VOICE_POOL, youngMale: ['v1'], matureMale: [], elderMale: [], boy: [] }
    const { voices, unresolved } = autoCastVoices(two, two.map((c) => speaks(c.id)), {}, undefined, tiny)

    expect(Object.values(voices)).toEqual(['v1'])
    expect(unresolved).toEqual(['乙'])
  })
})

describe('sex is read from appearance, not from production labels', () => {
  test('an epithet naming a father AND daughter does not make the father a woman', () => {
    const feng = character('冯梦麟', '58-year-old Eastern-Jin county clerk-official, neat grey beard', {
      epithet: '冯家父女',
    })
    expect(bucketFor(feng)).toBe('elderMale')
  })

  test('a female character is still female when her epithet says nothing', () => {
    expect(bucketFor(character('丁幼薇', '26-year-old Chinese noblewoman'))).toBe('youngFemale')
  })
})

describe('a 人设 that describes the film, not the person', () => {
  test('a style-guide fallback appearance is reported as a guess', () => {
    const kid = character('润儿', '古装历史剧, 东晋风格, 电影级画质, 柔和自然光, 家人')
    const { guessed, voices } = autoCastVoices([kid], [speaks('润儿')], {})

    // Still cast — silence is worse — but the caller is told it was invented.
    expect(voices).toHaveProperty('润儿')
    expect(guessed).toEqual(['润儿'])
  })

  test('a real appearance is not flagged', () => {
    const kid = character('润儿', '6-year-old Chinese girl, round-cheeked')
    expect(autoCastVoices([kid], [speaks('润儿')], {}).guessed).toEqual([])
  })
})
