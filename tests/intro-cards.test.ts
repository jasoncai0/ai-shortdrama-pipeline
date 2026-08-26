import { describe, expect, test } from 'vitest'
import { DEFAULT_PLAN, orderedShots, planIntroCards } from '../src/lib/introcards.js'
import type { AssetRef, Character, Project, Shot } from '../src/kernel/types.js'

/**
 * The placement rules, tested where they live.
 *
 * Every one of these is a mistake that a screenshot would not reveal: a card
 * on the wrong appearance, a card too brief to read, two cards stacked on one
 * shot, or a character who quietly never gets introduced at all.
 */

const clip = (id: string): AssetRef => ({
  id,
  uri: `file:///${id}.mp4`,
  mime: 'video/mp4',
  meta: {},
})

const shot = (id: string, order: number, characterIds: string[], over: Partial<Shot> = {}): Shot => ({
  id,
  episodeId: 'ep1',
  order,
  durationSeconds: 4,
  plotDescription: 'x',
  characterIds,
  propIds: [],
  status: 'clipped',
  clip: clip(id),
  ...over,
})

const character = (id: string, name: string, epithet?: string): Character => ({
  id,
  name,
  appearance: 'x',
  ...(epithet ? { epithet } : {}),
})

const project = (shots: readonly Shot[], characters: readonly Character[]): Project => ({
  id: 'p1',
  title: 't',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'i',
  createdAt: 'x',
  updatedAt: 'x',
  episodes: [],
  characters,
  scenes: [],
  props: [],
  shots,
  stageState: {},
  adapterState: {},
})

const plan = (
  shots: readonly Shot[],
  characters: readonly Character[],
  durations: number[],
  options: Partial<typeof DEFAULT_PLAN> = {},
) =>
  planIntroCards({
    project: project(shots, characters),
    durations,
    options: { ...DEFAULT_PLAN, ...options },
  })

describe('first appearance', () => {
  test('a character is carded on their first shot and never again', () => {
    const { placements } = plan(
      [shot('s1', 1, ['ch1']), shot('s2', 2, ['ch1']), shot('s3', 3, ['ch1'])],
      [character('ch1', '林默', '外卖员')],
      [4, 4, 4],
    )

    expect(placements.length).toBe(1)
    expect(placements[0]?.shotId).toBe('s1')
  })

  test('timing comes from measured durations, not the requested ones', () => {
    // Shots ask for 4s; the model returned 4.096s each. The second card must
    // sit on the real boundary, or it drifts onto the wrong shot.
    const { placements } = plan(
      [shot('s1', 1, ['ch1']), shot('s2', 2, ['ch2'])],
      [character('ch1', 'A'), character('ch2', 'B')],
      [4.096, 4.096],
      { delaySeconds: 0.4 },
    )

    expect(placements[0]?.startSeconds).toBeCloseTo(0.4, 3)
    expect(placements[1]?.startSeconds).toBeCloseTo(4.496, 3)
  })

  test('the card never outlives its shot', () => {
    const { placements } = plan(
      [shot('s1', 1, ['ch1'])],
      [character('ch1', 'A')],
      [2.0],
      { delaySeconds: 0.4, holdSeconds: 5 },
    )

    expect(placements[0]?.endSeconds).toBeLessThanOrEqual(2.0)
  })

  test('a shot too short to read is skipped, and the character waits', () => {
    const { placements, notes } = plan(
      [shot('s1', 1, ['ch1']), shot('s2', 2, ['ch1'])],
      [character('ch1', 'A')],
      [1.0, 4.0],
      { minReadableSeconds: 1.2, delaySeconds: 0.4 },
    )

    expect(placements.length).toBe(1)
    expect(placements[0]?.shotId).toBe('s2')
    expect(notes.join(' ')).toMatch(/too short/)
  })

  test('a character whose every shot is too short is reported, not lost', () => {
    const { placements, notes } = plan(
      [shot('s1', 1, ['ch1'])],
      [character('ch1', '路人甲')],
      [0.8],
    )

    expect(placements).toEqual([])
    expect(notes.join(' ')).toMatch(/路人甲.*never got a card/)
  })
})

describe('two characters entering together', () => {
  test('only one card goes up, and the other is deferred with a note', () => {
    const { placements, notes } = plan(
      [shot('s1', 1, ['ch1', 'ch2'])],
      [character('ch1', 'A'), character('ch2', 'B')],
      [4],
    )

    expect(placements.length).toBe(1)
    expect(notes.join(' ')).toMatch(/deferred/)
  })

  test('the deferred one is carded on their next separate shot', () => {
    const { placements } = plan(
      [shot('s1', 1, ['ch1', 'ch2']), shot('s2', 2, ['ch2'])],
      [character('ch1', 'A'), character('ch2', 'B')],
      [4, 4],
    )

    expect(placements.map((p) => p.name)).toEqual(['A', 'B'])
    expect(placements[1]?.shotId).toBe('s2')
  })

  test('maxConcurrent lets both through when that is wanted', () => {
    const { placements } = plan(
      [shot('s1', 1, ['ch1', 'ch2'])],
      [character('ch1', 'A'), character('ch2', 'B')],
      [4],
      { maxConcurrent: 2 },
    )

    expect(placements.length).toBe(2)
  })
})

describe('which side', () => {
  test('alternates, so two people meeting do not stack on one edge', () => {
    const { placements } = plan(
      [shot('s1', 1, ['ch1']), shot('s2', 2, ['ch2']), shot('s3', 3, ['ch3'])],
      [character('ch1', 'A'), character('ch2', 'B'), character('ch3', 'C')],
      [4, 4, 4],
    )

    expect(placements.map((p) => p.side)).toEqual(['right', 'left', 'right'])
  })

  test('a fixed side is honoured', () => {
    const { placements } = plan(
      [shot('s1', 1, ['ch1']), shot('s2', 2, ['ch2'])],
      [character('ch1', 'A'), character('ch2', 'B')],
      [4, 4],
      { side: 'left' },
    )

    expect(placements.every((p) => p.side === 'left')).toBe(true)
  })
})

describe('skipping and ordering', () => {
  test('a skipped character gets no card and no complaint', () => {
    const { placements, notes } = plan(
      [shot('s1', 1, ['ch1'])],
      [character('ch1', '路人')],
      [4],
      { skip: ['ch1'] },
    )

    expect(placements).toEqual([])
    expect(notes).toEqual([])
  })

  test('the epithet rides along for the card to typeset', () => {
    const { placements } = plan(
      [shot('s1', 1, ['ch1'])],
      [character('ch1', '林默', '外卖员 · 目击者')],
      [4],
    )

    expect(placements[0]?.epithet).toBe('外卖员 · 目击者')
  })

  test('a dubbed shot is ordered by its voiced clip, as export sees it', () => {
    const dubbed = shot('s1', 1, ['ch1'], { voicedClip: clip('voiced-s1') })
    expect(orderedShots(project([dubbed], []))[0]?.id).toBe('s1')
  })

  test('shots with no clip are not part of the timeline', () => {
    const shots = [shot('s1', 1, ['ch1'], { clip: undefined }), shot('s2', 2, ['ch1'])]
    expect(orderedShots(project(shots, [])).map((s) => s.id)).toEqual(['s2'])
  })

  test('episodes run in order, not interleaved by shot number', () => {
    const shots = [
      { ...shot('e2s1', 1, ['ch2']), episodeId: 'ep2' },
      shot('e1s1', 1, ['ch1']),
    ]
    expect(orderedShots(project(shots, [])).map((s) => s.id)).toEqual(['e1s1', 'e2s1'])
  })
})
