import type { BuiltinTable } from '../kernel/registry.js'

/**
 * Composition root's plugin table. The kernel receives this as data; it never
 * imports an adapter itself. Adding a plugin = adding one line here (or using
 * `npm:`/`file:` in the config for out-of-tree ones).
 */
export const builtins: BuiltinTable = {
  'llm/deepseek': () => import('./llm/deepseek.js'),
  'llm/openai-compat': () => import('./llm/openai-compat.js'),
  'llm/skill-inline': () => import('./llm/skill-inline.js'),
  'llm/stub': () => import('./llm/stub.js'),

  'image/libtv': () => import('./image/libtv.js'),
  'image/stub': () => import('./image/stub.js'),

  'video/libtv': () => import('./video/libtv.js'),
  'video/stub': () => import('./video/stub.js'),

  'assetStore/localfs': () => import('./assetstore/localfs.js'),

  'state/localjson': () => import('./state/localjson.js'),

  'ledger/noop': () => import('./ledger/noop.js'),
  'ledger/localledger': () => import('./ledger/localledger.js'),

  'export/ffmpeg': () => import('./export/ffmpeg.js'),

  'speech/libtv': () => import('./speech/libtv.js'),
  'speech/stub': () => import('./speech/stub.js'),

  'music/local': () => import('./music/local.js'),
  'music/openverse': () => import('./music/openverse.js'),
  'music/libtv': () => import('./music/libtv.js'),
  'music/multi': () => import('./music/multi.js'),
  'music/stub': () => import('./music/stub.js'),

  'post/ffmpeg': () => import('./post/ffmpeg.js'),
  'post/none': () => import('./post/none.js'),

  'promptStrategy/template': () => import('./promptStrategy/template.js'),
  'promptStrategy/skill-anchored': () => import('./promptStrategy/skill-anchored.js'),

  'middleware/prompt-tune': () => import('./middleware/prompt-tune.js'),
  'middleware/tuning-log': () => import('./middleware/tuning-log.js'),
  'middleware/retry': () => import('./middleware/retry.js'),
  'middleware/camera-grammar': () => import('./middleware/camera-grammar.js'),

  'stage/import-script': () => import('./stage/import-script.js'),
  'stage/import': () => import('./stage/import.js'),
  'stage/plan': () => import('./stage/plan.js'),
  'stage/assets': () => import('./stage/assets.js'),
  'stage/refs': () => import('./stage/refs.js'),
  'stage/sheets': () => import('./stage/sheets.js'),
  'stage/cover': () => import('./stage/cover.js'),
  'stage/shots': () => import('./stage/shots.js'),
  'stage/camera-check': () => import('./stage/camera-check.js'),
  'stage/prompts': () => import('./stage/prompts.js'),
  'stage/images': () => import('./stage/images.js'),
  'stage/videos': () => import('./stage/videos.js'),
  'stage/dub': () => import('./stage/dub.js'),
  'stage/gate': () => import('./stage/gate.js'),
  'stage/export': () => import('./stage/export.js'),
  'stage/music': () => import('./stage/music.js'),
  'stage/subtitles': () => import('./stage/subtitles.js'),
}
