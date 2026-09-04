/**
 * The `Complete | Blocked` result contract some action evaluators share.
 *
 * An evaluator that adopts this frame answers with one of two records: a
 * completed arm carrying the evidence it derived, or a blocked arm carrying
 * exactly one issue plus whatever evaluator-specific diagnostics it reports
 * (see below) — not every evaluator has adopted it, and `actions/` still has
 * hand-rolled `blocked()` factories whose issue shape does not fit this
 * frame. Each module that has adopted it used to restate the union and
 * hand-roll the factory that builds the blocked record, so the invariant
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
 * `fields` is still an open `Record<string, unknown>` spread — a structural
 * type cannot be built from it, so that half of the payload is asserted, not
 * checked. `status` and `issue` are not: they are typed against `TBlocked`
 * itself (`TBlocked['status']`, `TBlocked['issues'][0]`), and every caller's
 * local `blocked()` has an explicit blocked return type, so `TBlocked` is
 * inferred from that contextual return type rather than from the call's
 * arguments. A `status` literal or `issue` shape that does not match the
 * caller's declared blocked type is a compile error, the same as it was with
 * the single hand-rolled `as` this replaces.
 */
export function blockedActionResult<TBlocked extends BlockedActionArm<string, unknown>>(
  status: TBlocked['status'],
  fields: Readonly<Record<string, unknown>>,
  issue: TBlocked['issues'][0],
): TBlocked {
  return deepFreeze({ status, ...fields, issues: [issue] }) as unknown as TBlocked
}
