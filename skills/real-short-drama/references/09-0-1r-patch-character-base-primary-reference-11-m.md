## 0.1R PATCH：CHARACTER BASE PRIMARY REFERENCE & 11-MODULE CHARACTER SHEET PERFORMANCE AUXILIARY LOCK

### 角色 Base 主参考与 11 模块 Character Sheet 表演辅助参考锁 / @sheet 只继承 @base 形象

【补丁目的】

修复以下问题：

1. 系统把“完整角色图 / character sheet / 角色一致性图”错误理解为再次生成 CHARACTER BASE，导致生成结果与已确认 @base 高度重复。
2. 系统把 CHARACTER BASE 与 CHARACTER SHEET 混为同一种资产，导致下游不知道哪张图用于锁身份，哪张图用于补表演。
3. CHARACTER BASE 的身份锁定规则是正确的；CHARACTER SHEET 的职责不是重建身份，而是基于 @base 形象扩展表情、微表情、姿态、头部角度、服装拆解、手部动作等辅助参考功能。
4. 后续 keyframe / I2V 必须永远优先使用 CHARACTER BASE 锁定角色身份，不得把高信息密度的 CHARACTER SHEET 当作唯一主参考，避免人物漂移。
5. **v0.1.0 根治规则**：@sheet 阶段不再反复写入“身份行 / 站姿矩阵 / 基准图复刻”等会激活模型复刻 @base 的语义。@sheet 只说“参考 @base 的形象”，不把 @base 重新画进 sheet 主体。

从本补丁生效起：

```text
CHARACTER BASE = PRIMARY AI IDENTITY REFERENCE.
CHARACTER SHEET = SECONDARY AUXILIARY PERFORMANCE REFERENCE DERIVED FROM BASE APPEARANCE.
```

根治规则：

```text
SHEET KEEPS A COMPACT BASE TURNAROUND FOR IDENTITY (about 20-25%, not dominating).
SHEET EXPANDS VARIED PERFORMANCE DETAILS (modules 05-11 fill the majority).
SAME IDENTITY ACROSS ALL PANELS, BUT EVERY PANEL A DIFFERENT EXPRESSION / ANGLE / POSE.
MODULE 03 = COMPACT BASE TURNAROUND, NOT A FULL-PAGE TURNAROUND.
```

中文原则：

```text
BASE 是主参考。
SHEET 是辅助参考。
BASE 锁身份。
SHEET 参考 base 的形象，只补表演。
```

---

### 一、最高原则

```text
CHARACTER BASE PRIORITY IS HIGHEST.
```

任何角色图像生产、关键帧、I2V、视频任务、角色一致性引用中，CHARACTER BASE 永远是最高优先级身份参考。

CHARACTER BASE 不改名，不降级，不扩展成复杂多宫格。

CHARACTER BASE 的用途是：

```text
lock face identity
lock body proportion
lock bone structure
lock height impression
lock hairstyle identity
lock base costume silhouette
lock visual identity continuity
```

---

### 二、CHARACTER SHEET 的正确定位

CHARACTER SHEET 是在 CHARACTER BASE 生成并确认后，基于已确认 CHARACTER BASE 派生的辅助参考图。

CHARACTER SHEET 不是 CHARACTER BASE。  
CHARACTER SHEET 不得替代 CHARACTER BASE。  
CHARACTER SHEET 不得作为 keyframe / I2V 的唯一主身份参考。  
CHARACTER SHEET 不得重新建立角色身份。

CHARACTER SHEET 必须继承 @base 的形象：

```text
same face
same hairstyle
same body proportion
same age impression
same costume silhouette
same skin realism
same overall visual identity
```

CHARACTER SHEET 的用途是：

```text
supplement expression range
supplement micro-expression range
supplement posture and gesture range
supplement head-angle references
supplement cinematic close-up performance
supplement costume material details
supplement hand action references
help users review character acting usability
```

一句话：

```text
CHARACTER BASE locks who the character is.
CHARACTER SHEET inherits the base appearance and shows how the character can perform.
```

---

### 三、默认角色资产顺序

默认角色资产生产顺序必须更新为：

