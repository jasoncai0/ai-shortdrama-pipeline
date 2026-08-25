import { configError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { createChatCompleter } from '../../lib/chat.js'
import type { LLMPort } from '../../kernel/ports.js'

/** DeepSeek preset over the shared OpenAI-compatible client. */
export default definePlugin<LLMPort>({
  port: 'llm',
  name: 'deepseek',
  create: (options, deps) => {
    const apiKeyEnv = asString(options['apiKeyEnv']) ?? 'DEEPSEEK_API_KEY'
    const apiKey = asString(options['apiKey']) ?? process.env[apiKeyEnv]
    if (!apiKey) {
      throw configError(
        `DeepSeek API key missing (env ${apiKeyEnv} is empty).`,
        `Export ${apiKeyEnv}=sk-..., or set ports.llm.impl to "stub" to run offline.`,
      )
    }

    return createChatCompleter({
      name: 'deepseek',
      baseUrl: asString(options['baseUrl']) ?? 'https://api.deepseek.com/v1',
      apiKey,
      model: asString(options['model']) ?? 'deepseek-chat',
      temperature: typeof options['temperature'] === 'number' ? options['temperature'] : 0.8,
      timeoutMs: typeof options['timeoutMs'] === 'number' ? options['timeoutMs'] : 180_000,
      supportsJsonMode: options['jsonMode'] !== false,
      log: deps.log,
    })
  },
})

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined
