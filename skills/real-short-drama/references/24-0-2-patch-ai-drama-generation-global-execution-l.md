## 0.2 PATCH：AI DRAMA GENERATION GLOBAL EXECUTION LOCK

### AI 真人质感短剧全局生产执行锁

【补丁目的】

修复以下系统误判：

1. 把“真人质感 AI 短剧”误解为“真人剧组拍摄打样”。
2. 默认输出英文对白或多语言对白。
3. 在单张分镜 / keyframe 图中生成字幕、文字、台词、UI 字。
4. 不按生产流程执行，一开始扩展剧本后直接跳到角色图。
5. WORLD_VISUAL_BIBLE 阶段把世界设定图拆成一张张场景图 / 地点图 / 色彩图 / 道具图。

从本补丁生效起，本 skill 的唯一生产对象是：**AI 生成的真人质感竖屏短剧**。

不是给真人剧组拍摄的打样。  
不是给导演 / 摄影师 / 演员 / 服化道 / 置景团队使用的传统影视前期包。  
所有资产都是为了驱动 AI 图像生成、AI 关键帧生成、AI 视频生成、AI 角色一致性控制、AI 镜头合成。

### 一、AI-ONLY 身份锁

系统必须始终理解：

**“真人质感” ≠ “真人拍摄”。**  
**“像真人实拍” ≠ “给真人剧组拍”。**  
**“live-action-looking” ≠ “human-shot live-action production”。**

本系统生产的是：

```text
AI-generated photorealistic human vertical micro-drama
```

不是：

```text
human-shot live-action drama
film crew previsualization
director shooting reference
actor casting reference
cinematographer reference
real set design package
real costume department package
```

所有 WORLD / CHARACTER / LOCATION / PROP / COSTUME / KEYFRAME / VIDEO prompt 都必须被解释为 AI 生产资产，而不是现实拍摄参考。

### 二、对白语言锁

全片生成的视频不得默认使用中文对白。先按全局对话语言规则确定用户可见沟通语言，再独立确定作品对白语言：

- 用户明确指定对白 / 字幕 / 目标市场语言时，使用用户指定语言。
- 用户没有明确指定但目标平台、地区、原始故事文本或上传脚本已经明确语言时，使用该作品语言。
- 如果作品语言仍不明确，必须通过 `AskUser` 确认；不要因为 Skill 源文件是中文、示例是中文、或 prompt 使用英文而默认中文对白。
- image prompt / video prompt / music prompt 等模型编译字段可继续使用英文；角色对白、OS、VO、字幕文本必须保留已确认的作品语言原文。

禁止默认生成中文对白。  
禁止默认生成英文对白。  
禁止无理由中英混杂对白。  
禁止因为英文 prompt 而把角色对白也写成英文。  
禁止把英文 prompt 中的 dialogue 当成最终对白语言。

正确规则：

- 用户可见说明 / 提问 / 选择卡：按全局对话语言规则。
- 剧情 / 对白 / 分镜说明：按确认后的作品语言；未确认时先询问。
- 图像 prompt / 视频 prompt / 音乐 prompt：英文。
- 最终视频对白：按确认后的作品语言。

如果用户要求海外版，也不自动改成英文对白。  
海外版只影响审核、节奏、题材尺度、平台表达，不改变默认对白语言。  
是否外语对白必须由用户明确指定。

### 三、单张分镜 / Keyframe 禁字锁

单张分镜图、关键帧图、I2V 输入图禁止出现字幕、台词、文字、信息栏、标题、贴纸字、UI 字。

原因：这些图是要拿去生成视频的生产输入。  
如果图里有字幕或文字，视频模型会复制、扭曲、漂移文字，造成成片污染。

因此所有 SHOT KEYFRAME / STORYBOARD IMAGE / I2V INPUT IMAGE 必须满足：

- no subtitles
- no captions
- no dialogue text on image
- no Chinese characters on image
- no English text on image
- no title card
- no text overlay
- no speech bubble
- no comic bubble
- no UI text
- no label
- no information panel
- no watermark
- no poster typography

对白只能存在于：

- 分镜文本字段
- VO / OS / 同期声字段
- Native Video Audio Request 字段
- 字幕文本字段（仅作为交付文本或工具支持的后期字幕层，不得烧进图像）

对白不得直接生成在 keyframe 图像里。

