import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { DEFAULT_ALLOWED_LICENCES, checkLicence, parseCreativeCommons } from '../../lib/licence.js'
import type { MusicCandidate, MusicPort } from '../../kernel/ports.js'

/**
 * Searches Openverse for openly-licensed music.
 *
 * Openverse indexes Jamendo, Freesound and others, and — crucially — returns
 * machine-readable licence terms. That is what makes an automated search
 * defensible: results arrive with `by-nc-nd` and `by-nc-sa` mixed in, and a
 * pipeline that downloads whatever ranked first would quietly put a
 * no-derivatives track under a commercial video.
 *
 * Rejected candidates are logged with the reason, not silently dropped — a
 * search that returns nothing usable should look different from a broken one.
 *
 * Options:
 *   endpoint        default https://api.openverse.org/v1/audio/
 *   allowedLicences default cc0, pdm, by
 *   minSeconds / maxSeconds  runtime window, default 20 / 600
 *   timeoutMs       default 20000
 */

interface OpenverseResult {
  readonly id?: string
  readonly title?: string
  readonly url?: string
  readonly creator?: string
  readonly license?: string
  readonly license_version?: string
  readonly attribution?: string
  readonly duration?: number
  readonly tags?: readonly { readonly name?: string }[]
}

export default definePlugin<MusicPort>({
  port: 'music',
  name: 'openverse',
  create: (options, deps) => {
    const endpoint =
      typeof options['endpoint'] === 'string'
        ? options['endpoint']
        : 'https://api.openverse.org/v1/audio/'
    const allowed = Array.isArray(options['allowedLicences'])
      ? (options['allowedLicences'] as unknown[]).filter((l): l is string => typeof l === 'string')
      : DEFAULT_ALLOWED_LICENCES
    const minSeconds = numberOption(options['minSeconds'], 20)
    const maxSeconds = numberOption(options['maxSeconds'], 600)
    const timeoutMs = numberOption(options['timeoutMs'], 20_000)
    // Anonymous requests are capped at 20 by the API; asking for more is a 400,
    // not a truncated page.
    const limitPageSize = Math.min(numberOption(options['pageSize'], 20), 20)
    const attempts = numberOption(options['attempts'], 3)

    return {
      name: 'openverse',
      caps: { canGenerate: false },

      find: async (brief, limit) => {
        // Openverse ANDs every term, so a full brief ("tense noir thriller
        // instrumental suspense") reliably returns nothing while "tense noir"
        // returns three. Drop terms from the least distinctive end until
        // something comes back rather than reporting an empty library.
        const terms = [brief.mood, brief.genre, ...brief.keywords].filter(Boolean)
        const attempts = terms.length > 0
          ? terms.map((_t, i) => terms.slice(0, terms.length - i).join(' ')).filter((q) => q.length > 0)
          : ['instrumental']

        let results: readonly OpenverseResult[] = []
        let query = attempts[0] as string

        for (const attempt of attempts) {
          query = attempt
          results = await search(attempt)
          if (results.length > 0) break
          deps.log.debug(`openverse: "${attempt}" returned nothing, widening`)
        }

        const candidates: MusicCandidate[] = []
        const rejected: string[] = []

        for (const result of results) {
          if (!result.url || !result.license) continue

          const licence = {
            ...parseCreativeCommons(result.license, result.license_version),
            attribution: result.attribution,
          }
          const verdict = checkLicence(licence, {
            allowed,
            requireCommercialUse: true,
            requireDerivatives: true,
          })
          if (!verdict.ok) {
            rejected.push(`${result.title ?? result.id}: ${verdict.reason}`)
            continue
          }

          const seconds = result.duration ? Math.round(result.duration / 1000) : undefined
          if (seconds !== undefined && (seconds < minSeconds || seconds > maxSeconds)) {
            rejected.push(`${result.title ?? result.id}: ${seconds}s outside ${minSeconds}–${maxSeconds}s`)
            continue
          }

          candidates.push({
            id: `ov-${result.id ?? candidates.length}`,
            title: result.title ?? 'untitled',
            source: 'search',
            uri: result.url,
            mime: 'audio/mpeg',
            seconds,
            creator: result.creator,
            tags: (result.tags ?? []).map((t) => t.name).filter((t): t is string => Boolean(t)),
            licence,
          })
          if (candidates.length >= limit) break
        }

        deps.log.info(
          `openverse: "${query}" → ${candidates.length} usable, ${rejected.length} rejected`,
        )
        for (const reason of rejected.slice(0, 5)) deps.log.debug(`  rejected ${reason}`)

        return candidates
      },
    }

    async function search(query: string): Promise<readonly OpenverseResult[]> {
        const url = new URL(endpoint)
        url.searchParams.set('q', query)
        url.searchParams.set('page_size', String(Math.min(Math.max(limitPageSize, 8), 20)))
        url.searchParams.set('license', allowed.filter((l) => l !== 'user-provided' && l !== 'generated').join(','))

        // TLS resets mid-handshake are common behind corporate proxies and
        // fake-ip DNS setups, and they are transient — a music search should
        // not lose the run over one.
        let lastError: unknown
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), timeoutMs)
          try {
            const response = await fetch(url, {
              headers: { 'user-agent': 'duanju-poc/0.1 (short-drama pipeline)' },
              signal: controller.signal,
            })
            if (!response.ok) {
              throw providerError(
                `Openverse returned HTTP ${response.status}`,
                (await response.text()).slice(0, 200),
              )
            }
            const payload = (await response.json()) as { results?: readonly OpenverseResult[] }
            return payload.results ?? []
          } catch (error) {
            lastError = error
            if (error instanceof Error && error.name === 'AbortError') {
              lastError = providerError(`Openverse search timed out after ${timeoutMs}ms`)
            }
            if (attempt < attempts) {
              deps.log.debug(`openverse: attempt ${attempt} failed, retrying`)
              await new Promise((r) => setTimeout(r, 500 * attempt))
            }
          } finally {
            clearTimeout(timer)
          }
        }
        throw lastError
    }
  },
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
