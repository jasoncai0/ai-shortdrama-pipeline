## 0.40 PATCH：KEYFRAME CHARACTER IDENTITY & SCENE SPATIAL LOCK

### 多人物关键帧身份标注与场景空间位置锁定补丁

【补丁目的】

修复以下问题：

1. 多个人物出现在同一张关键帧时，AI 容易把背后、侧后方、远景人物放错。
2. 背景人物未标注身份，导致母亲、婆婆、丈夫、秘书、反派等角色被互换。
3. 同一场景多张图之间，沙发、茶几、门、窗、餐桌等位置漂移。
4. 关键帧只写“人在客厅”，没有锁定人物相对场景道具的位置。
5. 视频生成时模型重新设计房间，造成同一场戏场景连续性崩坏。

从本补丁生效起，所有多人关键帧和复用场景关键帧必须同时携带：

- `CHARACTER_BLOCKING_MAP`
- `BACKGROUND_CHARACTER_IDENTITY`
- `LOCATION_SPATIAL_MAP`
- `KEYFRAME_POSITION_MAP`
- `CAMERA_RELATIVE_BLOCKING`
- `DO_NOT_CHANGE` 场景锁定项

### 一、多人角色身份标注锁

只要关键帧中出现 2 个及以上可见人物，每个可见人物都必须被明确标注。

每个人必须包含：

```text
CHARACTER_ID:
CHARACTER_NAME:
ROLE_IN_SCENE:
SCREEN_POSITION:
DEPTH_LAYER:
FACING_DIRECTION:
BODY_VISIBILITY:
ACTION_STATE:
RELATION_TO_MAIN_CHARACTER:
LOCKED_COSTUME_HAIR_ANCHOR:
```

`SCREEN_POSITION` 只能使用以下枚举：

- foreground_left
- foreground_center
- foreground_right
- midground_left
- midground_center
- midground_right
- background_left
- background_center
- background_right
- far_background_left
- far_background_center
- far_background_right

`DEPTH_LAYER` 只能使用：

- foreground
- midground
- background
- far_background

`FACING_DIRECTION` 只能使用：

- facing_camera
- facing_left
- facing_right
- three_quarter_left
- three_quarter_right
- back_to_camera
- side_profile_left
- side_profile_right

禁止：

- 只写“一群人”
- 只写“旁边的人”
- 只写“后面的人”
- 只写“家人们”
- 只写“围观者”
- 用 unnamed man / unnamed woman / generic person 替代剧情相关角色

如果背景人物是剧情相关角色，必须用 `CHARACTER_ID + CHARACTER_NAME` 标注。

### 二、背后人物反错位规则

凡是某个角色位于另一个角色身后、侧后方、门口、沙发后、餐桌旁、远景位置，必须单独写 `BACKGROUND_CHARACTER_IDENTITY`。

格式：

```text
BACKGROUND_CHARACTER_IDENTITY:
Behind / beside / near [foreground character], [CHARACTER_ID + CHARACTER_NAME] is visible at [screen position], wearing [locked costume], with [locked hairstyle], performing [specific action]. This person must remain [character identity]. Do not replace this person with another character or a generic background actor.
```

示例：

```text
BACKGROUND_CHARACTER_IDENTITY:
Behind C01_LIN_YAO, C04_ZHOU_CHEN is visible in background_center, wearing his locked charcoal gray suit, short side-parted black hair, standing near the entrance corridor with a stiff posture. This person is C04_ZHOU_CHEN, not the mother-in-law, not a generic male extra.
```

负向 prompt 必须加入：

```text
wrong person in background, swapped character identity, generic background actor, unnamed person replacing named character, duplicated face, wrong costume, wrong hairstyle, background character replaced, character identity swap
```

### 三、LOCATION_SPATIAL_MAP 场景空间地图

所有高复用场景必须先建立 `LOCATION_SPATIAL_MAP`。  
它是场景空间拓扑资产，不是普通场景描述。

格式：

```text
LOCATION_SPATIAL_MAP

LOCATION_ID:
LOCATION_NAME:
CAMERA_AXIS:
MAIN_FURNITURE_ANCHORS:
ENTRANCE_EXIT_POINTS:
LIGHT_SOURCE_POSITION:
CHARACTER_ALLOWED_ZONES:
FIXED_OBJECTS:
DO_NOT_CHANGE:
CONTINUITY_NOTES:
```

示例：

