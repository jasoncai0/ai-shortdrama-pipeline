import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { z } from 'zod'
import { configError, stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'
import type { Character, Episode, Prop, Scene, Shot } from '../../kernel/types.js'

/**
 * Stage 0-alt — ingest an EXISTING screenplay instead of generating one.
 *
 * Replaces `plan` + `assets` + `shots` in the pipeline. Use it when a writer
 * has already done the work: no LLM is involved, so nothing about the story is
 * invented, reworded, or lost in translation.
 *
 * Entities are referenced BY NAME in the file and resolved to ids here — the
 * same contract the `shots` stage enforces on LLM output, so an unknown name is
 * a loud warning rather than a silently-dropped consistency anchor.
 */

/**
 * Strict on purpose. `characters` was written as `characterNames` in a
 * screenplay once and zod's `.default([])` filled the real field with an empty
 * array — so every shot imported with no cast, the run looked clean, and the
 * identity references silently stopped being attached. Unknown names already
 * warned; unknown *keys* said nothing. Now they fail.
 */
const screenplaySchema = z.object({
  title: z.string().min(1),
  genre: z.string().min(1),
  logline: z.string().min(1),
  mainPlot: z.string().min(1),
  sellingPoints: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
  /** Visual keywords prepended to every image prompt. English works best. */
  styleGuide: z.string().min(1),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        appearance: z.string().min(1),
        personality: z.string().optional(),
        /** One-line identity for the intro card. */
        epithet: z.string().optional(),
        billing: z.enum(['lead', 'supporting', 'extra']).optional(),
        /** Outfits the writer already specified; the wardrobe stage uses these verbatim. */
        wardrobe: z
          .array(
            z
              .object({
                label: z.string().min(1),
                description: z.string().min(1),
                occasion: z.string().optional(),
              })
              .strict(),
          )
          .optional(),
      }).strict(),
    )
    .min(1),
  scenes: z
    .array(z.object({ name: z.string().min(1), visualDescription: z.string().min(1) }).strict())
    .min(1),
  props: z.array(z.object({ name: z.string().min(1), description: z.string().min(1) }).strict()).default([]),
  episodes: z
    .array(
      z.object({
        title: z.string().min(1),
        synopsis: z.string().min(1),
        shots: z
          .array(
            z.object({
              plotDescription: z.string().min(1),
              durationSeconds: z.number().min(1).max(30).optional(),
              shotSize: z.string().optional(),
              cameraMove: z.string().optional(),
              characterAction: z.string().optional(),
              emotion: z.string().optional(),
              lightingAndAtmosphere: z.string().optional(),
              audioEffects: z.string().optional(),
              dialogue: z.string().optional(),
              characters: z.array(z.string()).default([]),
              scene: z.string().optional(),
              props: z.array(z.string()).default([]),
              /** Wardrobe look label worn in this shot. */
              wardrobe: z.string().optional(),
            }).strict(),
          )
          .min(1),
      }).strict(),
    )
    .min(1),
}).strict()

export type Screenplay = z.infer<typeof screenplaySchema>

