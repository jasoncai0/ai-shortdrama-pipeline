import type { Character, Project, Shot } from '../kernel/types.js'

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
 *  5. The narrator voice never shares a shot with dialogue. A shot with a line
 *     is that character's; narration written into it is dropped rather than
 *     spoken, because two voices over one performance is the overlap this
 *     whole module exists to prevent.
 *  6. The narrator only opens and closes the cut. Narration belongs to the
 *     first and last shots of the assembled video; anywhere in the middle it
 *     is talking over the drama instead of framing it.
 *
 * `dub` enforces 1–3, 5 and 6 before spending anything; `voice-check` lints
 * all of them right after `shots`, when a fix costs one regeneration instead
 * of a re-dub.
 */

/**
 * Effective casting for a project: the voice designed into each character's
 * 人设 is the source of truth; stage options override per run (a re-dub with
 * a different provider should not require editing the character).
 */
export interface ResolvedCasting {
  /** character name → provider voice id (only cast characters appear). */
  readonly voices: Readonly<Record<string, string>>
  readonly narratorVoice?: string
  /** character name → casting brief, for picking a voiceId that fits. */
  readonly briefs: Readonly<Record<string, string>>
  readonly narratorBrief?: string
}

export const resolveCasting = (
  project: Pick<Project, 'characters' | 'narrator'>,
  overrides: { voices?: Readonly<Record<string, unknown>>; narratorVoice?: string } = {},
): ResolvedCasting => {
  const voices: Record<string, string> = {}
  const briefs: Record<string, string> = {}
  for (const c of project.characters) {
    if (c.voice?.voiceId) voices[c.name] = c.voice.voiceId
    if (c.voice?.profile) briefs[c.name] = c.voice.profile
  }
  for (const [name, voice] of Object.entries(overrides.voices ?? {})) {
    if (typeof voice === 'string' && voice.length > 0) voices[name] = voice
  }
  return {
    voices,
    narratorVoice: overrides.narratorVoice ?? project.narrator?.voiceId,
    briefs,
    narratorBrief: project.narrator?.profile,
  }
}

export interface CastingInput {
  readonly characters: readonly Character[]
  readonly shots: readonly Shot[]
  /** character name → provider voice id */
  readonly voices: Readonly<Record<string, unknown>>
  readonly narratorVoice?: string
  /** character name → casting brief, used to make uncast warnings actionable. */
  readonly briefs?: Readonly<Record<string, string>>
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
      const brief = input.briefs?.[name]
      warnings.push(
        brief
          ? `说话角色 "${name}" 已有音色人设「${brief}」但未选定 voiceId — 按人设挑一个贴合的音色。`
          : `说话角色 "${name}" 未指定音色，将回落到适配器默认音（可能与他人撞声）。`,
      )
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

export interface NarrationPlacementPolicy {
  /** Shots at the head of the cut that may carry narration. Default 1. */
  readonly openingShots?: number
  /** Shots at the tail of the cut that may carry narration. Default 1. */
  readonly closingShots?: number
}

export interface NarrationPlacement {
  /** Shot ids whose narration may be spoken: the opening and closing zones. */
  readonly allowed: ReadonlySet<string>
  /** Narration written into the middle of the cut — never spoken. */
  readonly middle: readonly string[]
  /** Shots carrying both a line and narration — the narration is dropped. */
  readonly mixed: readonly string[]
  readonly findings: readonly string[]
}

/**
 * Shots in playback order: episode order first, shot order within it. Export
 * concatenates the whole project into one cut, so "the start of the video" is
 * the first shot of the first episode, not of each episode.
 */
export const orderedShots = (
  shots: readonly Shot[],
  episodeIds?: readonly string[],
): readonly Shot[] => {
  const rank = new Map((episodeIds ?? []).map((id, index) => [id, index]))
  const fallback = (id: string): number => {
    const digits = id.match(/\d+/)
    return digits ? Number(digits[0]) : Number.MAX_SAFE_INTEGER
  }
  return [...shots].sort((a, b) => {
    const ea = rank.get(a.episodeId) ?? fallback(a.episodeId)
    const eb = rank.get(b.episodeId) ?? fallback(b.episodeId)
    return ea !== eb ? ea - eb : a.order - b.order
  })
}

/**
 * Rules 5 and 6 — where the narrator is allowed to speak at all.
 *
 * Zones are computed over the whole cut. A one-shot project is both the
 * opening and the closing, which is correct: there is no middle to intrude on.
 */
export const narrationPlacement = (
  shots: readonly Shot[],
  policy: NarrationPlacementPolicy = {},
  episodeIds?: readonly string[],
): NarrationPlacement => {
  const openingShots = Math.max(0, policy.openingShots ?? 1)
  const closingShots = Math.max(0, policy.closingShots ?? 1)
  const ordered = orderedShots(shots, episodeIds)

  const allowed = new Set<string>()
  for (const shot of ordered.slice(0, openingShots)) allowed.add(shot.id)
  for (const shot of ordered.slice(Math.max(0, ordered.length - closingShots))) {
    allowed.add(shot.id)
  }

  const middle: string[] = []
  const mixed: string[] = []
  const findings: string[] = []

  for (const shot of ordered) {
    if (!shot.narration?.trim()) continue
    if (shot.dialogue?.trim()) {
      mixed.push(shot.id)
      continue
    }
    if (!allowed.has(shot.id)) middle.push(shot.id)
  }

  if (mixed.length > 0) {
    findings.push(
      `${mixed.join('、')} 同时有台词和旁白 — 有对白的镜头不使用旁白音，旁白会被丢弃；把这些信息写进台词或画面。`,
    )
  }
  if (middle.length > 0) {
    findings.push(
      `${middle.join('、')} 的旁白位于片中 — 旁白只用在成片的最开头（前 ${openingShots} 镜）和最结尾（后 ${closingShots} 镜），中间段不使用旁白音。`,
    )
  }

  return { allowed, middle, mixed, findings }
}

/**
 * What `dub` should actually say for one shot, and in whose voice.
 *
 * `undefined` means the shot is silent: either it carries nothing spoken, or
 * its narration is disallowed by placement (mid-cut, or sharing a shot with a
 * line). The reason is returned so the caller can report it rather than
 * dropping script silently.
 */
export const spokenLine = (
  shot: Shot,
  context: {
    readonly speakerVoice?: string
    readonly narratorVoice?: string
    readonly includeNarration: boolean
    readonly narrationAllowed: boolean
  },
):
  | { readonly text: string; readonly voice?: string; readonly role: 'dialogue' | 'narration' }
  | { readonly skipped: 'mixed' | 'placement' | 'none' } => {
  const line = shot.dialogue?.trim()
  const narration = shot.narration?.trim()

  // Rule 5: the line owns the shot. Narration alongside it is never voiced.
  if (line) return { text: line, voice: context.speakerVoice, role: 'dialogue' }
  if (!narration) return { skipped: 'none' }
  if (!context.includeNarration) return { skipped: 'none' }
  if (!context.narrationAllowed) return { skipped: 'placement' }
  return { text: narration, voice: context.narratorVoice, role: 'narration' }
}
