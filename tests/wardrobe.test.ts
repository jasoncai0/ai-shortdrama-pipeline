import { describe, expect, test } from 'vitest'
import {
  DEFAULT_CASTING,
  castForWardrobe,
  findDuplicateLooks,
  findIdentityLeaks,
} from '../src/lib/wardrobe.js'
import { findLook } from '../src/kernel/types.js'
import type { Character, WardrobeLook } from '../src/kernel/types.js'

/**
 * The two judgements that decide whether wardrobe variants are worth what they
 * cost: who gets dressed, and whether the outfits are actually different.
 * Both fail silently in the output — four near-identical images look like a
 * broken generator rather than a bad brief.
 */

const character = (name: string, over: Partial<Character> = {}): Character => ({
  id: name,
  name,
  appearance: 'x',
  ...over,
})

const look = (label: string, description: string): WardrobeLook => ({
  id: label,
  label,
  description,
})

describe('casting', () => {
  test('an explicit lead list beats whatever the story billed', () => {
    const cast = [character('甲', { billing: 'lead' }), character('乙', { billing: 'extra' })]
    const { leads } = castForWardrobe(cast, { ...DEFAULT_CASTING, leadNames: ['乙'] })

    expect(leads.map((c) => c.name)).toEqual(['乙'])
  })

  test('billing is used when the config says nothing', () => {
    const cast = [character('甲'), character('乙', { billing: 'lead' })]
    expect(castForWardrobe(cast).leads.map((c) => c.name)).toEqual(['乙'])
  })

  test('with nobody billed it falls back to the top of the cast — and says so', () => {
    const { leads, notes } = castForWardrobe([character('甲'), character('乙')])

    expect(leads.map((c) => c.name)).toEqual(['甲'])
    expect(notes.join(' ')).toMatch(/nobody is billed/)
  })

  test('a configured lead who is not in the cast is reported, not ignored', () => {
    const { notes } = castForWardrobe([character('甲')], {
      ...DEFAULT_CASTING,
      leadNames: ['不存在'],
    })
    expect(notes.join(' ')).toMatch(/not in the cast/)
  })

  test('skip wins over everything, including an explicit lead list', () => {
    const { leads } = castForWardrobe([character('甲', { billing: 'lead' })], {
      ...DEFAULT_CASTING,
      leadNames: ['甲'],
      skipNames: ['甲'],
    })
    expect(leads).toEqual([])
  })

  test('several billed leads all get dressed', () => {
    const cast = [
      character('甲', { billing: 'lead' }),
      character('乙', { billing: 'lead' }),
      character('丙', { billing: 'supporting' }),
    ]
    expect(castForWardrobe(cast).leads.map((c) => c.name)).toEqual(['甲', '乙'])
  })
})

describe('variety', () => {
  test('two outfits that share most of their words are flagged', () => {
    const problems = findDuplicateLooks([
      look('A', 'dark long robe with wide sleeves and a cloth belt'),
      look('B', 'dark long robe with wide sleeves and a leather belt'),
    ])
    expect(problems.join(' ')).toMatch(/"A" and "B"/)
  })

  test('genuinely different outfits pass', () => {
    const problems = findDuplicateLooks([
      look('送餐服', 'yellow waterproof courier jacket, cargo trousers, insulated backpack'),
      look('便服', 'faded navy sweatshirt, loose jeans, canvas shoes'),
    ])
    expect(problems).toEqual([])
  })

  test('every pair is compared, not just neighbours', () => {
    const problems = findDuplicateLooks([
      look('A', 'yellow courier jacket cargo trousers backpack'),
      look('B', 'silk banquet gown embroidered sleeves jade pins'),
      look('C', 'yellow courier jacket cargo trousers backpack'),
    ])
    expect(problems.join(' ')).toMatch(/"A" and "C"/)
  })
})

describe('identity leakage', () => {
  test('a look that describes the face is flagged — it competes with the base', () => {
    expect(
      findIdentityLeaks(look('X', 'red coat, worn by a man with a square jaw and short hair')),
    ).toEqual(expect.arrayContaining(['jaw', 'hair']))
  })

  test('Chinese identity words are caught too', () => {
    expect(findIdentityLeaks(look('X', '深色长袍，圆脸，短发'))).toEqual(
      expect.arrayContaining(['脸', '发型'].filter((w) => '深色长袍，圆脸，短发'.includes(w))),
    )
  })

  test('a clothes-only description is clean', () => {
    expect(
      findIdentityLeaks(look('X', 'translucent rain poncho over a courier jacket, soaked cuffs')),
    ).toEqual([])
  })
})

describe('look lookup', () => {
  const dressed = character('林默', {
    wardrobe: [look('w1', 'courier jacket'), look('w3', 'rain poncho')],
  })

  test('resolves a shot’s look by id', () => {
    expect(findLook(dressed, 'w3')?.description).toBe('rain poncho')
  })

  test('an unset wardrobeId means the default costume, not a crash', () => {
    expect(findLook(dressed, undefined)).toBeUndefined()
  })

  test('an id that does not exist resolves to nothing rather than the first look', () => {
    expect(findLook(dressed, 'w9')).toBeUndefined()
  })

  test('a character with no wardrobe is handled', () => {
    expect(findLook(character('乙'), 'w1')).toBeUndefined()
  })
})
