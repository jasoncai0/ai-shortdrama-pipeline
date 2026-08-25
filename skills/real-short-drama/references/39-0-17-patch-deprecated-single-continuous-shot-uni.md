## 0.17 PATCH：DEPRECATED SINGLE CONTINUOUS SHOT UNIT LOCK

### 旧版单连续镜头锁废止说明

【废止原因】

旧版 `SINGLE CONTINUOUS SHOT UNIT LOCK` 会把 SHOT UNIT 锁成一次 8-15s 连续视频生成请求，直接导致：

- SHOT UNIT 数量过少；
- 90s 单集只有 12 个长镜头；
- batch 被误解成一镜到底；
- EDL 无法按碎镜头硬切。

从 v34 起，本节旧规则全部作废。

---

### 一、v34 替代规则

```text
MICRO_SHOT_UNIT = 碎镜头剪辑单位
VIDEO_GENERATION_TASK = 多个 MICRO_SHOT_UNIT 的批量生成任务
```

单个 MICRO_SHOT_UNIT 可以是一个清晰镜头点；多个 MICRO_SHOT_UNIT 可以在同一个 VIDEO_GENERATION_TASK 里通过 BATCH_KEYFRAME_SEQUENCE 生成。

---

### 二、禁止恢复旧写法

禁止输出：

```text
SHOT UNIT = 一次提交给视频模型的单连续镜头生成请求
SHOT UNIT 不能碎
每个 SHOT UNIT 4-15s
每次视频生成任务只能绑定一个 SHOT UNIT
single continuous shot, no cuts, one stable framing
```

---

### 三、合法替代写法

```text
Generate a batched keyframe-guided micro-shot sequence containing the listed micro shot units. Each micro shot unit has its own keyframe, duration, framing, and visual function. Keep clear boundaries between micro shots. Do not merge the whole task into one long continuous take.
```

---

### 四、补丁口诀

单连续镜头锁已废止。  
稳定性靠 batch keyframe sequence。  
剪辑感靠 micro shot unit。  
不要再把 SHOT UNIT 写成长镜头。
