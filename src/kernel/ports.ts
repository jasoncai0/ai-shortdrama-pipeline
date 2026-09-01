/**
 * Port contracts. The kernel depends ONLY on this file — never on any adapter.
 *
 * Tuning surface (three independent seams, deliberately separated):
 *   1. PromptStrategyPort — decides WHAT text/params a shot generates with.
 *      Swappable, and the bundled `template` impl reads editable files on disk.
 *   2. GenerateMiddleware  — intercepts EVERY image/video request right before
 *      it hits the provider. Rewrite prompt, clamp params, log, A/B, whatever.
 *   3. caps negotiation    — the kernel refuses to start a pipeline the chosen
 *      adapters cannot serve, instead of failing halfway through.
 */

import type { ZodType } from 'zod'
import type { AssetRef, MusicLicence, Project, Shot } from './types.js'

// ─── shared ───────────────────────────────────────────────────────────────

export interface Plugin {
  readonly name: string
}

export interface Logger {
  debug(msg: string, extra?: unknown): void
  info(msg: string, extra?: unknown): void
  warn(msg: string, extra?: unknown): void
  error(msg: string, extra?: unknown): void
}

// ─── LLM ──────────────────────────────────────────────────────────────────

export interface Message {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface LLMUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
}

export interface LLMResult<T> {
  readonly data: T
  readonly raw: string
  readonly usage?: LLMUsage
}

export interface CompleteRequest<T> {
  /**
   * What this call is for — `plan`, `assets`, `shots`, … Decorating adapters
   * key on it, notably `llm/skill-inline`, which uses it to decide which pages
   * of a production skill belong in this particular call. Sniffing the prompt
   * text instead would break the moment a stage reworded itself.
   */
  readonly purpose?: string
  readonly system?: string
  readonly messages: readonly Message[]
  /** When present the adapter MUST return data satisfying it (retrying itself). */
  readonly schema?: ZodType<T>
  readonly maxRetries?: number
  readonly temperature?: number
}

export interface LLMPort extends Plugin {
  complete<T = string>(req: CompleteRequest<T>): Promise<LLMResult<T>>
}

// ─── image / video ────────────────────────────────────────────────────────

export interface ImageCaps {
  readonly refImages: number
  readonly ratios: readonly string[]
  readonly maxConcurrency: number
}

export interface ImageRequest {
  readonly prompt: string
  readonly negativePrompt?: string
  readonly refs?: readonly AssetRef[]
  readonly ratio?: string
  readonly n?: number
  readonly params?: Readonly<Record<string, unknown>>
  /** hash(stage, shotId, prompt, params) — dedupes retries and billing. */
  readonly idempotencyKey: string
  /** Human-readable label; adapters may use it for remote node naming. */
  readonly label?: string
}

export interface ImagePort extends Plugin {
  readonly caps: ImageCaps
  generate(req: ImageRequest): Promise<readonly AssetRef[]>
}

export type VideoMode =
  | 'text2video'
  | 'singleImage2video'
  | 'frames2video'
  | 'image2video'
  /** First frame AND separate identity references in one request. */
  | 'mixed2video'

export interface VideoCaps {
  readonly modes: readonly VideoMode[]
  readonly maxSeconds: number
  readonly minSeconds: number
  readonly ratios: readonly string[]
  readonly audio: boolean
  readonly maxConcurrency: number
}

export interface VideoRequest {
  readonly mode: VideoMode
  readonly prompt: string
  readonly negativePrompt?: string
  /**
   * Composition of frame zero ONLY. It does not carry identity: a still can
   * drift, be cropped, or be rejected by moderation, and the model has no way
   * to tell which parts of it are the character versus the set.
   */
  readonly firstFrame?: AssetRef
  readonly lastFrame?: AssetRef
  readonly refs?: readonly AssetRef[]
  /**
   * Character identity anchors, passed ALONGSIDE `firstFrame` — never instead
   * of it. Keeping the two roles separate is what stops a face from drifting
   * between shots; adapters that cannot express both should prefer these.
   */
  readonly identityRefs?: readonly AssetRef[]
  /**
   * Speech this shot performs, handed to the model so it generates the mouth
   * that says it. Without this the model invents mouth movement and any voice
   * mixed on afterwards can never match it — which is what "音画不同步" was.
   *
   * The model re-performs the audio rather than passing it through, so a shot
   * generated this way owns its soundtrack: do not dub over it.
   */
  readonly voiceTrack?: AssetRef
  readonly seconds?: number
  readonly ratio?: string
  readonly params?: Readonly<Record<string, unknown>>
  readonly idempotencyKey: string
  readonly label?: string
}

export interface VideoPort extends Plugin {
  readonly caps: VideoCaps
  generate(req: VideoRequest): Promise<readonly AssetRef[]>
}

