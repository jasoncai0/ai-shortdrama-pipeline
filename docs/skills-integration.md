# pgc-skills 短剧技能评估与集成

评估对象：内部技能导出包（未随本仓库分发，293 个 skill，其中短剧/运镜相关 16 个）。

## 这些 skill 是什么

**它们是 agent 指令文档，不是库。** 每个 skill 是一份 `SKILL.md`，写给一个运行在特定工具生态里的 agent 看 ——
`generate_media_v2` / `generate_text` / `ask_human` / canvas `node_key`。它们无法被 import，也无法被调用。

所以"接入"只有一种诚实的做法：**把里面的生产知识提取出来，落成本系统的插件和可编辑数据**，并注明出处。
凡是不能落地的，本文如实说明原因，不假装接上了。

导出包的两个实际问题（不是我方的）：

- `generate-camera-blocking-board` 的 `scripts/*.py` **没被导出**，SKILL.md 里 6 处 `python3 <skill-dir>/scripts/...` 调用全部指向不存在的文件 → 该 skill 原样不可执行。
- `real-short-drama` 18951 行，其中约六成是版本变更说明与流程门禁（`0.1A`~`0.1R` 补丁），真正可提取的生产规格集中在文件模板与 prompt 锚点两节。

## 评估结论

| Skill | 价值 | 结论 | 落地位置 |
|---|---|---|---|
| `real-short-drama` | ★★★★★ | **部分集成**（核心思想 + prompt 锚点） | `identityRefs` 端口契约、`prompts/profiles/photoreal-drama.json`、`refs`/`sheets` 两级资产 |
| `character-sheet-design` （两个来源环境各有一份，剥离环境元数据后逐字相同） | ★★★★☆ | **已集成** | `refs` 的 @base 规格、`sheets` stage |
| `short-drama-cover-design` （两个来源环境各有一份，剥离环境元数据后逐字相同） | ★★★★☆ | **已集成** | `cover` stage |
| `cover-design-director/references/shortdrama.md` | ★★★★☆ | **已集成** | `cover` stage（3:4、5% 安全边距、标题逐字） |
| `video-storyboard` | ★★★☆☆ | **部分集成**（连续性与负向词） | profile 的 `continuityClause` / `negatives` |
| `manga-character-sheet` （两个来源环境各有一份，剥离环境元数据后逐字相同） | ★★★☆☆ | **已集成** | `prompts/profiles/manga-drama.json` |
| `costume-visual-design` | ★★☆☆☆ | 未集成 | 41 行、仅古装，值不抵一个 profile 文件；需要时抄进 profile 的 `styleGuide` |
| `longpoll-consistant` | ★★★★☆ | **部分集成**（运镜措辞与失败矩阵） | `camera-grammar` middleware、`prompts/camera/grammar.json` |
| `viral-short-video-production-studio` | ★★☆☆☆ | 未集成 | `shot-breakdown-system.md` 是 beat/task packing，与 MSU↔VTASK 同一件事（见文末）；`Camera_Behavior` 只是必填字段名，没有词表 |
| `universal-multi-angle-grid` （两个来源环境各有一份，剥离环境元数据后逐字相同） | ★★☆☆☆ | 未集成 | 静态多机位构图扩展，不是时间轴运镜；与本管线的 Shot 模型不对位 |
| `dance-choreography-studio` / `model-material-fission` / `animate-wallpaper` / motion-poster 系列 | ★☆☆☆☆ | 未集成 | 分别是编舞、静图扩展、反运镜固定机位、动效向 |
| `generate-camera-blocking-board` | ★★★★☆ | **部分集成**（规格可用，画板不可用） | `prompts/camera/grammar.json`、`camera-check` stage |
| `smart-title-sequence` | ★★☆☆☆ | 未集成 | 片头字幕需要合成层，本系统止步于片段拼接 |
| `video-remake` （两个来源环境各有一份，剥离环境元数据后逐字相同） | ★★☆☆☆ | 未集成 | LOCK/REPLACE/ADAPT/REMOVE 需要一个输入视频；本管线没有这个入口 |

## 已落地的四件事

### 1. start-frame 与 identity-reference 分离（最有价值的一条）

`real-short-drama` 的 `VIDEO_GENERATION_TASK` 模板写死了这条规则：

