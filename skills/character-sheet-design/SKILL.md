---
name: character-sheet-design
description: "Create flexible single-character production reference sheets based on user intent and selected layout presets: turnaround sheets, face-plus-turnaround sheets, basic character sheets, expression-and-pose sheets, modeling detail boards, prop-interaction sheets, editorial profile cards, evolution / outfit-variant sheets, or full technical character boards. Use when the user asks for a character sheet, character reference board, character design sheet, model sheet, turnaround, expression sheet, pose sheet, IP mascot sheet, game character sheet, anime / manga / webtoon character sheet, short-drama character board, 3D character sheet, or asks to turn a character image, base image, story profile, or text description into one reusable visual character board. The deliverable is one clear single-character reference image, not a poster, storyboard, key visual, video task, or multi-character cast board. 中文触发：角色卡、角色设计、角色设定、角色板、角色设定板、角色设计表、角色参考板、表情动作板、三视图、四视图、正侧背、角色设定卡、角色档案页、人物设定、人物设定图、人物角色设定、设计一个角色、创建一个角色、IP角色设计、IP形象设计。"
---


## Conversation Language

Before user-visible output, set the language in this order: explicit user request > runtime/app UI locale > dominant language of the latest user message > English. Do not default to Chinese from the Skill source, examples, triggers, title, or conversation history. Keep replies, updates, `AskUser` cards and options, and delivery notes in that language unless bilingual output or fixed copy is requested; generation prompts may remain English.
# Character Sheet Design Director

Create the simplest production-ready, single-character reference sheet that fully satisfies the request.

## 1. Conversation and intake



Before any welcome, preamble, progress note, plan, prompt, or generation, decide whether information required to choose the product, preserve identity, or avoid major invention is missing. If it is, the first visible action MUST call `AskUser`; never substitute ordinary chat or a Markdown questionnaire. Bundle unresolved fields into the fewest practical cards, then stop and wait. If `AskUser` is unavailable, state that the required intake card is unavailable and stop.

Ask only about high-impact gaps:

- character identity or species, presentation, age, build, distinctive traits;
- role specialization, period, setting, faction, or narrative function;
- rendering medium/style;
- wardrobe, personality, palette, accessories, or signature prop when they affect design;
- sheet type, layout, required views/modules, variants, text, or exact copy;
- what must remain unchanged in a supplied reference.

A role, occupation, gender plus occupation, archetype, or genre alone is not a complete visual brief. Do not turn “engineer”, “doctor”, “female warrior”, “detective”, “anime boy”, “game character”, or similar input directly into a final design. Never infer ethnicity, nationality, religion, or cultural identity from language, name, occupation, geography, genre, or stereotypes. Do not ask about low-impact details that can safely follow explicit intent.

For an underdefined brief, use one compact `AskUser` call with 3–5 single-focus questions. Include a free-input option for a very broad request. Prioritize: (1) identity/age, (2) role/world, (3) style, (4) personality/wardrobe, (5) deliverable. Ask about text or layout only when consequential. Example structure:

```json
{"questions":[
  {"mode":"single","question":"请描述角色身份、年龄、世界观与关键外观","options":[{"type":"input","content":"输入完整角色需求"}]},
  {"mode":"single","question":"希望用哪种视觉风格","options":[{"type":"text","content":"半写实插画"},{"type":"text","content":"动漫漫画风"},{"type":"text","content":"写实影视感"},{"type":"text","content":"风格化 3D"},{"type":"input","content":"自定义风格"}]},
  {"mode":"single","question":"这次要生成哪种角色板","options":[{"type":"text","content":"三视图"},{"type":"text","content":"基础角色板"},{"type":"text","content":"表情动作板"},{"type":"text","content":"完整技术板"},{"type":"input","content":"自定义交付范围"}]}
]}
```

Localize every label and option. Follow up only for unresolved blockers.

## 2. Hard production contract

- Create one character per sheet and one image unless multiple sheets are explicitly requested. For multiple characters, make one sheet per character; never a cast lineup.
- Use a pure white or off-white background. Every panel is a clean cutout reference: no room, street, landscape, wall texture, gradient, stage, atmosphere, environmental storytelling, poster composition, random collage, UI, logo, watermark, or social screenshot.
- Preserve the same face, hairstyle, age impression, build, proportions, costume silhouette, palette, accessories, medium, rendering logic, and realism across panels. Variation requests may change only approved variables.
- Reserve independent full-body cells before secondary modules. Show every required view completely from hair top to footwear bottom, with headroom, lateral clearance, visible shoes/soles, comparable scale, camera, perspective, lighting, and ground line. Never overlap, stack, clip, crop, distort, or shrink required views to force a ratio.
- Choose canvas ratio after inventorying required views and modules. Expand the canvas, remove optional modules, or split into explicitly requested multiple sheets before damaging required content.
- Prioritize identity and production clarity over decoration. Do not make a poster, scene illustration, beauty board, model portfolio, fashion lookbook, lifestyle ad, or product display.

