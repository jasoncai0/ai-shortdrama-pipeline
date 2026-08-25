## 0.1F PATCH：GENERATED IMAGE REQUIRED GATE LOCK

### 生成图片结果强制门禁锁

【补丁目的】

修复以下问题：

1. 系统输出了视觉方向、九宫格说明、生图 prompt，但没有实际生成图片，却继续进入下一阶段。
2. 系统把“图像任务”误当成“图像结果”。
3. 系统把“用户确认文字方向”误当成“用户确认已生成图片”。
4. WORLD_VISUAL_BIBLE / CHARACTER IDENTITY BASE 等视觉阶段没有图像结果，仍进入 WORLD LOCK GATE / BASE CONFIRMATION GATE。
5. 后续角色、地点、分镜、关键帧在没有视觉真相源的情况下继续生产。

从本补丁生效起，任何要求直接生图确认的阶段，必须满足：

```text
GENERATED_IMAGE_EXISTS = yes
```

否则当前阶段不得完成。

---

### 一、最高原则

```text
NO GENERATED IMAGE, NO NEXT STAGE.
```

含义：

- 没有生成图片，不准进入下一步。
- 没有生成图片，不准写 completed。
- 没有生成图片，不准进入 lock gate。
- 没有生成图片，不准让用户确认“通过”。
- 没有生成图片，不准把 prompt 当成资产。
- 没有生成图片，不准写入 PROJECT ASSET REGISTRY 的 confirmed asset。

---

### 二、图像阶段完成条件

以下阶段必须有实际生成图片：

```text
WORLD_VISUAL_BIBLE
CHARACTER IDENTITY BASE
CHARACTER FORM / COSTUME
CHARACTER SHEET
LOCATION ASSET
PROP ASSET
COSTUME ASSET
SHOT KEYFRAME
```

其中最关键的上游强制阶段：

```text
FIRST_VISUAL_STYLE_BOARD / WORLD_VISUAL_BIBLE
CHARACTER_IDENTITY_BASE / WHITE-BACKGROUND THREE-VIEW BASE
```

必须严格执行：

```text
Generated Image Required: yes
```

---

### 三、WORLD_VISUAL_BIBLE 图像门禁

WORLD_VISUAL_BIBLE 阶段只有在以下全部条件满足时，才算完成：

```text
VISUAL DIRECTION RESULT: completed
WORLD_VISUAL_BIBLE IMAGE TASK: completed
WORLD_VISUAL_BIBLE GENERATED IMAGE: exists
WORLD_VISUAL_MODULES: extracted from generated image
User reviewed generated image: yes
```

如果没有实际生成图像：

```text
WORLD_VISUAL_BIBLE Status: not completed
World Lock Status: blocked
Next Allowed Stage: WORLD_VISUAL_BIBLE image generation retry
```

禁止进入：

```text
WORLD LOCK GATE
CHARACTER IDENTITY BASE
LOCATION ASSET
PROP ASSET
EPISODE SCRIPT DRAFT after visual production
SHOT KEYFRAME
I2V VIDEO
```

---

### 四、CHARACTER IDENTITY BASE 图像门禁

CHARACTER IDENTITY BASE 阶段只有在以下全部条件满足时，才算完成：

```text
CHARACTER BASE IMAGE TASK: completed
CHARACTER BASE GENERATED IMAGE: exists
Image Type Check: passed
- one image
- same character
- front full-body view
- side full-body view
- back full-body view
- same face / body / costume across views
- white or light gray background
- no text
- no labels
- no information panel
- no detail collage
User reviewed generated image: yes
```

如果没有实际生成白底三视图全身图：

```text
CHARACTER IDENTITY BASE Status: not completed
BASE CONFIRMATION GATE: blocked
Next Allowed Stage: CHARACTER IDENTITY BASE image generation retry
```

禁止进入：

```text
BASE CONFIRMATION GATE
CHARACTER FORM / COSTUME / SHEET
LOCATION / PROP / VOICE / ASSET REGISTRY
SHOT KEYFRAME
I2V VIDEO
```

---

### 五、Prompt 不等于图片

系统必须明确区分：

```text
Prompt = image generation instruction
Generated Image = visual asset
```

以下内容都不能替代图片：

```text
视觉方向说明
九宫格文字表
色彩系统
光影系统
材质系统
英文 prompt
Image Task
Asset Plan
用户说“方向可以”
```

只有实际生成的图片可以作为：

```text
WORLD_VISUAL_BIBLE generated image
CHARACTER @base generated image
LOCATION generated image
PROP generated image
SHOT KEYFRAME generated image
```

---

### 六、阶段状态字段新增

所有图像阶段必须新增：

```text
IMAGE GENERATION STATUS

Image Required:
Generated Image Exists:
Generated Image ID:
Generated Image URL / File:
Image Type Check:
User Reviewed Image:
User Confirmed Image:
Can Enter Next Stage:
```

判定规则：

```text
If Generated Image Exists = no:
Can Enter Next Stage = no
```

---

### 七、失败判定

出现以下任一情况，判定阶段失败：

```text
只输出 prompt，没有生成图
只输出 Image Task，没有生成图
只输出视觉方向，没有生成图
生成工具可用但没有调用
生成失败后仍进入下一阶段
图片未展示给用户却写 confirmed
用户只确认文字方向，系统当成确认图片
没有图像 ID / 文件 / 可审阅结果
```

---

### 八、失败后处理

如果缺少生成图片，必须回滚当前阶段：

```text
Current Stage: [CURRENT IMAGE STAGE] RETRY
Completed Stage: not completed
Next Allowed Stage: [CURRENT IMAGE STAGE] image generation retry

Blocked Stages:
- all downstream stages
```

例如 WORLD 阶段失败：

```text
Current Stage: WORLD_VISUAL_BIBLE RETRY
Completed Stage: not completed
Next Allowed Stage: WORLD_VISUAL_BIBLE image generation retry

Blocked Stages:
- WORLD LOCK GATE
- CHARACTER IDENTITY BASE
- CHARACTER FORM / COSTUME / SHEET
- LOCATION / PROP / VOICE / ASSET REGISTRY
- EPISODE SCRIPT DRAFT
- SHOT KEYFRAME
- I2V VIDEO
```

例如 CHARACTER BASE 阶段失败：

```text
Current Stage: CHARACTER IDENTITY BASE RETRY
Completed Stage: not completed
Next Allowed Stage: CHARACTER IDENTITY BASE image generation retry

Blocked Stages:
- BASE CONFIRMATION GATE
- CHARACTER FORM / COSTUME / SHEET
- LOCATION / PROP / VOICE / ASSET REGISTRY
- SHOT KEYFRAME
- I2V VIDEO
```

---

### 九、用户确认规则

用户说：

```text
OK
可以
确认
继续
下一步
```

只有在已经生成图片并展示给用户后，才可解释为确认图片。

如果没有图片，用户的确认只能理解为：

```text
确认文字方向
```

不能理解为：

```text
确认视觉资产
```

系统必须返回：

```text
当前阶段尚未生成图片，不能进入下一步。
Next Allowed Stage: 当前图像生成阶段 retry
```

---

### 十、补丁口诀

没有图，不算完成。  
没有图，不进下一步。  
Prompt 不是图。  
方向不是图。  
任务不是图。  
用户确认文字，不等于确认图片。  
WORLD 没图，不锁世界。  
BASE 没图，不锁角色。  
所有视觉资产，必须先生成、再确认、再推进。

---
