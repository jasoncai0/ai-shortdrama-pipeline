import { describe, expect, test } from 'vitest'
import { bookendNarration } from '../src/lib/narration-bookend.js'
import type { Shot } from '../src/kernel/types.js'

/**
 * A merged cut has one opening and one closing; the per-episode pacing pass
 * does not know that, so it sprinkles voice-over through the middle. These
 * pin the rule that fixes it — and the two ways it could silently go wrong:
 * a dropped shot leaving a hole in `order`, and a story beat losing its
 * picture along with its words.
 */

let n = 0
const shot = (over: Partial<Shot> = {}): Shot =>
  ({
    id: `s${++n}`,
    episodeId: 'ep1',
    order: n,
    durationSeconds: 5,
    plotDescription: 'x',
    shotSize: '中景',
    cameraMove: '固定机位',
    lightingAndAtmosphere: '白天',
    kind: 'beat',
    characterIds: [],
    sceneId: 'sc1',
    propIds: [],
    status: 'draft',
    ...over,
  }) as unknown as Shot

const narrationInsert = (over: Partial<Shot> = {}): Shot =>
  shot({ kind: 'insert', insertRole: 'narration', narration: '旁白', ...over })

const run = (shots: readonly Shot[]) => bookendNarration(shots, { headShots: 2, tailShots: 2 })

describe('narration keeps only the bookends', () => {
  test('a mid-cut narration insert is dropped whole, not left as silent sky', () => {
    const shots = [
      narrationInsert({ id: 'open' }),
      shot(),
      narrationInsert({ id: 'middle' }),
      shot(),
      narrationInsert({ id: 'close' }),
      shot(),
    ]
    const { shots: out, removedInserts } = run(shots)

    expect(removedInserts).toBe(1)
    expect(out).toHaveLength(5)
    expect(out.map((s) => s.id)).not.toContain('middle')
  })

  test('the opening and closing narration survive', () => {
    const shots = [
      narrationInsert({ id: 'open' }),
      shot(),
      narrationInsert({ id: 'middle' }),
      shot(),
      narrationInsert({ id: 'close' }),
    ]
    const ids = run(shots).shots.map((s) => s.id)

    expect(ids).toContain('open')
    expect(ids).toContain('close')
    expect(ids).not.toContain('middle')
  })

  test('a story beat carrying narration keeps its picture and loses the words', () => {
    const shots = [
      narrationInsert(),
      shot(),
      shot({ id: 'beat', narration: '旁白', dialogue: undefined }),
      shot(),
      narrationInsert(),
    ]
    const { shots: out, strippedBeats, removedInserts } = run(shots)

    expect(strippedBeats).toBe(1)
    expect(removedInserts).toBe(0)
    expect(out).toHaveLength(5)
    expect(out.find((s) => s.id === 'beat')?.narration).toBeUndefined()
  })

  test('dialogue shots are never touched — they carry no narration to begin with', () => {
    const shots = [shot(), shot(), shot({ id: 'talk', dialogue: '台词。' }), shot(), shot()]
    expect(run(shots).shots.find((s) => s.id === 'talk')?.dialogue).toBe('台词。')
  })

  test('order is renumbered per episode so the export sort has no gaps', () => {
    const shots = [
      shot({ episodeId: 'ep1', order: 1 }),
      shot({ episodeId: 'ep1', order: 2 }),
      narrationInsert({ episodeId: 'ep1', order: 3 }),
      shot({ episodeId: 'ep2', order: 1 }),
      narrationInsert({ episodeId: 'ep2', order: 2 }),
      shot({ episodeId: 'ep2', order: 3 }),
      shot({ episodeId: 'ep2', order: 4 }),
    ]
    const out = bookendNarration(shots, { headShots: 1, tailShots: 1 }).shots

    for (const ep of ['ep1', 'ep2']) {
      const orders = out.filter((s) => s.episodeId === ep).map((s) => s.order)
      expect(orders).toEqual(orders.map((_v, i) => i + 1))
    }
  })

  test('a transition insert is never mistaken for narration', () => {
    const shots = [shot(), shot(), shot({ kind: 'insert', insertRole: 'transition' }), shot(), shot()]
    expect(run(shots).shots).toHaveLength(5)
  })

  test('a cut shorter than its own bookends keeps everything', () => {
    const shots = [narrationInsert(), narrationInsert(), narrationInsert()]
    expect(run(shots).shots).toHaveLength(3)
  })

  test('nothing to do is not a rewrite — untouched shots keep identity', () => {
    const shots = [shot({ order: 1 }), shot({ order: 2 }), shot({ order: 3 })]
    const out = run(shots).shots
    expect(out[1]).toBe(shots[1])
  })
})

describe('the cut always keeps an opening and a closing', () => {
  test('narration nowhere near either end still leaves exactly two lines', () => {
    const shots = [
      shot(), shot(), shot(), shot(),
      narrationInsert({ id: 'first' }),
      shot(),
      narrationInsert({ id: 'middle' }),
      shot(),
      narrationInsert({ id: 'last' }),
      shot(), shot(), shot(), shot(),
    ]
    const ids = bookendNarration(shots, { headShots: 2, tailShots: 2 }).shots.map((s) => s.id)

    // Deleting every line because none sat in the window is silence, not bookends.
    expect(ids).toContain('first')
    expect(ids).toContain('last')
    expect(ids).not.toContain('middle')
  })

  test('a single narration line is both the opening and the closing', () => {
    const shots = [shot(), shot(), narrationInsert({ id: 'only' }), shot(), shot()]
    expect(bookendNarration(shots, { headShots: 1, tailShots: 1 }).shots.map((s) => s.id)).toContain(
      'only',
    )
  })
})

describe('relocation puts the survivors at the actual ends', () => {
  const scenes = new Map([['sc1', '云隐寺'], ['sc9', '九曜山顶']])

  test('a line 20% in becomes the first shot of the cut', () => {
    const shots = [
      shot({ sceneId: 'sc1' }),
      shot(),
      narrationInsert({ id: 'open', sceneId: 'sc9' }),
      shot(),
      shot(),
      narrationInsert({ id: 'close', sceneId: 'sc1' }),
      shot({ sceneId: 'sc9' }),
    ]
    const out = bookendNarration(shots, { headShots: 1, tailShots: 1 }, scenes).shots

    expect(out[0]?.id).toBe('open')
    expect(out[out.length - 1]?.id).toBe('close')
  })

  test('a moved insert is re-pictured to where it now sits', () => {
    const shots = [
      shot({ sceneId: 'sc1', lightingAndAtmosphere: '清晨, 冷调晨光' }),
      narrationInsert({ id: 'open', sceneId: 'sc9', lightingAndAtmosphere: '夜晚' }),
      shot(),
    ]
    const head = bookendNarration(shots, {}, scenes).shots[0]!

    expect(head.sceneId).toBe('sc1')
    expect(head.plotDescription).toContain('云隐寺')
    expect(head.lightingAndAtmosphere).toBe('清晨, 冷调晨光')
  })

  test('relocate:false leaves them where the script put them', () => {
    const shots = [shot(), narrationInsert({ id: 'n' }), shot()]
    const out = bookendNarration(shots, { relocate: false }, scenes).shots
    expect(out[1]?.id).toBe('n')
  })

  test('a story beat carrying narration is never moved out of its scene', () => {
    const shots = [shot(), shot({ id: 'beat', narration: '旁白' }), shot()]
    const out = bookendNarration(shots, {}, scenes).shots
    expect(out[1]?.id).toBe('beat')
  })
})
