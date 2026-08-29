import { configError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { LibtvClient, firstUrl, nodeName } from '../../lib/libtv.js'
import type { ImagePort } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Image generation via the libtv canvas CLI.
 *
 * Consistency mechanism: reference images must exist as canvas nodes and be
 * wired as upstream edges (`--left`). We pass their node names, which libtv
 * feeds to the model as the reference list — the same thing the web canvas
 * does when you drag an image onto a generator.
 *
 * The returned URL is a provider CDN link; the kernel ingests it into the
 * asset store immediately, so nothing downstream depends on it staying alive.
 */

const RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4'] as const

export default definePlugin<ImagePort>({
  port: 'image',
  name: 'libtv',
  create: (options, deps) => {
    const projectUuid = asString(options['canvas'])
    if (!projectUuid) {
      throw configError(
        'ports.image.options.canvas is required for the libtv image adapter.',
        'Create one with `libtv project create <name>` and paste its uuid, or set LIBTV_PROJECT_UUID.',
      )
    }

    const client = new LibtvClient({
      bin: asString(options['bin']) ?? 'libtv',
      projectUuid,
      log: deps.log,
      cwd: deps.cwd,
    })
    const model = asString(options['model']) ?? 'General image V2'
    const quality = asString(options['quality'])

    return {
      name: 'libtv',
      caps: {
        // libtv resolves references through canvas edges; 4 is a safe cap.
        refImages: 4,
        ratios: [...RATIOS],
        maxConcurrency: 4,
      },

      generate: async (req): Promise<readonly AssetRef[]> => {
        const label = req.label ?? req.idempotencyKey
        const name = nodeName(projectUuid, 'img', label)

        // Reference nodes must already exist on the canvas. We carry their
        // canvas node names in AssetRef.meta.libtvNodeName when we created
        // them; anything else cannot be wired as an edge.
        // References are re-uploaded from the local store — canvas nodes get
        // deleted and re-keyed by recreations, and display names collide
        // between projects sharing a canvas. See the video adapter.
        const left: string[] = []
        for (const ref of req.refs ?? []) {
          const local = ref.uri.startsWith('file://') ? ref.uri.slice('file://'.length) : undefined
          const canvasName = local
            ? await client.ensureUploaded(local, ref.id)
            : (asString(ref.meta['libtvNodeKey']) ?? asString(ref.meta['libtvNodeName']))
          if (canvasName && !left.includes(canvasName)) left.push(canvasName)
        }

        if ((req.refs?.length ?? 0) > left.length) {
          deps.log.warn(
            `libtv image: ${(req.refs?.length ?? 0) - left.length} reference(s) have no canvas node and were dropped.`,
          )
        }

        // libtv rejects reference edges unless the node is in image-to-image
        // mode — the default text2image silently has no way to consume them.
        // This switch is what makes character/scene consistency work at all.
        const modeType = left.length > 0 ? 'image2image' : 'text2image'

        const node = await client.createNode({
          name,
          type: 'image',
          prompt: req.prompt,
          left,
          run: true,
          set: applyParams(
            {
              model,
              modeType,
              ratio: req.ratio ?? '9:16',
              ...(quality ? { quality } : {}),
            },
            req.params,
          ),
        })

        const url = firstUrl(node, `image "${label}"`)
        return [
          {
            id: node.nodeKey,
            uri: url,
            mime: 'image/png',
            meta: {
              provider: 'libtv',
              libtvNodeKey: node.nodeKey,
              libtvNodeName: name,
              canvas: client.canvasUrl(),
            },
          },
        ]
      },
    }
  },
})

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/**
 * Scalar `-s key=value` overrides from per-shot tuning.
 *
 * An explicit `null` DROPS the key instead of setting it. This matters because
 * the adapter's own defaults are model-specific: override `model` for one shot
 * and settings like `enableSound` may not exist in the new model's schema at
 * all, which libtv rejects outright. `null` is how a caller says "not for this
 * model".
 */
const applyParams = (
  base: Record<string, string | number | boolean>,
  params: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number | boolean> => {
  if (!params) return base
  const out = { ...base }
  for (const [key, value] of Object.entries(params)) {
    if (value === null) delete out[key]
    else if (['string', 'number', 'boolean'].includes(typeof value)) {
      out[key] = value as string | number | boolean
    }
  }
  return out
}

