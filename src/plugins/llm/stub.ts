import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { LLMPort } from '../../kernel/ports.js'

/**
 * Offline LLM. Rather than mocking each stage, it synthesises a value that
 * satisfies whatever zod schema it is handed, by walking the schema's shape.
 * That keeps the stub honest: if a stage's schema changes, the stub follows.
 */
export default definePlugin<LLMPort>({
  port: 'llm',
  name: 'stub',
  create: (options, deps) => {
    const seedWord = typeof options['seed'] === 'string' ? options['seed'] : 'stub'

    return {
      name: 'stub',
      complete: async <T>(req: { schema?: unknown; messages: readonly { content: string }[] }) => {
        deps.log.debug('stub llm: synthesising schema-shaped reply')
        if (!req.schema) {
          return { data: `${seedWord} reply` as unknown as T, raw: `${seedWord} reply` }
        }
        const value = synthesize(req.schema, seedWord, 0) as T
        return { data: value, raw: JSON.stringify(value) }
      },
    } as LLMPort
  },
})

interface ZodInternal {
  readonly _def?: {
    readonly typeName?: string
    readonly shape?: () => Record<string, unknown>
    readonly type?: unknown
    readonly innerType?: unknown
    readonly values?: readonly string[]
    readonly value?: unknown
    readonly options?: readonly unknown[]
    readonly minLength?: { readonly value: number } | null
    readonly checks?: readonly { readonly kind: string; readonly value?: number }[]
  }
}

/** Walks zod's internal shape. Intentionally tolerant: unknown → null. */
const synthesize = (schema: unknown, seed: string, depth: number): unknown => {
  if (depth > 8) return null
  const def = (schema as ZodInternal)._def
  if (!def) return null

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = def.shape?.() ?? {}
      return Object.fromEntries(
        Object.entries(shape).map(([key, child]) => [key, synthesize(child, `${seed}-${key}`, depth + 1)]),
      )
    }
    case 'ZodArray': {
      const min = def.minLength?.value ?? 1
      const count = Math.max(min, 2)
      return Array.from({ length: count }, (_v, i) =>
        synthesize(def.type, `${seed}-${i + 1}`, depth + 1),
      )
    }
    case 'ZodString':
      return `${seed}`
    case 'ZodNumber': {
      const min = def.checks?.find((c) => c.kind === 'min')?.value
      return typeof min === 'number' ? min : 1
    }
    case 'ZodBoolean':
      return false
    case 'ZodEnum':
      return def.values?.[0] ?? null
    case 'ZodLiteral':
      return def.value ?? null
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return synthesize(def.innerType, seed, depth + 1)
    case 'ZodUnion':
      return synthesize(def.options?.[0], seed, depth + 1)
    default:
      throw providerError(
        `stub llm cannot synthesise zod type "${String(def.typeName)}".`,
        'Extend src/plugins/llm/stub.ts, or use a real LLM adapter for this stage.',
      )
  }
}
