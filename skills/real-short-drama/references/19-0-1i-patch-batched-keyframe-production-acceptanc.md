## 0.1I PATCH：BATCHED KEYFRAME PRODUCTION ACCEPTANCE GATE

### 批量关键帧生产验收门禁

【补丁目的】

修复以下问题：

1. 系统虽然采用 MICRO_SHOT_UNIT，但只输出碎镜头表和 EDL，缺少 SHOT_KEYFRAME / VIDEO_GENERATION_TASK / BATCH_KEYFRAME_SEQUENCE。
2. 系统输出看起来像 v34，但实际仍不能驱动批量关键帧视频生成。
3. 60s / 90s 单集的 MICRO_SHOT_UNIT 数量、素材冗余、硬切数量不稳定。
4. ALT / INSERT / REACTION 镜头被写成“建议补充”，没有纳入正式生成素材计划。
5. VIDEO_GENERATION_TASK 混合多个空间，导致 batch 生成时空间、角色和道具状态混乱。
6. PPT、手机屏幕、网页、字幕卡等文字元素直接进入 AI 视频生成画面，造成乱码和画面污染。
7. 3 秒 hook 被会议室全景、空镜、走廊过渡等低冲突镜头占用。

从本补丁生效起，v34 系列分镜输出必须通过 `BATCHED KEYFRAME PRODUCTION ACCEPTANCE GATE`，否则不得进入 I2V / 视频生成阶段。

---

### 一、最高原则

```text
LOOKS LIKE v34 ≠ PASSES v34.
```

一个输出只有在同时具备以下五层结构时，才算 v34 合格：

```text
1. MICRO_SHOT_UNIT LIST
2. SHOT_KEYFRAME LIST
3. VIDEO_GENERATION_TASK / BATCH PLAN
4. BATCH_KEYFRAME_SEQUENCE
5. SELECTS_EDL BY MICRO_SHOT_UNIT
```

缺少任一项，判定：

```text
v34 output failed
Current Stage: MICRO_SHOT_UNIT / BATCH KEYFRAME PLANNING RETRY
Next Allowed Stage: complete v34 five-layer output retry
```

---

### 二、60s 单集节奏软区间验收标准

```text
60s EPISODE RHYTHM SOFT RANGE

MICRO_SHOT_UNIT Count: soft range, not hard KPI
Recommended MICRO_SHOT_UNIT Count: 14–26
Dialogue-heavy confrontation style: 12–20 allowed
High-density reveal / evidence montage style: 22–32 allowed
VIDEO_GENERATION_TASK Count: 4–8
Generated Material Target: 90–120s
Expected Trim Rate: 25%–40%
Final Selected Shot Count: 14–26
Hard Cut Count: reference only, not standalone fail condition
Reaction Insert Count: must be enough to support pressure / payoff, not count-padding
Prop / Evidence Insert Count: must support reveal, not interrupt dialogue
Average Selected Shot Length: 2.3–4.2s
Longest Dialogue Shot: ≤7s preferred, but complete sentence block has priority
Dialogue Rule: shorten by rewriting into a shorter complete sentence, never by fragmenting the sentence
```

诊断规则：

```text
MICRO_SHOT_UNIT Count below soft range = pacing review required
MICRO_SHOT_UNIT Count above soft range = fragmentation review required
MICRO_SHOT_UNIT Count alone cannot determine failed
```

失败判定：

```text
60s 单集生成素材少于 90s = failed
60s 单集没有正式 ALT / INSERT / REACTION 素材计划 = failed
60s 单集只有 MICRO_SHOT_UNIT 表和 EDL，没有 BATCH_KEYFRAME_SEQUENCE = failed
60s 单集由 8–15s 长镜头堆成流水账 = failed
60s 单集核心对白句块被拆成半句话 = failed
60s 单集为了凑 unit 数量新增无叙事来源镜头 = failed
```

---

### 三、90s 单集节奏软区间验收标准

