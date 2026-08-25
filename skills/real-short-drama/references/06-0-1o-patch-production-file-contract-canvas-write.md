## 0.1O PATCH：PRODUCTION FILE CONTRACT & CANVAS WRITEBACK LOCK

### 生产文件契约与画布写回锁

【补丁目的】

修复以下问题：

1. 系统把已经定型的剧本框架、角色、场景、道具、脚本、分镜、关键帧、视频任务只写在对话正文里，后续 agent 容易遗忘或重写。
2. 下游分镜 / prompt / keyframe / I2V / EDL 直接依赖上一轮聊天上下文，导致角色名、资产 ID、地点、剧情 beat 和台词漂移。
3. 用户确认过的内容没有沉淀为稳定生产真相源，下一阶段无法可靠引用。
4. 多 agent 链路中，不同 agent 各自重新发明故事、角色、场景和资产，破坏一致性。
5. 运行环境不支持真实写盘时，系统没有用 Canvas / 文件块模拟写盘，导致产物不可复用。

从本补丁生效起，所有会被后续阶段引用的内容，必须写入稳定 `.md` 文件或 Canvas 文件块。

核心原则：

```text
CONVERSATION IS NOT PRODUCTION TRUTH.
FILE / CANVAS IS PRODUCTION TRUTH.
```

也就是说：

```text
对话正文不是下游继承源。
临时解释不是下游继承源。
Prompt 草稿不是资产真相源。
用户口头确认不是文件沉淀。
只有已写入文件 / Canvas 的内容，才可被下游 agent 读取和继承。
```

---

### 一、最高原则

```text
NO FILE WRITEBACK, NO DOWNSTREAM INHERITANCE.
```

含义：

- 没有写入 `story_framework.md`，不得进入 WORLD_VISUAL_BIBLE。
- 没有写入 `ep01_beat_lock.md`，不得进入 WORLD_VISUAL_BIBLE。
- 没有写入 `visual/world_visual_bible.md` 与 `visual/world_visual_modules.md`，不得进入角色资产。
- 没有写入 `assets/characters.md`，不得进入脚本 / 分镜 / 关键帧。
- 没有写入 `scripts/EP001.md`，不得进入该集分镜。
- 没有写入 `storyboards/EP001_storyboard.md`，不得进入 keyframe。
- 没有写入 `keyframes/EP001_keyframes.md`，不得进入 VIDEO_GENERATION_TASK。
- 没有写入 `video_tasks/EP001_video_tasks.md`，不得进入 I2V 执行。
- 没有写入 `edl/EP001_selects_edl.md`，不得进入最终组装。

---

### 二、文件 / Canvas 是唯一稳定继承源

所有下游阶段必须只读取以下来源：

```text
1. 已写入的 .md 文件
2. 已写入 Canvas 的标准文件块
3. 用户上传并被系统注册为生产文件的文档
4. 已确认并登记进 asset_registry.md 的图像 / 视频资产
```

禁止下游读取或继承：

```text
上一轮对话里的散装描述
未写入文件的临时总结
未确认的 prompt
未编号的角色名
未登记的场景名
未登记的道具名
未登记的视觉设定
用户只说“方向可以”但未写盘的内容
```

---

### 三、运行环境写盘规则

如果运行环境支持真实文件写入，必须按以下路径写入真实 `.md` 文件：

```text
project_brief.md
story_framework.md
series_engine.md
ep01_beat_lock.md
character_function_map.md

visual/world_visual_bible.md
visual/world_visual_modules.md

assets/characters.md
assets/locations.md
assets/props.md
assets/costumes.md
assets/asset_registry.md

episodes/EP001_relation_map.md
scripts/EP001.md
storyboards/EP001_storyboard.md
production/EP001_footage_delivery_plan.md
keyframes/EP001_keyframes.md
video_tasks/EP001_video_tasks.md
edl/EP001_selects_edl.md
assembly/EP001_final_assembly_plan.md

state/runtime_state.md
state/confirmed_asset_snapshot.md
```

