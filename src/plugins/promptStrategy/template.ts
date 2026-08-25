import { readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { definePlugin } from '../../kernel/registry.js'
import { findCharacter, findProp, findScene } from '../../kernel/types.js'
import type { CompiledPrompt, PromptStrategyPort } from '../../kernel/ports.js'
import type { Project, Shot } from '../../kernel/types.js'

/**
 * TUNING SEAM #1 — the default prompt strategy.
 *
 * Templates live on disk (`prompts/image.tmpl`, `prompts/video.tmpl`) and are
 * re-read on every run, so tuning prompt wording is an edit-and-rerun loop with
 * no rebuild. Missing files fall back to the built-in defaults below.
 *
 * Placeholders are resolved from the shot AND the entities it references — this
 * is why assets are first-class: change a character's appearance once and every
 * shot referencing them recompiles.
 */

const DEFAULT_IMAGE_TEMPLATE = [
  '{{styleGuide}}',
  '{{sceneDescription}}',
  '{{characterAppearances}}',
  '{{plotDescription}}',
  '{{shotSize}}',
  '{{characterAction}}',
  '{{emotion}}',
  '{{lightingAndAtmosphere}}',
  '{{props}}',
].join(', ')

const DEFAULT_VIDEO_TEMPLATE = [
  '{{plotDescription}}',
  '{{characterAction}}',
  '{{cameraMove}}',
  '{{lightingAndAtmosphere}}',
].join(', ')

const DEFAULT_NEGATIVE =
  'text, watermark, logo, distorted hands, extra fingers, blurry, low quality, duplicate face'

export default definePlugin<PromptStrategyPort>({
  port: 'promptStrategy',
  name: 'template',
  create: (options, deps) => {
    const rawDir = typeof options['dir'] === 'string' ? options['dir'] : './prompts'
    const dir = isAbsolute(rawDir) ? rawDir : resolve(deps.cwd, rawDir)
    const negative =
      typeof options['negativePrompt'] === 'string' ? options['negativePrompt'] : DEFAULT_NEGATIVE
    const imageParams = asRecord(options['imageParams'])
    const videoParams = asRecord(options['videoParams'])

    return {
      name: 'template',
      compile: async (shot: Shot, project: Project): Promise<CompiledPrompt> => {
        const [imageTmpl, videoTmpl] = await Promise.all([
          loadTemplate(join(dir, 'image.tmpl'), DEFAULT_IMAGE_TEMPLATE, deps.log),
          loadTemplate(join(dir, 'video.tmpl'), DEFAULT_VIDEO_TEMPLATE, deps.log),
        ])

        const vars = buildVars(shot, project)
        return {
          imagePrompt: render(imageTmpl, vars),
          videoPrompt: render(videoTmpl, vars),
          negativePrompt: negative,
          imageParams,
          videoParams,
        }
      },
    }
  },
})

/** Exported for unit tests — prompt compilation is pure and must stay so. */
export const buildVars = (shot: Shot, project: Project): Record<string, string> => {
  const characters = shot.characterIds
    .map((id) => findCharacter(project, id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  const scene = shot.sceneId ? findScene(project, shot.sceneId) : undefined
  const props = shot.propIds
    .map((id) => findProp(project, id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return {
    styleGuide: project.plan?.styleGuide ?? '',
    genre: project.plan?.genre ?? '',
    title: project.plan?.title ?? project.title,
    sceneName: scene?.name ?? '',
    sceneDescription: scene?.visualDescription ?? '',
    characterNames: characters.map((c) => c.name).join(', '),
    characterAppearances: characters.map((c) => `${c.name}: ${c.appearance}`).join('; '),
    props: props.map((p) => p.description).join(', '),
    plotDescription: shot.plotDescription,
    shotSize: shot.shotSize ?? '',
    cameraMove: shot.cameraMove ?? '',
    characterAction: shot.characterAction ?? '',
    emotion: shot.emotion ?? '',
    lightingAndAtmosphere: shot.lightingAndAtmosphere ?? '',
    audioEffects: shot.audioEffects ?? '',
    dialogue: shot.dialogue ?? '',
    duration: String(shot.durationSeconds),
  }
}

/**
 * Renders `{{var}}` and drops empty segments so an unset field never leaves a
 * dangling ", , " in the prompt — models react badly to that.
 */
export const render = (template: string, vars: Readonly<Record<string, string>>): string =>
  template
    .replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(', ')

/**
 * Shared by every prompt strategy: read a template file, fall back to the
 * built-in default when the project has not written one.
 */
export const loadTemplateFile = async (
  path: string,
  log: { debug(msg: string): void },
  kind: 'image' | 'video' = 'image',
): Promise<string> => {
  const fallback = kind === 'video' ? DEFAULT_VIDEO_TEMPLATE : DEFAULT_IMAGE_TEMPLATE
  try {
    return (await readFile(path, 'utf8')).trim()
  } catch {
    log.debug(`prompt template not found, using default: ${path}`)
    return fallback
  }
}

const loadTemplate = async (
  path: string,
  fallback: string,
  log: { debug(msg: string): void },
): Promise<string> => {
  try {
    return (await readFile(path, 'utf8')).trim()
  } catch {
    log.debug(`prompt template not found, using default: ${path}`)
    return fallback
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