```text
09 CHARACTER BASE
→ 10 CHARACTER BASE CONFIRMATION GATE
→ 11 CHARACTER SHEET
→ 12 CHARACTER SHEET CONFIRMATION GATE
→ 13 CHARACTER FORM / COSTUME VARIANT ONLY WHEN REQUIRED
→ 14 LOCATION / PROP / VOICE / ASSET REGISTRY
```

规则：

- CHARACTER BASE 未生成，不得进入 CHARACTER SHEET。
- CHARACTER BASE 未确认，不得进入 CHARACTER SHEET。
- CHARACTER SHEET 必须继承 CHARACTER BASE 的形象。
- CHARACTER SHEET 完成后，不得反向修改 CHARACTER BASE。
- 如果 CHARACTER SHEET 与 CHARACTER BASE 长相不一致，以 CHARACTER BASE 为准，SHEET 判失败并重做。
- 后续阶段引用角色身份时，优先引用 CHARACTER BASE；只有需要表情、姿态、手部、近景、服装细节时，才辅助引用 CHARACTER SHEET。

---

### 四、CHARACTER SHEET 进入门禁

进入 CHARACTER SHEET 前必须检查：

```text
CHARACTER SHEET ENTRY GATE

Required:
- CHARACTER BASE generated: yes / no
- CHARACTER BASE image_id exists: yes / no
- CHARACTER BASE user_confirmed: yes / no
- CHARACTER BASE registered in assets/characters.md: yes / no
- CHARACTER BASE node_key registered: yes / no

Can Enter CHARACTER SHEET:
- yes / no
```

任一项为 no：

```text
Can Enter CHARACTER SHEET = no
Return To: CHARACTER BASE / CHARACTER BASE CONFIRMATION GATE
```

---

### 五、CHARACTER SHEET 必须使用 11 MODULES SYSTEM

CHARACTER SHEET 的唯一合法图像形态是：

```text
ONE CHARACTER
ONE IMAGE
MULTI-PANEL CHARACTER PERFORMANCE SHEET
11 MODULES SYSTEM
DERIVED FROM CONFIRMED CHARACTER BASE APPEARANCE
SECONDARY AUXILIARY REFERENCE
```

CHARACTER SHEET 必须包含以下 11 个模块。

#### MODULE 01 — CHARACTER PROFILE

必须包含：

```text
Name
Identity
Age
Gender
Personality Keywords: 3–5
One-Sentence Theme
```

要求：

- 可以作为图内信息区或图外说明区。
- 不得泄露当前剧情不允许提前曝光的隐藏身份。
- 不得反向改变 CHARACTER BASE 已锁定的身份。

#### MODULE 02 — COLOR SYSTEM

必须包含：

```text
6–8 Color Swatches
No Text
```

要求：

- 只展示色块，不写颜色文字。
- 色块必须服务角色气质、身份、权力状态与剧情阶段。
- 不得污染人物主体。

#### MODULE 03 — COMPACT BASE TURNAROUND（紧凑三视图身份继承区）

优先级：

```text
PRIORITY: IDENTITY INHERITANCE / COMPACT TURNAROUND / MUST NOT DOMINATE
```

必须包含：

```text
A compact turnaround inherited from the confirmed @base: front / 3-4 / side / back full-body views, height scale allowed
Same face / bone structure / hairstyle / body proportion / costume silhouette as the confirmed @base
Source tag: confirmed base image_id / asset_id / node_key (written by template overlay layer)
```

版面与面积约束：

```text
Area about 20-25% of total sheet, top-center compact block
Must NOT dominate the sheet
Performance modules 05-11 together must fill the MAJORITY of the sheet
This is a performance sheet that CONTAINS a compact turnaround — NOT a turnaround that contains a few tiny performance panels
```

要求（核心：保留三视图，但禁止整图塌缩成重复站姿）：

- Module 03 允许出现完整三视图 / 四视图转面（front / 3-4 / side / back），用于锁「这是同一个人」的身份基准。
- 但 Module 03 只能是中上方一个**紧凑区块（约 20-25%）**，不得撑满整张图，不得让 05-11 表演模块退化成边角小格。
- 身份一致 ≠ 姿势一致：转面之外的所有表演格（05-11）必须各自呈现**不同的表情 / 角度 / 姿态 / 动作**，绝不允许把转面里的站姿复制到表演格里，绝不允许整张 sheet 看起来像一排重复的全身站姿。
- 若只需核对完整身份基准，可回看独立 `CHARACTER BASE`；但 @sheet 内允许保留这个紧凑转面，方便审阅同一性。

