---
name: manga-character-sheet
description: "Create single-character production reference sheets for non-live-action anime, manga, webtoon, guoman/manhua, comic, chibi, mascot, anthropomorphic, creature-like, and stylized IP characters. Use when the user asks for manga character sheet, anime character reference sheet, webtoon character board, guoman character design, manhua role sheet, comic character turnaround, 二次元角色设定, 动漫角色三视图, 漫画角色设定板, 国漫角色板, 非真人动漫形象, Q版角色设定, IP吉祥物动漫角色板, animal / object / fantasy creature mascot sheet, or asks to turn a drawn/stylized character image, manga-style profile, or text description into one reusable visual character board. The deliverable is one clean single-character reference image, not a live-action human casting board, photoreal actor sheet, poster, cover, storyboard, scene illustration, video task, or multi-character cast lineup. 中文触发：动漫角色设定、国漫人物设定、网漫角色板、IP吉祥物角色板、漫剧角色、漫剧人设。"
---


## Conversation Language

Before user-visible output, set the language in this order: explicit user request > runtime/app UI locale > dominant language of the latest user message > English. Do not default to Chinese from the Skill source, examples, triggers, title, or conversation history. Keep replies, updates, `AskUser` cards and options, and delivery notes in that language unless bilingual output or fixed copy is requested; generation prompts may remain English.
# Manga Character Sheet

## Global Intake And Clarification Rule

Before sending any welcome, preamble, workflow-loaded message, progress note, normal chat question, or markdown questionnaire, check whether the current task is missing information required to choose a route, lock scope, preserve product/brand/story truth, select a direction, approve a plan, upload assets, confirm constraints, or continue execution.

If any such user input is missing, the first user-visible action after loading the Skill MUST be an `AskUser` call that collects the missing information. Do not first say hello, do not announce that the workflow is loaded, do not describe the phases, and do not ask the same questions in ordinary text.

Bundle related missing fields into the smallest practical number of `AskUser` cards. Use localized field labels, options, helper text, and custom-answer choices according to the Conversation Language. After calling `AskUser`, stop and wait for the user's response before planning, generating, writing prompts, or producing final assets.

If the runtime does not expose `AskUser`, stop and state that the required intake card is unavailable; do not replace the intake with a text-only welcome or questionnaire.

## 0. Core Positioning

This Skill creates production reference sheets for non-live-action character design in anime, manga, webtoon, guoman/manhua, comic, chibi, mascot, anthropomorphic, object-personified, monster, creature, and stylized IP forms.

Core deliverable:

```text
ONE NON-LIVE-ACTION CHARACTER
ONE PRODUCTION REFERENCE IMAGE
ONE SELECTED LAYOUT PRESET
WHITE / OFF-WHITE BACKGROUND
NO SCENE
NO POSTER COMPOSITION
```

This Skill can produce anime/manga turnaround sheets, face + turnaround identity sheets, basic manga character boards, expression and pose sheets, comic performance sheets, mascot/chibi/anthropomorphic reference sheets, prop interaction sheets, evolution/outfit/form variant sheets, and full manga technical character boards.

This Skill must not produce photoreal human sheets, live-action actor/casting boards, short-drama realistic character boards, scripts, storyboards, shot lists, video tasks, posters, covers, multi-character cast boards, random art collages, or scene illustrations.

If the user wants a realistic human, live-action, short-drama, or actor-like character board, route away from this Skill.

## 1. Scope Gate

Use this Skill only when the intended character is visibly non-live-action or stylized:

```text
anime
manga
webtoon
guoman / manhua
comic animation
chibi / Q-version
2D mascot
anthropomorphic animal / object / food / brand mark
fantasy creature / monster / spirit
stylized game/anime IP character
```

Do not convert a user's realistic-human request into manga style just to fit this Skill. If the user provides a reference image, preserve the reference medium unless they explicitly request manga/anime restyling.

## 2. Universal Production Rules

All layout modes and presets must obey:

```text
one character only
one image only unless the user explicitly requests multiple sheets
pure white or off-white background
no scene background
no environmental storytelling
same character identity across every panel
same illustration medium across every panel
clean structured production-reference layout
no random collage
no poster composition
no watermark
no logo unless the logo is an intentional character mark supplied by the user
no UI
no social media screenshot effect
```

