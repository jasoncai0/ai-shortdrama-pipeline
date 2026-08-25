import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { configError, stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { charactersInLine, parseScript, withAliases } from '../../lib/script-parser.js'
import type { StagePort } from '../../kernel/ports.js'
import type { Character, Episode, Prop, Scene, Shot } from '../../kernel/types.js'
import type { ParsedEpisode, ParsedLine, ParsedScript } from '../../lib/script-parser.js'

/**
 * Imports a finished screenplay instead of generating one.
 *
 * Replaces `plan` + `assets` + `shots` — and needs no LLM at all, because a
 * screenplay already IS the structure: episodes, characters, scenes, shot-level
 * beats and dialogue. Deriving it again from a one-line idea would only lose
 * fidelity.
 *
 * What a screenplay does NOT contain is visual design. Character appearance,
 * scene look and the style guide must be supplied through options — that is a
 * production decision, not something to hallucinate.
 *
 * Options:
 *   file                 path to the markdown screenplay (required)
 *   episodes             which episode numbers to import (default: all)
 *   styleGuide           visual style prepended to every image prompt
 *   characterVisuals     { "陈瑜之": "…visual description…" }
 *   sceneVisuals         { "云隐寺大殿": "…visual description…" }
 *   characterAliases     { "陈瑜之": ["丑儿", "丑叔", "小郎"] }
 *   props                [{ name, description }]
 *   maxShotsPerEpisode   hard cap, useful for a cheap first pass
 *   shotSeconds          per-shot length (default 5). Deliberately NOT
 *                        targetSeconds/shotCount: once maxShotsPerEpisode
 *                        truncates the beat list, dividing the episode budget
 *                        across the survivors yields absurd 20s+ shots that
 *                        every video model then clamps anyway.
 *   includeNarration     include (OS) lines as shots. Default false — narration
 *                        is exposition ("a soul from 1600 years later"), not a
 *                        picture, and it carries no character to anchor on.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'import-script',
  create: (options, deps) => ({
    name: 'import-script',
    id: 'import-script',
    needs: [],

    run: async (ctx) => {
      const rawFile = asString(options['file'])
      if (!rawFile) {
        throw configError(
          'import-script requires options.file (path to the screenplay markdown).',
          'Add it under the stage entry in duanju.config.json.',
        )
      }
      const file = isAbsolute(rawFile) ? rawFile : resolve(deps.cwd, rawFile)

      let markdown: string
      try {
        markdown = await readFile(file, 'utf8')
      } catch (error) {
        throw configError(`Cannot read screenplay at ${file}: ${String(error)}`)
      }

      const parsed = parseScript(markdown)

      // A 人物表 lists the season's principals, so a character who only speaks
      // in one scene is often absent from it — and would silently lose its
      // consistency anchor. `extraCharacters` declares those without touching
      // the screenplay, which stays read-only.
      const declared = asRecord(options['extraCharacters'])
      const extra = Object.entries(declared)
        .filter(([name]) => !parsed.characters.some((c) => c.name === name))
        .map(([name, persona]) => ({
          name,
          role: '',
          persona: typeof persona === 'string' ? persona : '',
          aliases: [] as readonly string[],
        }))

      const script = {
        ...parsed,
        characters: withAliases(
          [...parsed.characters, ...extra],
          aliasMap(options['characterAliases']),
        ),
      }
      if (script.episodes.length === 0) {
        throw stateError(
          `No episodes parsed from ${file}.`,
          'Expected headings like "# 第1集 标题(约90秒)" and scene markers like "【场1·地点·日】".',
        )
      }

      const wanted = numberArray(options['episodes'])
      const selected =
        wanted.length > 0
          ? script.episodes.filter((e) => wanted.includes(e.index))
          : script.episodes

      if (selected.length === 0) {
        throw stateError(
          `None of the requested episodes [${wanted.join(', ')}] exist in ${file}.`,
          `Available: ${script.episodes.map((e) => e.index).join(', ')}`,
        )
      }

      const styleGuide =
        asString(options['styleGuide']) ??
        '古装历史剧, 东晋风格, 电影级画质, 柔和自然光, 浅景深, 胶片颗粒感'
      const characterVisuals = asRecord(options['characterVisuals'])
      const sceneVisuals = asRecord(options['sceneVisuals'])
      const shotSeconds = numberOption(options['shotSeconds'], 5)
      const maxShots = numberOption(options['maxShotsPerEpisode'], 0)
      const includeNarration = options['includeNarration'] === true

      // Only characters that actually appear in the selected episodes get a
      // reference image — otherwise a 1-episode run pays for 16 portraits.
      const appearing = collectAppearing(selected, script)
      const characters: readonly Character[] = script.characters
        .filter((c) => appearing.has(c.name))
        .map((c, index) => ({
          id: `ch${index + 1}`,
          name: c.name,
          appearance:
            characterVisuals[c.name] ??
            `${styleGuide}, ${c.role}, ${c.persona}`.replace(/\s+/g, ' '),
          personality: c.persona,
        }))

      const sceneNames = [
        ...new Set(selected.flatMap((e) => e.scenes.map((s) => s.name))),
      ]
      const scenes: readonly Scene[] = sceneNames.map((name, index) => ({
        id: `sc${index + 1}`,
        name,
        visualDescription: sceneVisuals[name] ?? `${name}, ${styleGuide}`,
      }))

      const props: readonly Prop[] = propList(options['props'])

      const characterIdByName = new Map(characters.map((c) => [c.name, c.id]))
      const sceneIdByName = new Map(scenes.map((s) => [s.name, s.id]))

      const episodes: readonly Episode[] = selected.map((e) => ({
        id: `ep${e.index}`,
        index: e.index,
        title: e.title,
        synopsis: e.synopsis || e.hook,
      }))

      const shots: Shot[] = []
      let skippedSubtitles = 0
      let skippedNarration = 0

      for (const parsedEpisode of selected) {
        const visual = parsedEpisode.scenes.flatMap((s) =>
          s.lines
            .filter((line) => {
              if (line.kind === 'subtitle') {
                skippedSubtitles += 1
                return false
              }
              if (line.kind === 'os' && !includeNarration) {
                skippedNarration += 1
                return false
              }
              return line.text.length > 0
            })
            .map((line) => ({ line, sceneName: s.name, timeOfDay: s.timeOfDay })),
        )

        const capped = maxShots > 0 ? visual.slice(0, maxShots) : visual
        if (capped.length === 0) {
          deps.log.warn(`import-script: episode ${parsedEpisode.index} has no visual lines`)
          continue
        }

        capped.forEach((entry, i) => {
          const names = charactersInLine(entry.line, script.characters)
          shots.push({
            id: `ep${parsedEpisode.index}-s${String(i + 1).padStart(2, '0')}`,
            episodeId: `ep${parsedEpisode.index}`,
            order: i + 1,
            durationSeconds: shotSeconds,
            plotDescription: plotOf(entry.line),
            shotSize: shotSizeOf(entry.line),
            cameraMove: cameraMoveOf(entry.line),
            characterAction: entry.line.action,
            emotion: undefined,
            lightingAndAtmosphere: lightingOf(entry.timeOfDay),
            dialogue: entry.line.kind === 'dialogue' ? entry.line.text : undefined,
            characterIds: names
              .map((n) => characterIdByName.get(n))
              .filter((id): id is string => Boolean(id)),
            sceneId: sceneIdByName.get(entry.sceneName),
            propIds: [],
            status: 'draft',
          })
        })

        deps.log.info(
          `import-script: episode ${parsedEpisode.index} 《${parsedEpisode.title}》 → ${capped.length} shots @ ${shotSeconds}s (of ${visual.length} beats)`,
        )
      }

      if (skippedSubtitles > 0) {
        deps.log.info(
          `import-script: skipped ${skippedSubtitles} 字幕 line(s) — they are text overlays, not shots`,
        )
      }
      if (skippedNarration > 0) {
        deps.log.info(
          `import-script: skipped ${skippedNarration} (OS) narration line(s) — set includeNarration:true to keep them`,
        )
      }

      deps.log.info(
        `import-script: 《${script.title}》 — ${episodes.length} episodes, ${characters.length} characters, ${scenes.length} scenes, ${shots.length} shots`,
      )
      ctx.emit('import-script', { shots: shots.length, characters: characters.length })

      return {
        kind: 'ok',
        project: {
          ...ctx.project,
          title: script.title || ctx.project.title,
          plan: {
            title: script.title,
            genre: script.genre,
            logline: script.logline,
            mainPlot: selected.map((e) => `第${e.index}集：${e.synopsis}`).join('；'),
            sellingPoints: [script.logline].filter(Boolean),
            conflicts: selected.map((e) => e.hook).filter(Boolean),
            styleGuide,
          },
          episodes,
          characters,
          scenes,
          props,
          shots,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

/** Character names referenced anywhere in the selected episodes. */
const collectAppearing = (
  selected: readonly ParsedEpisode[],
  script: ParsedScript,
): ReadonlySet<string> => {
  const names = new Set<string>()
  for (const episode of selected) {
    for (const scene of episode.scenes) {
      for (const line of scene.lines) {
        for (const name of charactersInLine(line, script.characters)) names.add(name)
      }
    }
  }
  return names
}

/**
 * Dialogue lines carry spoken words, not a picture. The visual is the speaker
 * plus their stage direction — the words go in `dialogue` for later subtitling.
 */
const plotOf = (line: ParsedLine): string => {
  // The stage direction is emitted separately as characterAction; repeating it
  // here duplicated it inside every compiled prompt.
  if (line.kind === 'dialogue') return `${line.speaker ?? '人物'}说话`
  return line.text
}

const shotSizeOf = (line: ParsedLine): string => {
  if (line.camera === '特写') return '特写'
  if (line.kind === 'dialogue') return '中景'
  return '全景'
}

const cameraMoveOf = (line: ParsedLine): string | undefined => {
  if (line.camera === '闪回' || line.camera === '回忆') return '静止, 柔光过渡'
  if (line.kind === 'dialogue') return '静止'
  return '缓慢推进'
}

const lightingOf = (timeOfDay: string): string => {
  if (timeOfDay.includes('夜') || timeOfDay.includes('深夜')) return '夜晚, 暖色灯笼光, 低调照明'
  if (timeOfDay.includes('黄昏')) return '黄昏, 逆光, 暖金色调'
  if (timeOfDay.includes('拂晓') || timeOfDay.includes('晨')) return '清晨, 冷调晨光, 薄雾'
  if (timeOfDay.includes('午后')) return '午后, 侧向柔光'
  return '白天, 自然柔光'
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const asRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

const aliasMap = (value: unknown): Record<string, readonly string[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([name, raw]) =>
      Array.isArray(raw)
        ? [[name, raw.filter((v): v is string => typeof v === 'string')] as const]
        : [],
    ),
  )
}

const numberArray = (value: unknown): readonly number[] =>
  Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : []

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const propList = (value: unknown): readonly Prop[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const name = asString(item['name'])
    const description = asString(item['description'])
    return name && description ? [{ id: `pr${index + 1}`, name, description }] : []
  })
}