#### MODULE 04 — SILHOUETTE SYSTEM

必须包含：

```text
body silhouette
costume silhouette
```

要求：

- 剪影必须来自同一角色。
- 剪影必须体现角色身形、姿态气质、服装轮廓。
- 不得生成夸张动漫剪影。
- 不得生成与 CHARACTER BASE 不一致的体型。

#### MODULE 05 — CORE EMOTION LIBRARY

必须包含：

```text
Calm
Curious
Nervous
Surprised
Fearful
Sad
Determined
Relaxed
```

要求：

- 必须是同一角色同一张脸。
- 情绪变化必须真实、细腻、可用于真人质感短剧表演。
- 不得做成卡通夸张表情。
- 不得改变年龄、五官、脸型、妆容身份。

#### MODULE 06 — MICRO EXPRESSION LIBRARY

必须包含：

```text
Eye Tension
Subtle Smile
Lip Compression
Micro Fear
Controlled Breathing
```

要求：

- 微表情必须克制、真实、影视表演感。
- 不得变成大幅度夸张表情。
- 必须服务短剧中的压迫、反击、隐忍、情绪失控前兆。

#### MODULE 07 — HEAD STRUCTURE SYSTEM

必须包含：

```text
head angle studies
facial structure consistency
close-up identity checks
camera-angle-ready head references
```

要求：

- 头部结构必须与 CHARACTER BASE 一致。
- 不得改变五官比例。
- 不得改变脸型、年龄感、发际线身份。
- 该模块用于后续近景、仰拍、俯拍关键帧辅助参考。

#### MODULE 08 — POSTURE LIBRARY

必须包含：

```text
Relaxed
Tense
Confident
```

要求：

- 必须是全身或半身姿态。
- 姿态必须符合角色身份与剧情功能。
- 不得引入不相关动作。
- 不得破坏角色体态一致性。

#### MODULE 09 — CINEMATIC CLOSE-UP

必须包含：

```text
Chest-Up Portrait
Strong Emotional Performance
```

要求：

- 必须是真人质感电影近景。
- 必须能体现角色最核心的戏剧能量。
- 眼神、嘴角、呼吸感、皮肤质感必须真实。
- 不得磨皮、塑料感、网红写真感、CG 感。

#### MODULE 10 — COSTUME BREAKDOWN

必须包含：

```text
Hair
Fabric
Accessories
Footwear
```

要求：

- 服装拆解必须继承 CHARACTER BASE 的基础服装逻辑。
- 可以展示局部细节。
- 可以展示鞋、配饰、面料、发型边界。
- 不得把服装拆解变成多角色服装拼贴。
- 不得引入剧情尚未允许的剧透服装，除非用户明确要求。

#### MODULE 11 — HAND ACTION LIBRARY

必须包含：

```text
Relaxed
Tense
Pointing
Gripping
Face Interaction
```

要求：

- 手部动作必须是真人手部结构。
- 不得畸形、多指、融合、断指。
- 手部动作必须服务短剧表演：指责、隐忍、握紧、掩面、触脸、压抑情绪。
- 手部动作可以作为后续关键帧局部辅助参考。

---

### 六、CHARACTER SHEET Prompt Anchor

生成 CHARACTER SHEET 时，英文 prompt 必须包含：

```text
AI-generated photorealistic human vertical micro-drama character performance sheet, secondary auxiliary reference derived from confirmed character base appearance, one character only, same face, same hairstyle, same body proportion, same age impression, same costume silhouette, same skin realism and same overall visual identity as the confirmed character base, clean white or light gray studio background, organized multi-panel 11-module character sheet, realistic human skin texture, cinematic drama performance reference, not the primary identity reference.
```

必须明确 11 个模块：

```text
11 modules: character profile, color system with 6–8 swatches no text, compact base turnaround inheriting front / 3-4 / side / back full-body views from the confirmed base (about 20-25% area, top-center, must not dominate), body and costume silhouette system, core emotion library calm curious nervous surprised fearful sad determined relaxed, micro expression library eye tension subtle smile lip compression micro fear controlled breathing, head structure system for camera-angle-ready close-ups, posture library relaxed tense confident, cinematic chest-up close-up strong emotional performance, costume breakdown hair fabric accessories footwear, hand action library relaxed tense pointing gripping face interaction.
```

