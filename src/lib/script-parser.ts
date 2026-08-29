/**
 * Parser for the Chinese short-drama screenplay format:
 *
 *   # 第1集 佛前一盏灯(约90秒)
 *   【场1·云隐寺大殿·日】
 *   字幕:承平二年 · 东靖朝
 *   (OS):三个月前……
 *   陈母李氏:"丑儿,过来,跪下。"
 *   陈瑜之(盯着灯焰,OS):三个月……
 *   (特写)灯焰暴涨,一缕光芒射入少年眉心。
 *   【本集钩子】
 *
 * Pure functions only — no I/O — so the whole thing is unit-testable and the
 * importer stage stays a thin wrapper.
 *
 * Why this exists: a finished screenplay is already the structure the pipeline
 * needs (episodes, characters, scenes, shots, dialogue). Asking an LLM to
 * re-derive it would only lose fidelity.
 */

export interface ParsedCharacter {
  readonly name: string
  /** 身份 column. */
  readonly role: string
  /** 一句话人设 column. */
  readonly persona: string
  /** 小名 / 字 / 小字, plus honorifics the dialogue actually uses. */
  readonly aliases: readonly string[]
}

export type LineKind = 'subtitle' | 'os' | 'dialogue' | 'action'

export interface ParsedLine {
  readonly kind: LineKind
  readonly text: string
  readonly speaker?: string
  /** Parenthetical stage direction attached to a speaker. */
  readonly action?: string
  /** (特写) / (闪回) / (特写、闪回) camera hints. */
  readonly camera?: string
}

export interface ParsedScene {
  readonly index: number
  readonly name: string
  readonly timeOfDay: string
  readonly lines: readonly ParsedLine[]
}

export interface ParsedEpisode {
  readonly index: number
  readonly title: string
  readonly targetSeconds: number
  readonly synopsis: string
  readonly hook: string
  readonly scenes: readonly ParsedScene[]
}

export interface ParsedScript {
  readonly title: string
  readonly genre: string
  readonly logline: string
  readonly characters: readonly ParsedCharacter[]
  readonly episodes: readonly ParsedEpisode[]
}

// Both ASCII and full-width punctuation appear in these scripts. Regexes are
// written out literally — interpolating a character class into a NEGATED class
// (`[^${OPEN_PAREN}]`) silently produces the wrong matcher.
// Season-2 headings annotate a word count after the seconds — 「(约122秒·550字)」
// — so anything between 秒 and the closing bracket is tolerated.
const EPISODE_RE = /^#+\s*第\s*(\d+)\s*集\s*([^(（]*?)\s*(?:[(（]\s*约?\s*(\d+)\s*秒[^)）]*[)）])?\s*$/
const SCENE_RE = /^【场\s*(\d+)\s*[·・]\s*(.+?)\s*[·・]\s*([^】]+)】\s*$/
const HOOK_RE = /^【本集钩子[^】]*】\s*$/
const SUBTITLE_RE = /^字幕(?:[(（][^)）]*[)）])?[:：]\s*(.+)$/
// (OS) and its season-2 qualified forms — (OS·信息压缩), (OS·时间跳跃).
const OS_RE = /^[(（]\s*OS[^)）]*[)）]\s*[:：]\s*(.*)$/
const CAMERA_LEAD_RE = /^[(（](特写|闪回|回忆|插入)[)）]\s*(.*)$/
const SHOT_MARKER_RE = /^[[［]镜头([^\]］]*)[\]］]\s*(.*)$/
const DIALOGUE_RE = /^([^:：(（【]{1,14})(?:[(（]([^)）]*)[)）])?\s*[:：]\s*(.*)$/
const PAREN_INNER_RE = /[(（]([^)）]*)[)）]/
const STRIP_TRAILING_PAREN_RE = /[(（][^)）]*[)）]\s*$/

const TABLE_ROW_RE = /^\|(.+)\|\s*$/

