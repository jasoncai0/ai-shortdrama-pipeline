import type { MusicLicence } from '../kernel/types.js'

/**
 * Licence policy for score selection.
 *
 * This is a correctness concern, not paperwork. Laying a track under a video
 * is a derivative work, and publishing that video is usually commercial — so a
 * `by-nc-nd` result from a music search is unusable no matter how well it fits
 * the scene. Search APIs return such tracks freely, so the filter has to live
 * in the pipeline.
 *
 * Unknown terms are refused rather than assumed permissive.
 */

/** Codes safe for a commercially-published derivative, credit permitting. */
export const DEFAULT_ALLOWED_LICENCES = ['cc0', 'pdm', 'by', 'user-provided', 'generated']

export const parseCreativeCommons = (
  code: string,
  version?: string,
): MusicLicence => {
  const normalised = code.trim().toLowerCase()
  const url =
    normalised === 'cc0'
      ? 'https://creativecommons.org/publicdomain/zero/1.0/'
      : normalised === 'pdm'
        ? 'https://creativecommons.org/publicdomain/mark/1.0/'
        : `https://creativecommons.org/licenses/${normalised}/${version ?? '4.0'}/`

  return {
    code: normalised,
    url,
    commercialUse: normalised.includes('nc') ? false : true,
    derivativesAllowed: normalised.includes('nd') ? false : true,
  }
}

export interface LicencePolicy {
  readonly allowed: readonly string[]
  /** Publishing a short drama is commercial use by default. */
  readonly requireCommercialUse: boolean
  /** Scoring a video is a derivative work by default. */
  readonly requireDerivatives: boolean
}

export const DEFAULT_POLICY: LicencePolicy = {
  allowed: DEFAULT_ALLOWED_LICENCES,
  requireCommercialUse: true,
  requireDerivatives: true,
}

export interface LicenceVerdict {
  readonly ok: boolean
  readonly reason?: string
}

export const checkLicence = (
  licence: MusicLicence,
  policy: LicencePolicy = DEFAULT_POLICY,
): LicenceVerdict => {
  const code = licence.code.toLowerCase()

  if (policy.requireCommercialUse && licence.commercialUse !== true) {
    return {
      ok: false,
      reason:
        licence.commercialUse === false
          ? `${code} forbids commercial use`
          : `${code} commercial terms unknown`,
    }
  }
  if (policy.requireDerivatives && licence.derivativesAllowed !== true) {
    return {
      ok: false,
      reason:
        licence.derivativesAllowed === false
          ? `${code} forbids derivative works, and scoring a video makes one`
          : `${code} derivative terms unknown`,
    }
  }
  if (!policy.allowed.includes(code)) {
    return { ok: false, reason: `${code} is not in the allowed licence list` }
  }
  return { ok: true }
}

/** True when the deliverable has to carry a credit line. */
export const needsAttribution = (licence: MusicLicence): boolean =>
  Boolean(licence.attribution) && !['cc0', 'pdm', 'generated'].includes(licence.code.toLowerCase())