正确流程：

1. keyframe 图像只负责画面。
2. 台词写在 shot object / Native Video Audio Request 字段。
3. 字幕在后期合成阶段叠加。
4. 不允许把字幕烧进 AI 视频输入图。

### 四、严格流程锁

本 skill 必须严格按生产流程执行，不得跳步。

默认执行顺序必须为：

1. 输入判断：MODE A 原创 / MODE B 改编 / MODE C 续写
2. PIPELINE STATE 初始化 / STAGE ENTRY GATE
3. CONCEPT LOCK / 改编策略
4. STORY_FRAMEWORK_LOCK 剧本框架锁
5. SERIES_ENGINE / PAYOFF_LADDER 系列追剧引擎与爽点阶梯
6. EP01_DRAMA_BEAT_LOCK 第一集戏剧 beat 锁
7. CHARACTER_FUNCTION_MAP 角色戏剧功能图
8. WORLD_VISUAL_BIBLE 世界视觉设定板（必须继承 STORY_FRAMEWORK / EP01 BEAT / CHARACTER FUNCTION；必须直接生成视觉结果图并提取 WORLD_VISUAL_MODULES；未生成图像不得进入下一步）
9. WORLD LOCK GATE
10. CHARACTER IDENTITY BASE 白底三视图全身基础身份图（必须一张图内包含同一角色 front / side / back 三个完整全身视图，白底 / 浅灰底，无文字无信息栏无局部拼版）
11. BASE CONFIRMATION GATE
12. CHARACTER FORM 单形态串行生成 / COSTUME / SHEET
13. FORM / COSTUME / SHEET LOCK GATE
14. LOCATION / PROP / VOICE / PROJECT ASSET REGISTRY
15. EPISODE RELATION MAP
16. EPISODE SCRIPT DRAFT
17. SCENE BREAKDOWN
18. FOOTAGE DELIVERY PLAN
19. SHOT UNIT
20. SHOT KEYFRAME
21. BATCHED VIDEO GENERATION TASK
22. I2V VIDEO
23. SELECTED FOOTAGE EDL
24. FINAL ASSEMBLY PLAN
25. NATIVE VIDEO AUDIO / OPTIONAL FINAL BGM / RUNTIME STATE
26. RUNTIME STATE SNAPSHOT
27. CONFIRMED ASSET SNAPSHOT

禁止：

- 用户刚给题材，就直接生成角色图
- 用户刚给剧本，就直接生成角色图
- 跳过 STORY_FRAMEWORK_LOCK / EP01_DRAMA_BEAT_LOCK 直接做 WORLD_VISUAL_BIBLE
- 跳过 WORLD_VISUAL_BIBLE 直接做 CHARACTER
- 跳过 CONCEPT / STORY_FRAMEWORK / SERIES_ENGINE 直接做资产
- 跳过 @base 直接做 @sheet
- 把 CHARACTER IDENTITY BASE 误生成角色资料卡 / reference sheet / 多视图拼版
- 跳过 BASE CONFIRMATION GATE 批量生成多形态
- 一个角色多个形态一次性并行生成
- 脚本完成后自动进入角色设计
- 用户未明确继续时自动进入下一阶段
- 跳过 @sheet 直接进入主角分镜
- 跳过 LOCATION / PROP / COSTUME 资产，直接硬编镜头
- 把剧本扩展当作完整生产流程
- 把角色图当作启动阶段默认输出

只有以下情况允许提前进入角色图：

1. 用户已经明确提供了 WORLD_VISUAL_BIBLE 或等价世界视觉资产。
2. 用户已经明确上传了角色参考图，并要求基于参考图做角色资产。
3. 用户明确说“跳过世界设定，直接做人设 / 角色图”。
4. FAST_PROTOTYPE 模式下，系统仍必须先快速生成 WORLD_VISUAL_BIBLE 简版，而不是完全跳过世界视觉锁。

如果用户没有明确跳步要求，系统必须自动按完整流程推进。

### 五、WORLD_VISUAL_BIBLE 单图锁

除非用户自己提供参考图，否则 WORLD_VISUAL_BIBLE 阶段必须生成：

**一张完整 16:9 横版 3×3 结构化世界视觉设定板。**

禁止在 WORLD_VISUAL_BIBLE 阶段拆成：

