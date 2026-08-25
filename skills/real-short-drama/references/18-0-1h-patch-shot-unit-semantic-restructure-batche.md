## 0.1H PATCH：SHOT UNIT SEMANTIC RESTRUCTURE & BATCHED KEYFRAME VIDEO TASK LOCK

### Shot Unit 语义重构与批量关键帧视频任务锁

【补丁目的】

修复 v33 仍可能被旧规则覆盖的问题：

1. 旧规则把 `SHOT UNIT` 解释为“一次提交给 Seedance / I2V 的 4-15s 连续视频生成请求”。
2. 旧规则写了“SHOT UNIT 不能碎”，导致 90s 单集只输出 12 个 8-15s 长 unit。
3. 旧 prompt 模板强制 `single continuous shot / no shot changes / one stable framing`，导致 batch 被误生成一镜到底。
4. 旧流程默认“每个 SHOT UNIT 单独提交视频生成”，无法满足“镜头碎、任务少”的生产诉求。
5. EDL 仍按整段 unit 顺序铺开，而不是按碎镜头硬切。

从本补丁生效起，系统必须进行术语重构，而不是只新增补丁。

---

### 一、最高优先级术语定义

```text
MICRO_SHOT_UNIT = 碎镜头剪辑单位 / shot / EDL 最小剪辑单位
SHOT_KEYFRAME = 每个 MICRO_SHOT_UNIT 的视觉关键帧
VIDEO_GENERATION_TASK = 一次提交给视频模型的批量生成任务
BATCH_KEYFRAME_SEQUENCE = 一个 VIDEO_GENERATION_TASK 内的关键帧序列
SELECTS_EDL = 最终按 MICRO_SHOT_UNIT 剪辑的精选 EDL
```

注意：

```text
SHOT UNIT 在 v34 中等同 MICRO_SHOT_UNIT。
SHOT UNIT 不再等于一次视频生成任务。
VIDEO_GENERATION_TASK 才是一次视频生成任务。
```

---

### 二、旧规则强制废止

以下旧规则全部作废，不得继续出现在执行结果中：

```text
DEPRECATED:
- SHOT UNIT = 一次提交给 Seedance 的连续视频生成需求
- SHOT UNIT 不能碎
- SHOT UNIT 默认 4-15s
- 一个 SHOT UNIT 单独跑一次视频
- 每次视频生成任务只能绑定一个 SHOT UNIT
- single continuous shot 作为全局默认 prompt
- no shot changes / one stable framing 作为 batch 默认
- 首帧 / 尾帧 / start frame / end frame 作为默认术语
```

如果旧规则与本补丁冲突，一律以本补丁为准。

---

### 三、MICRO_SHOT_UNIT 定义

`MICRO_SHOT_UNIT` 是很碎的镜头点，只承担一个剪辑功能。

合法示例：

```text
MICRO_SHOT_001 会议室冷白全景 1.5s
MICRO_SHOT_002 女主手按翻页笔 1.2s
MICRO_SHOT_003 反派手机边缘入画 1.5s
MICRO_SHOT_004 老板敷衍看表 1.5s
MICRO_SHOT_005 女主眼神反应 2s
MICRO_SHOT_006 证据道具特写 1.5s
MICRO_SHOT_007 女主短台词反击 4s
```

每个 MICRO_SHOT_UNIT 必须有：

```text
micro_shot_id:
duration:
hard_cut_role:
visual_function:
shot_keyframe_id:
composition:
shot_size:
camera_angle:
action_moment:
dialogue_cn:
expected_use:
```

---

### 四、默认时长标准

```text
insert / prop / hand detail: 1.0-2.5s
reaction close-up: 1.5-3s
establishing pressure cut: 1-2s
entrance / turn / sit / reach: 2-4s
power angle / payoff reaction: 2-4s
dialogue close-up: 3-6s
high-emotion dialogue: 6-8s max
```

禁止：

```text
无对白动作 6-8s
反应镜头 6s
道具特写 5s
走路开门坐下拖成 8s
一场对话只生成一个 12-15s 长镜头
90s 单集只有 12 个 unit
```

---

### 五、关键帧术语锁

默认使用：

```text
KEYFRAME
SHOT_KEYFRAME
BATCH_KEYFRAME_SEQUENCE
```

禁止默认使用：

```text
首帧
尾帧
start frame
end frame
first frame
last frame
```

除非用户明确要求首尾帧，否则所有视觉锚点都叫关键帧。

---

### 六、VIDEO_GENERATION_TASK 批量生成任务

一次 VIDEO_GENERATION_TASK 可以包含多个 MICRO_SHOT_UNIT。

默认组合：

```text
Included MICRO_SHOT_UNIT Count: 3-6
Recommended Task Duration: 6-15s
Maximum Task Duration: 18s
```

适合同 batch：

```text
同一场景
同一光线
同一服装
同一空间连续关系
人物数量稳定
道具状态连续
情绪递进清楚
```

不适合同 batch：

