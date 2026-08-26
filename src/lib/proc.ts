import { spawn } from 'node:child_process'
import { providerError } from '../kernel/errors.js'
import type { Logger } from '../kernel/ports.js'

export interface RunResult {
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

export interface RunOptions {
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string>>
  /** Milliseconds. 0 disables the timeout — required for long libtv runs. */
  readonly timeoutMs?: number
  readonly log?: Logger
  /** Stream child stderr to our logger as it arrives (progress lines). */
  readonly streamStderr?: boolean
  /**
   * Written to the child's stdin, which is then closed. Used to hand a helper
   * its input without that input ever touching disk.
   */
  readonly stdin?: string
}

/**
 * Thin child-process wrapper. Note: callers driving `libtv ... --run` MUST NOT
 * add their own polling or timeouts — that command blocks until terminal state
 * by design.
 */
export const run = async (
  cmd: string,
  args: readonly string[],
  opts: RunOptions = {},
): Promise<RunResult> => {
  const { cwd, env, timeoutMs = 0, log, streamStderr = false, stdin } = opts

  return new Promise<RunResult>((resolvePromise, reject) => {
    const child = spawn(cmd, [...args], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    })

    if (stdin !== undefined && child.stdin) {
      child.stdin.end(stdin)
    }

    const outChunks: string[] = []
    const errChunks: string[] = []
    let timer: NodeJS.Timeout | undefined

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(
          providerError(
            `Command timed out after ${timeoutMs}ms: ${cmd} ${args.join(' ')}`,
          ),
        )
      }, timeoutMs)
    }

    // stdio is 'pipe' for both, so these are non-null; TS cannot see that
    // through the conditional stdin entry.
    const stdout = child.stdout as NodeJS.ReadableStream
    const stderr = child.stderr as NodeJS.ReadableStream

    stdout.setEncoding('utf8')
    stdout.on('data', (chunk: string) => outChunks.push(chunk))

    stderr.setEncoding('utf8')
    stderr.on('data', (chunk: string) => {
      errChunks.push(chunk)
      if (streamStderr && log) {
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim()
          if (trimmed) log.debug(trimmed)
        }
      }
    })

    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      reject(
        providerError(
          `Cannot spawn "${cmd}": ${error.message}`,
          `Make sure "${cmd}" is installed and on PATH.`,
          error,
        ),
      )
    })

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolvePromise({
        stdout: outChunks.join(''),
        stderr: errChunks.join(''),
        code: code ?? -1,
      })
    })
  })
}

export const runOrThrow = async (
  cmd: string,
  args: readonly string[],
  opts: RunOptions = {},
): Promise<RunResult> => {
  const result = await run(cmd, args, opts)
  if (result.code !== 0) {
    const tail = result.stderr.trim().split('\n').slice(-6).join('\n')
    throw providerError(
      `${cmd} exited ${result.code}`,
      tail || `Command: ${cmd} ${args.join(' ')}`,
    )
  }
  return result
}

/**
 * Parses the LAST complete JSON value on stdout.
 *
 * `libtv ... --run` emits two JSON documents (created node, then terminal
 * node) and pretty-prints them across multiple lines when stdout is not a
 * TTY — so neither "parse the whole buffer" nor "parse the last line" works.
 * We scan for balanced top-level values instead, ignoring braces inside
 * strings.
 */
export const parseJsonStdout = <T>(stdout: string, context: string): T => {
  const values = extractJsonValues(stdout)
  const last = values.at(-1)
  if (last === undefined) {
    throw providerError(
      `${context}: no JSON value found on stdout.`,
      stdout.trim().slice(0, 400) || '(empty)',
    )
  }
  return last as T
}

/** Top-level JSON values in emission order. Malformed fragments are skipped. */
export const extractJsonValues = (text: string): readonly unknown[] => {
  const values: unknown[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]

    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') {
      if (depth === 0) start = i
      depth += 1
      continue
    }
    if (ch === '}' || ch === ']') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start >= 0) {
        try {
          values.push(JSON.parse(text.slice(start, i + 1)))
        } catch {
          // Not a valid value (e.g. truncated output) — skip it.
        }
        start = -1
      }
    }
  }
  return values
}
