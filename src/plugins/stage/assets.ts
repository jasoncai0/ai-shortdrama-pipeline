import { z } from 'zod'
import { stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'
import type { Character, Episode, Prop, Scene } from '../../kernel/types.js'

/**
 * Stage 2 — extract first-class assets from the plan.
 *
 * This is the structural difference from "prompt a video model per shot":
 * characters / scenes / props become entities with stable ids, so later shots
 * reference them instead of re-describing them. Consistency becomes a data
 * problem rather than a prompt-wording problem.
 */

const assetsSchema = z.object({
  episodes: z
    .array(
      z.object({
        title: z.string().min(1),
        synopsis: z.string().min(1),
      }),
    )
    .min(1),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        appearance: z
          .string()
          .min(1)
          .describe('English visual description: face, hair, wardrobe, age, build'),
        personality: z.string().optional(),
        billing: z
          .enum(['lead', 'supporting', 'extra'])
          .optional()
          .describe('主角 lead / 配角 supporting / 龙套 extra；只有 lead 会做多套服装'),
        epithet: z
          .string()
          .optional()
          .describe('六字以内的中文身份标签，用于首次出场的字幕条，如「外卖员 · 目击者」'),
      }),
    )
    .min(1),
  scenes: z
    .array(
      z.object({
        name: z.string().min(1),
        visualDescription: z.string().min(1).describe('English visual description of the location'),
      }),
    )
    .min(1),
  props: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .default([]),
})

const SYSTEM = `你是短剧制片的资产统筹。输出严格 JSON，无解释、无代码围栏。
appearance 与 visualDescription 必须是英文视觉描述词组，它们会被逐字拼进图像模型提示词，
所以要具体（发型、服装、年龄、体型、材质、光线），不要写剧情或情绪。`

export default definePlugin<StagePort>({
  port: 'stage',
  name: 'assets',
  create: () => ({
    name: 'assets',
    id: 'assets',
    needs: ['plan'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const plan = project.plan
      if (!plan) {
        throw stateError('assets stage requires a plan.', 'Run the "plan" stage first.')
      }

      const episodeCount = numberOption(ctx.options['episodes'], 1)

      const result = await ports.llm.complete({
        purpose: "assets",
        system: SYSTEM,
        schema: assetsSchema,
        messages: [
          {
            role: 'user',
            content: [
              `剧名：${plan.title}`,
              `题材：${plan.genre}`,
              `主线：${plan.mainPlot}`,
              `冲突：${plan.conflicts.join('；')}`,
              `视觉风格：${plan.styleGuide}`,
              '',
              `拆解为 ${episodeCount} 集，并列出全部人物、场景、道具。`,
              'JSON 字段：episodes[{title,synopsis}], characters[{name,appearance,personality,epithet,billing}], scenes[{name,visualDescription}], props[{name,description}]',
            ].join('\n'),
          },
        ],
      })

      const episodes: readonly Episode[] = result.data.episodes
        .slice(0, episodeCount)
        .map((e, index) => ({
          id: `ep${index + 1}`,
          index: index + 1,
          title: e.title,
          synopsis: e.synopsis,
        }))

      const characters: readonly Character[] = result.data.characters.map((c, index) => ({
        id: `ch${index + 1}`,
        name: c.name,
        appearance: c.appearance,
        personality: c.personality,
        epithet: c.epithet,
        billing: c.billing,
      }))

      const scenes: readonly Scene[] = result.data.scenes.map((s, index) => ({
        id: `sc${index + 1}`,
        name: s.name,
        visualDescription: s.visualDescription,
      }))

      const props: readonly Prop[] = (result.data.props ?? []).map((p, index) => ({
        id: `pr${index + 1}`,
        name: p.name,
        description: p.description,
      }))

      log.info(
        `assets: ${episodes.length} episodes, ${characters.length} characters, ${scenes.length} scenes, ${props.length} props`,
      )
      ctx.emit('assets', { characters, scenes, props })

      return {
        kind: 'ok',
        project: {
          ...project,
          episodes,
          characters,
          scenes,
          props,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
