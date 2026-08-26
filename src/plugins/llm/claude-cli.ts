import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { extractJson } from '../../lib/chat.js'
import { run } from '../../lib/proc.js'
import type { CompleteRequest, LLMPort, LLMResult } from '../../kernel/ports.js'

/**
 * A real LLM through the locally-authenticated Claude Code CLI.
 *
 * This machine has no DEEPSEEK_API_KEY and no ANTHROPIC_API_KEY — but it does
 * have `claude` logged in via OAuth. `claude -p --output-format json` gives a
 * clean one-shot completion over that auth, which makes it the only real model
 * this pipeline can reach without new credentials.
 *
 * Trade-offs, stated rather than hidden:
 *  - each call pays the CLI's startup + system prompt overhead (~8-10s, and a
 *    visible per-call cost in the JSON envelope, which we log);
 *  - there is no native tool-calling surface here — schema enforcement is the
 *    same ask-for-JSON / validate / re-prompt loop the other adapters use;
 *  - `--max-turns 1` pins it to a completion, never an agentic run.
 *
 * The prompt goes over stdin so story content never lands in argv (visible in
 * `ps`) or a temp file.
 *
 * Options:
 *   bin      default /opt/homebrew/bin/claude (a shell alias shadows `claude`)
 *   model    default claude-haiku-4-5-20251001
 *   timeoutMs default 180000
 */
export default definePlugin<LLMPort>({
  port: 'llm',
  name: 'claude-cli',
  create: (options, deps) => {
    const bin = asString(options['bin']) ?? '/opt/homebrew/bin/claude'
    const model = asString(options['model']) ?? 'claude-haiku-4-5-20251001'
    const timeoutMs = typeof options['timeoutMs'] === 'number' ? options['timeoutMs'] : 180_000

    const once = async (prompt: string): Promise<string> => {
      const result = await run(
        bin,
        ['-p', '--model', model, '--output-format', 'json', '--max-turns', '1'],
        { timeoutMs, log: deps.log, stdin: prompt },
      )
      if (result.code !== 0) {
        throw providerError(
          `claude-cli exited ${result.code}`,
          result.stderr.trim().split('\n').slice(-3).join('\n'),
        )
      }
      let envelope: { result?: string; total_cost_usd?: number; is_error?: boolean }
      try {
        envelope = JSON.parse(result.stdout)
      } catch {
        throw providerError('claude-cli did not return its JSON envelope.', result.stdout.slice(0, 300))
      }
      if (envelope.is_error || typeof envelope.result !== 'string') {
        throw providerError('claude-cli returned an error result.', String(envelope.result).slice(0, 300))
      }
      deps.log.debug(`claude-cli: $${(envelope.total_cost_usd ?? 0).toFixed(4)}`)
      return envelope.result
    }

    return {
      name: 'claude-cli',

      complete: async <T>(req: CompleteRequest<T>): Promise<LLMResult<T>> => {
        const maxRetries = req.maxRetries ?? 2
        const base = [
          req.system ?? '',
          ...req.messages.map((m) => (m.role === 'user' ? m.content : `[assistant]\n${m.content}`)),
        ]
          .filter(Boolean)
          .join('\n\n')

        let repair = ''
        let lastRaw = ''
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          const prompt = repair ? `${base}\n\n${repair}` : base
          const content = await once(prompt)
          lastRaw = content

          if (!req.schema) return { data: content as unknown as T, raw: content }

          const parsed = req.schema.safeParse(safeJson(extractJson(content)))
          if (parsed.success) return { data: parsed.data, raw: content }

          const issues = parsed.error.issues
            .slice(0, 6)
            .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('\n')
          deps.log.warn(`claude-cli: schema mismatch (attempt ${attempt + 1}/${maxRetries + 1})`)
          repair = `你上一次的回复不满足要求的 JSON 结构：\n${issues}\n\n重新输出，只输出修正后的 JSON 对象，不要任何解释或代码围栏。上一次回复是：\n${lastRaw.slice(0, 1500)}`
        }
        throw providerError(
          `claude-cli could not produce schema-valid JSON after ${maxRetries + 1} attempts.`,
          lastRaw.slice(0, 300),
        )
      },
    }
  },
})

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