```text
LOCATION_SPATIAL_MAP

LOCATION_ID: LOC_01_LIVING_ROOM
LOCATION_NAME: Wealthy family living room
CAMERA_AXIS: Camera faces the north wall; sofa wall is the stable visual axis.
MAIN_FURNITURE_ANCHORS:
- large beige L-shaped sofa fixed on screen left / midground.
- dark marble coffee table fixed in center foreground.
- dining table fixed in background right.
- entrance door fixed in background left.
- floor lamp fixed beside sofa, far screen left.
LIGHT_SOURCE_POSITION:
- large window on screen right, soft daylight from right to left.
CHARACTER_ALLOWED_ZONES:
- heroine can stand foreground_center or foreground_right, in front of coffee table.
- mother can sit midground_left on the sofa.
- mother-in-law can stand background_right near dining table.
- husband can stand background_center near entrance corridor.
DO_NOT_CHANGE:
- Do not change sofa color, shape, position, or orientation.
- Do not move dining table to another side.
- Do not change entrance door position.
- Do not redesign the room between keyframes.
- Do not add new major furniture.
CONTINUITY_NOTES:
This living room layout must remain identical across all keyframes and SHOT UNITs in the same scene.
```

### 四、KEYFRAME_POSITION_MAP 单张关键帧人物站位图

每张关键帧必须描述人物相对固定场景锚点的位置。

格式：

```text
KEYFRAME_POSITION_MAP:
- [CHARACTER_ID + NAME]: [screen position], [depth layer], [scene-object relation], [facing direction], [action], [locked costume/hair anchor].
- [CHARACTER_ID + NAME]: [screen position], [depth layer], [scene-object relation], [facing direction], [action], [locked costume/hair anchor].
```

示例：

```text
KEYFRAME_POSITION_MAP:
- C01_LIN_YAO: foreground_center, standing directly in front of the dark marble coffee table, one meter away from the beige sofa, facing C03_MOTHER_IN_LAW, wearing locked white coat and low ponytail.
- C02_MOTHER: midground_left, seated on the left side of the beige L-shaped sofa, three_quarter_right, hands clasped, wearing locked faded blue cardigan.
- C03_MOTHER_IN_LAW: background_right, standing beside the dining table, facing_left, pointing toward C01_LIN_YAO, wearing locked pearl necklace and burgundy dress.
- C04_HUSBAND: background_center, standing near entrance corridor behind C01_LIN_YAO, back_to_camera, wearing locked charcoal gray suit.
```

禁止只写：

```text
她站在客厅里。
母亲坐在沙发上。
婆婆站在后面。
```

必须写成：

```text
C01 stands foreground_center, directly in front of the coffee table.
C02 sits midground_left on the fixed beige sofa.
C03 stands background_right beside the fixed dining table.
C04 stands background_center near the fixed entrance door behind C01.
```

### 五、CAMERA_RELATIVE_BLOCKING 镜头相对调度锁

人物位置必须同时使用两套关系锁定：

1. 与场景物体的关系；
2. 与画面 / 镜头的关系。

格式：

```text
CAMERA_RELATIVE_BLOCKING:
- Screen Relation:
- Scene Object Relation:
- Depth Relation:
- Facing Relation:
- Occlusion Relation:
```

示例：

```text
CAMERA_RELATIVE_BLOCKING:
C01_LIN_YAO is foreground_center, in front of the marble coffee table, with the beige sofa behind her on screen left. C04_ZHOU_CHEN is visible behind her in background_center near the entrance corridor, partially occluded by her shoulder but identifiable by his charcoal gray suit and side-parted hair.
```

规则：

- 必须写 screen left / screen right / foreground / midground / background。
- 必须写 in front of / behind / beside / near / by window / near door。
- 必须写谁遮挡谁，谁在谁背后。
- 不允许只写抽象关系。

### 六、关键帧 Prompt 插入模板

所有多人或复用场景关键帧 prompt 必须插入：

```text
[IDENTITY_AND_SPATIAL_LOCK]
Scene: [LOCATION_ID + LOCATION_NAME]
Locked layout: [short LOCATION_SPATIAL_MAP summary]
Camera axis: [camera direction]
Character blocking:
- [CHARACTER_ID + NAME]: [screen position], [depth layer], [scene-object relation], [facing direction], [action], [locked costume/hair anchor].
- [CHARACTER_ID + NAME]: [screen position], [depth layer], [scene-object relation], [facing direction], [action], [locked costume/hair anchor].
Background identity:
- Behind / beside / near [foreground character], [CHARACTER_ID + NAME] must remain visible and identifiable as [identity anchors].
Do not change:
- furniture layout
- sofa shape / color / position
- table position
- door / window position
- character identity
- character placement
- costume and hairstyle anchors
```

### 七、场景漂移禁止项

每个复用场景 prompt 的 `DO_NOT_CHANGE` 必须包含：

