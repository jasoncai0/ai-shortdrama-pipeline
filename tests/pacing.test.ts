import { describe, expect, test } from 'vitest'
import { paceBeats, type PacingBeat } from '../src/lib/pacing.js'

const beat = (over: Partial<PacingBeat> = {}): PacingBeat => ({
  sceneName: '云隐寺大殿',
  timeOfDay: '日',
  ...over,
})

describe('narration never shares a shot with dialogue', () => {
  test('a line spoken on screen is never joined by the narrator', () => {
    const { shots } = paceBeats([
      beat({ dialogue: '丑儿,过来,跪下。', narration: '这是一段很长的旁白'.repeat(6) }),
      beat({ dialogue: '看到那盏莲花灯没有?' }),
    ])

    for (const shot of shots) {
      const both = Boolean(shot.dialogue?.trim()) && Boolean(shot.narration?.trim())
      expect(both).toBe(false)
    }
  })

  test('nothing is lost when narration is displaced', () => {
    const narration = '三个月前,暴雨夜,云隐寺佛前一盏长命灯没有熄灭。'
    const { shots } = paceBeats([beat({ dialogue: '过来。', narration }), beat({ dialogue: '跪下。' })])

    expect(shots.map((s) => s.narration ?? '').join('')).toContain(narration)
  })
})

describe('hosting order', () => {
  test('short narration on its own silent beat costs no extra shot', () => {
    const { shots, narrationInserts } = paceBeats([beat({ narration: '雨夜。' })])

    expect(narrationInserts).toBe(0)
    expect(shots).toHaveLength(1)
    expect(shots[0]?.narration).toBe('雨夜。')
  })

  test('prefers a nearby silent beat over inventing a cutaway', () => {
    const narration = '这段旁白略长一些,放不进带台词的镜头里。'
    const { shots, narrationInserts } = paceBeats([
      beat({ dialogue: '你做梦!', narration }),
      beat({}), // silent, can host
    ])

    expect(narrationInserts).toBe(0)
    expect(shots.filter((s) => s.kind === 'insert')).toHaveLength(0)
    expect(shots[1]?.narration).toBe(narration)
  })

  test('adds a breath only when no silent beat is within reach', () => {
    const narration = '一段无处安放的旁白,前后都是台词。'
    const { shots, narrationInserts } = paceBeats([
      beat({ dialogue: '甲说话。', narration }),
      beat({ dialogue: '乙说话。' }),
      beat({ dialogue: '丙说话。' }),
    ])

    expect(narrationInserts).toBe(1)
    const insert = shots.find((s) => s.insertRole === 'narration')
    expect(insert?.narration).toBe(narration)
    expect(insert?.dialogue).toBeUndefined()
    expect(insert?.insertDescription).toContain('无人物')
  })
})

describe('scene transitions', () => {
  test('a location change earns an atmosphere shot', () => {
    const { shots, transitionInserts } = paceBeats([
      beat({ sceneName: '云隐寺大殿', dialogue: 'a' }),
      beat({ sceneName: '明镜湖畔山道', dialogue: 'b' }),
    ])

    expect(transitionInserts).toBe(1)
    const insert = shots.find((s) => s.insertRole === 'transition')
    expect(insert?.sceneName).toBe('明镜湖畔山道')
    expect(insert?.insertDescription).toContain('空镜过渡')
    // The transition precedes the beat it introduces.
    expect(shots.findIndex((s) => s.insertRole === 'transition')).toBe(1)
  })

  test('staying in one location adds nothing', () => {
    const { transitionInserts } = paceBeats([
      beat({ dialogue: 'a' }),
      beat({ dialogue: 'b' }),
      beat({ dialogue: 'c' }),
    ])
    expect(transitionInserts).toBe(0)
  })

  test('can be turned off without affecting narration', () => {
    const { transitionInserts, narrationInserts } = paceBeats(
      [
        beat({ sceneName: 'A', dialogue: 'a', narration: '无处安放的旁白'.repeat(8) }),
        beat({ sceneName: 'B', dialogue: 'b' }),
        beat({ sceneName: 'B', dialogue: 'c' }),
      ],
      { transitionInserts: false, hostReach: 0 },
    )
    expect(transitionInserts).toBe(0)
    expect(narrationInserts).toBe(1)
  })
})

