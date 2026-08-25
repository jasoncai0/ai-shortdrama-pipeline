import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { definePlugin } from '../../kernel/registry.js'
import { runOrThrow } from '../../lib/proc.js'
import type { MusicPort } from '../../kernel/ports.js'

/**
 * Offline music source. Synthesises a real, audible tone bed with ffmpeg so the
 * mix stage exercises genuine audio filtering — loop, fade, sidechain ducking —
 * rather than being mocked away.
 *
 * Two candidates, deliberately: the selector's job is choosing, and a stub that
 * only ever offers one option would never exercise it.
 */
export default definePlugin<MusicPort>({
  port: 'music',
  name: 'stub',
  create: (options, deps) => {
    const bin = typeof options['bin'] === 'string' ? options['bin'] : 'ffmpeg'

    return {
      name: 'stub',
      caps: { canGenerate: true, maxSeconds: 300 },

      find: async (brief, limit) => {
        const wanted = Math.min(Math.max(limit, 1), 2)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-stubmus-'))
        const seconds = Math.min(Math.max(Math.round(brief.seconds) || 8, 4), 60)

        const specs = [
          { key: 'warm', hz: 220, label: 'Stub score — warm bed' },
          { key: 'tense', hz: 110, label: 'Stub score — low tension' },
        ].slice(0, wanted)

        return Promise.all(
          specs.map(async (spec) => {
            const out = join(dir, `${spec.key}.m4a`)
            await runOrThrow(
              bin,
              [
                '-y', '-hide_banner', '-loglevel', 'error',
                '-f', 'lavfi', '-i', `sine=frequency=${spec.hz}:duration=${seconds}`,
                '-af', 'volume=0.2',
                '-c:a', 'aac', '-b:a', '96k',
                out,
              ],
              { timeoutMs: 120_000 },
            )
            deps.log.debug(`music/stub: ${spec.key} ${seconds}s`)
            return {
              id: `stub-${spec.key}`,
              title: spec.label,
              source: 'generated' as const,
              uri: pathToFileURL(out).href,
              mime: 'audio/mp4',
              seconds,
              tags: [spec.key, brief.mood, brief.genre].filter(Boolean),
              licence: {
                code: 'generated',
                commercialUse: true as const,
                derivativesAllowed: true as const,
              },
              bytes: (await readFile(out)).byteLength,
            }
          }),
        )
      },
    }
  },
})
