## 0.43 PATCH：EDITABLE FOOTAGE DENSITY & MICRO-SHOT HARD-CUT MATERIAL LOCK

### 可剪素材密度与碎镜头硬切成片冗余锁

【补丁目的】

修复系统只生成刚好成片时长、素材没有剪辑余量，或生成 12 个长镜头导致无法硬切的问题。

---

### 一、成片时长 ≠ 生成素材时长

```text
FINAL_RUNTIME_TARGET = 60s 时：GENERATED_FOOTAGE_TARGET = 90-120s
FINAL_RUNTIME_TARGET = 90s 时：GENERATED_FOOTAGE_TARGET = 135-180s
EDITABLE_SURPLUS_RATIO = 1.5x-2.0x
EXPECTED_TRIM_RATE = 25%-40%
```

---

### 二、v34 时长单位重新定义

```text
MICRO_SHOT_UNIT = 剪辑最小单位，时长视戏而定（对白 / 情绪不设上限，见 §0.1K）
VIDEO_GENERATION_TASK = 6-15s 为主，max 18s（一次工具调用 = 一个视频文件，见 §0.1J）
```

禁止旧定义：

```text
SHOT UNIT = 4-15s Seedance 稳定提交边界
```

Seedance / I2V 的稳定提交边界现在是 VIDEO_GENERATION_TASK，不是 MICRO_SHOT_UNIT。

---

### 三、素材用途分级

```text
MICRO_SHOT_TYPE:
- dialogue_closeup
- reaction_cutaway
- prop_insert
- evidence_insert
- hand_detail
- action_bridge
- walking_transition
- atmosphere_cutaway
- payoff_beat
- cliffhanger_beat
```

推荐时长（仅参考，非上限）：

```text
dialogue_closeup: 戏需要多长就多长（完整句块优先，见 §0.1K）
reaction_cutaway: 约 1.5-3s
prop_insert / hand_detail: 约 1-2.5s
action_bridge: 约 2-4s
walking_transition: 约 2-4s
atmosphere_cutaway: 约 1-2s（也可按氛围需要拉长）
payoff_beat: 约 2-4s
cliffhanger_beat: 约 2-4s
```

---

### 四、90s 单集素材密度（软区间诊断，非硬 KPI）

```text
MICRO_SHOT_UNIT Count: soft range, not hard KPI（参考 20-38，见 §0.1L）
VIDEO_GENERATION_TASK Count: 6-12
Generated Footage Target: 135-180s（保留可剪余量）
Final Selected Shot Count: reference only
Hard Cut Count: reference only, not standalone fail condition
```

---

### 五、补丁口诀

素材不是成片。  
镜头要碎，任务可打包。  
走路别拖，反应别拖，道具别拖。  
宁可多给 cutaway，不要长水镜头。  
没有足够 MICRO_SHOT_UNIT，就没有硬切素材包。
