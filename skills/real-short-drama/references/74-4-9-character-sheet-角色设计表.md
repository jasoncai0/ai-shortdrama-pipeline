## 4.9 CHARACTER @sheet 角色设计表

### 定义

`CHAR_001@sheet` 是标准角色表演辅助设计表，只给主角 / 重要角色做。

默认画幅：16:9 或 4:3 横版设计表。

它是给人看的表演、情绪、头部、姿态、近景、服装材质与手部动作审阅资产，不是逐镜生产资产，不是身份真相源。

它不是：

- 海报
- 随机拼贴
- 单张角色美图
- 普通人设氛围图
- 剧照集合
- 视频主参考图
- I2V 主输入图
- 第二张角色身份基准图
- `CHAR_xxx@base` 的三视图复刻图
- 正侧背队列
- 多阶段身份矩阵

---

### 生成前提：BASE 必须确认

必须先完成并确认对应阶段的 `CHAR_xxx@base_stage`。

`CHAR_xxx@sheet` 的合法进入条件：

```text
BASE CONFIRMATION GATE
- CHAR_xxx@base_stage Generated Image Exists: yes
- Base image_id exists: yes
- Base asset_id exists: yes
- Base node_key exists: yes
- User Reviewed Base Image: yes
- User Confirmed Base Image / user_confirmed: yes
- Can Enter CHARACTER @sheet: yes
```

任何一项为 no：

```text
Can Enter CHARACTER @sheet: no
Return To: CHARACTER @base / BASE CONFIRMATION GATE
```

禁止冷启动生成 @sheet。  
禁止未锁 @base 直接生成 @sheet。  
禁止 @base 未经用户确认就生成 @sheet。  
禁止让 @sheet 自己重新发明角色长相。  
禁止用 WORLD_VISUAL_BIBLE 里的主角预览图替代 @base。  
禁止从 WORLD_VISUAL_BIBLE 裁一格人物图当 @sheet 图块。

@sheet 的所有人物图块都必须由已确认的对应阶段 @base 派生，并保持：

```text
same face
same hairstyle
same body proportion
same age impression
same costume silhouette
same skin realism
same overall visual identity
```

---

### CHARACTER ASSET PACKAGE 内部顺序

`CHAR_xxx@sheet` 不是可选附加图，而是主角 / 重要角色在 @base 确认后的第二张强制角色资产图。

但它不能在 @base 生成后立即无确认地生成。正确顺序必须是：

```text
1. Generate CHAR_xxx@base_stage
2. BASE CONFIRMATION GATE
3. Stop and ask user to review / confirm the base image
4. If user_confirmed = yes → Generate CHAR_xxx@sheet
5. SHEET CONFIRMATION GATE
6. CharacterAssetCompletion = base_and_sheet_complete
```

规则：

- 主角 / 重要角色只完成 @base 时，状态只能是 `base_only_pending_sheet`，不得标记为角色资产完成。
- 用户确认 @base 后，`Next Allowed Substage = CHARACTER @sheet`。
- 用户确认 @base 后，不需要再次询问“是否要做角色卡”；但必须已经获得对 @base 的确认，才允许生成 @sheet。
- 如果用户明确要求“先停在 base，不做 sheet”，则状态标记为 `base_confirmed_sheet_deferred_by_user`，下游人物关键帧 / I2V 仍不得把该主角 / 重要角色视为完整资产。

---

### 单图封装规则（最高优先级）

`CHAR_xxx@sheet` 必须是一张单角色横版大图。它内部封装以下 11 个模块：

```text
Module 01 角色信息 / 模板文字层
Module 02 色板 / 无字色块层
Module 03 @base 紧凑三视图继承区（约 20-25%，front/side/back，不得撑满全图）
Module 04 剪影系统
Module 05 表情库
Module 06 微表情库
Module 07 头部结构 / 头部角度
Module 08 姿态库
Module 09 电影近景
Module 10 服装拆解
Module 11 手部动作
```

> **全局唯一真相**：@sheet 的内容与版面口径只以本节 11 模块清单为准。`MODULE 03 — COMPACT BASE TURNAROUND` 是 @sheet 内一个紧凑的身份基准转面区（front / 3-4 / side / back，约占 20-25%，放中上方），用于锁「同一个人」；它不得撑满整张图，05-11 表演模块合计必须占据大部分版面。同一身份贯穿全图，但每个表演格必须各不相同，禁止整张 sheet 变成一排重复全身站姿。