/** `|---|---|---|` — the row markdown puts under a table's header. */
const isSeparatorRow = (line: string): boolean => {
  const match = TABLE_ROW_RE.exec(line)
  if (!match?.[1]) return false
  return match[1]
    .split('|')
    .map((c) => c.trim())
    .every((c) => /^:?-{2,}:?$/.test(c))
}

/** `| a | b | c |` → `['a','b','c']`, or null for separator rows. */
const tableCells = (line: string): readonly string[] | null => {
  const match = TABLE_ROW_RE.exec(line)
  if (!match?.[1]) return null
  const cells = match[1].split('|').map((c) => c.trim())
  if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return null
  return cells
}

const stripQuotes = (text: string): string =>
  text.replace(/^["“「『]/, '').replace(/["”」』]$/, '').trim()

const metaValue = (line: string, label: string): string | undefined => {
  const re = new RegExp(`^-\\s*\\*\\*${label}\\*\\*\\s*[:：]\\s*(.+)$`)
  const match = re.exec(line)
  return match?.[1]?.trim()
}

/**
 * A 人物表 row may hold two characters: `| 陈宗之 / 陈润儿 | 8 岁 / 6 岁 | ... |`.
 * Splitting keeps each one addressable by name from dialogue lines.
 */
const splitPairedRow = (cells: readonly string[]): readonly ParsedCharacter[] => {
  const [rawName = '', rawRole = '', rawPersona = ''] = cells
  const names = rawName.split(/\s*\/\s*/).filter(Boolean)
  const roles = rawRole.split(/\s*\/\s*/)

  return names.map((nameCell, i) => {
    const aliases = extractAliases(nameCell)
    return {
      name: bareName(nameCell),
      role: (roles.length === names.length ? roles[i] : rawRole)?.trim() ?? '',
      persona: rawPersona,
      aliases,
    }
  })
}

const bareName = (cell: string): string => cell.replace(STRIP_TRAILING_PAREN_RE, '').trim()

/** Pulls 小名"五丑" / 字子敬 / 小字野云 out of a 人物表 name cell. */
const extractAliases = (cell: string): readonly string[] => {
  const inside = PAREN_INNER_RE.exec(cell)?.[1]
  if (!inside) return []
  const aliases: string[] = []
  for (const re of [/小名\s*["“]?([^"”,，]+)["”]?/, /小字\s*([^,，"”]+)/, /(?:^|[,，])字\s*([^,，"”]+)/]) {
    const found = re.exec(inside)?.[1]?.trim()
    if (found) aliases.push(found)
  }
  return aliases
}

const classifyLine = (raw: string): ParsedLine | null => {
  const line = raw.trim()
  if (line.length === 0) return null

  const subtitle = SUBTITLE_RE.exec(line)
  if (subtitle?.[1]) return { kind: 'subtitle', text: subtitle[1].trim() }

  const os = OS_RE.exec(line)
  if (os) return { kind: 'os', text: os[1]?.trim() ?? '' }

  const camera = CAMERA_LEAD_RE.exec(line)
  if (camera) {
    return { kind: 'action', text: camera[2]?.trim() ?? '', camera: camera[1] }
  }

  // Season-2 numbered shot markers: `[镜头3·仰拍] 老道立在古松下…`. The
  // bracket is direction, not picture — leak it into the text and it ends up
  // verbatim inside an image prompt. The framing word (特写/中景/…) is kept as
  // the camera hint so the writer's explicit choice beats the coverage pass.
  const marker = SHOT_MARKER_RE.exec(line)
  if (marker) {
    const hints = (marker[1] ?? '').split('·').map((h) => h.trim()).filter(Boolean)
    const size = hints.find((h) => /^(特写|近景|中景|全景|远景|广角)$/.test(h))
    const rest = marker[2]?.trim() ?? ''
    // A marker with no body (`[镜头·远景]` alone) frames the NEXT line; there
    // is nothing to shoot in the marker itself.
    if (!rest) return null
    const inner = classifyLine(rest)
    if (!inner) return null
    const mapped = size === '远景' || size === '广角' ? '全景' : size
    return mapped && inner.kind === 'action' ? { ...inner, camera: inner.camera ?? mapped } : inner
  }

  // `(定格·黑场)` and similar bare stage punctuation — not a picture.
  if (/^[(（][^)）]*[)）]$/.test(line)) return null

  const dialogue = DIALOGUE_RE.exec(line)
  if (dialogue) {
    const speaker = dialogue[1]?.trim() ?? ''
    const action = dialogue[2]?.trim()
    const text = stripQuotes(dialogue[3]?.trim() ?? '')
    // `陈瑜之(盯着灯焰,OS):…` is narration voiced by a character, not dialogue.
    const isNarration = action ? /\bOS\b/.test(action) : false
    return {
      kind: isNarration ? 'os' : 'dialogue',
      text,
      speaker,
      ...(action ? { action: action.replace(/,?\s*OS\s*$/, '').trim() || undefined } : {}),
    }
  }

  return { kind: 'action', text: line }
}

