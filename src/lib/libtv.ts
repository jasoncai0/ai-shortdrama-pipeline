import { providerError } from '../kernel/errors.js'
import type { Logger } from '../kernel/ports.js'
import { parseJsonStdout, run, runOrThrow } from './proc.js'

const isDuplicateName = (stderr: string): boolean =>
  stderr.includes('已存在显示名') || stderr.toLowerCase().includes('already exists')

/**
 * Minimal libtv CLI client.
 *
 * Three facts about `libtv` that shape this file (verified against 1.1.3):
 *  1. `--run` BLOCKS until terminal state and does its own polling. Never wrap
 *     it in another poll loop and never pass a timeout.
 *  2. `-s model=` takes the model *display name* ("Seedance 2.0 Mini"), not the
 *     modelKey. Names with spaces must stay a single argv entry.
 *  3. `--run` prints TWO JSON objects on stdout: the created node, then the
 *     terminal node carrying `status` and `data.url[]`. Take the last one.
 */

export interface LibtvNode {
  readonly nodeKey: string
  readonly nodeType: string
  readonly taskId?: string
  /** 2 = success, 3 = failed. Absent on the pre-run object. */
  readonly status?: number
  readonly data?: {
    readonly type?: string
    readonly name?: string
    readonly url?: readonly string[]
    readonly poster?: string
    readonly params?: Record<string, unknown>
  }
}

export interface LibtvClientOptions {
  readonly bin: string
  readonly projectUuid: string
  readonly log: Logger
  readonly cwd: string
}

export interface CreateNodeOptions {
  readonly name: string
  readonly type: 'image' | 'video' | 'text' | 'script' | 'audio'
  readonly prompt?: string
  readonly set?: Readonly<Record<string, string | number | boolean>>
  readonly left?: readonly string[]
  readonly run?: boolean
  readonly x?: number
  readonly y?: number
}

export class LibtvClient {
  constructor(private readonly opts: LibtvClientOptions) {}

  get projectUuid(): string {
    return this.opts.projectUuid
  }

  canvasUrl(): string {
    return `https://www.liblib.tv/canvas?projectId=${this.opts.projectUuid}`
  }

  async createNode(options: CreateNodeOptions): Promise<LibtvNode> {
    const args: string[] = ['node']
    if (options.x !== undefined) args.push('--x', String(options.x))
    if (options.y !== undefined) args.push('--y', String(options.y))
    args.push('create', options.name, '-t', options.type)
    args.push('-p', this.opts.projectUuid)

    for (const [key, value] of Object.entries(options.set ?? {})) {
      args.push('-s', `${key}=${String(value)}`)
    }
    for (const upstream of options.left ?? []) {
      args.push('--left', upstream)
    }
    if (options.prompt !== undefined) args.push('--prompt', options.prompt)
    if (options.run) args.push('--run')

    this.opts.log.debug(`libtv ${args.map(quoteForLog).join(' ')}`)

    // No timeout: `--run` legitimately blocks for minutes on video models.
    let result = await run(this.opts.bin, args, {
      cwd: this.opts.cwd,
      log: this.opts.log,
      streamStderr: true,
      timeoutMs: 0,
    })

    // A retried generation hits a node this client already created. libtv
    // refuses duplicate display names, so drop the stale node and retry once
    // — otherwise every retry policy above us is guaranteed to fail.
    if (result.code !== 0 && isDuplicateName(result.stderr)) {
      this.opts.log.warn(`libtv: node "${options.name}" already exists, recreating`)
      await this.deleteNode(options.name)
      result = await run(this.opts.bin, args, {
        cwd: this.opts.cwd,
        log: this.opts.log,
        streamStderr: true,
        timeoutMs: 0,
      })
    }

    if (result.code !== 0) {
      // libtv writes validation failures to stdout, not stderr — reporting only
      // stderr leaves an unactionable "exited 1".
      throw providerError(
        `libtv node create "${options.name}" exited ${result.code}`,
        lastLines(result.stderr) || lastLines(result.stdout) || undefined,
      )
    }

    const node = parseJsonStdout<LibtvNode>(
      result.stdout,
      `libtv node create ${options.name}`,
    )

    if (options.run && node.status === 3) {
      throw providerError(
        `libtv generation failed for node "${options.name}" (status=3).`,
        lastLines(result.stderr, 4) || lastLines(result.stdout, 4),
      )
    }
    return node
  }

  async deleteNode(name: string): Promise<void> {
    await run(this.opts.bin, ['node', 'delete', name, '-p', this.opts.projectUuid], {
      cwd: this.opts.cwd,
      timeoutMs: 60_000,
    })
  }

  async ensureCanvas(name: string): Promise<string> {
    const result = await runOrThrow(this.opts.bin, ['project', 'create', name], {
      cwd: this.opts.cwd,
      timeoutMs: 60_000,
    })
    const parsed = parseJsonStdout<{ projectMeta?: { uuid?: string } }>(
      result.stdout,
      'libtv project create',
    )
    const uuid = parsed.projectMeta?.uuid
    if (!uuid) {
      throw providerError('libtv project create returned no uuid.', result.stdout.slice(0, 300))
    }
    return uuid
  }
}

export const firstUrl = (node: LibtvNode, context: string): string => {
  const url = node.data?.url?.[0]
  if (!url) {
    throw providerError(
      `${context}: libtv returned no output URL (status=${String(node.status)}).`,
      'The node was created but produced no asset. Check the canvas.',
    )
  }
  return url
}

/**
 * libtv node display names must be unique per canvas, and `{{Node "name"}}`
 * refuses to resolve duplicates. Namespacing everything keeps that safe.
 */
export const nodeName = (projectId: string, kind: string, subject: string): string =>
  `${projectId.slice(0, 8)}-${kind}-${subject}`.replace(/[^\w.-]/g, '_').slice(0, 60)

const lastLines = (text: string, count = 6): string =>
  text.trim().split('\n').slice(-count).join('\n')

const quoteForLog = (arg: string): string =>
  /[\s"]/.test(arg) ? JSON.stringify(arg) : arg
