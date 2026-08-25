import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { budgetError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import type { Charge, Hold, LedgerPort } from '../../kernel/ports.js'

/**
 * Append-only local ledger with reserve → commit / refund.
 *
 * Purpose is a BUDGET GUARDRAIL and a duplicate-work guard, not accounting:
 * the provider's own billing is authoritative. `reserve()` returning
 * `alreadySettled` is what makes `--resume` free.
 */

type Entry =
  | { readonly t: 'reserve'; readonly key: string; readonly amount: number; readonly reason: string; readonly at: string }
  | { readonly t: 'commit'; readonly key: string; readonly amount: number; readonly at: string }
  | { readonly t: 'refund'; readonly key: string; readonly amount: number; readonly reason: string; readonly at: string }

export default definePlugin<LedgerPort>({
  port: 'ledger',
  name: 'localledger',
  create: async (options, deps) => {
    const rawRoot = typeof options['root'] === 'string' ? options['root'] : './.duanju/ledger'
    const root = isAbsolute(rawRoot) ? rawRoot : resolve(deps.cwd, rawRoot)
    const maxCredits = typeof options['maxCredits'] === 'number' ? options['maxCredits'] : 0
    const file = join(root, 'ledger.ndjson')

    const entries = await readEntries(file)
    const settled = new Set(entries.filter((e) => e.t === 'commit').map((e) => e.key))
    let spent = entries
      .filter((e): e is Extract<Entry, { t: 'commit' }> => e.t === 'commit')
      .reduce((sum, e) => sum + e.amount, 0)

    const append = async (entry: Entry): Promise<void> => {
      await mkdir(root, { recursive: true })
      await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8')
    }

    return {
      name: 'localledger',

      reserve: async (charge: Charge): Promise<Hold> => {
        if (settled.has(charge.idempotencyKey)) {
          deps.log.debug(`ledger: ${charge.idempotencyKey} already settled, skipping work`)
          return { idempotencyKey: charge.idempotencyKey, amount: charge.amount, alreadySettled: true }
        }
        if (maxCredits > 0 && spent + charge.amount > maxCredits) {
          throw budgetError(
            `Budget exceeded: ${spent} + ${charge.amount} > ${maxCredits} credits.`,
            'Raise budget.maxCredits in the config, or run with a stub adapter.',
          )
        }
        await append({
          t: 'reserve',
          key: charge.idempotencyKey,
          amount: charge.amount,
          reason: charge.reason,
          at: new Date().toISOString(),
        })
        return { idempotencyKey: charge.idempotencyKey, amount: charge.amount, alreadySettled: false }
      },

      commit: async (hold, actual) => {
        // Idempotent by key: a double commit must not inflate `spent`.
        if (settled.has(hold.idempotencyKey)) {
          deps.log.debug(`ledger: ${hold.idempotencyKey} already committed, ignoring`)
          return
        }
        const amount = actual ?? hold.amount
        settled.add(hold.idempotencyKey)
        spent += amount
        await append({ t: 'commit', key: hold.idempotencyKey, amount, at: new Date().toISOString() })
      },

      refund: async (hold, reason) => {
        await append({
          t: 'refund',
          key: hold.idempotencyKey,
          amount: hold.amount,
          reason,
          at: new Date().toISOString(),
        })
        deps.log.debug(`ledger: refunded ${hold.idempotencyKey} (${reason})`)
      },

      balance: async () => (maxCredits > 0 ? maxCredits - spent : -spent),
    }
  },
})

const readEntries = async (file: string): Promise<readonly Entry[]> => {
  try {
    const text = await readFile(file, 'utf8')
    return text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Entry]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}
