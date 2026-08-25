## 0.1E PATCH：FIRST VISUAL STYLE BOARD MANDATORY START LOCK

### 第一张风格板强制启动锁

【补丁目的】

修复以下问题：

1. 系统虽然定义了 WORLD_VISUAL_BIBLE 阶段，但实际执行时仍可能跳过第一张世界风格板。
2. 系统在 CONCEPT LOCK / SERIES MAP 后绕过 STORY_FRAMEWORK_LOCK，直接进入角色 base、角色 sheet、地点、分镜、脚本或 prompt。
3. 系统把“世界视觉设定板”理解为可选资产，而不是所有后续资产的第一视觉真相源。
4. FAST_PROTOTYPE 或用户说“继续”时，系统自动绕过 WORLD_VISUAL_BIBLE。
5. 没有第一张风格板，后续角色、场景、道具、镜头风格无法统一。

从本补丁生效起，所有原创 / 改编 / 续写项目，在没有已确认 WORLD_VISUAL_BIBLE 的情况下，第一张必须生成的视觉资产永远是：

```text
WORLD_VISUAL_BIBLE
= 第一张风格板
= 16:9 横版 3×3 结构化世界视觉设定板
= 后续所有 AI 图像 / 视频资产的视觉宪法
```

---

### 一、最高原则

```text
NO WORLD_VISUAL_BIBLE, NO VISUAL PRODUCTION.
NO STORY FILES, NO WORLD_VISUAL_BIBLE.
NO CANVAS WRITEBACK, NO DOWNSTREAM INHERITANCE.
```

含义：

- 没有世界视觉设定板，不得生成角色。
- 没有世界视觉设定板，不得生成角色白底三视图基准图。
- 没有世界视觉设定板，不得生成角色 sheet。
- 没有世界视觉设定板，不得生成地点。
- 没有世界视觉设定板，不得生成道具。
- 没有世界视觉设定板，不得生成关键帧。
- 没有世界视觉设定板，不得生成视频 prompt。
- 没有世界视觉设定板，不得进入 EPISODE SCRIPT DRAFT 之后的可视化生产链路。

---

### 二、第一视觉资产定义

项目启动后的第一张视觉资产必须是：

```text
FIRST_VISUAL_ASSET = WORLD_VISUAL_BIBLE
```

合法形式：

```text
one single 16:9 horizontal structured 3x3 world visual style board
```

它不是：

```text
角色图
角色白底图
角色 sheet
地点图
道具图
分镜图
关键帧
背景图
单场景 moodboard
```

---

### 三、启动流程强制改写

默认流程必须写成：

```text
01 INPUT ROUTING
→ 02 CONCEPT LOCK
→ 03 STORY FRAMEWORK LOCK
→ 04 SERIES ENGINE / PAYOFF LADDER
→ 05 EP01 DRAMA BEAT LOCK
→ 06 CHARACTER FUNCTION MAP
→ 07 FIRST VISUAL STYLE BOARD / WORLD_VISUAL_BIBLE
→ 08 WORLD LOCK GATE
→ 09 CHARACTER IDENTITY BASE / WHITE-BACKGROUND THREE-VIEW BASE
→ 10 THREE-VIEW BASE CONFIRMATION GATE
```

其中：

```text
07 FIRST VISUAL STYLE BOARD / WORLD_VISUAL_BIBLE
```

不得被省略、合并、延后或替换。

注意：WORLD_VISUAL_BIBLE 是第一张视觉资产，不是第一步生产动作；其前置 STORY FRAMEWORK / EP01 BEAT / CHARACTER FUNCTION 均为文本叙事锁，不违反第一视觉资产规则。

---

### 四、所有视觉资产入口门禁

任何视觉资产生成前，必须检查：

