## 0.1K PATCH：DIALOGUE SENTENCE BLOCK LOCK

### 对白完整句块锁 / 镜头碎而台词不断锁

【补丁目的】

修复 MICRO_SHOT_UNIT 变碎后产生的新问题：镜头被拆碎是对的，但对白也被拆成半句话，导致角色没有完整表演、观众听不到完整爽剧金句、Native Video Audio Request 输出零碎口型和不完整语音。

从本补丁生效起：

```text
MICRO_SHOT_UNIT CAN BE FRAGMENTED.
DIALOGUE SENTENCE MUST NOT BE FRAGMENTED.
```

镜头可以碎。动作可以碎。反应可以碎。证据插入可以碎。  
但一句对白必须保持完整语义。

---

### 一、最高原则

```text
SHOT IS MICRO.
DIALOGUE IS SENTENCE BLOCK.
```

含义：

- MICRO_SHOT_UNIT 是视觉 / 剪辑单位。
- DIALOGUE_SENTENCE_BLOCK 是对白 / 表演单位。
- 一句完整台词不得被拆成多个独立不完整语义片段。
- 每个重要对白必须能单独成立为一句完整中文台词。
- 反应镜头可以插在对白前后，但不得切断一句台词的语义核心。

错误理解：

```text
镜头越碎 → 台词也越碎
```

正确理解：

```text
镜头越碎 → 台词句块越要完整
```

---

### 二、新增结构：DIALOGUE_SENTENCE_BLOCK

所有对白场景必须先建立对白句块，再拆 MICRO_SHOT_UNIT。

```text
DIALOGUE_SENTENCE_BLOCK

- dialogue_block_id:
- speaker:
- full_line_cn:
- line_function: THREAT / REVEAL / CONTROL / REACTION / PAYOFF / CLIFFHANGER
- semantic_status: complete_sentence
- word_count_cn:
- estimated_spoken_duration:
- required_delivery:
- can_be_split_across_shots: no / yes_with_rules
- primary_micro_shot_id:
- supporting_reaction_micro_shots:
- insert_micro_shots_allowed_before:
- insert_micro_shots_allowed_after:
- forbidden_split_points:
```

规则：

```text
先写 DIALOGUE_SENTENCE_BLOCK
再把它绑定到 MICRO_SHOT_UNIT
```

禁止直接在 MICRO_SHOT_UNIT 里零散发明碎台词。

---

### 三、完整台词定义

一条合法完整台词必须满足：

```text
COMPLETE DIALOGUE LINE REQUIREMENTS

- 有明确主语 / 指向对象，或语境中主语清楚
- 有完整谓语动作 / 判断 / 威胁 / 揭露
- 有明确情绪功能
- 有信息增量
- 可以单独被角色说出口
- 可以单独被观众理解
- 不是半句话
- 不是只靠下一镜补完
```

合法例子：

```text
“这些年你们住的房、开的店，全是我妈一笔一笔供出来的。”
“你嫌她是乡下人，可你们全家，是靠她活到今天的。”
“这份转账记录，我已经发给你儿子的债主了。”
“你现在跪下道歉，还来得及。”
```

非法例子：

```text
“这些年……”
“你们家……”
“我妈她……”
“这份东西……”
“你以为……”
“不是这样的。”
“够了。”
```

这些只能作为气口 / 反应，不得作为核心对白句块。

---

### 四、对白不得被 MICRO_SHOT_UNIT 切碎

禁止：

```text
U01 女主：“这些年你们住的房……”
U02 婆婆反应
U03 女主：“开的店……”
U04 众人反应
U05 女主：“全是我妈供出来的。”
```

必须改为：

```text
DIALOGUE_BLOCK D01
Speaker: 女主
Full Line CN: “这些年你们住的房、开的店，全是我妈一笔一笔供出来的。”
Function: REVEAL / PAYOFF
Estimated Spoken Duration: 4.5s

MICRO_SHOT_UNIT U01
Hard Cut Role: speaker_closeup
Dialogue Block: D01 full_line_cn verbatim
Duration: 4.5s

MICRO_SHOT_UNIT U02
Hard Cut Role: listener_reaction
Dialogue: none
Duration: 1.5s

MICRO_SHOT_UNIT U03
Hard Cut Role: evidence_insert
Dialogue: none
Duration: 1.5s
```

一句完整台词优先放在一个 speaker_closeup / power_angle / confrontation shot 中说完。反应镜头、证据镜头、手部特写应服务这句台词，而不是把这句台词拆断。

---

### 五、允许跨镜头的唯一情况

一条台词只有在以下情况下允许跨镜头：

```text
ALLOWED DIALOGUE CROSS-SHOT CONDITIONS

1. 同一个 VIDEO_GENERATION_TASK 内连续完成。
2. 同一个 speaker 持续说话。
3. 语音不中断。
4. 画面可以切 listener reaction / prop insert，但声音必须作为 continuous offscreen dialogue 延续。
5. full_line_cn 必须在 Native Video Audio Request 中保持完整。
6. SELECTS_EDL 不得剪掉句首、句中、句尾。
```

合法：

```text
U01 女主 close-up 开始说：
“你嫌她是乡下人，”

U02 婆婆反应，女主声音继续 offscreen：
“可你们全家，是靠她活到今天的。”
```

但必须记录为：

