import { configError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { LibtvClient, firstUrl, nodeName } from '../../lib/libtv.js'
import type { MusicCandidate, MusicPort } from '../../kernel/ports.js'

/**
 * Generates a score with libtv's audio model (Seed Audio).
 *
 * Generation is the fallback, not the default: it costs money and takes time,
 * while a library track or an openly-licensed search hit costs neither. Where
 * it wins is fit — a generated cue is written for this genre, mood and runtime
 * instead of being the nearest thing someone already uploaded.
 *
 * Only one candidate is produced. Offering three generated options would treble
 * the bill to give a selector a choice it can barely judge from metadata.
 *
 * Options:
 *   canvas   libtv canvas uuid (required)
 *   model    default "Seed Audio 1.0"
 *   maxSeconds  clamp, default 120
 */
export default definePlugin<MusicPort>({
  port: 'music',
  name: 'libtv',
  create: (options, deps) => {
    const projectUuid = asString(options['canvas'])
    if (!projectUuid) {
      throw configError(
        'ports.music.options.canvas is required for the libtv music adapter.',
        'Reuse the same canvas uuid as the image and video adapters.',
      )
    }

    const client = new LibtvClient({
      bin: asString(options['bin']) ?? 'libtv',
      projectUuid,
      log: deps.log,
      cwd: deps.cwd,
    })
    const model = asString(options['model']) ?? 'Seed Audio 1.0'
    const maxSeconds = numberOption(options['maxSeconds'], 120)

    return {
      name: 'libtv',
      caps: { canGenerate: true, maxSeconds },

      find: async (brief) => {
        const seconds = Math.min(Math.max(Math.round(brief.seconds), 10), maxSeconds)
        const prompt = [
          'instrumental background score for a vertical short drama, no vocals, no lyrics',
          brief.genre,
          brief.mood,
          brief.keywords.join(', '),
          brief.styleGuide,
          `about ${seconds} seconds, loopable, consistent intensity with room for dialogue on top`,
        ]
          .filter(Boolean)
          .join(', ')

        const name = nodeName(projectUuid, 'bgm', `${brief.mood || 'score'}-${seconds}s`)
        deps.log.info(`music/libtv: generating ~${seconds}s score`)

        const node = await client.createNode({
          name,
          type: 'audio',
          prompt,
          run: true,
          set: { model, duration: seconds },
        })

        const url = firstUrl(node, 'generated score')
        const candidate: MusicCandidate = {
          id: node.nodeKey,
          title: `Generated score (${brief.mood || brief.genre || 'drama'})`,
          source: 'generated',
          uri: url,
          mime: 'audio/mpeg',
          seconds,
          tags: [brief.genre, brief.mood, ...brief.keywords].filter(Boolean),
          licence: {
            code: 'generated',
            attribution: undefined,
            commercialUse: true,
            derivativesAllowed: true,
          },
        }
        return [candidate]
      },
    }
  },
})

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