禁止为了制作 `CHAR_xxx@sheet` 额外生成多张身份基准补充图。  
禁止把多个角色默认合并到同一张 `@sheet`。除非用户明确要求“群像总览表”，否则每个主角 / 重要角色各自生成一张 `CHAR_xxx@sheet`。

---

### 限定口径：转面只属于 Module 03，05-11 表演模块不得变成转面

`@sheet` 的紧凑转面（front / side / back）只允许出现在 `MODULE 03 — COMPACT BASE TURNAROUND` 这一个约 20-25% 的中上区块。**除 Module 03 外**，其余模块不得输出或暗示以下旧结构：

```text
multi-angle identity views (outside module 03)
extra front / side / back rows beyond the compact turnaround
standing view queue
multi-stage identity matrix
growth-stage comparison rows
```

禁止把 `MODULE 07 头部结构`、`MODULE 08 姿态库`、`MODULE 09 电影近景` 编译成第二个身份三视图。它们只能是表演辅助图块：

```text
head angle studies
facial structure consistency checks
posture library
cinematic close-up performance panels
hand action studies
costume detail panels
```

如果 Module 03 的转面撑满整张图、或整张 @sheet 塌缩成一排重复站姿、或 05-11 表演模块被做成第二组正侧背队列，判定 `@sheet` 失败，必须重做。

---

### 固定排版规则

CHARACTER @sheet 必须采用固定横版角色设计表结构，默认 16:9 或 4:3。

**版面 = 11 个模块全部呈现，且每个模块都有最小占位，谁都不能被挤掉。** @base 紧凑转面（Module 03）放中上方、约占 20-25%，不得撑满全图；表情 / 微表情 / 头部 / 姿态 / 近景 / 服装 / 手部等表演模块共同构成 @sheet 的大部分版面，且各格内容必须互不相同。

#### 顶部：模板信息栏（Module 01 + Module 02）

顶部横向信息栏由后期模板覆盖层负责，不要求生图模型直接生成准确文字。

模板覆盖层包含：

- Character ID
- Name
- Age
- Role
- Stage（当前 / 代表性阶段，单一阶段标识）
- Core temperament
- Visual keywords
- Derived from which @base assets

Module 02 色板为 6–8 个无文字色块。色块可以由生图层生成，但颜色名称、hex 值、注释必须由模板覆盖层生成。

#### 中上方：@base 紧凑三视图继承区（Module 03，紧凑转面区）

这是 Module 03 — COMPACT BASE TURNAROUND，用于在 @sheet 内保留一个紧凑的身份基准转面，锁定「这是同一个人」。

允许内容：

1. 继承自已确认 @base 的紧凑转面：front / 3-4 / side / back 全身视图，可含 height scale
2. 与 confirmed @base 完全一致的脸 / 骨相 / 发型 / 身材比例 / 服装轮廓
3. 来源标注 base image_id / asset_id / node_key / representative stage tag（由模板覆盖层写入）

硬限制（保留三视图，但禁止它独占整张图）：

- 该转面区放在**中上方紧凑区块，约占整张 @sheet 的 20-25%**，不得撑满全图。
- 不得让转面成为整张图的全部内容；表情、微表情、头部、姿态、近景、服装、手部等表演模块（05-11）合计必须占据 @sheet 的**大部分版面**。
- 这是「一张含紧凑转面的表演表」，不是「一张含几个小表演格的转面图」。
- 身份一致 ≠ 姿势一致：转面之外的表演格必须各自不同，不得把转面里的站姿复制进 05-11，不得让整张 sheet 变成一排重复全身站姿。

#### 右侧区域：表情库 + 微表情库（Module 05 + Module 06）

右侧承载两组表演模块，是 @sheet 的表演核心之一；表演模块合计面积必须远大于 Module 03 的紧凑转面区，且每个表情 / 微表情格必须各不相同。

**Module 05 — 核心表情库**：6 个表情格，默认：

1. Shock 震惊
2. Humiliation 受辱
3. Doubt 怀疑
4. Anger 愤怒
5. Cold smile 冷笑
6. Determination 坚定

可根据角色类型微调，但必须保持 6 个清晰表情格。

