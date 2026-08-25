#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildApp } from './app.js'
import { loadConfig } from './kernel/config.js'
import { describeError } from './kernel/errors.js'
import { createLogger, type LogLevel } from './kernel/logger.js'
import { assertCaps, runPipeline } from './kernel/pipeline.js'
import { DEFAULT_CONFIG } from './default-config.js'
import type { App } from './app.js'
import type { Config } from './kernel/config.js'
import type { Logger } from './kernel/ports.js'
import type { AspectRatio, Project, ProjectKind } from './kernel/types.js'

const USAGE = `duanju — plugin-based AI short-drama pipeline

Usage:
  duanju init                              scaffold duanju.config.json + prompts/
  duanju run --idea "<text>" [options]     start a new project
  duanju resume <projectId> [options]      continue past a gate / after a failure
  duanju stage <projectId> <stageId>       force-rerun one stage
  duanju status [projectId]                list projects / show one
  duanju plugins                           list available plugins per port

Options:
  --config <path>       config file (default ./duanju.config.json)
  --title <text>        project title before the plan names it
  --kind <k>            shortdrama | comic | ad | custom
  --ratio <r>           9:16 | 16:9 | 1:1
  --episodes <n>        episode count (default 1)
  --shots <n>           shots per episode
  --limit-shots <n>     cap shots per generating stage (cheap smoke run)
  --yes                 auto-approve all gates
  --log <level>         debug | info | warn | error | silent
`

const main = async (argv: readonly string[]): Promise<number> => {
  const args = parseArgs(argv)
  const log = createLogger((args.flags['log'] as LogLevel) ?? 'info')
  const command = args.positional[0]

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      out(USAGE)
      return 0
    case 'init':
      return initCommand(log)
    case 'run':
      return runCommand(args, log)
    case 'resume':
      return resumeCommand(args, log)
    case 'stage':
      return stageCommand(args, log)
    case 'status':
      return statusCommand(args, log)
    case 'plugins':
      return pluginsCommand(args, log)
    default:
      log.error(`Unknown command "${command}"`)
      out(USAGE)
      return 2
  }
}

// ─── commands ─────────────────────────────────────────────────────────────

