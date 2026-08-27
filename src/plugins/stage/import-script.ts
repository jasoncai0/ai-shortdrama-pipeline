import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { configError, stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { charactersInLine, parseScript, withAliases } from '../../lib/script-parser.js'
import { paceBeats } from '../../lib/pacing.js'
import { planShotLanguage } from '../../lib/shotlang.js'
import type { StagePort } from '../../kernel/ports.js'
import type {
  Character,
  Episode,
  InsertRole,
  Prop,
  Scene,
  Shot,
  WardrobeLook,
} from '../../kernel/types.js'
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
 *   shotSeconds          per-shot length when timing is fixed (default 5).
 *   timing               "fixed" (default) | "dialogue".
 *                        "dialogue" gives each shot the time its line needs to
 *                        be spoken, so a one-word retort is short and a speech
 *                        is long — a fixed 5s makes both wrong. Silent beats
 *                        get `shotSeconds`. Clamped to [minShotSeconds,
 *                        maxShotSeconds] because every video model clamps too,
 *                        and an un-clamped estimate just moves the surprise
 *                        downstream.
 *                        NOT targetSeconds/shotCount: with maxShotsPerEpisode
 *                        truncating the beat list, dividing an episode budget
 *                        across the survivors yields absurd 20s+ shots.
 *   charsPerSecond       speaking rate for "dialogue" timing, default 5
 *                        (unhurried Mandarin delivery; raise for faster reads)
 *   minShotSeconds       default 3
 *   maxShotSeconds       default 12
 *   includeNarration     include (OS) lines as shots of their own. Default
 *                        false — narration is exposition ("a soul from 1600
 *                        years later"), not a picture, and it carries no
 *                        character to anchor on.
 *   attachNarration      instead of discarding those lines, place each one via
 *                        the pacing pass: on a silent beat when one is near, or
 *                        on a breathing insert shot of its own. Default true.
 *                        In this genre the (OS) voice carries much of the
 *                        runtime, so dropping it loses a third of each episode.
 *                        Narration is NEVER stacked on a shot that already has
 *                        dialogue — that is what made the two talk over each
 *                        other in the mix.
 *   transitionInserts    add a short atmosphere shot when the location changes,
 *                        so a cut between a temple and a lakeside does not read
 *                        as a mistake. Default true.
 *   maxInsertRatio       ration on transition inserts, as a fraction of the
 *                        script's own beats. Default 0.4. Narration inserts are
 *                        never rationed: the line is in the script.
 *   narrationCharBudget  how much narration one shot may carry. Default 60.
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'import-script',
  create: (options, deps) => ({
    name: 'import-script',
    id: 'import-script',
    // The screenplay already is the plan, the cast and the shot list, so the
    // three LLM stages that would otherwise invent them are satisfied here.
    provides: ['plan', 'assets', 'shots'],
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
      const timing = options['timing'] === 'dialogue' ? 'dialogue' : 'fixed'
      const charsPerSecond = numberOption(options['charsPerSecond'], 5)
      const minShotSeconds = numberOption(options['minShotSeconds'], 3)
      const maxShotSeconds = numberOption(options['maxShotSeconds'], 12)
      const maxShots = numberOption(options['maxShotsPerEpisode'], 0)
      const includeNarration = options['includeNarration'] === true
      const attachNarration = options['attachNarration'] !== false
      let narrationInsertCount = 0
      let transitionInsertCount = 0
      let suppressedTransitions = 0

      // Only characters that actually appear in the selected episodes get a
      // reference image — otherwise a 1-episode run pays for 16 portraits.
      const appearing = collectAppearing(selected, script)
      const epithets = asRecord(options['epithets'])
      // Hand-authored wardrobe short-circuits the wardrobe stage's LLM
      // proposal, which is the only way to dress a cast without an LLM key.
      const wardrobeOverrides = wardrobeMap(options['wardrobe'])
      const billingOverrides = asRecord(options['billing'])
      const characters: readonly Character[] = script.characters
        .filter((c) => appearing.has(c.name))
        .map((c, index) => ({
          id: `ch${index + 1}`,
          name: c.name,
          appearance:
            characterVisuals[c.name] ??
            `${styleGuide}, ${c.role}, ${c.persona}`.replace(/\s+/g, ' '),
          personality: c.persona,
          // The cast table's 身份 column is already a one-line identity, which
          // is what an intro card wants. An override wins because 「男主」 is a
          // production label, not something to put on screen.
          epithet: asString(epithets[c.name]) ?? c.role,
          ...(wardrobeOverrides[c.name] ? { wardrobe: wardrobeOverrides[c.name] } : {}),
          ...(asString(billingOverrides[c.name])
            ? { billing: billingOverrides[c.name] as 'lead' | 'supporting' | 'extra' }
            : {}),
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
        const visual = parsedEpisode.scenes.flatMap((s) => {
          const entries: {
            line: (typeof s.lines)[number]
            sceneName: string
            timeOfDay: string
            narration?: string
          }[] = []
          // Narration waits for the next picture it can sit over. Anything
          // still waiting at the end of a scene attaches to the last shot
          // rather than being lost.
          let held: string[] = []

          for (const line of s.lines) {
            if (line.kind === 'subtitle') {
              skippedSubtitles += 1
              continue
            }
            if (line.kind === 'os' && !includeNarration) {
              skippedNarration += 1
              if (attachNarration && line.text.length > 0) held.push(line.text)
              continue
            }
            if (line.text.length === 0) continue

            entries.push({
              line,
              sceneName: s.name,
              timeOfDay: s.timeOfDay,
              ...(held.length > 0 ? { narration: held.join(' ') } : {}),
            })
            held = []
          }

          const last = entries.at(-1)
          if (held.length > 0 && last) {
            entries[entries.length - 1] = {
              ...last,
              narration: [last.narration, held.join(' ')].filter(Boolean).join(' '),
            }
          }
          return entries
        })

        // Pacing decides where narration sits and where a scene change needs
        // a breath. It can add insert shots, so it runs before the cap.
        const paced = attachNarration
          ? paceBeats(
              visual.map((e) => ({
                dialogue: e.line.kind === 'dialogue' ? e.line.text : undefined,
                narration: e.narration,
                sceneName: e.sceneName,
                timeOfDay: e.timeOfDay,
              })),
              {
                narrationCharBudget: numberOption(options['narrationCharBudget'], 60),
                transitionInserts: options['transitionInserts'] !== false,
                maxInsertRatio: numberOption(options['maxInsertRatio'], 0.4),
              },
            )
          : undefined

        type Entry = {
          line: ParsedLine
          sceneName: string
          timeOfDay: string
          narration?: string
          insert?: InsertRole
        }

        const spread: readonly Entry[] = paced
          ? paced.shots.map((shot): Entry => {
              // A beat keeps its original parsed line; an insert has none.
              const source = shot.sourceIndex === undefined ? undefined : visual[shot.sourceIndex]
              return shot.kind === 'insert'
                ? {
                    line: { kind: 'action' as const, text: shot.insertDescription ?? '' } as ParsedLine,
                    sceneName: shot.sceneName,
                    timeOfDay: shot.timeOfDay,
                    narration: shot.narration,
                    insert: shot.insertRole,
                  }
                : {
                    ...(source ?? {
                      line: { kind: 'action' as const, text: '' } as ParsedLine,
                      sceneName: shot.sceneName,
                      timeOfDay: shot.timeOfDay,
                    }),
                    narration: shot.narration,
                  }
            })
          : visual

        if (paced) {
          narrationInsertCount += paced.narrationInserts
          transitionInsertCount += paced.transitionInserts
          suppressedTransitions += paced.suppressed
        }

        const capped = maxShots > 0 ? spread.slice(0, maxShots) : spread
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
            durationSeconds:
              timing === 'dialogue'
                ? spokenSeconds(
                    [entry.line.kind === 'dialogue' ? entry.line.text : '', entry.narration ?? '']
                      .filter(Boolean)
                      .join(' ') || undefined,
                    {
                      charsPerSecond,
                      fallback: shotSeconds,
                      min: minShotSeconds,
                      max: maxShotSeconds,
                    },
                  )
                : shotSeconds,
            plotDescription: plotOf(entry.line),
            // An insert is an empty frame by definition: a wide, near-static
            // look. A transition eases down off the sky; a narration breath
            // holds still so the voice carries it.
            shotSize: entry.insert ? '全景' : shotSizeOf(entry.line),
            cameraMove: entry.insert
              ? entry.insert === 'transition'
                ? 'tilt-down'
                : 'static'
              : cameraMoveOf(entry.line),
            characterAction: entry.line.action,
            emotion: undefined,
            lightingAndAtmosphere: lightingOf(entry.timeOfDay),
            dialogue: entry.line.kind === 'dialogue' ? entry.line.text : undefined,
            narration: entry.narration,
            ...(entry.insert
              ? { kind: 'insert' as const, insertRole: entry.insert }
              : { kind: 'beat' as const }),
            // No cast in an insert: putting a character there would invent a
            // beat the script never wrote, and risk contradicting one.
            characterIds: entry.insert
              ? []
              : names
                  .map((n) => characterIdByName.get(n))
                  .filter((id): id is string => Boolean(id)),
            sceneId: sceneIdByName.get(entry.sceneName),
            propIds: [],
            status: 'draft',
          })
        })

        deps.log.info(
          `import-script: episode ${parsedEpisode.index} 《${parsedEpisode.title}》 → ${capped.length} shots, ${timing} timing (of ${visual.length} beats)`,
        )
      }

      if (skippedSubtitles > 0) {
        deps.log.info(
          `import-script: skipped ${skippedSubtitles} 字幕 line(s) — they are text overlays, not shots`,
        )
      }
      if (skippedNarration > 0) {
        deps.log.info(
          attachNarration
            ? `import-script: ${skippedNarration} (OS) line(s) attached to shots as narration for the dub stage`
            : `import-script: skipped ${skippedNarration} (OS) narration line(s) — set attachNarration or includeNarration to keep them`,
        )
      }

      deps.log.info(
        `import-script: pacing — ${narrationInsertCount} 旁白留白镜, ${transitionInsertCount} 转场空镜` +
          (suppressedTransitions > 0 ? `, ${suppressedTransitions} 处场景切换未加转场(受 maxInsertRatio 限制)` : ''),
      )
      // Coverage pass: sizes, moves, and two-person dialogue framing. Runs
      // before the on-camera filter so a listener added to a shot counts as
      // appearing and gets a design image.
      const planned = planShotLanguage(shots)
      shots.length = 0
      shots.push(...planned)

      // A name can be mentioned in dialogue without ever being on camera, and
      // the cast table lists the whole season. Anyone with no shot of their own
      // would still be paid for twice downstream — @base and @sheet — so they
      // are dropped here rather than in each image stage.
      const onCamera = new Set(shots.flatMap((shot) => shot.characterIds ?? []))
      const cast = characters.filter((c) => onCamera.has(c.id))
      const offCamera = characters.filter((c) => !onCamera.has(c.id))
      if (offCamera.length > 0) {
        deps.log.info(
          `import-script: ${offCamera.map((c) => c.name).join('、')} 只被提及、无独立镜头 — 不出设定图`,
        )
      }

      deps.log.info(
        `import-script: 《${script.title}》 — ${episodes.length} episodes, ${cast.length} characters, ${scenes.length} scenes, ${shots.length} shots`,
      )
      ctx.emit('import-script', { shots: shots.length, characters: cast.length })

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
          characters: cast,
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

/**
 * `{ "陈瑜之": [{ label, description, occasion? }] }` from config.
 *
 * Descriptions are garments only — the wardrobe stage sanitises identity words
 * out of them, so anything about the face here is dropped rather than obeyed.
 */
const wardrobeMap = (value: unknown): Record<string, readonly WardrobeLook[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([name, raw]) => {
      if (!Array.isArray(raw)) return []
      const looks = raw.flatMap((item, index): readonly WardrobeLook[] => {
        if (!item || typeof item !== 'object') return []
        const row = item as Record<string, unknown>
        const label = asString(row['label'])
        const description = asString(row['description'])
        if (!label || !description) return []
        const occasion = asString(row['occasion'])
        return [{ id: `w${index + 1}`, label, description, ...(occasion ? { occasion } : {}) }]
      })
      return looks.length > 0 ? [[name, looks] as const] : []
    }),
  )
}

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

