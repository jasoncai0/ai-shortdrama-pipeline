import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { runOrThrow } from '../../lib/proc.js'
import type { ExportPort } from '../../kernel/ports.js'

/**
 * Concatenates shot clips into a final cut.
 *
 * Re-encodes rather than stream-copying: clips come from different providers
 * with different codecs/timebases, and concat-demuxer stream copy silently
 * produces broken output when they disagree.
 */
export default definePlugin<ExportPort>({
  port: 'export',
  name: 'ffmpeg',
  create: (options, deps) => {
    const bin = typeof options['bin'] === 'string' ? options['bin'] : 'ffmpeg'

    return {
      name: 'ffmpeg',

      concat: async (clips, opts, store, projectId) => {
        if (clips.length === 0) {
          throw providerError(
            'Nothing to export: no clips were produced.',
            'Run the "videos" stage first.',
          )
        }

        const paths = await Promise.all(clips.map((clip) => store.localPath(clip)))
        const workDir = await mkdtemp(join(tmpdir(), 'duanju-export-'))
        const listFile = join(workDir, 'clips.txt')
        const outFile = join(workDir, `${opts.outputLabel}.mp4`)

        const listBody = paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
        await writeFile(listFile, `${listBody}\n`, 'utf8')

        const [w, h] = dimensionsFor(opts.ratio)
        const scale = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`

        deps.log.info(`ffmpeg: concatenating ${clips.length} clips → ${opts.ratio} @${opts.fps}fps`)

        await runOrThrow(
          bin,
          [
            '-y',
            '-hide_banner',
            '-loglevel', 'error',
            '-f', 'concat',
            '-safe', '0',
            '-i', listFile,
            '-vf', scale,
            '-r', String(opts.fps),
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', String(opts.crf),
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            outFile,
          ],
          { timeoutMs: 0, log: deps.log },
        )

        const bytes = new Uint8Array(await readFile(outFile))
        return store.put(bytes, {
          kind: 'final',
          mime: 'video/mp4',
          projectId,
          label: opts.outputLabel,
        })
      },
    }
  },
})

const dimensionsFor = (ratio: string): readonly [number, number] => {
  switch (ratio) {
    case '9:16':
      return [1080, 1920]
    case '1:1':
      return [1080, 1080]
    case '16:9':
    default:
      return [1920, 1080]
  }
}
