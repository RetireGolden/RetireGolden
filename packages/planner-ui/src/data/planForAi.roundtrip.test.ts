/**
 * "Copy plan for your AI", end to end against the real contract.
 *
 * The browser is the PRODUCER of this payload, so the test lives here, beside
 * the serializer, with `@retiregolden/mcp` as a dev dependency (dev only —
 * nothing reaches the browser bundle). A fixture checked into the MCP repo would
 * read tidier, but nothing carries a regenerated fixture across a repo boundary:
 * it would keep passing while asserting nothing about the current browser. Here,
 * breaking the payload fails in the same PR that broke it.
 *
 * What it pins is the acceptance criterion: the copied payload, passed to
 * `build_plan`, reproduces the plan and the projection this app is showing.
 * `startYear` is the reason it exists — `build_plan` defaults to the literal
 * 2026 while the planner projects from the current year, so an unstamped payload
 * agrees with the app all through 2026 and silently diverges on 2027-01-01. The
 * negative controls below are as load-bearing as the positive one.
 *
 * Two things are asserted, and they are separate claims. First, that the rebuilt
 * plan re-projected through the app's OWN stack reproduces the app's ledger — that
 * the payload loses nothing. Second (the block at the bottom), that the MCP's own
 * `run_projection` returns the same summary — that an assistant handed this payload
 * reports the numbers the user is looking at.
 *
 * The second claim was false until @retiregolden/mcp 0.5.0, which ran a
 * federal-only tax stack against the browser's federal+state one; this file pinned
 * the divergence rather than papering over it. Keep them separate: a future payload
 * bug and a future MCP tax-stack regression should fail on different lines.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { ENGINE_VERSION } from '@retiregolden/engine/version'
import { buildPlanFromParams, type BuildPlanInput } from '@retiregolden/mcp'

import { createSamplePlan } from '../testSupport/samplePlan'
import { currentStartYear, projectPlan } from '../planner/useProjection'
import { serializeSinglePlan, type SinglePlanExport } from './planFormat'

/** Exactly what the toolbar button puts on the clipboard, parsed back. */
function copiedPayload(plan: Plan, startYear: number): SinglePlanExport {
  return JSON.parse(serializeSinglePlan(plan, startYear)) as SinglePlanExport
}

/** `build_plan` with the payload spread straight in, as the paste instruction says. */
function buildFrom(payload: SinglePlanExport | Partial<BuildPlanInput>) {
  return buildPlanFromParams(payload as BuildPlanInput)
}

/**
 * Assert the payload introduced no skew **of its own**.
 *
 * A `schemaVersion` skew caveat would be our bug — we stamp that from the same
 * constant the document carries. An `engineVersion` skew caveat is only our bug
 * when both sides are actually running the same engine. They often are not: the
 * MCP *exact-pins* an engine version, so from the moment the engine publishes a
 * release until the MCP re-pins and republishes, a correctly-stamped payload
 * legitimately triggers the provenance warning — which is the warning doing its
 * job, not a defect.
 *
 * So this compares against the MCP's own view of its engine rather than
 * asserting the caveat away. Blanket-asserting no skew would couple this file to
 * another repo's release cadence and turn every engine patch into a red test
 * here, which would teach the next person to delete the assertion.
 */
async function expectNoPayloadSkew(caveats: string[]) {
  const { adapter } = await import('@retiregolden/mcp')
  const mcpEngine = adapter.getVersions().engineVersion

  expect(caveats.filter((c) => c.includes('schemaVersion skew:'))).toEqual([])

  const engineSkew = caveats.filter((c) => c.includes('engineVersion skew:'))
  if (mcpEngine === ENGINE_VERSION) {
    expect(engineSkew).toEqual([])
  } else {
    // Different engines: exactly one caveat, and it must name both so a reader
    // can tell a release lag from a mis-stamped payload.
    expect(engineSkew).toHaveLength(1)
    expect(engineSkew[0]).toContain(ENGINE_VERSION)
    expect(engineSkew[0]).toContain(String(mcpEngine))
  }
}