const initCommand = async (log: Logger): Promise<number> => {
  const target = resolve(process.cwd(), 'duanju.config.json')
  await writeFile(target, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8')
  log.info(`wrote ${target}`)
  log.info('next: export DEEPSEEK_API_KEY=... and set ports.image/video options.canvas')
  return 0
}

const runCommand = async (args: Args, log: Logger): Promise<number> => {
  const idea = args.flags['idea']
  if (typeof idea !== 'string' || idea.length === 0) {
    log.error('--idea is required.')
    return 2
  }

  const config = await loadConfig(configPath(args))
  const app = await buildApp(config, log, process.cwd())

  const ratio = (args.flags['ratio'] as AspectRatio) ?? config.defaults.ratio
  const kind = (args.flags['kind'] as ProjectKind) ?? config.defaults.kind

  assertCaps(app.stages, app.ports, ratio)

  const project: Project = {
    id: `p${randomUUID().slice(0, 8)}`,
    title: (args.flags['title'] as string) ?? 'Untitled',
    kind,
    ratio,
    idea,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    episodes: [],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
    stageState: {},
    adapterState: {},
  }

  log.info(`project ${project.id} created`)
  return execute(app, config, project, args, log)
}

const resumeCommand = async (args: Args, log: Logger): Promise<number> => {
  const projectId = args.positional[1]
  if (!projectId) {
    log.error('usage: duanju resume <projectId>')
    return 2
  }
  const config = await loadConfig(configPath(args))
  const app = await buildApp(config, log, process.cwd())
  const project = await app.ports.state.load(projectId)
  if (!project) {
    log.error(`project ${projectId} not found`)
    return 1
  }
  // A gate that halted the run is treated as approved by resuming past it.
  const cleared: Project = {
    ...project,
    stageState: Object.fromEntries(
      Object.entries(project.stageState).map(([id, st]) =>
        st.status === 'awaiting-input' ? [id, { ...st, status: 'done' as const }] : [id, st],
      ),
    ),
  }
  return execute(app, config, cleared, args, log)
}

const stageCommand = async (args: Args, log: Logger): Promise<number> => {
  const [, projectId, stageId] = args.positional
  if (!projectId || !stageId) {
    log.error('usage: duanju stage <projectId> <stageId>')
    return 2
  }
  const config = await loadConfig(configPath(args))
  const app = await buildApp(config, log, process.cwd())
  const project = await app.ports.state.load(projectId)
  if (!project) {
    log.error(`project ${projectId} not found`)
    return 1
  }
  return execute(app, config, project, args, log, [stageId])
}

const statusCommand = async (args: Args, log: Logger): Promise<number> => {
  const config = await loadConfig(configPath(args))
  const app = await buildApp(config, log, process.cwd())
  const projectId = args.positional[1]

  if (!projectId) {
    const ids = await app.ports.state.list()
    out(JSON.stringify({ projects: ids }, null, 2))
    return 0
  }

  const project = await app.ports.state.load(projectId)
  if (!project) {
    log.error(`project ${projectId} not found`)
    return 1
  }
  out(
    JSON.stringify(
      {
        id: project.id,
        title: project.title,
        kind: project.kind,
        ratio: project.ratio,
        stages: project.stageState,
        counts: {
          episodes: project.episodes.length,
          characters: project.characters.length,
          scenes: project.scenes.length,
          shots: project.shots.length,
          stills: project.shots.filter((s) => s.still).length,
          clips: project.shots.filter((s) => s.clip).length,
          failed: project.shots.filter((s) => s.status === 'failed').length,
        },
        finalCut: project.finalCut?.uri,
        music: project.music
          ? { title: project.music.title, source: project.music.source, licence: project.music.licence.code }
          : undefined,
        scoredCut: project.scoredCut?.uri,
        subtitleFile: project.subtitleFile?.uri,
        deliverable: project.deliverable?.uri,
      },
      null,
      2,
    ),
  )
  return 0
}

const pluginsCommand = async (args: Args, log: Logger): Promise<number> => {
  const config = await loadConfig(configPath(args))
  const app = await buildApp(config, log, process.cwd())
  const ports = [
    'llm', 'image', 'video', 'assetStore', 'state',
    'ledger', 'export', 'music', 'post', 'promptStrategy', 'middleware', 'stage',
  ] as const
  out(
    JSON.stringify(
      Object.fromEntries(ports.map((p) => [p, app.registry.available(p)])),
      null,
      2,
    ),
  )
  return 0
}

// ─── shared execution ─────────────────────────────────────────────────────

const execute = async (
  app: App,
  config: Config,
  project: Project,
  args: Args,
  log: Logger,
  force?: readonly string[],
): Promise<number> => {
  app.setProject(project)

  // Only pass what the user actually asked for. Injecting a default episode
  // count here would silently truncate an imported screenplay to one episode.
  const episodes = numberFlag(args.flags['episodes'])
  const shots = numberFlag(args.flags['shots'])
  const stageDefaults: Record<string, unknown> = {
    shotSeconds: config.defaults.shotSeconds,
    ...(episodes === undefined ? {} : { episodes }),
    ...(shots === undefined ? {} : { shotsPerEpisode: shots }),
  }

  const stages = app.stages.map((s) => ({
    ...s,
    options: { ...stageDefaults, ...s.options },
  }))

  const result = await runPipeline(project, {
    stages,
    plugins: app.stagePlugins,
    ports: app.ports,
    log,
    concurrency: config.concurrency,
    autoApprove: args.flags['yes'] === true,
    limitShots: numberFlag(args.flags['limit-shots']),
    force,
    onProject: (next) => app.setProject(next),
    onEvent: (stage, event, payload) => log.debug(`event ${stage}/${event}`, payload),
  })

  switch (result.kind) {
    case 'complete':
      out(JSON.stringify({ projectId: result.project.id, finalCut: result.project.finalCut?.uri }, null, 2))
      log.info(`done — project ${result.project.id}`)
      return 0
    case 'awaiting-input':
      log.info(`paused at "${result.stage}": ${result.question}`)
      log.info(`review with: duanju status ${result.project.id}`)
      log.info(`continue with: duanju resume ${result.project.id}`)
      return 0
    case 'failed':
      log.error(`stage "${result.stage}" failed: ${result.error}`)
      log.info(`retry with: duanju resume ${result.project.id}`)
      return 1
  }
}

// ─── arg parsing ──────────────────────────────────────────────────────────

interface Args {
  readonly positional: readonly string[]
  readonly flags: Readonly<Record<string, string | boolean>>
}

const parseArgs = (argv: readonly string[]): Args => {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token) continue
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i += 1
      } else {
        flags[key] = true
      }
    } else {
      positional.push(token)
    }
  }
  return { positional, flags }
}

const configPath = (args: Args): string =>
  typeof args.flags['config'] === 'string' ? args.flags['config'] : './duanju.config.json'

const numberFlag = (value: string | boolean | undefined): number | undefined => {
  if (typeof value !== 'string') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const out = (text: string): void => {
  process.stdout.write(`${text}\n`)
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    process.stderr.write(`${describeError(error)}\n`)
    process.exitCode = 1
  })
