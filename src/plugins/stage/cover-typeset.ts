import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { providerError, stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { run } from '../../lib/proc.js'
import type { StagePort } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Typesets title, synopsis and episode numbers onto the cover plate.
 *
 * The cover stage renders a deliberately textless plate because a generative
 * model mangles CJK often enough that a wrong-title cover is worse than none.
 * This stage puts the words on with Pillow — exact by construction — via
 * tools/typeset-cover.py, the same script a human uses to iterate by hand, so
 * the pipeline and manual tweaks can never drift apart.
 *
 * Produces one series poster (title + synopsis + label) and, when
 * `perEpisode` is on, one cover per selected episode (title + 「第X集」 seal).
 *
 * Options:
 *   title        text across the top; default: the project title
 *   intro        synopsis lines for the poster. String array, or the default:
 *                the plan's logline split at sentence breaks
 *   label        small footer on the poster, e.g. "01"; default none
 *   perEpisode   also emit one numbered cover per episode (default true)
 *   subtitle     footer for per-episode covers; default none
 *   script       path to the typesetter; default tools/typeset-cover.py
 *   python       interpreter; default python3
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'cover-typeset',
  create: (options, deps) => ({
    name: 'cover-typeset',
    id: 'cover-typeset',
    needs: ['cover'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      if (!project.cover) {
        throw stateError('cover-typeset requires a cover plate.', 'Run the "cover" stage first.')
      }

      const python = str(ctx.options['python'] ?? options['python']) ?? 'python3'
      const rawScript =
        str(ctx.options['script'] ?? options['script']) ?? 'tools/typeset-cover.py'
      const script = isAbsolute(rawScript) ? rawScript : resolve(deps.cwd, rawScript)

      const title = str(ctx.options['title']) ?? project.plan?.title ?? project.title
      const label = str(ctx.options['label'])
      const subtitle = str(ctx.options['subtitle'])
      const perEpisode = ctx.options['perEpisode'] !== false

      const intro = Array.isArray(ctx.options['intro'])
        ? (ctx.options['intro'] as unknown[]).filter((l): l is string => typeof l === 'string')
        : defaultIntro(project.plan?.logline)

      const plate = await ports.assetStore.localPath(project.cover)
      const dir = await mkdtemp(join(tmpdir(), 'duanju-poster-'))

      const typeset = async (args: readonly string[], out: string, what: string) => {
        const result = await run(python, [script, '--plate', plate, '--title', title, '--out', out, ...args], {
          timeoutMs: 120_000,
          log,
        })
        if (result.code !== 0) {
          throw providerError(
            `cover-typeset: ${what} failed: ${result.stderr.slice(0, 300)}`,
            'The typesetter needs python3 with Pillow and a CJK font (see tools/typeset-cover.py).',
          )
        }
        return ports.assetStore.put(new Uint8Array(await readFile(out)), {
          kind: 'other',
          mime: 'image/jpeg',
          projectId: project.id,
          label: what,
        })
      }

      const posters: AssetRef[] = []

      const posterArgs = [
        ...(intro.length > 0 ? ['--intro', intro.join('|')] : []),
        ...(label ? ['--subtitle', label] : []),
      ]
      posters.push(await typeset(posterArgs, join(dir, 'poster.jpg'), 'poster'))

      if (perEpisode) {
        for (const episode of project.episodes) {
          const args = [
            '--episode', String(episode.index),
            ...(subtitle ? ['--subtitle', subtitle] : []),
          ]
          posters.push(
            await typeset(args, join(dir, `ep${episode.index}.jpg`), `cover-ep${episode.index}`),
          )
        }
      }

      log.info(
        `cover-typeset: 1 poster${perEpisode ? ` + ${project.episodes.length} episode cover(s)` : ''}`,
      )
      ctx.emit('cover-typeset', { count: posters.length })

      return {
        kind: 'ok',
        project: { ...project, posters, updatedAt: new Date().toISOString() },
      }
    },
  }),
})

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/**
 * A logline is one long sentence; a poster wants two or three short lines.
 * Splitting on sentence punctuation is the deterministic version of that,
 * and an empty logline simply means no synopsis block.
 */
export const defaultIntro = (logline: string | undefined): readonly string[] => {
  if (!logline) return []
  return logline
    .split(/[。；;]|——/)
    .flatMap((part) => part.split(/[,，]\s*(?=.{12,})/))
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 3)
}