// ─── speech ───────────────────────────────────────────────────────────────

export interface SpeechCaps {
  readonly maxChars: number
  readonly maxConcurrency: number
  /** Voice ids the adapter accepts; empty means "anything the provider takes". */
  readonly voices: readonly string[]
}

export interface SpeechRequest {
  readonly text: string
  /** Provider voice id. Cast per character so one actor keeps one voice. */
  readonly voice?: string
  /** 1 = natural. Below 1 is slower. */
  readonly speed?: number
  readonly params?: Readonly<Record<string, unknown>>
  readonly idempotencyKey: string
  readonly label?: string
}

export interface SpeechPort extends Plugin {
  readonly caps: SpeechCaps
  synthesize(req: SpeechRequest): Promise<readonly AssetRef[]>
}

// ─── generate middleware (tuning seam #2) ─────────────────────────────────

export interface MiddlewareContext {
  readonly project: Project
  readonly shot?: Shot
  readonly log: Logger
}

/**
 * Wraps a single generate call. Call `next(req)` with a possibly-rewritten
 * request; inspect or replace the result before returning it. Middleware runs
 * in configured order, outermost first.
 */
export interface GenerateMiddleware extends Plugin {
  image?(
    req: ImageRequest,
    ctx: MiddlewareContext,
    next: (r: ImageRequest) => Promise<readonly AssetRef[]>,
  ): Promise<readonly AssetRef[]>
  video?(
    req: VideoRequest,
    ctx: MiddlewareContext,
    next: (r: VideoRequest) => Promise<readonly AssetRef[]>,
  ): Promise<readonly AssetRef[]>
  /**
   * Speech is a paid provider call like the others, so retry and logging must
   * reach it too — the alternative is a transient timeout losing a line.
   */
  speech?(
    req: SpeechRequest,
    ctx: MiddlewareContext,
    next: (r: SpeechRequest) => Promise<readonly AssetRef[]>,
  ): Promise<readonly AssetRef[]>
}

// ─── prompt strategy (tuning seam #1) ─────────────────────────────────────

export interface CompiledPrompt {
  readonly imagePrompt: string
  readonly videoPrompt: string
  readonly negativePrompt?: string
  readonly imageParams?: Readonly<Record<string, unknown>>
  readonly videoParams?: Readonly<Record<string, unknown>>
}

export interface PromptStrategyPort extends Plugin {
  /** Pure where possible; `llm-rewrite` impl is the exception and may await. */
  compile(shot: Shot, project: Project): Promise<CompiledPrompt> | CompiledPrompt
}

// ─── asset store ──────────────────────────────────────────────────────────

export interface AssetMeta {
  readonly kind: 'character-ref' | 'scene-ref' | 'still' | 'clip' | 'final' | 'other'
  readonly mime?: string
  readonly projectId: string
  readonly label?: string
  readonly extra?: Readonly<Record<string, unknown>>
}

export interface AssetStorePort extends Plugin {
  put(bytes: Uint8Array, meta: AssetMeta): Promise<AssetRef>
  get(ref: AssetRef): Promise<Uint8Array>
  /** Pull a remote URL into local custody. Returns a stable AssetRef. */
  ingest(url: string, meta: AssetMeta): Promise<AssetRef>
  /** Absolute local path when the store is disk-backed (used by ffmpeg). */
  localPath(ref: AssetRef): Promise<string>
}

// ─── music ────────────────────────────────────────────────────────────────

export interface MusicBrief {
  readonly genre: string
  readonly mood: string
  readonly styleGuide: string
  /** Runtime the cut actually needs covering. */
  readonly seconds: number
  readonly keywords: readonly string[]
}

export interface MusicCandidate {
  readonly id: string
  readonly title: string
  readonly source: 'local' | 'search' | 'generated'
  /** file:// or https:// — the kernel ingests it before anything downstream. */
  readonly uri: string
  readonly mime: string
  readonly seconds?: number
  readonly creator?: string
  readonly tags: readonly string[]
  readonly licence: MusicLicence
}

export interface MusicCaps {
  /** Generating costs money and takes time; selection strategy depends on it. */
  readonly canGenerate: boolean
  readonly maxSeconds?: number
}

export interface MusicPort extends Plugin {
  readonly caps: MusicCaps
  /** Offers candidates. Choosing between them is the stage's job, not the port's. */
  find(brief: MusicBrief, limit: number): Promise<readonly MusicCandidate[]>
}

// ─── text cards ───────────────────────────────────────────────────────────

/**
 * A character intro card, rendered deterministically.
 *
 * Deliberately not an image model's job. The requirement is that the name is
 * *correct*, and a diffusion model cannot be relied on to spell 「陈宗之」 —
 * it will produce something that looks like Chinese and is not. Typography is
 * a solved problem; generation is the wrong tool for it.
 */
