## 0.1S PATCH：KEYFRAME REFERENCE INPUT MANIFEST & NO SELF-INVENTED VISUAL ASSET LOCK

### 关键帧生图引用输入清单与禁止自造视觉资产锁

【补丁目的】

修复关键帧 / 视频生成阶段不实际引用已确认 `CHARACTER BASE`、`LOCATION`、`PROP`、`COSTUME / FORM` 图片资产，而是仅凭文字 prompt 自行重新生成角色和场景，导致人物脸、身材、发型、服装、空间结构、关键道具完全不一致的问题。

从本补丁生效起，任何 `SHOT_KEYFRAME`、`KEYFRAME IMAGE GENERATION`、`VIDEO_GENERATION_TASK`、`I2V VIDEO` 阶段，必须显式消耗已确认视觉资产引用输入。

核心原则：

```text
NO CONFIRMED REFERENCE IMAGE INPUT, NO KEYFRAME GENERATION.
NO CONFIRMED REFERENCE IMAGE INPUT, NO I2V GENERATION.
REFERENCE ID IS NOT ENOUGH.
TEXT DESCRIPTION IS NOT REFERENCE.
PROMPT CANNOT REPLACE CONFIRMED ASSET IMAGE.
```

中文原则：

```text
先引用，再生图。
CHAR_ID 不是图。
LOC_ID 不是图。
PROP_ID 不是图。
文字描述不是图。
Base 不进工具，人物必漂。
Location 不进工具，场景必跳。
Sheet 只能辅助，不能单独锁脸。
World 图锁风格，不锁具体场景。
没有 reference input，就没有 keyframe。
```

---

### 一、最高原则

每一张关键帧生成前，必须先输出并通过：

```text
KEYFRAME REFERENCE INPUT MANIFEST
```

该 Manifest 必须列出本关键帧所有实际传入图像生成工具的参考资产。

只写 `CHAR_001`、`LOC_001`、`PROP_001` 不算合法引用。  
只在 prompt 文字中描述角色外貌 / 场景风格 / 道具样式，不算合法引用。  
必须包含可被图像生成工具实际使用的 `image_id / asset_id / file / url / node_key`。

如果工具或运行环境暂时无法实际附带参考图，只能输出 `BLOCKED / PREVIEW_ONLY`，不得声称已经生成合法 keyframe。

---

### 二、KEYFRAME REFERENCE INPUT MANIFEST 模板

每个 `SHOT_KEYFRAME` 必须新增：

```text
KEYFRAME REFERENCE INPUT MANIFEST

Keyframe ID:
Linked MICRO_SHOT_UNIT:
Generation Target:
- image / keyframe

Required Character References:
- Character ID:
- Character Name:
- Appears In Frame: yes / no
- Required Base Reference: yes
- CHARACTER BASE asset_id:
- CHARACTER BASE image_id:
- CHARACTER BASE file / url:
- CHARACTER BASE node_key:
- Base Confirmation Status: CONFIRMED / MISSING / UNCONFIRMED
- Must Attach To Image Generation: yes
- Reference Role: PRIMARY_IDENTITY_REFERENCE

Optional Character Sheet Reference:
- CHARACTER SHEET asset_id:
- CHARACTER SHEET image_id:
- CHARACTER SHEET node_key:
- Usage Allowed:
  - expression
  - micro-expression
  - hand action
  - head angle
  - costume detail
  - close-up support
- Reference Role: SECONDARY_AUXILIARY_ONLY
- Can Be Used Alone: no

Required Costume / Form References:
- Costume / Form ID:
- Costume asset_id:
- Costume image_id:
- Costume node_key:
- Valid Episode Range:
- Derived From CHARACTER BASE: yes / no
- Must Attach If Costume Differs From Base: yes / no

Required Location References:
- Location ID:
- Location Name:
- LOCATION asset_id:
- LOCATION image_id:
- LOCATION file / url:
- LOCATION node_key:
- Location Confirmation Status: CONFIRMED / MISSING / UNCONFIRMED
- Must Attach To Image Generation: yes
- Reference Role: PRIMARY_ENVIRONMENT_REFERENCE

Required Prop References:
- Prop ID:
- Prop Name:
- PROP asset_id:
- PROP image_id:
- PROP node_key:
- Required In Frame: yes / no
- Must Attach If Story-Critical: yes / no

World Visual Reference:
- WORLD_VISUAL_BIBLE image_id:
- WORLD_VISUAL_MODULES node_key:
- Usage: style / lighting / color / material inheritance only
- Can Replace Location Reference: no

Final Reference Input Check:
- All visible characters have confirmed BASE image attached: yes / no
- All visible costume / form variants have confirmed image attached when different from base: yes / no
- All story-critical locations have confirmed LOCATION image attached: yes / no
- All story-critical props have confirmed PROP image attached: yes / no
- No character generated from text only: yes / no
- No location generated from text only: yes / no
- No prop generated from text only when story-critical: yes / no
- No unregistered visual asset invented: yes / no
- Can Generate Keyframe: yes / no
```