export const parseScript = (markdown: string): ParsedScript => {
  const lines = markdown.split('\n')

  let title = ''
  let genre = ''
  let logline = ''
  const characters: ParsedCharacter[] = []
  const synopses = new Map<number, { synopsis: string; hook: string }>()
  const episodes: ParsedEpisode[] = []

  type Section = 'head' | 'characters' | 'overview' | 'body' | 'appendix'
  let section: Section = 'head'
  // Set by the 人物表 separator row; rows before it are the table header.
  let castTableStarted = false

  let episode: {
    index: number
    title: string
    targetSeconds: number
    scenes: ParsedScene[]
    hook: string
  } | null = null
  let scene: { index: number; name: string; timeOfDay: string; lines: ParsedLine[] } | null = null
  let inHook = false

  const flushScene = (): void => {
    if (episode && scene && scene.lines.length > 0) episode.scenes.push({ ...scene })
    scene = null
  }
  const flushEpisode = (): void => {
    flushScene()
    if (!episode) return
    const meta = synopses.get(episode.index)
    episodes.push({
      index: episode.index,
      title: episode.title,
      targetSeconds: episode.targetSeconds,
      synopsis: meta?.synopsis ?? '',
      hook: episode.hook || meta?.hook || '',
      scenes: episode.scenes,
    })
    episode = null
  }

  for (const raw of lines) {
    const line = raw.trim()

    if (/^#+\s*附录/.test(line)) {
      flushEpisode()
      section = 'appendix'
      continue
    }
    if (section === 'appendix') continue

    if (/^#+\s*人物表/.test(line)) {
      section = 'characters'
      continue
    }
    if (/^#+\s*第一季节奏总览/.test(line)) {
      section = 'overview'
      continue
    }

    const episodeHeader = EPISODE_RE.exec(line)
    if (episodeHeader?.[1]) {
      flushEpisode()
      section = 'body'
      inHook = false
      episode = {
        index: Number(episodeHeader[1]),
        title: episodeHeader[2]?.trim() ?? '',
        targetSeconds: Number(episodeHeader[3] ?? 0) || 90,
        scenes: [],
        hook: '',
      }
      continue
    }

    if (section === 'head') {
      const t = metaValue(line, '剧名建议')
      if (t) title = stripBrackets(t)
      const g = metaValue(line, '类型')
      if (g) genre = g
      const l = metaValue(line, '一句话卖点')
      if (l) logline = l
      continue
    }

    if (section === 'characters') {
      // Markdown puts the separator directly under the header, so anything
      // before it is the header — whatever it happens to be called. Matching
      // header text by name imported 「姓名」 as a character.
      if (isSeparatorRow(line)) {
        castTableStarted = true
        continue
      }
      const cells = tableCells(line)
      if (castTableStarted && cells && cells.length >= 3) {
        characters.push(...splitPairedRow(cells))
      }
      continue
    }

    if (section === 'overview') {
      const cells = tableCells(line)
      if (cells && cells.length >= 4 && /^\d+$/.test(cells[0] ?? '')) {
        synopses.set(Number(cells[0]), {
          synopsis: cells[2] ?? '',
          hook: cells[3] ?? '',
        })
      }
      continue
    }

    if (section !== 'body' || !episode) continue

    if (HOOK_RE.test(line)) {
      // Season-2 hooks are the episode's closing shots, so they need a scene
      // to land in — a continuation of wherever the episode just was.
      const carried: { index: number; name: string; timeOfDay: string } | null | undefined =
        scene ?? episode.scenes[episode.scenes.length - 1]
      flushScene()
      scene = {
        index: (carried?.index ?? 0) + 1,
        name: carried?.name ?? '',
        timeOfDay: carried?.timeOfDay ?? '日',
        lines: [],
      }
      inHook = true
      continue
    }

    const sceneHeader = SCENE_RE.exec(line)
    if (sceneHeader) {
      flushScene()
      inHook = false
      scene = {
        index: Number(sceneHeader[1] ?? 0),
        name: sceneHeader[2]?.trim() ?? '',
        timeOfDay: sceneHeader[3]?.trim() ?? '',
        lines: [],
      }
      continue
    }

    if (line.length === 0 || line === '---') continue

    if (inHook) {
      const parsed = classifyLine(line)
      if (!parsed?.text) continue
      episode.hook = episode.hook ? `${episode.hook} ${parsed.text}` : parsed.text
      // A season-1 hook is narration ABOUT the episode; a season-2 hook is the
      // episode's actual closing shots (画面钩/动作钩). Dialogue and action in
      // the hook are therefore also scenes to shoot — narration stays summary.
      if (parsed.kind !== 'os' && scene) scene.lines.push(parsed)
      continue
    }

    if (!scene) continue
    const parsed = classifyLine(line)
    if (parsed) scene.lines.push(parsed)
  }

  flushEpisode()

  return { title, genre, logline, characters, episodes }
}