Every panel must be a clean cutout-style character reference. If a room, street, landscape, stage, gradient backdrop, decorative wallpaper, or cinematic scene appears, the result fails.

## 3. AskUser Card Policy

Use `AskUser` when the brief lacks high-impact decisions. Do not ask a text-only question when generation or layout selection depends on the answer.

Ask when the user's requirement is broad or unclear, the character species/form is unclear, the user provides only a generic archetype, style family is unclear and would change the result, layout type is unclear and several layouts fit, the role/world/personality/costume direction would need major invention, or the user wants prop/evolution/outfit variants/exact text but does not define them.

Do not ask when the user provides a clear character image and asks for a direct sheet, the requested layout is explicit, or only minor details are missing.

Prefer one compact `AskUser` call with 3-5 independent questions.

### 3.1 Compact Intake Example

The following is an `AskUser` tool argument, not chat text:

```json
{
  "questions": [
    {
      "mode": "single",
      "question": "这个动漫角色大致是什么形态",
      "options": [
        {"type": "text", "content": "人形动漫角色", "description": "适合二次元、漫画、轻小说、网漫人物。"},
        {"type": "text", "content": "Q版 / 吉祥物", "description": "适合品牌IP、表情包、周边形象。"},
        {"type": "text", "content": "拟人动物或物品", "description": "适合动物、食物、产品或Logo拟人。"},
        {"type": "input", "content": "自定义形态"}
      ]
    },
    {
      "mode": "single",
      "question": "希望使用哪种画风",
      "options": [
        {"type": "text", "content": "日漫二次元", "description": "清晰线稿、干净上色、角色感强。"},
        {"type": "text", "content": "黑白漫画", "description": "适合网点、墨线、分镜漫画语感。"},
        {"type": "text", "content": "彩色网漫 / 国漫", "description": "适合竖漫、国漫、动态漫角色。"},
        {"type": "text", "content": "Q版可爱", "description": "适合圆润比例、表情包和周边。"},
        {"type": "input", "content": "自定义画风"}
      ]
    },
    {
      "mode": "single",
      "question": "这次要生成哪种角色板",
      "options": [
        {"type": "text", "content": "三视图", "description": "正面、侧面、背面。"},
        {"type": "text", "content": "基础角色板", "description": "三视图加表情或头像参考。"},
        {"type": "text", "content": "表情动作板", "description": "适合漫画、动画、表情包复用。"},
        {"type": "text", "content": "完整设定板", "description": "包含身份、色彩、表情、姿势、细节。"},
        {"type": "input", "content": "自定义交付范围"}
      ]
    }
  ]
}
```

## 4. Brief Completeness Gate

Before any character generation, resolve these fields through explicit user input, reference-image preservation, or `AskUser`:

```text
character_form: humanlike anime / chibi / mascot / animal / object-personified / creature / monster / other
age_or_stage_impression: childlike / teen / young adult / ageless mascot / ancient creature / other, when relevant
role_or_world_context: school, fantasy, sci-fi, urban, historical, brand mascot, game, webtoon, etc.
visual_style: anime, manga ink, webtoon, guoman, chibi, flat mascot, painterly anime, stylized 3D anime, etc.
personality_impression: cute, calm, dangerous, mischievous, heroic, eerie, elegant, comedic, etc.
costume_or_body_design: outfit, silhouette, markings, body shape, fur/scales/material, accessories
deliverable_scope: turnaround, basic board, expression/pose, prop interaction, variants, full technical
forbidden_drift: identity anchors that must not change
```

Do not infer protected human traits, nationality, ethnicity, religion, or culture from stereotypes. Ask only when such details are explicitly relevant to the user's story world or visual expectation.

For non-human and mascot characters, identity includes silhouette, head/body ratio, ears/horns/tail/wings, surface markings, color blocks, eye shape, mouth shape, limb count, accessory placement, and any brand or species marks.

## 5. Input Routing

Route existing stylized character images as identity/style sources; route text-only descriptions only after resolving form, role/world, visual style, personality, costume/body design, and deliverable scope; route story or webtoon profiles by extracting character-function information only; and split multi-character requests into one sheet per character.

For references, preserve face/head geometry, eye style, hairstyle, ears/horns/tail/wings, body proportion, head-body ratio, costume/body silhouette, markings, colors, line art, palette, shading, edge treatment, and realism level. Do not turn a stylized character into a photoreal person or realistic animal unless explicitly requested.

