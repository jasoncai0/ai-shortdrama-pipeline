import { configError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { createChatCompleter } from '../../lib/chat.js'
import type { LLMPort } from '../../kernel/ports.js'

/**
 * Any OpenAI-compatible /chat/completions endpoint: DeepSeek, Moonshot,
 * Ollama, vLLM, together.ai, an internal gateway — all the same wire format.
 *
 * `llm/deepseek` is this adapter with DeepSeek's defaults pre-filled.
 */
export default definePlugin<LLMPort>({
  port: 'llm',
  name: 'openai-compat',
  create: (options, deps) => {
    const baseUrl = asString(options['baseUrl'])
    if (!baseUrl) {
      throw configError(
        'ports.llm.options.baseUrl is required for the openai-compat adapter.',
        'For example: https://api.deepseek.com/v1',
      )
    }
    const apiKeyEnv = asString(options['apiKeyEnv']) ?? 'OPENAI_API_KEY'
    const apiKey = asString(options['apiKey']) ?? process.env[apiKeyEnv]
    if (!apiKey) {
      throw configError(
        `No API key for the LLM adapter (env ${apiKeyEnv} is empty).`,
        `Export ${apiKeyEnv}=... or switch ports.llm.impl to "stub" for an offline run.`,
      )
    }

    return createChatCompleter({
      name: asString(options['name']) ?? 'openai-compat',
      baseUrl,
      apiKey,
      model: asString(options['model']) ?? 'gpt-4o-mini',
      temperature: typeof options['temperature'] === 'number' ? options['temperature'] : 0.7,
      timeoutMs: typeof options['timeoutMs'] === 'number' ? options['timeoutMs'] : 120_000,
      supportsJsonMode: options['jsonMode'] !== false,
      log: deps.log,
    })
  },
})

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined
