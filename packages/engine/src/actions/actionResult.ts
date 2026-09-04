/**
 * The `Complete | Blocked` result contract the action evaluators share.
 *
 * Every evaluator in this directory answers with one of two records: a
 * completed arm carrying the evidence it derived, or a blocked arm carrying
 * exactly one issue and no evidence. Each module used to restate that union
 * and hand-roll the factory that builds the blocked record, so the invariant
 * lived in as many places as there were evaluators and could drift in any of
 * them.
 *
 * The names here state the invariant once. They deliberately do *not* attempt
 * to unify what the two arms carry: a blocked record also reports the stage it
 * reached (the inputs it accepted, the sub-result that blocked it), and that
 * payload is specific to the evaluator. Only the frame is shared.
 *
 * The blocked record's shape — including key order, which JSON serialisation
 * observes — is unchanged from the hand-rolled factories this replaces:
 * `status` first, the evaluator's own fields in their declared order, and the
 * single-issue `issues` tuple last.
 *
 * This module is internal. It is not re-exported from `index.ts` and has no
 * `package.json` subpath: it describes how evaluators are written, not a
 * contract consumers depend on.
 */
import { deepFreeze } from './freeze.js'

/**
 * An evaluator's answer: its completed arm or its blocked arm.
 *
 * Both arms are named types rather than being derived from a single issue
 * type, because the blocked arm carries evaluator-specific diagnostics beyond
 * the issue itself and consumers narrow on those fields.
 */
export type ActionResult<TComplete, TBlocked> = TComplete | TBlocked

/**
 * The part of a blocked arm that is the same in every evaluator: a
 * discriminating `status` literal and exactly one issue.
 *
 * A blocked type intersects this with whatever else it reports. The one-element
 * tuple is what makes "blocked" mean blocked on a single, named cause — an
 * evaluator stops at the first thing it cannot establish rather than
 * accumulating a list.
 */
export type BlockedActionArm<TStatus extends string, TIssue> = Readonly<{
  status: TStatus
  issues: readonly [Readonly<TIssue>]
}>

/**
 * Build a blocked result: freeze `{ status, ...fields, issues: [issue] }`.
 *
 * `fields` is the evaluator's own blocked payload, spread in its own order, so
 * the record this produces is byte-identical to what each module's local
 * `blocked()` built.
 *
 * The return is asserted rather than inferred. A structural type cannot be
 * built from an open `Record<string, unknown>` spread, and every caller has
 * already declared the exact blocked type it is producing; performing the
 * erasure here means it is written and explained once instead of once per
 * evaluator. Callers keep the guarantee by declaring their local `blocked()`
 * with an explicit blocked return type, which is what pins `TBlocked`.
 */
export function blockedActionResult<TBlocked>(
  status: string,
  fields: Readonly<Record<string, unknown>>,
  issue: Readonly<Record<string, unknown>>,
): TBlocked {
  return deepFreeze({ status, ...fields, issues: [issue] }) as unknown as TBlocked
}
