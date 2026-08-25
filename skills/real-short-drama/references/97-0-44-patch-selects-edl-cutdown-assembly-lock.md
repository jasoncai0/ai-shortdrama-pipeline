## 0.44 PATCH：SELECTS EDL & CUTDOWN ASSEMBLY LOCK

### 精选片段 EDL 与成片组装锁

【补丁目的】

修复以下问题：

1. 系统生成 90–120s 素材后，没有告诉用户哪些能用、哪些该剪。
2. 素材多了，但后期仍要从头重新判断剪辑点。
3. 每条 SHOT UNIT 只有生成 prompt，没有可执行剪辑建议。
4. 片段内部有水分，但没有标注入点、出点、保留段和废弃尾巴。
5. 最终发布版缺少 EDL，导致素材包无法快速剪成 30s / 60s / 90s。
6. 没有区分“主线必保素材”“可选反应素材”“兜底补时素材”。

从本补丁生效起，任何进入 I2V / 成片组装阶段的单集，必须输出 `SELECTS EDL` 和 `CUTDOWN ASSEMBLY PLAN`。

### 一、核心原则

生成素材不是终点。

素材必须经过：

```text
Generated Footage → Selects → Cutdown EDL → Final Assembly
```

每个 SHOT UNIT 不只要写“生成什么”，还要写“怎么剪”。

### 二、SELECTS EDL 定义

每集必须输出：

```text
SELECTS EDL

Episode ID:
Final Runtime Target:
Generated Footage Total:
Target Edited Runtime:
Expected Trim Rate:

SELECT_001:
- source_shot_unit_id:
- source_duration:
- recommended_in:
- recommended_out:
- selected_duration:
- select_type:
  main_story / reaction / insert / bridge / payoff / cliffhanger / fallback
- edit_function:
- must_keep:
  yes / no
- can_trim:
  yes / no
- can_delete:
  yes / no
- audio_use:
  native_audio / sfx_only / silent_visual / no_audio
- cut_reason:
- next_cut_to:
```

规则：

- 每个 SHOT UNIT 必须至少给出一个推荐可用区间。
- 如果片段内部明显有水分，必须标注 `recommended_in / recommended_out`。
- 不允许只输出素材清单，不输出剪辑建议。
- 不允许让所有素材都 `must_keep: yes`。
- 反应镜头、道具镜头、空镜必须能作为 hard cut 插入主线。
- 可删素材必须明确标注，帮助后期快速丢弃。

### 三、CUTDOWN ASSEMBLY PLAN 成片组装计划

每集必须输出至少一个目标版本。

默认输出 60s 版本：

```text
CUTDOWN ASSEMBLY PLAN

Version:
- 60s_publish_cut

Runtime Target:
- 55–65s

Assembly Order:
1. SELECT_001
2. SELECT_004
3. SELECT_002
4. SELECT_007
...

Rhythm Logic:
- 0–3s:
- 3–15s:
- 15–35s:
- 35–50s:
- 50–60s:

Must-Keep Beats:
- 
Optional Cutaways:
- 
Fallback Filler:
- 
Hard-Cut Points:
- 
Audio Continuity Notes:
- 
Subtitle Placement Notes:
- 
```

规则：

- 成片顺序不一定等于素材生成顺序。
- 如果某个走路镜头只需要前 1.5 秒，必须在 Assembly Order 中只使用对应 SELECT 区间。
- 反应镜头可以插入对白之间，降低口型风险。
- 道具镜头可以用于覆盖原生音频失败段。
- 空间建立镜头只允许短用，不得长占时长。

### 四、三档成片版本

如果素材足够，建议输出三档：

```text
CUTDOWN VERSIONS:
- 30s_hook_cut: 只保留钩子、反转、悬念
- 60s_publish_cut: 标准发布版
- 90s_story_cut: 关系更清楚的剧情版
```

但默认至少必须输出：

```text
60s_publish_cut
```

### 五、素材角色分级

每条 SELECT 必须属于以下之一：

