## 0.1T PATCH：VIDEO START FRAME ≠ IDENTITY REFERENCE NODE LOCK

### 视频首帧不等于身份参考节点锁

【补丁目的】

修复 `generate_video / I2V` 执行阶段把 `start_frame_image_node` 和 `reference_nodes` 混为一谈的问题。

从本补丁生效起，任何视频生成工具调用必须明确区分：

```text
start_frame_image_node = 首帧画面 / 构图起点 / 动作起点
reference_nodes = 角色身份 / 场景空间 / 道具 / 服装一致性参考
```

关键帧作为首帧，只能保证视频从哪一张画面开始。  
关键帧不能替代 `CHARACTER BASE`。  
关键帧不能替代 `LOCATION`。  
关键帧不能替代 `PROP`。  
关键帧不能替代 `COSTUME / FORM`。  

核心原则：

```text
START FRAME IS NOT IDENTITY REFERENCE.
START FRAME IS NOT REFERENCE_NODES.
KEYFRAME NODE IS NOT CHARACTER BASE NODE.
NO CHARACTER BASE IN reference_nodes, NO VIDEO CALL.
NO VIDEO TOOL CALL CARD, NO VIDEO CALL.
```

中文原则：

```text
首帧不是身份锁。
关键帧不是 Base。
start_frame_image_node 只锁第一帧，不锁整段人物。
reference_nodes 才锁角色、场景、道具、服装。
Base 不进 reference_nodes，人物必漂。
Location 不进 reference_nodes，空间必跳。
Prop 不进 reference_nodes，关键道具必变。
没有 VIDEO TOOL CALL CARD，不许调用视频工具。
```

---

### 一、最高原则

任何 `generate_video / I2V` 工具调用前，必须输出并通过：

```text
VIDEO TOOL CALL CARD
```

该卡必须明确列出：

```text
1. start_frame_image_node
2. reference_nodes
3. start_frame_image_node 与 reference_nodes 的职责分离检查
4. 所有出镜角色的 CHARACTER BASE node_key
5. 当前场景 LOCATION node_key
6. 剧情关键道具 PROP node_key
7. 必要服装 / 形态 COSTUME / FORM node_key
8. Can Call Tool: YES / NO
```

只传 `start_frame_image_node`，不传 `reference_nodes`，一律判定为非法视频调用。

---

### 二、VIDEO TOOL CALL CARD 必填模板

每次调用 `generate_video / I2V` 前，必须输出以下完整卡片：

```text
VIDEO TOOL CALL CARD

Tool Name:
Tool Call Purpose: VIDEO_GENERATION_TASK / I2V_VIDEO
Video Task ID:
Source MICRO_SHOT_UNIT IDs:
Source SHOT_KEYFRAME IDs:

Start Frame Input:
- start_frame_image_node:
- start_frame_source_keyframe_id:
- start_frame_role: FIRST_FRAME_COMPOSITION_ONLY
- start_frame_can_replace_character_base: no
- start_frame_can_replace_location_reference: no
- start_frame_can_replace_prop_reference: no
- start_frame_can_replace_costume_reference: no

Required reference_nodes:

CHARACTER BASE reference_nodes:
- CHAR_ID:
- Character Name:
- Appears In Video: yes / no
- CHARACTER BASE node_key:
- CHARACTER BASE image_id:
- Base Confirmation Status: CONFIRMED / MISSING / UNCONFIRMED
- Must Include In reference_nodes: yes
- Included In reference_nodes: yes / no
- Reference Role: PRIMARY_IDENTITY_REFERENCE

OPTIONAL CHARACTER SHEET reference_nodes:
- CHAR_ID:
- CHARACTER SHEET node_key:
- Usage: expression / hand / head angle / costume detail / close-up support
- Can Replace Base: no
- Included In reference_nodes: yes / no

LOCATION reference_nodes:
- LOC_ID:
- Location Name:
- LOCATION node_key:
- LOCATION image_id:
- Location Confirmation Status: CONFIRMED / MISSING / UNCONFIRMED
- Must Include In reference_nodes: yes
- Included In reference_nodes: yes / no
- Reference Role: PRIMARY_ENVIRONMENT_REFERENCE

PROP reference_nodes:
- PROP_ID:
- Prop Name:
- PROP node_key:
- PROP image_id:
- Is Story-Critical: yes / no
- Visible In Video: yes / no
- Must Include In reference_nodes If Story-Critical Or Visible: yes / no
- Included In reference_nodes: yes / no

COSTUME / FORM reference_nodes:
- COSTUME_ID / FORM_ID:
- COSTUME / FORM node_key:
- COSTUME / FORM image_id:
- Current Costume Differs From Base: yes / no
- Must Include In reference_nodes If Differs From Base: yes / no
- Included In reference_nodes: yes / no

WORLD reference_nodes:
- WORLD_VISUAL_BIBLE node_key:
- WORLD_VISUAL_BIBLE image_id:
- Usage: style / lighting / material inheritance only
- Can Replace Location: no

Separation Check:
- start_frame_image_node is only first-frame composition: yes / no
- reference_nodes include all visible CHARACTER BASE nodes: yes / no
- reference_nodes include current LOCATION node: yes / no
- reference_nodes include story-critical PROP nodes when needed: yes / no
- reference_nodes include COSTUME / FORM nodes when needed: yes / no
- No role confusion between start_frame_image_node and reference_nodes: yes / no

Missing Required Nodes:
- none / list

Can Call Tool:
- YES / NO
```

如果 `Can Call Tool = NO`，必须停止，不得调用视频工具。

---

### 三、start_frame_image_node 职责边界

`start_frame_image_node` 只允许承担以下职责：

```text
first frame visual composition
initial framing
initial body pose
initial action state
initial camera distance
initial scene moment
first-frame lighting continuity
```