```
- start_frame_image_node:
- start_frame_role: FIRST_FRAME_COMPOSITION_ONLY
- reference_nodes:
  - CHARACTER BASE node_keys:
- Prompt Rule: start_frame_image_node cannot replace CHARACTER BASE / LOCATION /
  PROP / COSTUME reference_nodes
```

**集成前本系统正是这个错误**：`videos` stage 只传 `firstFrame: shot.still`，一条 `refs` 都不传。
身份完全押在首帧上 —— 而首帧会漂、会裁掉脸、会被审核拒绝，而且模型无从分辨画面里哪部分是"这个人"、哪部分是布景。

改动：

- `VideoRequest` 新增 `identityRefs`，注释写明它**与** `firstFrame` 并存而非替代；
- `videos` stage 解析每个镜头 `characterIds` 对应的 `@base` 一并下发；
- libtv adapter 在"首帧 + 身份参考"同时存在时把 `singleImage2video` 提升为 `mixed2video`（全能参考），并对同一 canvas 节点去重；
- `tuning-log` 记录 `identityRefs`，否则调优时看不见它到底有没有生效。

三条 adapter 测试用假 `libtv` bin 钉死 argv 契约：两个输入都在、不重复、无参考时不误升级。

### 2. @base / @sheet 两级角色资产

`real-short-drama` v0.1.1/v0.1.2 与 `character-sheet-design` 共同的结论：

- `@base` 锁身份 —— 白底、全身、无场景无文字，是喂给 keyframe/I2V 的**唯一**角色图；
- `@sheet` 补表演 —— 表情/头部角度/姿态/手部，**不得单独作为 I2V 主参考**；
- 顺序不可逆：没有确认的 `@base`，不生成 `@sheet`。

落地：`refs` stage 按 @base 规格重写（原来只是一句 `character reference sheet, neutral background, full body`）；
新增 `sheets` stage 生成 @sheet，**代码强制**而非仅文档约束这两条：

- 没有 `refImage` 的角色被跳过并 warn，不会从文字凭空生成第二张脸；
- `sheetImage` 字段全系统只写不读 —— `images`/`videos` 永远只取 `refImage`。多宫格板子喂给生成器会把网格漏进画面。

`sheets` 默认不开：每个角色一张图是真钱，产物是给人看的。

### 3. 封面

`cover` stage，与管线里其它图刻意不同：

- **3:4，不是项目的 9:16**。红果/ReelShort/DramaBox 的信息流缩略图都是 3:4，沿用视频比例是最常见的错误。
- **标题要么逐字渲染，要么根本不渲染**。文字生成不可靠，糊掉的标题比没有更糟。默认出干净版留给排版overlay，`titleText` 显式opt-in。
- **主角由 @base 锚定**，封面上的脸和正片是同一张。
- adapter 不支持 3:4 时 warn 并回落项目比例，而不是静默出一张 9:16 封面。

### 4. 运镜：受控词表 + 免费 lint

三份 skill 指向同一个结论，而且是本系统当时的真实弱点 —— `Shot.cameraMove` 是 LLM 写的自由文本，
`video.tmpl` 原样吐给模型。

`longpoll-consistant` 的 `seedance2-prompts.md` 把问题讲得最直白：

> Avoid relying only on terms such as `slow`, `smooth`, `cinematic`, or `dynamic`.
> Their implied speed can change between generations.

所以两个镜头写同一个"缓慢推近"，拿到的其实是两个不同的运动。落地：

**`prompts/camera/grammar.json`** —— 17 个运镜的受控词表，每条给出**可观测物理描述**而不是形容词：

| 简写 | 下发给模型的措辞 |
|---|---|
| `dolly-in` | travels forward at a constant slow walking pace, subject distance decreasing steadily, focal length unchanged, floor parallax continuous |
| `pan-left` | stays in place and rotates on its vertical axis toward screen left at a constant angular rate, **no lateral translation, no parallax shift** |
| `orbit` | arcs around the subject at a constant radius and constant angular rate, subject distance unchanged |

别名含中文（`推近` / `摇左` / `跟拍`），匹配取最长优先 —— 否则 `tracking shot` 会先命中 `track`（`truck-*` 的别名）而被判成横移。

