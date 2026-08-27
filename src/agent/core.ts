import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { LLMPort, Logger } from '../kernel/ports.js'

/**
 * A minimal creative-director agent, TS-native, shaped after canda.
 *
 * What is borrowed from canda's architecture (and why, at this scale):
 *
 *  - **Catalog and dispatch are separate.** The tool catalog is the only
 *    source of what the LLM sees (names, descriptions, schemas); the
 *    dispatcher only routes by name. In canda that split keeps MCP the single
 *    source of truth for descriptions; here it keeps prompt-building and
 *    execution from growing into each other.
 *  - **The session log is an append-only JSONL file and it is the record.**
 *    Every turn — model output, tool result, error — is appended before the
 *    loop continues. Canda rebuilds its in-memory tree from the log; we can
 *    replay a session for review the same way.
 *  - **Skills are a directory at session start plus a fetch tool.** The agent
 *    is told which production skills exist, and reads sections on demand via
 *    `skill_file` — canda's SkillInjectionHook + skill_file, scaled down.
 *
 * What is deliberately NOT borrowed: parallel tool dispatch (our tools run a
 * whole pipeline stage each; two at once would race on Project), context
 * compression (sessions here are dozens of turns, not thousands), and Redis
 * session locks (one process, one session).
 *
 * The turn protocol is plain JSON over text, because the only real model we
 * can reach (claude-cli) has no native tool-calling surface:
 *   {"thought": "...", "tool": "name", "args": {...}}   — one action
 *   {"thought": "...", "done": true, "summary": "..."}  — finish
 */

export interface AgentTool {
  readonly name: string
  readonly description: string
  /** JSON-schema-ish shape shown to the model. Kept literal for readability. */
  readonly args: Readonly<Record<string, string>>
  run(args: Record<string, unknown>): Promise<string>
}

export class ToolRegistry {
  private readonly byName = new Map<string, AgentTool>()

  register(tool: AgentTool): void {
    if (this.byName.has(tool.name)) {
      throw new Error(`agent tool "${tool.name}" is already registered`)
    }
    this.byName.set(tool.name, tool)
  }

  /** The catalog — the ONLY thing the model is shown. Sorted for determinism. */
  catalog(): string {
    return [...this.byName.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (t) =>
          `- ${t.name}: ${t.description}\n  args: ${JSON.stringify(t.args)}`,
      )
      .join('\n')
  }

  /** The dispatcher — routes by name, knows nothing about descriptions. */
  async dispatch(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.byName.get(name)
    if (!tool) {
      return `错误：没有名为 "${name}" 的工具。可用工具：${[...this.byName.keys()].sort().join(', ')}`
    }
    try {
      return await tool.run(args)
    } catch (error) {
      // The model gets the failure as data and can react; the loop survives.
      return `工具 ${name} 执行失败：${error instanceof Error ? error.message : String(error)}`
    }
  }
}

const turnSchema = z.union([
  z.object({
    thought: z.string(),
    tool: z.string().min(1),
    args: z.record(z.unknown()).default({}),
  }),
  z.object({
    thought: z.string(),
    done: z.literal(true),
    summary: z.string().min(1),
  }),
])

export interface SessionEntry {
  readonly at: string
  readonly turn: number
  readonly kind: 'goal' | 'thought' | 'tool_call' | 'tool_result' | 'final' | 'error'
  readonly body: unknown
}

export interface AgentRunOptions {
  readonly goal: string
  readonly llm: LLMPort
  readonly tools: ToolRegistry
  readonly log: Logger
  /** Append-only JSONL — the authoritative record of the session. */
  readonly sessionFile: string
  readonly maxTurns: number
  /** Injected once at session start: the available-skills directory, etc. */
  readonly openingContext?: string
  /** Truncate a tool result to this many chars in the history the model sees. */
  readonly resultBudget?: number
  /** Progress hook: fired once per turn with a short note. Liveness signal. */
  onTurn?(turn: number, note: string): void
}

export interface AgentRunResult {
  readonly done: boolean
  readonly summary: string
  readonly turns: number
}

const SYSTEM = `你是一部 AI 竖屏短剧的创作总监 agent。你通过调用工具推进制作，自己不生成任何图像或视频——那是管线 stage 的事。

每一轮你只输出一个 JSON 对象，二选一，不要输出任何其他文字或代码围栏：
1. 调用一个工具： {"thought":"为什么做这一步","tool":"工具名","args":{...}}
2. 结束任务：     {"thought":"…","done":true,"summary":"做了什么、产物在哪、有什么要人工决定"}

规则：
- 一轮只调一个工具；看到结果再决定下一步。
- 工具失败时读错误信息调整，不要原样重试超过一次。
- 生产规范技能可用 skill_file 按需取用——先看目录，只取当前步骤需要的段落。
- 需要花钱的步骤（图/视频生成）之前，先用 read_project 确认前置产物齐了。`

export const runAgent = async (options: AgentRunOptions): Promise<AgentRunResult> => {
  const { goal, llm, tools, log, sessionFile, maxTurns } = options
  const resultBudget = options.resultBudget ?? 2400

  await mkdir(dirname(sessionFile), { recursive: true })
  const record = async (entry: Omit<SessionEntry, 'at'>): Promise<void> => {
    await appendFile(sessionFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
  }

  await record({ turn: 0, kind: 'goal', body: goal })

  // The history the model sees. Compact: tool results are truncated here but
  // stored in full in the session log — the log is the record, not the prompt.
  const history: string[] = []
  if (options.openingContext) history.push(options.openingContext)
  history.push(`任务目标：${goal}`)

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const result = await llm.complete({
      purpose: 'agent-turn',
      system: `${SYSTEM}\n\n可用工具：\n${tools.catalog()}`,
      schema: turnSchema,
      messages: [{ role: 'user', content: history.join('\n\n') }],
    })

    const turnData = result.data
    options.onTurn?.(turn, 'tool' in turnData ? turnData.tool : 'done')
    await record({ turn, kind: 'thought', body: turnData.thought })
    log.info(`agent[${turn}]: ${turnData.thought.slice(0, 120)}`)

    if ('done' in turnData) {
      await record({ turn, kind: 'final', body: turnData.summary })
      log.info(`agent: done — ${turnData.summary.slice(0, 200)}`)
      return { done: true, summary: turnData.summary, turns: turn }
    }

    await record({ turn, kind: 'tool_call', body: { tool: turnData.tool, args: turnData.args } })
    log.info(`agent[${turn}]: → ${turnData.tool}(${JSON.stringify(turnData.args).slice(0, 100)})`)

    const output = await tools.dispatch(turnData.tool, turnData.args ?? {})
    await record({ turn, kind: 'tool_result', body: { tool: turnData.tool, output } })

    const shown = output.length > resultBudget ? `${output.slice(0, resultBudget)}\n…(截断，完整见会话日志)` : output
    history.push(
      `[第${turn}轮] 你的判断：${turnData.thought}\n你调用了 ${turnData.tool}(${JSON.stringify(turnData.args)})\n结果：\n${shown}`,
    )
  }

  await record({ turn: maxTurns, kind: 'error', body: 'max turns reached' })
  return { done: false, summary: `到达最大轮数 ${maxTurns}，任务未收尾`, turns: maxTurns }
}
