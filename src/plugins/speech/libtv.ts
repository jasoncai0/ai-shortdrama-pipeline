import { configError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { LibtvClient, firstUrl, nodeName } from '../../lib/libtv.js'
import type { SpeechPort } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Text-to-speech through the libtv canvas CLI (`-t audio`).
 *
 * The voice id is the thing that matters for continuity: one character must
 * keep one voice across every episode, exactly as they keep one `@base` face.
 * So `voice` is a per-request input the `dub` stage supplies from its cast
 * table, not an adapter-wide setting.
 *
 * Options:
 *   canvas    libtv project uuid (share it with image/video so one canvas
 *             holds the whole production)
 *   model     display name, default "Minimax-speech-2.8-hd"
 *   voice     fallback voice id when a request names none
 *   speed     0.5–2.0, default 1
 */
export default definePlugin<SpeechPort>({
  port: 'speech',
  name: 'libtv',
  create: (options, deps) => {
    const projectUuid = asString(options['canvas'])
    if (!projectUuid) {
      throw configError(
        'ports.speech.options.canvas is required for the libtv speech adapter.',
        'Reuse the same canvas uuid as the image/video adapters.',
      )
    }

    const client = new LibtvClient({
      bin: asString(options['bin']) ?? 'libtv',
      projectUuid,
      log: deps.log,
      cwd: deps.cwd,
    })
    const model = asString(options['model']) ?? 'Minimax-speech-2.8-hd'
    const fallbackVoice = asString(options['voice'])
    const defaultSpeed = numberOption(options['speed'], 1)

    return {
      name: 'libtv',
      caps: {
        // The model advertises 50000; a shot's line is never near that.
        maxChars: 50_000,
        maxConcurrency: 3,
        // Any provider voice id is accepted, so no allow-list to enforce.
        voices: [],
      },

      synthesize: async (req): Promise<readonly AssetRef[]> => {
        const label = req.label ?? req.idempotencyKey
        const name = nodeName(projectUuid, 'tts', label)
        const voice = req.voice ?? fallbackVoice

        const node = await client.createNode({
          name,
          type: 'audio',
          prompt: req.text,
          run: true,
          set: {
            model,
            ...(voice ? { voice: voice } : {}),
            speed: clamp(req.speed ?? defaultSpeed, 0.5, 2),
            ...scalarParams(req.params),
          },
        })

        const url = firstUrl(node, `speech "${label}"`)
        return [
          {
            id: node.nodeKey,
            uri: url,
            mime: 'audio/mpeg',
            meta: {
              provider: 'libtv',
              libtvNodeKey: node.nodeKey,
              libtvNodeName: name,
              voice,
              canvas: client.canvasUrl(),
            },
          },
        ]
      },
    }
  },
})

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const scalarParams = (
  params: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number | boolean> => {
  if (!params) return {}
  return Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string | number | boolean] =>
        ['string', 'number', 'boolean'].includes(typeof entry[1]),
    ),
  )
}
