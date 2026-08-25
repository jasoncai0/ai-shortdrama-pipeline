---
name: cover-design-director
description: "Cross-platform, click-oriented cover and thumbnail production for YouTube, Bilibili, Xiaohongshu, short drama, manju, podcasts, courses, blogs, and short-video surfaces. Use for content packaging, not product selling-point graphics, ads, banners, or channel art. Route YouTube Channel Banner/Art/Header and 2560x1440 channel branding to banner-design-director; route reference-layout migration to reference-driven-generation."
---


## Conversation Language

Before user-visible output, set the language in this order: explicit user request > runtime/app UI locale > dominant language of the latest user message > English. Do not default to Chinese from the Skill source, examples, triggers, title, or conversation history. Keep replies, updates, `AskUser` cards and options, and delivery notes in that language unless bilingual output or fixed copy is requested; generation prompts may remain English.
# Cover Design Director

Create finished, platform-native covers. Optimize for scroll stop, click intent, mobile readability, truthful assets, and one clear visual promise. Keep research and internal classification invisible unless requested.



Before any normal reply, use one compact localized `AskUser` card when information needed to route, preserve truth/identity, lock copy, or generate is missing. Never replace an available card with a text questionnaire. If unavailable, say the required card is unavailable and stop. Ask only unknown fields: subject/title, platform or size, goal, assets/reference, required visible text, quantity, and style boundary.

When only a theme is supplied, propose exact title plus optional support copy and obtain approval before planning or generation, unless the user explicitly authorizes copy decisions or requests no text. Do not expose state labels, research counts, prompt notes, or scorecards.

## Universal Workflow

1. Route platform and load the matching reference before generation.
2. Lock aspect ratio, quantity, approved copy, assets, and source-of-truth constraints.
3. If a reference is supplied, preserve its layout skeleton, weight ratio, typography hierarchy, color distribution, image-text relationship, spacing, and finish; never copy IP, logos, watermarks, exact text, or unique campaign marks.
4. Plan three production-ready directions (platform, ratio, copy, subject, composition, color/type, generation intent), then use a localized five-option `AskUser` card: A, B, C, Decide for me, Generate all. Skip only when the user explicitly requests one exact output or bypasses selection. Generate only the chosen direction; Generate all means three separate covers.
5. Generate, inspect, correct a failed quality gate, deliver, and stop. Do not generate unrequested extras.

For a locked reference or series system, make one faithful direction or up to three micro-variants inside that system, not unrelated style explorations. For batches, map each output to a distinct content job while retaining the shared system.

## Routing And Reference Load Gate

| Signal | Route | Load |
|---|---|---|
| YouTube, ytb, CTR thumbnail, episode, podcast/course thumbnail | YouTube video cover | `references/youtube.md` |
| Bilibili, B站, BV, UP主 | Bilibili | `references/bilibili.md` |
| 小红书, XHS, RED, 图文/笔记封面 | Xiaohongshu | `references/xiaohongshu.md` |
| shortdrama, 短剧, 微短剧, ReelShort, DramaBox, GoodShort | Shortdrama | `references/shortdrama.md`; also `shortdrama-overseas.md` for non-Chinese markets |
| manju, 漫剧, 动态漫, comic drama, motion comic, explicitly anime/comic/CGI | Manju | `references/manju.md` |

Channel Banner/Art/Header wins over a generic YouTube-cover signal and routes to `banner-design-director`. Genre words such as vampire, fantasy, romance, CEO, revenge, cultivation, or magic do not make shortdrama into manju. Reels/Shorts/TikTok and unknown surfaces use this core workflow; ask for placement only if it changes output.

`WebSearch` is only for needed current public discovery; `WebFetch` is only for user-provided or previously returned URLs. Do not search when supplied references, account systems, assets, or clear style instructions already settle direction. Select one dominant grammar and at most one supporting trait; discard generic, dated, unreadable, template-like, or conflicting results.

## Non-Negotiable Locks

- Final visible text may contain only approved user copy, necessary factual labels, or verified source facts. Never show route/style names, prompt terms, fake dates, issue numbers, prices, metrics, coordinates, metadata, or decorative microcopy.
- Do not alter exact title/copy, role mapping, identity, product, place, claim, logo, or supplied reference truth without permission. Text line breaks and styling are allowed; wording is not.
- For recognizable-person references, obtain authorization before generating a likeness. Use actual image references for exact face/outfit replication; otherwise state the limitation rather than claiming fidelity.
- Keep one dominant subject/message and reserve title space. Use high contrast and a central safe zone; do not solve every route with the same loud palette. Bright color is valid when ordered; avoid arbitrary saturation, clutter, fake UI, generic gradients, plastic skin, and unreadable small type.
- Generation prompts must restate ratio, approved visible text only, forbidden extra text, required source assets, composition, and the platform reference's route-specific locks.

## Universal Quality Gate

Before delivery verify: correct route/ratio/quantity; readable title at mobile size; clear first-look hierarchy; subject and title do not compete; edge-safe critical content; supplied identities/products/claims are accurate; no forbidden or wrong-language text; no unrequested logos/watermarks; coherent light, shadows, texture, and typography; no generic AI/plastic finish. Regenerate or refine only when a gate fails or the user requests iteration.

## Extension Rule

For a new recurring platform, add a small reference file containing only route trigger, defaults, visual grammar, copy/asset constraints, and quality checks. Keep shared rules here.