---

### 三、角色引用硬规则

任何角色只要出现在关键帧画面中，必须满足：

```text
CHARACTER BASE image_id exists
CHARACTER BASE asset_id exists
CHARACTER BASE user_confirmed = yes
CHARACTER BASE node_key registered
CHARACTER BASE attached as image reference input
```

禁止：

```text
只写角色名字
只写 CHAR_ID
只写外貌描述
只引用 CHARACTER SHEET
只引用剧情中的文字设定
让模型根据 prompt 重新想象角色
```

合法：

```text
CHAR_001 appears in frame
→ attach CHAR_001_BASE_IMAGE_ID as PRIMARY_IDENTITY_REFERENCE
→ optional attach CHAR_001_SHEET_IMAGE_ID as SECONDARY_AUXILIARY_REFERENCE
```

如果角色只有局部出现，例如手、背影、肩膀、鞋子、侧脸、半张脸，也必须继承当前角色的 confirmed base / costume / form，不得生成随机身体局部。

多角色同框时，每个可见角色都必须分别附带对应 `CHARACTER BASE image_id`，不得只附带主角 Base。

---

### 四、Character Sheet 使用边界

`CHARACTER SHEET` 只能作为辅助参考，不能替代 `CHARACTER BASE`。

允许使用 sheet 的情况：

```text
expression
micro-expression
hand action
head angle
cinematic close-up performance
costume detail support
```

强制规则：

```text
If CHARACTER SHEET is attached:
CHARACTER BASE must also be attached.
```

禁止：

```text
sheet-only keyframe
sheet-only I2V
sheet-only character identity lock
```

如果 sheet 与 base 发生冲突：

```text
BASE wins.
SHEET is treated as failed auxiliary reference.
```

---

### 五、场景引用硬规则

任何 `MICRO_SHOT_UNIT` 已指定 `Location ID` 时，关键帧必须引用该 LOCATION 的 confirmed image asset。

```text
MSU_003 Location ID = LOC_001
→ KF_003 must attach LOC_001_IMAGE_ID
```

禁止：

```text
同一 LOC_ID 每次重新生成不同场景
只写 luxury living room / hospital corridor / rainy street
只从 WORLD_VISUAL_BIBLE 猜场景
把 WORLD_VISUAL_BIBLE 当作具体 LOCATION 图
```

规则：

```text
WORLD_VISUAL_BIBLE = style constitution
LOCATION ASSET = concrete scene reference
```

`WORLD_VISUAL_BIBLE` 只能提供光色、材质、气质、世界风格，不得替代具体场景图。

如果当前剧情发生在未登记地点：

```text
Can Generate Keyframe = no
Return To: LOCATION ASSET REGISTRY / LOCATION IMAGE GENERATION
```

---

### 六、道具引用硬规则

凡是承担以下功能的 PROP，必须有 confirmed prop image reference：

```text
evidence
contract
phone
ring
medicine
document
weapon
blood-stained object
identity token
story trigger
cliffhanger object
```

如果该道具在关键帧中可见，必须附带：

```text
PROP asset_id
PROP image_id
PROP node_key
Must Attach To Image Generation: yes
```