如果运行环境暂时不能调用 `WriteFile` 或不能返回 `node_key`，只能输出 Markdown Preview 供用户审阅；不得声称真实写盘，不得进入下游。历史规则中的“Canvas / 文件块模拟写盘”已被 0.1P 覆盖：

````markdown
### 文件：story_framework.md

```md
# STORY_FRAMEWORK_LOCK

...
```
````

规则：

- 每个文件必须单独一个文件块。
- 不得把多个文件混成一个正文。
- 不得发明临时文件名。
- 不得把工程解释写进文件内容。
- 文件块外可以给用户简短说明，但 Markdown Preview 不得作为下游继承源；下游只能读取通过 `WriteFile` 创建且拥有 `node_key` 的 Canvas 文本节点。

---

### 四、标准项目文件结构

每个项目必须维护以下生产文件结构。

```text
/ project root

project_brief.md
story_framework.md
series_engine.md
ep01_beat_lock.md
character_function_map.md

/visual
  world_visual_bible.md
  world_visual_modules.md

/assets
  characters.md
  locations.md
  props.md
  costumes.md
  asset_registry.md

/episodes
  EP001_relation_map.md
  EP002_relation_map.md

/scripts
  EP001.md
  EP002.md

/storyboards
  EP001_storyboard.md
  EP002_storyboard.md

/production
  EP001_footage_delivery_plan.md
  EP002_footage_delivery_plan.md

/keyframes
  EP001_keyframes.md
  EP002_keyframes.md

/video_tasks
  EP001_video_tasks.md
  EP002_video_tasks.md

/edl
  EP001_selects_edl.md
  EP002_selects_edl.md

/assembly
  EP001_final_assembly_plan.md
  EP002_final_assembly_plan.md

/state
  runtime_state.md
  confirmed_asset_snapshot.md
```

如果是 FAST_PROTOTYPE，可以压缩文件数量，但不得少于：

```text
story_framework.md
ep01_beat_lock.md
visual/world_visual_bible.md
visual/world_visual_modules.md
assets/characters.md
assets/asset_registry.md
scripts/EP001.md
storyboards/EP001_storyboard.md
keyframes/EP001_keyframes.md
video_tasks/EP001_video_tasks.md
state/runtime_state.md
```

---

### 五、文件职责边界

#### project_brief.md

记录用户输入与项目配置。

必须包含：

```md
# PROJECT BRIEF

- Project ID:
- User Original Input:
- Usage Mode: original / adaptation / continuation
- Target Market: cn / overseas
- Episode Count:
- Runtime Per Episode:
- Visual Format: 9:16 vertical
- Production Medium: AI-generated photoreal human vertical micro-drama
- User Constraints:
- Forbidden Direction:
```

#### story_framework.md

记录进入视觉生产前的最小戏剧架构。

必须包含：

```md
# STORY_FRAMEWORK_LOCK

- Project ID:
- Genre / Subgenre:
- Market Mode:
- Core Hook:
- Main Conflict:
- Protagonist Desire:
- Antagonist Pressure:
- Hidden Identity / Secret Engine:
- Power Structure:
- Emotional Contract:
- Payoff Type:
- Cliffhanger Type:
- Season Engine:
- Visual Demand From Story:
- Forbidden Story Drift:
```

#### series_engine.md

记录系列追更机制、payoff ladder 与反派升级。

必须包含：

```md
# SERIES_ENGINE

- Series Engine:
- Payoff Ladder:
  - EP01:
  - EP03:
  - EP05:
  - EP10:
  - Season:
- Villain Ladder:
- Conflict Rotation:
- Secret Release Schedule:
- World Expansion Ladder:
- Audience Retention Mechanism:
```

#### ep01_beat_lock.md

记录第一集留存结构。

必须包含：

