import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { definePlugin } from '../../kernel/registry.js'
import { runOrThrow } from '../../lib/proc.js'
import type { SpeechPort } from '../../kernel/ports.js'

/**
 * Offline speech. Emits real, decodable audio whose LENGTH tracks the text, so
 * the mix downstream behaves the way it will in production: a line that
 * outruns its shot outruns it here too.
 *
 * A quiet tone rather than silence, because a silent track hides mix bugs —
 * a missing voice and a muted voice look identical in a waveform of zeros.
 */
export default definePlugin<SpeechPort>({
  port: 'speech',
  name: 'stub',
  create: (options, deps) => {
    const bin = typeof options['bin'] === 'string' ? options['bin'] : 'ffmpeg'
    const charsPerSecond =
      typeof options['charsPerSecond'] === 'number' ? options['charsPerSecond'] : 5

    return {
      name: 'stub',
      caps: { maxChars: 100_000, maxConcurrency: 8, voices: [] },

      synthesize: async (req) => {
        const seconds = Math.min(60, Math.max(1, Math.ceil(req.text.length / charsPerSecond)))
        const dir = await mkdtemp(join(tmpdir(), 'duanju-tts-'))
        const out = join(dir, 'voice.mp3')

        deps.log.debug(`stub speech: ${req.label ?? req.idempotencyKey} (${seconds}s)`)

        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            '-f', 'lavfi',
            '-i', `sine=frequency=220:duration=${seconds}`,
            '-af', 'volume=-20dB',
            '-c:a', 'libmp3lame', '-b:a', '96k',
            out,
          ],
          { timeoutMs: 120_000 },
        )

        const bytes = new Uint8Array(await readFile(out))
        return [
          {
            id: req.idempotencyKey,
            uri: pathToFileURL(out).href,
            mime: 'audio/mpeg',
            bytes: bytes.byteLength,
            meta: { provider: 'stub', seconds, chars: req.text.length, voice: req.voice },
          },
        ]
      },
    }
  },
})
