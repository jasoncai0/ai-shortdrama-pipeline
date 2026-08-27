import { describe, expect, test } from 'vitest'
import { planShotLanguage } from '../src/lib/shotlang.js'
import type { Shot } from '../src/kernel/types.js'

/**
 * The two complaints this pass answers: every shot was the same slow push-in,
 * and every dialogue was one person talking at the camera. Each test pins one
 * property of the coverage, not exact shot-by-shot output — the rotation is
 * free to change as long as these hold.
 */

let n = 0
const shot = (over: Partial<Shot>): Shot =>
  ({
    id: `s${++n}`,
    episodeId: 'ep1',
    order: n,
    durationSeconds: 5,
    plotDescription: '动作',
    shotSize: '中景',
    cameraMove: '静止',
    lightingAndAtmosphere: '白天',
    kind: 'beat',
    characterIds: [],
    sceneId: 'sc1',
    propIds: [],
    status: 'draft',
    ...over,
  }) as unknown as Shot

const exchange = (lines: readonly [string, string][]): readonly Shot[] => [
  // An opening action beat puts both people on stage.
  shot({ characterIds: ['甲', '乙'], plotDescription: '两人相对' }),
  ...lines.map(([speaker, text]) =>
    shot({ characterIds: [speaker], dialogue: text, plotDescription: `${speaker}说话` }),
  ),
]

describe('dialogue becomes interaction', () => {
  test('a line spoken to someone on stage frames both of them', () => {
    const planned = planShotLanguage(exchange([['甲', '你来了。'], ['乙', '嗯。']]))
    const dialogue = planned.filter((s) => s.dialogue)

    for (const s of dialogue) {
      expect(s.characterIds).toHaveLength(2)
      expect(s.shotSize).toBe('过肩中景')
      expect(s.plotDescription).toContain('过肩')
    }
  })

  test('consecutive over-the-shoulder shots reverse sides', () => {
    const planned = planShotLanguage(
      exchange([['甲', '一。'], ['乙', '二。']]),
    ).filter((s) => s.dialogue)

    const sides = planned.map((s) => (s.plotDescription.includes('左侧') ? 'L' : 'R'))
    expect(sides[0]).not.toBe(sides[1])
  })

  test('with nobody else on stage the speaker stays alone — no invented listener', () => {
    const planned = planShotLanguage([shot({ characterIds: ['甲'], dialogue: '独白。' })])
    expect(planned[0]?.characterIds).toEqual(['甲'])
  })

  test('a long exchange is punctuated by a close-up', () => {
    const planned = planShotLanguage(
      exchange([
        ['甲', '一。'],
        ['乙', '二。'],
        ['甲', '三。'],
        ['乙', '四。'],
        ['甲', '五。'],
        ['乙', '六。'],
      ]),
    ).filter((s) => s.dialogue)

    expect(planned.some((s) => s.shotSize === '特写')).toBe(true)
    // But not wall-to-wall: most of the exchange stays conversational.
    expect(planned.filter((s) => s.shotSize === '过肩中景').length).toBeGreaterThanOrEqual(3)
  })

  test('an emotional line goes tight and handheld', () => {
    const planned = planShotLanguage([
      shot({ characterIds: ['甲'], dialogue: '丑儿!丑儿——' }),
    ])
    expect(planned[0]?.shotSize).toBe('特写')
    expect(planned[0]?.cameraMove).toBe('手持跟拍')
  })

  test('an ordinary question is NOT emotional — ？almost every line has one', () => {
    const planned = planShotLanguage([
      shot({ characterIds: ['甲'], dialogue: '看到那盏灯没有?' }),
    ])
    expect(planned[0]?.cameraMove).not.toBe('手持跟拍')
  })

  test('two close-ups never land back to back', () => {
    const planned = planShotLanguage([
      shot({ characterIds: ['甲'], dialogue: '跪下!' }),
      shot({ characterIds: ['甲'], dialogue: '给我哭!' }),
    ])
    const sizes = planned.map((s) => s.shotSize)
    expect(sizes).not.toEqual(['特写', '特写'])
  })
})

describe('coverage variety', () => {
  test('action beats after the establishing shot stop repeating one move', () => {
    const beats = [
      shot({ plotDescription: '开场全景' }),
      shot({ plotDescription: '动作一' }),
      shot({ plotDescription: '动作二' }),
      shot({ plotDescription: '动作三' }),
    ]
    const planned = planShotLanguage(beats)
    const moves = planned.slice(1).map((s) => s.cameraMove)

    expect(new Set(moves).size).toBeGreaterThan(1)
    for (let i = 1; i < moves.length; i += 1) expect(moves[i]).not.toBe(moves[i - 1])
  })

  test('the first beat of a scene keeps its establishing framing', () => {
    const planned = planShotLanguage([shot({ shotSize: '全景', cameraMove: '缓慢推进' })])
    expect(planned[0]?.shotSize).toBe('全景')
    expect(planned[0]?.cameraMove).toBe('缓慢推进')
  })

  test('inserts are left exactly as the pacing pass framed them', () => {
    const insert = shot({
      kind: 'insert',
      insertRole: 'narration',
      shotSize: '全景',
      cameraMove: 'static',
    })
    expect(planShotLanguage([insert])[0]).toEqual(insert)
  })

  test('scenes do not leak coverage state into each other', () => {
    const planned = planShotLanguage([
      shot({ sceneId: 'sc1', plotDescription: 'sc1 开场' }),
      shot({ sceneId: 'sc2', plotDescription: 'sc2 开场', shotSize: '全景' }),
    ])
    // Both are their scene's first beat, so both keep establishing framing.
    expect(planned[1]?.shotSize).toBe('全景')
  })

  test("a writer's explicit 特写 is obeyed, not re-planned", () => {
    const directed = shot({ characterIds: ['甲'], dialogue: '低语。', shotSize: '特写' })
    expect(planShotLanguage([directed])[0]?.shotSize).toBe('特写')
  })
})