const stripBrackets = (text: string): string => {
  const inner = /《([^》]+)》/.exec(text)?.[1]
  return (inner ?? text).trim()
}

/**
 * Which characters a line features. Matches full names, declared aliases, and
 * name prefixes — scripts address people loosely (`陈母` for 陈母李氏, `丑叔`
 * for 陈瑜之), and a shot with no resolved character loses its consistency
 * anchor entirely.
 */
export const charactersInLine = (
  line: ParsedLine,
  characters: readonly ParsedCharacter[],
): readonly string[] => {
  // Names inside spoken words are people talked *about* — 「丙哪儿去了」 says
  // outright that 丙 is not there. Only a stage direction or an action line
  // puts someone on camera, so a dialogue line's text is not searched.
  const haystack =
    line.kind === 'dialogue'
      ? `${line.speaker ?? ''} ${line.action ?? ''}`
      : `${line.speaker ?? ''} ${line.action ?? ''} ${line.text}`

  const matches = (c: ParsedCharacter): boolean => {
    if (line.speaker) {
      // `陈母:` addresses 陈母李氏; `丑叔:` is a declared alias.
      if (line.speaker === c.name) return true
      if (c.aliases.includes(line.speaker)) return true
      if (line.speaker.length >= 2 && c.name.startsWith(line.speaker)) return true
      // Season-2 lines fold scene and action into the speaker slot —
      // 「丹砂岭道院。汪县令一躬到底:"…"」 — so a name or alias buried inside
      // the slot still identifies the speaker.
      if (line.speaker.includes(c.name)) return true
      if (c.aliases.some((a) => a.length >= 2 && line.speaker!.includes(a))) return true
    }
    if (haystack.includes(c.name)) return true
    return c.aliases.some((a) => a.length >= 2 && haystack.includes(a))
  }

  return [...new Set(characters.filter(matches).map((c) => c.name))]
}

/** Adds extra aliases (from config) to the parsed cast. */
export const withAliases = (
  characters: readonly ParsedCharacter[],
  extra: Readonly<Record<string, readonly string[]>>,
): readonly ParsedCharacter[] =>
  characters.map((c) => {
    const added = extra[c.name]
    return added ? { ...c, aliases: [...new Set([...c.aliases, ...added])] } : c
  })
