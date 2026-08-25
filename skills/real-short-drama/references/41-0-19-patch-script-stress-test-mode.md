## 0.19 PATCH：SCRIPT STRESS TEST MODE

### 剧本压力测试模式锁

【补丁目的】

修复以下问题：

1. 用户只是想测试题材、剧本、分镜结构时，系统强行进入完整 WORLD / CHARACTER / LOCATION / KEYFRAME / I2V 生产流程。
2. 早期验证成本过高，导致无法快速发现剧情结构漏洞。
3. 系统把“测试 skill / 测剧本设计 / 看能不能多镜头”误判为正式成片生产。
4. 用户还没确认故事结构是否成立，系统就开始生成资产，造成返工。

从本补丁生效起，当用户出现以下表达时：

- 测试一下这个 skill
- 测剧本设计
- 看这个题材能不能做
- 看能不能一集多镜头
- 先测一下逻辑
- 先不要出图
- 先看分镜结构
- 用这个 case 看漏洞
- 压力测试
- 找问题 / 找漏洞 / 看会不会翻车

系统必须进入 `SCRIPT_STRESS_TEST_MODE`。

### 一、模式定义

`SCRIPT_STRESS_TEST_MODE` 是正式生产前的剧本与镜头结构验证模式。

它不是完整生产模式。  
它不生成 WORLD_VISUAL_BIBLE。  
它不生成 CHARACTER @base。  
它不生成 CHARACTER @sheet。  
它不生成 LOCATION / PROP / COSTUME 资产。  
它不生成 KEYFRAME。  
它不生成 I2V。  

它只验证：

1. 关系是否清楚。
2. 冲突是否成立。
3. 爽点是否有蓄力。
4. 反转是否有因果。
5. 单集是否能拆成多个 SHOT UNIT。
6. 每个 SHOT UNIT 是否有明确事件。
7. 是否存在 AI 视频落地高风险。
8. 是否需要补剧情桥、道具桥、关系桥、视觉桥。

### 二、允许输出内容

在 `SCRIPT_STRESS_TEST_MODE` 下，只允许输出：

```text
1. CASE DIAGNOSIS
2. EPISODE RELATION MAP
3. EPISODE SCRIPT DRAFT
4. SCENE BREAKDOWN
5. SHOT UNIT STRUCTURE
6. RISK LIST
7. PATCH SUGGESTION
8. FORMAL PRODUCTION READINESS
```

禁止输出：

```text
WORLD_VISUAL_BIBLE image prompt
CHARACTER @base prompt
CHARACTER @sheet prompt
LOCATION image prompt
PROP image prompt
SHOT KEYFRAME prompt
I2V final generation prompt
完整成片拼接清单
```

除非用户明确说：

```text
进入正式生产
开始出图
生成世界图
生成角色图
继续做资产
继续做 keyframe
继续跑视频
```

### 三、模式结束条件

当 SCRIPT_STRESS_TEST_MODE 输出完成后，必须给出：

```text
FORMAL PRODUCTION READINESS:
- Story Structure: pass / revise
- Relationship Clarity: pass / revise
- Payoff Logic: pass / revise
- Shot Unit Feasibility: pass / revise
- AI Video Risk: low / medium / high
- Recommended Next Step:
```

如果结果是 `revise`，不得建议直接进入资产生产。  
必须先修剧本结构。

如果结果是 `pass`，才允许建议进入：

```text
WORLD_VISUAL_BIBLE → CHARACTER @base → CHARACTER @sheet → LOCATION / PROP / COSTUME → STORYBOARD → KEYFRAME → I2V
```

### 四、输出前自检

每次进入 SCRIPT_STRESS_TEST_MODE 前检查：

- 用户是否只是测试，而不是正式生产？
- 是否避免强制生成世界图？
- 是否只分析剧本结构和镜头可拆性？
- 是否输出了风险清单？
- 是否明确该模式不等于正式生产？
- 是否给出是否可以进入正式生产的判断？

### 五、口诀

先测结构，再做资产。  
先找漏洞，再进生产。  
测试模式不出图，正式生产再走完整链路。

---
