/** Scaffold written by `duanju init`. Kept in code so it always type-checks. */
export const DEFAULT_CONFIG = {
  ports: {
    llm: {
      impl: 'deepseek',
      options: { model: 'deepseek-chat', apiKeyEnv: 'DEEPSEEK_API_KEY' },
    },
    image: {
      impl: 'libtv',
      options: {
        model: 'General image Pro',
        canvas: '${LIBTV_PROJECT_UUID}',
      },
    },
    video: {
      impl: 'libtv',
      options: {
        model: 'Seedance 2.0 Mini',
        canvas: '${LIBTV_PROJECT_UUID}',
        resolution: '720p',
        minSeconds: 4,
        maxSeconds: 15,
      },
    },
    assetStore: { impl: 'localfs', options: { root: './.duanju/assets' } },
    state: { impl: 'localjson', options: { root: './.duanju/state' } },
    // Providers meter their own credits; a second set of books would only
    // ever disagree. Swap to 'localledger' for a spend ceiling + dedupe.
    ledger: { impl: 'noop', options: {} },
    export: { impl: 'ffmpeg', options: {} },
    // Cost ladder: your own library first, then openly-licensed search, and
    // generation only if neither turned anything up.
    music: {
      impl: 'multi',
      options: {
        enough: 3,
        sources: [
          { impl: 'local', options: { dir: './music' } },
          { impl: 'openverse', options: {} },
          { impl: 'libtv', options: { canvas: '${LIBTV_PROJECT_UUID}' } },
        ],
      },
    },
    post: { impl: 'ffmpeg', options: {} },
    promptStrategy: {
      impl: 'skill-anchored',
      options: { dir: './prompts', profileDir: './prompts/profiles', profile: 'photoreal-drama' },
    },
  },
  middleware: [
    { impl: 'retry', options: { attempts: 3, baseDelayMs: 3000 } },
    { impl: 'camera-grammar', options: { appendClauses: ['oneDominantMove'] } },
    { impl: 'prompt-tune', options: { video: { suffix: 'steady camera, cinematic lighting' } } },
    { impl: 'tuning-log', options: { file: './.duanju/tuning.ndjson' } },
  ],
  pipeline: [
    'plan',
    { id: 'gate-story', use: 'gate', options: { label: 'story', prompt: '确认故事方向？' } },
    'assets',
    'refs',
    { id: 'gate-assets', use: 'gate', options: { label: 'assets', prompt: '确认资产清单？' } },
    'shots',
    'camera-check',
    'prompts',
    'images',
    'videos',
    'export',
    'music',
    // Subtitles are burned in and irreversible, so the picture gets signed off
    // first. The subtitles stage refuses to run until this gate is done.
    { id: 'gate-cut', use: 'gate', options: { label: 'cut', prompt: '这一版画面确认了吗？' } },
    'subtitles',
  ],
  concurrency: { images: 3, videos: 2, refs: 3 },
  budget: { maxCredits: 0, failFast: false },
  defaults: { ratio: '9:16', kind: 'shortdrama', shotSeconds: 5, shotsPerEpisode: 8 },
} as const
