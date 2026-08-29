#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildApp } from './app.js'
import { loadConfig } from './kernel/config.js'
import { configError, describeError } from './kernel/errors.js'
import { createProgressReporter, isPidAlive, readProgress } from './kernel/health.js'
import { createLogger, type LogLevel } from './kernel/logger.js'
import { assertCaps, runPipeline } from './kernel/pipeline.js'
import { DEFAULT_CONFIG } from './default-config.js'
import type { App } from './app.js'
import type { Config } from './kernel/config.js'
import type { Logger } from './kernel/ports.js'
import type { AspectRatio, Project, ProjectKind } from './kernel/types.js'

const PROGRESS_ROOT = './.duanju/progress'

const USAGE = `duanju — plugin-based AI short-drama pipeline

Usage:
  duanju init                              scaffold duanju.config.json + prompts/
  duanju run --idea "<text>" [options]     start a new project
  duanju resume <projectId> [options]      continue past a gate / after a failure
  duanju stage <projectId> <stageId>       force-rerun one stage
  duanju status [projectId]                list projects / show one
  duanju progress <projectId>              live progress + health of a running pipeline
  duanju plugins                           list available plugins per port
  duanju agent --goal "<text>" [--project <id>]   LLM-driven creative director

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
    case 'progress':
      return progressCommand(args, log)
    case 'plugins':
      return pluginsCommand(args, log)
    case 'agent':
      return agentCommand(args, log)
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

  // Framing is not a detail that can be defaulted: 9:16 and 16:9 compose shots
  // differently, so a wrong guess is a full reshoot of everything already paid
  // for. If neither the flag nor the config says, stop and ask.
  const ratio = (args.flags['ratio'] as AspectRatio) ?? config.defaults.ratio
  if (!ratio) {
    throw configError(
      'No aspect ratio given, and the config sets no default.',
      'Pass --ratio 9:16 (vertical short drama), --ratio 16:9 (landscape) or --ratio 1:1, or set defaults.ratio in the config.',
    )
  }
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

const progressCommand = async (args: Args, log: Logger): Promise<number> => {
  const projectId = args.positional[1]
  if (!projectId) {
    log.error('usage: duanju progress <projectId>')
    return 2
  }
  const snap = await readProgress(PROGRESS_ROOT, projectId)
  if (!snap) {
    log.error(`no progress recorded for ${projectId} (has a run started?)`)
    return 1
  }
  const beatAgeS = Math.round((Date.now() - Date.parse(snap.heartbeatAt)) / 1000)
  const alive = isPidAlive(snap.pid)
  // A "running" snapshot whose process is gone is a crash, not progress.
  const health =
    snap.status === 'running' && !alive
      ? 'dead (process exited mid-stage)'
      : snap.status === 'running'
        ? `alive (last heartbeat ${beatAgeS}s ago)`
        : snap.status
  out(
    JSON.stringify(
      {
        projectId: snap.projectId,
        stage: snap.stage,
        status: snap.status,
        progress: snap.total ? `${snap.item ?? 0}/${snap.total}` : undefined,
        note: snap.note,
        error: snap.error,
        pid: snap.pid,
        pidAlive: alive,
        heartbeatAgeSeconds: beatAgeS,
        health,
        startedAt: snap.startedAt,
        updatedAt: snap.updatedAt,
      },
      null,
      2,
    ),
  )
  return 0
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

const agentCommand = async (args: Args, log: Logger): Promise<number> => {
  const goal = args.flags['goal']
  if (typeof goal !== 'string' || goal.length === 0) {
    log.error('--goal is required.')
    return 2
  }
  const config = await loadConfig(configPath(args))
  const app = await buildApp(config, log, process.cwd())

  const { runAgent } = await import('./agent/core.js')
  const { buildAgentTools } = await import('./agent/tools.js')
  const { loadSkill } = await import('./lib/skillset.js')

  // Resume an existing project, or open a fresh one the stages will fill.
  const projectId = typeof args.flags['project'] === 'string' ? args.flags['project'] : undefined
  const existing = projectId ? await app.ports.state.load(projectId) : null
  if (projectId && !existing) {
    log.error(`project ${projectId} not found`)
    return 1
  }
  const project: Project = existing ?? {
    id: `p${randomUUID().slice(0, 8)}`,
    title: 'Untitled',
    kind: (args.flags['kind'] as ProjectKind) ?? config.defaults.kind,
    ratio: (args.flags['ratio'] as AspectRatio) ?? config.defaults.ratio,
    idea: goal,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    episodes: [], characters: [], scenes: [], props: [], shots: [],
    stageState: {}, adapterState: {},
  }
  app.setProject(project)
  const holder = { current: project }

  const reporter = createProgressReporter({ root: PROGRESS_ROOT, projectId: holder.current.id, log })
  const skillsDir = typeof args.flags['skills'] === 'string' ? args.flags['skills'] : './skills'
  const tools = buildAgentTools(app, config, holder, log, {
    skillsDir,
    health: { reporter, stallTimeoutMs: config.health.stallTimeoutMs },
    stageDefaults: {
      episodes: numberFlag(args.flags['episodes']) ?? 1,
      shotsPerEpisode: numberFlag(args.flags['shots']) ?? config.defaults.shotsPerEpisode,
      shotSeconds: config.defaults.shotSeconds,
    },
  })

  // Session-start injection, canda-style: the skills directory (names and
  // descriptions only — bodies are fetched on demand via skill_file).
  const skillNames = ['real-short-drama', 'short-drama-cover-design', 'character-sheet-design']
  const lines: string[] = []
  for (const name of skillNames) {
    try {
      const skill = await loadSkill(process.cwd(), skillsDir, name)
      lines.push(`- ${name}: ${skill.description.slice(0, 160)}`)
    } catch {
      /* not imported on this machine — the directory just omits it */
    }
  }
  const openingContext =
    lines.length > 0
      ? `可用生产规范技能（用 skill_list 看章节、skill_file 取正文）：\n${lines.join('\n')}`
      : undefined

  const sessionFile = `./.duanju/agent/${holder.current.id}.jsonl`
  log.info(`agent: project ${holder.current.id}, session log → ${sessionFile}`)

  const result = await runAgent({
    goal,
    llm: app.ports.llm,
    tools,
    log,
    sessionFile,
    maxTurns: numberFlag(args.flags['max-turns']) ?? 16,
    openingContext,
    onTurn: (turn, note) => reporter.tick('agent', { item: turn, note }),
  })

  reporter.stageDone('agent')
  await reporter.close()
  await app.ports.state.save(holder.current)
  out(JSON.stringify({ projectId: holder.current.id, done: result.done, turns: result.turns, summary: result.summary }, null, 2))
  return result.done ? 0 : 1
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

  const reporter = createProgressReporter({ root: PROGRESS_ROOT, projectId: project.id, log })
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
    onEvent: (stage, event, payload) => {
      if (event === 'progress') {
        const info = payload as { item?: number; total?: number; note?: string }
        // A counted stage reports item/total; a continuous one (an encode
        // reporting elapsed output) reports only a note.
        const counted = info.total !== undefined ? `${info.item ?? 0}/${info.total}` : undefined
        const parts = [counted, info.note].filter(Boolean)
        if (parts.length > 0) log.info(`${stage}: ${parts.join(' ')}`)
      } else {
        log.debug(`event ${stage}/${event}`, payload)
      }
    },
    health: { reporter, stallTimeoutMs: config.health.stallTimeoutMs },
  })
  await reporter.close()

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

/**
 * Every flag the CLI understands.
 *
 * An unknown flag used to be collected and ignored, so `--auto-approve`
 * (there is no such flag; it is `--yes`) ran a paid pipeline that then stopped
 * dead at the first gate. A typo in a flag that costs money must be an error.
 */
const KNOWN_FLAGS = new Set([
  'goal', 'project', 'max-turns', 'skills',
  'config',
  'title',
  'kind',
  'ratio',
  'idea',
  'episodes',
  'shots',
  'limit-shots',
  'yes',
  'log',
])

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
  const unknown = Object.keys(flags).filter((key) => !KNOWN_FLAGS.has(key))
  if (unknown.length > 0) {
    throw configError(
      `Unknown flag(s): ${unknown.map((f) => `--${f}`).join(', ')}`,
      `Known flags: ${[...KNOWN_FLAGS].map((f) => `--${f}`).join(', ')}`,
    )
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
