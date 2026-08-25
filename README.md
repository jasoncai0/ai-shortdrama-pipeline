# duanju-poc

Plugin-based AI short-drama production pipeline. A working reproduction of the
「AI做短剧」 flow — **idea → plan → assets → shots → stills → clips → final cut** —
where every capability is a swappable plugin.

Nothing is hard-wired: the LLM, the image model, the video model, asset storage,
state, billing, export, prompt strategy, and even the pipeline steps themselves
are all plugins selected by one config file.

```bash
pnpm install && pnpm build

# offline, free, ~1s — proves the whole chain works
node dist/cli.js run --config duanju.stub.json --idea "都市悬疑：外卖员目击一场谋杀" --yes
```

---

## Architecture

The kernel depends only on port interfaces. It never imports an adapter.

```
CLI ──► Kernel (pipeline runner · registry · domain model)
             │  depends only on
             ▼
        Ports  ── LLM · Image · Video · AssetStore · State · Ledger · Export · PromptStrategy · Stage
             │  implemented by
             ▼
        Adapters ── deepseek/openai-compat/stub · libtv/stub · localfs · localjson · localledger · ffmpeg · template
```

| Port | Built-in impls | Default |
|---|---|---|
| `llm` | `deepseek`, `openai-compat`, `stub` | deepseek |
| `image` | `libtv`, `stub` | libtv |
| `video` | `libtv`, `stub` | libtv |
| `assetStore` | `localfs` | localfs |
| `state` | `localjson` | localjson |
| `ledger` | `noop`, `localledger` | **noop** |
| `export` | `ffmpeg` | ffmpeg |
| `promptStrategy` | `template`, `skill-anchored` | skill-anchored |
| `middleware` | `retry`, `prompt-tune`, `camera-grammar`, `tuning-log` | all four |
| `stage` | `import`, `import-script`, `plan`, `assets`, `refs`, `sheets`, `shots`, `camera-check`, `prompts`, `images`, `videos`, `cover`, `gate`, `export` | — |

External plugins: `"impl": "npm:my-plugin"` or `"impl": "file:./my-plugin.js"`.
Any module default-exporting a `definePlugin({...})` works.

### Why assets are first-class

A `Shot` stores `characterIds` / `sceneId` / `propIds` — **references, not copied
descriptions**. Prompts are compiled at run time from the referenced entities.

Edit one character's `appearance` and re-run `duanju stage <id> prompts`: every
shot referencing them recompiles. Cross-shot consistency becomes a data problem
instead of a prompt-wording problem. This is the structural difference from
"prompt a video model once per shot".

### Bringing your own screenplay

When a writer has already done the work, skip the LLM entirely. The `import`
stage reads a structured screenplay and **declares `provides: ["plan","assets","shots"]`**,
so the three generative stages it replaces count as satisfied and the rest of
the pipeline runs unchanged:

```jsonc
"pipeline": [
  { "id": "import", "options": { "file": "./examples/demo.screenplay.json", "shotSeconds": 4 } },
  "refs", "prompts", "images", "videos", "export"
]
```

Nothing about the story is invented or reworded. Characters, scenes and props
are referenced **by name** in the file and resolved to ids on import — the same
contract the `shots` stage enforces on LLM output, so a typo is a loud warning
rather than a silently-lost consistency anchor.

`examples/demo.screenplay.json` is a minimal worked example: one episode of
three shots, enough to exercise the whole path. Cap it further with
`"options": { "episodes": 2 }`, but note the cap is only applied when you ask
for it — an import never truncates on its own.

### Two ways in: generate a story, or import one

`plan` + `assets` + `shots` derive structure from a one-line idea using an LLM.
When a screenplay already exists, that derivation is pure loss — swap those
three stages for an importer and no LLM is involved at all:

| Stage | Input | Use when |
|---|---|---|
| `import` | structured JSON screenplay (zod-validated) | you control the upstream format |
| `import-script` | Chinese markdown screenplay (`# 第1集 …(约90秒)` / `【场1·地点·日】` / `角色(动作):"对白"` / `(OS):`) | a writer handed you a script |

`import-script` extracts episodes, scenes, shot-level beats, dialogue and the
cast table (including paired rows like `| 陈宗之 / 陈润儿 |` and 小名/字
aliases). What a screenplay does **not** contain is visual design, so character
appearance, scene look and the style guide are supplied through options — a
production decision, not something to hallucinate.

Two defaults worth knowing:

- **`(OS)` narration lines are skipped.** "一个来自一千六百年后的灵魂被困在灯焰里"
  is exposition, not a picture, and it carries no character to anchor on. Set
  `includeNarration: true` to keep them.
- **`shotSeconds` is fixed (default 5), not `targetSeconds / shotCount`.** Once
  `maxShotsPerEpisode` truncates the beat list, dividing the episode budget
  across the survivors yields 20s+ shots that every video model clamps anyway.