## 6. Sheet Type Router

Choose the simplest sheet type that fully satisfies the user request:

```text
Type A - Turnaround Only: front / side / back / optional 3/4 full-body views.
Type B - Basic Manga Character Sheet: turnaround, head/face reference, 4-6 expressions, color or detail area.
Type C - Expression & Pose Sheet: turnaround, expression library, head angles, acting poses, hand/paw/gesture variations.
Type D - Prop Interaction Sheet: identity views plus controlled prop use and gesture/appendage interaction.
Type E - Evolution / Variant Sheet: same character across stages, forms, outfits, or seasonal variants.
Type F - Full Technical Manga Board: profile, color, master views, silhouette, emotions, micro-expressions, head structure, posture, close-up, costume/body details, hands/paws/wings/tail actions.
```

## 7. Layout Presets

The Skill supports flexible layout presets. Ratios are recommended ranges, not fixed constraints. Always reserve readable full-body cells before secondary panels.

Full-body hard constraints:

```text
Every required full-body view must be fully visible from head or top silhouette to feet / paw / tail-end / lower body end.
No required head, hair, ears, horns, hands, fingers, paws, claws, wings, tail, hem, feet, shoes, or prop may be cropped or hidden.
Each full-body view must occupy its own independent cell.
No overlapping silhouettes.
Turnaround views must keep comparable scale, camera distance, lighting, and ground line.
```

### P01 - Face + Turnaround Hero

Left 30%-40%: one large face/head close-up. Right 60%-70%: Front, Profile, Back full-body views.

Prompt lock:

```text
Create one clean manga/anime character design reference sheet on a pure white background. Use a split layout: the left 30%-40% of the canvas is one ultra-large high-definition face or head close-up; the right 60%-70% contains three full-body standing turnaround views: Front, strict Profile, and Back. All views must show the exact same non-live-action character, same face or head shape, eye style, silhouette, body proportion, costume or body markings, colors, accessories, and illustration style. No scene, no props unless requested, no extra characters, no logos, no watermarks, no UI, no text unless requested.
```

### P02 - Turnaround Column + Expression Matrix

Left 30%-40%: full-body front, profile, back. Right 60%-70%: 2x3 head-and-shoulder or head-only expression matrix.

Prompt lock:

```text
Create one structured manga/anime character reference board on a pure white background. Use a split-screen composite layout: left vertical column plus right matrix grid. Left column contains three full-body views of the same character in equal scale: strict front view, strict 90-degree profile view, and strict back view. Right column contains a clean 2x3 expression matrix: neutral front, back-of-head or rear silhouette, 3/4 right, 3/4 left, smiling, angry or frowning. Same face or head shape, eye style, body proportion, costume/body design, color blocks, markings, and drawing style across all panels.
```

### P03 - Detail Board

Left 40%-50%: full-body turnaround views. Right top: 2x3 head-angle grid. Right bottom: 2x3 costume/body/marking/prop detail grid.

Prompt lock:

```text
Create one high-definition manga/anime character detail board on a pure white background. On the left side, show the same character in full-body front, side, and back views, same scale, neutral stance. On the right side, divide the space into two clean grids. The upper grid shows head-angle references: front, slight top-down, back-of-head, left side profile, near-side comparison, and 3/4 profile. The lower grid shows continuity-critical details: eye, hair/ear/horn/wing/tail detail if relevant, outfit or body marking, accessory, footwear or lower-body detail, and signature prop if requested. All panels must match the same non-live-action character and style.
```

### P04 - Manga Profile Card

Use for official character profile pages, artbook-like manga settings, collectible cards, or when the user wants visible profile structure. Default canvas is 3:4 vertical on a white background.

If no exact text is provided, replace text-dependent blocks with visual content: portrait close-up, expression heads, silhouette, color swatches, costume/body detail, accessory/prop close-up, hand/paw gesture, material or marking sample. Do not leave blank information boxes in no-text mode.

### P05 - Three-Row Performance Sheet

Row 1: full-body turnaround. Row 2: six facial emotions or face/head expressions. Row 3: four acting poses or user-customized actions.

### P06 - Full Technical Manga Board