/**
 * How long a line takes to say, in whole seconds.
 *
 * Counts CJK characters and Latin words, since 5 hanzi and 5 English words are
 * nothing like the same duration. Punctuation is dropped but each sentence
 * break earns a beat of breathing room — read a long line without pauses and
 * it always runs over.
 */
export const spokenSeconds = (
  dialogue: string | undefined,
  opts: {
    readonly charsPerSecond: number
    readonly fallback: number
    readonly min: number
    readonly max: number
  },
): number => {
  const text = (dialogue ?? '').trim()
  if (text.length === 0) return clampSeconds(opts.fallback, opts.min, opts.max)

  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length
  const latinWords = (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  const digits = (text.match(/\d+/g) ?? []).length
  // A Latin word is roughly two hanzi worth of airtime; a number reads as one.
  const units = cjk + latinWords * 2 + digits

  const pauses = (text.match(/[，,。.！!？?；;：:…—]/g) ?? []).length
  const seconds = units / Math.max(1, opts.charsPerSecond) + pauses * 0.25

  return clampSeconds(Math.ceil(seconds), opts.min, opts.max)
}

const clampSeconds = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(n)))

/**
 * Moves narration that cannot be spoken inside one shot onto the shots that
 * follow it.
 *
 * Without this, a long (OS) block lands whole on the next picture, the shot is
 * clamped to `maxSeconds`, and the tail of the line is simply cut off in the
 * mix — losing script that the audience needed. Spreading it forward keeps
 * every word and keeps every shot inside the length a video model will accept.
 *
 * Splits on sentence punctuation, never mid-sentence: half a clause spoken over
 * one shot and finished over the next reads as a mistake, where a complete
 * sentence per picture reads as narration.
 */
