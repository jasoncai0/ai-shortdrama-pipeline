/**
 * Pacing: where narration lives, and where a scene change needs a breath.
 *
 * Two problems this solves, both found by watching a cut rather than reading a
 * log:
 *
 * 1. **Narration stacked on dialogue.** Gluing a voice-over onto a shot that
 *    already has a spoken line means both are synthesised into one take and
 *    talk over each other. Here a narrator and a character never share a shot.
 *
 * 2. **Hard cuts between locations.** Jumping from a temple interior to a
 *    lakeside path on a frame boundary reads as a mistake. A short atmosphere
 *    shot — sky, courtyard, water — carries the eye across.
 *
 * Both are solved by the same device: an *insert* shot. Written as pure
 * functions over plain data, in two passes, so pacing can be tested without
 * generating anything and without any state surviving a call.
 */

export interface PacingBeat {
  /** Dialogue spoken on screen. Immovable — a person is saying it. */
  readonly dialogue?: string
  /** Voice-over waiting for somewhere to sit. */
  readonly narration?: string
  readonly sceneName: string
  readonly timeOfDay: string
}

export interface PacedShot extends PacingBeat {
  readonly kind: 'beat' | 'insert'
  readonly insertRole?: 'narration' | 'transition'
  /** Set on inserts: what the picture should show. */
  readonly insertDescription?: string
  /**
   * Index of the beat this came from, so a caller can recover the parsed
   * script line. Absent on inserts, which have no line of their own.
   */
  readonly sourceIndex?: number
}

export interface PacingOptions {
  /** Characters of narration one shot can carry, derived from its length. */
  readonly narrationCharBudget: number
  /** Add an atmosphere shot when the location changes. */
  readonly transitionInserts: boolean
  /**
   * Ceiling on *transition* inserts as a fraction of the script's own beats.
   * Transitions are polish and can be rationed. Narration inserts are not
   * rationed at all: the line is in the script, and dropping it to protect a
   * pacing target trades a correctness failure for a cosmetic one.
   */
  readonly maxInsertRatio: number
  /** How far ahead narration may travel to find a silent host. */
  readonly hostReach: number
  /**
   * Where narration is allowed to land.
   *
   * 'inserts' (default): only on breathing shots of its own — never over a
   * story beat. Riding a silent story beat sounded free but competes with the
   * action on screen; the (OS) voice belongs on connective tissue.
   * 'hosted': the old behaviour — a nearby silent beat may carry it.
   */
  readonly narrationPlacement: 'inserts' | 'hosted'
  /**
   * Most narration a single scene may keep, as insert shots. The genre's (OS)
   * voice is exposition; two breaths per scene is plenty, and everything past
   * that slows the story more than it informs. Dropped lines are counted and
   * reported, never silently lost.
   */
  readonly maxNarrationPerScene: number
}

export const DEFAULT_PACING: PacingOptions = {
  narrationCharBudget: 60,
  transitionInserts: true,
  maxInsertRatio: 0.4,
  hostReach: 2,
  narrationPlacement: 'inserts',
  maxNarrationPerScene: 2,
}

export interface PacingResult {
  readonly shots: readonly PacedShot[]
  readonly narrationInserts: number
  readonly transitionInserts: number
  /** Scene changes that got no transition because the ration ran out. */
  readonly suppressed: number
  /** Narration lines dropped by the per-scene cap. */
  readonly droppedNarration: number
}

/**
 * Narration is offered a home in this order:
 *   1. the beat it belongs to, if that beat has no dialogue and room;
 *   2. a nearby later beat that is silent;
 *   3. an insert shot of its own.
 *
 * Preferring an existing silent beat matters: it costs nothing to generate, and
 * a voice-over over real action is better filmmaking than a cutaway to sky.
 */