describe('insert budget', () => {
  test('rations transitions but never narration — a dropped line is a bug', () => {
    // 10 location changes, but only a few transitions are affordable.
    const beats = Array.from({ length: 10 }, (_v, i) =>
      beat({ sceneName: `场景${i}`, dialogue: `台词${i}`, narration: '一段放不下的旁白'.repeat(8) }),
    )
    const { narrationInserts, transitionInserts, suppressed } = paceBeats(beats, {
      maxInsertRatio: 0.2,
    })

    expect(transitionInserts).toBeLessThanOrEqual(2)
    expect(suppressed).toBeGreaterThan(0)
    // Every displaced line still got its breath.
    expect(narrationInserts).toBe(10)
  })

  test('every line survives even with transitions switched off entirely', () => {
    const beats = [
      beat({ dialogue: 'a', narration: '第一段放不下的旁白'.repeat(8) }),
      beat({ dialogue: 'b', narration: '第二段放不下的旁白'.repeat(8) }),
    ]
    const { shots } = paceBeats(beats, { maxInsertRatio: 0, transitionInserts: false })

    const all = shots.map((s) => s.narration ?? '').join('')
    expect(all).toContain('第一段放不下的旁白')
    expect(all).toContain('第二段放不下的旁白')
    for (const shot of shots) {
      expect(Boolean(shot.dialogue?.trim()) && Boolean(shot.narration?.trim())).toBe(false)
    }
  })
})

describe('no state leaks between calls', () => {
  test('two identical calls give identical results', () => {
    const beats = [beat({ dialogue: 'a', narration: '旁白'.repeat(40) }), beat({ dialogue: 'b' })]
    expect(JSON.stringify(paceBeats(beats))).toBe(JSON.stringify(paceBeats(beats)))
  })
})

describe('subtitle voice distinction', () => {
  test('narration is italicised so it cannot be mistaken for a line', async () => {
    const { buildSrt } = await import('../src/lib/srt.js')
    const srt = buildSrt([
      { start: 0, end: 3, text: '丑儿,过来。', kind: 'dialogue' },
      { start: 3, end: 6, text: '没人知道,那个少年已经不在了。', kind: 'narration' },
    ])

    expect(srt).toContain('丑儿,过来。')
    expect(srt).not.toContain('<i>丑儿')
    expect(srt).toMatch(/<i>没人知道/)
    expect(srt).toMatch(/不在了。<\/i>/)
  })

  test('a speaker label is opt-in and never applied to the narrator', async () => {
    const { buildSrt } = await import('../src/lib/srt.js')
    const srt = buildSrt(
      [
        { start: 0, end: 3, text: '过来。', kind: 'dialogue', speaker: '陈母李氏' },
        { start: 3, end: 6, text: '那是十年前的事。', kind: 'narration', speaker: '陈母李氏' },
      ],
      { showSpeaker: true },
    )

    expect(srt).toContain('陈母李氏：过来。')
    expect(srt).not.toContain('陈母李氏：那是十年前')
  })

  test('italics can be turned off without losing the text', async () => {
    const { buildSrt } = await import('../src/lib/srt.js')
    const srt = buildSrt([{ start: 0, end: 3, text: '旁白一句。', kind: 'narration' }], {
      markNarration: false,
    })
    expect(srt).toContain('旁白一句。')
    expect(srt).not.toContain('<i>')
  })
})

describe('clause split fallback', () => {
  test('splits a wedged line at clause punctuation, keeping terminators', async () => {
    const { clauseSplit } = await import('../src/plugins/stage/dub.js')
    expect(clauseSplit('你!目无尊长!')).toEqual(['你!', '目无尊长!'])
  })

  test('loses not one character', async () => {
    const { clauseSplit } = await import('../src/plugins/stage/dub.js')
    const line = '好说。你西楼拨十顷田给北楼,我让儿子替你扛差!'
    expect(clauseSplit(line).join('')).toBe(line)
  })

  test('a line with no punctuation cannot be split, so the caller must rethrow', async () => {
    const { clauseSplit } = await import('../src/plugins/stage/dub.js')
    expect(clauseSplit('目无尊长')).toHaveLength(1)
  })

  test('drops nothing but whitespace', async () => {
    const { clauseSplit } = await import('../src/plugins/stage/dub.js')
    expect(clauseSplit('  甲, 乙。  ')).toEqual(['甲,', '乙。'])
  })
})