export default definePlugin<StagePort>({
  port: 'stage',
  name: 'import',
  create: (options, deps) => ({
    name: 'import',
    id: 'import',
    needs: [],
    // Stands in for the three LLM stages it replaces.
    provides: ['plan', 'assets', 'shots'],

    run: async (ctx) => {
      const raw = ctx.options['file'] ?? options['file']
      if (typeof raw !== 'string' || raw.length === 0) {
        throw configError(
          'The "import" stage needs options.file pointing at a screenplay JSON.',
          'Example: { "id": "import", "options": { "file": "./examples/my-show.screenplay.json" } }',
        )
      }
      const path = isAbsolute(raw) ? raw : resolve(deps.cwd, raw)

      let text: string
      try {
        text = await readFile(path, 'utf8')
      } catch (error) {
        throw stateError(`Cannot read screenplay at ${path}: ${String(error)}`)
      }

      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(text)
      } catch (error) {
        throw stateError(`Screenplay at ${path} is not valid JSON: ${String(error)}`)
      }

      const parsed = screenplaySchema.safeParse(parsedJson)
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 10)
          .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n')
        throw stateError(`Screenplay at ${path} failed validation:\n${issues}`)
      }

      const script = parsed.data
      const defaultSeconds = numberOption(ctx.options['shotSeconds'], 4)
      const maxEpisodes = numberOption(ctx.options['episodes'], script.episodes.length)

      const characters: readonly Character[] = script.characters.map((c, i) => ({
        id: `ch${i + 1}`,
        name: c.name,
        appearance: c.appearance,
        personality: c.personality,
        epithet: c.epithet,
        billing: c.billing,
        wardrobe: c.wardrobe?.map((w, wi) => ({ id: `w${wi + 1}`, ...w })),
      }))
      const scenes: readonly Scene[] = script.scenes.map((s, i) => ({
        id: `sc${i + 1}`,
        name: s.name,
        visualDescription: s.visualDescription,
      }))
      const props: readonly Prop[] = script.props.map((p, i) => ({
        id: `pr${i + 1}`,
        name: p.name,
        description: p.description,
      }))

      const characterByName = new Map(characters.map((c) => [c.name, c.id]))
      const sceneByName = new Map(scenes.map((s) => [s.name, s.id]))
      const propByName = new Map(props.map((p) => [p.name, p.id]))

      const chosen = script.episodes.slice(0, maxEpisodes)
      const episodes: readonly Episode[] = chosen.map((e, i) => ({
        id: `ep${i + 1}`,
        index: i + 1,
        title: e.title,
        synopsis: e.synopsis,
      }))

      const shots: Shot[] = []
      for (const [epIndex, episode] of chosen.entries()) {
        const episodeId = `ep${epIndex + 1}`
        episode.shots.forEach((raw, shotIndex) => {
          const characterIds = raw.characters
            .map((n) => characterByName.get(n))
            .filter((id): id is string => Boolean(id))
          // A shot's wardrobe is written as a label; resolve it against the
          // looks its characters actually have, and complain when it matches
          // none — a typo here silently reverts the shot to default costume.
          let wardrobeId: string | undefined
          if (raw.wardrobe) {
            const owner = characters.find(
              (c) =>
                characterIds.includes(c.id) && c.wardrobe?.some((w) => w.label === raw.wardrobe),
            )
            wardrobeId = owner?.wardrobe?.find((w) => w.label === raw.wardrobe)?.id
            if (!wardrobeId) {
              deps.log.warn(
                `import: ${episodeId} shot ${shotIndex + 1} names wardrobe "${raw.wardrobe}", which none of its characters has`,
              )
            }
          }

          const unknownCharacters = raw.characters.filter((n) => !characterByName.has(n))
          if (unknownCharacters.length > 0) {
            deps.log.warn(
              `import: ${episodeId} shot ${shotIndex + 1} references unknown characters: ${unknownCharacters.join(', ')}`,
            )
          }
          if (raw.scene && !sceneByName.has(raw.scene)) {
            deps.log.warn(
              `import: ${episodeId} shot ${shotIndex + 1} references unknown scene "${raw.scene}"`,
            )
          }

          shots.push({
            id: `${episodeId}-s${String(shotIndex + 1).padStart(2, '0')}`,
            episodeId,
            order: shotIndex + 1,
            durationSeconds: raw.durationSeconds ?? defaultSeconds,
            plotDescription: raw.plotDescription,
            shotSize: raw.shotSize,
            cameraMove: raw.cameraMove,
            characterAction: raw.characterAction,
            emotion: raw.emotion,
            lightingAndAtmosphere: raw.lightingAndAtmosphere,
            audioEffects: raw.audioEffects,
            dialogue: raw.dialogue,
            characterIds,
            wardrobeId,
            sceneId: raw.scene ? sceneByName.get(raw.scene) : undefined,
            propIds: raw.props
              .map((n) => propByName.get(n))
              .filter((id): id is string => Boolean(id)),
            status: 'draft',
          })
        })
      }

      deps.log.info(
        `import: "${script.title}" — ${episodes.length} episodes, ${shots.length} shots, ${characters.length} characters, ${scenes.length} scenes`,
      )
      ctx.emit('import', { episodes: episodes.length, shots: shots.length })

      return {
        kind: 'ok',
        project: {
          ...ctx.project,
          title: script.title,
          plan: {
            title: script.title,
            genre: script.genre,
            logline: script.logline,
            mainPlot: script.mainPlot,
            sellingPoints: script.sellingPoints,
            conflicts: script.conflicts,
            styleGuide: script.styleGuide,
          },
          episodes,
          characters,
          scenes,
          props,
          shots,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
