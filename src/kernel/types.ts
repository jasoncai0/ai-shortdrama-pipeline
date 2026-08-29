/**
 * Domain model. Everything here is plain data — no behavior, no I/O.
 *
 * Design rule: assets (character / scene / prop) are first-class entities.
 * A Shot references them by id; it never copies their description. Prompt text
 * is a *compiled artifact*, recomputed from the referenced entities, so editing
 * a character updates every shot that references it.
 */

export type AspectRatio = '9:16' | '16:9' | '1:1'

export type ProjectKind = 'shortdrama' | 'comic' | 'ad' | 'custom'

/** The single hard currency for binary data across every provider. */
export interface AssetRef {
  /** Content-addressed id (sha256 prefix) — stable across providers. */
  readonly id: string
  /** file:///... | https://... | libtv://node/<nodeKey> */
  readonly uri: string
  readonly mime: string
  readonly bytes?: number
  readonly meta: Readonly<Record<string, unknown>>
}

export interface ProjectPlan {
  readonly title: string
  readonly genre: string
  readonly logline: string
  readonly mainPlot: string
  readonly sellingPoints: readonly string[]
  readonly conflicts: readonly string[]
  readonly styleGuide: string
}

/**
 * One outfit for a character.
 *
 * The description covers the garments and nothing else. Face, build, hair and
 * age live on the Character and must not be restated here — a look that
 * re-describes the person is a look that will drift into a different person.
 */
/**
 * A voice is part of the character design, same as a face.
 *
 * `profile` is the casting brief — gender, age, texture, pace, emotional
 * default — written at asset time by the same pass that writes appearance,
 * so the voice fits the person by construction. `voiceId` is the provider
 * timbre chosen for that brief; empty until cast.
 *
 * The narrator gets the same shape on the Project: the (OS) voice is a
 * designed persona too, just not one that appears on screen.
 */
export interface VoicePersona {
  /** Casting brief: 性别/年龄/质感/语速/情绪基调. */
  readonly profile: string
  /** Provider voice id once cast. */
  readonly voiceId?: string
}

export interface WardrobeLook {
  readonly id: string
  /** How the production refers to it: 常服, 夜行衣, 婚服. */
  readonly label: string
  /** English description of the garments, materials and silhouette only. */
  readonly description: string
  /** When the story puts them in it — used to assign looks to shots. */
  readonly occasion?: string
  readonly image?: AssetRef
}

export interface Character {
  readonly id: string
  readonly name: string
  /** Appearance / wardrobe / hair / makeup — fed verbatim into prompts. */
  readonly appearance: string
  readonly personality?: string
  /** The character's voice design — as much 人设 as the face. */
  readonly voice?: VoicePersona
  /**
   * Leads get wardrobe variants; extras do not. Generating four outfits for a
   * character with two lines is money spent on something nobody will notice.
   */
  readonly billing?: 'lead' | 'supporting' | 'extra'
  /**
   * Outfit variants, all derived from the confirmed `@base` so the face, build
   * and styling stay put while the clothes change.
   */
  readonly wardrobe?: readonly WardrobeLook[]
  /**
   * One-line identity for the intro card — 「外卖员 · 目击者」, not a biography.
   * Shown once, read in about a second, so it has to earn every character.
   */
  readonly epithet?: string
  /** Rendered intro card (PNG with alpha), kept so a re-run does not re-render. */
  readonly introCard?: AssetRef
  /**
   * `@base` — the identity truth source: white-background full-body reference.
   * This is the ONLY character image fed to keyframes and image-to-video.
   */
  readonly refImage?: AssetRef
  /**
   * `@sheet` — a performance board (expressions, head angles, poses, hands)
   * derived from a confirmed `@base`. For human review and prompt authoring
   * only: never used as an identity reference for generation, because its
   * multi-panel layout leaks grid artifacts into the output frame.
   */
  readonly sheetImage?: AssetRef
}

export interface Scene {
  readonly id: string
  readonly name: string
  readonly visualDescription: string
  readonly refImage?: AssetRef
}

export interface Prop {
  readonly id: string
  readonly name: string
  readonly description: string
}

export interface Episode {
  readonly id: string
  readonly index: number
  readonly title: string
  readonly synopsis: string
}

export type ShotStatus =
  | 'draft'
  | 'prompted'
  | 'stilled'
  | 'clipped'
  | 'failed'

/**
 * `beat` is a shot the script asked for. `insert` is one the pipeline added:
 * a breath for narration to sit in, or a scene-change transition. Keeping the
 * distinction lets a later pass judge pacing — twenty inserts in a ninety
 * second episode is a problem no per-shot check would notice.
 */
export type ShotKind = 'beat' | 'insert'

export type InsertRole = 'narration' | 'transition'

