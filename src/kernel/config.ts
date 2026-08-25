import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { configError } from './errors.js'

/**
 * A port binding is `{ impl, options }`. `impl` is either a built-in plugin
 * name or `npm:<package>` / `file:<path>` for an external one.
 */
const portBinding = z.object({
  impl: z.string().min(1),
  options: z.record(z.unknown()).default({}),
})

const stageEntry = z.union([
  z.string().min(1),
  z.object({
    /** Unique position id — also the resume key in project.stageState. */
    id: z.string().min(1),
    /** Plugin to instantiate; defaults to `id`. Lets one plugin appear twice. */
    use: z.string().min(1).optional(),
    /**
     * Overrides the plugin's declared dependencies. Needed when a stage is
     * swapped for an equivalent — e.g. `import-script` replacing plan+assets+shots.
     */
    needs: z.array(z.string().min(1)).optional(),
    options: z.record(z.unknown()).default({}),
  }),
])

const middlewareEntry = z.union([
  z.string().min(1),
  z.object({
    impl: z.string().min(1),
    options: z.record(z.unknown()).default({}),
  }),
])

export const configSchema = z.object({
  ports: z.object({
    llm: portBinding,
    image: portBinding,
    video: portBinding,
    assetStore: portBinding,
    state: portBinding,
    ledger: portBinding,
    export: portBinding,
    promptStrategy: portBinding,
  }),
  /** Ordered; outermost first. Applied to every image/video generate call. */
  middleware: z.array(middlewareEntry).default([]),
  pipeline: z.array(stageEntry).min(1),
  concurrency: z
    .object({
      images: z.number().int().min(1).max(16).default(3),
      videos: z.number().int().min(1).max(16).default(2),
      refs: z.number().int().min(1).max(16).default(3),
    })
    .default({ images: 3, videos: 2, refs: 3 }),
  budget: z
    .object({
      maxCredits: z.number().min(0).default(0),
      failFast: z.boolean().default(false),
    })
    .default({ maxCredits: 0, failFast: false }),
  defaults: z
    .object({
      ratio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
      kind: z.enum(['shortdrama', 'comic', 'ad', 'custom']).default('shortdrama'),
      shotSeconds: z.number().min(1).max(30).default(5),
      shotsPerEpisode: z.number().int().min(1).max(60).default(8),
    })
    .default({
      ratio: '9:16',
      kind: 'shortdrama',
      shotSeconds: 5,
      shotsPerEpisode: 8,
    }),
})

export type Config = z.infer<typeof configSchema>
export type PortBinding = z.infer<typeof portBinding>

export interface NormalizedStage {
  readonly id: string
  readonly use: string
  readonly needs?: readonly string[]
  readonly options: Record<string, unknown>
}

export const normalizeStages = (cfg: Config): readonly NormalizedStage[] =>
  cfg.pipeline.map((entry) =>
    typeof entry === 'string'
      ? { id: entry, use: entry, options: {} }
      : { id: entry.id, use: entry.use ?? entry.id, needs: entry.needs, options: entry.options },
  )

export const normalizeMiddleware = (cfg: Config): readonly PortBinding[] =>
  cfg.middleware.map((entry) =>
    typeof entry === 'string' ? { impl: entry, options: {} } : entry,
  )

/** `${ENV_VAR}` anywhere in a string value is substituted from process.env. */
const expandEnv = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, name: string) => process.env[name] ?? '')
  }
  if (Array.isArray(value)) return value.map(expandEnv)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, expandEnv(v)]),
    )
  }
  return value
}

export const loadConfig = async (path: string): Promise<Config> => {
  const abs = resolve(path)
  let text: string
  try {
    text = await readFile(abs, 'utf8')
  } catch (error) {
    throw configError(
      `Cannot read config at ${abs}`,
      'Run `duanju init` to scaffold duanju.config.json, or pass --config <path>.',
    )
  }

  let json: unknown
  try {
    json = JSON.parse(stripJsonComments(text))
  } catch (error) {
    throw configError(`Config at ${abs} is not valid JSON: ${String(error)}`)
  }

  const parsed = configSchema.safeParse(expandEnv(json))
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw configError(`Config at ${abs} failed validation:\n${issues}`)
  }
  return parsed.data
}

/** Tolerate `//` comments so the shipped config can stay annotated. */
const stripJsonComments = (text: string): string =>
  text.replace(/^\s*\/\/.*$/gm, '')
