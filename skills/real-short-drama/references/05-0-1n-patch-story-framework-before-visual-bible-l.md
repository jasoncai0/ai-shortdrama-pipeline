## 0.1N PATCH：STORY FRAMEWORK BEFORE VISUAL BIBLE LOCK

### 剧本框架先于世界视觉设定板锁

【补丁目的】

修复 v0.0.1 中 WORLD_VISUAL_BIBLE 进入过早的问题：系统在只完成 CONCEPT LOCK / SERIES MAP 后就直接生成世界视觉设定板，导致世界图只是在“做风格”，没有被核心戏剧结构、第一集爆点、角色权力关系和系列追剧引擎约束。

从本补丁生效起：

```text
WORLD_VISUAL_BIBLE 是第一张视觉资产。
但 WORLD_VISUAL_BIBLE 不是第一步生产动作。
```

正确生产原则：

```text
NARRATIVE FIRST, VISUAL SECOND.
先锁戏，再出图。
世界图服务剧情，不反向绑架剧情。
```

---

### 一、最高原则

```text
NO STORY FRAMEWORK, NO WORLD_VISUAL_BIBLE.
```

含义：

- 没有剧本框架，不得生成世界视觉设定板。
- 没有第一集戏剧 beat，不得生成世界视觉设定板。
- 没有角色功能图，不得生成角色 base。
- 没有主冲突 / 权力结构 / 爽点机制，世界图不得进入生成。
- WORLD_VISUAL_BIBLE 只能继承上游叙事锁，不能替代上游叙事锁。

---

### 二、概念不等于剧本框架

以下内容不足以进入 WORLD_VISUAL_BIBLE：

```text
题材
一句话 logline
短剧类型
用户随口说的爽点
“古风 / 现言 / 豪门 / 复仇 / 马甲”标签
SERIES MAP 的集数规划
```

它们只能支撑 CONCEPT LOCK，不能支撑视觉宪法。

必须先完成：

```text
STORY_FRAMEWORK_LOCK
SERIES_ENGINE / PAYOFF_LADDER
EP01_DRAMA_BEAT_LOCK
CHARACTER_FUNCTION_MAP
```

---

### 三、WORLD_VISUAL_BIBLE 的新进入条件

进入 WORLD_VISUAL_BIBLE 前必须通过：

```text
STORY BEFORE VISUAL GATE

Concept Lock: completed
Story Framework Lock: completed
Series Engine / Payoff Ladder: completed
EP01 Drama Beat Lock: completed
Character Function Map: completed
Visual Demand derived from story: completed
Can Enter WORLD_VISUAL_BIBLE: yes / no
```

如果任一项为 no：

```text
Can Enter WORLD_VISUAL_BIBLE: no
Return To: missing narrative lock stage
Blocked Stage: WORLD_VISUAL_BIBLE
```

---

### 四、STORY_FRAMEWORK_LOCK 必须锁定什么

STORY_FRAMEWORK_LOCK 不是完整剧本，也不是分镜。它是进入视觉生产前的最小戏剧架构。

必须输出：

```text
STORY_FRAMEWORK_LOCK

Project ID:
Genre / Subgenre:
Market Mode:
Core Hook:
Main Conflict:
Protagonist Desire:
Antagonist Pressure:
Hidden Identity / Secret Engine:
Power Structure:
Emotional Contract:
Payoff Type:
Cliffhanger Type:
Season Engine:
Visual Demand From Story:
Forbidden Story Drift:
```

规则：

- 不要求完整对白。
- 不要求完整分集剧本。
- 不要求完整结局。
- 但必须明确“这个剧靠什么冲突持续”。
- 必须明确“第一张世界图应该服务什么戏”。

---

### 五、EP01_DRAMA_BEAT_LOCK 必须先于世界图

短剧的世界图必须服务第一集留存结构。

WORLD_VISUAL_BIBLE 之前必须锁定：

```text
EP01_DRAMA_BEAT_LOCK

0-3s Hook:
3-10s Pressure Setup:
10-15s First Reversal / Small Reveal:
Midpoint Escalation:
Main Payoff:
End Cliffhanger:
What EP01 Reveals:
What EP01 Conceals:
Audience Emotion Target:
Visual Scenes Required By EP01:
```

禁止：

```text
世界图先行生成一堆好看的氛围，但第一集没有对应戏剧用途。
```

---

### 六、CHARACTER_FUNCTION_MAP 必须先于角色 base

生成角色三视图前，必须先知道每个角色在戏里承担什么功能，而不是只知道“主角 / 反派 / 配角”。

必须输出：

```text
CHARACTER_FUNCTION_MAP

CHAR_ID:
Name / Placeholder:
Narrative Function:
Pressure Type:
Relationship To Protagonist:
Power Level:
Secret / Information Gap:
EP01 Function:
Visual Identity Demand:
Current Episode Legal Appearance:
Forbidden Spoiler Appearance:
```