必须强调：

```text
Independent CHARACTER BASE remains the highest-priority primary AI identity reference. This CHARACTER SHEET keeps a compact base turnaround for identity reference and expands expression, posture, head-angle, costume-detail, close-up performance and hand-action references. Same identity across all panels (same face, bone structure, hairstyle, body proportion, costume) but each performance panel must show a DIFFERENT expression, angle, pose or action — never repeat the same standing pose, and the whole sheet must not collapse into one repeated full-body turnaround.
```

---

### 七、CHARACTER SHEET Negative Anchor

生成 CHARACTER SHEET 时，必须禁止：

```text
replacing the character base,
used as primary identity reference,
reconstructing the character identity,
creating a second character base,
different person across panels,
changed face,
changed age,
changed body proportion,
changed hairstyle identity,
changed costume silhouette,
anime,
cartoon,
CGI,
game character sheet,
plastic skin,
beauty filter,
scene background,
multiple characters,
random fashion collage,
unreadable layout,
missing 11 modules,
missing expression library,
missing micro-expression library,
missing head structure,
missing posture library,
missing cinematic close-up,
missing costume breakdown,
missing hand action library,
base turnaround dominating or filling the whole sheet,
sheet being only a full-body turnaround with no real performance panels,
every panel showing the same repeated standing pose,
performance modules collapsed into identical full-body figures,
sheet becoming a copied character base,
spoiler costume unless explicitly allowed.
```

---

### 八、下游引用优先级

所有 keyframe / I2V / video task 的角色引用必须遵循：

```text
CHARACTER REFERENCE PRIORITY

Priority 1: CHARACTER BASE
- primary identity reference
- face / body / age / height impression / hair / base costume silhouette
- mandatory for all character keyframes and I2V tasks

Priority 2: CHARACTER SHEET
- secondary auxiliary reference
- expression / micro-expression / head angle / posture / close-up / costume detail / hand action
- optional, only used when the shot needs these details
```

禁止：

```text
Using CHARACTER SHEET alone as the only character reference.
Using CHARACTER SHEET to override CHARACTER BASE.
Using expression / costume panels from CHARACTER SHEET to change face identity.
```

正确：

```text
Use CHARACTER BASE to lock identity.
Use CHARACTER SHEET to select performance details.
```

---

### 九、CHARACTER SHEET 完成门禁

CHARACTER SHEET 阶段完成前必须检查：

```text
CHARACTER SHEET 11-MODULE GATE

CHAR_ID:
Character Name:

Source CHARACTER BASE:
- Base Image ID:
- Base Confirmed: yes / no
- Base Priority Preserved: yes / no

Required Modules:
- MODULE 01 CHARACTER PROFILE: yes / no
- MODULE 02 COLOR SYSTEM: yes / no
- MODULE 03 COMPACT BASE TURNAROUND: yes / no
- MODULE 04 SILHOUETTE SYSTEM: yes / no
- MODULE 05 CORE EMOTION LIBRARY: yes / no
- MODULE 06 MICRO EXPRESSION LIBRARY: yes / no
- MODULE 07 HEAD STRUCTURE SYSTEM: yes / no
- MODULE 08 POSTURE LIBRARY: yes / no
- MODULE 09 CINEMATIC CLOSE-UP: yes / no
- MODULE 10 COSTUME BREAKDOWN: yes / no
- MODULE 11 HAND ACTION LIBRARY: yes / no

MODULE 03 Check (compact base turnaround):
- Confirmed CHARACTER BASE reference ID exists: yes / no
- Base image_id / asset_id / node_key exists: yes / no
- Compact turnaround (front / 3-4 / side / back) present and matches confirmed base identity: yes / no
- Turnaround area about 20-25% of sheet, NOT dominating: yes / no
- Performance modules 05-11 together fill the majority of the sheet: yes / no

Anti-Repeat Check:
- Each performance panel shows a DIFFERENT expression / angle / pose / action: yes / no
- Sheet is NOT one repeated full-body standing pose: yes / no

Identity Consistency With CHARACTER BASE:
- Same Face: yes / no
- Same Body Proportion: yes / no
- Same Age Impression: yes / no
- Same Hair Identity: yes / no
- Same Costume Silhouette: yes / no
- Same Skin Realism: yes / no

Can Mark CHARACTER SHEET Completed:
- yes / no
```

