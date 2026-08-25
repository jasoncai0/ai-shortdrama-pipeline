## 6.5 Layer 5：原生视频音频与最终 BGM 边界（Native Audio / SFX / Final BGM Only）

分镜定画面，这一层只定“视频模型应该直接说什么、听见什么、禁止生成什么”。本 agent 不具备后期 TTS / 角色配音替换 / 专业音频合成能力，因此不得把 TTS 写成兜底路径。

### A. AUDIO EXECUTION MODE

默认：

```text
AUDIO_EXECUTION_MODE = native_video_audio_only
BGM_POLICY = no_music_in_video_generation
TTS_POLICY = forbidden
POST_DUBBING_POLICY = forbidden
```

规则：视频生成请求中必须直接要求角色逐字说中文对白 / OS / VO。视频模型原生音频失败时，不进入 TTS，而是缩短台词、改镜头覆盖、降低口型风险并重生成当前 VIDEO_GENERATION_TASK（仅口型反复失败的单个碎镜头才允许按 Fallback Split Plan 拆出单独重生成）。

### B. 视频生成请求禁音乐

每条 Seedance / I2V 请求必须写明：

```text
No music. No background music. No cinematic score. No soundtrack. Dialogue, inner voice, ambient sound, and necessary sound effects only.
```

单个 SHOT UNIT 永远不要自己生成音乐。多个片段拼接时，片段自带 BGM 会断裂、抢对白、污染节奏。若用户明确需要音乐，只能在最终统一合成阶段整体添加一条 BGM，不得写入单条视频生成请求。

### C. Voice Registry + 原生视频语音规格

VOICE REGISTRY 只作为视频模型理解角色声线的提示，不是 TTS 参数，也不是后期配音表。

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

### D. Native Video Audio Request

每个含对白 / OS / VO 的 SHOT UNIT 必须输出：

```text
Native Video Audio Request:
- Speaker:
- voice_id:
- Dialogue Type: dialogue / inner_os / vo / no_dialogue
- Line CN:
- Spoken Language: Chinese
- Must Speak Verbatim: yes
- Do Not Translate: yes
- No English Dialogue: yes
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
  - shorten line / reduce visible mouth / change to side profile / change to reaction shot / regenerate current SHOT UNIT
```

### E. Final BGM Policy

最终如用户明确要求，最多允许添加一条统一 BGM：

```text
FINAL_BGM_POLICY:
- allowed only at final assembly stage
- one unified BGM track max
- must not cover dialogue
- no per-shot music
- no generated music inside Seedance video prompt
```

用户未明确要求 BGM 时，默认：

```text
FINAL_BGM_POLICY = no_music
```

### F. 禁止项

禁止：

- TTS fallback
- optional TTS
- external_tts_fallback
- 后期配音兜底
- 角色配音替换
- 用后期音轨替换角色声音
- 专业逐句混音
- 视频生成失败后改走 TTS

---
