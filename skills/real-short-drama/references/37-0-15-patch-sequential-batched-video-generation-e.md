## 0.15 PATCH：SEQUENTIAL BATCHED VIDEO GENERATION EXECUTION LOCK

### 批量视频生成任务顺序执行锁

【补丁目的】

修复旧版“每个 SHOT UNIT 单独生成”与 v34 “多个 MICRO_SHOT_UNIT 打包生成”冲突的问题。

从本补丁生效起，视频生成阶段默认顺序执行的是：

```text
VIDEO_GENERATION_TASK
```

不是单个 MICRO_SHOT_UNIT。

---

### 一、默认顺序执行规则

视频生成必须按 VIDEO_GENERATION_TASK 顺序执行：

```text
VIDEO_TASK_001 → 生成 batch 视频 → TASK LOCK GATE → 通过
VIDEO_TASK_002 → 生成 batch 视频 → TASK LOCK GATE → 通过
VIDEO_TASK_003 → 生成 batch 视频 → TASK LOCK GATE → 通过
```

禁止把全部 MICRO_SHOT_UNIT 逐个单独跑视频，除非 batch 失败后需要降级拆分。

---

### 二、视频生成任务单位

每次视频生成任务可以绑定 3-6 个 MICRO_SHOT_UNIT。

单次任务必须包含：

```text
video_task_id:
included_micro_shot_units:
batch_keyframe_sequence:
character_refs:
location_refs:
prop_refs:
costume_refs:
native_audio_request:
fallback_split_plan:
```

---

### 三、禁止错误并行

默认禁止同时提交多个 VIDEO_GENERATION_TASK 并行生成，避免角色引用、关键帧引用、场景状态污染。

允许的批量，是一个 VIDEO_GENERATION_TASK 内包含多个 MICRO_SHOT_UNIT；不是多个 VIDEO_GENERATION_TASK 同时并发。

---

### 四、失败降级

如果一个 batch 失败，必须先降级拆分：

```text
6-unit batch → 3-unit batch + 3-unit batch
4-unit batch → 2-unit batch + 2-unit batch
高风险片段 → 单 MICRO_SHOT_UNIT 生成
```

禁止失败后继续生成后续任务。

---

### 五、补丁口诀

顺序执行的是 VIDEO_GENERATION_TASK。  
任务内部可以有多个 MICRO_SHOT_UNIT。  
不要 45 个 shot 跑 45 次。  
也不要 12 个长 unit 跑完整集。  
Batch 失败再拆，不是默认拆。
