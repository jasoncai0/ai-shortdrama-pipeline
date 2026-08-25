## 0.39 PATCH：AUDIO BGM CONTAMINATION CONTROL LOCK

### Seedance / I2V 原生音频 BGM 污染控制补丁

【补丁目的】

修复以下问题：

1. Seedance / I2V 原生音频模型即使明确禁止，也可能自动生成不需要的 BGM、配乐、节奏鼓点或情绪铺底。
2. 视频生成 prompt 中出现 cinematic / dramatic / emotional / suspenseful 等词时，模型会把短剧情绪自动理解成音乐提示。
3. 原生对白与 BGM 混在同一条音轨里，导致成片不可控。
4. 仅靠 `No BGM / No music` 不能稳定阻止模型生成音乐。
5. 生成后缺少音频清洗流程，导致带 BGM 的污染片段直接进入最终合成。

从本补丁生效起，Seedance / I2V 原生音频必须被视为**高风险可污染音轨**。  
所有生成片段进入最终 EDL 前，必须经过 `AUDIO_SANITIZATION`。

### 一、核心假设

```text
Seedance / I2V native-audio models may auto-generate unwanted BGM, soundtrack, rhythmic beats, or emotional underscore even when explicitly forbidden.
```

因此，本 skill 不得信任视频模型天然输出“干净无 BGM 音频”。

视频生成阶段仍必须禁止 BGM。  
但后处理阶段必须提供音频清洗兜底。

### 二、生成阶段 AUDIO RULE 强制块

每条含原生音频的视频生成 prompt 必须包含独立 `AUDIO RULE` 块，且必须中英双语同时出现。

```text
AUDIO RULE:
No music.
No background music.
No soundtrack.
No score.
No melody.
No instrumental bed.
No rhythmic beat.
No emotional underscore.
Allowed audio only: Mandarin Chinese dialogue, room tone, realistic environmental sound, footsteps, clothing rustle, natural breathing.
```

```text
音频规则：
禁止音乐。
禁止 BGM。
禁止背景音乐。
禁止配乐。
禁止旋律。
禁止鼓点。
禁止情绪铺底音乐。
只允许中文对白、空间底噪、真实环境声、脚步声、衣料摩擦声、自然呼吸声。
```

### 三、诱发配乐词过滤

视频生成 prompt 中必须避免以下容易诱发 BGM 的词：

- cinematic
- dramatic
- emotional
- suspenseful
- trailer-like
- epic
- intense score
- filmic rhythm
- music cue
- emotional music-like tension
- climactic soundtrack
- powerful score

推荐替换为：

- handheld realistic AI-generated photoreal human scene
- quiet pressure
- real-time confrontation
- natural room tone
- actor-driven tension
- silent pause
- restrained performance
- verbal conflict
- physical reaction
- eye contact pressure
- environmental sound only

规则：

- 情绪必须由演员表情、站位、沉默、眼神、道具、空间压迫表达。
- 不得通过音乐词汇表达情绪。
- 不得用 soundtrack / score / cue 描述节奏。
- 不得把“短剧爽点”写成 trailer 节奏。

### 四、音频 QC 标签

每个生成片段进入最终合成前，必须标记音频状态：

```text
AUDIO_QC_LABEL:
- AUDIO_OK_DIALOGUE_ONLY
- AUDIO_OK_ENV_ONLY
- AUDIO_OK_SILENT
- AUDIO_CONTAMINATED_BGM
- AUDIO_CONTAMINATED_RHYTHMIC_BEAT
- AUDIO_CONTAMINATED_SCORE
- AUDIO_FAILED_DIALOGUE_UNUSABLE
```

规则：

- 未标记 `AUDIO_QC_LABEL` 的片段不得进入最终 EDL。
- 带 `AUDIO_CONTAMINATED_*` 的片段不得直接进入最终合成。
- `AUDIO_FAILED_DIALOGUE_UNUSABLE` 必须重生或改为无原生对白方案。

### 五、AUDIO_SANITIZATION 修复路线

#### 情况 A：该镜头不需要保留原生对白

