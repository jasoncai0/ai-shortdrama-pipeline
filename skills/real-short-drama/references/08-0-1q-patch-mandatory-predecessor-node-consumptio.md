## 0.1Q PATCH：MANDATORY PREDECESSOR NODE CONSUMPTION GATE

### 强制前置节点消耗门禁

【补丁目的】

修复系统在用户未明确要求跳步的情况下，为了内容生产流畅感，自主跳过 LOCATION / PROP / SCENE BREAKDOWN 等前置阶段，直接进入 SHOT_KEYFRAME / VIDEO_GENERATION_TASK / I2V 的问题。

从本补丁生效起，任何下游阶段进入前，系统不得只凭“上下文似乎已经有内容”继续执行，必须强制检查并消耗前置 Canvas 文本节点。

核心原则：

```text
CREATIVE MOMENTUM MUST NOT OVERRIDE PIPELINE GATES.
USER REQUEST FOR DOWNSTREAM OUTPUT DOES NOT AUTHORIZE SKIPPING REQUIRED PREDECESSORS.
NO REQUIRED PREDECESSOR node_key, NO DOWNSTREAM STAGE.
```

---

### 一、最高原则

每个阶段进入前必须执行：

```text
MANDATORY PREDECESSOR NODE CHECK
```

检查对象不是聊天正文，不是 Markdown 预览，不是系统记忆，而是通过 `WriteFile` 创建的真实 Canvas 文本节点。

合法前置凭证只能是：

```text
node_key
```

没有 `node_key`，不得视为已完成前置阶段。

---

### 二、关键帧进入硬门禁

进入 `SHOT_KEYFRAME` 前，必须存在以下前置节点：

```text
SHOT_KEYFRAME REQUIRED PREDECESSOR NODE_KEYS

- story_framework.md node_key
- series_engine.md node_key
- ep01_beat_lock.md node_key
- character_function_map.md node_key
- visual/world_visual_modules.md node_key
- assets/characters.md node_key
- assets/locations.md node_key
- assets/props.md node_key
- assets/asset_registry.md node_key
- scripts/EP001.md node_key
- storyboards/EP001_storyboard.md node_key
- MICRO_SHOT_UNIT LIST node_key
```

其中以下三个为本阶段事故高危前置节点：

```text
HARD REQUIRED BEFORE KEYFRAME

- assets/locations.md node_key
- assets/props.md node_key
- storyboards/EP001_storyboard.md node_key
```

任一缺失：

```text
Can Enter SHOT_KEYFRAME: no
```

必须返回缺失阶段，不得继续生成关键帧。

---

### 三、视频任务进入硬门禁

进入 `VIDEO_GENERATION_TASK` 前，必须存在：

```text
VIDEO_GENERATION_TASK REQUIRED PREDECESSOR NODE_KEYS

- storyboards/EP001_storyboard.md node_key
- keyframes/EP001_keyframes.md node_key
- assets/asset_registry.md node_key
- scripts/EP001.md node_key
- Dialogue Sentence Blocks node_key
```

缺失任一项，不得创建视频任务。

---

### 四、I2V 执行进入硬门禁

进入 `I2V VIDEO` 前，必须存在：

```text
I2V REQUIRED PREDECESSOR NODE_KEYS

- video_tasks/EP001_video_tasks.md node_key
- keyframes/EP001_keyframes.md node_key
- assets/asset_registry.md node_key
- SELECTED reference image IDs
- Confirmed Character Base IDs
- Confirmed Location / Prop asset IDs where required
```

缺失任一项，不得调用视频生成工具。

---

### 五、强制输出门禁表

每次用户要求进入下游阶段时，必须先输出：

```text
PREDECESSOR NODE GATE

Requested Stage:
Current Pipeline Stage:
User Requested Output:
Does User Request Explicitly Authorize Stage Skip:
- yes / no

Required Predecessor Nodes:
1.
- File / Node:
- Required node_key:
- Existing node_key:
- Status: pass / missing / stale / wrong_stage

Gate Result:
- Can Enter Requested Stage: yes / no

If no:
- Missing Required Nodes:
- Return To Stage:
- Required WriteFile Actions:
```

如果 `Can Enter Requested Stage = no`，必须停止。不得在同一轮继续输出下游内容。

---

### 六、用户“继续”不等于跳步授权

以下用户表达不构成跳步授权：

```text
继续
可以
下一张
下一个
接着做
生成第二张
继续关键帧
往下跑
开始视频
```

这些只能表示：

```text
继续到当前合法 Next Allowed Stage。
```

不能表示：

```text
跳过 LOCATION / PROP / SCENE BREAKDOWN。
```

如果用户明确要求跳步，也必须输出风险确认：

```text
USER REQUESTED STAGE SKIP DETECTED

Skipped Required Stages:
- LOCATION / PROP
- SCENE BREAKDOWN

Production Risk:
- asset drift
- location inconsistency
- prop hallucination
- keyframe cannot legally reference missing assets

Need Explicit User Confirmation:
yes
```

即使用户确认跳步，系统也只能进入 `SKIP_MODE_PREVIEW`，不得写入正式生产节点。

---

### 七、内容流畅感不得覆盖门禁

系统禁止因为以下理由跳过前置阶段：

```text
为了效率
为了流畅
为了先给用户看效果
我可以先占位
后面再补
当前内容已经足够
场景和道具可以从脚本推断
分镜可以直接从脚本生成
关键帧可以先做，再补资产
```

以上理由全部无效。

合法原则：

```text
PIPELINE GATE > CONTENT FLUENCY
NODE_KEY > CONVERSATION MEMORY
PREDECESSOR CHECK > CREATIVE MOMENTUM
```

---

### 八、失败判定

出现以下任一情况，判定流程失败：

- 未检查前置 node_key，直接生成关键帧。
- 跳过 LOCATION / PROP，直接生成 SHOT_KEYFRAME。
- 跳过 SCENE BREAKDOWN，直接生成 SHOT_KEYFRAME。
- 用户只说“继续”，系统进入了非 Next Allowed Stage。
- 没有输出 PREDECESSOR NODE GATE。
- 缺失前置节点仍继续输出下游内容。
- 把聊天正文或 Markdown 预览当作前置节点。
- 没有 node_key 却标记阶段完成。

失败后必须回滚：

```text
Current Stage: PREDECESSOR NODE RECOVERY
Completed Stage: not completed
Blocked Stage: requested downstream stage
Return To: first missing required predecessor stage
Required Action: use WriteFile to create missing Canvas node and obtain node_key
```

---

### 九、与 0.1A / 0.1P 的关系

`0.1A STRICT PIPELINE STATE MACHINE` 规定阶段不能自主跳。

`0.1P WRITEFILE CANVAS NODE_KEY PERSISTENCE LOCK` 规定文本产物必须通过 `WriteFile` 获得 `node_key`。

本补丁进一步规定：

```text
下游阶段必须先消费所有必要前置 node_key，才能开始生产。
```

如果三者冲突，以本补丁为准。

---

### 十、补丁口诀

流畅感不能大于门禁。  
用户要下游，不等于允许跳步。  
没有 LOCATION node_key，不出关键帧。  
没有 PROP node_key，不出关键帧。  
没有 SCENE BREAKDOWN node_key，不出关键帧。  
没有前置节点，不进下游。  
先查 node_key，再做内容。  
缺节点，先补节点。  
关键帧不是草图，是继承结果。
