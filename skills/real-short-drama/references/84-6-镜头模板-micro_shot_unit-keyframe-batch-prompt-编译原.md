## 6. 镜头模板 + MICRO_SHOT_UNIT + KEYFRAME + Batch Prompt 编译原则

每个 `MICRO_SHOT_UNIT` 是叙事和剪辑层的最小镜头真相；每个 `SHOT_KEYFRAME` 是该碎镜头的视觉锚点；`VIDEO_GENERATION_TASK` 是多个碎镜头的批量视频生成任务。英文 prompt 是最后一步编译出来的、一次性、随生成模型可换的产物。

### 核心原则

```text
MICRO_SHOT_UNIT 要碎。
SHOT_KEYFRAME 锁画面。
VIDEO_GENERATION_TASK 可打包 3-6 个 MICRO_SHOT_UNIT。
SELECTS_EDL 按 MICRO_SHOT_UNIT 剪。
```

### MICRO_SHOT_UNIT 标准模板

```text
MICRO_SHOT_UNIT #

- micro_shot_id:
- Duration: 时长视戏而定；对白镜以完整句块为准、不设硬上限（见 §0.1K），其余碎镜头以 1-6s 为常见区间
- Hard Cut Role: establishing / speaker_closeup / listener_reaction / prop_insert / evidence_insert / hand_detail / power_angle / payoff_reaction / cliffhanger
- Visual Function:
- Scene Function:
- Relationship Information:
- Relationship Visual Cue:
- Causal Link:
- SHOT_KEYFRAME_ID:
- Composition:
- Shot Size:
- Camera Angle:
- Camera Movement:
- Action Moment:
- Emotion State:
- Dialogue CN:
  - Speaker:
  - Line:
  - voice_id:
  - delivery:
- Asset Refs:
  - Character:
  - Location:
  - Prop:
  - Costume:
  - Voice:
- Expected Use: main_cut / reaction_insert / prop_insert / trim_buffer / delete_candidate
- AI Risk:
- Risk Control:
```

### SHOT_KEYFRAME 标准模板

```text
SHOT_KEYFRAME

- keyframe_id:
- micro_shot_id:
- visual_function:
- character_refs:
- location_refs:
- prop_refs:
- costume_refs:
- composition:
- shot_size:
- camera_angle:
- lighting:
- action_moment:
- emotion_state:
- no_text_policy: no subtitles, no captions, no text overlay, no UI text
```

### VIDEO_GENERATION_TASK 标准模板

```text
VIDEO_GENERATION_TASK #

- video_task_id:
- Included Micro Shot Units: 3-6 units
- Total Generated Duration: 6-15s, max 18s
- Expected Selected Duration:
- Generation Mode: batched keyframe-guided micro-shot sequence
- Scene Continuity:
- Lighting Continuity:
- Character Continuity:
- Prop Continuity:
- BATCH_KEYFRAME_SEQUENCE:
  1. micro_shot_id / shot_keyframe_id / duration / hard_cut_role
  2. micro_shot_id / shot_keyframe_id / duration / hard_cut_role
- Batch Prompt EN:
- Native Video Audio Request CN:
- Batch Risk:
- Can Split If Failed:
- Fallback Split Plan:
```

### Batch Prompt 编译硬性写法

批量视频 prompt 的**权威口径**（同时满足"一个视频文件"与"内部多段、非一镜到底"，覆盖 §0.1H / §0.1J / §4.16 中的所有旧模板）：

```text
Generate ONE single vertical video file (not separate clips) that contains the listed micro shot units as multiple planned segments in order. Each micro shot unit has its own keyframe, framing, duration, and visual function. Keep clear visible boundaries between segments so they can be hard-cut / trimmed later in EDL. Do NOT output separate clips, and do NOT merge everything into one single continuous long take. No subtitles, no captions, no text overlay, no music.
```

口径要点：**一次工具调用 → 一个视频文件 → 文件内部是多段可硬切的碎镜头**。既不是逐片段分开生成，也不是整段一镜到底。

禁止只写：

```text
single continuous shot, no cuts, one stable framing
Generate each shot unit separately / one clip per shot unit
```

### Prompt 视觉继承

任何 CHARACTER / LOCATION / PROP / MICRO_SHOT / VIDEO_TASK prompt 都必须继承 WORLD_VISUAL_BIBLE 的模块化视觉锚点。

必须写明：

```text
inherits WORLD_VISUAL_BIBLE_001 modules: [specific modules]
character identity source: CHAR_xxx@base_stage@version
voice guided by Native Video Audio Request: VOICE_CHAR_xxx
```

关键帧 / 视频 prompt 必须包含：

```text
AI-generated cinematic keyframe for vertical micro-drama, synthetic photoreal human footage look, generated scene, no subtitles, no captions, no text overlay, character identity source: CHAR_xxx@base_stage, partial body identity clearly assigned, background extras have random diverse faces with no resemblance to main characters, characters clothing props and background share the same scene lighting, realistic environmental light spill on skin and fabric, accurate contact shadows, subtle rim light matching the location, realistic material reflections, no cutout look, no pasted-on subject, no inconsistent lighting.
```

### 反静态与镜头丰富

一场对话 / 冲突戏至少覆盖 4 类镜头语言：

```text
speaker close-up
listener reaction
hand / prop / evidence insert
power angle
silence beat
payoff reaction
```

不得长期正面中景。不得用 12 个长镜头铺满 90s。
