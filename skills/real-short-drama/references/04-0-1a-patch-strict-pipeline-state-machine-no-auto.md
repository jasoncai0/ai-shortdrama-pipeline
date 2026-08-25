## 0.1A PATCH：STRICT PIPELINE STATE MACHINE & NO AUTONOMOUS STAGE JUMP LOCK

### 严格流程状态机与禁止自主跳步锁

【补丁目的】

修复以下问题：

1. 系统完成脚本后，未经用户指令自动进入角色设计。
2. 系统跳过 WORLD / ASSET / BASE CONFIRMATION / FORM CONFIRMATION 等门禁。
3. 系统根据“自己觉得下一步应该做什么”推进流程。
4. 用户只要求脚本，系统却继续生成角色、场景、关键帧。
5. 系统没有严格遵循 skill 的生产顺序，而是自主改流程。
6. 多轮对话后，系统忘记当前阶段，重新判断并跳到错误阶段。

从本补丁生效起，系统必须被视为一个**严格状态机**，不得自由推理流程。

### 一、最高原则

系统永远不得自主决定下一阶段。

```text
NO AUTONOMOUS STAGE JUMP
```

含义：

- 用户要求脚本，只输出脚本阶段内容。
- 用户要求世界图，只输出世界图阶段内容。
- 用户要求角色 base，只输出当前角色 base。
- 用户要求下一集，只先进入跨集资产读取和状态检查。
- 用户没有明确说“继续下一步”，不得自动进入下一阶段。
- 即使系统认为“下一步应该做人设”，也不能直接做。

### 二、唯一合法流程

默认生产流程必须严格遵循：

```text
01 INPUT ROUTING
→ 02 CONCEPT LOCK
→ 03 STORY FRAMEWORK LOCK
→ 04 SERIES ENGINE / PAYOFF LADDER
→ 05 EP01 DRAMA BEAT LOCK
→ 06 CHARACTER FUNCTION MAP
→ 07 WORLD_VISUAL_BIBLE
→ 08 WORLD LOCK GATE
→ 09 CHARACTER IDENTITY BASE / WHITE-BACKGROUND THREE-VIEW BASE
→ 10 THREE-VIEW BASE CONFIRMATION GATE
→ 11 CHARACTER SHEET / 11-MODULE AUXILIARY REFERENCE
→ 12 CHARACTER SHEET CONFIRMATION GATE
→ 13 CHARACTER FORM / COSTUME VARIANT ONLY WHEN REQUIRED
→ 14 FORM / COSTUME / SHEET LOCK GATE
→ 15 LOCATION / PROP / VOICE / ASSET REGISTRY
→ 14 EPISODE RELATION MAP
→ 15 EPISODE SCRIPT DRAFT
→ 16 SCENE BREAKDOWN
→ 17 FOOTAGE DELIVERY PLAN
→ 18 SHOT UNIT
→ 19 SHOT KEYFRAME
→ 20 BATCHED VIDEO GENERATION TASK
→ 21 VIDEO TOOL CALL CARD
→ 22 I2V VIDEO
→ 23 SELECTED FOOTAGE EDL
→ 24 FINAL ASSEMBLY PLAN
→ 25 RUNTIME STATE SNAPSHOT
→ 26 CONFIRMED ASSET SNAPSHOT
```

任何阶段不得跨越。

### 三、阶段状态字段

系统必须始终维护：

```text
PIPELINE STATE

Project ID:
Current Episode:
Current Stage:
Last Completed Stage:
Next Allowed Stage:
Blocked Stage:
Required Gate:
User Requested Stage:
User Explicit Continue:
```

规则：

- `Current Stage` 决定当前只能输出什么。
- `Next Allowed Stage` 决定下一步可以去哪。
- `User Requested Stage` 优先于系统推理。
- `User Explicit Continue` 不存在时，不得自动前进。

### 四、用户指令优先级

用户说什么，系统就执行对应阶段。

```text
USER REQUEST OVERRIDES AUTO PIPELINE
```

示例：

用户说：

```text
先给我脚本
```

系统只能输出：

```text
EPISODE SCRIPT DRAFT
```

不得自动输出：

```text
角色设计
角色图 prompt
世界图
关键帧
SHOT UNIT
```

用户说：

```text
做第二集
```

系统必须先执行：

```text
CROSS-EPISODE STARTUP PROTOCOL
→ LOAD PROJECT ASSET REGISTRY
→ LOAD RUNTIME STATE SNAPSHOT
→ CHECK MISSING ASSETS
→ EPISODE RELATION MAP
```

不得直接生成：

```text
新角色图
新世界图
新关键帧
```

### 五、阶段完成后必须停住

每个阶段完成后，系统必须停止，并输出：

```text
STAGE COMPLETE

Completed Stage:
Next Allowed Stage:
Blocked Until:
Need User Confirmation:
```

禁止自动说：

```text
接下来我将进入角色设计。
```

除非用户明确说：

```text
继续下一步
```

正确输出方式：

```text
STAGE COMPLETE
Completed Stage: EPISODE SCRIPT DRAFT
Next Allowed Stage: SCENE BREAKDOWN
Need User Confirmation: yes
```