**Module 06 — 微表情库**：紧邻表情库另设一组微表情格（eye tension 眼部紧绷 / subtle smile 隐笑 / lip compression 抿唇 / micro fear 微恐 / controlled breathing 克制呼吸），克制、真实、影视表演感。

以上所有图块必须保持同一张脸、同一骨相、同一角色身份，不得变成不同 AI 生成身份。

#### 下方区域：剪影 / 头部 / 姿态 / 近景 / 服装 / 手部（Module 04 + Module 07–11）

下方必须完整呈现以下表演与细节模块（每个模块都有最小占位，不得省略）：

- **Module 04 剪影系统**：body silhouette / costume silhouette
- **Module 07 头部结构**：head angle studies / facial structure consistency / close-up identity checks；不得做成正侧背身份队列
- **Module 08 姿态库**：relaxed / tense / confident；不得做成完整站姿多视图队列
- **Module 09 电影近景**：chest-up portrait，强情绪表演
- **Module 10 服装拆解**：hair / fabric / accessories / footwear
- **Module 11 手部动作**：relaxed / tense / pointing / gripping / face interaction
- Signature prop 标志道具
- Color palette 色彩系统（呼应 Module 02）

该区域用于表演与细节审阅，不是装饰区，不是身份重建区。

---

### 生图层 / 模板覆盖层分离

`@sheet` 必须拆成两层理解：

```text
A. AI IMAGE PANEL GENERATION LAYER
   只生成无准确文字依赖的人物图块、表情、微表情、头部角度、姿态、近景、服装、手部、无字色块与版面视觉底板。

B. TEMPLATE OVERLAY LAYER
   负责准确角色 ID、姓名、年龄、角色功能、阶段、base image_id、asset_id、node_key、derived-from statement、设计备注、色值、模块标题与中文说明。
```

硬规则：

- 生图模型不负责生成准确中文、准确英文、准确 ID、准确 node_key、准确说明文字。
- 任何需要准确可读的文字，都必须在模板覆盖层 / 外部设计工具 / 代码模板中后期套版。
- 生图 prompt 中不得要求模型直接画出可读的 character ID、name、age、role、base node_key、design notes。
- 如果生图结果出现乱码文字、错误 ID、错误标签，不得作为合法 @sheet；必须使用无字底板 + 模板覆盖层重做。

所以：

```text
@sheet = AI 生图层（无准确文字依赖） + 模板覆盖层（准确字段 / 标题 / ID / node_key / 备注）
```

---

### 强制规则

- 所有角色图块必须由已确认的对应阶段 @base 通过 img2img 派生。
- 不允许冷启动生成 @sheet。
- 不允许 @base 未确认就生成 @sheet。
- 不允许 @sheet 自己重新设计脸。
- 不允许只有半身图。
- 不允许缺少 11 个模块中的任何一个（Module 01–11）。
- 不允许 Module 03 转面撑满 / 独占整张图。
- 不允许 Module 03 转面区占据版面主体而挤掉表情 / 微表情 / 头部 / 姿态 / 近景 / 服装 / 手部模块。
- 不允许整张 @sheet 塌缩成一排重复全身站姿；除 Module 03 紧凑转面外，05-11 不得再做成第二组正侧背 / 站姿队列 / 成长阶段身份矩阵。
- 不允许缺少表情区 / 微表情区。
- 不允许缺少头部结构 / 姿态 / 近景 / 服装拆解 / 手部动作模块。
- 不允许缺少标志道具区。
- 不允许缺少色彩区。
- 不允许生成成普通角色海报。
- 不允许生成成随机拼贴 moodboard。
- 不允许生成成一张漂亮人物写真。
- @sheet 是给人看的设计表，不是 I2V 主输入。
- 视频阶段禁止直接引用整张 @sheet。

---

### 内容要求

固定版式内必须完整呈现上节定义的 11 个模块，对应关系：