```md
# EP01_DRAMA_BEAT_LOCK

- 0-3s Hook:
- 3-10s Pressure Setup:
- 10-15s First Reversal / Small Reveal:
- Midpoint Escalation:
- Main Payoff:
- End Cliffhanger:
- What EP01 Reveals:
- What EP01 Conceals:
- Audience Emotion Target:
- Visual Scenes Required By EP01:
```

#### character_function_map.md

记录角色进入视觉资产前的叙事功能。

必须包含：

```md
# CHARACTER_FUNCTION_MAP

## CHAR_001 {Name / Placeholder}

- Narrative Function:
- Pressure Type:
- Relationship To Protagonist:
- Power Level:
- Secret / Information Gap:
- EP01 Function:
- Visual Identity Demand:
- Current Episode Legal Appearance:
- Forbidden Spoiler Appearance:
```

#### visual/world_visual_bible.md

记录 WORLD_VISUAL_BIBLE 的视觉方向、图像任务、生成结果与确认状态。

必须包含：

```md
# WORLD_VISUAL_BIBLE

- World Visual ID:
- Source Story Framework File: story_framework.md
- Source EP01 Beat File: ep01_beat_lock.md
- Visual Thesis:
- Core Visual Motifs:
- Color System:
- Lighting System:
- Material System:
- Spatial Power Language:
- Prop Symbol System:
- Human Realism Rules:
- Forbidden Drift:

## Generated Image

- Image Required: yes
- Generated Image Exists:
- Generated Image ID:
- Generated Image URL / File:
- User Reviewed Image:
- User Confirmed Image:
```

#### visual/world_visual_modules.md

记录后续资产继承模块。

必须包含：

```md
# WORLD_VISUAL_MODULES

- AtmosphereAnchor:
- WorldRulesVisual:
- CharacterEvolutionDirection:
- ColorSystem:
- LightingSystem:
- MaterialLanguage:
- LocationDirection:
- PropSymbolSystem:
- ActionLanguage:
- EmotionalCurve:
```

#### assets/characters.md

记录角色稳定编号、叙事功能、视觉锚点、@base 与形态。

必须包含：

```md
# CHARACTER ASSET REGISTRY

## CHAR_001 {角色名}

- Narrative Role:
- Function Source: character_function_map.md
- First Episode:
- Stable Visual Anchors:
- Base Identity Asset ID:
- Base Image ID:
- Base Image URL / File:
- Base node_key:
- Base Reference Priority: PRIMARY / HIGHEST
- Base Confirmation Status:
- Must Attach To Keyframe / I2V When Visible: yes
- Character Sheet Asset ID:
- Character Sheet Image ID:
- Character Sheet Image URL / File:
- Character Sheet node_key:
- Character Sheet Reference Priority: SECONDARY AUXILIARY
- Character Sheet Confirmation Status:
- Current Confirmed Form:
- Form Registry:
- Forbidden Spoiler Forms:
- Key Episodes:
- Dialogue Strategy:
```

#### assets/locations.md

记录稳定场景资产。

必须包含：

```md
# LOCATION ASSET REGISTRY

## LOC_001 {场景名}

- Location Type:
- First Episode:
- Key Episodes:
- Spatial Function:
- Pressure Function:
- Reusable Action Positions:
- Visual Inheritance From: visual/world_visual_modules.md
- Location Asset ID:
- Location Image ID:
- Location Image URL / File:
- Location node_key:
- Confirmation Status:
- Must Attach To Keyframe / I2V When Used: yes
```

#### assets/props.md

记录承担叙事功能的道具。

必须包含：

```md
# PROP ASSET REGISTRY

## PROP_001 {道具名}

- Prop Type:
- First Episode:
- Key Episodes:
- Story Function:
- Evidence / Trigger / Symbol Function:
- Usage Boundary:
- Visual Inheritance From: visual/world_visual_modules.md
- Prop Asset ID:
- Prop Image ID:
- Prop Image URL / File:
- Prop node_key:
- Confirmation Status:
- Must Attach To Keyframe / I2V When Story-Critical: yes
```

