import { definePlugin } from '../../kernel/registry.js'
import type { LedgerPort } from '../../kernel/ports.js'

/**
 * No-op ledger: no budget, no bookkeeping, no persistence.
 *
 * The right choice when the provider does its own metering (libtv credits,
 * a vendor console) and a second set of books would only ever disagree with it.
 *
 * What you give up: `reserve()` always reports `alreadySettled: false`, so the
 * ledger's duplicate-work short-circuit is gone. Resume is still cheap — stages
 * skip shots that already hold a `still`/`clip` — but a shot whose asset was
 * lost from state WILL be regenerated (and re-billed by the provider).
 * Use `localledger` when that matters, or when you want a spend ceiling.
 */
export default definePlugin<LedgerPort>({
  port: 'ledger',
  name: 'noop',
  create: (_options, deps) => ({
    name: 'noop',

    reserve: async (charge) => {
      deps.log.debug(`ledger(noop): ${charge.reason}`)
      return {
        idempotencyKey: charge.idempotencyKey,
        amount: charge.amount,
        alreadySettled: false,
      }
    },

    commit: async () => {
      /* nothing to record */
    },

    refund: async () => {
      /* nothing to reverse */
    },

    balance: async () => Number.POSITIVE_INFINITY,
  }),
})