```text
90s EPISODE RHYTHM SOFT RANGE

MICRO_SHOT_UNIT Count: soft range, not hard KPI
Recommended MICRO_SHOT_UNIT Count: 20–38
Dialogue-heavy confrontation style: 18–30 allowed
High-density reveal / evidence montage style: 32–48 allowed
Action / pursuit / multi-location style: 35–55 allowed with continuity check
VIDEO_GENERATION_TASK Count: 6–12
Generated Material Target: 135–180s
Expected Trim Rate: 25%–40%
Final Selected Shot Count: 20–38
Hard Cut Count: reference only, not standalone fail condition
Reaction Insert Count: must be enough to support pressure / payoff, not count-padding
Prop / Evidence Insert Count: must support reveal, not interrupt dialogue
Average Selected Shot Length: 2.5–4.5s
Longest Dialogue Shot: ≤8s preferred, but complete sentence block has priority
Dialogue Rule: shorten by rewriting into a shorter complete sentence, never by fragmenting the sentence
```

诊断规则：

```text
MICRO_SHOT_UNIT Count below soft range = pacing review required
MICRO_SHOT_UNIT Count above soft range = fragmentation review required
MICRO_SHOT_UNIT Count alone cannot determine failed
```

失败判定：

```text
90s 单集生成素材少于 135s = failed
90s 单集输出 “12 个 SHOT UNIT / 每个 8–15s” = failed
90s 单集没有 BATCH_KEYFRAME_SEQUENCE = failed
90s 单集核心对白句块被拆成半句话 = failed
90s 单集为了凑 unit 数量新增无叙事来源镜头 = failed
90s 单集 EDL 按整段长 unit 顺序铺开，没有 micro cut 结构 = failed
```

---

### 三A、MICRO_SHOT_DENSITY DIAGNOSIS 必填

每集进入 SHOT_KEYFRAME / VIDEO_GENERATION_TASK 前，必须输出：

```text
MICRO_SHOT_DENSITY DIAGNOSIS

Final Runtime Target:
Episode Cutting Profile:
Primary Drama Mode:
Dialogue Sentence Block Count:
Core Memorable Line Count:
MICRO_SHOT_UNIT Count:
Formal Insert / Reaction / Prop Unit Count:
Average Selected Shot Length:
Longest Dialogue Shot:
Long-Take Risk:
Fragmentation Risk:
Unit Count Assessment: too_low / healthy / too_high
Revision Required: yes / no
Reason:
```

规则：

```text
Unit Count Assessment 不能单独决定 failed。
只有当 unit 数量问题造成 Dialogue Integrity / Drama Integrity / Editability / Information Density 失败时，才判定 failed。
```

---

### 四、ALT / INSERT / REACTION 正式素材化

ALT、INSERT、REACTION 不得写成“建议补充”。

错误写法：

```text
建议补充素材：
- U01B_ALT
- U02B_ALT
- U03D_ALT
```

正确写法：

```text
FORMAL GENERATED MATERIAL PLAN

PRIMARY MICRO_SHOT_UNIT:
- U01A
- U01B
- U01C

FORMAL ALT / INSERT / REACTION MICRO_SHOT_UNIT:
- U01B_ALT: alternate speaker angle
- U02B_ALT: reaction insert
- U03D_ALT: office gossip cutaway

All ALT / INSERT / REACTION units are part of the official generated material target.
```

规则：

```text
Generated Material Target = primary units + formal ALT / INSERT / REACTION units
```

只有正式纳入生成计划，才能计入素材冗余。

---

### 五、VIDEO_GENERATION_TASK 组合规则

每个 VIDEO_GENERATION_TASK 默认包含：

```text
3–6 MICRO_SHOT_UNIT
```

推荐生成时长：

```text
6–15s
```

高风险上限：

```text
18s max, only if same space and same continuity
```

同一 VIDEO_GENERATION_TASK 内应保持：

```text
same location
same lighting
same costume state
same character set
same prop continuity
same emotional progression
```

禁止默认混合：

```text
会议室 → 走廊
办公区 → 陈总办公室
内景 → 外景
白天 → 夜晚
两人对话 → 群像会议
高动作转场 → 静态反应
```

如确需跨空间组合，必须标注：

