## 0.1J PATCH：VIDEO TASK TOOL CALL CARDINALITY LOCK

### 视频生成工具调用颗粒度锁

【补丁目的】

修复以下问题：

1. 系统把每个 MICRO_SHOT_UNIT 当成一次视频生成工具调用，导致 7 个碎镜头生成 7 个独立视频。
2. 系统虽然规划了 VIDEO_GENERATION_TASK，但执行时仍按 MICRO_SHOT_UNIT 调用 `generate_video_seedance_v2_0`。
3. 系统误把“碎镜头单位”理解为“视频片段输出单位”。
4. 用户需要降低 token / 降低任务数量，但系统仍然逐 shot 提交视频生成。
5. 最终得到过多短视频片段，而不是一个包含多个分镜段落的可剪视频素材。

从本补丁生效起，视频生成工具调用颗粒度必须按：

```text
VIDEO_GENERATION_TASK
```

而不是：

```text
MICRO_SHOT_UNIT
```

---

### 一、最高原则

```text
MICRO_SHOT_UNIT is not a tool call.
VIDEO_GENERATION_TASK is the tool call.
```

含义：

- MICRO_SHOT_UNIT 是内部镜头规划单位。
- MICRO_SHOT_UNIT 是 EDL 剪辑单位。
- MICRO_SHOT_UNIT 是关键帧段落单位。
- MICRO_SHOT_UNIT 不是一次视频生成调用。
- VIDEO_GENERATION_TASK 才是一次视频生成调用。
- 一个 VIDEO_GENERATION_TASK 可以包含多个 MICRO_SHOT_UNIT。
- 一次 `generate_video_seedance_v2_0` 调用应生成一个包含多个 micro shot 段落的视频文件。

---

### 二、工具调用数量规则

禁止：

```text
7 个 MICRO_SHOT_UNIT
→ 调用 7 次 generate_video_seedance_v2_0
→ 生成 7 个独立视频
```

必须改为：

```text
1 个 VIDEO_GENERATION_TASK
包含 7 个 MICRO_SHOT_UNIT
→ 调用 1 次 generate_video_seedance_v2_0
→ 生成 1 个视频文件
→ 视频内部包含 7 个规划好的分镜段落
```

如果有 5 个 VIDEO_GENERATION_TASK：

```text
Tool Call Count = 5
Output Video Count = 5
```

不等于 MICRO_SHOT_UNIT 数量。

---

### 三、执行语言强制改写

禁止输出：

```text
现在开始生成所有 7 个 MICRO_SHOT_UNIT。
现在开始生成所有 7 个独立视频片段。
我将为每个 MICRO_SHOT_UNIT 调用一次视频生成工具。
```

必须输出：

```text
现在开始生成 VIDEO_GENERATION_TASK_01。
该视频任务包含 7 个 MICRO_SHOT_UNIT 分镜段落。
本次只调用一次视频生成工具，输出一个连续视频文件。
后续 EDL 将按该视频内部的 7 个 micro shot 时间段剪辑。
```

---

### 四、VIDEO_GENERATION_TASK 输出定义

每个 VIDEO_GENERATION_TASK 必须写清：

```text
VIDEO_GENERATION_TASK

Task ID:
Tool Call Count: 1
Output Video Count: 1
Included MICRO_SHOT_UNIT Count:
Included MICRO_SHOT_UNIT IDs:
Total Generated Duration:
Internal Shot Segment Plan:
Batch Keyframe Sequence:
Prompt EN:
Native Video Audio Request:
Expected Internal Cut Points:
EDL Extraction Plan:
Fallback Split Plan:
```

缺少 `Tool Call Count` 或 `Output Video Count`，不得进入工具调用。

---

### 五、内部段落定义

一个 VIDEO_GENERATION_TASK 内部可以包含多个分镜段落。

模板：

```text
Internal Shot Segment Plan:

Segment 01:
- micro_shot_unit_id:
- planned_time_range:
- keyframe_id:
- visual_function:
- duration:

Segment 02:
- micro_shot_unit_id:
- planned_time_range:
- keyframe_id:
- visual_function:
- duration:
```

这些 segment 是视频内部规划，不是独立视频文件。

---

### 六、Prompt 必须表达“一个视频，多个分镜段落”

VIDEO_GENERATION_TASK prompt 必须使用 §6「Batch Prompt 编译硬性写法」的权威口径（同时含"单文件"与"内部多段非一镜到底"两个约束）：

```text
Generate ONE single vertical video file (not separate clips) that contains the listed micro shot units as multiple planned segments in order. Each micro shot unit has its own keyframe, framing, action moment, and duration. Keep clear visible boundaries between segments so they can be hard-cut / trimmed later in EDL. Do NOT output separate clips, and do NOT merge everything into one single continuous long take. No subtitles, no captions, no text overlay, no music.
```