#### assets/asset_registry.md

记录所有可被下游引用的资产 ID。

必须包含：

```md
# ASSET REGISTRY

## Visual Sources
- WORLD_001:

## Characters
- CHAR_001:
  - base_image_id:
  - base_asset_id:
  - base_node_key:
  - base_confirmation_status:
  - sheet_image_id:
  - sheet_asset_id:
  - sheet_node_key:

## Locations
- LOC_001:
  - location_image_id:
  - location_asset_id:
  - location_node_key:
  - confirmation_status:

## Props
- PROP_001:
  - prop_image_id:
  - prop_asset_id:
  - prop_node_key:
  - confirmation_status:

## Costumes
- COSTUME_001:
  - costume_image_id:
  - costume_asset_id:
  - costume_node_key:
  - confirmation_status:

## Keyframes
- KF_001:

## Video Outputs
- VTASK_001:
```

#### scripts/EP001.md

记录本集已锁定脚本。

必须包含：

```md
# EP001 SCRIPT

- Source Files:
  - story_framework.md
  - series_engine.md
  - ep01_beat_lock.md
  - assets/characters.md
  - assets/locations.md
  - assets/props.md
- Runtime Target:
- Episode Hook:
- Episode Payoff:
- Episode Cliffhanger:
- Dialogue Sentence Blocks:

---

## Script Body
```

#### storyboards/EP001_storyboard.md

记录场景拆解、MICRO_SHOT_UNIT、对白完整句块继承。

必须包含：

```md
# EP001 STORYBOARD

- Source Script: scripts/EP001.md
- Source Assets:
- Dialogue Sentence Blocks Source:

## MICRO_SHOT_UNIT LIST

### MSU_001
- Source Script Beat:
- Dialogue Sentence Block:
- Character IDs:
- Location ID:
- Prop IDs:
- Action:
- State Before:
- State After:
```

#### keyframes/EP001_keyframes.md

记录关键帧任务。

必须包含：

```md
# EP001 KEYFRAMES

- Source Storyboard: storyboards/EP001_storyboard.md
- Source Assets: assets/asset_registry.md

## SHOT_KEYFRAME LIST

### KF_001
- Linked MICRO_SHOT_UNIT:
- Source Asset Registry Node Key:
- Character Reference IDs:
- Required CHARACTER BASE image_id / asset_id / node_key:
- Optional CHARACTER SHEET image_id / asset_id / node_key:
- Location Reference ID:
- Required LOCATION image_id / asset_id / node_key:
- Prop Reference IDs:
- Required PROP image_id / asset_id / node_key:
- Costume / Form Reference IDs:
- Required COSTUME / FORM image_id / asset_id / node_key:
- KEYFRAME REFERENCE INPUT MANIFEST: required
- IMAGE GENERATION TOOL CALL CARD: required before generation
- Frame Purpose:
- Image Prompt:
- Prompt Rule: prompt must inherit attached reference images; text description cannot replace confirmed reference input
- Generated Image Exists:
- Generated Image ID:
- KEYFRAME ASSET CONSISTENCY CHECK:
- Can Register Keyframe: yes / no
```

#### video_tasks/EP001_video_tasks.md

记录 VIDEO_GENERATION_TASK，不按 MICRO_SHOT_UNIT 调工具。

必须包含：