**`middleware/camera-grammar`** —— 在请求到达 provider 前把简写替换成物理措辞，并按配置追加子句
（`oneDominantMove` / `noEaseOut` / `alreadyMoving` / `noEditing`，全部来自 skill 原文）。
放中间件而不是 prompt strategy：strategy 编的是**故事**，故事换模型应当不变；而"运镜该怎么措辞"是模型属性 ——
Seedance 把 `slow` 读成情绪，别的模型可能读成速度 —— 属于可换层。图像请求不碰，静帧没有运动可描述。

无法识别的描述**原样放行**，只 warn：不给别人刻意写的措辞硬套一个错的物理描述。`strict: true` 则拒绝生成。

**`stage/camera-check`** —— 零成本确定性 lint，放在 `shots` 之后、`images` 之前：

- 无法识别的运镜（下发后行为不可预测）
- 一个镜头里两个运镜（blocking-board「one dominant movement per panel」；continuity 失败矩阵把"突然摇镜/环绕"归因于此）
- 连续同机位（`video-storyboard`「panel variety is critical」）—— **按集判断**，跨集第一镜与上集末镜重复是转场不是呆板
- 完全没写运镜的镜头

这些问题在下游发现都要花钱：`failOn: "problems"` 可以让它在付款前停下。

**没能集成的是那张画板本身**：`scripts/*.py` 没导出，而且 4 格 previs 服务的是一镜到底工作流 —— 我们不做。
但 `board-spec.md` 的**边界契约**（P02.start == P01.end，时间/位置/朝向/速度/焦段逐项容差）是完全确定性的、
可以用 TS 实现的，等一镜到底真正立项时它就是现成的验证器规格。

## Prompt profile：知识的载体

抽出来的锚点/负向词/资产规格不写进代码，落在 `prompts/profiles/*.json`：

| 文件 | 出处 |
|---|---|
| `photoreal-drama.json` | `real-short-drama` §0.1 四/五、`character-sheet-design` §2/§9、`video-storyboard` |
| `manga-drama.json` | `manga-character-sheet`、`character-sheet-design` §7 |

理由：这是**手艺知识**，按项目、按模型调；模板按项目调，profile 按模型/题材调，两者变更节奏不同，所以拆成两层。
每个文件带 `source` 字段指回原 skill。

新增 promptStrategy 插件 `skill-anchored` = `template` + profile：

```jsonc
"promptStrategy": {
  "impl": "skill-anchored",
  "options": { "profile": "photoreal-drama", "profileDir": "./prompts/profiles" }
}
```

`"profile": "none"` 退化成 `template` 的行为。锚点在前、故事在中、连续性约束在后 —— 模型对 prompt 头部权重最高，
连续性子句放尾部读起来是约束而不是主体。

其中最实用的一条来自 `real-short-drama` §0.1 四：

> `AI-generated photorealistic human vertical micro-drama, live-action-looking synthetic video frame, created for AI image/video generation, not for real film crew shooting, not a behind-the-scenes production reference.`

这句话是在告诉模型"要拍出真人质感，但这不是剧组拍摄现场"——少了它，模型容易输出片场花絮、器材、监视器这类画面。

## 明确没做的，以及为什么

**`longpoll-consistant` 的一镜到底**（它的运镜措辞已集成，见 §4；这里说的是**分段接续**那部分）——
`continuity-state.json` 契约与我们的生产模型有根本差异：
它把一个长镜头切成多段、锁住段间的运镜速度/角色状态/首尾帧接续；我们的 `Shot` 是一个独立可剪的片段，
`export` 用硬切拼接。要接它得引入"段"这一层（`real-short-drama` 里对应 `MICRO_SHOT_UNIT` 与
`VIDEO_GENERATION_TASK` 的多对一关系：MSU 不是工具调用单位，一个 6–15s 的 VTASK 可以包含多个 MSU）。
这是一次真实的建模改动，不是接个插件，**不该顺手做掉**。它有 `scripts/continuity.py` 且可运行，值得单独立项。

**`viral-short-video-production-studio` 的 beat/task packing** —— 它的 `Content Beat` 与 `Video Generation Task`
是多对一（"Do not equate a Content Beat, camera beat, or internal micro-shot with a video-tool call"），
和 `real-short-drama` 的 MSU↔VTASK 是同一件事，也就是下面这条。

