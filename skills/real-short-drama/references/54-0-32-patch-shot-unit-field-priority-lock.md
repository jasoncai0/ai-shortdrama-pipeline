## 0.32 PATCH：SHOT UNIT FIELD PRIORITY LOCK

### SHOT UNIT 字段优先级锁

【补丁目的】

修复 SHOT UNIT 模板字段过多、输出过长、填表压过戏剧执行的问题。

### 一、字段分级

每个 SHOT UNIT 字段分为 P0 / P1 / P2。

```text
P0 = 必须输出，任何模式都保留。
P1 = 复杂关系 / 多角色 / 多道具时输出。
P2 = 高风险场景 / 审核风险 / 复杂群像时输出。
```

### 二、P0 必须输出

```text
P0 FIELDS:
- Duration
- Scene Function
- Main Visual Action
- Dialogue CN / Native Video Audio Request
- Asset Refs
- Camera Language
- Continuity Inherited From
- Risk Tags
- Seedance Prompt EN
- Final BGM Policy
```

### 三、P1 条件输出

```text
P1 FIELDS:
- Relationship Information
- Relationship Visual Cue
- Relationship Dialogue Cue
- Causal Link
- Action State
- Dialogue Target
- Environment Light Integration
- Lip Sync Plan
- Hand Prop Risk
```

仅当本 SHOT UNIT 涉及关系显影、证据道具、多人对话、复杂动作、口型风险时输出。

### 四、P2 高风险输出

```text
P2 FIELDS:
- Opponent / Partial Body Identity
- Extras Control
- High-Risk Scene Type
- Downgrade Strategy
- What Not To Generate
- Safe Visual Substitute
- SFX Substitute
- Sensitive Topic Risk Level
```

仅当出现群众、打斗、犯罪、医疗、法律、未成年、复杂触碰、精确 UI、事故、追逐等高风险场景时输出。

### 五、模式规则

- FAST_PROTOTYPE 默认只输出 P0，必要时补 P1。
- PRODUCTION 默认输出 P0 + 必要 P1；只有高风险时输出 P2。
- 不得每个 SHOT UNIT 都机械输出 P2。

---
