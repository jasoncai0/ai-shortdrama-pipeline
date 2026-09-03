import { createHash } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { definePlugin } from '../../kernel/registry.js'
import { runOrThrow } from '../../lib/proc.js'
import type { VideoPort } from '../../kernel/ports.js'

/**
 * Offline video adapter. Synthesises a real, playable clip with ffmpeg so the
 * export stage exercises genuine concat behaviour (codec/timebase mismatches
 * included) instead of being mocked away.
 *
 * Requires ffmpeg — the same dependency the export stage already needs.
 *
 * Options:
 *   bin      ffmpeg binary, default "ffmpeg"
 *   source   "color" (default) — one flat colour per shot, derived from the
 *            idempotency key, so a reel is visibly cut from distinct shots;
 *            "testsrc" — a structured pattern with chroma, luma steps and
 *            motion, for judging a colour grade offline.
 */
export default definePlugin<VideoPort>({
  port: 'video',
  name: 'stub',
  create: (options, deps) => {
    const bin = typeof options['bin'] === 'string' ? options['bin'] : 'ffmpeg'
    // A flat colour card proves concat behaviour but shows nothing about a
    // colour grade — every pixel reacts identically. `testsrc` gives the same
    // offline determinism over a frame with real chroma, luma steps and
    // motion, which is what a style pack has to be judged on.
    const source = options['source'] === 'testsrc' ? 'testsrc' : 'color'

    return {
      name: 'stub',
      caps: {
        modes: ['text2video', 'singleImage2video', 'frames2video', 'image2video'],
        maxSeconds: 30,
        minSeconds: 1,
        ratios: ['9:16', '16:9', '1:1', '4:3', '3:4'],
        audio: false,
        maxConcurrency: 8,
      },

      generate: async (req) => {
        const seconds = Math.min(Math.max(req.seconds ?? 2, 1), 30)
        const [w, h] = dimensionsFor(req.ratio ?? '9:16')
        const colour = colourFor(req.idempotencyKey)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-stubvid-'))
        const out = join(dir, 'clip.mp4')

        deps.log.debug(`stub video: ${req.label ?? req.idempotencyKey} (${seconds}s ${w}x${h})`)

        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            '-f', 'lavfi',
            '-i',
            source === 'testsrc'
              ? `testsrc2=s=${w}x${h}:d=${seconds}:r=24`
              : `color=c=${colour}:s=${w}x${h}:d=${seconds}:r=24`,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
            '-pix_fmt', 'yuv420p',
            out,
          ],
          { timeoutMs: 120_000 },
        )

        const bytes = new Uint8Array(await readFile(out))
        return [
          {
            id: req.idempotencyKey,
            uri: pathToFileURL(out).href,
            mime: 'video/mp4',
            bytes: bytes.byteLength,
            meta: { provider: 'stub', prompt: req.prompt, seconds, mode: req.mode },
          },
        ]
      },
    }
  },
})

const dimensionsFor = (ratio: string): readonly [number, number] => {
  switch (ratio) {
    case '9:16':
      return [270, 480]
    case '1:1':
      return [360, 360]
    default:
      return [480, 270]
  }
}

const colourFor = (seed: string): string =>
  `0x${createHash('sha256').update(seed).digest('hex').slice(0, 6)}`
