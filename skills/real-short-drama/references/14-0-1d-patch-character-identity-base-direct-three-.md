## 0.1D PATCH：CHARACTER IDENTITY BASE DIRECT THREE-VIEW FULL-BODY RESULT LOCK

### 角色基础身份图直接白底三视图全身结果锁

【补丁目的】

修复以下问题：

1. CHARACTER IDENTITY BASE 阶段被错误执行成角色资料卡、角色设定表、reference sheet、多视图信息板、情绪拼版或半身肖像。
2. 系统为了“看起来专业”提前生成 @sheet，导致跳过可直接用于后续关键帧 / I2V 参考的基础身份图。
3. 第一张角色图如果只有正面，后续生成侧面、背面、转身、入场、离场、关键帧生成时容易漂移。
4. 未确认基础脸、骨相、身材比例、正侧背轮廓，就进入服装、形态、表情、关键帧或 I2V。
5. prompt 中使用 reference sheet / character sheet / dossier 等词，诱导图像模型生成资料卡、文字信息栏或拼版设定表。

从本补丁生效起，CHARACTER IDENTITY BASE 阶段的唯一合法图像结果是：

```text
ONE CHARACTER
ONE IMAGE
THREE FULL-BODY VIEWS
FRONT VIEW + SIDE VIEW + BACK VIEW
SAME FACE / SAME BODY PROPORTION / SAME COSTUME
WHITE OR LIGHT GRAY BACKGROUND
NEUTRAL STANDING POSE
NO TEXT
NO LABELS
NO INFO PANEL
NO DETAIL COLLAGE
NO CHARACTER SHEET
```

注意：

```text
THREE-VIEW BASE ≠ character sheet
THREE-VIEW BASE ≠ reference sheet
THREE-VIEW BASE ≠ profile card
```

它是一张干净的 AI 角色一致性基准图，用于后续：

- SHOT KEYFRAME / BATCH KEYFRAME 生成
- img2img 角色继承
- I2V 角色一致性
- 正面 / 侧面 / 背面镜头稳定
- 服装形态派生
- @sheet 后续审阅板派生

---

### 一、合法输出定义

CHARACTER IDENTITY BASE 必须直接生成一张角色白底三视图全身基准图。

合法要求：

- 一张图
- 同一个角色
- 三个全身视图：正面 / 侧面 / 背面
- 三个视图必须是同一张脸、同一骨相、同一年龄感、同一身材比例
- 三个视图必须穿同一套当前剧情合法基础服装
- 中性站姿
- 白底或浅灰底
- 脸部清晰
- 发型清晰
- 身材比例清晰
- 服装从头到脚完整可见
- 正面、侧面、背面轮廓都清楚
- 基础身份气质清晰
- 无复杂背景
- 无场景空间
- 无文字
- 无中文 / 英文标签
- 无 FRONT / SIDE / BACK / 正面 / 侧面 / 背面 标注
- 无姓名、身份、年龄、身高、trait 等任何文字
- 无边框信息栏
- 无角色说明文字
- 无表情宫格
- 无局部特写
- 无道具细节拼贴
- 无角色资料卡排版

该图只负责锁定：

```text
face
age impression
bone structure
body proportion
hair identity
front silhouette
side silhouette
back silhouette
costume full-body silhouette
skin realism
default emotional baseline
current base identity
```

不负责展示：

- 多套服装
- 多个身份阶段
- 角色成长弧
- 表情集合
- 局部细节板
- 场景氛围
- 道具动作
- 后期剧透形态

---

### 二、禁止输出类型

CHARACTER IDENTITY BASE 阶段严禁生成：

- character reference sheet with text
- character design sheet with panels
- character card
- dossier
- profile board
- mood board
- expression sheet
- costume sheet
- full production board
- portrait collage
- close-up detail board
- 带姓名、身份、文字说明的信息卡
- 带多个局部小图的角色设定板
- 半身肖像图
- 古风写真图
- 场景氛围图
- 人物 + 背景叙事图
- 人物局部细节图
- 多套服装同屏
- 多阶段身份同屏

允许：

```text
clean three-view full-body base
front / side / back views only
```

禁止：

```text
three-view sheet with text labels / info cards / detail panels
```

任何“看起来更完整”的角色卡，只要包含文字信息栏、局部拼贴、表情宫格、场景背景或多形态，都判定失败。

---

### 三、Prompt 禁词锁

CHARACTER IDENTITY BASE 生图 prompt 中禁止使用：

```text
reference sheet
character sheet
design sheet
profile card
dossier
layout
panel
grid
expression sheet
detail shots
information board
typography
labels
character board
production board
bio card
data card
```

必须使用：

```text
full-body character identity base
three full-body views
front view, side view, back view
same character identity
same face
same body proportions
same costume
clean white background
neutral standing pose
no text
no labels
no information panel
no detail panels
no collage
```