```text
DIALOGUE_BLOCK D02
Full Line CN: “你嫌她是乡下人，可你们全家，是靠她活到今天的。”
Audio Continuity: continuous_across_micro_shots
Do Not Cut Mid-Sentence: yes
```

禁止把它写成两个独立台词。

---

### 六、每场对白最低完整句数量

每个对白 / 冲突场景必须至少包含：

```text
DIALOGUE SCENE MINIMUM

- 1 条完整攻击句 / 威胁句 / 羞辱句
- 1 条完整反击句 / 揭露句 / 控制句
- 1 条完整 payoff 句或 cliffhanger 句
```

60s 单集参考要求：

```text
60s EPISODE DIALOGUE REFERENCE

Complete Dialogue Sentence Blocks: 6–10
Core Memorable Lines: ≥3
Fragmentary Lines: ≤20% of all dialogue lines
One-word reaction lines: ≤2 per episode
```

90s 单集参考要求：

```text
90s EPISODE DIALOGUE REFERENCE

Complete Dialogue Sentence Blocks: 9–14
Core Memorable Lines: ≥4
Fragmentary Lines: ≤20% of all dialogue lines
One-word reaction lines: ≤3 per episode
```

注意：这些是对白结构参考，不是强制凑数量。不得为了满足句块数量添加无意义台词。

---

### 七、MICRO_SHOT_UNIT 模板修正

原模板中的：

```text
Dialogue CN:
  - Speaker:
  - Line:
```

必须替换为：

```text
Dialogue CN:
  - dialogue_block_id:
  - Speaker:
  - Full Line CN:
  - Line Status: complete_sentence / offscreen_continuation / no_dialogue / reaction_fragment
  - Must Speak Verbatim: yes
  - Can Cut Mid-Line: no
  - Audio Continuity:
  - delivery:
```

规则：

```text
如果 Line Status = complete_sentence
则 Full Line CN 必须是一句完整中文台词。

如果 Line Status = offscreen_continuation
则必须绑定同一个 dialogue_block_id，不能另起碎句。

如果 Line Status = reaction_fragment
只能用于“啊？”、“你说什么？”、“不可能。”等短反应，不得承担核心信息。
```

---

### 八、VIDEO_GENERATION_TASK 中的对白连续性字段

每个包含对白的 VIDEO_GENERATION_TASK 必须新增：

```text
Dialogue Continuity Plan:

- Dialogue Blocks Included:
  - D01:
    full_line_cn:
    speaker:
    spoken_in_micro_shot:
    audio_continues_over:
    must_remain_complete_in_selects_edl:

- Forbidden Audio Cuts:
  - do not cut before sentence completion
  - do not split one line into multiple unrelated prompts
  - do not drop final reveal words
  - do not trim breathing pause before payoff if it carries tension
```

---

### 九、Native Video Audio Request 修正

原字段：

```text
Line CN:
```

必须改为：

```text
Full Line CN:
```

并新增：

```text
Line Integrity:
- Complete Sentence: yes
- Must Speak Full Line: yes
- Do Not Split Into Fragments: yes
- Do Not Improvise Shorter Version: yes
- Do Not Drop Final Clause: yes
- If Too Long: rewrite before generation, do not cut during generation
```

如果一句台词超过模型稳定口播长度，不允许直接拆碎，必须先改写成更短但完整的句子。

错误：

```text
原句太长 → 拆成三段半句话
```

正确：

```text
原句太长 → 改写成一句更短的完整台词
```

---

### 十、SELECTS_EDL 台词保护规则

SELECTS_EDL 不得只按画面好看剪，必须保护完整台词。

新增字段：

```text
SELECTS_EDL DIALOGUE PROTECTION

- dialogue_block_id:
- full_line_cn:
- selected_audio_in:
- selected_audio_out:
- sentence_complete: yes / no
- final_clause_preserved: yes / no
- can_trim_before_line: yes / no
- can_trim_after_line: yes / no
- can_trim_inside_line: no
```

失败判定：

```text
如果 sentence_complete = no
则该 EDL 不合格。
```

---

### 十一、失败判定

出现以下任一情况，判定对白拆分失败：

- 核心台词被拆成多个半句话。
- 一个 MICRO_SHOT_UNIT 只写一句无信息短词，却承担剧情推进。
- 角色全程没有一句完整攻击 / 揭露 / 反击台词。
- Native Video Audio Request 中 Full Line CN 不完整。
- SELECTS_EDL 剪掉台词最后的揭露词。
- 反应镜头插入导致语音断裂。
- 每个镜头都有台词，但没有一句能单独成立。
- 碎句比例超过 20%。

失败后必须回滚：

```text
Current Stage: DIALOGUE_SENTENCE_BLOCK / MICRO_SHOT_UNIT RETRY
Completed Stage: not completed
Next Allowed Stage: rewrite dialogue blocks before micro-shot planning
```

---

### 十二、补丁口诀

镜头碎，台词不能碎。  
切画面，不切句子。  
一句爽点台词，必须完整说完。  
反应镜头服务台词，不打断台词。  
证据插入服务揭露，不拆碎揭露。  
短剧要碎剪辑，不要碎语言。  
没有完整攻击句，就没有爽点。  
没有完整揭露句，就没有反转。  
没有完整 cliffhanger 句，就没有追更。

---