export const spreadNarration = <T extends { narration?: string; dialogue?: string }>(
  entries: readonly T[],
  opts: { readonly maxSeconds: number; readonly charsPerSecond: number },
): readonly T[] => {
  const capacity = Math.max(1, Math.floor(opts.maxSeconds * opts.charsPerSecond))
  const out = entries.map((e) => ({ ...e }))
  let carried: string[] = []

  for (let i = 0; i < out.length; i += 1) {
    const entry = out[i]
    if (!entry) continue

    const sentences = [...carried, ...splitSentences(entry.narration ?? '')]
    carried = []
    if (sentences.length === 0) {
      delete entry.narration
      continue
    }

    // Dialogue is spoken by someone on screen and cannot be moved, so it eats
    // into what narration this shot can carry.
    const budget = Math.max(0, capacity - (entry.dialogue?.trim().length ?? 0))

    // A single sentence longer than any shot can hold has to break somewhere;
    // clause boundaries are the least bad place, and far better than the mix
    // silently cutting the tail off.
    const units = sentences.flatMap((sentence) =>
      sentence.length > budget ? splitClauses(sentence, budget) : [sentence],
    )

    const kept: string[] = []
    let used = 0
    for (const [index, unit] of units.entries()) {
      // Always keep the first unit, even an over-long one: pushing it forever
      // would drop it at the end of the episode.
      if (kept.length > 0 && used + unit.length > budget) {
        // Everything from here on carries, not just this unit. Skipping ahead
        // to a shorter later sentence would reorder the narration, and for
        // spoken prose order IS the meaning — a scrambled read is worse than
        // a long one.
        carried.push(...units.slice(index))
        break
      }
      kept.push(unit)
      used += unit.length
    }

    if (kept.length > 0) entry.narration = kept.join('')
    else delete entry.narration
  }

  // Whatever is still in hand belongs to the last shot; truncating instead
  // would silently lose the episode's closing voice-over.
  const last = out.at(-1)
  if (carried.length > 0 && last) {
    last.narration = [last.narration, carried.join('')].filter(Boolean).join('')
  }
  return out
}

/** Keeps the terminator with its sentence so the read still sounds right. */
const splitSentences = (text: string): readonly string[] => {
  const trimmed = text.trim()
  if (trimmed.length === 0) return []
  return trimmed.match(/[^。！？!?…]*[。！？!?…]+|[^。！？!?…]+/g) ?? [trimmed]
}

/**
 * Last-resort break for a sentence no shot can hold. Prefers clause
 * punctuation; falls back to a hard character split only when a clause is
 * itself too long, which in practice means unpunctuated prose.
 */
const splitClauses = (sentence: string, budget: number): readonly string[] => {
  const clauses = sentence.match(/[^，,、；;：:]*[，,、；;：:]+|[^，,、；;：:]+/g) ?? [sentence]
  const out: string[] = []
  let current = ''

  for (const clause of clauses) {
    if (current.length > 0 && current.length + clause.length > budget) {
      out.push(current)
      current = ''
    }
    if (clause.length > budget) {
      if (current.length > 0) {
        out.push(current)
        current = ''
      }
      for (let i = 0; i < clause.length; i += budget) out.push(clause.slice(i, i + budget))
      continue
    }
    current += clause
  }
  if (current.length > 0) out.push(current)
  return out
}