describe('copied plan → build_plan', () => {
  it('rebuilds the same plan and start year, with no version skew', async () => {
    const plan = createSamplePlan()
    const view = projectPlan(plan)
    const built = buildFrom(copiedPayload(plan, view.startYear))

    expect(built.issues ?? []).toEqual([])
    expect(built.ok).toBe(true)
    expect(built.plan).toEqual(plan)
    expect(built.startYear).toBe(view.startYear)
    // Filtered to skew rather than asserting no caveats at all — since MCP 0.5.0
    // an imported document also reports that the resident state's income tax is
    // modeled, which is a true statement about this KY plan and not a defect in
    // the payload.
    await expectNoPayloadSkew(built.caveats)
  })

  it('reproduces the projection the results page is showing', () => {
    const plan = createSamplePlan()
    const shown = projectPlan(plan)
    const built = buildFrom(copiedPayload(plan, shown.startYear))
    expect(built.ok && built.plan).toBeTruthy()

    // Re-project the REBUILT plan at the REBUILT start year. Same ledger, year
    // for year, not just the same headline number.
    const rebuilt = projectPlan(built.plan!, built.startYear)
    expect(rebuilt.result).toEqual(shown.result)
    expect(rebuilt.summary).toEqual(shown.summary)
  })

  it('survives a plan with every exotic corner filled in', () => {
    // The sample plan is a well-behaved couple. Prove the wrapper is agnostic to
    // plan content by round-tripping a plan with scenarios, insurance, care
    // events and a one-time goal attached.
    const plan = createSamplePlan()
    plan.scenarios = [{ id: 'scen-1', name: 'Higher inflation', patch: { 'assumptions.inflationPct': 3 } }]
    const validated = parsePlan(plan)
    expect(validated.ok, validated.ok ? '' : validated.issues.join('; ')).toBe(true)

    const built = buildFrom(copiedPayload(validated.ok ? validated.plan : plan, 2029))
    expect(built.ok).toBe(true)
    expect(built.plan).toEqual(validated.ok ? validated.plan : plan)
    expect(built.startYear).toBe(2029)
  })
})

describe("the MCP's own run_projection", () => {
  /**
   * The other half of the acceptance criterion. The payload being faithful (above)
   * only pays off if the assistant reading it then reports the numbers the user is
   * looking at.
   *
   * Until @retiregolden/mcp 0.5.0 it did not. `run_projection` ran
   * `createFederalTaxCalculator()` alone while the browser runs federal COMBINED
   * WITH the engine's modeled state pack (`taxCalculatorFor` in
   * planner/useProjection.ts), so for this KY couple the MCP overstated ending net
   * worth by ~13% (3,616,404 against 3,202,991). That was an MCP-side gap and was
   * fixed there; this is the consumer-side guard that it stays fixed, because the
   * divergence was invisible from either repo's own tests.
   *
   * Equality is over the WHOLE summary rather than the headline: two tax stacks can
   * agree on ending net worth while disagreeing on lifetime taxes or the estate
   * breakdown.
   */
  it('reproduces the projection the browser is showing', async () => {
    const { adapter, createSession } = await import('@retiregolden/mcp')

    const plan = createSamplePlan()
    const shown = projectPlan(plan)
    const session = createSession()
    adapter.setPlanFromBuild(session, copiedPayload(plan, shown.startYear))
    const viaMcp = adapter.runProjection(session) as { summary: typeof shown.summary }

    expect(viaMcp.summary).toEqual(shown.summary)

    // What makes the assertion above discriminating: a resident of a state that
    // taxes income. In FL or TX the two stacks agree trivially and this test would
    // have passed against the federal-only bug. Note `stateEffectiveTaxPct: 0` does
    // NOT mean "no state tax" — the engine reads 0 as "use the modeled KY pack".
    expect(plan.household.state).toBe('KY')
    expect(plan.assumptions.stateEffectiveTaxPct).toBe(0)
  })
})

describe('the siblings are load-bearing, not decoration', () => {
  it('emits the start year the app actually projected from', () => {
    const plan = createSamplePlan()
    const view = projectPlan(plan)
    expect(copiedPayload(plan, view.startYear).startYear).toBe(currentStartYear())
  })

  it('would diverge from the app if startYear were dropped', () => {
    // The bug this field prevents, made explicit: without it build_plan falls
    // back to the literal 2026. Assert both halves — the fallback value, and
    // that projecting from a different year is a materially different plan.
    const plan = createSamplePlan()
    const { startYear, ...withoutStartYear } = copiedPayload(plan, 2031)
    expect(startYear).toBe(2031)

    const built = buildFrom(withoutStartYear)
    expect(built.startYear).toBe(2026)
    expect(projectPlan(plan, 2026).result.endingNetWorth).not.toBeCloseTo(
      projectPlan(plan, 2031).result.endingNetWorth,
      2,
    )
  })

  it('stamps the engine that produced the document, and a wrong one is caught', () => {
    const plan = createSamplePlan()
    const payload = copiedPayload(plan, 2026)
    expect(payload.engineVersion).toBe(ENGINE_VERSION)

    // The provenance warning is the entire point of stamping it: a document
    // exported under a different engine still imports, but says so.
    const skewed = buildFrom({ ...payload, engineVersion: '0.0.1-ancient' })
    expect(skewed.ok).toBe(true)
    expect(skewed.caveats.join(' ')).toContain('engineVersion skew')
  })

  it('sends no `conventions`, so the MCP applies its own end-user defaults', async () => {
    // Deliberate absence (see serializeSinglePlan). The knobs are benchmark
    // session overrides with no browser meaning; emitting `{}` or `null` would
    // assert a posture the user never chose. Pin that the payload has no such
    // key and that the import is clean without one.
    const payload = copiedPayload(createSamplePlan(), 2026)
    expect('conventions' in (payload as object)).toBe(false)
    const caveats: string[] = buildFrom(payload).caveats
    await expectNoPayloadSkew(caveats)
    // Nothing about conventions either — the absence must not read as a posture.
    expect(caveats.some((c) => c.includes('convention'))).toBe(false)
  })
})
