## 0.1M PATCH：NARRATIVE RHYTHM INHERITANCE LOCK

### 叙事节奏继承锁 / 防止 micro shot 阶段重写戏剧节奏

【补丁目的】

本补丁不是新增叙事模块，而是防止已存在的叙事节奏规则在 MICRO_SHOT_UNIT / VIDEO_GENERATION_TASK / SELECTS_EDL 阶段失效。

当前系统已经存在：

- 3s hook
- 10–15s reversal
- payoff ladder
- pressure curve
- conflict escalation
- cliffhanger
- editable footage density
- selects EDL

但在执行到 MICRO_SHOT_UNIT 阶段时，系统容易只执行“镜头碎 / unit 多 / 可硬切”，而忘记上游叙事节奏。

从本补丁生效起：

```text
MICRO_SHOT_UNIT 只能继承上游叙事节奏。
不得重新设计、稀释、切碎或覆盖上游戏剧节奏。
```

---

### 一、最高原则

```text
MICRO SHOT IS EXECUTION.
NARRATIVE RHYTHM IS SOURCE OF TRUTH.
```

含义：

- MICRO_SHOT_UNIT 是执行层，不是重新编剧层。
- VIDEO_GENERATION_TASK 是工具调用层，不是重新组织剧情层。
- SELECTS_EDL 是剪辑层，不是重新分配爽点层。
- 所有底层镜头必须继承上游已经锁定的戏剧节奏。

禁止：

```text
为了凑 micro shot 数量，重新拆散剧情。
为了制造剪辑密度，打断完整台词。
为了多做 reaction insert，稀释主爽点。
为了让 video task 好生成，改写权力变化顺序。
```

---

### 二、进入 MICRO_SHOT_UNIT 前必须读取上游节奏源

在生成 MICRO_SHOT_UNIT 前，必须先输出：

```text
NARRATIVE RHYTHM SOURCE READ

Episode Hook:
Main Payoff:
Pressure Curve:
Power Shift Points:
Midpoint Reversal:
Dialogue Sentence Blocks:
Cliffhanger:
Do-Not-Break Beats:
```

这些不是重新创作，而是从上游 EPISODE SCRIPT / SCENE BREAKDOWN / FOOTAGE DELIVERY PLAN 中读取。

如果上游没有这些字段，必须回到上游补齐，不得直接进入 MICRO_SHOT_UNIT。

---

### 三、每个 MICRO_SHOT_UNIT 必须绑定一个上游 beat

原 MICRO_SHOT_UNIT 模板必须新增：

```text
Narrative Inheritance:
- source_beat_id:
- source_pressure_stage:
- source_power_shift:
- source_dialogue_block_id:
- source_payoff_function:
- source_cliffhanger_function:
- can_modify_source_beat: no
```

规则：

```text
每个 MICRO_SHOT_UNIT 必须服务一个上游 beat。
不能出现没有叙事来源、只为凑数量存在的 unit。
```

如果一个 unit 只是：

```text
走路
转身
看手机
推门
沉默
反应
```

必须说明它服务哪个上游 beat：

```text
- 压迫升级
- 信息揭露
- 权力反转
- 情绪爆点
- 证据确认
- 追更钩子
```

否则标记为：

```text
trim_candidate
```

---

### 四、禁止底层打散上游完整台词

所有 MICRO_SHOT_UNIT 必须继承 `DIALOGUE_SENTENCE_BLOCK`。

禁止：

```text
D01 在上游是一句完整揭露句，
到底层变成三个半句话。
```

必须：

```text
D01 full_line_cn 在 MICRO_SHOT_UNIT / VIDEO_TASK / SELECTS_EDL 中保持完整。
```

新增硬规则：

```text
Dialogue Source Integrity:
- dialogue_block_id:
- full_line_cn:
- inherited_verbatim: yes
- sentence_complete_after_micro_split: yes
- can_cut_mid_sentence: no
```

---

### 五、SELECTS_EDL 必须验收上游节奏是否还在

SELECTS_EDL 不能只验收剪辑点，还必须验收：

```text
NARRATIVE RHYTHM SURVIVAL CHECK

- Hook Preserved: yes / no
- Main Payoff Preserved: yes / no
- Midpoint Reversal Preserved: yes / no
- Pressure Curve Preserved: yes / no
- Power Shift Preserved: yes / no
- Core Dialogue Blocks Preserved: yes / no
- Cliffhanger Preserved: yes / no
- Any Beat Broken By Over-Fragmentation: yes / no
```

如果：

```text
Any Beat Broken By Over-Fragmentation = yes
```

则当前 EDL 失败。

---

### 六、废止“重复新增叙事模块”的倾向

系统不得在 micro shot 阶段重新新增：

```text
新的主爽点
新的反转
新的隐藏身份
新的证据
新的关系变化
新的结尾钩子
```

除非用户明确要求重写剧情。

底层只能做：

```text
visualize
cover
trim
protect
intensify
```

不能做：

```text
rewrite
replace
invent new payoff
change the reveal order
```

---

### 七、失败判定

出现以下任一情况，判定叙事节奏继承失败：

- 上游有主爽点，但 MICRO_SHOT_UNIT 拆完后主爽点不清楚。
- 上游有完整台词，但底层变成半句话。
- 上游有 10–15s 小反转，但 EDL 剪掉了。
- 上游有 cliffhanger，但 SELECTS_EDL 只保留了情绪停顿，没有动作钩子。
- MICRO_SHOT_UNIT 大量存在但无法绑定 source_beat_id。
- 为了满足 unit 数量新增了无意义镜头。
- VIDEO_GENERATION_TASK 改变了剧情信息释放顺序。
- SELECTS_EDL 只按画面节奏剪，没有保留 pressure curve。

失败后必须回滚：

```text
Current Stage: MICRO_SHOT_UNIT / SELECTS_EDL RETRY
Reason: Narrative Rhythm Inheritance Failed
Next Allowed Stage: return to MICRO_SHOT_UNIT with source beat binding
```

---

### 八、补丁口诀

叙事节奏早就有，不要在底层重写。  
micro shot 是执行，不是重新编剧。  
video task 是工具调用，不是剧情重排。  
EDL 是保护爽点，不是剪掉爽点。  
镜头可以碎，beat 不能碎。  
素材可以多，主爽点不能散。

---
