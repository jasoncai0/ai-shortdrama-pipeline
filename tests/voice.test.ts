import { describe, expect, test } from 'vitest'
import { narrationReport, resolveCasting, speechCue, validateVoiceCasting } from '../src/lib/voice.js'
import type { Character, Shot } from '../src/kernel/types.js'

const char = (id: string, name: string): Character =>
  ({ id, name, appearance: 'x' }) as Character

const shot = (partial: Partial<Shot> & { id: string; order: number }): Shot =>
  ({
    episodeId: 'ep1',
    durationSeconds: 4,
    plotDescription: 'p',
    characterIds: [],
    propIds: [],
    status: 'draft',
    ...partial,
  }) as Shot

describe('validateVoiceCasting', () => {
  test('narration without a dedicated narrator voice is an error', () => {
    // Arrange
    const shots = [shot({ id: 's1', order: 1, narration: '三年前的那个雨夜…' })]

    // Act
    const result = validateVoiceCasting({ characters: [], shots, voices: {} })

    // Assert
    expect(result.errors.some((e) => e.includes('narratorVoice'))).toBe(true)
  })

  test('a character cast on the narrator voice is an error', () => {
    const shots = [shot({ id: 's1', order: 1, narration: '过渡' })]
    const result = validateVoiceCasting({
      characters: [char('c1', '李明')],
      shots,
      voices: { 李明: 'calm-male-01' },
      narratorVoice: 'calm-male-01',
    })
    expect(result.errors.some((e) => e.includes('李明') && e.includes('旁白'))).toBe(true)
  })

  test('two characters sharing one voice is a warning', () => {
    const result = validateVoiceCasting({
      characters: [char('c1', '哥哥'), char('c2', '弟弟')],
      shots: [],
      voices: { 哥哥: 'v1', 弟弟: 'v1' },
      narratorVoice: 'v9',
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes('共用音色'))).toBe(true)
  })

  test('a speaking character with no cast voice is a warning', () => {
    const shots = [shot({ id: 's1', order: 1, dialogue: '你是谁？', characterIds: ['c1'] })]
    const result = validateVoiceCasting({
      characters: [char('c1', '林默')],
      shots,
      voices: {},
    })
    expect(result.warnings.some((w) => w.includes('林默'))).toBe(true)
  })

  test('a clean cast passes with no findings', () => {
    const shots = [
      shot({ id: 's1', order: 1, dialogue: '走。', characterIds: ['c1'] }),
      shot({ id: 's2', order: 2, narration: '当晚。' }),
    ]
    const result = validateVoiceCasting({
      characters: [char('c1', '林默')],
      shots,
      voices: { 林默: 'v1' },
      narratorVoice: 'v9',
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})

describe('narrationReport', () => {
  test('flags a narration share above the cap', () => {
    const shots = [
      shot({ id: 's1', order: 1, narration: 'a' }),
      shot({ id: 's2', order: 2, narration: 'b' }),
      shot({ id: 's3', order: 3 }),
      shot({ id: 's4', order: 4 }),
    ]
    const report = narrationReport(shots, { maxRatio: 0.3, maxRun: 3 })
    expect(report.ratio).toBe(0.5)
    expect(report.findings.some((f) => f.includes('超过上限'))).toBe(true)
  })

  test('flags consecutive narration runs beyond maxRun', () => {
    const shots = [
      shot({ id: 's1', order: 1, narration: 'a' }),
      shot({ id: 's2', order: 2, narration: 'b' }),
      shot({ id: 's3', order: 3, narration: 'c' }),
      shot({ id: 's4', order: 4 }),
      shot({ id: 's5', order: 5 }),
      shot({ id: 's6', order: 6 }),
      shot({ id: 's7', order: 7 }),
      shot({ id: 's8', order: 8 }),
      shot({ id: 's9', order: 9 }),
      shot({ id: 's10', order: 10 }),
    ]
    const report = narrationReport(shots, { maxRun: 2 })
    expect(report.findings.some((f) => f.includes('连续'))).toBe(true)
  })

  test('wall-to-wall narration gets its own finding', () => {
    const shots = [1, 2, 3, 4].map((i) =>
      shot({ id: `s${i}`, order: i, narration: `n${i}` }),
    )
    const report = narrationReport(shots)
    expect(report.findings.some((f) => f.includes('全程旁白'))).toBe(true)
  })

  test('transition-only narration passes clean', () => {
    const shots = [
      shot({ id: 's1', order: 1, dialogue: 'a', characterIds: ['c1'] }),
      shot({ id: 's2', order: 2, narration: '次日清晨。' }),
      shot({ id: 's3', order: 3, dialogue: 'b', characterIds: ['c1'] }),
      shot({ id: 's4', order: 4 }),
    ]
    const report = narrationReport(shots)
    expect(report.findings).toHaveLength(0)
  })
})

describe('speechCue', () => {
  test('dialogue shot names the speaker and demands synced lip movement', () => {
    const cue = speechCue(
      shot({ id: 's1', order: 1, dialogue: '你到底是谁？', characterIds: ['c1'] }),
      '林默',
    )
    expect(cue).toContain('林默')
    expect(cue).toContain('lip movement synced')
  })

  test('narration-only shot with people in frame forbids on-screen speech', () => {
    const cue = speechCue(
      shot({ id: 's1', order: 1, narration: '当晚。', characterIds: ['c1'] }),
      '林默',
    )
    expect(cue).toContain('no on-screen character is speaking')
  })

  test('silent shot yields no cue', () => {
    expect(speechCue(shot({ id: 's1', order: 1 }), undefined)).toBe('')
  })
})

describe('resolveCasting — voice as part of the character design', () => {
  const project = {
    characters: [
      { ...char('c1', '林默'), voice: { profile: '二十多岁男声，偏沙哑，语速快', voiceId: 'v-lin' } },
      { ...char('c2', '王队长'), voice: { profile: '四十岁男声，沉稳有威' } },
    ],
    narrator: { profile: '中年男声，低沉平稳，纪录片质感', voiceId: 'v-narrator' },
  }

  test('character-designed voiceIds and the narrator persona are the defaults', () => {
    const casting = resolveCasting(project)
    expect(casting.voices['林默']).toBe('v-lin')
    expect(casting.voices['王队长']).toBeUndefined()
    expect(casting.narratorVoice).toBe('v-narrator')
    expect(casting.briefs['王队长']).toContain('沉稳')
    expect(casting.narratorBrief).toContain('纪录片')
  })

  test('stage options override the designed casting without editing characters', () => {
    const casting = resolveCasting(project, {
      voices: { 林默: 'v-alt' },
      narratorVoice: 'v-narr-alt',
    })
    expect(casting.voices['林默']).toBe('v-alt')
    expect(casting.narratorVoice).toBe('v-narr-alt')
  })

  test('uncast speaker with a brief gets an actionable warning quoting it', () => {
    const casting = resolveCasting(project)
    const shots = [shot({ id: 's1', order: 1, dialogue: '收队。', characterIds: ['c2'] })]
    const result = validateVoiceCasting({
      characters: project.characters,
      shots,
      voices: casting.voices,
      narratorVoice: casting.narratorVoice,
      briefs: casting.briefs,
    })
    expect(result.warnings.some((w) => w.includes('王队长') && w.includes('沉稳有威'))).toBe(true)
  })
})