export const paceBeats = (
  beats: readonly PacingBeat[],
  options: Partial<PacingOptions> = {},
): PacingResult => {
  const opts = { ...DEFAULT_PACING, ...options }

  // ── pass 1: decide where every line of narration goes ─────────────────
  const hosted = new Map<number, string[]>()   // beat index → narration to speak
  const needsInsert: number[] = []             // beat index → wants its own breath

  const roomAt = (index: number): number => {
    const beat = beats[index]
    if (!beat || beat.dialogue?.trim()) return 0
    const used = (hosted.get(index) ?? []).join('').length
    return opts.narrationCharBudget - used
  }

  let droppedNarration = 0
  const narrationPerScene = new Map<string, number>()

  for (const [index, beat] of beats.entries()) {
    const narration = beat.narration?.trim()
    if (!narration) continue

    // The per-scene ration comes first: a scene drowning in (OS) voice stops
    // being a scene. What survives goes on its own breath by default.
    const taken = narrationPerScene.get(beat.sceneName) ?? 0
    if (taken >= opts.maxNarrationPerScene) {
      droppedNarration += 1
      continue
    }
    narrationPerScene.set(beat.sceneName, taken + 1)

    if (opts.narrationPlacement === 'hosted') {
      if (roomAt(index) >= narration.length) {
        hosted.set(index, [...(hosted.get(index) ?? []), narration])
        continue
      }
      const host = findSilentHost(beats, index, opts.hostReach, roomAt, narration.length)
      if (host !== undefined) {
        hosted.set(host, [...(hosted.get(host) ?? []), narration])
        continue
      }
    }

    needsInsert.push(index)
  }

  // ── pass 2: lay out the shots ─────────────────────────────────────────
  // Transitions are rationed; narration is not. A scene change with no breath
  // is the abrupt cut we set out to fix, so a sequence that changes location at
  // all gets at least one.
  const sceneChanges = opts.transitionInserts ? countSceneChanges(beats) : 0
  const transitionAllowance =
    sceneChanges === 0 ? 0 : Math.max(1, Math.round(beats.length * opts.maxInsertRatio))

  const out: PacedShot[] = []
  let narrationInserts = 0
  let transitionsUsed = 0
  let previousScene: string | undefined

  for (const [index, beat] of beats.entries()) {
    if (
      opts.transitionInserts &&
      previousScene !== undefined &&
      beat.sceneName !== previousScene &&
      transitionsUsed < transitionAllowance
    ) {
      out.push({
        kind: 'insert',
        insertRole: 'transition',
        sceneName: beat.sceneName,
        timeOfDay: beat.timeOfDay,
        insertDescription: transitionDescription(beat),
      })
      transitionsUsed += 1
    }
    previousScene = beat.sceneName

    const carried = hosted.get(index)
    out.push({
      ...beat,
      kind: 'beat',
      sourceIndex: index,
      narration: carried ? carried.join('') : undefined,
    })

    if (needsInsert.includes(index)) {
      out.push({
        kind: 'insert',
        insertRole: 'narration',
        narration: beat.narration?.trim() ?? '',
        sceneName: beat.sceneName,
        timeOfDay: beat.timeOfDay,
        insertDescription: narrationDescription(beat),
      })
      narrationInserts += 1
    }
  }

  return {
    shots: out,
    droppedNarration,
    narrationInserts,
    transitionInserts: transitionsUsed,
    suppressed: Math.max(0, sceneChanges - transitionsUsed),
  }
}

const countSceneChanges = (beats: readonly PacingBeat[]): number => {
  let changes = 0
  let previous: string | undefined
  for (const beat of beats) {
    if (previous !== undefined && beat.sceneName !== previous) changes += 1
    previous = beat.sceneName
  }
  return changes
}

/**
 * The next silent beat with room, within a short reach. Looking further would
 * separate the narration from what it describes.
 */
const findSilentHost = (
  beats: readonly PacingBeat[],
  from: number,
  reach: number,
  roomAt: (index: number) => number,
  needed: number,
): number | undefined => {
  for (let i = from + 1; i <= Math.min(from + reach, beats.length - 1); i += 1) {
    if (roomAt(i) >= needed) return i
  }
  return undefined
}

/** Atmosphere of the place, no people — a shot that cannot contradict anything. */
/**
 * Words that mean the destination is under a roof.
 *
 * Deliberately a small list of the words a Chinese screenplay actually uses for
 * a room; anything unmatched is treated as exterior, which is the safe default
 * (a sky over an exterior is never wrong).
 */
const INTERIOR_WORDS = [
  '堂',
  '殿',
  '室',
  '房',
  '厅',
  '楼',
  '屋',
  '内',
  '书斋',
  '灶',
  '寺内',
]

const isInterior = (sceneName: string): boolean =>
  INTERIOR_WORDS.some((word) => sceneName.includes(word))

/**
 * A transition is the *approach* to the next scene, not a look at it.
 *
 * Cutting to the empty room you are about to walk into reads as a continuity
 * mistake rather than a transition, so an interior destination gets the sky and
 * eaves above it and an exterior gets the wide landscape — in both cases the
 * shot the audience would see on the way there.
 */
export const transitionDescription = (beat: PacingBeat): string =>
  isInterior(beat.sceneName)
    ? `${beat.sceneName}屋外的空镜过渡, 无人物, 屋檐飞角与其上的天空, ${beat.timeOfDay}的天光`
    : `${beat.sceneName}的空镜过渡, 无人物, 开阔的天空与远景, ${beat.timeOfDay}的天光`

export const narrationDescription = (beat: PacingBeat): string =>
  `${beat.sceneName}的空镜留白, 无人物, ${beat.timeOfDay}的光线与静物`
