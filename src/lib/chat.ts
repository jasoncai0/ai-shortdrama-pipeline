import { providerError } from '../kernel/errors.js'
import type { CompleteRequest, LLMPort, LLMResult, Logger } from '../kernel/ports.js'

export interface ChatCompleterOptions {
  readonly name: string
  readonly baseUrl: string
  readonly apiKey: string
  readonly model: string
  readonly temperature: number
  readonly timeoutMs: number
  readonly supportsJsonMode: boolean
  readonly log: Logger
}

interface ChatResponse {
  readonly choices?: readonly { readonly message?: { readonly content?: string } }[]
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number }
  readonly error?: { readonly message?: string }
}

/**
 * OpenAI-compatible chat client with schema-enforced structured output.
 *
 * Structured output is done by asking for JSON, parsing, and re-prompting with
 * the validation errors on failure. That works on every compatible endpoint,
 * including ones with no native tool-calling — which is the point of having
 * this be swappable.
 */
export const createChatCompleter = (opts: ChatCompleterOptions): LLMPort => ({
  name: opts.name,

  complete: async <T>(req: CompleteRequest<T>): Promise<LLMResult<T>> => {
    const maxRetries = req.maxRetries ?? 2
    const wantsJson = Boolean(req.schema)

    const baseMessages = [
      ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ]

    let repair: string | undefined
    let lastRaw = ''

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const messages = repair
        ? [...baseMessages, { role: 'assistant' as const, content: lastRaw }, { role: 'user' as const, content: repair }]
        : baseMessages

      const body: Record<string, unknown> = {
        model: opts.model,
        messages,
        temperature: req.temperature ?? opts.temperature,
      }
      if (wantsJson && opts.supportsJsonMode) {
        body['response_format'] = { type: 'json_object' }
      }

      const content = await postChat(opts, body)
      lastRaw = content

      if (!req.schema) {
        return { data: content as unknown as T, raw: content }
      }

      const jsonText = extractJson(content)
      const parsed = req.schema.safeParse(safeParseJson(jsonText))
      if (parsed.success) {
        return { data: parsed.data, raw: content }
      }

      const issues = parsed.error.issues
        .slice(0, 8)
        .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n')
      opts.log.warn(`llm ${opts.name}: schema mismatch (attempt ${attempt + 1}/${maxRetries + 1})`)
      repair = `Your previous reply did not satisfy the required schema:\n${issues}\n\nReply again with ONLY the corrected JSON object. No prose, no code fences.`
    }

    throw providerError(
      `LLM "${opts.name}" could not produce schema-valid JSON after ${maxRetries + 1} attempts.`,
      lastRaw.slice(0, 400),
    )
  },
})

const postChat = async (
  opts: ChatCompleterOptions,
  body: Record<string, unknown>,
): Promise<string> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)

  try {
    const response = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()
    if (!response.ok) {
      throw providerError(
        `LLM "${opts.name}" returned HTTP ${response.status}.`,
        text.slice(0, 300),
      )
    }

    const json = safeParseJson(text) as ChatResponse
    if (json.error?.message) {
      throw providerError(`LLM "${opts.name}" error: ${json.error.message}`)
    }
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      throw providerError(
        `LLM "${opts.name}" returned an empty completion.`,
        text.slice(0, 300),
      )
    }
    return content
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw providerError(`LLM "${opts.name}" timed out after ${opts.timeoutMs}ms.`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Models wrap JSON in prose or fences more often than anyone admits. */
export const extractJson = (text: string): string => {
  const trimmed = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fence?.[1]) return fence[1].trim()

  const start = trimmed.search(/[[{]/)
  if (start === -1) return trimmed
  const open = trimmed[start]
  const close = open === '{' ? '}' : ']'
  const end = trimmed.lastIndexOf(close)
  return end > start ? trimmed.slice(start, end + 1) : trimmed
}

const safeParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