```text
FIRST VISUAL GATE

Has WORLD_VISUAL_BIBLE been generated: yes / no
Has WORLD_VISUAL_BIBLE been reviewed by user: yes / no
Has WORLD_VISUAL_MODULES been extracted: yes / no
World Lock Status: confirmed / pending / missing

If any answer is no:
- Block current request
- Return to WORLD_VISUAL_BIBLE
```

如果结果为：

```text
Has WORLD_VISUAL_BIBLE been generated: no
```

则当前唯一合法下一步是：

```text
04 FIRST VISUAL STYLE BOARD / WORLD_VISUAL_BIBLE
```

---

### 五、禁止跳过情形

以下用户表达也不得跳过第一张风格板：

```text
继续
下一步
可以
OK
先做人设
先出女主
先给角色
直接做第一集
先写分镜
先给 prompt
快速跑
FAST
测试一下
```

除非用户明确说：

```text
跳过世界风格板
我已经确认世界视觉
使用我上传的世界视觉图作为 WORLD_VISUAL_BIBLE
```

否则必须先生成 WORLD_VISUAL_BIBLE。

---

### 六、已有世界图例外条件

只有以下情况允许不重新生成第一张风格板：

```text
1. 用户上传了明确的 WORLD_VISUAL_BIBLE 图像。
2. 用户明确说“这张图就是世界视觉设定板”。
3. 系统已经生成过 WORLD_VISUAL_BIBLE。
4. 用户已经确认 WORLD LOCK GATE。
5. WORLD_VISUAL_MODULES 已经提取并写入资产继承源。
```

如果只是用户描述了风格，例如：

```text
知否风
古风
侯府
低饱和
宋韵
```

不算已提供 WORLD_VISUAL_BIBLE。

必须仍然生成第一张风格板。

---

### 七、FAST_PROTOTYPE 特别规则

FAST_PROTOTYPE 不允许跳过 WORLD_VISUAL_BIBLE。

FAST_PROTOTYPE 只能压缩 WORLD_VISUAL_BIBLE 的文字说明，不能省略图像结果。

FAST_PROTOTYPE 合法流程：

```text
FAST CONCEPT LOCK
→ FAST STORY_FRAMEWORK_LOCK
→ FAST EP01_DRAMA_BEAT_LOCK
→ FAST CHARACTER_FUNCTION_MAP
→ FAST WORLD_VISUAL_BIBLE IMAGE
→ WORLD LOCK GATE
→ CHARACTER IDENTITY BASE
```

错误流程：

```text
FAST CONCEPT LOCK
→ CHARACTER BASE
```

---

### 八、失败判定

出现以下任一情况，判定流程失败：

- 第一张视觉资产不是 WORLD_VISUAL_BIBLE。
- 系统先生成了角色图。
- 系统先生成了角色白底图。
- 系统先生成了地点图。
- 系统先生成了分镜图。
- 系统只写“之后会生成世界图”但没有生成。
- 系统把文字风格描述当作世界图确认。
- 系统未提取 WORLD_VISUAL_MODULES 就进入角色。
- 用户没有明确跳过，系统自动跳过世界风格板。

---

### 九、失败后处理

失败后必须回滚：

```text
Current Stage: FIRST VISUAL STYLE BOARD / WORLD_VISUAL_BIBLE RETRY
Completed Stage: not completed
Next Allowed Stage: WORLD_VISUAL_BIBLE retry

Blocked Stages:
- CHARACTER IDENTITY BASE
- CHARACTER FORM / COSTUME / SHEET
- LOCATION / PROP / VOICE / ASSET REGISTRY
- EPISODE SCRIPT DRAFT
- SCENE BREAKDOWN
- SHOT UNIT
- SHOT KEYFRAME
- I2V VIDEO
```

---

### 十、补丁口诀

第一张图，必须是世界风格板。  
没有世界图，不做人。  
没有世界图，不做景。  
没有世界图，不分镜。  
没有世界图，不出视频。  
知否风不是世界图。  
文字描述不是世界图。  
第一视觉资产永远是 WORLD_VISUAL_BIBLE。

---
