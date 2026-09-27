/**
 * Library examples as the app opens them (planner/examples/loadExample.ts
 * stamps the same fields), for parity tests that measure what a reader sees
 * on an example: the plan id `example:<id>` seeds Monte Carlo, and the
 * example's fixed clock sets the timestamps.
 */
import type { Plan } from '@retiregolden/engine/model/plan'

import { exampleStorageId } from '../data/planOrigin'
import { exampleFixedNow } from '../planner/examples/buildContext'
import { EXAMPLE_PLANS, getExampleById, type ExamplePlan } from '../planner/examples/registry'

export function appExamplePlan(example: ExamplePlan): Plan {
  const built = example.build()
  return {
    ...built,
    id: exampleStorageId(example.id),
    name: example.title,
    origin: 'example',
    exampleSourceId: example.id,
    createdAtIso: exampleFixedNow().toISOString(),
    updatedAtIso: exampleFixedNow().toISOString(),
  }
}

export function appExamplePlanById(id: string): Plan {
  const example = getExampleById(id)
  if (example === undefined) throw new Error(`No library example ${id}`)
  return appExamplePlan(example)
}

export function appExamplePlans(): { id: string; plan: Plan }[] {
  return EXAMPLE_PLANS.map((example) => ({ id: example.id, plan: appExamplePlan(example) }))
}
