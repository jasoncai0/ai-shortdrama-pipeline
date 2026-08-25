## 3. 运行时状态（RUNTIME STATE，跨 session 续写的命脉）

不要存“历史摘要”——摘要驱动不了下一集。存当前状态快照，每集去演化它。这是 save 文件 vs changelog 的区别。

每次输出结尾更新并附上（用户下次回贴即可续写，对应 MODE C）：

```text
RUNTIME STATE v{n}

[元]
模式 / 爽点类型 / monetization / market / episode_length / 进度=已完成到 E{x}

[世界视觉]
WORLD_VISUAL_BIBLE@版本 · 状态(草稿/锁定) · 画幅=16:9 横版
AtmosphereAnchor · WorldRulesVisual · CharacterEvolutionDirection · ColorSystem · LightingSystem · MaterialLanguage · LocationDirection · PropSymbolSystem · ActionLanguage · EmotionalCurve

[角色资产]
每个角色：
CHAR_xxx@base_stage · 状态(草稿/锁定) · 画幅=4:5或3:4 · 是否通过 BASE LOCK GATE · 参考图
CHAR_xxx@sheet · 状态(未生成/草稿/锁定) · 画幅=16:9或4:3 · 是否通过 SHEET LOCK GATE · 派生自哪个 @base · 参考图
CharacterAssetCompletion = base_only_pending_confirmation / base_only_pending_sheet / base_confirmed_sheet_deferred_by_user / base_and_sheet_complete
CurrentGoal · CurrentEmotion · CurrentPower(0–10) · CurrentKnowledge(知道什么/不知道什么) · CurrentRelationship · Costume引用 · Location

规则：

- 主角 / 重要角色的 CharacterAssetCompletion 必须达到 `base_and_sheet_complete`，才允许进入人物关键帧或分镜生产。
- 配角允许停在 `base_only_pending_confirmation` 或 `base_only_pending_sheet`，除非用户要求或剧情升级为重要角色；但即使是配角，未确认的 @base 也不得用于 keyframe / I2V。
- 如果主角 / 重要角色状态仍为 `base_only_pending_confirmation`，系统必须停在 BASE CONFIRMATION GATE 等用户确认；如果状态为 `base_only_pending_sheet`，系统必须优先继续生成 `CHAR_xxx@sheet`，不得跳到 LOCATION / PROP / COSTUME 或分镜。

[声音资产 / VOICE REGISTRY]
每个主角 / 重要角色：
CHAR_xxx · voice_id · gender · age_range · vocal_texture · pitch · speed · energy · emotional_baseline · accent · speaking_style · forbidden_voice_traits · sample_line_cn
VoiceLockStatus = 未生成 / 草稿 / 锁定

规则：
- 同一角色全片必须使用同一个 voice_id。
- 不同角色不得共用 voice_id，除非剧情明确是伪装 / 模仿。
- 角色成长可以改变语速、能量、情绪，但不得改变基础音色身份。
- 如果主要角色 voice_id 缺失，不得进入 含对白的视频生成阶段。

[视频执行]
AUDIO_EXECUTION_MODE = native_video_audio
VIDEO_GENERATION_MODE = sequential
BGM_POLICY = no_music_in_video_generation
NativeDialogueLanguage = Chinese

[镜头生产]
ShotUnitPolicy = MICRO_SHOT_UNIT 必须碎；VIDEO_GENERATION_TASK 可以打包
MicroShotDuration = 1-6s; DialogueShotMax = 8s; VideoTaskDuration = 6-15s
ShotLanguageCoverage = OTS / reaction / close-up / insert / power angle / silence beat / payoff shot

[动作意图 / 对手身份 / 群众控制]
ActionStatePolicy = Actor / Action / Target / Motivation / Method / EmotionalState / PowerMeaning / Result 必填
DialogueTargetPolicy = Speaker / SpeakingTo / HeardBy / RelationshipMeaning / IntendedEffect 必填
PartialBodyIdentityPolicy = OTS / 手部 / 衣袖 / 肩膀 / 背影 / 遮挡人物必须标明 BelongsTo
ExtrasPolicy = EXTRAS 随机多样、非复用、不得像任何 CHARACTER @base
ExtrasFaceDiversityGate = 未检查 / 通过 / 需重做

规则：
- 特写中出现的对手衣袖、手、肩膀、背影必须说明属于哪个角色。
- 群众登记为 EXTRAS，不得登记为 CHARACTER。
- 群众不得使用或复制主角 / 反派 / 重要角色 @base 脸。

[单集关系 / 可拆分脚本]
EpisodeRelationMapStatus = 未生成 / 草稿 / 通过
EpisodeScriptDraftStatus = 未生成 / 草稿 / 通过
CoreRelationshipThisEpisode:
RelationshipClarityGate = 未通过 / 通过
CausalChain = Because / But / Therefore

规则：
- 每集进入 SHOT UNIT 前必须先通过 EPISODE RELATION MAP 与 EPISODE SCRIPT DRAFT。
- E01 前 20 秒必须交代至少一组核心人物关系。
- 如果 RelationshipClarityGate 未通过，不得进入分镜 / KEYFRAME / I2V。

[环境光 / 材质真实]
LightingIntegrationStatus = 未检查 / 通过 / 需重做
SceneLightSource · AmbientColor · KeyLightDirection · ShadowQuality · RimLightRule · ContactShadowRule
SkinLightResponse · FabricLightResponse · PropLightResponse · MetalGlassReflection · MaterialRealismNotes

规则：
- 人物、服装、道具、背景必须共享同一场景光源。
- 所有 SHOT KEYFRAME / I2V 必须有环境光融合字段。
- 如果出现抠图感、光源不一致、材质假、无接触阴影，必须回到 prompt / keyframe / asset 阶段重做。

[世界]
CurrentTime · 天气 · ActiveLocations · 已损毁/已用掉的资产

[冲突线]
每条：冲突 · 当前升级档(1–5) · 计划高潮集 · 计划解决集
← 防中段塌方，确保层层加码

[秘密排期]
每条：秘密 · 谁知道 · 观众知不知道 · 计划揭露集 · 触发条件
← 防提前漏、防忘了兑现

[剧集]
last_cliffhanger_type

[事件日志-极薄]
仅记可能被回扣的关键事件，一行一条
```

续写 = 先读状态 → 写新集 → 演化状态 → 版本号 +1。

这是长剧不崩、人设不漂的唯一保证。

---