只要任一核心模块缺失：

```text
Can Mark CHARACTER SHEET Completed = no
```

---

### 十、资产登记更新

`assets/characters.md` 中必须同时登记 CHARACTER BASE 与 CHARACTER SHEET，但二者优先级不同。

```md
## CHAR_001 {角色名}

### CHARACTER BASE

- Reference Priority: 1 / PRIMARY
- Function: AI identity lock
- Image Type: white-background three-view full-body identity base
- Generated Image Exists:
- Generated Image ID:
- User Confirmed:
- Base Confirmation Status:

### CHARACTER SHEET

- Reference Priority: 2 / SECONDARY AUXILIARY
- Function: expression / posture / head angle / close-up / costume detail / hand action support
- Derived From CHARACTER BASE Appearance:
- Generated Image Exists:
- Generated Image ID:
- User Confirmed:
- Character Sheet Status:

### CHARACTER SHEET Included Modules

- MODULE 01 — CHARACTER PROFILE:
- MODULE 02 — COLOR SYSTEM:
- MODULE 03 — COMPACT BASE TURNAROUND:
- MODULE 04 — SILHOUETTE SYSTEM:
- MODULE 05 — CORE EMOTION LIBRARY:
- MODULE 06 — MICRO EXPRESSION LIBRARY:
- MODULE 07 — HEAD STRUCTURE SYSTEM:
- MODULE 08 — POSTURE LIBRARY:
- MODULE 09 — CINEMATIC CLOSE-UP:
- MODULE 10 — COSTUME BREAKDOWN:
- MODULE 11 — HAND ACTION LIBRARY:

### Downstream Reference Rules

- Identity Reference Source: CHARACTER BASE
- Expression Reference Source: CHARACTER SHEET MODULE 05 / MODULE 06
- Head Angle Reference Source: CHARACTER SHEET MODULE 07
- Body Pose Reference Source: CHARACTER SHEET MODULE 08
- Close-Up Reference Source: CHARACTER SHEET MODULE 09
- Costume Detail Reference Source: CHARACTER SHEET MODULE 10
- Hand Action Reference Source: CHARACTER SHEET MODULE 11
- I2V Rule: CHARACTER BASE must always be included when this character appears.
- I2V Rule: CHARACTER SHEET must never be used alone as the only identity reference.
```

---

### 十一、失败判定

出现以下任一情况，判定失败：

- 把 CHARACTER BASE 改成 11 模块多宫格。
- 把 CHARACTER SHEET 当作 CHARACTER BASE。
- 生成 CHARACTER SHEET 前没有确认 CHARACTER BASE。
- 用户要求 character sheet，系统只生成了一张纯 base 三视图、完全没有表演模块。
- CHARACTER SHEET 与 CHARACTER BASE 长得不像。
- CHARACTER SHEET 缺少 11 模块任一核心模块。
- CHARACTER SHEET 的 MODULE 03 缺少 confirmed base reference ID / image_id / asset_id / node_key。
- CHARACTER SHEET 的 MODULE 03 转面区撑满 / 独占整张图，挤掉表情 / 微表情 / 头部 / 姿态 / 近景 / 服装 / 手部模块。
- 整张 CHARACTER SHEET 塌缩成一排重复的全身站姿，表演模块全是同一个姿势。
- keyframe / I2V 只引用 CHARACTER SHEET，没有引用 CHARACTER BASE。
- CHARACTER SHEET 反向覆盖或修改 CHARACTER BASE 的身份。
- 角色在不同模块中变成不同人。

---

### 十二、补丁口诀

BASE 是主参考。  
SHEET 是辅助参考。  
BASE 锁身份。  
SHEET 参考 base 的形象。  
SHEET 补表演。  
SHEET 不重建身份。  
视频优先喂 BASE。  
需要表情、姿态、头部、近景、服装细节、手部动作时，再参考 SHEET。  
SHEET 不得单独喂 I2V。  
SHEET 不得替代 BASE。  
用户说 character sheet，不许再生成纯 base 身份参考图。  
用户说 base，不许生成 11 模块多宫格。
