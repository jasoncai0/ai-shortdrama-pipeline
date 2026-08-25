import { pluginError } from './errors.js'
import type { Logger } from './ports.js'

export type PortName =
  | 'llm'
  | 'image'
  | 'video'
  | 'assetStore'
  | 'state'
  | 'ledger'
  | 'export'
  | 'promptStrategy'
  | 'middleware'
  | 'stage'

export interface PluginDeps {
  readonly log: Logger
  /** Directory the CLI was invoked from — adapters resolve relative paths here. */
  readonly cwd: string
  /**
   * Lets a plugin compose another plugin (e.g. a prompt strategy that calls an
   * LLM, or a middleware that needs its own image adapter for variants).
   */
  load<T>(port: PortName, impl: string, options: Record<string, unknown>): Promise<T>
}

export interface PluginDefinition<T = unknown> {
  readonly port: PortName
  readonly name: string
  create(options: Record<string, unknown>, deps: PluginDeps): T | Promise<T>
}

export const definePlugin = <T>(def: PluginDefinition<T>): PluginDefinition<T> => def

/** `port/name` → lazy module loader. Supplied by the composition root. */
export type BuiltinTable = Readonly<Record<string, () => Promise<{ default: PluginDefinition }>>>

/**
 * Resolves `impl` strings to instances. The kernel never imports an adapter;
 * it only ever sees this registry.
 */
export type BaseDeps = Omit<PluginDeps, 'load'>

export class PluginRegistry {
  private readonly deps: PluginDeps

  constructor(
    private readonly builtins: BuiltinTable,
    base: BaseDeps,
  ) {
    // Plugins get a `load` that routes back here, so they can compose others.
    this.deps = { ...base, load: (port, impl, options) => this.load(port, impl, options) }
  }

  async load<T>(
    port: PortName,
    impl: string,
    options: Record<string, unknown>,
  ): Promise<T> {
    const def = await this.resolve(port, impl)
    if (def.port !== port) {
      throw pluginError(
        `Plugin "${impl}" declares port "${def.port}" but was bound to "${port}".`,
        'Check the `port` field in the plugin definition.',
      )
    }
    try {
      return (await def.create(options, this.deps)) as T
    } catch (error) {
      throw pluginError(
        `Plugin "${port}/${impl}" failed to initialize: ${String(error)}`,
        undefined,
        error,
      )
    }
  }

  available(port: PortName): readonly string[] {
    const prefix = `${port}/`
    return Object.keys(this.builtins)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
      .sort()
  }

  private async resolve(port: PortName, impl: string): Promise<PluginDefinition> {
    if (impl.startsWith('npm:') || impl.startsWith('file:')) {
      const spec = impl.startsWith('npm:') ? impl.slice(4) : impl.slice(5)
      try {
        const mod = (await import(spec)) as { default?: PluginDefinition }
        if (!mod.default) {
          throw new Error('module has no default export')
        }
        return mod.default
      } catch (error) {
        throw pluginError(
          `Cannot load external plugin "${impl}" for port "${port}".`,
          'External plugins must default-export a definePlugin({...}) result.',
          error,
        )
      }
    }

    const loader = this.builtins[`${port}/${impl}`]
    if (!loader) {
      throw pluginError(
        `Unknown plugin "${impl}" for port "${port}".`,
        `Available: ${this.available(port).join(', ') || '(none)'}. External plugins use npm:<pkg> or file:<path>.`,
      )
    }
    const mod = await loader()
    return mod.default
  }
}