Use only for full technical completeness. Include Character Profile, Color System, Master Identity Views, Silhouette System, Core Emotion Library, Micro Expression Library, Head Structure System, Posture Library, Hero Close-up, Costume/Body/Marking Breakdown, and Hand/Paw/Wing/Tail Action Library as relevant to the character form.

### P07 - Evolution / Variant Sheet

Use for transformations, forms, outfit variants, seasonal variants, power stages, or normal/true form. Preserve the same head/face logic, eye style, silhouette, body proportion, and core identity across all stages.

## 8. Style Router

Choose one style route and keep it stable across all panels:

```text
Anime / Light Novel: clean line art, polished cel shading, expressive eyes, costume detail.
Manga Ink / Black-and-White: clean black ink line art, controlled screen tone, readable silhouette.
Webtoon / Guoman / Manhua: polished color comic rendering, clean comic animation language, expressive performance panels.
Chibi / Mascot / IP: strong shape language, simple readable silhouette, large expressive head, application poses.
Creature / Monster / Non-Human: clear species silhouette, consistent anatomy logic, marking and appendage details.
```

Avoid photoreal actor face, cosplay, random 3D render, storyboard scenes, speech bubbles unless requested, over-cinematic lighting, inconsistent mascot variants, and generic animal photos.

## 9. Text Rendering Mode

Default to no text unless the user provides exact text or asks for profile-card typography.

```text
A - No Text: no readable text, labels, title, fake typography, blank info fields, or empty note cards.
B - Blank Template Fields: only when the user explicitly requests later text overlay or editable fields.
C - Editorial Typography: for artbook, official profile page, manga setting card, or collectible profile card; exact text accuracy is not guaranteed.
D - Accurate Text Overlay: generate clean no-text/sparse-template image first, then add exact text through separate overlay.
```

## 10. Dynamic Prompt Compiler

When compiling a generation prompt:

```text
1. State selected Sheet Type.
2. State selected Layout Preset.
3. State selected Text Mode.
4. State selected style route.
5. State adaptive canvas, full-body containment, and non-overlap rules.
6. State universal white-background rules.
7. Add character identity anchors.
8. Add reference style fingerprint and global style lock when a reference exists.
9. Add preset-specific prompt lock.
10. Add user custom expressions / actions / props / stages.
11. Add text mode rules.
12. Add negative constraints.
```

Universal prompt header:

```text
Create ONE SINGLE production reference sheet for ONE NON-LIVE-ACTION CHARACTER ONLY.
Use a clean structured layout on a pure white or off-white background.
Every panel must be a clean cutout-style character reference.
No scene background, no environmental setting, no room, no street, no landscape, no studio set, no gradient backdrop, no decorative pattern, no cinematic atmosphere.
The same character identity must remain consistent across all panels: same face/head shape, same eye style, same silhouette, same body proportion, same costume or body markings, same colors, same accessories, same illustration style.
Use an adaptive canvas ratio selected after content inventory. Reserve independent full-body bounding boxes first. Every required full-body figure must be completely visible with safe headroom and lower-body clearance, non-overlapping silhouettes, and consistent scale.
```

Reference style lock:

```text
Inherit the exact visual style of the provided stylized character reference across the entire sheet. All full-body views, portraits, expressions, head angles, hands/paws/wings/tails, costume/body details, accessories, props, and color swatches must share the same medium, line-art language, color palette, shading method, texture density, edge treatment, material abstraction, lighting logic, and realism level. Details may show clearer construction but must not become more photorealistic, more 3D, more product-like, or more materially realistic than the main character.
```

## 11. Negative Constraint Library

Universal negatives:

```text
photoreal human, live-action actor, cosplay photo, casting board, multiple characters, different character in different panels, changed face/head shape, changed eye style, changed hairstyle or ears/horns/tail/wings, changed species, changed body proportion, changed head-body ratio, changed costume silhouette, changed body markings, random outfit changes, cropped full-body views, cropped head, cropped ears, cropped horns, cropped hands, cropped paws, cropped wings, cropped tail, cropped feet, hidden lower body, character outside frame, overlapping full-body views, intersecting silhouettes, inconsistent scale, compressed anatomy, distorted proportions, tiny unreadable full-body views, missing front view, missing side view, missing back view, overfilled collage, random collage, poster composition, cinematic key visual, storyboard scene, moodboard collage, scene background, environmental background, room, street, landscape, city, forest, stage set, gradient background, decorative pattern, cinematic atmosphere, dramatic shadow, props as background, repeated generic fashion poses, prop dominating the sheet, fake text unless editorial typography mode is selected, garbled Chinese, garbled English, placeholder blank boxes when no text is provided, watermark, logo, UI elements, social media screenshot effect, mixed media, mixed rendering styles, style drift, detail-panel realism upgrade, product-photography accessory, photographic shoes, realistic leather grain, photographic fabric texture, PBR material study, ray-traced object lighting
```