---

### 四、标准输出模板

每次进入 CHARACTER IDENTITY BASE 阶段，必须使用以下模板：

```text
CHARACTER IDENTITY BASE

Character ID:
Character Name:
Narrative Role:
Current Stage:

Base Identity Purpose:
- lock face
- lock age impression
- lock bone structure
- lock body proportion
- lock front silhouette
- lock side silhouette
- lock back silhouette
- lock hair identity
- lock skin realism
- lock default emotional baseline

Allowed Image Type:
- one single image
- three full-body views in one canvas
- front view / side view / back view
- same character, same costume, same body proportion
- neutral standing pose
- white or light gray background
- no text
- no labels
- no information panel
- no detail panels
- no collage
- no character sheet

Current Episode Legal Identity:
Forbidden Spoiler Forms:
World Visual Inheritance:

Image Generation Task:

IMAGE GENERATION STATUS
- Image Required: yes
- Generated Image Exists:
- Generated Image ID:
- Generated Image URL / File:
- Image Type Check:
- User Reviewed Image:
- User Confirmed Image:
- Can Enter Next Stage:

Generated Base Asset:
- base_asset_id:
- base_image_url:
- confirmed_status: pending user confirmation
```

---

### 五、图像类型检查

生成后必须执行：

```text
THREE-VIEW BASE IMAGE TYPE CHECK

Is One Image: yes / no
Contains Front Full-Body View: yes / no
Contains Side Full-Body View: yes / no
Contains Back Full-Body View: yes / no
Same Character Across Three Views: yes / no
Same Costume Across Three Views: yes / no
White / Light Gray Background: yes / no
No Text / Labels: yes / no
No Info Panel: yes / no
No Detail Collage: yes / no
No Scene Background: yes / no
No Spoiler Form: yes / no
Can Enter BASE CONFIRMATION GATE: yes / no
```

只有全部为 `yes`，才允许进入 BASE CONFIRMATION GATE。

---

### 六、失败判定

如果输出图像出现以下任一情况，判定 CHARACTER IDENTITY BASE 失败：

- 不是一张图
- 不是同一角色
- 缺少正面全身
- 缺少侧面全身
- 缺少背面全身
- 三视图脸不一致
- 三视图身材比例不一致
- 三视图服装不一致
- 不是白底 / 浅灰底
- 姿态过度戏剧化
- 出现任何文字
- 出现 FRONT / SIDE / BACK / 正面 / 侧面 / 背面 标注
- 出现姓名、身份、年龄、身高、trait 等文字
- 出现标签
- 出现边框信息栏
- 出现局部细节图
- 出现角色卡排版
- 出现场景背景
- 服装没有从头到脚完整可见
- 脸部不清晰
- 过度写真化
- 现代化服装误入
- 提前展示后期身份 / 多形态服装
- 图像更像 @sheet 而不是 @base

---

### 七、失败后处理

失败后不得进入 BASE CONFIRMATION GATE。

必须回滚：

```text
Current Stage: CHARACTER IDENTITY BASE RETRY
Completed Stage: not completed
Next Allowed Stage: CHARACTER IDENTITY BASE image generation retry

Blocked Stages:
- BASE CONFIRMATION GATE
- CHARACTER FORM / COSTUME / SHEET
- LOCATION / PROP / VOICE / ASSET REGISTRY
- EPISODE SCRIPT DRAFT
- SHOT UNIT
- SHOT KEYFRAME
- I2V VIDEO
```

并重新生成一张合法三视图 @base。

错误输出可作为废弃参考，不得写入 PROJECT ASSET REGISTRY 的 confirmed base。

---

### 八、门禁规则

只有当用户明确确认该白底三视图全身 @base 后，才允许进入：

```text
BASE CONFIRMATION GATE
→ CHARACTER FORM / COSTUME / SHEET
```

未确认 @base 前，禁止生成：

- 当前集服装形态
- 医生形态
- 王妃形态
- 战损形态
- 角色 @sheet
- 表情图
- 地点绑定关键帧
- I2V 视频

---

### 九、当前剧情合法身份优先

第一张 @base 必须只体现当前剧情允许观众知道的身份。

例如：

```text
女主隐藏现代医生身份
E01 当前身份：侯府被欺凌庶女
```

正确：

```text
白底三视图全身，侯府庶女素衣，虚弱但清醒。
```

错误：

```text
医生服 / 手术服 / 王妃华服 / 觉醒高阶形态 / 多形态合集。
```

---

### 十、补丁口诀

角色第一张，不是资料卡。  
角色第一张，不是设定板。  
角色第一张，必须是白底三视图全身。  
正面锁脸，侧面锁体态，背面锁轮廓。  
先锁三视图，再锁服装形态。  
先锁人，再做 sheet。  
不是白底三视图全身，就失败回滚。  
未确认 @base，不进入任何后续形态。

---
