import { definePlugin } from '../../kernel/registry.js'
import { pngPlaceholder } from '../../lib/placeholder.js'
import type { TextCardPort } from '../../kernel/ports.js'

/**
 * Offline card renderer. Emits a real PNG of the right dimensions so the
 * compositing path is exercised for free, but it draws no glyphs — this stub
 * cannot rasterise a font, and pretending otherwise would make a text bug
 * invisible in CI.
 *
 * The card's text is recorded in the asset metadata instead, so a test can
 * still assert which card was placed where.
 */
export default definePlugin<TextCardPort>({
  port: 'textCard',
  name: 'stub',
  create: (_options, deps) => ({
    name: 'stub',
    caps: { vertical: false },

    render: async (spec, store, projectId, label) => {
      deps.log.debug(`textcard/stub: ${label} "${spec.title}" (no glyphs drawn)`)
      const bytes = pngPlaceholder(`${spec.title}|${spec.subtitle ?? ''}`, 64)
      return store.put(bytes, {
        kind: 'other',
        mime: 'image/png',
        projectId,
        label: `intro-${label}`,
        extra: { title: spec.title, subtitle: spec.subtitle, side: spec.side, glyphs: false },
      })
    },
  }),
})