**`MICRO_SHOT_UNIT` / `EDL` / `runtime_state`** —— 同上。我们目前 1 Shot = 1 clip = 1 次生成。
`EDL`（selects、in/out、Keep/Trim/Discard）意味着生成冗余素材再精选（skill 里目标 135–180s 素材出 90s 成片），
成本约翻倍，是产品决策不是技术决策。

**canvas `node_key` 持久化门禁（`0.1O`–`0.1Q`）** —— 这套是为那个 agent 运行时设计的，
本系统对应的机制已经存在且更强：本地 state 是真源、内容寻址的 `AssetRef`、`stageState` 断点续跑、
`needs` 前置依赖检查。不需要移植。

## 复核方式

```bash
pnpm test                      # 81 tests，含 3 条 identityRefs argv 契约测试 + profile 加载测试
node dist/cli.js run --config duanju.stub.json --idea "..." --yes   # 全 stub，含 sheets/cover
```

profile 是否真的生效，看编译后的 prompt：

```bash
node dist/cli.js status <projectId> --config duanju.stub.json
python3 -c "import json;d=json.load(open('.duanju/state/<projectId>.json'));print(d['shots'][0]['imagePrompt'])"
```

---

## 附：把技能导入为标准 skill 文件夹

`tools/import-pgc-skills.mjs` 把导出包转成标准 skill 文件夹并脱敏。

```bash
node tools/import-pgc-skills.mjs --src <导出包目录> --out ~/.claude/skills
node tools/import-pgc-skills.mjs --src <导出包目录> --out /tmp/preview --dry-run
```

### 剥掉了什么，为什么

| 剥掉 | 原因 |
|---|---|
| `bundle.json` / `asset.json` | 广场展示与导出元数据：`pin`、`categoryId`、`order`、i18n 标题、示例 prompt、`sha256`、`exportedFrom.assetId` |
| frontmatter 的 `route_profile` | **另一套召回机制**。`positive_triggers` / `negative_triggers` / `primary_industry` 是那个平台的路由字段；标准 harness 只按 `description` 召回，留着既撑大召回面又不起作用 |
| frontmatter 的 `extended.tool_policy` | `allowed_tools` 列的是宿主没有的工具，等于向模型广告不存在的能力 |
| `namespace` / `title` / `version` | 目录概念，非指令 |
| `agents/openai.yaml` | 平台接线 |

### 改写了什么

**环境标识** —— `us-pre` / `cn-pre` / `xla-industry` / `skillctl` / 跨技能路由里的 `industry/` 前缀，全部去掉。

**内部工具名** → 中性工具名（不是描述短语）：

| 原 | 现 |
|---|---|
| `ask_human` | `AskUser` |
| `generate_media_v2` / `edit_media_v2` | `GenerateMedia` / `EditMedia` |
| `generate_text` | `WriteFile` |
| `asset_factory` / `skill_file` | `AssetStore` / `SkillFile` |
| `fs_read` / `fs_list` / `fs_grep` | `Read` / `Glob` / `Grep` |

一开始映射成描述短语（`generate_text` → "a written file"），结果把小节标题写成了
`0.1P GENERATE_TEXT ... / a written file 真实 Canvas 文本节点持久化锁` —— 不成句。
这类 token 同时出现在标题、正文和名词位置，**只能用另一个 token 替换**。大小写保留：
`GENERATE_TEXT` → `WRITEFILE`。

### 处理召回问题

**超长 SKILL.md 拆分** —— `real-short-drama` 18952 行。调用即全量入上下文。
按 `##` 拆进 `references/`，正文留索引，首节保持内联（它是入口）。**18952 → 122 行 + 98 个引用文件**。
版本变更日志（`> **v0.1.2 变更说明**：…`）单独进 `references/00-changelog.md` —— 它解释规则怎么演变来的，
不是规则本身，不该每次调用都加载。默认阈值 1200 行，`--split-over 0` 关闭。

**描述过薄** —— `costume-visual-design` 源描述只有 `Skill for 古装视觉设计.`（17 字符）。
召回只匹配描述，这种描述永远不会被命中。脚本会 warn，并对已知的这一条用正文重写的描述覆盖。

### 多环境副本

同一技能在两个环境各有一份。脚本**实际逐字比对**剥离元数据后的正文再去重，不假设相同 ——
8 个双份技能验证结果均为 `duplicatesIdentical: true`。
