## 0.3 PATCH：SHORT-DRAMA MICRO-SHOT LANGUAGE & VOICE CONSISTENCY LOCK

### 短剧碎镜头语言、批量视频任务与角色音色锁定补丁

【补丁目的】

修复旧版 `SHORT-DRAMA SHOT LANGUAGE` 中残留的“SHOT UNIT 4-15s / SHOT UNIT 不能碎 / single continuous shot”冲突。v34 下，镜头语言丰富依靠 MICRO_SHOT_UNIT 变碎，生成效率依靠 VIDEO_GENERATION_TASK 打包。

---

### 一、MICRO_SHOT_UNIT 是镜头语言最小单位

`MICRO_SHOT_UNIT` 必须覆盖短剧常用镜头语言：

- establishing pressure cut
- speaker close-up
- listener reaction
- prop insert
- evidence insert
- hand detail
- power angle
- payoff reaction
- silence beat
- cliffhanger beat

每个 MICRO_SHOT_UNIT 只做一个剪辑功能，不承担完整场景。

---

### 二、冲突场景最低碎镜头包

每个对白 / 冲突场景必须至少包含：

```text
MICRO_SHOT_01 establishing pressure cut 1-2s
MICRO_SHOT_02 aggressor speaker close-up 3-6s
MICRO_SHOT_03 victim listener reaction 1.5-3s
MICRO_SHOT_04 prop / evidence insert 1-2.5s
MICRO_SHOT_05 power shift close-up 2-4s
MICRO_SHOT_06 payoff reaction / cliffhanger beat 2-4s
```

如果一场冲突戏没有独立反应镜头或道具插入镜，判定不合格。

---

### 三、对话反打按碎镜头实现

凡是两人及以上对白场景，必须使用碎镜头反打结构：

```text
MICRO_SHOT_A Speaker A close-up
MICRO_SHOT_B Listener B reaction
MICRO_SHOT_C Speaker B close-up
MICRO_SHOT_D hand / prop / evidence insert
MICRO_SHOT_E power shift reaction
```

重要对白后必须有视觉反应。如果一句对白没有引发任何视觉反应，这句对白必须删掉或改写。

---

### 四、VIDEO_GENERATION_TASK 打包规则

多个 MICRO_SHOT_UNIT 可以组成一个 VIDEO_GENERATION_TASK。

默认：

```text
3-6 个 MICRO_SHOT_UNIT / task
6-15s / task
最多 18s / task
```

批量任务要写清楚 `Included Micro Shot Units`、`Batch Keyframe Sequence`、`Batch Prompt EN`、`Fallback Split Plan`。

---

### 五、角色音色锁定 Voice Registry

所有主要角色 / 重要角色必须建立 `VOICE REGISTRY`。

```text
VOICE REGISTRY

CHAR_xxx:
- voice_id:
- gender:
- age_range:
- vocal_texture:
- pitch:
- speed:
- energy:
- emotional_baseline:
- accent:
- speaking_style:
- forbidden_voice_traits:
- sample_line_cn:
```

同一角色全片必须使用同一个 `voice_id`。不同角色不得共用 `voice_id`，除非剧情明确是伪装 / 模仿。

---

### 六、作品对白与原生视频音频锁

最终视频对白使用已确认的作品语言。每条对白进入 `Native Video Audio Request`，不得烧进关键帧图像。

```text
Native Video Audio Request:
- speaker:
- voice_id:
- line_cn:
- spoken_language: Chinese
- must_speak_verbatim: yes
- do_not_translate: yes
- no_tts_fallback: yes
- no_post_dubbing: yes
- delivery:
- emotion:
- speed:
- volume:
- music_policy: no music in video generation
```

---

### 七、v34 输出模板

每个场景进入视频前必须输出：

```text
SCENE MICRO-SHOT PACK

Scene ID:
Scene Function:
Total Micro Shot Units:
Expected Scene Duration:
Video Generation Task Count:
Hard Cut Roles Covered:

MICRO_SHOT_UNIT LIST:
- micro_shot_id:
- duration:
- hard_cut_role:
- visual_function:
- shot_keyframe_id:
- dialogue_cn:
- expected_use:

VIDEO_GENERATION_TASK PLAN:
- video_task_id:
- included_micro_shot_units:
- total_generated_duration:
- expected_selected_duration:
- batch_risk:
- fallback_split_plan:
```

---

### 八、输出前自检

```text
MICRO-SHOT READINESS CHECK

Total Micro Shot Units:
Total Video Generation Tasks:
Average Units Per Task:
Average Micro Shot Duration:
Reaction Insert Count:
Prop / Evidence Insert Count:
Dialogue Shot Count:
Expected Hard Cut Count:
Can Be Edited By Micro Shot Unit: yes / no
```

如果 `Can Be Edited By Micro Shot Unit = no`，不得进入视频生成。

---

### 九、补丁口诀

镜头语言靠 MICRO_SHOT_UNIT。  
成本控制靠 VIDEO_GENERATION_TASK。  
声音身份靠 VOICE REGISTRY。  
对白必须中文。  
关键帧不烧字幕。  
90s 少于 28 个 MICRO_SHOT_UNIT，不合格。