```text
SELECT ROLE:
- A-roll main story：主线叙事，不可轻易删
- B-roll reaction：反应 / 眼神 / 旁观者
- Insert proof：证据 / 道具 / 手机 / 文件
- Bridge motion：走位 / 推门 / 坐下 / 转场
- Payoff impact：爽点兑现 / 反派崩溃
- Cliffhanger hook：结尾悬念
- Fallback filler：补时长兜底，可不用
```

规则：

- `A-roll main story` 不得低于最终成片时长的 50%。
- `B-roll reaction + Insert proof` 必须占最终成片 20%–35%。
- `Bridge motion` 不得超过最终成片 15%。
- `Fallback filler` 只能在时长不足时使用。
- `Bridge motion` 不得成为水时长主力。

### 六、可删尾巴标记

每条 SHOT UNIT 的 `Disposable Tail` 必须进入 EDL：

```text
DISPOSABLE TAIL MAP

SHOT_UNIT_ID:
- disposable_from:
- disposable_to:
- reason:
- safe_to_cut:
```

示例：

```text
SHOT_UNIT_04:
- disposable_from: 00:03.0
- disposable_to: 00:06.0
- reason: 后半段只是继续走路，无新增信息。
- safe_to_cut: yes
```

### 七、原生音频失败时的剪辑兜底

如果某条素材原生中文对白失败，但画面可用，必须标注：

```text
AUDIO FAILURE EDIT OPTION:
- keep_visual_as_reaction:
- cover_with_os:
- cut_to_prop_insert:
- use_sfx_only:
- delete_audio_keep_visual:
- regenerate_required:
```

规则：

- 对白失败不一定整条废弃。
- 如果画面是反应、手部、道具、背影，可以保留视觉。
- 正脸对白失败且无法覆盖，必须重生成该镜头所在的 VIDEO_GENERATION_TASK（仅该镜头反复失败时才按 Fallback Split Plan 拆成单独 task 重生成）。
- 不允许改用后期 TTS 兜底。

### 八、最终交付清单

每集完成后必须输出：

```text
FINAL DELIVERY MANIFEST

Episode ID:
Final Runtime Target:
Generated Footage Total:
Estimated Usable Footage:
Final Cut Version:
Selected Runtime:
Unused Runtime:
Trim Rate:

Files / Assets:
- WORLD_VISUAL_BIBLE:
- CHARACTER_BASE:
- COSTUME_FULL_BODY:
- LOCATION:
- PROP:
- KEYFRAME:
- VIDEO_SHOT_UNITS:
- SELECTS_EDL:
- CUTDOWN_ASSEMBLY_PLAN:
- RUNTIME_STATE_SNAPSHOT:
- CONFIRMED_ASSET_SNAPSHOT:

Continuity Carry Forward:
- 
```

### 九、输出前 EDL 自检

每集输出前必须检查：

【EDL 完整性】

- 是否为每个 SHOT UNIT 输出了 SELECT？
- 是否有 recommended_in / recommended_out？
- 是否区分 must_keep / can_trim / can_delete？
- 是否输出了 60s_publish_cut？
- 是否有 Assembly Order？
- 是否有 Hard-Cut Points？

【剪辑效率】

- 走路 / 开门 / 坐下 / 转身是否没有长占最终时长？
- 是否能剪掉 25–40% 素材仍够成片？
- 是否有足够反应 / 道具 / 眼神镜头覆盖对白风险？
- 是否标注了 Disposable Tail？

【发布可用性】

- 最终预计成片是否能达到目标时长？
- 是否有钩子、升级、反转、悬念？
- 是否没有把素材包当最终片直接交付？
- 是否输出了 Runtime State 和 Confirmed Asset Snapshot 供下一集继承？

不通过则必须回到 `SHOT UNIT / SELECTS EDL / CUTDOWN ASSEMBLY PLAN` 修正。

### 十、补丁口诀

素材多不是目的，能剪才是目的。  
每条素材都要告诉后期：从哪进，从哪出，哪里可以扔。  
生成 100 秒，不等于交 100 秒。  
先 Selects，再 EDL，再 Final Cut。  
走路是桥，不是主菜。  
反应、道具、眼神，才是硬切节奏器。  
正脸对白失败时，能用反应和道具救；不能用 TTS 救。  
每集结束必须交付：素材、精选、EDL、成片组装、运行时状态、资产快照。

---