```text
Batch Risk: high
Reason:
Fallback Split Plan:
- Task A:
- Task B:
```

没有 high-risk 标注和 fallback split plan 的跨空间 batch，判定失败。

---

### 六、BATCH_KEYFRAME_SEQUENCE 必填

每个 VIDEO_GENERATION_TASK 必须包含 `BATCH_KEYFRAME_SEQUENCE`。

模板：

```text
BATCH_KEYFRAME_SEQUENCE

Video Task ID:
Tool Call Unit: VIDEO_GENERATION_TASK
Output Video Count: 1
Included MICRO_SHOT_UNIT Count:
Included MICRO_SHOT_UNIT IDs:
Total Generated Duration:
Expected Selected Duration:
Scene Continuity:
Lighting Continuity:
Character Continuity:
Prop Continuity:
Batch Risk:
Fallback Split Plan:

Keyframes:
1.
- micro_shot_unit_id:
- shot_keyframe_id:
- internal_time_range:
- duration:
- shot_size:
- camera_angle:
- action_moment:
- emotion_state:
- hard_cut_role:

2.
- micro_shot_unit_id:
- shot_keyframe_id:
- internal_time_range:
- duration:
- shot_size:
- camera_angle:
- action_moment:
- emotion_state:
- hard_cut_role:

Batch Prompt EN:
Native Video Audio Request:
No Text / No Caption Policy:
```

缺少该结构，不得进入 I2V。

---

### 七、屏幕文字与字幕卡污染控制

以下元素不得作为可读文字直接进入 AI 视频生成画面：

```text
PPT 页面文字
手机屏幕文字
网页文字
招聘网站搜索词
聊天界面文字
黑底白字字幕卡
标题卡
可读 UI
```

正确处理：

```text
PPT: only blurred charts, blocks, non-readable graphics
Phone: show hand, reflection, camera action, not readable screen text
Website: blurred interface, cursor / typing action, no readable words
Subtitle card: post-production text layer, not AI video generation unit
```

规则：

```text
TEXT CARD is not MICRO_SHOT_UNIT.
TEXT CARD belongs to POST-PRODUCTION GRAPHIC LAYER.
```

如果出现 `UNIT_xx - 字幕卡片` 并作为 AI 视频生成 unit，判定失败。

---

### 八、3 秒 Hook 证据优先规则

60s / 90s 竖屏短剧开头 3 秒不得默认使用低冲突建立镜头。

禁止开头 3 秒只出现：

```text
会议室全景
公司外景
走廊空镜
人物走路
环境建立
慢速氛围镜头
```

3 秒内必须出现至少一个冲突证据：

```text
偷看 / 偷拍 / 截图
药盏 / 血迹 / 证据物
反派眼神交换
主角被羞辱动作
关键道具被调包
权力方冷漠反应
```

职场复仇类推荐 Hook：

```text
00:00–00:01.5 反派手机偷拍方案
00:01.5–00:03.0 老板默许 / 反派得意
00:03.0–00:05.0 女主仍在认真讲解，形成信息差
```

---

### 九、验收失败后处理

如果不满足本门禁：

```text
Current Stage: MICRO_SHOT_UNIT / BATCH KEYFRAME PLANNING RETRY
Completed Stage: not completed
Next Allowed Stage: complete five-layer v34 output retry

Blocked Stages:
- VIDEO GENERATION TOOL CALL
- I2V VIDEO
- SELECTS EDL FINALIZATION
- FINAL ASSEMBLY PLAN
```

不得进入视频生成。

---

### 十、补丁口诀

像 v34 不等于过 v34。  
五层缺一层，不进 I2V。  
没有 batch keyframe sequence，不算批量关键帧。  
ALT 不是建议，ALT 是正式素材。  
同一个 task 尽量同空间。  
屏幕文字不进 AI 视频画面。  
字幕卡不是 micro shot。  
3 秒 hook 先给冲突证据，不给空镜。  
数量只做诊断，不做单独 KPI。
对白完整、戏剧完整、可剪辑、信息密度，才是最终验收。

---