Swapping stages needs a `needs` override, since `refs`/`prompts` declare
dependencies on the LLM path:

```jsonc
"pipeline": [
  { "id": "import-script", "options": { "file": "./script.md", "episodes": [1, 9, 14, 18, 20], "maxShotsPerEpisode": 4 } },
  { "id": "refs",    "needs": ["import-script"] },
  { "id": "prompts", "needs": ["import-script"] },
  "images", "videos", "export"
]
```

A worked example is in [duanju.hanmen.json](duanju.hanmen.json) — a 5-episode
compressed cut of a 20-episode 东晋 period drama, keeping only the script's own
five payoff beats.

### Identity is not the first frame

A still fixes the *composition* of frame zero. It does not carry identity: a
face can drift, be cropped out of frame, or trip moderation, and the model has
no way to tell which pixels are "this character" and which are the set.

So `videos` passes each shot's characters' `@base` as `identityRefs` **alongside**
`firstFrame`, never instead of it. The libtv adapter promotes such a request to
全能参考 (`mixed2video`) rather than dropping one of the two inputs.

Characters carry two images with strictly separated jobs:

| | `refImage` (`@base`) | `sheetImage` (`@sheet`) |
|---|---|---|
| Content | one figure, white cutout, hair-to-footwear | expressions, head angles, poses, hands |
| Produced by | `refs` (always) | `sheets` (opt-in, costs one image per character) |
| Fed to generators | **yes — the only character image that is** | **never** |

A multi-panel sheet used as a generation reference leaks its grid into the
output frame, so nothing downstream reads `sheetImage`. `sheets` also refuses to
run for a character with no confirmed `@base` — generating one from text would
invent a second face for the same person.

### Camera moves are physics, not adjectives

A generative video model reads "slow" and "cinematic" as style, not velocity —
so two shots asking for the same move get two different moves. `prompts/camera/grammar.json`
maps 17 shorthand moves (English and Chinese aliases) to observable phrasing:

```
dolly-in → travels forward at a constant slow walking pace, subject distance
           decreasing steadily, focal length unchanged, floor parallax continuous
```

- **`camera-grammar` middleware** substitutes that phrasing into every video
  request and appends the one-dominant-movement clause. Unrecognised wording is
  passed through untouched with a warning, never overwritten with a guess;
  `strict: true` refuses to spend instead.
- **`camera-check` stage** lints the shot list for free before `images` runs:
  unknown moves, two moves in one shot, runs of identical setups (per episode,
  so a scene change is not mistaken for a flat sequence), and shots with no
  camera plan. `failOn: "problems"` stops the run before anything is paid for.

### Local state is the source of truth

A remote canvas (libtv) is a projection that can be rebuilt. Every provider URL
is ingested into the local asset store the moment it is produced, so the project
survives CDN expiry and provider swaps.

---

## Tuning video/image output

Three independent seams, in increasing order of blast radius:

**1. Prompt templates on disk** — `prompts/image.tmpl`, `prompts/video.tmpl`.
Re-read every run; edit and re-run `duanju stage <id> prompts` (free). See
[prompts/README.md](prompts/README.md) for the placeholder list.

**2. Middleware** — intercepts every image/video request just before it reaches
the provider:

```jsonc
"middleware": [
  { "impl": "retry",       "options": { "attempts": 3, "baseDelayMs": 3000 } },
  { "impl": "prompt-tune", "options": {
      "video": { "suffix": "steady camera, cinematic lighting", "params": { "resolution": "1080p" } },
      "image": { "prefix": "masterpiece", "replace": [["cheap", "budget"]] },
      "negativePrompt": "text, watermark, distorted hands"
  }},
  { "impl": "tuning-log",  "options": { "file": "./.duanju/tuning.ndjson" } }
]
```

`tuning-log` records the exact prompt + params that reached the provider along
with the resulting asset, so two runs can be diffed to see which wording changed
which output. Order matters: place it last to log the final rewritten request,
first to log what the strategy originally produced.

**3. Per-shot overrides** — edit `imagePrompt` / `videoPrompt` / `imageParams` /
`videoParams` in the project state JSON. The `prompts` stage preserves
hand-edited prompts unless run with `overwrite: true`.

To swap the whole strategy, implement `PromptStrategyPort` and point
`ports.promptStrategy.impl` at it.

**4. Prompt profiles** — `prompts/profiles/*.json` carry the identity anchors,
negative lists, and character/location/cover specs, separately from the
templates. Templates change per project; profiles change per model and genre.
`skill-anchored` is `template` plus a profile:

```jsonc
"promptStrategy": {
  "impl": "skill-anchored",
  "options": { "profile": "photoreal-drama" }   // or "manga-drama", or "none"
}
```

