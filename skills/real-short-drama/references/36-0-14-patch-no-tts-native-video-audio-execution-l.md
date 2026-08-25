## 0.14 PATCH：NO-TTS NATIVE VIDEO AUDIO EXECUTION LOCK

### 无后期 TTS / 原生视频对白执行锁

【补丁目的】

修复系统误以为本 agent 拥有后期 TTS、角色配音替换、专业音频合成、逐句混音或 EDL 配音兜底能力的问题。

从本补丁生效起，本 skill 不得再把 TTS / 后期配音 / audio fallback 当作可执行能力。

本 agent 的声音能力边界为：

1. 视频模型原生生成中文对白 / OS / VO / 环境声 / 必要音效。
2. 最终最多添加一条统一 BGM。
3. 不执行后期 TTS。
4. 不执行角色配音替换。
5. 不执行逐句后期混音。
6. 不执行专业音频合成。
7. 不把 TTS 作为兜底路径。

---

### 一、全局能力边界

禁止输出以下执行路径：

- TTS fallback
- optional TTS
- 后期配音兜底
- 角色配音替换
- professional audio dubbing
- voiceover replacement
- audio post-production fallback
- regenerate with TTS
- final dialogue replacement by TTS
- external_tts_fallback

系统不得假设 agent 可以在视频生成后重新给角色配音。

如果视频模型没有成功生成中文对白，只能通过以下方式修复：

1. 缩短中文对白。
2. 降低 Lip Sync Risk。
3. 改成侧脸 / 背影 / OTS / 反应镜头 / 道具插入镜。
4. 减少同一 SHOT UNIT 的对白数量。
5. 重写 Seedance Prompt。
6. 重新生成该 SHOT UNIT。
7. 必要时把该句对白改成画面信息 / 表情 / 动作表达。

不得改为 TTS 兜底。

---

### 二、Native Video Audio 唯一路径

每个含对白的 SHOT UNIT 必须把对白写入视频生成请求，并要求视频模型原生说中文。

必须包含：

```text
Native Video Audio Required:
- Spoken Language: Chinese
- Exact Chinese Line:
- Must Speak Verbatim: yes
- Do Not Translate: yes
- No English Dialogue: yes
- No TTS Fallback: yes
- No Post-Dubbing: yes
```

Seedance Prompt EN 必须包含：

```text
native video audio required if supported, the character must speak the exact Chinese dialogue verbatim, do not translate Chinese dialogue into English, no TTS fallback, no post-dubbing, no voice replacement, no subtitles, no captions, no text overlay.
```

如果该 SHOT UNIT 无对白：

```text
No spoken dialogue. Ambient sound and necessary sound effects only. No music in video generation.
```

---

### 三、BGM 能力边界

视频生成阶段禁止 BGM。

单个 SHOT UNIT 不得生成：

- background music
- cinematic score
- soundtrack
- tension music
- emotional music
- music bed
- singing
- humming

最终如用户明确需要，最多允许统一添加一条 BGM：

```text
FINAL_BGM_POLICY:
- allowed only at final assembly stage
- one unified BGM track max
- must not cover dialogue
- no per-shot music
- no generated music inside Seedance video prompt
```

如果用户没有明确要求 BGM：

```text
BGM_POLICY = no_music
```

---

### 四、删除 / 替换原有字段

所有模板中删除：

```text
TTS / EDL CN
optional TTS/EDL only as fallback
optional AUDIO FALLBACK / EDL
TTS 字段
TTS Timing
TTS 生成
后期 TTS
配音兜底
external_tts_fallback
```

统一替换为：

```text
Native Video Audio Request
```

新字段如下：

```text
Native Video Audio Request:
- Speaker:
- Line CN:
- Spoken Language: Chinese
- Must Speak Verbatim: yes / no
- Do Not Translate: yes
- Native Audio Required: yes
- No TTS Fallback: yes
- No Post-Dubbing: yes
- Delivery:
- Emotion:
- Speed:
- Volume:
- Pause Before:
- Pause After:
- Lip Sync Risk:
- Dialogue Coverage Plan:
- If Native Audio Fails:
  - shorten line / reduce visible mouth / change to side profile / change to reaction shot / regenerate
```

---

### 五、口型失败修复规则

如果原生视频对白失败，不得进入 TTS。

必须按以下顺序修复：

```text
1. 台词压缩：
长句改短句，单句尽量 6–14 个汉字。

2. 镜头遮盖：
正脸改侧脸、背影、OTS、反应镜头、手部 / 道具插入镜。

3. 对白拆分：
一个 SHOT UNIT 只保留一句关键对白。

4. 情绪外化：
无法稳定说出的信息，改成眼神、动作、道具、反应表达。

5. 重生成：
只重生成失败 SHOT UNIT，不推翻全集。
```

禁止：

```text
用 TTS 补
后期重新配音
另做配音轨
用后期音轨替换声音
把对白烧进字幕图
```

---

### 六、VOICE REGISTRY 降级为“原生音频提示”，不是 TTS 控制

VOICE REGISTRY 仍可保留，但用途改为：

```text
给视频模型理解角色声线的提示，不是 TTS 调音参数。
```

字段精简为：

```text
VOICE REGISTRY

CHAR_xxx:
- voice_id:
- gender:
- age_range:
- vocal_texture:
- pitch:
- speed:
- emotional_baseline:
- speaking_style:
- forbidden_voice_traits:
- sample_line_cn:
```

规则：

- voice_id 只作为角色声音一致性提示。
- 不得写成 TTS voice_id。
- 不得要求后期按 voice_id 配音。
- 如果视频模型原生音频不稳定，只能缩短对白 / 改镜头 / 重生成。

---

### 七、输出前自检

每次输出 SHOT UNIT / Seedance Prompt 前必须检查：

【音频能力边界】

- 是否误写了 TTS？
- 是否误写了后期配音？
- 是否误写了 audio fallback？
- 是否误写了 后期配音合成？
- 是否把 voice_id 当成 TTS 参数？
- 是否明确对白只能由视频模型原生生成？

【BGM 边界】

- 单个 SHOT UNIT 是否禁止 BGM？
- 是否没有让视频模型生成配乐？
- 是否只在最终合成阶段允许一条统一 BGM？
- 用户未要求 BGM 时，是否默认无音乐？

【失败修复】

- 原生对白失败时，是否只允许缩短台词 / 降低口型风险 / 改镜头 / 重生成？
- 是否没有进入 TTS 兜底？

---

### 八、补丁口诀

没有 TTS。  
没有后期配音。  
没有配音兜底。  

对白靠视频模型原生说中文。  
说不好，就缩短、遮口、改镜头、重生成。  
不要转 TTS。

单个视频片段不要音乐。  
最终最多一条统一 BGM。

---
