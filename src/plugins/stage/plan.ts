import { z } from 'zod'
import { definePlugin } from '../../kernel/registry.js'
import type { StagePort } from '../../kernel/ports.js'

/**
 * Stage 1 — turn a one-line idea (or an uploaded script) into a structured
 * project plan. This is the "一句话，一部剧" moment; everything downstream
 * derives from it.
 */

const planSchema = z.object({
  title: z.string().min(1),
  genre: z.string().min(1),
  logline: z.string().min(1),
  mainPlot: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)).min(2),
  conflicts: z.array(z.string().min(1)).min(1),
  styleGuide: z
    .string()
    .min(1)
    .describe('Visual style keywords reused verbatim in every image prompt'),
})

const SYSTEM = `你是资深短剧编剧与制片。你的输出会被程序解析，必须是严格 JSON，不要任何解释文字或代码围栏。
styleGuide 用于所有分镜配图的提示词前缀，请写成英文视觉关键词（画风、镜头质感、色调、光线），不要写剧情。`

export default definePlugin<StagePort>({
  port: 'stage',
  name: 'plan',
  create: () => ({
    name: 'plan',
    id: 'plan',
    needs: [],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const episodes = numberOption(ctx.options['episodes'], 1)

      log.info(`plan: drafting from idea (${project.kind}, ${project.ratio})`)

      const result = await ports.llm.complete({
        purpose: "plan",
        system: SYSTEM,
        schema: planSchema,
        messages: [
          {
            role: 'user',
            content: [
              `创意：${project.idea}`,
              `内容类型：${project.kind}`,
              `画幅：${project.ratio}`,
              `计划集数：${episodes}`,
              '',
              '产出完整项目方案，JSON 字段：title, genre, logline, mainPlot, sellingPoints[], conflicts[], styleGuide。',
            ].join('\n'),
          },
        ],
      })

      log.info(`plan: "${result.data.title}" — ${result.data.genre}`)
      ctx.emit('plan', result.data)

      return {
        kind: 'ok',
        project: {
          ...project,
          title: result.data.title,
          plan: result.data,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