```md
# EP001 VIDEO GENERATION TASKS

- Tool Call Unit: VIDEO_GENERATION_TASK
- MICRO_SHOT_UNIT is not a tool call
- Source Keyframes: keyframes/EP001_keyframes.md

## VIDEO_GENERATION_TASK LIST

### VTASK_001
- Contains MICRO_SHOT_UNIT IDs:
- Contains SHOT_KEYFRAME IDs:
- Duration Target:
- start_frame_image_node:
- start_frame_role: FIRST_FRAME_COMPOSITION_ONLY
- reference_nodes:
  - CHARACTER BASE node_keys:
  - LOCATION node_keys:
  - PROP node_keys:
  - COSTUME / FORM node_keys:
  - CHARACTER SHEET node_keys if used:
  - WORLD_VISUAL_BIBLE node_key:
- Reference Assets:
- Required CHARACTER BASE image_ids:
- Required LOCATION image_ids:
- Required PROP image_ids:
- Required COSTUME / FORM image_ids:
- Source KEYFRAME REFERENCE INPUT MANIFEST IDs:
- VIDEO REFERENCE INPUT MANIFEST:
- VIDEO TOOL CALL CARD:
- Video Prompt:
- Prompt Rule: video prompt must consume the same confirmed reference_nodes as source keyframes; start_frame_image_node cannot replace CHARACTER BASE / LOCATION / PROP / COSTUME reference_nodes; no text-only regeneration
- Audio Rule:
- Output Video File:
```

#### edl/EP001_selects_edl.md

记录精选片段与硬切结构。

必须包含：

```md
# EP001 SELECTS EDL

- Source Video Tasks: video_tasks/EP001_video_tasks.md
- Final Runtime Target:
- Generated Footage Runtime:

## SELECTS BY MICRO_SHOT_UNIT

### MSU_001
- Source VTASK:
- In:
- Out:
- Keep / Trim / Discard:
- Hard Cut Notes:
```

#### state/runtime_state.md

记录跨集运行状态。

必须包含：

```md
# RUNTIME STATE

- Project ID:
- Current Episode:
- Completed Episodes:
- Character State:
- Relationship State:
- Secret Ledger:
- Reputation Ledger:
- Conflict Escalation:
- Last Cliffhanger:
- Next Episode Required Continuity:
```

---

### 六、编号与引用规则

所有生产文件必须使用稳定 ID。

```text
角色：CHAR_001, CHAR_002, CHAR_003
地点：LOC_001, LOC_002, LOC_003
道具：PROP_001, PROP_002, PROP_003
服装：COSTUME_001, COSTUME_002, COSTUME_003
世界图：WORLD_001
镜头碎片：MSU_001, MSU_002, MSU_003
关键帧：KF_001, KF_002, KF_003
视频任务：VTASK_001, VTASK_002, VTASK_003
EDL 条目：EDL_001, EDL_002, EDL_003
```

规则：

- 一旦编号写入文件，不得重命名。
- 后续引用必须字面一致。
- 不得混用“女主 / 主角 / 林晚 / CHAR_001”作为同级引用；正式生产引用必须写 `CHAR_001 {角色名}`。
- 新增稳定资产必须先更新对应资产文件和 `assets/asset_registry.md`。
- 单集临时物件可写在脚本动作里，不登记为 PROP；若后续复用或承担反转功能，必须登记为 PROP。

---

### 七、USER VIEW / MACHINE VIEW 双层文件结构

可给用户阅读的文件，必须区分：

```text
USER VIEW = 用户可读区
MACHINE VIEW = 后续继承区
```

推荐格式：

```md
# story_framework.md

## USER VIEW

用自然语言说明这部剧讲什么、为什么能追、第一集看什么。

---

## MACHINE VIEW

- Project ID:
- Genre:
- Core Hook:
- Main Conflict:
- Payoff Ladder:
- Forbidden Drift:
```

规则：

- USER VIEW 可以人话、简洁、便于用户确认。
- MACHINE VIEW 必须字段稳定、编号稳定、适合下游读取。
- 下游 agent 以 MACHINE VIEW 为准。
- 如果 USER VIEW 与 MACHINE VIEW 冲突，以 MACHINE VIEW 为准，并要求回到当前文件修正。

---

### 八、阶段完成写回口径

每个阶段完成后，必须告诉用户本阶段写入了哪些文件，并明确下一步。

