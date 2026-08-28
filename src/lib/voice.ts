import type { Character, Shot } from '../kernel/types.js'

/**
 * Voice discipline — the casting and narration rules, as pure checkable logic.
 *
 * The rules (production requirements, not stylistic preferences):
 *  1. The narrator is an independent timbre. If any shot carries narration,
 *     a dedicated `narratorVoice` MUST be configured — falling back to the
 *     adapter default would let the narrator drift between runs.
 *  2. No character may be cast with the narrator's voice. The (OS) voice is
 *     not a person in the scene; sharing it collapses the two roles.
 *  3. A character's voice should fit the character — casting is per-character
 *     and duplicates across characters are reported, because two leads sharing
 *     one timbre is the audio version of two leads sharing one face.
 *  4. Narration is a transition device, not the delivery mechanism: its share
 *     of shots is capped and long consecutive narration runs are flagged.
 *
 * `dub` enforces 1–3 before spending anything; `voice-check` lints 1–4 right
 * after `shots`, when a fix costs one regeneration instead of a re-dub.
 */

export interface CastingInput {
  readonly characters: readonly Character[]
  readonly shots: readonly Shot[]
  /** character name → provider voice id */
  readonly voices: Readonly<Record<string, unknown>>
  readonly narratorVoice?: string
}

export interface VoiceFindings {
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

export const validateVoiceCasting = (input: CastingInput): VoiceFindings => {
  const errors: string[] = []
  const warnings: string[] = []

  const hasNarration = input.shots.some((s) => s.narration?.trim())
  const speakingIds = new Set(
    input.shots.filter((s) => s.dialogue?.trim()).flatMap((s) => s.characterIds),
  )
  const speakingNames = input.characters
    .filter((c) => speakingIds.has(c.id))
    .map((c) => c.name)

  // Rule 1 — narration demands its own, explicit timbre.
  if (hasNarration && !input.narratorVoice) {
    errors.push(
      '旁白存在但未配置 narratorVoice。旁白音必须是独立音色，不允许回落到适配器默认音。',
    )
  }

  // Rule 2 — no character may borrow the narrator's voice.
  if (input.narratorVoice) {
    for (const [name, voice] of Object.entries(input.voices)) {
      if (typeof voice === 'string' && voice === input.narratorVoice) {
        errors.push(`角色 "${name}" 使用了旁白音色 "${voice}"。角色音不能使用旁白音。`)
      }
    }
  }

  // Rule 3 — one voice, one character; and every speaking character is cast.
  const byVoice = new Map<string, string[]>()
  for (const [name, voice] of Object.entries(input.voices)) {
    if (typeof voice !== 'string' || voice.length === 0) continue
    byVoice.set(voice, [...(byVoice.get(voice) ?? []), name])
  }
  for (const [voice, names] of byVoice) {
    if (names.length > 1) {
      warnings.push(`角色 ${names.join('、')} 共用音色 "${voice}" — 每个角色应有贴合人设的独立音色。`)
    }
  }
  for (const name of speakingNames) {
    if (typeof input.voices[name] !== 'string' || !(input.voices[name] as string)) {
      warnings.push(`说话角色 "${name}" 未指定音色，将回落到适配器默认音（可能与他人撞声）。`)
    }
  }

  return { errors, warnings }
}

export interface NarrationPolicy {
  /** Max share of shots that may carry narration. Default 0.3. */
  readonly maxRatio?: number
  /** Max consecutive narration shots before it stops being a transition. Default 2. */
  readonly maxRun?: number
}

export interface NarrationReport {
  readonly narrated: number
  readonly total: number
  readonly ratio: number
  readonly findings: readonly string[]
}

/**
 * Rule 4 — narration as seasoning, not the meal. Runs are judged per episode
 * in shot order, like camera repetition.
 */
export const narrationReport = (
  shots: readonly Shot[],
  policy: NarrationPolicy = {},
): NarrationReport => {
  const maxRatio = policy.maxRatio ?? 0.3
  const maxRun = policy.maxRun ?? 2
  const findings: string[] = []

  const narrated = shots.filter((s) => s.narration?.trim()).length
  const total = shots.length
  const ratio = total === 0 ? 0 : narrated / total

  if (total > 0 && ratio > maxRatio) {
    findings.push(
      `旁白镜头 ${narrated}/${total} (${Math.round(ratio * 100)}%) 超过上限 ${Math.round(maxRatio * 100)}% — 旁白仅作过渡用，把叙事还给台词和画面。`,
    )
  }

  const byEpisode = new Map<string, Shot[]>()
  for (const shot of shots) {
    byEpisode.set(shot.episodeId, [...(byEpisode.get(shot.episodeId) ?? []), shot])
  }
  for (const [episodeId, episodeShots] of byEpisode) {
    const ordered = [...episodeShots].sort((a, b) => a.order - b.order)
    let run = 0
    let runStart = ''
    for (const shot of ordered) {
      if (shot.narration?.trim()) {
        run += 1
        if (run === 1) runStart = shot.id
        if (run === maxRun + 1) {
          findings.push(
            `${episodeId}: 自 ${runStart} 起连续 ${run} 镜都有旁白 — 连续旁白超过 ${maxRun} 镜就不再是过渡，改写成台词或纯画面。`,
          )
        }
      } else {
        run = 0
      }
    }
  }

  // Wall-to-wall narration is a different failure from "a bit over the cap".
  if (total >= 4 && narrated === total) {
    findings.push('全程旁白：每一镜都有旁白。这是幻灯片配音，不是短剧。')
  }

  return { narrated, total, ratio, findings }
}

/**
 * The on-screen speech cue for a shot's video prompt: dialogue shots need
 * visible, line-synced lip movement from the right character; narration-only
 * shots must NOT show anyone mouthing words the narrator is speaking.
 */
export const speechCue = (
  shot: Shot,
  speakerName: string | undefined,
): string => {
  const line = shot.dialogue?.trim()
  if (line) {
    const speaker = speakerName ?? 'the character'
    return `${speaker} speaks on camera: "${line}" — natural, clearly visible lip movement synced to the line, facial expression matching the delivery`
  }
  if (shot.narration?.trim() && shot.characterIds.length > 0) {
    return 'no on-screen character is speaking; mouths stay closed or neutral (voice-over only)'
  }
  return ''
}