export interface Shot {
  readonly id: string
  readonly episodeId: string
  readonly order: number
  readonly kind?: ShotKind
  readonly insertRole?: InsertRole
  readonly durationSeconds: number
  readonly plotDescription: string
  readonly shotSize?: string
  readonly cameraMove?: string
  readonly characterAction?: string
  readonly emotion?: string
  readonly lightingAndAtmosphere?: string
  readonly audioEffects?: string
  readonly dialogue?: string
  /** References, not copies. */
  readonly characterIds: readonly string[]
  /** Which wardrobe look this shot shows, by `WardrobeLook.id`. */
  readonly wardrobeId?: string
  readonly sceneId?: string
  readonly propIds: readonly string[]
  /** Compiled by the prompt strategy; may be hand-overridden. */
  readonly imagePrompt?: string
  readonly videoPrompt?: string
  readonly negativePrompt?: string
  /** Per-shot generation param overrides produced by the prompt strategy. */
  readonly imageParams?: Readonly<Record<string, unknown>>
  readonly videoParams?: Readonly<Record<string, unknown>>
  /**
   * Narration spoken over this shot's picture rather than given a shot of its
   * own. In this genre the (OS) voice carries much of the runtime, and it has
   * no visual subject to anchor a frame on.
   */
  readonly narration?: string
  readonly still?: AssetRef
  readonly clip?: AssetRef
  /** Synthesised speech for `dialogue` + `narration`. */
  readonly voice?: AssetRef
  /** `clip` with `voice` mixed in. `export` prefers this when present. */
  readonly voicedClip?: AssetRef
  readonly status: ShotStatus
  readonly failure?: string
}

/**
 * What a track is licensed for. Unknown is not the same as permitted: a track
 * whose terms we cannot read is refused rather than assumed usable.
 */
export interface MusicLicence {
  /** `cc0`, `by`, `by-nc-nd`, `user-provided`, `generated`, … */
  readonly code: string
  readonly url?: string
  /** Credit line that must ship with the deliverable when the licence needs it. */
  readonly attribution?: string
  readonly commercialUse: boolean | 'unknown'
  readonly derivativesAllowed: boolean | 'unknown'
}

export interface MusicTrack {
  readonly id: string
  readonly title: string
  readonly source: 'local' | 'search' | 'generated'
  readonly provider: string
  readonly seconds?: number
  readonly creator?: string
  readonly tags: readonly string[]
  readonly licence: MusicLicence
  readonly asset: AssetRef
  /** Why the selector picked this one — kept so the choice can be argued with. */
  readonly rationale?: string
}

export interface StageState {
  readonly status: 'pending' | 'running' | 'done' | 'failed' | 'awaiting-input'
  readonly startedAt?: string
  readonly finishedAt?: string
  readonly error?: string
}

export interface Project {
  readonly id: string
  readonly title: string
  readonly kind: ProjectKind
  readonly ratio: AspectRatio
  readonly idea: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly plan?: ProjectPlan
  /** The narrator's voice persona — a designed role, distinct from every character. */
  readonly narrator?: VoicePersona
  readonly episodes: readonly Episode[]
  readonly characters: readonly Character[]
  readonly scenes: readonly Scene[]
  readonly props: readonly Prop[]
  readonly shots: readonly Shot[]
  /** Picture cut, no music, no subtitles. */
  readonly finalCut?: AssetRef
  /** Feed cover (3:4). Separate from finalCut: different ratio, different job. */
  readonly cover?: AssetRef
  readonly coverVariants?: readonly AssetRef[]
  /** Typeset covers: series poster first, then one per episode. */
  readonly posters?: readonly AssetRef[]
  readonly music?: MusicTrack
  /** Rejected candidates, kept so a re-pick needs no new search or generation. */
  readonly musicCandidates?: readonly MusicTrack[]
  /** finalCut with the score mixed under it. */
  readonly scoredCut?: AssetRef
  /** The cut with character intro cards composited in. */
  readonly introCut?: AssetRef
  /** Sidecar .srt built from dialogue and measured clip durations. */
  readonly subtitleFile?: AssetRef
  /** The thing you actually publish: confirmed cut + music + subtitles. */
  readonly deliverable?: AssetRef
  readonly stageState: Readonly<Record<string, StageState>>
  /** Free-form scratch space for adapters (e.g. libtv shotId → nodeKey map). */
  readonly adapterState: Readonly<Record<string, unknown>>
}

/**
 * The clip that IS the picture for a shot.
 *
 * A dubbed shot carries two: the silent original and the voiced mix, and with
 * `padToVoice` the voiced one is longer. Export concatenating one while
 * subtitles time the other walks the captions off the picture — which is
 * exactly what happened. Both callers go through here so they cannot diverge
 * again.
 */
export const renderedClip = (shot: Shot): AssetRef | undefined =>
  shot.voicedClip ?? shot.clip

export const findCharacter = (
  project: Project,
  id: string,
): Character | undefined => project.characters.find((c) => c.id === id)

export const findLook = (
  character: Character,
  id: string | undefined,
): WardrobeLook | undefined =>
  id ? character.wardrobe?.find((w) => w.id === id) : undefined

export const findScene = (
  project: Project,
  id: string,
): Scene | undefined => project.scenes.find((s) => s.id === id)

export const findProp = (project: Project, id: string): Prop | undefined =>
  project.props.find((p) => p.id === id)

/**
 * Episode ids sort as numbers, not strings — "ep10" comes after "ep9", not
 * before "ep2". String comparison put episode 10 at the head of a season cut.
 */
export const episodeOrder = (id: string): number => {
  const n = /(\d+)/.exec(id)
  return n ? Number(n[1]) : Number.MAX_SAFE_INTEGER
}
