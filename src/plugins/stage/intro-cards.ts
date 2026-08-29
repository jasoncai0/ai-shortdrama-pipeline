import { stateError } from '../../kernel/errors.js'
import { withHeartbeat } from './shared.js'
import { definePlugin } from '../../kernel/registry.js'
import { renderedClip } from '../../kernel/types.js'
import { DEFAULT_PLAN, orderedShots, planIntroCards } from '../../lib/introcards.js'
import { maybeLoadProfile } from '../../lib/profile.js'
import type { CardOverlay, StagePort, TextCardSpec } from '../../kernel/ports.js'
import type { AssetRef, Character } from '../../kernel/types.js'

/**
 * Introduces each character with a vertical name card the first time they
 * appear.
 *
 * Three things decide the shape of this stage:
 *
 *  - **The name has to be right.** So it is typeset, not generated. An image
 *    model produces something that resembles 「陈宗之」; a font produces
 *    「陈宗之」. The `textCard` port does the rendering and `post.overlayCards`
 *    composites — no diffusion model touches the text.
 *  - **First appearance is a property of the cut**, so timing comes from the
 *    same measured clip durations the subtitles use. A card placed by requested
 *    duration drifts off its shot exactly as captions do.
 *  - **It has to look like it belongs.** Colours and font come from the prompt
 *    profile, the same file the image prompts draw their palette from, so the
 *    card is styled by the production rather than decorated independently.
 *
 * Runs after the score and before subtitles: it composites onto the picture,
 * and doing it after the captions were burned in would risk covering them.
 *
 * Options:
 *   side / holdSeconds / delaySeconds / minReadableSeconds / maxConcurrent
 *   skip          character names to leave uncarded
 *   marginPx / fadeSeconds / widthRatio
 *   fontPath      overrides the profile's font
 *   profile       prompt profile supplying the palette, default photoreal-drama
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'intro-cards',
  create: () => ({
    name: 'intro-cards',
    id: 'intro-cards',
    needs: ['export'],

    run: async (ctx) => {
      const { project, ports, log } = ctx

      if (!ports.post.overlayCards) {
        throw stateError(
          `post adapter "${ports.post.name}" cannot composite overlays.`,
          'Use post/ffmpeg, or drop the "intro-cards" stage.',
        )
      }
      const overlayCards = ports.post.overlayCards.bind(ports.post)

      const source = project.scoredCut ?? project.finalCut
      if (!source) {
        throw stateError('intro-cards requires a finished cut.', 'Run "export" first.')
      }

      const profile = await maybeLoadProfile(
        process.cwd(),
        typeof ctx.options['profileDir'] === 'string'
          ? ctx.options['profileDir']
          : './prompts/profiles',
        ctx.options['profile'] ?? 'photoreal-drama',
      )
      const style = profile?.introCard

      const fontPath = stringOption(ctx.options['fontPath'], style?.fontPath ?? '')
      if (!fontPath) {
        throw stateError(
          'No font for the intro cards.',
          'Set introCard.fontPath in the prompt profile, or fontPath on this stage. It must be a file containing the glyphs — on macOS, "/System/Library/Fonts/STHeiti Medium.ttc".',
        )
      }

      const shots = orderedShots(project)
      if (shots.length === 0) {
        log.info('intro-cards: no clips to place cards on')
        return { kind: 'ok', project }
      }

      // Measured, not requested — the same rule the subtitles follow.
      const durations: number[] = []
      for (const shot of shots) {
        durations.push(await ports.post.probeDuration(renderedClip(shot) as AssetRef, ports.assetStore))
      }

      const skipNames = new Set(
        Array.isArray(ctx.options['skip'])
          ? (ctx.options['skip'] as unknown[]).filter((s): s is string => typeof s === 'string')
          : [],
      )
      const plan = planIntroCards({
        project,
        durations,
        options: {
          ...DEFAULT_PLAN,
          holdSeconds: numberOption(ctx.options['holdSeconds'], DEFAULT_PLAN.holdSeconds),
          delaySeconds: numberOption(ctx.options['delaySeconds'], DEFAULT_PLAN.delaySeconds),
          minReadableSeconds: numberOption(
            ctx.options['minReadableSeconds'],
            DEFAULT_PLAN.minReadableSeconds,
          ),
          maxConcurrent: numberOption(ctx.options['maxConcurrent'], DEFAULT_PLAN.maxConcurrent),
          side: sideOption(ctx.options['side']),
          skip: project.characters.filter((c) => skipNames.has(c.name)).map((c) => c.id),
        },
      })

      for (const note of plan.notes) log.warn(`intro-cards: ${note}`)

      if (plan.placements.length === 0) {
        log.info('intro-cards: nobody to introduce')
        return { kind: 'ok', project }
      }
      log.info(
        `intro-cards: ${plan.placements.length} card(s) — ${plan.placements.map((p) => p.name).join(', ')}`,
      )

      const heightPx = ratioHeight(project.ratio)
      const widthPx = Math.round(
        ratioWidth(project.ratio) * numberOption(ctx.options['widthRatio'], style?.widthRatio ?? 0.2),
      )
      const titleSizePx = Math.round(widthPx * 0.32)

      const rendered = new Map<string, AssetRef>()
      const overlays: CardOverlay[] = []

      for (const placement of plan.placements) {
        const existing = project.characters.find((c) => c.id === placement.characterId)?.introCard
        const spec: TextCardSpec = {
          title: placement.name,
          subtitle: placement.epithet,
          widthPx,
          heightPx,
          titleSizePx,
          subtitleSizePx: Math.round(titleSizePx * 0.4),
          fontPath,
          titleColour: stringOption(ctx.options['titleColour'], style?.titleColour ?? '#F5F0E6'),
          subtitleColour: stringOption(
            ctx.options['subtitleColour'],
            style?.subtitleColour ?? '#D6B26A',
          ),
          accentColour: stringOption(ctx.options['accentColour'], style?.accentColour ?? '#D6B26A'),
          panelColour: stringOption(ctx.options['panelColour'], style?.panelColour ?? '#0C0E12'),
          panelOpacity: numberOption(ctx.options['panelOpacity'], style?.panelOpacity ?? 0.55),
          side: placement.side,
        }

        // Re-rendering is cheap but not free, and the card is deterministic.
        const image =
          existing ?? (await ports.textCard.render(spec, ports.assetStore, project.id, placement.characterId))
        rendered.set(placement.characterId, image)

        overlays.push({
          image,
          startSeconds: placement.startSeconds,
          endSeconds: placement.endSeconds,
          side: placement.side,
          marginPx: numberOption(ctx.options['marginPx'], 40),
          fadeSeconds: numberOption(ctx.options['fadeSeconds'], 0.35),
        })
      }

      const introCut = await withHeartbeat(
        ctx,
        `compositing ${overlays.length} intro card(s)`,
        overlayCards(source, overlays, ports.assetStore, project.id),
      )
      const path = await ports.assetStore.localPath(introCut).catch(() => introCut.uri)
      log.info(`intro-cards: ${path}`)
      ctx.emit('intro-cards', {
        cards: plan.placements.map((p) => ({ name: p.name, at: p.startSeconds, side: p.side })),
      })

      return {
        kind: 'ok',
        project: {
          ...project,
          characters: project.characters.map((c): Character =>
            rendered.has(c.id) ? { ...c, introCard: rendered.get(c.id) } : c,
          ),
          introCut,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const ratioWidth = (ratio: string): number =>
  ratio === '16:9' ? 1920 : ratio === '1:1' ? 1080 : 1080

const ratioHeight = (ratio: string): number =>
  ratio === '16:9' ? 1080 : ratio === '1:1' ? 1080 : 1920

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const stringOption = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback

const sideOption = (value: unknown): 'left' | 'right' | 'alternate' =>
  value === 'left' || value === 'right' ? value : 'alternate'