如果该片段无关键对白、无必须保留的原声：

```text
Repair Route:
Remove entire audio track with FFmpeg -an.
```

示例：

```bash
ffmpeg -i input.mp4 -an -c:v copy output_silent.mp4
```

#### 情况 B：该镜头有对白，但混入 BGM

必须先进行人声 / 音乐分离，再合回干净人声。

推荐流程：

```text
Seedance / I2V output video
↓
Extract audio
↓
Separate vocals / music using Demucs / UVR / Spleeter or equivalent voice-music separation tool
↓
Keep vocals if dialogue is usable
↓
Discard accompaniment / music stem
↓
Remux cleaned vocals with original video via FFmpeg
```

示例：

```bash
ffmpeg -i input.mp4 -vn audio.wav
demucs --two-stems=vocals audio.wav
ffmpeg -i input.mp4 -i vocals.wav -map 0:v -map 1:a -c:v copy -c:a aac output_clean.mp4
```

#### 情况 C：对白与音乐融合严重，无法分离

```text
Repair Route:
- regenerate the shot with stricter AUDIO RULE;
- shorten the dialogue;
- reduce visible mouth;
- switch to side profile / back view / reaction shot;
- if repeated failure occurs, change this shot to silent visual + externally controlled audio layer.
```

### 六、SHOT UNIT 字段补充

每个 `SHOT UNIT` 必须新增：

```text
Audio Contamination Risk:
low / medium / high

Audio Prohibition Block:
- No music:
- No BGM:
- No soundtrack:
- No score:
- No melody:
- No rhythmic beat:
- Allowed audio only:

AUDIO_QC_LABEL:
pending / AUDIO_OK_DIALOGUE_ONLY / AUDIO_OK_ENV_ONLY / AUDIO_OK_SILENT / AUDIO_CONTAMINATED_BGM / AUDIO_CONTAMINATED_RHYTHMIC_BEAT / AUDIO_CONTAMINATED_SCORE / AUDIO_FAILED_DIALOGUE_UNUSABLE

Audio Sanitization Route:
- keep native audio
- remove all audio with FFmpeg -an
- separate vocals and music, keep vocals only
- regenerate
- silent visual + external controlled audio layer
```

### 七、最终合成准入规则

最终 EDL / 成片合成只允许以下音频状态进入：

- silent by design
- dialogue-only
- environment-sound-only
- externally cleaned vocals
- externally controlled final BGM layer

禁止：

- 原生不明 BGM 直接进合成
- 原生配乐盖住对白
- 带节奏鼓点的污染音频直接进合成
- 未经过音频 QC 的片段直接进 EDL
- 将 Seedance 原生音频默认视为可用成片音频

### 八、与最终 BGM 的关系

本补丁禁止的是**视频生成阶段不可控原生 BGM**。

最终成片如需 BGM，只允许在后期统一添加，并必须满足：

- BGM 是最终混音层，不是视频模型原生生成。
- Dialogue > Critical SFX > BGM > Ambient Bed。
- BGM 不得盖住中文对白。
- 每段 BGM 必须有明确入点、出点、音量、情绪功能。
- 不允许每条 Seedance 片段各自带独立 BGM 后再拼接。

### 九、输出前音频自检

每次输出视频生成需求、SHOT UNIT、EDL 前必须检查：

- 是否包含中英双语 AUDIO RULE？
- 是否避免了 cinematic / dramatic / emotional / suspenseful / trailer-like 等诱发配乐词？
- 是否明确只允许中文对白和真实环境声？
- 是否标注 Audio Contamination Risk？
- 是否给出 AUDIO_QC_LABEL？
- 如果有 BGM 污染，是否指定 FFmpeg 删除、分离人声、重生或静音方案？
- 是否没有把 Seedance 原生音频默认当成最终可用音频？

不通过则不得进入最终合成。

### 十、补丁口诀

Seedance 可能会偷偷加 BGM。  
禁止只是第一层，清洗才是兜底。  
无对白就删音轨，有对白就分离人声。  
原生 BGM 不进 EDL。  
最终 BGM 只能后期统一加。  

---
