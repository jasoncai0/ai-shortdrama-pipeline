/**
 * Seedance compliance registration for user-supplied media.
 *
 * Seedance refuses to animate from an image or an audio track the account has
 * not filed through the platform's compliance register — the generation is
 * rejected outright with "请前往素材库完成合规资产录入". That register is a
 * separate system from the canvas asset library: an entry in the library does
 * NOT make an asset usable, and the two were easy to confuse because both are
 * called 素材.
 *
 * Two limits found by running it, both worth knowing before spending anything:
 *
 * - Audio must last between 1.8s and 30.2s. A one-word retort ("好!" at 0.8s)
 *   is rejected as DurationTooShort, so those shots simply cannot be lip-synced
 *   and fall back to post-mixed dubbing.
 * - Submissions are capped at 15 per minute. Exceeding it returns code 10026,
 *   which is a "wait", not a failure — the caller throttles and retries rather
 *   than dropping the asset.
 *
 * Pure HTTP; no pipeline types, so this stays testable and reusable.
 */

export const AUDIO_MIN_SECONDS = 1.8
export const AUDIO_MAX_SECONDS = 30.2

/** Submissions are capped at 15/min; this leaves a little headroom. */
export const SUBMIT_INTERVAL_MS = 4_500

/** Returned when the account is submitting too fast — retry, do not fail. */
const RATE_LIMITED = 10_026

export type ComplianceAssetType = 'image' | 'audio' | 'video'

export interface ComplianceCredentials {
  readonly token: string
  readonly webid: string
  readonly projectUuid: string
  readonly baseUrl?: string
}

export interface ComplianceEntry {
  readonly uuid: string
  readonly assetUrl: string
  readonly assetType: ComplianceAssetType
  /** 0 pending, 1 passed, 2 rejected. */
  readonly status: number
  readonly error?: { readonly Code?: string; readonly Message?: string }
}

const API = (creds: ComplianceCredentials): string =>
  creds.baseUrl ?? 'https://api.liblib.tv/api'

const headers = (creds: ComplianceCredentials): Record<string, string> => ({
  'content-type': 'application/json',
  accept: 'application/json, text/plain, */*',
  origin: 'https://www.liblib.tv',
  referer: `https://www.liblib.tv/canvas?projectId=${creds.projectUuid}`,
  token: creds.token,
  webid: creds.webid,
  'x-language': 'zh',
})

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Audio outside the window can never pass, so it is worth refusing locally
 * rather than spending a submission slot to be told the same thing.
 */
export const audioIsRegisterable = (seconds: number): boolean =>
  seconds >= AUDIO_MIN_SECONDS && seconds <= AUDIO_MAX_SECONDS

/** Registers one asset, waiting out the rate limit rather than failing on it. */
export const registerAsset = async (
  assetUrl: string,
  assetType: ComplianceAssetType,
  creds: ComplianceCredentials,
  opts: { readonly attempts?: number; readonly waitMs?: number; readonly fetchImpl?: typeof fetch } = {},
): Promise<{ readonly ok: true; readonly uuid?: string } | { readonly ok: false; readonly reason: string }> => {
  const attempts = opts.attempts ?? 6
  const waitMs = opts.waitMs ?? 20_000
  const doFetch = opts.fetchImpl ?? fetch

  for (let i = 0; i < attempts; i += 1) {
    const res = await doFetch(`${API(creds)}/third_asset/create`, {
      method: 'POST',
      headers: headers(creds),
      body: JSON.stringify({ assetUrl, assetType }),
    })
    const body = (await res.json()) as { code?: number; msg?: string; data?: { uuid?: string } }

    if (body.code === 0) return { ok: true, ...(body.data?.uuid ? { uuid: body.data.uuid } : {}) }
    if (body.code === RATE_LIMITED) {
      await sleep(waitMs)
      continue
    }
    return { ok: false, reason: body.msg ?? `code ${body.code}` }
  }
  return { ok: false, reason: `rate limited after ${attempts} attempts` }
}

/** Looks up what the register currently thinks of these assets. */
export const checkAssets = async (
  urls: readonly string[],
  creds: ComplianceCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly ComplianceEntry[]> => {
  const res = await fetchImpl(`${API(creds)}/third_asset/list`, {
    method: 'POST',
    headers: headers(creds),
    body: JSON.stringify({ page: 1, pageSize: 500 }),
  })
  const body = (await res.json()) as {
    data?: { list?: readonly { uuid: string; assetUrl: string; assetType: string; status: number; error_json?: unknown }[] }
  }
  const wanted = new Set(urls)
  return (body.data?.list ?? [])
    .filter((row) => wanted.size === 0 || wanted.has(row.assetUrl))
    .map((row) => ({
      uuid: row.uuid,
      assetUrl: row.assetUrl,
      assetType: row.assetType as ComplianceAssetType,
      status: row.status,
      ...(row.error_json ? { error: row.error_json as ComplianceEntry['error'] } : {}),
    }))
}
