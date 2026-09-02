import { configError, providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { SUBMIT_INTERVAL_MS, registerAsset } from '../../lib/compliance.js'
import { LibtvClient, firstUrl, nodeName } from '../../lib/libtv.js'
import type { VideoPort } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Video generation via the libtv canvas CLI.
 *
 * libtv has no batch "storyboard → video" command (only storyboard → images),
 * so one canvas `video` node is created per shot, wired to that shot's still.
 */

const MODES = ['text2video', 'singleImage2video', 'frames2video', 'image2video', 'mixed2video'] as const

const RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9', 'adaptive'] as const

export default definePlugin<VideoPort>({
  port: 'video',
  name: 'libtv',
  create: (options, deps) => {
    const projectUuid = asString(options['canvas'])
    if (!projectUuid) {
      throw configError(
        'ports.video.options.canvas is required for the libtv video adapter.',
        'Reuse the same canvas uuid as the image adapter so stills and clips share one canvas.',
      )
    }

    const client = new LibtvClient({
      bin: asString(options['bin']) ?? 'libtv',
      projectUuid,
      log: deps.log,
      cwd: deps.cwd,
    })
    const model = asString(options['model']) ?? 'Seedance 2.0 Mini'
    const resolution = asString(options['resolution']) ?? '720p'
    const enableSound = options['enableSound'] === false ? 'off' : 'on'
    const maxSeconds = typeof options['maxSeconds'] === 'number' ? options['maxSeconds'] : 15
    const minSeconds = typeof options['minSeconds'] === 'number' ? options['minSeconds'] : 4

    // Seedance refuses to animate media the account has not filed through the
    // compliance register. Credentials come from the environment, never the
    // config, so a session token is not committed alongside a project.
    const complianceToken =
      process.env['DUANJU_COMPLIANCE_TOKEN'] ?? asString(options['complianceToken'])
    const complianceWebid =
      process.env['DUANJU_COMPLIANCE_WEBID'] ?? asString(options['complianceWebid'])
    const creds =
      complianceToken && complianceWebid
        ? { token: complianceToken, webid: complianceWebid, projectUuid }
        : undefined

    // One filing per URL per process, and paced: the register allows 15/min.
    const filed = new Set<string>()
    let lastFiling = 0
    const registerForCompliance = async (
      ref: AssetRef,
      kind: 'image' | 'audio',
      label: string,
    ): Promise<void> => {
      if (!creds) {
        deps.log.warn(
          `libtv video: "${label}" needs compliance filing but DUANJU_COMPLIANCE_TOKEN/DUANJU_COMPLIANCE_WEBID are unset — the model will refuse it.`,
        )
        return
      }
      const url = asString(ref.meta['cdnUrl']) ?? (await client.nodeUrl(ref))
      if (!url) {
        deps.log.warn(`libtv video: cannot file "${label}" ${kind} — no CDN url for it.`)
        return
      }
      if (filed.has(url)) return

      const wait = SUBMIT_INTERVAL_MS - (Date.now() - lastFiling)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      lastFiling = Date.now()

      const result = await registerAsset(url, kind, creds)
      if (result.ok) filed.add(url)
      else deps.log.warn(`libtv video: compliance filing for "${label}" ${kind} failed — ${result.reason}`)
    }

    return {
      name: 'libtv',
      caps: {
        modes: MODES,
        maxSeconds,
        minSeconds,
        ratios: [...RATIOS],
        audio: true,
        maxConcurrency: 2,
      },

      generate: async (req): Promise<readonly AssetRef[]> => {
        const label = req.label ?? req.idempotencyKey
        const name = nodeName(projectUuid, 'vid', label)

        const left: string[] = []
        // References are re-uploaded from the local store rather than pointed
        // at the canvas node that originally generated them: those nodes get
        // deleted and re-keyed by recreations, and their display names collide
        // between projects sharing a canvas. An uploaded resource node is
        // fresh, uniquely keyed, and ours alone.
        const pushRef = async (ref: AssetRef | undefined, what: string): Promise<void> => {
          if (!ref) return
          const local = ref.uri.startsWith('file://') ? ref.uri.slice('file://'.length) : undefined
          const canvasName = local
            ? await client.ensureUploaded(local, ref.id)
            : (asString(ref.meta['libtvNodeKey']) ?? asString(ref.meta['libtvNodeName']))
          if (!canvasName) {
            throw providerError(
              `libtv video: ${what} for "${label}" has no local file and no canvas node.`,
              'Stills must come from the asset store or a libtv canvas.',
            )
          }
          if (!left.includes(canvasName)) left.push(canvasName)
        }

        const firstFrameRef = req.firstFrame
        if (req.mode === 'singleImage2video' || req.mode === 'frames2video') {
          await pushRef(req.firstFrame, 'first frame')
        }
        if (req.mode === 'frames2video') await pushRef(req.lastFrame, 'last frame')
        if (req.mode === 'image2video' || req.mode === 'mixed2video') {
          for (const ref of req.refs ?? []) await pushRef(ref, 'reference image')
        }

        // Identity anchors are additional inputs, never a substitute for the
        // first frame. libtv expresses "first frame + extra references" as
        // 全能参考 (mixed2video), so promote the mode rather than dropping them.
        let mode = req.mode
        const identity = req.identityRefs ?? []
        if (identity.length > 0) {
          if (mode === 'singleImage2video') {
            await pushRef(req.firstFrame, 'first frame')
            mode = 'mixed2video'
          }
          for (const ref of identity) {
            try {
              await pushRef(ref, 'identity reference')
            } catch {
              deps.log.warn(
                `libtv video: identity reference for "${label}" has no local file and was dropped.`,
              )
            }
          }
          if (mode === 'text2video') mode = 'image2video'
        }

        // Speech drives the mouth. libtv carries audio only in 全能参考
        // (mixed2video), so a voiced shot is promoted into that mode — the
        // still stays frame zero, the voice rides alongside it.
        if (req.voiceTrack) {
          if (!MODES.includes('mixed2video')) {
            deps.log.warn(
              `libtv video: "${label}" has speech but model "${model}" has no mixed2video; generating without lip sync.`,
            )
          } else {
            await registerForCompliance(req.voiceTrack, 'audio', label)
            if (firstFrameRef) await registerForCompliance(firstFrameRef, 'image', label)
            await pushRef(req.voiceTrack, 'voice track')
            mode = 'mixed2video'
          }
        }

        const seconds = clamp(req.seconds ?? minSeconds, minSeconds, maxSeconds)
        if (req.seconds !== undefined && req.seconds !== seconds) {
          deps.log.warn(
            `libtv video: clamped duration ${req.seconds}s → ${seconds}s (model allows ${minSeconds}–${maxSeconds}s).`,
          )
        }

        const node = await client.createNode({
          name,
          type: 'video',
          prompt: req.prompt,
          left,
          run: true,
          set: applyParams(
            {
              model,
              modeType: mode,
              duration: seconds,
              ratio: req.ratio ?? '9:16',
              resolution,
              enableSound,
            },
            req.params,
          ),
        })

        const url = firstUrl(node, `video "${label}"`)
        return [
          {
            id: node.nodeKey,
            uri: url,
            mime: 'video/mp4',
            meta: {
              provider: 'libtv',
              libtvNodeKey: node.nodeKey,
              libtvNodeName: name,
              seconds,
              canvas: client.canvasUrl(),
            },
          },
        ]
      },
    }
  },
})

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.round(n)))

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

