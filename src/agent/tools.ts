import { runPipeline } from '../kernel/pipeline.js'
import { loadSkill, selectSections } from '../lib/skillset.js'
import { ToolRegistry } from './core.js'
import type { App } from '../app.js'
import type { Config, NormalizedStage } from '../kernel/config.js'
import type { ProgressReporter } from '../kernel/health.js'
import type { StagePort } from '../kernel/ports.js'
import type { Logger } from '../kernel/ports.js'
import type { Project } from '../kernel/types.js'

/**
 * The pipeline handed to the agent as tools.
 *
 * The agent does not get raw generators. It gets the *stages* — the same
 * budgeted, idempotent, gate-aware units the config-driven pipeline runs — so
 * everything the pipeline enforces (ledger reserve/commit, identity refs,
 * licence policy, measured timing) still holds when an LLM is doing the
 * scheduling. An agent that could call `image.generate` directly would be an
 * agent that can bypass every one of those rules.
 *
 * Project state is shared through a holder rather than threaded through the
 * model: the LLM sees trimmed snapshots via `read_project`, never the whole
 * document, and the authoritative copy is saved by the pipeline after every
 * stage exactly as in a config-driven run.
 */

export interface ProjectHolder {
  current: Project
}

export const buildAgentTools = (
  app: App,
  config: Config,
  holder: ProjectHolder,
  log: Logger,
  opts: {
    skillsDir: string
    stageDefaults: Record<string, unknown>
    health?: { reporter?: ProgressReporter; stallTimeoutMs?: number }
  },
): ToolRegistry => {
  const registry = new ToolRegistry()

  registry.register({
    name: 'read_project',
    description:
      '读当前项目状态快照（裁剪版）。part 可选: overview | characters | shots | assets | post',
    args: { part: 'overview|characters|shots|assets|post，默认 overview' },
    run: async (args) => snapshot(holder.current, String(args['part'] ?? 'overview')),
  })

  registry.register({
    name: 'run_stages',
    description:
      '按顺序运行一个或多个管线 stage。可用: plan, assets, refs, wardrobe, sheets, shots, camera-check, voice-check, prompts, images, videos, dub, export, music, intro-cards, subtitles, cover。gate 类 stage 由人负责，不给 agent。',
    args: { stages: '字符串数组，如 ["plan","assets"]', options: '可选，按 stage 名给参数，如 {"wardrobe":{"looksPerLead":3}}' },
    run: async (args) => {
      const wanted = Array.isArray(args['stages'])
        ? (args['stages'] as unknown[]).filter((s): s is string => typeof s === 'string')
        : []
      if (wanted.length === 0) return '错误：stages 必须是非空字符串数组'
      const forbidden = wanted.filter((s) => s.startsWith('gate'))
      if (forbidden.length > 0) return `错误：闸门 (${forbidden.join(',')}) 是人工确认点，agent 不能替用户通过`

      const perStage = (args['options'] ?? {}) as Record<string, Record<string, unknown>>
      const stages: NormalizedStage[] = wanted.map((id) => ({
        id,
        use: id,
        options: { ...opts.stageDefaults, ...(perStage[id] ?? {}) },
      }))

      // The agent is not bound to the config's `pipeline` list — it can run
      // any registered stage. Load them on demand instead of relying on
      // app.stagePlugins (which only holds the config-declared positions).
      const plugins = new Map(app.stagePlugins)
      for (const entry of stages) {
        if (plugins.has(entry.id)) continue
        try {
          const plugin = await app.registry.load<StagePort>('stage', entry.use, entry.options)
          plugins.set(entry.id, { ...plugin, id: entry.id, run: plugin.run.bind(plugin) })
        } catch {
          return `错误：没有名为 "${entry.id}" 的 stage。`
        }
      }

      const result = await runPipeline(holder.current, {
        stages,
        plugins,
        ports: app.ports,
        log,
        concurrency: config.concurrency,
        autoApprove: true,
        force: wanted,
        health: opts.health,
        onProject: (p) => {
          holder.current = p
          app.setProject(p)
        },
      })
      holder.current = result.project
      app.setProject(result.project)

      if (result.kind === 'failed') return `stage "${result.stage}" 失败：${result.error}`
      if (result.kind === 'awaiting-input') return `停在闸门 "${result.stage}"：${result.question}（需人工 resume）`
      return `完成 ${wanted.join(' → ')}。\n${snapshot(holder.current, 'overview')}`
    },
  })

  registry.register({
    name: 'skill_list',
    description: '列出某个生产规范技能的全部章节（文件名+标题），用于决定取哪段',
    args: { skill: '技能名，如 real-short-drama' },
    run: async (args) => {
      const skill = await loadSkill(process.cwd(), opts.skillsDir, String(args['skill'] ?? ''))
      return skill.sections.map((s) => `${s.file} — ${s.heading} (${s.chars}字)`).join('\n') || '（无章节）'
    },
  })

  registry.register({
    name: 'skill_file',
    description: '按需读取技能的一个或几个章节正文（按标题/文件名子串匹配）',
    args: { skill: '技能名', sections: '字符串数组，匹配章节标题或文件名' },
    run: async (args) => {
      const skill = await loadSkill(process.cwd(), opts.skillsDir, String(args['skill'] ?? ''))
      const patterns = Array.isArray(args['sections'])
        ? (args['sections'] as unknown[]).filter((s): s is string => typeof s === 'string')
        : []
      const hits = selectSections(skill, patterns)
      if (hits.length === 0) return `没有匹配 ${JSON.stringify(patterns)} 的章节。先用 skill_list 看目录。`
      return hits.map((s) => `### ${s.heading}\n${s.text}`).join('\n\n').slice(0, 9000)
    },
  })

  registry.register({
    name: 'update_character',
    description:
      '修改一个角色的可写字段（epithet / billing / appearance / voiceProfile 音色人设 / voiceId 选定音色）。身份图等资产不可由此修改。',
    args: {
      name: '角色名',
      epithet: '可选',
      billing: '可选 lead|supporting|extra',
      appearance: '可选',
      voiceProfile: '可选，音色人设描述',
      voiceId: '可选，供应商音色 id',
    },
    run: async (args) => {
      const name = String(args['name'] ?? '')
      const target = holder.current.characters.find((c) => c.name === name)
      if (!target) return `没有角色 "${name}"。现有：${holder.current.characters.map((c) => c.name).join('、')}`
      holder.current = {
        ...holder.current,
        characters: holder.current.characters.map((c) =>
          c.name !== name
            ? c
            : {
                ...c,
                ...(typeof args['epithet'] === 'string' ? { epithet: args['epithet'] } : {}),
                ...(args['billing'] === 'lead' || args['billing'] === 'supporting' || args['billing'] === 'extra'
                  ? { billing: args['billing'] }
                  : {}),
                ...(typeof args['appearance'] === 'string' ? { appearance: args['appearance'] } : {}),
                ...(typeof args['voiceProfile'] === 'string' || typeof args['voiceId'] === 'string'
                  ? {
                      voice: {
                        profile:
                          typeof args['voiceProfile'] === 'string'
                            ? args['voiceProfile']
                            : (c.voice?.profile ?? ''),
                        ...(typeof args['voiceId'] === 'string'
                          ? { voiceId: args['voiceId'] }
                          : c.voice?.voiceId
                            ? { voiceId: c.voice.voiceId }
                            : {}),
                      },
                    }
                  : {}),
              },
        ),
      }
      app.setProject(holder.current)
      await app.ports.state.save(holder.current)
      return `已更新 ${name}。`
    },
  })

  return registry
}