- 一张张场景图
- 一张张地点图
- 一张张色彩图
- 一张张光影图
- 一张张道具图
- 一张张角色方向图
- gallery
- carousel
- 多个 image node
- 多张 mood reference
- 多张 environment reference

WORLD_VISUAL_BIBLE 的正确形式：

- ONE SINGLE horizontal 16:9 image
- structured 3x3 production board
- nine modules inside the same canvas
- unified visual hierarchy
- unified border / divider system
- photorealistic AI drama generation visual bible
- not a single background
- not a location asset pack
- not a gallery

WORLD_VISUAL_BIBLE 阶段只允许输出一张完整世界设定图；支持图像生成时必须直接生成图像，不得只输出 prompt。

通过 WORLD LOCK GATE 后，才允许拆出：

- CHARACTER @base
- LOCATION
- PROP
- COSTUME
- SHOT KEYFRAME

禁止用多个独立资产冒充 WORLD_VISUAL_BIBLE。

### 六、Prompt 默认身份锚点

所有图像 / 视频 prompt 必须默认继承以下身份锚点：

```text
AI-generated photorealistic human vertical micro-drama, live-action-looking synthetic video frame, created for AI image and AI video generation, not for real film crew shooting, not a behind-the-scenes production reference.
```

角色类 prompt 必须包含：

```text
AI character consistency reference, image-to-video ready, synthetic human identity source, not actor casting, not costume fitting, not real photography test.
```

关键帧 / 分镜 prompt 必须包含：

```text
AI-generated cinematic keyframe for vertical micro-drama, synthetic photoreal human footage look, generated scene, no subtitles, no captions, no text overlay, not a real shooting storyboard, not a director filming reference.
```

WORLD_VISUAL_BIBLE prompt 必须包含：

```text
AI visual bible for synthetic photoreal drama generation, one single 16:9 structured 3x3 board, not a traditional film crew art department board, not a shooting moodboard for real actors or real locations.
```

### 七、输出前全局自检

每次输出前必须检查：

【AI 身份】

- 是否把本项目误写成真人剧组拍摄？
- 是否出现“剧组 / 导演 / 摄影师 / 演员 / 现场 / 拍摄参考”等传统影视执行语言？
- 是否明确所有资产都是 AI 生成模型的生产输入？
- 是否明确“真人质感”只是视觉目标，不是真人拍摄方式？

【中文对白】

- 是否默认所有最终视频对白都是中文？
- 是否没有擅自生成英文对白？
- 是否只有 prompt 字段使用英文？
- 是否外语对白必须由用户明确要求？

【图像禁字】

- 单张分镜图 / keyframe 图是否无字幕？
- 是否无文字、无标题、无标签、无 UI 字？
- 对白是否只存在于 Native Video Audio Request / 字幕文本字段，而不是图像里？

【流程】

- 是否严格按 CONCEPT → SERIES → WORLD → CHARACTER BASE → CHARACTER SHEET → LOCATION / PROP / COSTUME → STORYBOARD → KEYFRAME → I2V → 可选最终 BGM / Runtime State 执行？
- 是否没有一开始就跳到角色图？
- 是否没有跳过 WORLD_VISUAL_BIBLE？
- 是否没有跳过 BASE LOCK GATE / SHEET LOCK GATE？

【世界图】

- WORLD_VISUAL_BIBLE 是否是一张完整 16:9 横版 3×3 结构化设定板？
- 是否没有拆成多张场景图 / 地点图 / 色彩图 / 道具图？
- 是否没有用 gallery / carousel 冒充世界视觉设定板？

如发现任何违规，必须回到对应阶段重写或重生成。

### 八、补丁口诀

真人质感，不是真人拍摄。  
像真人实拍，不是给剧组拍。  
所有资产都是 AI 生产输入。

对白语言先确认。  
英文只写 prompt。  
不要默认中文或英文对白。

分镜图不带字幕。  
关键帧不带文字。  
台词进 Native Video Audio Request，不进图像。

流程不能跳。  
先世界，再角色。  
先 @base，确认后再 @sheet。  
先资产，再分镜。  
先 keyframe，再 I2V。

世界设定图只生成一张完整 16:9 结构化板。  
不要一张张拆。  
不要 gallery。  
不要 carousel。  
不要用场景资产冒充世界视觉圣经。

---
