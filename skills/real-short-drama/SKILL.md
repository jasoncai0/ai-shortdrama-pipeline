---
name: real-short-drama
description: "工业级 AI 竖屏短剧（micro-drama）生产引擎，用于原创短剧或把小说、网文、脚本改编成竖屏短剧。Use when the user asks to 做短剧、竖屏短剧、微短剧、AI 短剧、爽剧、小说改短剧、脚本拆分镜、短剧分镜、短剧 prompt、短剧世界观, or any workflow that needs a complete AI micro-drama production package. Produces story framework, world visual bible, character base references, confirmed character sheets, episode beats, shot/keyframe plans, image/video prompts, reference manifests, video task cards, EDL/selects, and runtime state. Enforces AI-generated photoreal human drama output, not live human shooting prep; base-before-sheet confirmation gates; predecessor node_key checks; confirmed visual reference inputs for keyframes and I2V; and video start-frame vs identity-reference separation. 中文触发：漫剧、竖屏剧、AI 短剧生产。"
---

# AI 竖屏短剧生产引擎 v0.1.2（完整版：sheet 内保留紧凑三视图 + 禁止整图塌缩成重复站姿版）


## Global Conversation Language Rule

Before any user-visible response, progress update, `AskUser` card, option label, clarification, or delivery note, determine the interface language with this priority:

1. Use the language explicitly requested by the user.
2. Else use the runtime/app UI language or locale when it is available.
3. Else use the dominant natural language of the user's latest message.
4. If the language is still ambiguous, use English.

Do not default to Chinese just because this Skill has Chinese examples, Chinese triggers, Chinese source text, a Chinese title, or prior Chinese conversation history. Keep all user-visible text in the selected language unless the user explicitly asks for bilingual output or supplies final copy that must stay in another language. Media-generation prompts may remain English when the workflow requires it.

## Reference index

This skill is large. The sections below live in `references/` — read the one
you need rather than loading the whole thing.

