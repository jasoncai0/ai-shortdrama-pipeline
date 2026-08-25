# Screenplays are not committed

`import-script` configs point at `./scripts/screenplay.md`. That file is **not**
in the repository: a screenplay is someone's copyrighted work, and adaptations
of published novels doubly so.

Drop your own markdown screenplay here, or point the stage's `file` option
somewhere else:

```jsonc
{ "id": "import-script", "options": { "file": "./scripts/screenplay.md" } }
```

Expected format (see `src/lib/script-parser.ts` for the full grammar):

```markdown
# 第1集 标题(约90秒)
【场1·地点·日】
角色(动作):"对白"
(OS):旁白
```

`examples/demo.screenplay.json` is a self-contained placeholder in the structured
`import` format, and needs no external file.
