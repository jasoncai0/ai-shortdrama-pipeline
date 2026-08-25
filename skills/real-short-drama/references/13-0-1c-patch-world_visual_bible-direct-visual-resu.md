## 0.1C PATCH：WORLD_VISUAL_BIBLE DIRECT VISUAL RESULT LOCK

### 世界视觉设定板直接视觉结果锁

【补丁目的】

修复以下问题：

1. WORLD_VISUAL_BIBLE 阶段只输出文字描述、九宫格说明、色彩表或生图 prompt，没有真正交付可审阅的视觉方向结果。
2. 系统把“世界视觉设定板”降级为“可用于生成的提示词”，导致用户无法判断画面是否符合项目风格。
3. 系统没有在世界图生成后提取可继承的 WORLD_VISUAL_MODULES，导致后续角色、地点、道具、关键帧缺少统一视觉真相源。
4. 支持图像生成工具时，系统仍让用户自行复制 prompt，而不是直接生成 WORLD_VISUAL_BIBLE 图像。

从本补丁生效起，WORLD_VISUAL_BIBLE 阶段不得只输出 prompt 或文字方案，必须产出**可确认的直接视觉结果**。

### 一、最高原则

```text
WORLD_VISUAL_BIBLE ≠ prompt only
WORLD_VISUAL_BIBLE = direct visual direction result + generated image + extracted modules
```

WORLD_VISUAL_BIBLE 阶段必须完成三层结果：

```text
1. VISUAL DIRECTION RESULT
2. WORLD_VISUAL_BIBLE IMAGE TASK / GENERATED IMAGE
3. WORLD_VISUAL_MODULES
```

缺少任一层，判定 WORLD_VISUAL_BIBLE 阶段未完成。

### 二、VISUAL DIRECTION RESULT 必须先输出

在生成图像前，系统必须先给出一份明确、可审美判断的视觉设计结果。

该结果必须像已经完成的视觉设计决策，而不是创作建议。

必须锁定：

- 视觉母题
- 时代 / 类型质感
- 色彩系统
- 光影系统
- 材质系统
- 空间压迫语言
- 道具符号系统
- 人物在世界中的视觉位置
- 禁用方向

输出格式：

```text
VISUAL DIRECTION RESULT

World Visual ID:
Visual Thesis:
Core Visual Motifs:
Color System:
Lighting System:
Material System:
Spatial Power Language:
Prop Symbol System:
Human Realism Rules:
Forbidden Drift:
```

禁止只写：

- “整体偏知否风”
- “低饱和古风”
- “可参考宋代美学”
- “可以生成九宫格”
- “以下是 prompt”

必须写成可执行锁定结果。

### 三、必须直接生成 WORLD_VISUAL_BIBLE 图像

如果当前环境支持图像生成工具，系统必须直接调用图像生成，生成一张完整世界视觉设定板。

不得只输出 prompt 后让用户自己复制。

合法图像结果：

```text
ONE SINGLE IMAGE
16:9 HORIZONTAL CANVAS
STRUCTURED 3x3 BOARD
NINE MODULES INSIDE ONE CANVAS
UNIFIED VISUAL HIERARCHY
UNIFIED BORDER / DIVIDER SYSTEM
AI VISUAL BIBLE FOR SYNTHETIC PHOTOREAL DRAMA GENERATION
```

禁止输出：

- 只给 prompt
- 只给九宫格文字表
- 只给色彩 / 光影 / 材质说明
- 多张独立场景图
- gallery
- carousel
- moodboard 拼图但没有统一结构
- 单张纯背景图
- 地点资产包冒充世界视觉圣经

### 四、图像任务字段

生成图像前必须形成：

```text
WORLD_VISUAL_BIBLE IMAGE TASK

Image Type:
Canvas:
Layout:
Project Visual Thesis:
Panel 1:
Panel 2:
Panel 3:
Panel 4:
Panel 5:
Panel 6:
Panel 7:
Panel 8:
Panel 9:
Global Style Lock:
Negative Lock:
Text Policy:
AI Production Use:
```

如果生成工具不支持图像生成，必须明确标注：

```text
Image Generation Supported: no
Fallback: output locked prompt only
WORLD_VISUAL_BIBLE Status: not fully completed until image is generated
```

禁止在支持图像生成时使用 fallback。

### 五、图像生成后必须提取 WORLD_VISUAL_MODULES

WORLD_VISUAL_BIBLE 图像生成后，必须立即提取以下模块，写入后续资产继承源：

```text
WORLD_VISUAL_MODULES

AtmosphereAnchor:
WorldRulesVisual:
CharacterEvolutionDirection:
ColorSystem:
LightingSystem:
MaterialLanguage:
LocationDirection:
PropSymbolSystem:
ActionLanguage:
EmotionalCurve:
```

这些字段用于后续：

- CHARACTER @base
- CHARACTER FORM
- CHARACTER @sheet
- LOCATION
- PROP
- COSTUME
- SHOT KEYFRAME
- I2V VIDEO

后续资产不得绕开 WORLD_VISUAL_MODULES 自行发明新风格。

### 六、WORLD LOCK GATE 进入条件

只有满足以下全部条件，才允许进入 WORLD LOCK GATE：

```text
VISUAL DIRECTION RESULT: completed
WORLD_VISUAL_BIBLE IMAGE: generated or explicitly unavailable
WORLD_VISUAL_MODULES: extracted
User has reviewed visual result: yes
```

如果没有直接生成图像，不得默认写入：

```text
World Lock Status: confirmed
```

必须写为：

```text
World Lock Status: pending visual image review
```

### 七、失败判定

出现以下任一情况，WORLD_VISUAL_BIBLE 阶段失败：

- 只输出 prompt
- 只输出九宫格文字表
- 只输出色彩 / 光影 / 材质说明
- 未直接生成或交付 WORLD_VISUAL_BIBLE 图像
- 支持图像生成时仍让用户自行复制 prompt
- 没有提取 WORLD_VISUAL_MODULES
- 图像不是一张完整 16:9 横版 3x3 结构化板
- 图像变成单一背景图
- 图像变成多张无统一结构的 gallery
- 图像风格偏离 AI 真人质感短剧视觉宪法

### 八、失败后处理

失败后不得进入 WORLD LOCK GATE。

必须回滚：

```text
Current Stage: WORLD_VISUAL_BIBLE RETRY
Completed Stage: not completed
Next Allowed Stage: WORLD_VISUAL_BIBLE retry
Blocked Stages:
- WORLD LOCK GATE
- CHARACTER IDENTITY BASE
- CHARACTER FORM / COSTUME / SHEET
- LOCATION / PROP / VOICE / ASSET REGISTRY
- EPISODE SCRIPT DRAFT
- SHOT KEYFRAME
- I2V VIDEO
```

### 九、补丁口诀

世界图不是 prompt。  
世界图不是文字设定。  
世界图必须能被用户看见、判断、确认。  
先给视觉设计结果，再直接生成图，再提取继承模块。  
没有图，不锁世界。  
没有 WORLD_VISUAL_MODULES，不进角色。

---
