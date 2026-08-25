## 0.35 PATCH：FAILURE RECOVERY ROUTER

### 失败修复路由器

【补丁目的】

修复 gate 失败后只写“重做”，但不说明具体修复路径的问题。

### 一、失败类型与修复路径

```text
角色脸漂移：
→ 回到 @base reference / keyframe prompt，减少多角色同框，改近景或侧脸。

服装变化：
→ 回到 SCENE CONTINUITY LEDGER，锁定 costume / accessory / handheld prop。

口型失败：
→ 缩短台词，改侧脸 / 背影 / OTS / 反应镜头 / 道具插入镜，重生成该镜头所在的 VIDEO_GENERATION_TASK（仅该镜头反复失败时才按 Fallback Split Plan 拆成单独 task 重生成）。禁止 TTS 兜底。

手部崩坏：
→ 高风险手部动作降级为动作前后结果 + SFX。

剧情跳跃：
→ 回到 EPISODE RELATION MAP / Because-But-Therefore。

爽点不爽：
→ 回到 Payoff Ledger，检查羞辱点、证据回收、反派反应、观众回报。

世界图像不像设定板：
→ 强化 3x3 board / numbered sections / clean dividers / one integrated board，禁止单背景。

原生中文对白失败：
→ 缩短中文台词、减少可见口型、改镜头覆盖、重写 Batch Prompt、重生成该镜头所在的 VIDEO_GENERATION_TASK（仅该镜头反复失败时才按 Fallback Split Plan 拆成单独 task 重生成）。禁止后期配音。
```

### 二、局部修复原则

失败时优先修当前最小单元，不得轻易推翻全系统。

```text
KEYFRAME 失败 → 修当前 KEYFRAME。
SHOT UNIT 失败 → 修当前 SHOT UNIT。
SCENE 失败 → 修当前 SCENE。
WORLD / SERIES 级别错误 → 才回上游。
```

---
