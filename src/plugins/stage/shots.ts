import { z } from 'zod'
import { stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'
import type { Shot } from '../../kernel/types.js'

/**
 * Stage 4 — break each episode into shots.
 *
 * The LLM is told to reference characters/scenes/props BY NAME; we resolve
 * those names to ids here. Unresolvable names are dropped with a warning
 * rather than silently becoming free-text — a shot referencing a character
 * that does not exist would lose its consistency anchor.
 */

const shotsSchema = z.object({
  shots: z
    .array(
      z.object({
        plotDescription: z.string().min(1),
        durationSeconds: z.number().min(1).max(30),
        shotSize: z.string().optional(),
        cameraMove: z.string().optional(),
        characterAction: z.string().optional(),
        emotion: z.string().optional(),
        lightingAndAtmosphere: z.string().optional(),
        audioEffects: z.string().optional(),
        dialogue: z.string().optional(),
        narration: z.string().optional(),
        characterNames: z.array(z.string()).default([]),
        sceneName: z.string().optional(),
        propNames: z.array(z.string()).default([]),
      }),
    )
    .min(1),
})

const SYSTEM = `你是分镜师。输出严格 JSON，无解释、无代码围栏。
characterNames / sceneName / propNames 必须**逐字**使用给定清单里的名字，不要发明新名字、不要改写。
shotSize 用景别术语（extreme close-up / close-up / medium shot / wide shot / establishing shot）。
cameraMove 用运镜术语（static / slow dolly-in / pan left / handheld follow / crane up）。

声音纪律（硬性约束）：
- 叙事优先走 dialogue（角色台词）和画面动作；有台词的镜头，characterNames 第一个必须是说话人。
- narration（旁白）只在转场、时间跳跃、地点切换时用，一两句即可；全片旁白镜头不得超过约 30%，绝不能每镜都有旁白。
- 不要连续超过 2 个镜头使用旁白；旁白和台词不要复述同一信息。`

export default definePlugin<StagePort>({
  port: 'stage',
  name: 'shots',
  create: () => ({
    name: 'shots',
    id: 'shots',
    needs: ['assets'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const plan = project.plan
      if (!plan) throw stateError('shots stage requires a plan.')
      if (project.episodes.length === 0) {
        throw stateError('shots stage requires episodes.', 'Run the "assets" stage first.')
      }

      const perEpisode = numberOption(ctx.options['shotsPerEpisode'], 8)
      const defaultSeconds = numberOption(ctx.options['shotSeconds'], 5)

      const characterByName = new Map(project.characters.map((c) => [c.name, c.id]))
      const sceneByName = new Map(project.scenes.map((s) => [s.name, s.id]))
      const propByName = new Map(project.props.map((p) => [p.name, p.id]))

      const collected: Shot[] = []

      for (const episode of project.episodes) {
        const existing = project.shots.filter((s) => s.episodeId === episode.id)
        if (existing.length > 0) {
          collected.push(...existing)
          log.debug(`shots: episode ${episode.index} already broken down, keeping ${existing.length}`)
          continue
        }

        const result = await ports.llm.complete({
        purpose: "shots",
          system: SYSTEM,
          schema: shotsSchema,
          messages: [
            {
              role: 'user',
              content: [
                `剧名：${plan.title}｜题材：${plan.genre}｜视觉风格：${plan.styleGuide}`,
                `本集（第 ${episode.index} 集《${episode.title}》）剧情：${episode.synopsis}`,
                '',
                `人物清单：${project.characters.map((c) => c.name).join('、') || '（无）'}`,
                `场景清单：${project.scenes.map((s) => s.name).join('、') || '（无）'}`,
                `道具清单：${project.props.map((p) => p.name).join('、') || '（无）'}`,
                '',
                `拆成 ${perEpisode} 个镜头，每镜 ${defaultSeconds} 秒左右。`,
              ].join('\n'),
            },
          ],
        })

        const shots = result.data.shots.slice(0, perEpisode).map((raw, index): Shot => {
          const characterNames = raw.characterNames ?? []
          const propNames = raw.propNames ?? []
          const characterIds = characterNames
            .map((name) => characterByName.get(name))
            .filter((id): id is string => Boolean(id))
          if (characterIds.length < characterNames.length) {
            const unknown = characterNames.filter((n) => !characterByName.has(n))
            log.warn(`shots: episode ${episode.index} shot ${index + 1} references unknown characters: ${unknown.join(', ')}`)
          }

          return {
            id: `${episode.id}-s${String(index + 1).padStart(2, '0')}`,
            episodeId: episode.id,
            order: index + 1,
            durationSeconds: raw.durationSeconds || defaultSeconds,
            plotDescription: raw.plotDescription,
            shotSize: raw.shotSize,
            cameraMove: raw.cameraMove,
            characterAction: raw.characterAction,
            emotion: raw.emotion,
            lightingAndAtmosphere: raw.lightingAndAtmosphere,
            audioEffects: raw.audioEffects,
            dialogue: raw.dialogue,
            narration: raw.narration,
            characterIds,
            sceneId: raw.sceneName ? sceneByName.get(raw.sceneName) : undefined,
            propIds: propNames
              .map((name) => propByName.get(name))
              .filter((id): id is string => Boolean(id)),
            status: 'draft',
          }
        })

        log.info(`shots: episode ${episode.index} → ${shots.length} shots`)
        collected.push(...shots)
      }

      ctx.emit('shots', { count: collected.length })

      return {
        kind: 'ok',
        project: { ...project, shots: collected, updatedAt: new Date().toISOString() },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