Style-specific negatives:

```text
Anime / manga: photoreal actor face, random 3D render, low-detail cartoon, cluttered poster, cheap chibi style unless requested.
Manga ink: grayscale photo, muddy shading, storyboard panels, speech bubbles unless explicitly requested.
Webtoon / guoman: live-action realism, cosplay, single cover illustration, over-cinematic lighting.
Chibi / mascot: realistic human anatomy, over-complex anatomy, inconsistent mascot variants, unclear silhouette, random accessories.
Creature / monster: generic animal photo, realistic taxidermy, horror movie poster, creature hidden in a scene.
```

## 12. Acceptance Gate

Before delivery, check:

```text
One non-live-action character only: yes / no
One image only: yes / no
Pure white or off-white background: yes / no
No scene or environment: yes / no
Selected sheet type is recognizable: yes / no
Selected layout preset is recognizable: yes / no
Every required full-body view is fully visible: yes / no
Full-body views use independent non-overlapping cells: yes / no
Front / side / back are present when required: yes / no
Same face/head shape across panels: yes / no
Same eye style: yes / no
Same body proportion or head-body ratio: yes / no
Same costume/body markings/colors: yes / no
Same illustration medium and rendering style: yes / no
Reference style fingerprint preserved when provided: yes / no
No photoreal human or live-action drift: yes / no
No poster composition: yes / no
No watermark / logo / UI: yes / no
No unwanted text or blank placeholder boxes: yes / no
```

Fail if the character becomes photoreal/live-action without explicit request, contains multiple characters, drifts in identity/species/form/silhouette/drawing style, is generated from only a generic archetype without clarification, misses required views, crops or overlaps full-body views, becomes a poster/cover/storyboard/scene, or upgrades detail panels into a more realistic rendering pipeline than the main character.

## 13. User-Facing Output Template

For Chinese:

```text
Manga Character Sheet 方案

角色板类型：
排版预设：
文字模式：
视觉风格：
角色形态：
角色来源：
角色名 / 代号：
角色简介：

身份锚点：
- 脸 / 头部：
- 眼睛：
- 轮廓：
- 比例：
- 服装 / 身体标记：
- 色彩系统：
- 标志道具：
- 禁止偏移：

选定版式：
- 主区域：
- 次级区域：
- 细节区域：
- 文字 / 信息区域：

自定义模块：
- 表情：
- 动作：
- 手势 / 爪 / 翼 / 尾：
- 道具：
- 阶段 / 服装 / 形态变化：

生成 Prompt：

负向约束：

验收检查：
```

## 14. Image Generation Behavior

If the user asks to generate the character sheet image and image generation is available:

```text
1. Run the Scope Gate and Brief Completeness Gate.
2. If high-impact form, role/context, style, identity, costume/body design, personality, or deliverable scope is unresolved, call AskUser and stop before generation.
3. Lock sheet type, layout preset, text mode, and style route.
4. Compile an English generation prompt.
5. Generate only after minimum identity and style anchors are resolved.
6. After generation, evaluate against the selected preset and acceptance gate.
```

Use image editing only when the user wants to keep the source pose/state. Use new image generation when the sheet requires new poses, angles, modules, or multi-panel composition.

## 15. Execution Mantra

```text
One non-live-action character. One production reference image. White background. No scene.
Manga/anime style is a scope boundary, not decoration added to live-action tasks.
Use the simplest sheet type and layout preset that satisfies the request.
Do not force 11 modules unless the user asks for full technical completeness.
Protect identity, silhouette, proportion, markings, colors, and illustration pipeline.
For mascots and creatures, anatomy logic and silhouette consistency are identity.
Do not make a poster, cover, storyboard, or cast lineup.
```
