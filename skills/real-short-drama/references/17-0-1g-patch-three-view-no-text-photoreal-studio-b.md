## 0.1G PATCH：THREE-VIEW NO-TEXT PHOTOREAL STUDIO BASE LOCK

### 三视图无字真人棚拍基准锁

【补丁目的】

修复以下问题：

1. CHARACTER IDENTITY BASE 三视图生成后，图像里出现 FRONT VIEW / SIDE VIEW / BACK VIEW、正面 / 侧面 / 背面、角色姓名、身份、年龄、身高、trait、信息栏等文字。
2. 系统把“三视图全身基准图”误生成成角色设定稿、游戏转面图、服装设计板、资料卡或带标签的 reference sheet。
3. 三视图虽然满足正侧背，但画风偏 CG、游戏立绘、数字服装概念图，缺少真人摄影质感。
4. 图像内文字污染后续关键帧、img2img、I2V 与角色一致性生产。
5. 用户需要的是后续视频生成可直接继承的干净视觉参考，而不是带说明文字的展示板。

从本补丁生效起，CHARACTER IDENTITY BASE 三视图必须同时满足：

```text
THREE-VIEW ALLOWED
TEXT FORBIDDEN
PHOTOREAL STUDIO ACTOR REFERENCE REQUIRED
```

---

### 一、最高原则

```text
三视图可以有，字一个都不能有。
```

含义：

- 可以一张图内出现同一角色正面 / 侧面 / 背面三个完整全身视图。
- 绝对不得在图像内生成任何文字。
- 不得用文字标注 FRONT / SIDE / BACK。
- 不得用姓名、身份栏、年龄、身高、标题、标签、信息表辅助说明角色。
- 三视图的排列关系只能通过画面位置表达，不得通过文字表达。

---

### 二、合法三视图图像定义

CHARACTER IDENTITY BASE 的唯一合法三视图结果：

```text
ONE IMAGE
SAME CHARACTER
FRONT FULL-BODY VIEW LEFT
SIDE FULL-BODY VIEW CENTER
BACK FULL-BODY VIEW RIGHT
WHITE OR LIGHT GRAY STUDIO BACKGROUND
NO TEXT
NO LABELS
NO TYPOGRAPHY
NO INFORMATION PANEL
PHOTOREALISTIC STUDIO ACTOR REFERENCE
```

必须像：

```text
真人棚拍角色基准图
真人服装试装参考
photorealistic studio actor fitting reference
real human model three-view wardrobe fitting photo
```

不得像：

```text
角色设定稿
游戏角色转面图
服装设计稿
CG 模型展示
古风立绘
character sheet
reference sheet
profile card
```

---

### 三、图像内绝对禁字清单

三视图图像中严禁出现任何文字，包括但不限于：

```text
FRONT VIEW
SIDE VIEW
BACK VIEW
front
side
back
正面
侧面
背面
角色姓名
英文名
身份
年龄
身高
trait
title
labels
typography
information panel
bio card
data card
UI text
watermark
caption
subtitle
```

规则：

- 即使文字很小，也判定失败。
- 即使文字只有 FRONT / SIDE / BACK，也判定失败。
- 即使文字看起来像设计稿标注，也判定失败。
- 正侧背说明必须写在图像外部字段，不得烧进图像。

---

### 四、真人棚拍质感强制

三视图必须是“真人棚拍感”，不是设定稿感。

必须包含：

```text
realistic skin pores
subtle facial asymmetry
natural under-eye shadow
real hair flyaways
realistic fabric wrinkles
garment weight
natural body posture
contact shadows under feet
realistic studio lighting
DSLR photography feel
```

禁止出现：

```text
plastic skin
perfect symmetry
game character face
CGI face
digital painting texture
ultra-clean costume render
flat clothing texture
painted fabric pattern
concept art lighting
fantasy character design
```

---

### 五、Prompt 必须使用的表达

CHARACTER IDENTITY BASE 三视图 prompt 必须使用：