/** Trimmed views — the model never sees the whole Project document. */
const snapshot = (p: Project, part: string): string => {
  switch (part) {
    case 'characters':
      return p.characters
        .map(
          (c) =>
            `${c.name} [${c.billing ?? '?'}] ${c.epithet ?? ''}\n  外形: ${c.appearance.slice(0, 140)}\n  @base:${c.refImage ? '✓' : '✗'} 服饰:${c.wardrobe?.length ?? 0}套 名牌:${c.introCard ? '✓' : '✗'}`,
        )
        .join('\n') || '（无角色）'
    case 'shots':
      return (
        p.shots
          .slice(0, 40)
          .map(
            (s) =>
              `${s.id} ${s.durationSeconds}s [${s.status}] ${s.cameraMove ?? '?'} 图:${s.still ? '✓' : '✗'} 片:${s.clip ? '✓' : '✗'}${s.dialogue ? ` 台词:"${s.dialogue.slice(0, 24)}"` : ''}`,
          )
          .join('\n') || '（无镜头）'
      )
    case 'assets':
      return [
        `角色@base: ${p.characters.filter((c) => c.refImage).length}/${p.characters.length}`,
        `场景图: ${p.scenes.filter((s) => s.refImage).length}/${p.scenes.length}`,
        `服饰: ${p.characters.map((c) => `${c.name}=${c.wardrobe?.length ?? 0}`).join(' ')}`,
        `分镜图: ${p.shots.filter((s) => s.still).length}/${p.shots.length}`,
        `视频片段: ${p.shots.filter((s) => s.clip).length}/${p.shots.length}`,
      ].join('\n')
    case 'post':
      return [
        `finalCut: ${p.finalCut ? '✓' : '✗'}`,
        `配乐: ${p.music ? `✓ ${p.music.title} (${p.music.licence.code})` : '✗'}`,
        `introCut: ${p.introCut ? '✓' : '✗'}`,
        `字幕/成片: ${p.deliverable ? '✓ deliverable' : '✗'}`,
        `闸门状态: ${Object.entries(p.stageState)
          .filter(([k]) => k.startsWith('gate'))
          .map(([k, v]) => `${k}=${v.status}`)
          .join(' ') || '（无）'}`,
      ].join('\n')
    default: {
      const plan = p.plan
      return [
        `《${p.title}》 ${p.kind} ${p.ratio}  集:${p.episodes.length} 角色:${p.characters.length} 镜头:${p.shots.length}`,
        plan ? `题材:${plan.genre}  主线:${plan.mainPlot.slice(0, 120)}` : '（尚无 plan）',
        `进度: ${Object.entries(p.stageState)
          .map(([k, v]) => `${k}:${v.status === 'done' ? '✓' : v.status}`)
          .join(' ')}`,
      ].join('\n')
    }
  }
}
