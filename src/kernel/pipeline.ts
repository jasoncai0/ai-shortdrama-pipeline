import { capsError, describeError } from './errors.js'
import type { NormalizedStage } from './config.js'
import type { Logger, Ports, StageContext, StagePort } from './ports.js'
import type { Project, StageState } from './types.js'

export interface RunOptions {
  readonly stages: readonly NormalizedStage[]
  readonly plugins: ReadonlyMap<string, StagePort>
  readonly ports: Ports
  readonly log: Logger
  readonly concurrency: Readonly<Record<string, number>>
  readonly autoApprove: boolean
  readonly limitShots?: number
  /** Re-run these stage ids even if already marked done. */
  readonly force?: readonly string[]
  onEvent?(stage: string, event: string, payload?: unknown): void
  /** Called whenever `project` advances, so middleware sees current state. */
  onProject?(project: Project): void
}

export type RunResult =
  | { readonly kind: 'complete'; readonly project: Project }
  | { readonly kind: 'awaiting-input'; readonly project: Project; readonly stage: string; readonly question: string }
  | { readonly kind: 'failed'; readonly project: Project; readonly stage: string; readonly error: string }

/**
 * Sequential stage runner with resume. Each stage's completion is persisted
 * before the next one starts, so a crash costs at most one stage.
 */
export const runPipeline = async (
  initial: Project,
  opts: RunOptions,
): Promise<RunResult> => {
  let project = initial
  const advance = (next: Project): Project => {
    opts.onProject?.(next)
    return next
  }
  advance(project)

  for (const entry of opts.stages) {
    const stage = opts.plugins.get(entry.id)
    if (!stage) {
      return {
        kind: 'failed',
        project,
        stage: entry.id,
        error: `Stage "${entry.id}" is not registered.`,
      }
    }

    const prior = project.stageState[entry.id]
    const forced = opts.force?.includes(entry.id) ?? false
    if (prior?.status === 'done' && !forced) {
      opts.log.debug(`stage ${entry.id}: skipped (already done)`)
      continue
    }

    const missing = stage.needs.filter(
      (need) => project.stageState[need]?.status !== 'done',
    )
    if (missing.length > 0) {
      return {
        kind: 'failed',
        project,
        stage: entry.id,
        error: `Stage "${entry.id}" needs [${missing.join(', ')}] to be done first.`,
      }
    }

    project = advance(
      withStageState(project, entry.id, {
        status: 'running',
        startedAt: new Date().toISOString(),
      }),
    )
    await opts.ports.state.save(project)
    opts.log.info(`stage ${entry.id}: start`)

    const ctx: StageContext = {
      project,
      ports: opts.ports,
      log: opts.log,
      options: entry.options,
      concurrency: opts.concurrency,
      autoApprove: opts.autoApprove,
      limitShots: opts.limitShots,
      emit: (event, payload) => opts.onEvent?.(entry.id, event, payload),
    }

    try {
      const outcome = await stage.run(ctx)
      if (outcome.kind === 'awaiting-input') {
        project = advance(
          withStageState(outcome.project, entry.id, {
            status: 'awaiting-input',
            startedAt: prior?.startedAt ?? new Date().toISOString(),
          }),
        )
        await opts.ports.state.save(project)
        opts.log.info(`stage ${entry.id}: awaiting input`)
        return { kind: 'awaiting-input', project, stage: entry.id, question: outcome.question }
      }

      const finishedAt = new Date().toISOString()
      let completed = withStageState(outcome.project, entry.id, {
        status: 'done',
        startedAt: prior?.startedAt ?? finishedAt,
        finishedAt,
      })
      // A stage that stands in for others marks their dependencies satisfied.
      for (const provided of stage.provides ?? []) {
        completed = withStageState(completed, provided, { status: 'done', finishedAt })
      }
      project = advance(completed)
      await opts.ports.state.save(project)
      opts.log.info(`stage ${entry.id}: done`)
    } catch (error) {
      const message = describeError(error)
      project = withStageState(project, entry.id, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: message,
      })
      await opts.ports.state.save(project)
      opts.log.error(`stage ${entry.id}: failed`, message)
      return { kind: 'failed', project, stage: entry.id, error: message }
    }
  }

  return { kind: 'complete', project }
}

export const withStageState = (
  project: Project,
  stageId: string,
  patch: StageState,
): Project => ({
  ...project,
  updatedAt: new Date().toISOString(),
  stageState: { ...project.stageState, [stageId]: patch },
})

/**
 * Fail before spending anything: verify the chosen adapters can actually serve
 * the configured pipeline.
 */
export const assertCaps = (
  stages: readonly NormalizedStage[],
  ports: Ports,
  ratio: string,
): void => {
  const ids = new Set(stages.map((s) => s.id))

  if ((ids.has('images') || ids.has('refs')) && !ports.image.caps.ratios.includes(ratio)) {
    throw capsError(
      `Image adapter "${ports.image.name}" does not support ratio ${ratio}.`,
      `Supported: ${ports.image.caps.ratios.join(', ')}`,
    )
  }

  if (ids.has('videos')) {
    const needsI2V = ids.has('images')
    const mode = needsI2V ? 'singleImage2video' : 'text2video'
    if (!ports.video.caps.modes.includes(mode)) {
      throw capsError(
        `Video adapter "${ports.video.name}" does not support mode "${mode}".`,
        needsI2V
          ? 'Pipeline generates stills first, so image-to-video is required. Remove the "images" stage or pick another adapter.'
          : 'Pipeline has no "images" stage, so text-to-video is required.',
      )
    }
    if (!ports.video.caps.ratios.includes(ratio)) {
      throw capsError(
        `Video adapter "${ports.video.name}" does not support ratio ${ratio}.`,
        `Supported: ${ports.video.caps.ratios.join(', ')}`,
      )
    }
  }
}