没有 confirmed PROP 图时，不得让模型自行生成关键道具。

普通一次性非剧情关键物件可以不登记为 PROP，但不得在后续被当作证据、反转物、悬念物或复用资产。

---

### 七、服装 / 形态引用硬规则

如果角色当前镜头服装与 `CHARACTER BASE` 中的基础服装不同，必须存在 confirmed `COSTUME / FORM` asset。

```text
If Current Costume != Base Costume:
→ attach COSTUME / FORM image_id
→ attach CHARACTER BASE image_id
```

禁止：

```text
根据文字 prompt 临时换衣服
让模型自行理解觉醒期 / 贫困期 / 婚礼期 / 医生身份 / 总裁身份造型
没有 confirmed costume image 就进入关键帧
```

如果剧情需要新身份、新造型、新阶段：

```text
Can Generate Keyframe = no
Return To: CHARACTER FORM / COSTUME VARIANT ASSET
```

---

### 八、Prompt 编译规则

每个关键帧 prompt 前必须先完成：

```text
REFERENCE-FIRST COMPILATION
```

顺序固定：

```text
1. Read MICRO_SHOT_UNIT
2. Extract Character IDs / Location ID / Prop IDs / Costume IDs
3. Retrieve confirmed asset image_ids from assets/asset_registry.md
4. Build KEYFRAME REFERENCE INPUT MANIFEST
5. Validate all required image references
6. Only then write Image Prompt
7. Image Prompt must explicitly say identity follows attached CHARACTER BASE reference
8. Image Prompt must explicitly say environment follows attached LOCATION reference
9. Image Prompt must explicitly say story-critical props follow attached PROP references
10. Image Prompt must not introduce unregistered characters, locations, props, costumes, or spoiler forms
```

禁止 prompt 先行、资产后补。

---

### 九、关键帧生图工具调用卡

每次真正调用图像生成工具前，必须输出：

```text
IMAGE GENERATION TOOL CALL CARD

Keyframe ID:
Tool Call Purpose: SHOT_KEYFRAME_IMAGE_GENERATION

Attached Reference Images:
- PRIMARY_CHARACTER_BASE:
  - CHAR_ID:
  - image_id:
  - asset_id:
  - node_key:
- SECONDARY_CHARACTER_SHEET:
  - CHAR_ID:
  - image_id:
  - usage:
- PRIMARY_LOCATION:
  - LOC_ID:
  - image_id:
  - asset_id:
  - node_key:
- REQUIRED_PROP:
  - PROP_ID:
  - image_id:
  - asset_id:
  - node_key:
- REQUIRED_COSTUME_OR_FORM:
  - COSTUME_ID / FORM_ID:
  - image_id:
  - asset_id:
  - node_key:
- WORLD_STYLE_REFERENCE:
  - WORLD_ID:
  - image_id:

Missing Required References:
- none / list

Can Call Image Tool:
- yes / no
```

如果 `Missing Required References` 非空：

```text
Can Call Image Tool = no
```

必须停止并回到对应资产补全阶段。

---

### 十、VIDEO_GENERATION_TASK / I2V 引用继承规则

视频任务不得只继承 keyframe 文字 prompt，必须继承 keyframe 的 confirmed reference input。

每个 `VIDEO_GENERATION_TASK` 必须新增：

```text
VIDEO REFERENCE INPUT MANIFEST

Video Task ID:
Source Keyframes:
Source KEYFRAME REFERENCE INPUT MANIFEST IDs:

Required Reference Images:
- CHARACTER BASE image_ids:
- CHARACTER SHEET image_ids if used:
- LOCATION image_ids:
- PROP image_ids:
- COSTUME / FORM image_ids:
- WORLD_VISUAL_BIBLE image_id:

Reference Continuity Check:
- Same character base as source keyframes: yes / no
- Same location as source keyframes: yes / no
- Same prop assets as source keyframes: yes / no
- Same costume / form assets as source keyframes: yes / no
- No text-only regeneration: yes / no
- Can Call I2V Tool: yes / no
```