- **Module 01 角色信息** → 模板覆盖层：Character ID / Name / Age / Role / Stage / temperament / visual keywords / derived-from base
- **Module 02 色板** → 6–8 个无文字色块，取自 WORLD_VISUAL_BIBLE 的 ColorSystem + 角色自身服装色；准确色值由模板覆盖层写入
- **Module 03 @base 紧凑三视图继承区** → 中上方约 20-25% 区块：front / 3-4 / side / back 全身转面，继承 confirmed @base 的脸 / 发型 / 身材 / 服装；来源 base image_id / asset_id / node_key 由模板覆盖层写入；不得撑满全图
- **Module 04 剪影系统** → body silhouette / costume silhouette
- **Module 05 核心表情库** → 6 格，默认 震惊 / 受辱 / 怀疑 / 愤怒 / 冷笑 / 坚定
- **Module 06 微表情库** → 眼部紧绷 / 隐笑 / 抿唇 / 微恐 / 克制呼吸
- **Module 07 头部结构** → head angle studies / facial structure consistency / close-up identity checks；不得生成正侧背身份队列
- **Module 08 姿态库** → relaxed / tense / confident；不得生成完整站姿多视图队列
- **Module 09 电影近景** → chest-up 强情绪表演
- **Module 10 服装拆解** → hair / fabric / accessories / footwear
- **Module 11 手部动作** → relaxed / tense / pointing / gripping / face interaction
- 附加生产信息：标志道具、设计备注；准确文字由模板覆盖层写入

---

### CHARACTER @sheet AI 生图层 Prompt 模板

```text
Create ONE SINGLE fixed-layout 11-module character performance sheet visual base for a live-action-looking AI-generated photorealistic human micro-drama character, horizontal 16:9 or 4:3 layout. This is one image output only for this one character, not multiple separate images.

This image must be derived from the locked and user-confirmed character base reference for ONE single representative stage:
[CHAR_xxx@base_stage]

Preserve the same face, hairstyle, body proportion, age impression, costume silhouette, skin realism, and overall visual identity from the locked and user-confirmed character base.

This is an 11-module character performance sheet visual base. ALL 11 visual modules must be present and clearly separated, and the performance modules must dominate the sheet.

Important layer rule:
Generate the visual panels only. Do NOT generate readable text, character names, IDs, age, role, node_key, labels, design notes, captions, hex values, or accurate typography. All accurate text will be added later by a template overlay layer. Use clean blank label areas or minimal abstract layout blocks where text will be overlaid later.

Required visual modules:
Module 01 — blank template information area only, no readable text.
Module 02 — color system: 6 to 8 clean color swatches, no text.
Module 03 — compact base turnaround, top-center, about 20-25% of the sheet area, must NOT dominate: front / 3-4 / side / back full-body views inheriting the exact same face, hairstyle, body proportion and costume from the confirmed base; height scale allowed. The turnaround is a compact identity-reference block only; performance modules 05-11 must together fill the majority of the sheet.
Module 04 — silhouette system: body silhouette and costume silhouette.
Module 05 — core emotion library: shock, humiliation, doubt, anger, cold smile, determination (6 expression panels).
Module 06 — micro expression library: eye tension, subtle smile, lip compression, micro fear, controlled breathing.
Module 07 — head structure system: head angle studies, facial structure consistency, close-up identity checks; no front/side/back identity lineup.
Module 08 — posture library: relaxed, tense, confident; no full-body multi-view standing lineup.
Module 09 — cinematic chest-up close-up with strong emotional performance.
Module 10 — costume breakdown: hair, fabric, accessories, footwear.
Module 11 — hand action library: relaxed, tense, pointing, gripping, face interaction.
Plus: signature prop visual area and clean modular layout spaces for later template overlay.

Hard layout rules:
Module 03 is a compact base turnaround block (about 20-25% area, top-center) that locks identity; it must NOT dominate or fill the whole sheet. Performance modules 05-11 must together fill the majority of the sheet. Keep the same identity across every panel — same face, bone structure, hairstyle, body proportion and costume — but each performance panel must show a DIFFERENT expression, angle, pose or action. Do NOT copy the turnaround standing pose into the performance panels. Do NOT let the whole sheet collapse into one repeated full-body turnaround. The sheet is an 11-module performance reference that contains a compact turnaround, derived from the locked and user-confirmed base.

Rules:
photorealistic AI-generated human character reference, consistent face across all panels, realistic human proportions, natural skin texture, clean production design sheet, clear modular 11-module layout, stable identity, derived from the locked and user-confirmed CHAR_xxx@base reference, no poster composition, no random collage, no fashion editorial poster, no cinematic background scene, no copied character base, no missing modules, no readable text, no labels, no typography, no anime, no cartoon, no illustration, no 3D render.

Important:
All character image panels must preserve the locked identity from the corresponding user-confirmed CHAR_xxx@base reference. This sheet is for human review only, not for direct I2V input. Do not use this entire sheet as a video reference. Generate ONE SINGLE horizontal 11-module character performance sheet visual base for CHAR_xxx; all 11 modules must appear inside this one sheet. Do not generate separate images, multiple image outputs, standalone identity references, standalone expression sheets, standalone costume boards, or other main characters in this sheet.
```

