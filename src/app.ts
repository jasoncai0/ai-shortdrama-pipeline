import { normalizeMiddleware, normalizeStages } from './kernel/config.js'
import { wrapImagePort, wrapVideoPort } from './kernel/middleware.js'
import { PluginRegistry } from './kernel/registry.js'
import { builtins } from './plugins/builtins.js'
import type { Config, NormalizedStage } from './kernel/config.js'
import type {
  AssetStorePort,
  ExportPort,
  GenerateMiddleware,
  MusicPort,
  PostPort,
  ImagePort,
  LLMPort,
  LedgerPort,
  Logger,
  Ports,
  PromptStrategyPort,
  StagePort,
  SpeechPort,
  StatePort,
  VideoPort,
} from './kernel/ports.js'
import type { Project } from './kernel/types.js'

export interface App {
  readonly ports: Ports
  readonly stages: readonly NormalizedStage[]
  readonly stagePlugins: ReadonlyMap<string, StagePort>
  readonly registry: PluginRegistry
  /** Pipeline calls this before each stage so middleware sees fresh state. */
  setProject(project: Project): void
}

/**
 * Wires config → plugins → ports. This is the ONLY place that knows both the
 * kernel and the adapters; everything else sees one side or the other.
 */
export const buildApp = async (
  config: Config,
  log: Logger,
  cwd: string,
): Promise<App> => {
  const registry = new PluginRegistry(builtins, { log, cwd })

  const [llm, rawImage, rawVideo, assetStore, state, ledger, exporter, speech, music, post, promptStrategy] =
    await Promise.all([
      registry.load<LLMPort>('llm', config.ports.llm.impl, config.ports.llm.options),
      registry.load<ImagePort>('image', config.ports.image.impl, config.ports.image.options),
      registry.load<VideoPort>('video', config.ports.video.impl, config.ports.video.options),
      registry.load<AssetStorePort>(
        'assetStore',
        config.ports.assetStore.impl,
        config.ports.assetStore.options,
      ),
      registry.load<StatePort>('state', config.ports.state.impl, config.ports.state.options),
      registry.load<LedgerPort>('ledger', config.ports.ledger.impl, {
        maxCredits: config.budget.maxCredits,
        ...config.ports.ledger.options,
      }),
      registry.load<ExportPort>('export', config.ports.export.impl, config.ports.export.options),
      registry.load<SpeechPort>('speech', config.ports.speech.impl, config.ports.speech.options),
      registry.load<MusicPort>('music', config.ports.music.impl, config.ports.music.options),
      registry.load<PostPort>('post', config.ports.post.impl, config.ports.post.options),
      registry.load<PromptStrategyPort>(
        'promptStrategy',
        config.ports.promptStrategy.impl,
        config.ports.promptStrategy.options,
      ),
    ])

  const middleware = await Promise.all(
    normalizeMiddleware(config).map((binding) =>
      registry.load<GenerateMiddleware>('middleware', binding.impl, binding.options),
    ),
  )

  // Middleware needs live project/shot context without a circular dependency,
  // so it reads through these holders rather than being reconstructed per call.
  let currentProject: Project | undefined
  const getProject = (): Project => {
    if (!currentProject) {
      throw new Error('Internal: project accessed before it was set.')
    }
    return currentProject
  }

  const image = wrapImagePort(rawImage, middleware, getProject, log)
  const video = wrapVideoPort(rawVideo, middleware, getProject, log)

  const stages = normalizeStages(config)
  const stagePlugins = new Map<string, StagePort>()
  for (const entry of stages) {
    const plugin = await registry.load<StagePort>('stage', entry.use, entry.options)
    // Position id wins over the plugin's own id, so one plugin can appear at
    // several points in a pipeline (two gates, two image passes, ...).
    stagePlugins.set(entry.id, {
      ...plugin,
      id: entry.id,
      needs: entry.needs ?? plugin.needs,
      run: plugin.run.bind(plugin),
    })
  }

  if (middleware.length > 0) {
    log.debug(`middleware chain: ${middleware.map((m) => m.name).join(' → ')}`)
  }

  return {
    ports: { llm, image, video, assetStore, state, ledger, export: exporter, speech, music, post, promptStrategy },
    stages,
    stagePlugins,
    registry,
    setProject: (project) => {
      currentProject = project
    },
  }
}