该表决定：

- 谁需要先生成 @base；
- 谁可以后置；
- 第一张 @base 穿什么；
- 是否存在隐藏身份；
- 哪些后期形态不能提前生成。

---

### 七、FIRST VISUAL ASSET 重新定义

原规则保留，但必须精确定义：

```text
FIRST_VISUAL_ASSET = WORLD_VISUAL_BIBLE
```

不是：

```text
FIRST_PRODUCTION_STEP = WORLD_VISUAL_BIBLE
```

也就是说：

- 第一张视觉资产必须是 WORLD_VISUAL_BIBLE。
- 但在它之前，可以且必须先做纯文本叙事锁。
- 叙事锁不是视觉资产，不违反“第一张视觉资产”规则。

---

### 八、更新后的默认流程

```text
01 INPUT ROUTING
→ 02 CONCEPT LOCK
→ 03 STORY FRAMEWORK LOCK → write project_brief.md / story_framework.md
→ 04 SERIES ENGINE / PAYOFF LADDER → write series_engine.md
→ 05 EP01 DRAMA BEAT LOCK → write ep01_beat_lock.md
→ 06 CHARACTER FUNCTION MAP → write character_function_map.md
→ 07 WORLD_VISUAL_BIBLE → write visual/world_visual_bible.md + visual/world_visual_modules.md
→ 08 WORLD LOCK GATE
→ 09 CHARACTER IDENTITY BASE / WHITE-BACKGROUND THREE-VIEW BASE → write assets/characters.md
→ 10 THREE-VIEW BASE CONFIRMATION GATE
→ 11 CHARACTER SHEET / 11-MODULE AUXILIARY REFERENCE → update assets/characters.md
→ 12 CHARACTER SHEET CONFIRMATION GATE
→ 13 CHARACTER FORM / COSTUME VARIANT ONLY WHEN REQUIRED → update assets/characters.md / assets/costumes.md
→ 14 FORM / COSTUME / SHEET LOCK GATE
→ 15 LOCATION / PROP / VOICE / ASSET REGISTRY → write assets/locations.md / assets/props.md / assets/asset_registry.md
→ 14 EPISODE RELATION MAP → write episodes/EP001_relation_map.md
→ 15 EPISODE SCRIPT DRAFT → write scripts/EP001.md
→ 16 SCENE BREAKDOWN → write storyboards/EP001_storyboard.md
→ 17 FOOTAGE DELIVERY PLAN → write production/EP001_footage_delivery_plan.md
→ 18 MICRO_SHOT_UNIT → update storyboards/EP001_storyboard.md
→ 19 SHOT_KEYFRAME → write keyframes/EP001_keyframes.md
→ 20 VIDEO_GENERATION_TASK → write video_tasks/EP001_video_tasks.md
→ 21 SELECTS_EDL → write edl/EP001_selects_edl.md
→ 22 FINAL ASSEMBLY PLAN → write assembly/EP001_final_assembly_plan.md
→ 23 RUNTIME STATE SNAPSHOT → write state/runtime_state.md
→ 24 CONFIRMED ASSET SNAPSHOT → write state/confirmed_asset_snapshot.md
```

---

### 九、FAST_PROTOTYPE 特别规则

FAST_PROTOTYPE 可以压缩叙事锁，但不能跳过叙事锁。

FAST 合法流程：

```text
FAST CONCEPT LOCK
→ FAST STORY_FRAMEWORK_LOCK
→ FAST EP01_DRAMA_BEAT_LOCK
→ FAST CHARACTER_FUNCTION_MAP
→ FAST WORLD_VISUAL_BIBLE IMAGE
→ WORLD LOCK GATE
→ CHARACTER IDENTITY BASE
```

FAST 中 STORY_FRAMEWORK_LOCK 可以很短，但必须存在。

---

### 十、失败判定

出现以下任一情况，判定流程失败：

- 只给题材就直接生成 WORLD_VISUAL_BIBLE。
- 只完成 SERIES MAP 就直接生成 WORLD_VISUAL_BIBLE。
- 未锁 EP01 hook / payoff / cliffhanger 就生成世界图。
- 未明确角色功能和权力结构就生成角色 base。
- 世界图生成后反过来改写主冲突。
- 世界图变成好看氛围板，但不能解释其服务哪一段戏。
- 用户要求“先定剧本框架”，系统仍直接出设定图。

---

### 十一、补丁口诀

先锁戏，再出图。  
世界图是第一张视觉资产，不是第一步。  
题材不是剧本框架。  
SERIES MAP 不是戏剧引擎。  
没有 EP01 beat，不出 WORLD_VISUAL_BIBLE。  
没有角色功能图，不出角色 base。  
视觉服务剧情，不反向绑架剧情。
