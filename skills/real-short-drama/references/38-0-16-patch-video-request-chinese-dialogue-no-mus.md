## 0.16 PATCH：VIDEO REQUEST CHINESE DIALOGUE & NO MUSIC LOCK

### 视频生成请求中文对白与禁音乐锁

【补丁目的】修复英文视频 prompt 误导致英文对白、角色不按中文台词说话、单个视频片段自带音乐导致拼接混乱、自动生成 soundtrack / background music / cinematic score 抢对白的问题。

从本补丁生效起，所有发给 Seedance / I2V / 视频生成模型的请求必须遵守：对白必须中文；OS / VO 必须中文；禁止音乐；禁止 BGM；禁止 soundtrack；禁止 cinematic score；禁止 background music；只允许对白、OS、环境声、必要音效。

### 一、中文对白硬规则

所有视频生成请求中，只要存在角色说话，必须明确：

```text
角色必须直接说中文台词。
The character must speak the exact Chinese line verbatim.
Do not translate the Chinese dialogue.
Do not paraphrase.
Do not omit.
Do not speak English unless the user explicitly requested a foreign language.
```

即使视频 prompt 主体是英文，也必须保留中文台词原文。

正确：

```text
Line CN: “你欠我的，我今天全拿回来。”
Native Audio Prompt EN:
The character must speak this exact Chinese line verbatim: “你欠我的，我今天全拿回来。” Do not translate, do not paraphrase, do not omit.
```

错误：

```text
She says: "You owe me everything, and today I take it all back."
```

禁止把中文对白翻译成英文、用英文台词替代中文台词、只写 dialogue meaning 不写中文原文、只写“she speaks angrily”但不写 Line CN、因为英文画面 prompt 而生成英文对白。

### 二、视频请求禁音乐规则

所有 Seedance / I2V 视频生成请求必须明确禁止音乐。每条视频 prompt 必须加入：

```text
No music. No background music. No cinematic score. No soundtrack. No singing. No instrumental music. No emotional music bed. Dialogue, inner voice, ambient sound, and necessary sound effects only.
```

中文补充：

```text
本视频片段禁止生成任何音乐或 BGM，只允许中文对白 / 内心 OS / 环境声 / 必要音效。
```

禁止：background music, cinematic score, soundtrack, emotional music, tension music, piano music, suspense music, trailer music, music bed, singing, humming, theme music。

### 三、允许的声音

单个视频片段只允许：中文角色对白；中文内心 OS；中文旁白 / VO（如用户或脚本要求）；环境声（室内底噪、脚步、门声、雨声、车流、人群低语）；必要音效（手机震动、文件拍桌、高跟鞋、杯盏轻碰、门被推开、刹车声 / 撞击声等剧情必要 SFX）。不允许单个视频片段自己生成音乐。

### 四、音乐只允许最终统一处理

如果用户明确要求音乐，只能在最终合成阶段统一添加：不在单个 SHOT UNIT 视频生成请求中加入音乐；不让每个片段各自生成 BGM；不让视频模型自动配乐；音乐只能作为最终统一 BGM track，由后期 / 合成阶段统一添加。用户没有明确要求音乐时，默认无音乐。

默认：

```text
BGM_POLICY = no_music_in_video_generation
```

### 五、VIDEO_GENERATION_TASK 模板补充

每个 VIDEO_GENERATION_TASK 的视频请求必须包含（task 内每个含对白的碎镜头各列一条 Line CN，按内部段落顺序排列）：

```text
Video Audio Request:
- Spoken Language: Chinese
- Lines CN (by internal segment):
  - segment 01 / MICRO_SHOT_xxx:
  - segment 02 / MICRO_SHOT_xxx:
- Must Speak Verbatim: yes / no
- Foreign Language Allowed: no, unless user explicitly requested
- Music Policy: no music in video generation
- Allowed Audio: Chinese dialogue / inner OS / VO / ambient sound / necessary SFX only
- Forbidden Audio: BGM / soundtrack / score / music bed / singing
```

Seedance Prompt EN 必须加入：

```text
Native video audio required if supported. The character must speak the exact Chinese dialogue verbatim. Do not translate Chinese dialogue into English. No music, no background music, no cinematic score, no soundtrack. Dialogue, inner voice, ambient sound, and necessary sound effects only.
```

如果本条无对白：

```text
No spoken dialogue. No music. Ambient sound and necessary sound effects only.
```

### 六、输出前自检

- 是否每条视频请求都明确 `Spoken Language = Chinese`？
- 是否 `Line CN` 保留中文原文？
- 是否明确不得翻译 / 改写 / 省略中文台词？
- 是否没有英文对白，除非用户明确要求？
- 是否每条视频请求都写了 `No music`？
- 是否禁止 BGM / soundtrack / score / music bed？
- 是否只允许对白、OS、环境声、必要音效？
- 是否没有让单个 SHOT UNIT 自己生成音乐？
- 如果需要音乐，是否仅在最终统一合成阶段处理？

### 七、补丁口诀

视频请求里，台词必须中文。英文 prompt 描述画面，中文台词必须原文说。不翻译，不改写，不省略。单个视频片段永远不要音乐。不要 BGM，不要 soundtrack，不要 score。对白、OS、环境声、必要音效就够了。音乐只能最终统一加，不能每段自己带。

---
