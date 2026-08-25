import { describe, expect, test } from 'vitest'
import { charactersInLine, parseScript, withAliases } from '../src/lib/script-parser.js'

const SCRIPT = `# 《寒门贵子》短剧剧本(第一季 · 第1—20集)

- **剧名建议**:《寒门贵子》(备选:《寒士上品》)
- **类型**:古装 · 穿越 · 逆袭
- **一句话卖点**:现代驴友魂穿门阀林立的东靖朝。

---

## 人物表(主要角色)

| 角色 | 身份 | 一句话人设 |
|---|---|---|
| 陈瑜之(小名"五丑") | 男主,15 岁寒门少年 | 现代灵魂+神仙容貌 |
| 陈母李氏 | 55 岁 | 慈母,信佛 |
| 陈宗之 / 陈润儿 | 8 岁 / 6 岁 | 亡兄遗孤 |
| 全彦(字子敬) | 散骑常侍 | 爱才如命 |

---

## 第一季节奏总览

| 集 | 对应原作 | 一句话剧情 | 卡点 |
|---|---|---|---|
| 1 | 第1章 | 灵魂归位,重生寒门 | 活下去,怎么活? |
| 2 | 第2章 | 湖畔报花名 | 族议分田 |

---

# 第1集 佛前一盏灯(约90秒)

【场1·云隐寺大殿·日】
字幕:承平二年 · 东靖朝
(OS):三个月前,暴雨夜,一盏长命灯没有熄灭。
大雄宝殿,香火鼎盛。白发老妇牵着一个少年进殿。
陈母李氏:"丑儿,过来,跪下。"
陈瑜之(盯着灯焰,OS):三个月……我终于要回去了。
(特写)灯焰暴涨,一缕光芒射入少年眉心。

【本集钩子】
(OS):活下去,是第一件事。

# 第2集 陆氏花痴(约80秒)

【场1·明镜湖畔山道·午后】
牛车缓行,陈母晕车。
陈瑜之:"娘,这段路颠,孩儿扶您走。"

【本集钩子】
(OS):一场夺产,正等着他。

---

# 附录A · 脱敏对照表

陈瑜之→陈瑜之;丁幼微→丁幼薇
`

describe('parseScript', () => {
  const script = parseScript(SCRIPT)

  test('reads the header metadata, unwrapping 《》 from the title', () => {
    expect(script.title).toBe('寒门贵子')
    expect(script.genre).toContain('古装')
    expect(script.logline).toContain('魂穿')
  })

  test('splits a paired 人物表 row into two characters', () => {
    const names = script.characters.map((c) => c.name)
    expect(names).toContain('陈宗之')
    expect(names).toContain('陈润儿')
    expect(script.characters.find((c) => c.name === '陈宗之')?.role).toBe('8 岁')
    expect(script.characters.find((c) => c.name === '陈润儿')?.role).toBe('6 岁')
  })

  test('extracts 小名 and 字 as aliases', () => {
    expect(script.characters.find((c) => c.name === '陈瑜之')?.aliases).toContain('五丑')
    expect(script.characters.find((c) => c.name === '全彦')?.aliases).toContain('子敬')
  })

  test('pulls synopsis and hook from the 节奏总览 table', () => {
    const first = script.episodes.find((e) => e.index === 1)
    expect(first?.synopsis).toBe('灵魂归位,重生寒门')
  })

  test('parses episode headers with title and target duration', () => {
    expect(script.episodes.map((e) => e.index)).toEqual([1, 2])
    const first = script.episodes[0]
    expect(first?.title).toBe('佛前一盏灯')
    expect(first?.targetSeconds).toBe(90)
  })

  test('parses the scene header into name and time of day', () => {
    const scene = script.episodes[0]?.scenes[0]
    expect(scene?.name).toBe('云隐寺大殿')
    expect(scene?.timeOfDay).toBe('日')
  })

  test('classifies every line kind', () => {
    const lines = script.episodes[0]?.scenes[0]?.lines ?? []
    const kinds = lines.map((l) => l.kind)

    expect(kinds).toEqual(['subtitle', 'os', 'action', 'dialogue', 'os', 'action'])
    expect(lines[0]?.text).toContain('承平二年')
    expect(lines[3]?.speaker).toBe('陈母李氏')
    expect(lines[3]?.text).toBe('丑儿,过来,跪下。')
  })

  test('treats 角色(…,OS): as narration, keeping the speaker and dropping the OS marker', () => {
    const narration = script.episodes[0]?.scenes[0]?.lines[4]
    expect(narration?.kind).toBe('os')
    expect(narration?.speaker).toBe('陈瑜之')
    expect(narration?.action).toBe('盯着灯焰')
  })

  test('captures a (特写) camera hint separately from the action text', () => {
    const closeUp = script.episodes[0]?.scenes[0]?.lines[5]
    expect(closeUp?.camera).toBe('特写')
    expect(closeUp?.text).toContain('灯焰暴涨')
  })

  test('collects the hook and keeps it out of the scene lines', () => {
    expect(script.episodes[0]?.hook).toContain('活下去')
    expect(script.episodes[0]?.scenes[0]?.lines.some((l) => l.text.includes('第一件事'))).toBe(false)
  })

  test('stops at 附录 so the desensitization table is not parsed as content', () => {
    const allText = script.episodes.flatMap((e) => e.scenes.flatMap((s) => s.lines.map((l) => l.text)))
    expect(allText.some((t) => t.includes('丁幼微→丁幼薇'))).toBe(false)
  })
})

describe('charactersInLine', () => {
  const characters = parseScript(SCRIPT).characters

  test('matches a name prefix — 陈母 addresses 陈母李氏', () => {
    const hits = charactersInLine({ kind: 'dialogue', speaker: '陈母', text: '看那盏灯' }, characters)
    expect(hits).toEqual(['陈母李氏'])
  })

  test('matches a declared alias from the 人物表', () => {
    const hits = charactersInLine({ kind: 'action', text: '五丑捧起油罐' }, characters)
    expect(hits).toContain('陈瑜之')
  })

  test('finds names mentioned inside the line body, not just the speaker', () => {
    const hits = charactersInLine({ kind: 'action', text: '陈瑜之扶着陈母李氏进殿' }, characters)
    expect(hits).toContain('陈瑜之')
    expect(hits).toContain('陈母李氏')
  })

  test('returns nothing when no character is referenced', () => {
    expect(charactersInLine({ kind: 'action', text: '香火鼎盛,青烟缭绕' }, characters)).toEqual([])
  })

  test('withAliases lets config add the nicknames the script actually uses', () => {
    const enriched = withAliases(characters, { 陈瑜之: ['丑叔', '小郎君'] })
    const hits = charactersInLine({ kind: 'dialogue', speaker: '丑叔', text: '别哭' }, enriched)
    expect(hits).toEqual(['陈瑜之'])
  })
})
