import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

/**
 * Where run data lives when the config does not say.
 *
 * Run data is not source: one run of five episodes is a few hundred megabytes
 * of generated images and video, plus state and a ledger that name a paid
 * account. Defaulting it into the working tree puts all of that next to the
 * code, one `.gitignore` miss away from being committed, and makes `rm -rf` on
 * a checkout destroy a run.
 *
 * `DUANJU_DATA` overrides. Otherwise `$XDG_DATA_HOME/duanju`, falling back to
 * `~/.local/share/duanju` — outside any checkout either way.
 */
export const dataRoot = (env: NodeJS.ProcessEnv = process.env): string => {
  const explicit = env['DUANJU_DATA']
  if (explicit && explicit.length > 0) {
    return isAbsolute(explicit) ? explicit : resolve(explicit)
  }

  const xdg = env['XDG_DATA_HOME']
  if (xdg && isAbsolute(xdg)) return join(xdg, 'duanju')

  return join(homedir(), '.local', 'share', 'duanju')
}

/**
 * Resolves a configured root.
 *
 * An explicit path is the user's choice: absolute is taken as given, relative
 * is relative to `cwd` — same as every other config path. Only when the config
 * says nothing does the fallback land under the data root, because a *default*
 * that writes run data into whatever checkout happens to be the cwd is how
 * generated video ends up next to source code.
 */
export const resolveDataPath = (
  configured: unknown,
  cwd: string,
  fallback: string,
  env?: NodeJS.ProcessEnv,
): string => {
  if (typeof configured === 'string' && configured.length > 0) {
    return isAbsolute(configured) ? configured : resolve(cwd, configured)
  }
  return join(dataRoot(env), fallback)
}