```text
photorealistic studio actor fitting reference, one image showing three full-body views of the same real human model, front-facing full-body view on the left, side-profile full-body view in the center, back full-body view on the right, clean white studio background, no text, no labels, no typography, no information panel, realistic skin pores, subtle facial asymmetry, natural hair flyaways, realistic fabric wrinkles, garment weight, natural contact shadows under feet, DSLR photography feel, not character design, not concept art, not game character, not CGI
```

---

### 六、Prompt 禁词

CHARACTER IDENTITY BASE 三视图 prompt 禁止使用：

```text
character sheet
reference sheet
character design
concept art
turnaround sheet
game character turnaround
costume design sheet
model sheet
profile card
dossier
labeled views
front view label
side view label
back view label
typography
information panel
bio card
data card
```

如果必须表达三视图，只能写：

```text
three full-body views of the same real human model arranged left to right, no text, no labels
```

---

### 七、三视图图像检查

生成后必须执行：

```text
THREE-VIEW NO-TEXT PHOTOREAL CHECK

Contains Any Text: yes / no
Contains Labels: yes / no
Contains Info Panel: yes / no
Looks Like Character Sheet: yes / no
Looks Like Game / CGI / Concept Art: yes / no
Skin Has Real Texture: yes / no
Fabric Has Real Wrinkles and Weight: yes / no
Feet Have Natural Contact Shadows: yes / no
Three Views Same Person: yes / no
Three Views Same Costume: yes / no

Can Enter THREE-VIEW BASE CONFIRMATION GATE: yes / no
```

进入下一阶段的条件：

```text
Contains Any Text = no
Contains Labels = no
Contains Info Panel = no
Looks Like Character Sheet = no
Looks Like Game / CGI / Concept Art = no
Skin Has Real Texture = yes
Fabric Has Real Wrinkles and Weight = yes
Feet Have Natural Contact Shadows = yes
Three Views Same Person = yes
Three Views Same Costume = yes
```

---

### 八、失败判定

出现以下任一情况，判定 CHARACTER IDENTITY BASE 失败：

- 图像内出现任何文字
- 出现 FRONT / SIDE / BACK 标注
- 出现正面 / 侧面 / 背面标注
- 出现姓名、身份、年龄、身高、trait
- 出现信息栏、资料卡、标题栏
- 出现 watermark / caption / subtitle
- 三视图像角色设定稿
- 三视图像游戏转面图
- 三视图像 CG 模型展示
- 三视图像服装设计图
- 皮肤过度光滑
- 五官过度对称
- 衣服像贴图，没有真实褶皱和重量
- 没有脚下接触阴影
- 三个视图不像同一真人

失败后不得进入 THREE-VIEW BASE CONFIRMATION GATE，必须重新生成。

---

### 九、失败后处理

失败后必须回滚：

```text
Current Stage: CHARACTER IDENTITY BASE RETRY
Completed Stage: not completed
Next Allowed Stage: CHARACTER IDENTITY BASE image generation retry

Blocked Stages:
- THREE-VIEW BASE CONFIRMATION GATE
- CHARACTER FORM / COSTUME / SHEET
- LOCATION / PROP / VOICE / ASSET REGISTRY
- EPISODE SCRIPT DRAFT
- SHOT UNIT
- SHOT KEYFRAME
- I2V VIDEO
```

错误图像不得写入 confirmed base，不得作为后续关键帧或 I2V 参考。

---

### 十、图像外部标注规则

如果需要说明三视图位置，只能在图像外部文本记录：

```text
External View Order:
Left: Front full-body view
Center: Side full-body view
Right: Back full-body view
```

不得在图像内生成任何标注。

---

### 十一、补丁口诀

三视图可以有，字一个都不能有。  
正侧背靠位置表达，不靠文字表达。  
有 FRONT / SIDE / BACK 就失败。  
有姓名身份栏就失败。  
像设定稿就失败。  
像游戏转面图就失败。  
白底三视图必须是真人棚拍参考。  
不像真人，不进确认门禁。

---