```text
换地点
换时间
换服装
复杂多人调度
强动作戏
从内景切到外景
角色状态大跳变
```

---

### 七、Batch 内部边界锁

VIDEO_GENERATION_TASK 必须明确：

```text
This task contains multiple micro shot units.
Do not merge them into one continuous long take.
Maintain clear boundaries between shot units.
Each unit should feel like a separate short shot segment.
The final edit will hard-cut or trim between these shot units.
```

禁止只写：

```text
single continuous shot, no cuts, one stable framing
```

因为这会把 batch 诱导成一镜到底。

---

### 八、Prompt 写法

#### 单个 MICRO_SHOT_UNIT 生成时

```text
Generate one short standalone micro shot unit, no subtitles, no captions, no text overlay. This is one short shot, not a full scene.
```

#### 多个 MICRO_SHOT_UNIT 批量生成时

```text
Generate a batched keyframe-guided micro-shot sequence containing the listed micro shot units. Each micro shot unit has its own keyframe, framing, duration, and visual function. Keep clear boundaries between units. Do not merge the whole task into one long continuous take. No subtitles, no captions, no text overlay, no music.
```

---

### 九、BATCH_KEYFRAME_SEQUENCE 模板

```text
BATCH KEYFRAME SEQUENCE

Video Task ID:
Included Micro Shot Units:
Total Generated Duration:
Expected Selected Duration:
Scene Continuity:
Lighting Continuity:
Character Continuity:
Prop Continuity:

Keyframes:
1.
- micro_shot_id:
- shot_keyframe_id:
- duration:
- shot_size:
- angle:
- action_moment:
- hard_cut_role:

Batch Prompt EN:
Native Video Audio Request:
Batch Risk:
Can Split If Failed:
Fallback Split Plan:
```

---

### 十、EDL 必须按 MICRO_SHOT_UNIT 剪

即使视频是 batch 生成，最终剪辑单位仍然是 MICRO_SHOT_UNIT。

SELECTS_EDL 必须写：

```text
Source Video Task:
Source Micro Shot Unit:
Recommended In:
Recommended Out:
Selected Duration:
Hard Cut Role:
Use Status:
```

禁止只写：

```text
Video Task 01 选用 10 秒
UNIT 01 选用 8 秒
```

正确：

```text
Video Task 01 / MICRO_SHOT_001 / 00:00-00:01.5 / use
Video Task 01 / MICRO_SHOT_002 / 00:01.5-00:03.0 / use
Video Task 01 / MICRO_SHOT_003 / 00:03.0-00:04.8 / trim
```

---

### 十一、90s 单集节奏软区间（诊断参考，非硬 KPI）

```text
MICRO_SHOT_UNIT Count: soft range, not hard KPI（参考 20–38）
VIDEO_GENERATION_TASK Count: 6-12
Average Micro Shot Duration: reference only
Final Selected Shot Count: reference only
Longest Dialogue Shot: 完整句块优先，时长视戏而定（不设硬上限）
Reaction Inserts: reference only
Prop / Evidence Inserts: reference only
Hard Cut Count: reference only, not standalone fail condition
```

诊断规则：

```text
MICRO_SHOT_UNIT Count below soft range = pacing review required
MICRO_SHOT_UNIT Count above soft range = fragmentation review required
MICRO_SHOT_UNIT Count alone cannot determine failed
完整核心台词 / 情绪铺垫被切碎 = failed（见 §0.1K）
```

出现以下结果直接判定失败：

```text
用一串无表演支撑的呆板长镜头铺满整集（如全程正面中景一镜到底）
EDL 无法按 MICRO_SHOT_UNIT 切片
没有 VIDEO_GENERATION_TASK 批量组合表
没有 SHOT_KEYFRAME / BATCH_KEYFRAME_SEQUENCE
完整核心台词被硬切碎（见 §0.1K）
```

---

### 十二、输出顺序强制

进入视频生产前必须输出：

```text
MICRO_SHOT_UNIT LIST
SHOT_KEYFRAME LIST
VIDEO_GENERATION_TASK PLAN
BATCH_KEYFRAME_SEQUENCE
BATCHED VIDEO PROMPT
SELECTS_EDL BY MICRO_SHOT_UNIT
```

禁止只输出：

```text
粗颗粒的长镜头分镜表（缺少 MICRO_SHOT_UNIT 切片结构）
一个完整视频 prompt
一个首尾帧 prompt
一段一镜到底画面描述
```

---

### 十三、补丁口诀

MICRO_SHOT_UNIT 要碎。  
VIDEO_GENERATION_TASK 可以打包。  
不用首尾帧，改叫关键帧。  
一个 shot 一个 keyframe。  
多个 shot 可以组成一个 batch。  
Batch 不是一镜到底。  
EDL 按 MICRO_SHOT_UNIT 剪，不按 batch 整段剪。  
模型跑的是 batch，剪辑用的是 shot。  
旧版 SHOT UNIT 语义全部作废。
