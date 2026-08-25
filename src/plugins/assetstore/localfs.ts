import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { providerError } from '../../kernel/errors.js'
import { contentId } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import type { AssetMeta, AssetStorePort } from '../../kernel/ports.js'
import type { AssetRef } from '../../kernel/types.js'

/**
 * Default asset store: content-addressed files on local disk.
 *
 * Every remote provider URL is `ingest()`ed the moment it is produced, so the
 * project keeps working after you swap providers — or after the provider's
 * CDN link expires.
 */

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
}

const guessMime = (url: string, fallback = 'application/octet-stream'): string => {
  const clean = url.split('?')[0] ?? url
  const ext = clean.split('.').pop()?.toLowerCase()
  const found = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)
  return found?.[0] ?? fallback
}

export default definePlugin<AssetStorePort>({
  port: 'assetStore',
  name: 'localfs',
  create: (options, deps) => {
    const rawRoot = typeof options['root'] === 'string' ? options['root'] : './.duanju/assets'
    const root = isAbsolute(rawRoot) ? rawRoot : resolve(deps.cwd, rawRoot)

    const pathFor = (id: string, mime: string): string => {
      const ext = EXT_BY_MIME[mime] ?? 'bin'
      return join(root, id.slice(0, 2), `${id}.${ext}`)
    }

    const write = async (bytes: Uint8Array, meta: AssetMeta, mime: string): Promise<AssetRef> => {
      const id = contentId(bytes)
      const target = pathFor(id, mime)
      await mkdir(join(root, id.slice(0, 2)), { recursive: true })
      await writeFile(target, bytes)
      return {
        id,
        uri: pathToFileURL(target).href,
        mime,
        bytes: bytes.byteLength,
        meta: { ...meta.extra, kind: meta.kind, projectId: meta.projectId, label: meta.label },
      }
    }

    return {
      name: 'localfs',

      put: (bytes, meta) => write(bytes, meta, meta.mime ?? 'application/octet-stream'),

      get: async (ref) => {
        try {
          return new Uint8Array(await readFile(toPath(ref)))
        } catch (error) {
          throw providerError(`Asset ${ref.id} is missing from ${root}.`, undefined, error)
        }
      },

      localPath: async (ref) => toPath(ref),

      ingest: async (url, meta) => {
        if (url.startsWith('file://')) {
          const bytes = new Uint8Array(await readFile(fileURLToPath(url)))
          return write(bytes, meta, meta.mime ?? guessMime(url))
        }
        let response: Response
        try {
          response = await fetch(url)
        } catch (error) {
          throw providerError(`Failed to download asset from ${url}`, undefined, error)
        }
        if (!response.ok) {
          throw providerError(
            `Failed to download asset: HTTP ${response.status} from ${url}`,
          )
        }
        const bytes = new Uint8Array(await response.arrayBuffer())
        const mime =
          meta.mime ?? response.headers.get('content-type')?.split(';')[0]?.trim() ?? guessMime(url)
        const ref = await write(bytes, meta, mime)
        deps.log.debug(`ingested ${meta.kind} ${ref.id} (${bytes.byteLength}B)`)
        return ref
      },
    }
  },
})

const toPath = (ref: AssetRef): string => {
  if (!ref.uri.startsWith('file://')) {
    throw providerError(
      `Asset ${ref.id} is not local (${ref.uri}).`,
      'This asset was produced under a different assetStore. Re-run the stage that created it.',
    )
  }
  return fileURLToPath(ref.uri)
}