export interface TextCardSpec {
  /** Large vertical text — the character's name. */
  readonly title: string
  /** Smaller vertical text under it — role, relationship, one line. */
  readonly subtitle?: string
  readonly widthPx: number
  readonly heightPx: number
  readonly titleSizePx: number
  readonly subtitleSizePx: number
  /** Absolute path to a font file that actually contains the glyphs. */
  readonly fontPath: string
  readonly titleColour: string
  readonly subtitleColour: string
  readonly accentColour: string
  /** Backing panel behind the text; 0 disables it. */
  readonly panelOpacity: number
  readonly panelColour: string
  /** Which edge the card hugs — decides which side the accent rule sits on. */
  readonly side: 'left' | 'right'
}

export interface TextCardCaps {
  /** Vertical CJK layout, one glyph per line. */
  readonly vertical: boolean
}

export interface TextCardPort extends Plugin {
  readonly caps: TextCardCaps
  render(spec: TextCardSpec, store: AssetStorePort, projectId: string, label: string): Promise<AssetRef>
}

// ─── post production ──────────────────────────────────────────────────────

export interface MixOptions {
  /** Music level relative to the picture's own audio, in dB. Negative ducks it. */
  readonly musicGainDb: number
  readonly fadeInSeconds: number
  readonly fadeOutSeconds: number
  /** Loop a short track to cover the runtime instead of letting it fall silent. */
  readonly loop: boolean
  /** Pull the music down while dialogue plays. */
  readonly duckUnderDialogue: boolean
}

/** One timed overlay: a rendered card and the window it is visible for. */
export interface CardOverlay {
  readonly image: AssetRef
  readonly startSeconds: number
  readonly endSeconds: number
  readonly side: 'left' | 'right'
  readonly marginPx: number
  readonly fadeSeconds: number
}

export interface SubtitleCue {
  readonly shotId: string
  readonly text: string
  /**
   * Whose voice this is. Narration and dialogue look the same on screen unless
   * something separates them, and a viewer who cannot tell a character's line
   * from the narrator's loses track of who knows what — which in this genre is
   * the plot. Renderers italicise narration, the standard voice-over
   * convention.
   */
  readonly kind?: 'dialogue' | 'narration'
  /** Speaking character, when known. */
  readonly speaker?: string
}

export interface SubtitleStyle {
  readonly fontSize: number
  readonly marginVertical: number
  readonly primaryColour: string
  readonly outlineColour: string
  readonly fontName?: string
  /** Hard cap on rendered lines per cue; the renderer shrinks type to fit. */
  readonly maxLines?: number
  /** Text block width as a fraction of the frame (default 0.78). */
  readonly maxWidthRatio?: number
  /**
   * Bottom clearance as a fraction of frame height (default 0.16). Short-video
   * players draw their own UI over the bottom of the frame, so a subtitle
   * sitting on the edge is a subtitle behind a progress bar.
   */
  readonly bottomOffsetRatio?: number
}

export interface VoiceMixOptions {
  /** Level applied to the synthesised voice, in dB. */
  readonly voiceGainDb: number
  /** Level applied to the clip's own audio while the voice plays, in dB. */
  readonly bedGainDb: number
  /**
   * Stretch the picture to cover a voice that outlasts it. Off by default:
   * silently slowing a shot to fit a line is a directorial decision, not a
   * mixing one.
   */
  readonly padToVoice: boolean
}

export interface PostPort extends Plugin {
  /**
   * Replaces a clip's audio with silence, keeping the picture untouched.
   *
   * Generative video models return their own invented soundtrack — ambience,
   * and often speech-like noise. On a dubbed shot that track is only ever a
   * bed: `mixVoice` ducks it under the real voice. On a shot with no dub it
   * plays at full level, so an empty 留白 insert can appear to carry a
   * voice-over that was never recorded. Silencing those shots leaves the score
   * as the only thing heard over them, which is what a breathing shot is for.
   */
  muteAudio?(clip: AssetRef, store: AssetStorePort, projectId: string): Promise<AssetRef>