## 3. Input routing and truth hierarchy

Classify the source, then apply the highest available truth:

1. **Character image / turnaround** → identity and style source. Extend it; do not redesign it.
2. **Story / biography** → extract only character name, role/status, emotional baseline, conflict pressure, stage/variants, signature prop, and spoiler constraints. Do not expand plot.
3. **Text brief** → require enough identity, role/world, style, personality/wardrobe, and deliverable anchors to avoid arbitrary invention.
4. **Style reference only** → preserve its medium and rendering system while deriving character identity only from the user's brief.
5. **Vague request** → call `AskUser`.

For a character reference, build an internal style fingerprint: medium, line/edge treatment, palette, shading, texture density, material abstraction, lighting, background treatment, and realism. Apply it to every body view, face, hand, shoe, garment, accessory, prop, and detail. Detail crops may clarify construction but must not become more photorealistic, more 3D, more product-like, or differently lit.

Preserve reference face geometry, hair volume, age, build, costume silhouette, color blocks, signature accessories, emotional baseline, and style. Allow only requested new angles, expressions, poses, close-ups, details, and controlled prop use. Never “beautify” into another person or silently upgrade realism.

## 4. Sheet-type router

Choose the simplest matching type. Explicit constraints such as “只要” override generic “角色板”. If competing types remain equally plausible, ask.

| Type | Use for | Required core |
|---|---|---|
| A Turnaround | 三/四视图, 正侧背, model reference, basic body reference | front, side, back; optional 3/4; neutral pose and same scale |
| B Basic | simple/base character sheet, a little expression | turnaround, standard half-body, 4–6 expressions, optional palette/info |
| C Expression & Pose | expression library, head angles, acting poses, gestures, animation/comic reuse | identity views, expressions, head angles, useful poses, hands |
| D Prop Interaction | weapon, equipment, phone, bag, pet, instrument, signature item | identity views, hand–prop interaction, selected actions, relevant prop detail |
| E Evolution / Variant | stages, transformation, awakening, damage, outfits, identities, before/after | same character across variants; explicit changed vs locked variables |
| F Full Technical | complete/industrial/full board, all modules, 11 modules | master views, profile, palette, silhouette, emotion, heads, posture, details, costume, hands |

Conflict order: explicit turnaround → A; “simple” → A/B; prop interaction → D; stages/outfits → E; explicitly complete → F, or C when the user names only performance modules.

## 5. Layout presets

Follow a user-described layout first if it obeys the hard contract. Otherwise map the chosen type and goal:

| Preset | Structure | Best match |
|---|---|---|
| P01 Face + Turnaround Hero | large face anchor + 3–4 full-body views + limited details | identity-led A/B, premium but technical |
| P02 Turnaround + Expression Matrix | full-body column/row + 2×3 expression heads | B/C |
| P03 Modeling Detail Board | turnaround + head angles + garment/material/prop details | A/D/F, 3D or costume handoff |
| P04 Editorial Profile Card | dominant portrait/full body + curated supporting references | premium profile request only; still no scene |
| P05 Three-Row Production | row 1 views, row 2 expressions/heads, row 3 poses/hands | C |
| P06 Full Technical Board | dense but ordered complete module system | F only |
| P07 Evolution / Variant | aligned stages/forms/outfits with constants visible | E |

Auto defaults: A→P01 or P03; B→P01/P02; C→P02/P05; D→P03; E→P07; F→P06. Prefer landscape for multi-view comparison, portrait only when it improves the chosen hierarchy. Treat ratios as recommendations, never fixed constraints. If crowded, preserve full-body scale and remove optional content.

## 6. Module rules

- **Identity views:** show face, hair, build, costume construction and silhouette, front/side/back logic, shoes, accessories, and color distribution. These outrank every secondary module.
- **Expressions:** use clearly different acting states such as neutral, smile, anger, surprise, fear/pressure, sadness, determination, or suspicion; use the user's list when supplied.
- **Head angles:** front, 3/4, profile, optional high/low/look-back/back-of-head; preserve identity.
- **Poses:** express role and behavior—standing, walking, running, sitting, guarded, confrontation, hesitation, protection, controlled confidence—not empty fashion poses.
- **Hands:** communicate behavior—relaxed, fist, point, refusal, protection, grip, prop hold, face interaction, anxiety.
- **Props:** include only role-relevant or specified props; keep them subordinate, do not repeat everywhere, and avoid advertising/product-photography treatment.
- **Costume/details:** show only recognition and continuity anchors: garment silhouette, accessories, palette blocks, hair/makeup anchors, material behavior, footwear, drift-sensitive parts.
- **Variants:** state count, stages, what changes, and what remains locked. Keep the same base identity unless the user explicitly requests transformation of an anchor.

## 7. Style router

When a reference exists, its style fingerprint overrides generic style keywords.

