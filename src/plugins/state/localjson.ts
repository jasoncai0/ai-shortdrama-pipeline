import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stateError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { StatePort } from '../../kernel/ports.js'
import type { Project } from '../../kernel/types.js'
import { resolveDataPath } from '../../lib/datadir.js'

/**
 * Default state store: one JSON file per project, written atomically.
 *
 * Local state is the source of truth. A remote canvas (libtv) is treated as a
 * projection that can be rebuilt — never as the record itself, so switching
 * providers never loses the project.
 */
export default definePlugin<StatePort>({
  port: 'state',
  name: 'localjson',
  create: (options, deps) => {
    const root = resolveDataPath(options['root'], deps.cwd, 'state')
    const fileFor = (id: string): string => join(root, `${sanitize(id)}.json`)

    return {
      name: 'localjson',

      load: async (projectId) => {
        try {
          const text = await readFile(fileFor(projectId), 'utf8')
          return JSON.parse(text) as Project
        } catch (error) {
          if (isNotFound(error)) return null
          throw stateError(
            `Cannot read project ${projectId}: ${String(error)}`,
            `Check ${fileFor(projectId)}`,
          )
        }
      },

      save: async (project) => {
        await mkdir(root, { recursive: true })
        const target = fileFor(project.id)
        const tmp = `${target}.${process.pid}.tmp`
        try {
          await writeFile(tmp, JSON.stringify(project, null, 2), 'utf8')
          await rename(tmp, target)
        } catch (error) {
          throw stateError(`Cannot write project ${project.id}: ${String(error)}`)
        }
        deps.log.debug(`state saved → ${target}`)
      },

      list: async () => {
        try {
          const files = await readdir(root)
          return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
        } catch (error) {
          if (isNotFound(error)) return []
          throw stateError(`Cannot list projects in ${root}: ${String(error)}`)
        }
      },
    }
  },
})

const sanitize = (id: string): string => id.replace(/[^\w.-]/g, '_')

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT'