- [Version history](references/00-changelog.md)
- [0. 系统定位与五层架构（先读）](references/01-0-系统定位与五层架构-先读.md)
- [v34 修订说明](references/02-v34-修订说明.md)
- [0.1 PATCH：AI-ONLY PHOTOREAL DRAMA PRODUCTION IDENTITY LOCK](references/03-0-1-patch-ai-only-photoreal-drama-production-ide.md)
- [0.1A PATCH：STRICT PIPELINE STATE MACHINE & NO AUTONOMOUS STAGE JUMP LOCK](references/04-0-1a-patch-strict-pipeline-state-machine-no-auto.md)
- [0.1N PATCH：STORY FRAMEWORK BEFORE VISUAL BIBLE LOCK](references/05-0-1n-patch-story-framework-before-visual-bible-l.md)
- [0.1O PATCH：PRODUCTION FILE CONTRACT & CANVAS WRITEBACK LOCK](references/06-0-1o-patch-production-file-contract-canvas-write.md)
- [0.1P PATCH：WRITEFILE CANVAS NODE_KEY PERSISTENCE LOCK](references/07-0-1p-patch-writefile-canvas-node_key-persistence.md)
- [0.1Q PATCH：MANDATORY PREDECESSOR NODE CONSUMPTION GATE](references/08-0-1q-patch-mandatory-predecessor-node-consumptio.md)
- [0.1R PATCH：CHARACTER BASE PRIMARY REFERENCE & 11-MODULE CHARACTER SHEET PERFORMANCE AUXILIARY LOCK](references/09-0-1r-patch-character-base-primary-reference-11-m.md)
- [0.1S PATCH：KEYFRAME REFERENCE INPUT MANIFEST & NO SELF-INVENTED VISUAL ASSET LOCK](references/10-0-1s-patch-keyframe-reference-input-manifest-no-.md)
- [0.1T PATCH：VIDEO START FRAME ≠ IDENTITY REFERENCE NODE LOCK](references/11-0-1t-patch-video-start-frame-identity-reference-.md)
- [0.1B PATCH：SEQUENTIAL CHARACTER FORM CONFIRMATION LOCK](references/12-0-1b-patch-sequential-character-form-confirmatio.md)
- [0.1C PATCH：WORLD_VISUAL_BIBLE DIRECT VISUAL RESULT LOCK](references/13-0-1c-patch-world_visual_bible-direct-visual-resu.md)
- [0.1D PATCH：CHARACTER IDENTITY BASE DIRECT THREE-VIEW FULL-BODY RESULT LOCK](references/14-0-1d-patch-character-identity-base-direct-three-.md)
- [0.1E PATCH：FIRST VISUAL STYLE BOARD MANDATORY START LOCK](references/15-0-1e-patch-first-visual-style-board-mandatory-st.md)
- [0.1F PATCH：GENERATED IMAGE REQUIRED GATE LOCK](references/16-0-1f-patch-generated-image-required-gate-lock.md)
- [0.1G PATCH：THREE-VIEW NO-TEXT PHOTOREAL STUDIO BASE LOCK](references/17-0-1g-patch-three-view-no-text-photoreal-studio-b.md)
- [0.1H PATCH：SHOT UNIT SEMANTIC RESTRUCTURE & BATCHED KEYFRAME VIDEO TASK LOCK](references/18-0-1h-patch-shot-unit-semantic-restructure-batche.md)
- [0.1I PATCH：BATCHED KEYFRAME PRODUCTION ACCEPTANCE GATE](references/19-0-1i-patch-batched-keyframe-production-acceptanc.md)
- [0.1J PATCH：VIDEO TASK TOOL CALL CARDINALITY LOCK](references/20-0-1j-patch-video-task-tool-call-cardinality-lock.md)
- [0.1K PATCH：DIALOGUE SENTENCE BLOCK LOCK](references/21-0-1k-patch-dialogue-sentence-block-lock.md)
- [0.1L PATCH：MICRO_SHOT_UNIT COUNT SOFT RANGE & DRAMA INTEGRITY LOCK](references/22-0-1l-patch-micro_shot_unit-count-soft-range-dram.md)
- [0.1M PATCH：NARRATIVE RHYTHM INHERITANCE LOCK](references/23-0-1m-patch-narrative-rhythm-inheritance-lock.md)
- [0.2 PATCH：AI DRAMA GENERATION GLOBAL EXECUTION LOCK](references/24-0-2-patch-ai-drama-generation-global-execution-l.md)
- [0.3 PATCH：SHORT-DRAMA MICRO-SHOT LANGUAGE & VOICE CONSISTENCY LOCK](references/25-0-3-patch-short-drama-micro-shot-language-voice-.md)
- [0.4 PATCH：EPISODE RELATION CLARITY & SCRIPT DENSITY LOCK](references/26-0-4-patch-episode-relation-clarity-script-densit.md)
- [0.5 PATCH：ENVIRONMENT LIGHT INTEGRATION & MATERIAL REALISM LOCK](references/27-0-5-patch-environment-light-integration-material.md)
- [0.6 PATCH：SCENE CONTINUITY LEDGER LOCK](references/28-0-6-patch-scene-continuity-ledger-lock.md)
- [0.7 PATCH：HAND & PROP INTERACTION RISK LOCK](references/29-0-7-patch-hand-prop-interaction-risk-lock.md)
- [0.8 PATCH：LIP-SYNC RISK & DIALOGUE COVERAGE LOCK](references/30-0-8-patch-lip-sync-risk-dialogue-coverage-lock.md)
- [0.9 PATCH：SOUNDSPACE & MIXING REALISM LOCK](references/31-0-9-patch-soundspace-mixing-realism-lock.md)
- [0.10 PATCH：HIGH-RISK SCENE DOWNGRADE ROUTER](references/32-0-10-patch-high-risk-scene-downgrade-router.md)
- [0.11 PATCH：AUTHORIZED ORIGINAL CHARACTER ONLY LOCK](references/33-0-11-patch-authorized-original-character-only-lo.md)
- [0.12 PATCH：ACTION INTENT / OPPONENT IDENTITY / EXTRAS FACE DIVERSITY LOCK](references/34-0-12-patch-action-intent-opponent-identity-extra.md)
- [0.13 PATCH：CHARACTER ASSET QUANTITY & SHEET INTERPRETATION LOCK](references/35-0-13-patch-character-asset-quantity-sheet-interp.md)
- [0.14 PATCH：NO-TTS NATIVE VIDEO AUDIO EXECUTION LOCK](references/36-0-14-patch-no-tts-native-video-audio-execution-l.md)
- [0.15 PATCH：SEQUENTIAL BATCHED VIDEO GENERATION EXECUTION LOCK](references/37-0-15-patch-sequential-batched-video-generation-e.md)
- [0.16 PATCH：VIDEO REQUEST CHINESE DIALOGUE & NO MUSIC LOCK](references/38-0-16-patch-video-request-chinese-dialogue-no-mus.md)
- [0.17 PATCH：DEPRECATED SINGLE CONTINUOUS SHOT UNIT LOCK](references/39-0-17-patch-deprecated-single-continuous-shot-uni.md)
- [0.18 PATCH：IDENTITY REVEAL BUILD-UP & PAYOFF TIMING LOCK](references/40-0-18-patch-identity-reveal-build-up-payoff-timin.md)
- [0.19 PATCH：SCRIPT STRESS TEST MODE](references/41-0-19-patch-script-stress-test-mode.md)
- [0.20 PATCH：PAYOFF CAUSAL BRIDGE LOCK](references/42-0-20-patch-payoff-causal-bridge-lock.md)
- [0.21 PATCH：EVIDENCE PROP ABSTRACTION LOCK](references/43-0-21-patch-evidence-prop-abstraction-lock.md)
- [0.22 PATCH：SCENE COMPLEXITY BUDGET LOCK](references/44-0-22-patch-scene-complexity-budget-lock.md)
- [0.23 PATCH：DEPRECATED SINGLE-CONTINUOUS-SHOT SEMANTIC LOCK](references/45-0-23-patch-deprecated-single-continuous-shot-sem.md)
- [0.24 PATCH：STATUS-CODED HUMILIATION LOCK](references/46-0-24-patch-status-coded-humiliation-lock.md)
- [0.25 PATCH：PAYOFF RESPONSE VISUALIZATION LOCK](references/47-0-25-patch-payoff-response-visualization-lock.md)
- [0.26 PATCH：HISTORICAL SKILL-BUSINESS ROMANCE LOGIC LOCK](references/48-0-26-patch-historical-skill-business-romance-log.md)
- [0.27 PATCH：OCCULT OBJECT COLD CASE SUSPENSE LOCK](references/49-0-27-patch-occult-object-cold-case-suspense-lock.md)
- [0.28 PATCH：YOUTH ACADEMIC SECRET-CRUSH PAYOFF LOCK](references/50-0-28-patch-youth-academic-secret-crush-payoff-lo.md)
- [0.6 画幅规则（必须遵守）](references/51-0-6-画幅规则-必须遵守.md)
- [0.30 PATCH：EXECUTION COMPRESSION & MODE-BASED OUTPUT CONTROL LOCK](references/52-0-30-patch-execution-compression-mode-based-outp.md)
- [0.31 PATCH：FAST MINIMUM VIABLE EPISODE LOCK](references/53-0-31-patch-fast-minimum-viable-episode-lock.md)
- [0.32 PATCH：SHOT UNIT FIELD PRIORITY LOCK](references/54-0-32-patch-shot-unit-field-priority-lock.md)
- [0.33 PATCH：TEXT-IN-IMAGE BOUNDARY LOCK](references/55-0-33-patch-text-in-image-boundary-lock.md)
- [0.34 PATCH：CHANGE REQUEST IMPACT GATE](references/56-0-34-patch-change-request-impact-gate.md)
- [0.35 PATCH：FAILURE RECOVERY ROUTER](references/57-0-35-patch-failure-recovery-router.md)
- [0.36 PATCH：VILLAIN ACTION COST LOCK](references/58-0-36-patch-villain-action-cost-lock.md)
- [0.37 PATCH：HIGH-CONCEPT VISUAL BUDGET LOCK](references/59-0-37-patch-high-concept-visual-budget-lock.md)
- [0.38 PATCH：REAL-WORLD SENSITIVE TOPIC RISK LEVEL](references/60-0-38-patch-real-world-sensitive-topic-risk-level.md)
- [1. 输入模式与输出](references/61-1-输入模式与输出.md)
- [2. 工作流](references/62-2-工作流.md)
- [2.5 改编模式专章（MODE B：小说 / 脚本 → 短剧）](references/63-2-5-改编模式专章-mode-b-小说-脚本-短剧.md)
- [3. 运行时状态（RUNTIME STATE，跨 session 续写的命脉）](references/64-3-运行时状态-runtime-state-跨-session-续写的命脉.md)
- [4. 资产系统（Layer 3）](references/65-4-资产系统-layer-3.md)
- [4.1 WORLD VISUAL BIBLE 世界视觉设定板](references/66-4-1-world-visual-bible-世界视觉设定板.md)
- [4.2 WORLD_VISUAL_BIBLE 单图成板硬规则](references/67-4-2-world_visual_bible-单图成板硬规则.md)
- [4.3 必须提取的 WORLD_VISUAL_MODULES](references/68-4-3-必须提取的-world_visual_modules.md)
- [4.4 WORLD VISUAL BIBLE 固定版式](references/69-4-4-world-visual-bible-固定版式.md)
- [4.5 WORLD VISUAL BIBLE Prompt 模板](references/70-4-5-world-visual-bible-prompt-模板.md)
- [4.6 单图执行规则](references/71-4-6-单图执行规则.md)
- [4.7 CHARACTER BASE FIRST 强制规则](references/72-4-7-character-base-first-强制规则.md)
- [4.8 CHARACTER @base 角色基准图](references/73-4-8-character-base-角色基准图.md)
- [4.9 CHARACTER @sheet 角色设计表](references/74-4-9-character-sheet-角色设计表.md)
- [4.10 LOCATION 地点资产](references/75-4-10-location-地点资产.md)
- [4.11 PROP 道具资产](references/76-4-11-prop-道具资产.md)
- [4.12 COSTUME 服装资产](references/77-4-12-costume-服装资产.md)
- [4.13 角色资产通用规则](references/78-4-13-角色资产通用规则.md)
- [4.14 写作内核（决定剧好不好看）](references/79-4-14-写作内核-决定剧好不好看.md)
- [4.15 反无聊机制（最关键——无聊有固定病灶，逐个打）](references/80-4-15-反无聊机制-最关键-无聊有固定病灶-逐个打.md)
- [4.16 AI 视频落地约束（v34：碎镜头 + 批量关键帧任务）](references/81-4-16-ai-视频落地约束-v34-碎镜头-批量关键帧任务.md)
- [5. 节奏引擎（默认值，可被戏剧动机覆盖）](references/82-5-节奏引擎-默认值-可被戏剧动机覆盖.md)
- [5.5 场景层（SCENE：集和镜之间的戏剧引擎）](references/83-5-5-场景层-scene-集和镜之间的戏剧引擎.md)
- [6. 镜头模板 + MICRO_SHOT_UNIT + KEYFRAME + Batch Prompt 编译原则](references/84-6-镜头模板-micro_shot_unit-keyframe-batch-prompt-编译原.md)
- [6.5 Layer 5：原生视频音频与最终 BGM 边界（Native Audio / SFX / Final BGM Only）](references/85-6-5-layer-5-原生视频音频与最终-bgm-边界-native-audio-sfx-fi.md)
- [6.6 生产执行循环（v34：出图 → 碎镜头 → 批量视频任务 → EDL）](references/86-6-6-生产执行循环-v34-出图-碎镜头-批量视频任务-edl.md)
- [7. 输出前自检清单](references/87-7-输出前自检清单.md)
- [8. CLIFFHANGER 类型库](references/88-8-cliffhanger-类型库.md)
- [示例](references/89-示例.md)
- [口诀](references/90-口诀.md)
- [0.29 PATCH：MODERN & HIGH-CONCEPT SHORTDRAMA STABILITY BUNDLE](references/91-0-29-patch-modern-high-concept-shortdrama-stabil.md)
- [0.39 PATCH：AUDIO BGM CONTAMINATION CONTROL LOCK](references/92-0-39-patch-audio-bgm-contamination-control-lock.md)
- [0.40 PATCH：KEYFRAME CHARACTER IDENTITY & SCENE SPATIAL LOCK](references/93-0-40-patch-keyframe-character-identity-scene-spa.md)
- [0.41 PATCH：WARDROBE TIMELINE & BODY PART CONTINUITY LOCK](references/94-0-41-patch-wardrobe-timeline-body-part-continuit.md)
- [0.42 PATCH：CONFIRMED ASSET REGISTRY & CROSS-EPISODE MEMORY LOCK](references/95-0-42-patch-confirmed-asset-registry-cross-episod.md)
- [0.43 PATCH：EDITABLE FOOTAGE DENSITY & MICRO-SHOT HARD-CUT MATERIAL LOCK](references/96-0-43-patch-editable-footage-density-micro-shot-h.md)
- [0.44 PATCH：SELECTS EDL & CUTDOWN ASSEMBLY LOCK](references/97-0-44-patch-selects-edl-cutdown-assembly-lock.md)