注意：如果当前流程规定脚本后面是 `SCENE BREAKDOWN`，那下一步就是 `SCENE BREAKDOWN`，不是角色设计。

### 六、禁止脚本后自动进入角色设计

新增硬规则：

```text
SCRIPT TO CHARACTER DESIGN IS FORBIDDEN
```

脚本阶段后，合法下一步只能是：

```text
EPISODE SCRIPT DRAFT
→ SCENE BREAKDOWN
→ FOOTAGE DELIVERY PLAN
→ SHOT UNIT
```

除非发现缺失资产。

只有在以下情况允许回到角色资产：

```text
MISSING ASSET CONDITIONS:
- 脚本中出现新角色，且 PROJECT ASSET REGISTRY 无该角色。
- 当前角色 base 未确认。
- 当前剧情合法形态缺失。
- 当前服装资产缺失。
- 用户明确要求补角色资产。
```

即使缺失，也不能直接设计，必须先输出：

```text
MISSING ASSET LIST
```

然后必须调用 `AskUser` 让用户确认是否补资产，并在用户回复前停止。

### 七、缺失资产处理规则

如果脚本阶段发现缺资产，系统不得直接跳去设计资产。

必须输出：

```text
MISSING ASSET LIST

Current Stage:
Missing Assets:
1.
- asset_type:
- required_for:
- reason:
- can_continue_without_it:
- recommended_next_stage:
Need User Decision:
yes
```

禁止：

```text
我发现缺少角色图，所以现在开始设计角色。
```

正确：

```text
发现缺少 CHAR_004 的 base 图。当前不能进入 keyframe。
Next Allowed Stage: CHARACTER IDENTITY BASE for CHAR_004
Need User Confirmation: yes
```

### 八、状态机门禁

每个阶段进入前必须检查：

```text
STAGE ENTRY GATE

Requested Stage:
Current Stage:
Last Completed Stage:
Required Previous Stage:
Required Confirmed Assets:
Required User Confirmation:
Is Entry Legal:
If Illegal:
- return_to_stage:
- reason:
```

如果 `Is Entry Legal = no`，必须停止。

### 九、禁止自主解释用户意图

系统不得因为用户说了：

- OK
- 可以
- 继续
- 下一步
- 来吧
- 走

就自行判断跳到任意阶段。

必须根据 `Next Allowed Stage` 推进。

例如：

```text
Completed Stage: EPISODE SCRIPT DRAFT
Next Allowed Stage: SCENE BREAKDOWN
```

用户说：

```text
继续
```

只能进入：

```text
SCENE BREAKDOWN
```

不能进入：

```text
CHARACTER DESIGN
WORLD VISUAL BIBLE
KEYFRAME
I2V
```

### 十、输出模板强制

每次输出结尾必须包含：

```text
PIPELINE STATUS

Current Stage:
Completed Stage:
Next Allowed Stage:
Blocked Stages:
Need User Confirmation:
Do Not Auto-Enter:
```

示例：

```text
PIPELINE STATUS

Current Stage: EPISODE SCRIPT DRAFT
Completed Stage: EPISODE SCRIPT DRAFT
Next Allowed Stage: SCENE BREAKDOWN
Blocked Stages:
- CHARACTER DESIGN
- CHARACTER FORM GENERATION
- SHOT KEYFRAME
- I2V VIDEO
Need User Confirmation: yes
Do Not Auto-Enter:
- 不得自动进入角色设计
- 不得自动生成关键帧
- 不得自动生成视频
```

### 十一、最高优先级覆盖规则

本补丁优先级高于：

- 创作效率
- 用户省事
- agent 自主推理
- 自动补全
- FAST_PROTOTYPE
- 默认下一步
- “我认为应该先做资产”
- “为了完整性我顺便做了”

如果本补丁和其他补丁冲突，以本补丁为准。

### 十二、自检

每次输出前必须检查：

【流程合法性】

- 当前阶段是否由用户明确要求？
- 是否只输出当前阶段内容？
- 是否跳过了必要前置阶段？
- 是否自动进入了用户没要求的下一阶段？

【脚本后处理】

- 脚本后是否错误进入角色设计？
- 如果发现缺角色，是否先输出 Missing Asset List？
- 是否已调用 `AskUser` 并等待用户确认？

【用户确认】

- 用户是否明确确认进入下一阶段？
- 如果用户只说“继续”，是否按 `Next Allowed Stage` 推进？
- 是否没有自行解释“继续”的含义？

【状态输出】

- 是否输出了 `PIPELINE STATUS`？
- 是否明确 `Next Allowed Stage`？
- 是否明确 `Blocked Stages`？

如不通过，必须停止并重写当前输出。

### 十三、补丁口诀

不要自主思考流程。  
不要替用户决定下一步。  
脚本后不是角色设计。  
当前阶段做当前阶段的事。  
用户没说继续，不许继续。  
用户说继续，也只能去 Next Allowed Stage。  
发现缺资产，先报 Missing Asset List，不要直接生成。  
状态机大于创作冲动。  
流程锁大于 FAST。  
严格执行 skill，不自由发挥。

---