  /**
   * Measured runtime of a rendered asset. Everything that places something on
   * a timeline needs this, and they all have to agree — a model asked for 4s
   * returns 4.096s, and two callers measuring differently drift apart.
   */
  probeDuration(asset: AssetRef, store: AssetStorePort): Promise<number>
  /**
   * Composites timed cards onto a cut. One pass for all of them: each card is
   * a re-encode, and doing them one at a time would generation-loss the
   * picture once per character.
   */
  overlayCards?(
    video: AssetRef,
    cards: readonly CardOverlay[],
    store: AssetStorePort,
    projectId: string,
  ): Promise<AssetRef>
  /**
   * Joins voice takes end to end, so a line the provider refuses to say in one
   * piece can be spoken in clauses and reassembled. Optional: an adapter may
   * ship without it, in which case a wedged line stays silent.
   */
  concatAudio?(
    tracks: readonly AssetRef[],
    store: AssetStorePort,
    projectId: string,
  ): Promise<AssetRef>
  /**
   * Returns the clip with its own audio removed.
   *
   * A generative video model invents an audio track, and that track performs
   * the same line the pipeline is dubbing — a second voice under every shot.
   * When we own the audio layer, the model's take has to go.
   */
  stripAudio?(clip: AssetRef, store: AssetStorePort, projectId: string): Promise<AssetRef>
  /**
   * Lays a voice track over one clip. Optional so an adapter can ship music
   * and subtitles without speech support.
   */
  mixVoice?(
    clip: AssetRef,
    voice: AssetRef,
    opts: VoiceMixOptions,
    store: AssetStorePort,
    projectId: string,
  ): Promise<AssetRef>
  mixMusic(
    video: AssetRef,
    music: AssetRef,
    opts: MixOptions,
    store: AssetStorePort,
    projectId: string,
  ): Promise<AssetRef>
  /**
   * Builds an SRT from cues plus the clips they belong to.
   *
   * Timing is measured from the clips rather than taken from the requested
   * durations: a model asked for 4s routinely returns 4.096s, and those
   * fractions accumulate into subtitles that drift off the picture.
   */
  buildSubtitles(
    clips: readonly { readonly ref: AssetRef; readonly cue?: SubtitleCue }[],
    store: AssetStorePort,
    projectId: string,
  ): Promise<AssetRef>
  burnSubtitles(
    video: AssetRef,
    srt: AssetRef,
    style: SubtitleStyle,
    store: AssetStorePort,
    projectId: string,
  ): Promise<AssetRef>
}

// ─── state / ledger / export ──────────────────────────────────────────────

export interface StatePort extends Plugin {
  load(projectId: string): Promise<Project | null>
  save(project: Project): Promise<void>
  list(): Promise<readonly string[]>
}

export interface Charge {
  readonly idempotencyKey: string
  readonly amount: number
  readonly reason: string
}

export interface Hold {
  readonly idempotencyKey: string
  readonly amount: number
  /** True when this key was already committed — caller should skip the work. */
  readonly alreadySettled: boolean
}

export interface LedgerPort extends Plugin {
  reserve(charge: Charge): Promise<Hold>
  commit(hold: Hold, actual?: number): Promise<void>
  refund(hold: Hold, reason: string): Promise<void>
  balance(): Promise<number>
}

export interface ExportOptions {
  readonly ratio: string
  readonly fps: number
  readonly crf: number
  readonly outputLabel: string
  /**
   * Called as the encode advances, so the caller can prove liveness.
   *
   * A 90-clip concat is one silent multi-minute call; without this the stall
   * watchdog cannot tell it apart from a hung process and kills a healthy
   * encode. `seconds` is output position, when the encoder reports it.
   */
  readonly onProgress?: (seconds: number) => void
}

export interface ExportPort extends Plugin {
  concat(
    clips: readonly AssetRef[],
    opts: ExportOptions,
    store: AssetStorePort,
    projectId: string,
  ): Promise<AssetRef>
}

// ─── stage (pipeline step is a plugin too) ────────────────────────────────

export interface Ports {
  readonly llm: LLMPort
  readonly textCard: TextCardPort
  readonly music: MusicPort
  readonly speech: SpeechPort
  readonly post: PostPort
  readonly image: ImagePort
  readonly video: VideoPort
  readonly assetStore: AssetStorePort
  readonly state: StatePort
  readonly ledger: LedgerPort
  readonly export: ExportPort
  readonly promptStrategy: PromptStrategyPort
}

export interface StageContext {
  readonly project: Project
  readonly ports: Ports
  readonly log: Logger
  readonly options: Readonly<Record<string, unknown>>
  readonly concurrency: Readonly<Record<string, number>>
  /** Non-interactive runs auto-approve gates. */
  readonly autoApprove: boolean
  /** Cap shots processed per stage — used for cheap smoke runs. */
  readonly limitShots?: number
  emit(event: string, payload?: unknown): void
}

export type StageOutcome =
  | { readonly kind: 'ok'; readonly project: Project }
  | { readonly kind: 'awaiting-input'; readonly project: Project; readonly question: string }

export interface StagePort extends Plugin {
  readonly id: string
  readonly needs: readonly string[]
  /**
   * Stage ids this one satisfies. Lets a stage stand in for others — e.g.
   * `import` provides plan/assets/shots, so `refs` and `prompts` see their
   * dependencies met without those stages ever running.
   */
  readonly provides?: readonly string[]
  run(ctx: StageContext): Promise<StageOutcome>
}
