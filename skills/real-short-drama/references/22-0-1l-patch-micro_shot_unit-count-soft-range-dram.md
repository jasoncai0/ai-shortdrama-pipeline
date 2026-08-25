## 0.1L PATCH：MICRO_SHOT_UNIT COUNT SOFT RANGE & DRAMA INTEGRITY LOCK

### 碎镜头数量软区间与戏剧完整性锁

【补丁目的】

修复以下问题：系统为了满足 MICRO_SHOT_UNIT 数量下限而机械凑镜头；60s / 90s 单集被迫拆成过多碎 unit；每个动作、反应、气口都被单独拆成 unit；硬性 unit 数量压倒对白完整、情绪表演、爽点释放和叙事清晰。

从本补丁生效起：

```text
MICRO_SHOT_UNIT Count is a soft rhythm range, not a hard KPI.
```

最终验收以 Drama Integrity、Dialogue Integrity、Editability 和 Information Density 为准。

---

### 一、最高原则

```text
UNIT COUNT IS A SOFT RANGE, NOT A HARD KPI.
```

镜头不能太长，但也不能为了凑数量而把戏拆碎。

正确目标是：

```text
高信息密度 + 可剪辑冗余 + 完整台词 + 明确爽点
```

不是：

```text
机械达到 22 / 32 / 48 个 unit
```

---

### 二、废止硬性失败规则

废止以下规则：

```text
旧规则：60s 单集必须不少于 22 个 MICRO_SHOT_UNIT（deprecated, do not enforce）
旧规则：90s 单集必须不少于 32 个 MICRO_SHOT_UNIT（deprecated, do not enforce）
旧规则：MICRO_SHOT_UNIT Count 必须达到固定数量（deprecated, do not enforce）
```

替换为：

```text
MICRO_SHOT_UNIT Count below soft range = pacing review required
MICRO_SHOT_UNIT Count above soft range = fragmentation review required
```

---

### 三、Unit 数量必须由内容类型决定

系统必须先判断当前集类型，再决定 unit 密度。

```text
EPISODE CUTTING PROFILE

- dialogue_confrontation
- evidence_reveal
- action_escape
- emotional_breakdown
- status_reversal
- public_humiliation
- secret_exposure
- montage_payoff
```

不同类型使用不同 unit 密度：

```text
dialogue_confrontation:
- fewer visual units allowed
- complete dialogue blocks prioritized
- reaction inserts around complete lines
- no sentence fragmentation

evidence_reveal:
- more prop / evidence insert units allowed
- dialogue lines remain complete
- inserts support reveal, not interrupt it

action_escape:
- higher micro shot count allowed
- motion continuity protected
- no overlong walking / running shots

emotional_breakdown:
- longer performance shots allowed
- micro cuts used selectively
- facial reaction continuity protected

public_humiliation:
- medium-high cut density
- crowd reaction inserts allowed
- core insult / counterattack lines must remain complete
```

---

### 四、真正硬验收改成四项

```text
HARD ACCEPTANCE CRITERIA

1. Dialogue Integrity
- Core dialogue lines are complete sentence blocks.
- No key line is split into meaningless fragments.
- SELECTS_EDL preserves full reveal / threat / payoff lines.

2. Drama Integrity
- Every scene has clear pressure → counter → reversal / payoff.
- No unit exists only to fill count.
- Each retained shot changes information, emotion, status, or power.

3. Editability
- There are enough reaction / insert / alternate angles to cut.
- EDL is by MICRO_SHOT_UNIT, not by whole VIDEO_GENERATION_TASK.
- Low-value actions can be trimmed without breaking story.

4. Anti-Long-Take Failure
- The episode is not built from 8–15s continuous long units.
- Long dialogue shots exist only when the full sentence / performance requires it.
- No walking, sitting, turning, door-opening, phone-picking action is dragged.
```

---

### 五、MICRO_SHOT_UNIT 自检字段新增

每个 MICRO_SHOT_UNIT 必须新增：

```text
Unit Necessity Check:
- Does this unit carry new information / emotion / status / rhythm?
- Is this unit protecting a complete dialogue block?
- Is this unit only created to satisfy unit count?
- Can this unit be cut without damaging the scene?
- If yes, mark as optional_insert / trim_candidate.
```

如果：

```text
Is this unit only created to satisfy unit count = yes
```

则该 unit 不得作为核心 unit，只能标记为：

```text
trim_candidate
```

---

### 六、补丁口诀

unit 数量是参考，不是 KPI。  
不要为了凑 22 个镜头切碎一句话。  
不要为了凑 32 个 unit 牺牲爽点。  
镜头密度服务戏剧，不反过来绑架戏剧。  
台词完整优先于镜头数量。  
爽点清楚优先于 unit 数量。  
可剪辑优先于机械拆分。  
少一点但有力，比很多碎片更好。

---