```text
Do not change furniture layout.
Do not change sofa shape, sofa color, sofa size, sofa orientation, or sofa screen position.
Do not move the coffee table.
Do not move the dining table.
Do not move the entrance door.
Do not move the window.
Do not redesign the room.
Do not add new major furniture.
Do not flip the camera axis unless explicitly requested.
Do not change character blocking.
Do not swap background characters.
```

中文执行规则：

```text
不得改变家具布局。
不得改变沙发形状、颜色、大小、朝向、画面位置。
不得移动茶几。
不得移动餐桌。
不得移动门和窗。
不得重新设计房间。
不得新增大型家具。
不得无指令翻转镜头轴线。
不得改变人物站位。
不得替换背后人物身份。
```

### 八、SHOT UNIT 字段补充

每个涉及多人 / 复用场景的 `SHOT UNIT` 必须新增：

```text
LOCATION_SPATIAL_MAP Ref:
KEYFRAME_POSITION_MAP:
CHARACTER_BLOCKING_MAP:
BACKGROUND_CHARACTER_IDENTITY:
CAMERA_RELATIVE_BLOCKING:
Scene Drift Risk:
low / medium / high
Character Swap Risk:
low / medium / high
Locked Furniture Anchors:
Do Not Change:
```

### 九、I2V / Seedance 继承规则

当关键帧送入 I2V / Seedance 时，视频 prompt 必须继承：

- locked keyframe
- locked character blocking
- locked background character identity
- locked furniture anchors
- locked camera axis
- locked door / window / sofa / table positions
- locked costume / hair anchors

视频生成 prompt 必须写：

```text
Preserve character blocking exactly.
Preserve background character identity exactly.
Preserve the locked room layout.
Preserve sofa, table, door, and window positions exactly.
Do not recompose the room.
Do not redesign the furniture.
Do not swap background characters.
Do not replace named characters with generic extras.
Camera movement may occur only within the defined camera axis.
```

### 十、图像负向 prompt 增补

所有多人关键帧 / 复用场景关键帧的 negative prompt 必须加入：

```text
wrong character placement, character identity swap, wrong person in background, background character replaced, unnamed background actor, generic extra replacing named character, duplicated character, merged faces, wrong costume, wrong hairstyle, changed furniture layout, redesigned sofa, sofa moved, table moved, door moved, window moved, inconsistent room layout, different living room, new furniture, altered set design, changed camera axis, spatial continuity error
```

### 十一、输出前 QC

每张多人关键帧接受前必须检查：

【角色身份】

- 所有可见命名角色是否都有 CHARACTER_ID？
- 背后 / 侧后方 / 远景人物是否明确是谁？
- 背后人物是否穿着锁定服装、发型一致？
- 是否出现了错误人物替换？
- 是否出现重复脸或身份互换？

【场景空间】

- 沙发是否仍是同一形状、颜色、位置、朝向？
- 茶几是否仍在固定位置？
- 餐桌、门、窗、灯是否仍在固定位置？
- 是否新增了不该出现的大型家具？
- 镜头轴线是否无故翻转？
- 人物是否站 / 坐在 LOCATION_SPATIAL_MAP 允许区域？
- KEYFRAME_POSITION_MAP 是否和实际画面一致？

【失败条件】

如果出现以下任一情况，必须重生：

- 命名背景角色变成 generic extra。
- 背后人物放错。
- 沙发 / 茶几 / 门 / 窗位置改变。
- 房间被重新设计。
- 人物站位漂移。
- 镜头轴线无指令翻转。
- 角色服装 / 发型锚点丢失。
- 背景人物身份不可辨认。

### 十二、与 SCENE CONTINUITY LEDGER 的关系

`LOCATION_SPATIAL_MAP` 负责锁定场景拓扑。  
`SCENE CONTINUITY LEDGER` 负责锁定单场戏连续状态。  
`KEYFRAME_POSITION_MAP` 负责锁定单张关键帧里人物位置。  
三者必须同时使用。

```text
LOCATION_SPATIAL_MAP = 场景结构不漂移
SCENE CONTINUITY LEDGER = 单场状态不乱变
KEYFRAME_POSITION_MAP = 当前关键帧人物站位不放错
CHARACTER_BLOCKING_MAP = 多人物身份不互换
```

### 十三、补丁口诀

多人同框，人人点名。  
站在背后，也必须说清是谁。  
不要“旁边的人”，只要 `CHARACTER_ID + NAME`。  
场景不是一句“豪门客厅”，而是一张空间地图。  
沙发在哪边，茶几在哪边，门在哪边，必须锁。  
人物站位要相对沙发、桌子、门、窗写清楚。  
先锁场景拓扑，再锁人物调度。  

---