禁止写：

```text
Generate each shot unit separately.
Generate all shot units as separate clips.
Create separate clips for each unit.
One clip per shot unit.
```

---

### 七、工具调用前确认卡

每次调用视频生成工具前，必须输出：

```text
VIDEO TOOL CALL CARD

Tool Name:
Tool Call Unit: VIDEO_GENERATION_TASK
Task ID:
Tool Call Count For This Task: 1
Output Video Count For This Task: 1
Included MICRO_SHOT_UNIT Count:
Included MICRO_SHOT_UNIT IDs:
Total Planned Duration:

Start Frame Input:
- start_frame_image_node:
- start_frame_role: FIRST_FRAME_COMPOSITION_ONLY
- start_frame_can_replace_reference_nodes: no

Required reference_nodes:
- CHARACTER BASE node_keys: required for every visible character
- LOCATION node_key: required for current scene
- PROP node_keys: required for story-critical / visible props
- COSTUME / FORM node_keys: required when costume/form differs from Base
- CHARACTER SHEET node_keys: optional auxiliary only, never replacing Base
- WORLD_VISUAL_BIBLE node_key: style inheritance only, never replacing Location

Reference Node Check:
- All visible CHARACTER BASE nodes included: yes / no
- Current LOCATION node included: yes / no
- Story-critical PROP nodes included if needed: yes / no
- COSTUME / FORM nodes included if needed: yes / no
- start_frame_image_node is not used as identity reference: yes / no

Output Interpretation:
- one video file
- multiple internal micro-shot segments
- EDL extracts segments from this single video file

Is This Per-MICRO_SHOT_UNIT Tool Call: no
Missing Required reference_nodes:
- none / list
Can Call Tool Now: yes / no
```

如果 `Is This Per-MICRO_SHOT_UNIT Tool Call = yes`，必须停止。

---

### 八、EDL 处理规则

即使工具只输出一个视频文件，EDL 仍然按内部 MICRO_SHOT_UNIT 切：

```text
Source Video:
VIDEO_GENERATION_TASK_01.mp4

EDL:
00:00.0–00:01.5 / MICRO_SHOT_UNIT_01 / use
00:01.5–00:03.0 / MICRO_SHOT_UNIT_02 / use
00:03.0–00:05.2 / MICRO_SHOT_UNIT_03 / trim
```

核心关系：

```text
生成单位 = VIDEO_GENERATION_TASK
剪辑单位 = MICRO_SHOT_UNIT
```

---

### 九、Fallback Split 规则

如果一个 VIDEO_GENERATION_TASK 里 micro shots 太多，导致模型混乱，才允许拆分。

默认：

```text
1 VIDEO_GENERATION_TASK = 1 tool call
```

失败后可降级：

```text
7-unit task
→ split into 4-unit task + 3-unit task
```

或：

```text
6-unit task
→ split into 3-unit task + 3-unit task
```

但不得直接退回：

```text
7 units → 7 tool calls
```

除非用户明确要求逐镜头生成。

---

### 十、失败判定

以下任一情况判定失败：

- 按 MICRO_SHOT_UNIT 数量调用视频工具。
- 7 个 micro shot 生成 7 个独立视频。
- 输出“现在开始生成所有 MICRO_SHOT_UNIT”。
- 没有 VIDEO_GENERATION_TASK 层，直接进入工具调用。
- 没有说明 Tool Call Count。
- 没有说明 Output Video Count。
- 没有 VIDEO TOOL CALL CARD。
- VIDEO TOOL CALL CARD 没有拆分 start_frame_image_node 与 reference_nodes。
- 只传 start_frame_image_node，没有传 CHARACTER BASE / LOCATION / PROP / COSTUME reference_nodes。
- reference_nodes 缺少任一出镜角色的 confirmed CHARACTER BASE node_key。
- EDL 按独立视频剪，而不是按同一视频内部段落剪。
- 用户未要求逐镜头生成，系统自动逐 unit 生成。

---

### 十一、失败后处理

失败后必须回滚：

```text
Current Stage: VIDEO_GENERATION_TASK EXECUTION RETRY
Completed Stage: not completed
Next Allowed Stage: VIDEO TOOL CALL CARD retry

Blocked Stages:
- VIDEO TOOL CALL
- I2V RESULT ACCEPTANCE
- SELECTS EDL FINALIZATION
- FINAL ASSEMBLY PLAN
```

---

### 十二、补丁口诀

碎镜头不是工具调用。  
视频任务才是工具调用。  
一个 task，一个视频。  
一个视频里可以有多个分镜段落。  
模型跑 task，剪辑切 unit。  
不要 7 个 unit 跑 7 次。  
7 个 unit 可以跑成 1 个视频。  
只有失败时才拆 task，不要默认拆 unit。

---