禁止：

```text
关键帧引用了 Base，但视频任务不引用 Base
关键帧引用了 Location，但 I2V 只写文字场景
I2V prompt 重新描述人物导致换脸
I2V prompt 重新描述场景导致空间漂移
```

---

### 十一、关键帧生成后验收

每张关键帧生成后，必须输出：

```text
KEYFRAME ASSET CONSISTENCY CHECK

Keyframe ID:
Generated Image ID:

Character Consistency:
- Compared Against CHARACTER BASE image_id:
- Same Face:
- Same Body Proportion:
- Same Age Impression:
- Same Hair Identity:
- Same Costume Silhouette:
- Pass Character Consistency: yes / no

Location Consistency:
- Compared Against LOCATION image_id:
- Same Spatial Structure:
- Same Color / Lighting Family:
- Same Material Language:
- Same Power Meaning:
- Pass Location Consistency: yes / no

Prop Consistency:
- Compared Against PROP image_id:
- Same Object Identity:
- Same Narrative Readability:
- Pass Prop Consistency: yes / no

Costume / Form Consistency:
- Compared Against COSTUME / FORM image_id if used:
- Same Costume Identity:
- Same Stage / Form Identity:
- Pass Costume / Form Consistency: yes / no

Can Register Keyframe:
- yes / no
```

任一核心一致性为 no：

```text
Can Register Keyframe = no
Regenerate Required = yes
```

---

### 十二、同类漏洞全局巡检规则

每次进入 `SHOT_KEYFRAME`、`VIDEO_GENERATION_TASK`、`I2V VIDEO` 前，必须执行：

```text
NO WASTED ASSET AUDIT

Check 1: Are there confirmed assets already generated for this character / location / prop / costume?
Check 2: Is the current task trying to recreate an asset that already exists?
Check 3: Is any existing confirmed asset missing from reference input?
Check 4: Is the prompt relying on text where a confirmed image asset exists?
Check 5: Is the model being asked to invent a new face, scene, prop, or costume without registry approval?
Check 6: Would this generation waste or bypass previously confirmed assets?

If any answer indicates bypass:
- Stop generation
- Rebuild REFERENCE INPUT MANIFEST
- Attach existing confirmed assets
- Do not regenerate from scratch
```

该巡检优先级高于速度、流畅感、批量生产便利性和 agent 自主补全。

---

### 十三、失败判定

出现以下任一情况，关键帧 / 视频任务失败：

- 画面中出现角色，但没有附带该角色 confirmed `CHARACTER BASE image_id`。
- 只用 `CHARACTER SHEET` 生成关键帧或 I2V，没有附带 `CHARACTER BASE`。
- 只写角色文字描述，没有实际 reference image input。
- 画面中出现已登记地点，但没有附带 confirmed `LOCATION image_id`。
- 同一 `LOC_ID` 在不同关键帧中未引用同一个 location asset。
- `WORLD_VISUAL_BIBLE` 被当作具体场景图使用。
- 关键道具承担剧情功能，但没有附带 `PROP image_id`。
- 当前服装 / 形态不同于 Base，但没有附带 confirmed `COSTUME / FORM image_id`。
- 关键帧 prompt 新增未登记角色、未登记场景、未登记道具、未登记服装或剧透形态。
- 视频任务没有继承对应关键帧的 reference input。
- 关键帧生成后人物脸、身材、发型、基础服装轮廓与 Base 不一致。
- 关键帧生成后场景结构与 Location asset 不一致。
- agent 以“根据描述重新生成”为理由跳过 reference input。

---

### 十四、补丁口诀

先引用，再生图。  
CHAR_ID 不是图。  
LOC_ID 不是图。  
文字描述不是图。  
Base 不进工具，人物必漂。  
Location 不进工具，场景必跳。  
Sheet 只能辅助，不能单独锁脸。  
World 图锁风格，不锁具体场景。  
关键帧不是重新创作，是消耗已确认资产。  
视频任务不是重新描述，是继承关键帧引用输入。  
没有 reference input，就没有 keyframe。  
不要浪费已经确认过的资产。