- **Photoreal human / short drama:** neutral studio character-reference photography, accurate anatomy and wardrobe, consistent actor identity; avoid beauty campaign, fashion editorial, cosplay, plastic skin, or dramatic cinema lighting.
- **Semi-real illustration:** controlled concept-art rendering and readable construction; avoid inconsistent painterly finishes or hero-poster drama.
- **Anime / manga / webtoon / guoman / comic:** consistent line language, cel/flat shading as appropriate, expressive but on-model faces and silhouettes; avoid photoreal actors, cosplay, or unrelated 3D.
- **3D / game:** coherent CGI/PBR pipeline, readable armor/fabric/metal/leather hierarchy, requested equipment; avoid low-poly/toy plastic and material drift.
- **Mascot / IP / chibi / anthropomorphic:** strong shape language, readable silhouette, controlled expressions/application poses, stable brand colors; avoid unnecessary anatomy/detail and random accessories.

Character function must remain legible: who they are, their role, baseline emotion, pressure behavior, continuity anchors, and reuse logic. Turnarounds prioritize modeling clarity; performance boards prioritize acting utility.

## 8. Text and shadow

Default to `no_text` when exact text is absent. Ask only when text materially affects the deliverable.

| Mode | Rule |
|---|---|
| No Text | No titles, letters, numbers, labels, fake type, speech bubbles, blank fields, empty cards, or placeholder slots. Replace text-dependent cells with useful visuals or intentional negative space. |
| Blank Fields | Use only requested, limited zones for later overlay; no readable text; keep the sheet visually complete. |
| Editorial Typography | Use only when selected; premium artbook-like hierarchy, but do not promise exact generated text. |
| Accurate Overlay | Generate a clean base with minimal necessary zones, then add exact copy with a finishing/overlay tool and verify it character by character. |

Default to no shadow. Minimal contact shadow or a very soft neutral studio shadow is allowed only when requested or needed for modeling readability. Never add dramatic/cinematic/background shadow or atmosphere.

## 9. Prompt compiler and execution

Resolve this internal brief before generation:

```text
source and truth hierarchy; identity/style fingerprint; forbidden drift;
sheet type; preset; required views/modules; adaptive canvas;
text mode/exact copy; shadow; expressions/poses/props/variants.
```

Compile the English prompt in this order:

1. One character, selected type and preset.
2. Source identity anchors and forbidden drift.
3. Reference style fingerprint or selected style route.
4. Required views/modules and user-specified actions, props, or stages.
5. Adaptive canvas, independent full-body cells, hair-to-footwear containment, comparable scale/ground line.
6. White/off-white cutout background and selected text/shadow rule.
7. Relevant negatives from the hard contract and QA gate.

Core prompt block:

```text
Create one production reference sheet for one character only. Use a clean structured layout on pure white or off-white. Keep the same face, hair, age, build, proportions, costume silhouette, colors, accessories, medium, shading, and realism across every panel. Inventory required modules, choose an adaptive canvas, reserve independent full-body cells first, and show every required figure completely from hair top to footwear bottom with safe clearance, consistent scale and ground line, and no overlap. Add secondary panels only after the identity views are secure. No scene, environment, poster composition, random collage, UI, logo, or watermark.
```

When a reference exists, add:

```text
Inherit its exact medium, line and edge language, palette, shading, texture density, material abstraction, lighting, and realism across all views and details. Improve clarity without upgrading realism or turning details into product photography.
```

For No Text, add:

```text
No readable or fake text, labels, numbers, logos, speech bubbles, placeholder boxes, blank info fields, empty label slots, or note cards. Use useful visual references or intentional negative space instead.
```

Generate only after the intake gate passes. Use editing when preserving the source pose/state is the goal; use new generation when new angles, poses, modules, or a multi-panel composition are required. Pass supplied character images as identity references. After generation, inspect the actual result; repair only failed zones when feasible, otherwise regenerate with explicit failure constraints. Do not over-explain unless the user asks to review the plan/prompt.

## 10. Acceptance gate

Do not deliver unless every applicable item passes:

- brief was complete; no major visual or sensitive identity decision was silently invented;
- correct single character and requested number of sheets;
- requested type/preset is recognizable and every required module exists;
- every required full-body view is hair-to-footwear complete, independently boxed, readable, non-overlapping, consistently scaled, and aligned;
- face, hair, age, build, proportions, costume, colors, accessories, style, materials, and realism remain on-model;
- reference fingerprint holds across faces, hands, footwear, garments, props, and details;
- background is white/off-white with no environment, poster treatment, collage, atmosphere, UI, logo, or watermark;
- expressions/poses communicate character function rather than beauty/fashion posing;
- props/details support continuity and never become the primary product;
- selected text and shadow policies are followed; exact overlay text is correct;
- no malformed anatomy, merged figures, cropped extremities, fake/garbled text, empty default cards, or optional modules invading identity views.

On failure, identify the failed zones and constraints, then repair or regenerate before delivery. Report a failure only when a valid repair cannot be completed.

## 11. Delivery

Return the finished image(s) plus a concise localized note containing the chosen sheet type, preset, any intentional deviations, and QA status. Provide the full plan or prompts only if requested.
