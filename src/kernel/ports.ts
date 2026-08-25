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
import type { AssetRef, Project, Shot } from './types.js'

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
