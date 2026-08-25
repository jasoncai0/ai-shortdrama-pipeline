import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { definePlugin } from '../../kernel/registry.js'
import type { MusicCandidate, MusicPort } from '../../kernel/ports.js'

/**
 * The user's own music library — a directory of audio files.
 *
 * Tracks you already hold rights to should win by default, so this adapter is
 * usually first in the `multi` chain. Licence is recorded as `user-provided`:
 * the pipeline takes the user's word for it rather than pretending to verify
 * something it cannot see.
 *
 * A sidecar `<track>.json` supplies metadata the filename cannot:
 *
 *   { "title": "…", "tags": ["tense","strings"], "seconds": 96,
 *     "licence": { "code": "licensed", "attribution": "…" } }
 *
 * Without one, tags are derived from the filename, which is why
 * `tense-strings-loop.mp3` matches better than `track_03.mp3`.
 *
 * Options:
 *   dir     library directory, default ./music
 *   exts    default .mp3 .wav .m4a .aac .ogg .flac
 */

const DEFAULT_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']

interface Sidecar {
  readonly title?: string
  readonly tags?: readonly string[]
  readonly seconds?: number
  readonly creator?: string
  readonly licence?: {
    readonly code?: string
    readonly attribution?: string
    readonly url?: string
  }
}

export default definePlugin<MusicPort>({
  port: 'music',
  name: 'local',
  create: (options, deps) => {
    const rawDir = typeof options['dir'] === 'string' ? options['dir'] : './music'
    const dir = isAbsolute(rawDir) ? rawDir : resolve(deps.cwd, rawDir)
    const exts = Array.isArray(options['exts'])
      ? (options['exts'] as unknown[]).filter((e): e is string => typeof e === 'string')
      : DEFAULT_EXTS

    return {
      name: 'local',
      caps: { canGenerate: false },

      find: async (brief, limit) => {
        let entries: string[]
        try {
          entries = await readdir(dir)
        } catch {
          deps.log.debug(`music/local: no library at ${dir}`)
          return []
        }

        const audio = entries.filter((e) => exts.includes(extname(e).toLowerCase()))
        if (audio.length === 0) {
          deps.log.debug(`music/local: ${dir} holds no audio files`)
          return []
        }

        const wanted = new Set(
          [brief.mood, brief.genre, ...brief.keywords]
            .join(' ')
            .toLowerCase()
            .split(/[^a-z0-9一-鿿]+/)
            .filter((w) => w.length > 2),
        )

        const scored = await Promise.all(
          audio.map(async (file) => {
            const path = join(dir, file)
            const sidecar = await readSidecar(path)
            const tags =
              sidecar?.tags ??
              file
                .replace(extname(file), '')
                .toLowerCase()
                .split(/[^a-z0-9一-鿿]+/)
                .filter(Boolean)

            const overlap = tags.filter((t) => wanted.has(t.toLowerCase())).length
            const size = await stat(path).then((s) => s.size).catch(() => 0)

            const candidate: MusicCandidate = {
              id: `local-${file}`,
              title: sidecar?.title ?? file.replace(extname(file), ''),
              source: 'local',
              uri: pathToFileURL(path).href,
              mime: mimeFor(extname(file)),
              seconds: sidecar?.seconds,
              creator: sidecar?.creator,
              tags,
              licence: {
                code: sidecar?.licence?.code ?? 'user-provided',
                url: sidecar?.licence?.url,
                attribution: sidecar?.licence?.attribution,
                // The user supplied the file; we take their word rather than
                // pretending to have verified terms we cannot see.
                commercialUse: true,
                derivativesAllowed: true,
              },
            }
            return { candidate, overlap, size }
          }),
        )

        const usable = scored.filter((s) => s.size > 0)
        usable.sort((a, b) => b.overlap - a.overlap)

        deps.log.info(
          `music/local: ${usable.length} track(s) in ${dir}, best tag overlap ${usable[0]?.overlap ?? 0}`,
        )
        return usable.slice(0, limit).map((s) => s.candidate)
      },
    }
  },
})

const readSidecar = async (audioPath: string): Promise<Sidecar | undefined> => {
  const jsonPath = audioPath.replace(extname(audioPath), '.json')
  try {
    return JSON.parse(await readFile(jsonPath, 'utf8')) as Sidecar
  } catch {
    return undefined
  }
}

const mimeFor = (ext: string): string =>
  ({
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
  })[ext.toLowerCase()] ?? 'audio/mpeg'
