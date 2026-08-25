import type {
  GenerateMiddleware,
  SpeechPort,
  SpeechRequest,
  ImagePort,
  ImageRequest,
  Logger,
  MiddlewareContext,
  VideoPort,
  VideoRequest,
} from './ports.js'
import type { AssetRef, Project } from './types.js'

/**
 * The tuning seam: every image/video request passes through the configured
 * middleware chain before reaching the provider, and every result passes back
 * out through it. Middleware can rewrite prompts, clamp params, log, or retry
 * — without touching adapters or stages.
 *
 * Order is outermost-first: `["a","b"]` runs a → b → provider → b → a.
 *
 * Shot context is derived from `req.label` (stages set it to the shot id)
 * rather than a mutable binding, so concurrent generations never see each
 * other's context.
 */

export const wrapImagePort = (
  port: ImagePort,
  chain: readonly GenerateMiddleware[],
  getProject: () => Project,
  log: Logger,
): ImagePort => {
  const applicable = chain.filter((m) => typeof m.image === 'function')

  const invoke = (index: number, req: ImageRequest): Promise<readonly AssetRef[]> => {
    const mw = applicable[index]
    if (!mw?.image) return port.generate(req)
    return mw.image(req, contextFor(getProject, req.label, log), (next) => invoke(index + 1, next))
  }

  return {
    name: decorate(port.name, applicable),
    caps: port.caps,
    generate: (req) => invoke(0, req),
  }
}

export const wrapVideoPort = (
  port: VideoPort,
  chain: readonly GenerateMiddleware[],
  getProject: () => Project,
  log: Logger,
): VideoPort => {
  const applicable = chain.filter((m) => typeof m.video === 'function')

  const invoke = (index: number, req: VideoRequest): Promise<readonly AssetRef[]> => {
    const mw = applicable[index]
    if (!mw?.video) return port.generate(req)
    return mw.video(req, contextFor(getProject, req.label, log), (next) => invoke(index + 1, next))
  }

  return {
    name: decorate(port.name, applicable),
    caps: port.caps,
    generate: (req) => invoke(0, req),
  }
}

const contextFor = (
  getProject: () => Project,
  label: string | undefined,
  log: Logger,
): MiddlewareContext => {
  const project = getProject()
  return {
    project,
    shot: label ? project.shots.find((s) => s.id === label) : undefined,
    log,
  }
}

const decorate = (name: string, chain: readonly GenerateMiddleware[]): string =>
  chain.length === 0 ? name : `${name}+mw(${chain.map((m) => m.name).join(',')})`

export const wrapSpeechPort = (
  port: SpeechPort,
  chain: readonly GenerateMiddleware[],
  getProject: () => Project,
  log: Logger,
): SpeechPort => {
  const applicable = chain.filter((m) => typeof m.speech === 'function')

  const invoke = (index: number, req: SpeechRequest): Promise<readonly AssetRef[]> => {
    const mw = applicable[index]
    if (!mw?.speech) return port.synthesize(req)
    return mw.speech(req, contextFor(getProject, req.label, log), (next) => invoke(index + 1, next))
  }

  return {
    name: decorate(port.name, applicable),
    caps: port.caps,
    synthesize: (req) => invoke(0, req),
  }
}