The shipped profiles are transcribed from the `pgc-skills-export` short-drama
skills, each citing its source — see [docs/skills-integration.md](docs/skills-integration.md).

---

## Cost control

Billing is a port like any other. **The shipped default is `noop`** — providers
meter their own credits, and a second set of books would only ever disagree
with them.

| | `noop` (default) | `localledger` |
|---|---|---|
| Spend ceiling | none | `budget.maxCredits`, aborts before spending |
| Duplicate-work guard | none | a committed `idempotencyKey` short-circuits |
| Persistence | none | append-only NDJSON |
| Use when | the provider bills you and you trust it | you want a hard cap, or a shared/metered backend |

Switch with one line:

```jsonc
"ledger": { "impl": "localledger", "options": { "root": "./.duanju/ledger" } },
"budget": { "maxCredits": 2000 }
```

Implement `LedgerPort` (`reserve` / `commit` / `refund` / `balance`) to bill
against your own account system.

**What `noop` gives up:** `reserve()` always reports `alreadySettled: false`, so
the ledger-level dedupe is gone. Resume is still cheap — stages skip shots that
already hold a `still`/`clip` — but a shot whose asset vanished from state will
be regenerated and re-billed by the provider.

Cost protection that is **independent of the ledger** and always on:

- **`idempotencyKey = hash(stage, shotId, prompt, params)`** — identifies a unit
  of work; stages skip shots that already have their asset.
- **`reserve → commit / refund`** — a failed generation refunds its hold; one bad
  shot never blocks the other seven.
- **`assertCaps`** — refuses to start a pipeline the chosen adapters cannot serve
  (wrong ratio, no image-to-video mode) *before* anything is spent.
- **`--limit-shots 1`** — smoke-run the real providers for the price of one shot.

## Commands

```bash
duanju init                          # scaffold duanju.config.json
duanju run --idea "<text>" [--yes]   # new project
duanju resume <projectId>            # continue past a gate / retry failures
duanju stage <projectId> <stageId>   # force-rerun one stage
duanju status [projectId]            # progress + per-stage state
duanju plugins                       # what's available per port
```

Useful flags: `--config`, `--ratio 9:16|16:9|1:1`, `--episodes N`, `--shots N`,
`--limit-shots N`, `--log debug`.

### Human-in-the-loop gates

Gates are pipeline elements, not CLI prompts. The run halts, persists, and tells
you how to continue:

```jsonc
"pipeline": [
  "plan",
  { "id": "gate-story",  "use": "gate", "options": { "prompt": "确认故事方向？" } },
  "assets", "refs",
  { "id": "gate-assets", "use": "gate", "options": { "prompt": "确认资产清单？" } },
  "shots", "prompts", "images", "videos", "export"
]
```

`--yes` auto-approves. `use` lets one plugin appear at several pipeline
positions with distinct resume keys.

---

## Using libtv

```bash
libtv project create "my-drama"          # copy the uuid
export LIBTV_PROJECT_UUID=<uuid>
export DEEPSEEK_API_KEY=sk-...
node dist/cli.js run --idea "..." --limit-shots 1 --yes
```

Three libtv facts the adapter encodes (verified against CLI 1.1.3):

1. `libtv node ... --run` **blocks** until terminal state and polls internally —
   never wrap it in another poll loop or a timeout.
2. `-s model=` takes the model **display name** (`"Seedance 2.0 Mini"`), not the
   modelKey.
3. `--run` emits **two** JSON documents on stdout, pretty-printed across multiple
   lines when stdout is not a TTY. The parser scans for balanced values and takes
   the last.

libtv has no batch storyboard→video command (only storyboard→images), so the
adapter creates one canvas `video` node per shot wired to that shot's still.

Duplicate node names are recovered automatically: a retried generation deletes
the stale node before recreating it.

---

## Testing

```bash
pnpm test        # 25 tests, no network, no credits
pnpm typecheck
```

`tests/e2e-stub.test.ts` runs the entire pipeline on stub adapters and asserts a
real playable mp4 comes out. The stub video adapter synthesises actual clips with
ffmpeg, so `export` exercises genuine concat behaviour rather than a mock.

**The stubs are not a convenience** — without them the orchestration logic is
untestable and every change costs money to verify.

---

## Requirements

- Node ≥ 20, pnpm
- ffmpeg (export stage + stub video adapter)
- For real generation: `libtv` CLI logged in, and an LLM API key

## Known gaps

- No dubbing / subtitles / BGM — the pipeline stops at silent clip concat.
- No web workbench; CLI plus JSON state only.
- Only `shortdrama` is tuned; comic/ad kinds share the same prompts.
- The `libtv` adapter is the only real provider implemented. Native
  Seedance/Volcengine adapters are the obvious next ones — they only need to
  satisfy `ImagePort` / `VideoPort`.