模板：

```text
STAGE COMPLETE

Completed Stage:
Files Written / Updated:
- path/to/file.md
- path/to/file.md
Next Allowed Stage:
Blocked Until:
Need User Confirmation:
```

示例：

```text
STAGE COMPLETE

Completed Stage: STORY_FRAMEWORK_LOCK
Files Written / Updated:
- project_brief.md
- story_framework.md
- series_engine.md
- ep01_beat_lock.md
- character_function_map.md
Next Allowed Stage: WORLD_VISUAL_BIBLE
Blocked Until: user confirms story framework or asks revision
Need User Confirmation: yes
```

禁止只说：

```text
剧本框架已完成，我们继续做世界图。
```

必须明确文件沉淀结果。

---

### 九、阶段进入文件门禁

进入每个阶段前必须检查必要文件。

```text
FILE ENTRY GATE

Requested Stage:
Required Source Files:
Existing Source Files:
Missing Source Files:
Can Enter Stage: yes / no
If no, Return To:
```

示例：

```text
Requested Stage: SHOT_KEYFRAME
Required Source Files:
- scripts/EP001.md
- storyboards/EP001_storyboard.md
- assets/asset_registry.md
Existing Source Files:
- scripts/EP001.md
- assets/asset_registry.md
Missing Source Files:
- storyboards/EP001_storyboard.md
Can Enter Stage: no
Return To: SCENE BREAKDOWN / STORYBOARD
```

---

### 十、修改与返工规则

如果用户修改上游文件，所有下游文件必须标记为需要复核。

```text
UPSTREAM CHANGE PROPAGATION RULE
```

改动影响：

```text
story_framework.md changed
→ series_engine.md / ep01_beat_lock.md / character_function_map.md / visual/world_visual_bible.md / downstream files need review

visual/world_visual_bible.md changed
→ visual/world_visual_modules.md / assets/* / keyframes/* / video_tasks/* need review

assets/characters.md changed
→ scripts/* / storyboards/* / keyframes/* / video_tasks/* / edl/* need review

scripts/EP001.md changed
→ storyboards/EP001_storyboard.md / keyframes/EP001_keyframes.md / video_tasks/EP001_video_tasks.md / edl/EP001_selects_edl.md need review
```

系统不得在上游大改后继续使用旧下游文件。

必须输出：

```text
DOWNSTREAM REVIEW REQUIRED

Changed File:
Affected Files:
Can Continue Without Review: yes / no
Recommended Return Stage:
```

---

### 十一、失败判定

出现以下任一情况，判定文件沉淀失败：

- 阶段完成但没有写入对应文件。
- 文件名不符合约定。
- 多个文件混在一个正文里，无法被下游引用。
- 下游引用未登记角色 / 地点 / 道具。
- 下游使用未写入文件的设定。
- 脚本写完后没有 `scripts/EP001.md`。
- 分镜写完后没有 `storyboards/EP001_storyboard.md`。
- 关键帧任务引用了不存在的 `CHAR_ID / LOC_ID / PROP_ID`。
- 视频任务按 MICRO_SHOT_UNIT 调工具，而不是按 VIDEO_GENERATION_TASK。
- 用户确认了正文方向，但系统没有写回文件。

失败后必须回滚到最近缺失文件阶段。

---

### 十二、补丁口诀

对话不是生产真相。  
文件才是生产真相。  
没有写盘，不许继承。  
没有文件，不进下游。  
先锁戏，再出图。  
先写盘，再继承。  
角色、地点、道具必须编号。  
脚本沉淀成 `scripts/EP001.md`。  
分镜沉淀成 `storyboards/EP001_storyboard.md`。  
关键帧沉淀成 `keyframes/EP001_keyframes.md`。  
视频任务沉淀成 `video_tasks/EP001_video_tasks.md`。  
EDL 沉淀成 `edl/EP001_selects_edl.md`。  
下游只读文件，不重写上游。
