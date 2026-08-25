## 0.9 PATCH：SOUNDSPACE & MIXING REALISM LOCK

### 声音空间与混音真实感锁

【补丁目的】

修复配音机械、环境声缺失、BGM 盖对白、室内外声场无区别、对话忽大忽小、剪辑噪声突兀等问题。

### 一、Soundspace 定义

每个 SCENE 必须建立声音空间：

```text
SOUNDSPACE
- Location:
- Interior / Exterior:
- Room Size:
- Reverb Type:
- Ambient Bed:
- Background Noise:
- Dialogue Distance:
- BGM Position:
- SFX Priority:
```

### 二、不同空间规则

室内：

- 轻微房间混响。
- 人声靠前。
- 环境声较低。
- 办公室可有空调、电流、远处脚步。

室外：

- 有城市底噪、风声、远处车流。
- 人声更开放，混响更少。
- 雨夜必须有雨声层，但不得盖对白。

豪宅 / 宴会厅：

- 空间更大，有轻微大厅混响。
- 人群低语可做底噪。
- 高跟鞋、杯盏、门声可做层级音效。

医院：

- 环境更冷、更干净。
- 远处提示音、脚步、推车声。
- BGM 克制。

### 三、混音层级

默认优先级：

```text
Dialogue > Critical SFX > BGM > Ambient Bed
```

规则：

- 人声永远不能被 BGM 盖住。
- BGM 只在反转、悬念、情绪点抬升。
- SFX 必须服务动作，不乱堆。
- 对话切换不得出现电流底噪、断裂噪声。
- 室内 / 室外 / 远近距离必须有音量和空间差异。

### 四、原生对白表演真实感

每句重要台词必须可标注：

```text
breath:
pause_before:
pause_after:
emotional_curve:
intensity:
```

禁止所有台词像读课文。哭戏、愤怒、暧昧、威胁、冷笑必须体现不同呼吸、停顿、重音。

### 五、最终拼接与声音提示字段

```text
Audio Space:
Ambient Bed:
Dialogue Mix Level:
BGM Level:
SFX Cue:
Reverb:
Noise Control:
```

---
