/** Typed failures so the CLI can render actionable messages instead of stacks. */

export class DuanjuError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hint?: string,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'DuanjuError'
  }
}

export const configError = (message: string, hint?: string): DuanjuError =>
  new DuanjuError(message, 'E_CONFIG', hint)

export const pluginError = (
  message: string,
  hint?: string,
  cause?: unknown,
): DuanjuError => new DuanjuError(message, 'E_PLUGIN', hint, cause)

export const capsError = (message: string, hint?: string): DuanjuError =>
  new DuanjuError(message, 'E_CAPS', hint)

export const providerError = (
  message: string,
  hint?: string,
  cause?: unknown,
): DuanjuError => new DuanjuError(message, 'E_PROVIDER', hint, cause)

export const stateError = (message: string, hint?: string): DuanjuError =>
  new DuanjuError(message, 'E_STATE', hint)

export const timeoutError = (message: string, hint?: string): DuanjuError =>
  new DuanjuError(message, 'E_TIMEOUT', hint)

export const budgetError = (message: string, hint?: string): DuanjuError =>
  new DuanjuError(message, 'E_BUDGET', hint)

export const describeError = (err: unknown): string => {
  if (err instanceof DuanjuError) {
    return err.hint ? `[${err.code}] ${err.message}\n  → ${err.hint}` : `[${err.code}] ${err.message}`
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}