---

### TEMPLATE OVERLAY 层字段模板

准确文字必须由模板覆盖层写入，不得交给生图模型生成：

```text
TEMPLATE OVERLAY FIELDS

Character ID:
Character Name:
Age:
Narrative Role:
Current / Representative Stage:
Core Temperament:
Visual Keywords:
Derived From Base:
- base image_id:
- base asset_id:
- base node_key:
- base user_confirmed: yes
Module Labels:
- 01 Character Profile
- 02 Color System
- 03 Base Appearance Inheritance
- 04 Silhouette System
- 05 Core Emotion Library
- 06 Micro Expression Library
- 07 Head Structure System
- 08 Posture Library
- 09 Cinematic Close-Up
- 10 Costume Breakdown
- 11 Hand Action Library
Design Notes:
Color Values:
```

---

### SHEET LOCK GATE

```text
CHARACTER SHEET LOCK GATE

CHAR_ID:
Character Name:
Source CHARACTER BASE:
- Base Image ID:
- Base Asset ID:
- Base node_key:
- Base User Confirmed: yes / no
- Base Priority Preserved: yes / no

11 Modules Present:
- MODULE 01 CHARACTER PROFILE / TEMPLATE OVERLAY AREA: yes / no
- MODULE 02 COLOR SYSTEM / NO-TEXT SWATCHES: yes / no
- MODULE 03 COMPACT BASE TURNAROUND (≈20-25%, front/side/back, not dominating): yes / no
- MODULE 04 SILHOUETTE SYSTEM: yes / no
- MODULE 05 CORE EMOTION LIBRARY: yes / no
- MODULE 06 MICRO EXPRESSION LIBRARY: yes / no
- MODULE 07 HEAD STRUCTURE SYSTEM: yes / no
- MODULE 08 POSTURE LIBRARY: yes / no
- MODULE 09 CINEMATIC CLOSE-UP: yes / no
- MODULE 10 COSTUME BREAKDOWN: yes / no
- MODULE 11 HAND ACTION LIBRARY: yes / no

Module 03 Check:
- Confirmed CHARACTER BASE reference ID exists in template overlay: yes / no
- Base image_id / asset_id / node_key exists in template overlay: yes / no
- Base user_confirmed = yes: yes / no
- Compact turnaround (front / 3-4 / side / back) present and matches confirmed base identity: yes / no
- Turnaround area about 20-25%, top-center, NOT dominating the sheet: yes / no
- Performance modules 05-11 together fill the majority of the sheet: yes / no
- Each performance panel shows a different expression / angle / pose / action (sheet is NOT one repeated standing pose): yes / no

Forbidden Layout Check:
- No front / side / back row: yes / no
- No front / 3/4 / side / back row: yes / no
- No standing identity view queue: yes / no
- No growth-stage identity matrix: yes / no
- No readable AI-generated fake text /乱码 / wrong labels: yes / no

Identity Consistency With CHARACTER BASE:
- Same Face: yes / no
- Same Body Proportion: yes / no
- Same Age Impression: yes / no
- Same Hair Identity: yes / no
- Same Costume Silhouette: yes / no
- Same Skin Realism: yes / no

Final Gate:
- Can Register Character Sheet: yes / no
- CharacterAssetCompletion: base_and_sheet_complete / blocked
```

---

### 视频禁令

- 喂视频用 @base，或由 @base 生成的单张关键帧。
- 不把整张 @sheet 丢进生视频。
- 不把带文字、色板、分栏的角色卡作为 I2V 主参考。
- 如果需要从 @sheet 取参考，只能裁出单个无文字人物图块，并且必须回查它是否仍与 @base 一致。
- 任何 sheet 裁图都只能是 SECONDARY_AUXILIARY_REFERENCE，且必须同时附带 CHARACTER BASE。
- @sheet 漂了，以 @base 为准重做该图块。

---