禁止把 `start_frame_image_node` 当成：

```text
character identity lock
face consistency reference
body proportion reference
costume identity reference
location asset reference
prop identity reference
reference_nodes replacement
```

即使关键帧中已经出现角色，也必须同时把该角色的 `CHARACTER BASE node_key` 放入 `reference_nodes`。

---

### 四、reference_nodes 职责边界

`reference_nodes` 是视频生成阶段的资产一致性输入，必须包含：

```text
所有出镜角色的 confirmed CHARACTER BASE node_key
当前场景的 confirmed LOCATION node_key
剧情关键道具的 confirmed PROP node_key
必要服装 / 形态的 confirmed COSTUME / FORM node_key
可选的 CHARACTER SHEET node_key 作为辅助表情 / 手部 / 角度参考
WORLD_VISUAL_BIBLE node_key 作为风格继承参考
```

规则：

```text
reference_nodes must be asset references, not text descriptions.
reference_nodes must contain node_key, not only CHAR_ID / LOC_ID / PROP_ID.
reference_nodes must be attached to the video tool call.
```

只在 `Video Prompt` 中写“参考 CHAR_001 Base”不算合法。  
只在 `Video Prompt` 中写“保持人物一致”不算合法。  
必须在工具调用参数的 `reference_nodes` 中实际包含对应节点。

---

### 五、视频调用前执行顺序

任何视频任务调用前必须按以下顺序执行：

```text
1. Read VIDEO_GENERATION_TASK.
2. Read Source SHOT_KEYFRAME.
3. Read KEYFRAME REFERENCE INPUT MANIFEST.
4. Extract all visible Character IDs / Location ID / Prop IDs / Costume IDs.
5. Retrieve confirmed node_keys from assets/asset_registry.md.
6. Build VIDEO TOOL CALL CARD.
7. Verify start_frame_image_node is not being used as reference_nodes.
8. Verify reference_nodes include CHARACTER BASE node_keys for all visible characters.
9. Verify reference_nodes include LOCATION / PROP / COSTUME nodes when required.
10. Only then call generate_video / I2V.
```

禁止：

```text
先调用视频工具，再补解释。
只传关键帧首帧，不传 Base。
只传 start_frame_image_node，不传 reference_nodes。
把 source keyframe 当作 character base。
把 image prompt 当作 reference_nodes。
```

---

### 六、与 0.1S 的关系

`0.1S` 解决的是：

```text
关键帧 / 视频任务必须使用 confirmed visual reference input。
```

`0.1T` 进一步锁定的是：

```text
视频工具调用时，start_frame_image_node 不能冒充 reference_nodes。
```

如果二者冲突，以更严格的规则为准：

```text
Both start_frame_image_node and required reference_nodes must exist.
```

也就是说，合法视频调用必须同时满足：

```text
start_frame_image_node exists
CHARACTER BASE node_keys exist in reference_nodes
LOCATION node_key exists in reference_nodes
PROP node_keys exist in reference_nodes when required
COSTUME / FORM node_keys exist in reference_nodes when required
VIDEO TOOL CALL CARD exists
Can Call Tool = YES
```

---

### 七、失败判定

出现以下任一情况，视频工具调用必须判定失败并阻断：

- 没有输出 `VIDEO TOOL CALL CARD` 就调用视频工具。
- `VIDEO TOOL CALL CARD` 中没有 `start_frame_image_node`。
- `VIDEO TOOL CALL CARD` 中没有 `reference_nodes`。
- 只传 `start_frame_image_node`，没有传 `CHARACTER BASE node_key`。
- 画面中出现角色，但 `reference_nodes` 缺少该角色 confirmed `CHARACTER BASE node_key`。
- 多角色同框时，只传了主角 Base，漏传其他出镜角色 Base。
- 当前场景已登记，但 `reference_nodes` 缺少 confirmed `LOCATION node_key`。
- 剧情关键道具可见或承担反转功能，但 `reference_nodes` 缺少 confirmed `PROP node_key`。
- 当前服装 / 形态不同于 Base，但 `reference_nodes` 缺少 confirmed `COSTUME / FORM node_key`。
- agent 声称“关键帧已经包含角色，所以不用 Base”。
- agent 声称“start_frame_image_node 已经足够锁定身份”。
- agent 只在 prompt 文字里写“保持角色一致”，但没有传入 Base reference node。

失败后必须输出：

```text
VIDEO TOOL CALL BLOCKED

Reason:
Missing Required Nodes:
Return To:
- VIDEO TOOL CALL CARD rebuild
- or missing asset generation / registration
Can Retry Tool Call: no, until required nodes are attached
```

---

### 八、失败后重试规则

如果发现已经错误调用视频工具，例如只传了关键帧首帧，没有传角色 Base：

```text
Previous Video Output Status: INVALID_FOR_CHARACTER_CONSISTENCY
Do Not Register As Final Video Asset.
Do Not Enter SELECTS_EDL.
Rebuild VIDEO TOOL CALL CARD.
Attach required reference_nodes.
Regenerate VIDEO_GENERATION_TASK.
```

错误视频素材可以临时保留为 discarded diagnostic output，但不得进入：

```text
selected footage
edl
final assembly
confirmed video output
runtime state snapshot
```

---

### 九、补丁口诀

首帧不是身份锁。  
关键帧不是 Base。  
start_frame_image_node 只管开场画面。  
reference_nodes 才管人物一致。  
Base 必须进 reference_nodes。  
Location 必须进 reference_nodes。  
关键 Prop 必须进 reference_nodes。  
换装必须进 Costume / Form reference_nodes。  
只传首帧不许生视频。  
没有 VIDEO TOOL CALL CARD，不许调用工具。
