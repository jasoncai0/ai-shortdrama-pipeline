import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { PostPort } from '../../kernel/ports.js'

/**
 * No post production. Every call fails loudly rather than returning the input
 * unchanged: a pipeline configured with `music` and `subtitles` stages but no
 * post capability should say so, not hand back a silent, subtitle-free cut and
 * let it look finished.
 */
export default definePlugin<PostPort>({
  port: 'post',
  name: 'none',
  create: () => {
    const refuse = (what: string): never => {
      throw providerError(
        `Post production is disabled, so ${what} cannot run.`,
        'Set ports.post.impl to "ffmpeg", or drop the music/subtitles stages from the pipeline.',
      )
    }
    return {
      name: 'none',
      probeDuration: async () => refuse('measuring a clip'),
      mixMusic: async () => refuse('mixing a score'),
      buildSubtitles: async () => refuse('building subtitles'),
      burnSubtitles: async () => refuse('burning subtitles'),
    }
  },
})
