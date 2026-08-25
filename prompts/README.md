# Prompt templates

Edit these files and re-run `duanju stage <projectId> prompts` — no rebuild, no
code change. This is tuning seam #1.

Templates are read fresh on every run. If a file is missing, the built-in
default in `src/plugins/promptStrategy/template.ts` is used.

## Available placeholders

| Placeholder | Source |
|---|---|
| `{{styleGuide}}` | `project.plan.styleGuide` — the house look, prepended to every image |
| `{{genre}}` `{{title}}` | `project.plan` |
| `{{sceneName}}` `{{sceneDescription}}` | the Scene entity the shot references |
| `{{characterNames}}` `{{characterAppearances}}` | the Character entities the shot references |
| `{{props}}` | descriptions of the Prop entities the shot references |
| `{{plotDescription}}` `{{shotSize}}` `{{cameraMove}}` | the shot itself |
| `{{characterAction}}` `{{emotion}}` | the shot itself |
| `{{lightingAndAtmosphere}}` `{{audioEffects}}` `{{dialogue}}` | the shot itself |
| `{{duration}}` | shot length in seconds |

Empty placeholders and the commas around them are removed, so an unset field
never leaves `, , ` in the prompt.

## The other two tuning seams

- **Middleware** (`duanju.config.json` → `middleware`): `prompt-tune` appends a
  house style or overrides params on EVERY request; `tuning-log` records the
  exact request that reached the provider so two runs can be diffed.
- **Per-shot overrides**: edit `imagePrompt` / `videoPrompt` / `imageParams` /
  `videoParams` directly in the project state JSON. The `prompts` stage will not
  overwrite hand-edited prompts unless run with `overwrite: true`.
