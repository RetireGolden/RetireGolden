/**
 * What the load changed in a stored plan, told once when the plan opens.
 *
 * The engine repairs a handful of shapes a stored document can hold that current
 * validation refuses, so a household is never locked out of the plan the app is
 * asking them to fix. Most of those repairs are invisible afterwards: a lump-sum
 * election for a year still ahead never moved a dollar in the projection, and
 * the annuity retarget only changes which balance the premium leaves. Without
 * this notice a household could not know their document was changed.
 *
 * It renders nothing when nothing was repaired, which is almost every load.
 */

import { usePlan } from './planContextCore'
import { usePlanRepairs } from './planRepairContext'
import {
  PLAN_REPAIR_NOTICE_DISMISS,
  PLAN_REPAIR_NOTICE_INTRO,
  PLAN_REPAIR_NOTICE_TITLE,
  planRepairMessage,
} from './planRepairCopy'

export function PlanRepairNotice() {
  const { plan } = usePlan()
  const { repairs, dismiss } = usePlanRepairs()
  if (repairs.length === 0) return null

  return (
    <div className="callout callout--warn plan-repair-notice" role="status">
      <p>
        <strong>{PLAN_REPAIR_NOTICE_TITLE}</strong>
      </p>
      <p>{PLAN_REPAIR_NOTICE_INTRO}</p>
      <ul>
        {repairs.map((repair, index) => (
          // Repairs carry no id of their own and a plan can hold two of the same
          // kind on different accounts, so the position in the engine's ordered
          // list is the key. The list is fixed for the life of the notice.
          <li key={`${repair.kind}:${repair.accountId}:${index}`}>{planRepairMessage(repair, plan)}</li>
        ))}
      </ul>
      <div className="picker-actions" style={{ margin: 0 }}>
        <button type="button" className="btn btn-secondary btn-small" onClick={dismiss}>
          {PLAN_REPAIR_NOTICE_DISMISS}
        </button>
      </div>
    </div>
  )
}
