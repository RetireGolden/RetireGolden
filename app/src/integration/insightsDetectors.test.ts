import { describe, expect, it } from 'vitest'
import { createSamplePlan } from '../testSupport/samplePlan'
import { projectPlan, taxCalculatorFor } from '../planner/useProjection'
import { packForYear } from '@retiregolden/engine/params'
import { applyScenarioPatch, compareScenarios } from '@retiregolden/engine/scenarios/scenarios'
import { getArticle, isReadable } from '../learn/learningRegistry'
import { incomeFloorFunded } from '@retiregolden/engine/insights/detectors/incomeFloorFunded'
import { rothBridgeHeadroom } from '@retiregolden/engine/insights/detectors/rothBridgeHeadroom'
import { ssBridgeGap } from '@retiregolden/engine/insights/detectors/ssBridgeGap'
import { irmaaTierEdge } from '@retiregolden/engine/insights/detectors/irmaaTierEdge'
import { qcdEfficiency } from '@retiregolden/engine/insights/detectors/qcdEfficiency'
import { widowsPenalty } from '@retiregolden/engine/insights/detectors/widowsPenalty'
import { stateRelocation } from '@retiregolden/engine/insights/detectors/stateRelocation'
import { assetLocation } from '@retiregolden/engine/insights/detectors/assetLocation'
import { spendingGuardrails } from '@retiregolden/engine/insights/detectors/spendingGuardrails'
import { spendingHeadroom } from '@retiregolden/engine/insights/detectors/spendingHeadroom'
import { assetLocationGenerator, probabilityBandSpendingGuardrailGenerator } from '@retiregolden/engine/decisions/generators'
import { createDecisionContext, evaluateCandidate } from '@retiregolden/engine/decisions/evaluateCandidate'
import type { DecisionContext } from '@retiregolden/engine/decisions/types'
import { assetLocationPlan, noTraditionalPlan, simOptions } from '@retiregolden/engine/decisions/decisionFixtures'
import { runSpendingSolveRequest } from '../optimize/runSpendingSolve'
import type { Plan } from '@retiregolden/engine/model/plan'
import type { DetectorContext, InsightCard } from '@retiregolden/engine/insights/types'

function makeContext(plan: Plan): DetectorContext {
  const proj = projectPlan(plan, 2026)
  const lookup = packForYear(2026)
  return {
    plan,
    projection: {
      result: proj.result,
      summary: proj.summary,
      startYear: proj.startYear,
      deflate: proj.deflate,
    },
    params: lookup.pack,
  }
}

function expectReadableLearnSlug(card: InsightCard): void {
  expect(card.learnSlug, `${card.id} learnSlug`).toBeDefined()
  const article = getArticle(card.learnSlug!)
  expect(article, card.learnSlug).toBeDefined()
  expect(article ? isReadable(article) : false, card.learnSlug).toBe(true)
}

function comparePreviewScenario(plan: Plan, card: InsightCard) {
  expect(card.action.kind, card.id).toBe('preview-scenario')
  if (card.action.kind !== 'preview-scenario') {
    throw new Error(`${card.id} did not produce a preview scenario`)
  }

  const applied = applyScenarioPatch(plan, card.action.patch)
  expect(applied.ok, applied.ok ? undefined : applied.issues.join('; ')).toBe(true)

  const comparison = compareScenarios(
    plan,
    { startYear: 2026, taxCalculator: taxCalculatorFor(plan) },
    [{ id: `${card.id}-preview`, name: card.action.scenarioName, patch: card.action.patch }],
  )
  const base = comparison.rows[0]!
  const scenario = comparison.rows[1]!
  expect(scenario.error).toBeNull()
  expect(Number.isFinite(scenario.summary.endingAfterTaxEstate)).toBe(true)
  return { base, scenario }
}

describe('starter detectors', () => {
  it('T1: rothBridgeHeadroom fires on retired years with traditional assets', () => {
    const plan = createSamplePlan()
    // By default, rothConversion is fillToTarget in sample plan, so T1 shouldn't fire
    const ctx1 = makeContext(plan)
    expect(rothBridgeHeadroom.screen(ctx1)).toBeNull()

    // Disable conversions and retire people immediately to trigger
    plan.strategies.rothConversion = { mode: 'none' }
    plan.incomes = plan.incomes.map((inc) => {
      if (inc.type === 'wages') {
        return { ...inc, annualGross: 0 } // retired
      }
      return inc
    })
    const ctx2 = makeContext(plan)
    const card = rothBridgeHeadroom.screen(ctx2)
    expect(card).not.toBeNull()
    expect(card!.id).toBe('roth-bridge-headroom')
    expect(card!.action.kind).toBe('preview-scenario')
    expect(card!.confidence).toBe('medium')
    expectReadableLearnSlug(card!)
    const { base, scenario } = comparePreviewScenario(plan, card!)
    expect(scenario.summary.lifetimeRothConversions).toBeGreaterThan(base.summary.lifetimeRothConversions)
  })

  it('T1: rothBridgeHeadroom ignores inherited-only traditional assets', () => {
    const plan = createSamplePlan()
    plan.strategies.rothConversion = { mode: 'none' }
    plan.incomes = plan.incomes.map((inc) => (inc.type === 'wages' ? { ...inc, annualGross: 0 } : inc))
    plan.accounts = plan.accounts.map((account) =>
      account.type === 'traditional'
        ? { ...account, inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false } }
        : account,
    )

    expect(rothBridgeHeadroom.screen(makeContext(plan))).toBeNull()
  })

  it('T2: irmaaTierEdge fires when MAGI is slightly above an IRMAA tier boundary', () => {
    const plan = createSamplePlan()
    const ctx = makeContext(plan)

    // Artificially modify projection MAGI in first year to sit $1000 over the
    // indexed IRMAA threshold that will apply to premiums two years later.
    const filingStatus = plan.household.filingStatus
    const premiumYear = ctx.projection.result.years[0]!.year + 2
    const thresholdScale = Math.pow(1 + plan.assumptions.inflationPct / 100, premiumYear - ctx.params.year)
    const threshold = ctx.params.medicare.irmaaTiers[0]!.magiOver[filingStatus] * thresholdScale
    ctx.projection.result.years[0]!.magi = threshold + 1000
    ctx.projection.result.years[0]!.rothConversion = 5000

    const card = irmaaTierEdge.screen(ctx)
    expect(card).not.toBeNull()
    expect(card!.id).toBe('irmaa-tier-edge')
    expect(card!.rationale).toContain('nominal MAGI')
    expect(card!.action.kind).toBe('preview-scenario')
    expectReadableLearnSlug(card!)
    const { base, scenario } = comparePreviewScenario(plan, card!)
    expect(scenario.summary.lifetimeRothConversions).toBeLessThan(base.summary.lifetimeRothConversions)
  })

  it('T2b: irmaaTierEdge scales the IRMAA threshold by inflation and ignores the unindexed base', () => {
    const plan = createSamplePlan()
    // Pin a positive inflation rate so the indexed threshold that applies two
    // years later sits clearly above the unindexed base. The test must not
    // depend on createSamplePlan()'s default inflation.
    plan.assumptions.inflationPct = 3
    const ctx = makeContext(plan)
    const filingStatus = plan.household.filingStatus

    const year0 = ctx.projection.result.years[0]!
    const thresholdScale = Math.pow(1 + plan.assumptions.inflationPct / 100, year0.year + 2 - ctx.params.year)
    const unindexedThreshold = ctx.params.medicare.irmaaTiers[0]!.magiOver[filingStatus]
    const indexedThreshold = unindexedThreshold * thresholdScale

    for (const year of ctx.projection.result.years) {
      year.magi = 0
      year.rothConversion = 0
    }
    // MAGI sits $1000 over the unindexed base but well under the indexed
    // threshold that actually applies, so a correct detector must not fire —
    // while a regressed one comparing to the unindexed base would.
    const magi = unindexedThreshold + 1000
    expect(magi).toBeLessThan(indexedThreshold)
    year0.magi = magi
    year0.rothConversion = 5000

    expect(irmaaTierEdge.screen(ctx)).toBeNull()
  })

  it('W2: qcdEfficiency fires for age 71+ with charity and trad assets', () => {
    const plan = createSamplePlan()
    
    // Default has no itemized deductions, so shouldn't fire
    const ctx1 = makeContext(plan)
    expect(qcdEfficiency.screen(ctx1)).toBeNull()

    // Add charity, ensure age-eligible, and traditional assets exist
    plan.strategies.itemizedDeductions = {
      charitable: 5000,
      stateAndLocalTaxes: 0,
      mortgageInterest: 0,
    }
    // Alex born 1962 (age 64 in 2026), let's make him born 1950 (age 76 in 2026)
    plan.household.people[0]!.dob = '1950-01-01'

    const ctx2 = makeContext(plan)
    const card = qcdEfficiency.screen(ctx2)
    expect(card).not.toBeNull()
    expectReadableLearnSlug(card!)
    const action = card!.action
    if (action.kind === 'preview-scenario') {
      const strategies = action.patch.strategies as { qcdAnnual: number }
      expect(strategies.qcdAnnual).toBe(5000)
    }
    const { base, scenario } = comparePreviewScenario(plan, card!)
    expect(scenario.summary.lifetimeTaxesAndPenalties).toBeLessThanOrEqual(base.summary.lifetimeTaxesAndPenalties)
  })

  it('S3: widowsPenalty fires on couples with a survivor phase and pre-tax assets', () => {
    const plan = createSamplePlan()
    
    // By default conversions are enabled, so it shouldn't fire
    const ctx1 = makeContext(plan)
    expect(widowsPenalty.screen(ctx1)).toBeNull()

    // Disable conversions, ensure one person dies early
    plan.strategies.rothConversion = { mode: 'none' }
    plan.household.people[0]!.longevity.planningAge = 70
    plan.household.people[1]!.longevity.planningAge = 90

    const ctx2 = makeContext(plan)
    const card = widowsPenalty.screen(ctx2)
    expect(card).not.toBeNull()
    expect(card!.id).toBe('widows-penalty-roth')
    expectReadableLearnSlug(card!)
    const { base, scenario } = comparePreviewScenario(plan, card!)
    expect(scenario.summary.lifetimeRothConversions).toBeGreaterThan(base.summary.lifetimeRothConversions)
  })

  it('S3: widowsPenalty quantifies the survivor bracket jump and points at SSA-44 when relevant', () => {
    const plan = createSamplePlan()
    plan.strategies.rothConversion = { mode: 'none' }
    plan.household.people[0]!.longevity.planningAge = 68 // born 1962 → last year alive 2030
    plan.household.people[1]!.longevity.planningAge = 95
    // A 100%-survivor pension is the classic widow's-penalty shape: household
    // income barely falls while the brackets, deduction, and IRMAA thresholds
    // halve — so the survivor-window premiums land in a surcharge tier and the
    // bracket jump on the survivor's own income is real money.
    plan.accounts.push({
      type: 'pension',
      id: 'pen-widow-test',
      name: 'Pension',
      ownerPersonId: plan.household.people[0]!.id,
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 11_000,
      colaPct: 0,
      survivorPct: 100,
    })
    const card = widowsPenalty.screen(makeContext(plan))
    expect(card).not.toBeNull()
    // Quantified on the plan's own survivor year, not just described — with
    // the death projected in the last joint year, not the first single year.
    expect(card!.rationale).toContain("more (today's $)")
    expect(card!.rationale).toContain('passes away (projected in 2030)')
    expect(card!.rationale).toContain('SSA-44')

    // Once the plan models the relief there is nothing left to point at.
    plan.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const modeled = widowsPenalty.screen(makeContext(plan))
    expect(modeled).not.toBeNull()
    expect(modeled!.rationale).not.toContain('SSA-44')

    // With the QSS opt-in, the interlude keeps joint tables: the story names
    // qualifying surviving spouse and the jump is priced on the first year
    // that truly files single.
    delete plan.expenses.healthcare.ssa44
    plan.household.hasQualifyingDependent = true
    const qss = widowsPenalty.screen(makeContext(plan))
    expect(qss).not.toBeNull()
    expect(qss!.rationale).toContain('qualifying surviving spouse')
    expect(qss!.rationale).toContain('as Single from 2033')
  })

  it('L1: stateRelocation fires when currently residing in taxable state', () => {
    const plan = createSamplePlan()
    // Starting state is KY (has income tax)
    const ctx1 = makeContext(plan)
    const card = stateRelocation.screen(ctx1)
    expect(card).not.toBeNull()
    expect(card!.id).toBe('state-relocation')
    expectReadableLearnSlug(card!)
    const action = card!.action
    if (action.kind === 'preview-scenario') {
      const household = action.patch.household as { stateMoves: Array<{ state: string }> }
      expect(household.stateMoves[0]?.state).toBe('FL')
    }
    const { base, scenario } = comparePreviewScenario(plan, card!)
    expect(scenario.summary.lifetimeTaxesAndPenalties).toBeLessThanOrEqual(base.summary.lifetimeTaxesAndPenalties)

    // Move starting state to FL (no tax) -> shouldn't fire
    plan.household.state = 'FL'
    const ctx2 = makeContext(plan)
    expect(stateRelocation.screen(ctx2)).toBeNull()
  })

  it('L1: stateRelocation evaluate() quantifies lifetime state-tax drag via the compare sweep', () => {
    const plan = createSamplePlan()
    const ctx = makeContext(plan)
    const exact = stateRelocation.evaluate!(ctx)
    expect(exact.action.kind).toBe('preview-scenario')
    if (exact.action.kind !== 'preview-scenario') return
    // The preview previews the sweep's top zero-income-tax candidate as a
    // split-year move this year, using the shared relocation patch builder.
    const household = exact.action.patch.household as { stateMoves: Array<{ fromYear: number; state: string }> }
    expect(['FL', 'TX', 'WA']).toContain(household.stateMoves[0]!.state)
    expect(household.stateMoves[0]!.fromYear).toBe(2026)
    expect(exact.action.scenarioName).toContain(household.stateMoves[0]!.state)
    // KY levies income tax; the quantified state+local drag lands in the
    // qualitative line (the preview grid's numeric deltas come from the
    // shared evaluator on the total-tax basis, so no numerics here).
    expect(exact.impact).toBeDefined()
    expect(exact.impact!.lifetimeTaxDelta).toBeUndefined()
    expect(exact.impact!.qualitative).toContain('lifetime state+local income tax')
    expect(exact.impact!.qualitative).toContain('one relocation factor')
    const applied = applyScenarioPatch(plan, exact.action.patch)
    expect(applied.ok).toBe(true)
  })

  it('L1: stateRelocation still respects its original screen conditions', () => {
    const plan = createSamplePlan()
    // Planned moves suppress the card.
    plan.household.stateMoves = [{ fromYear: 2030, fromMonth: 7, state: 'FL' }]
    expect(stateRelocation.screen(makeContext(plan))).toBeNull()
    // A tax-free state without a flat override suppresses it too.
    const taxFree = createSamplePlan()
    taxFree.household.state = 'TX'
    taxFree.assumptions.stateEffectiveTaxPct = 0
    expect(stateRelocation.screen(makeContext(taxFree))).toBeNull()
  })

  it('R3: spendingGuardrails fires on plans with substantial assets', () => {
    const plan = createSamplePlan()
    const ctx = makeContext(plan)
    const card = spendingGuardrails.screen(ctx)
    expect(card).not.toBeNull()
    expect(card!.id).toBe('spending-guardrails')
    expect(card!.action.kind).toBe('preview-scenario')
    expectReadableLearnSlug(card!)
    if (card!.action.kind === 'preview-scenario') {
      expect(card!.action.patch).toMatchObject({
        expenses: {
          spendingPolicy: { mode: 'withdrawalRateGuardrails' },
        },
      })
    }
  })

  it('R3: spendingGuardrails patch matches probabilityBandSpendingGuardrailGenerator', () => {
    const plan = createSamplePlan()
    const ctx = makeContext(plan)
    const card = spendingGuardrails.screen(ctx)
    expect(card).not.toBeNull()
    if (card?.action.kind !== 'preview-scenario') throw new Error('expected preview scenario')

    const generated = probabilityBandSpendingGuardrailGenerator().generate({ plan } as DecisionContext)
    expect(generated).toHaveLength(1)
    expect(card.action.patch).toEqual(generated[0]!.planPatch)
  })
})

describe('assetLocation detector (asset-allocation v2, step 5)', () => {
  it('screens in on plans with static allocation and swappable class exposure', () => {
    const plan = assetLocationPlan()
    const ctx = makeContext(plan)
    const card = assetLocation.screen(ctx)
    expect(card).not.toBeNull()
    expect(card!.id).toBe('asset-location')
    expect(card!.action.kind).toBe('preview-scenario')
    expectReadableLearnSlug(card!)
    if (card!.action.kind === 'preview-scenario') {
      expect(card!.action.patch).toHaveProperty('accounts')
    }
  })

  it('screens out plans without class-level allocation', () => {
    expect(assetLocation.screen(makeContext(noTraditionalPlan()))).toBeNull()
  })

  it('evaluate() previews the exact-ledger winner from assetLocationGenerator', () => {
    const plan = assetLocationPlan()
    const ctx = makeContext(plan)
    const evaluated = assetLocation.evaluate!(ctx)
    expect(evaluated.action.kind).toBe('preview-scenario')
    if (evaluated.action.kind !== 'preview-scenario') throw new Error('expected preview scenario')

    const decisionCtx = createDecisionContext(plan, simOptions(), {
      result: ctx.projection.result,
      summary: ctx.projection.summary,
    })
    const candidates = assetLocationGenerator.generate(decisionCtx)
    const beneficial = candidates
      .map((candidate) => ({ candidate, evaluation: evaluateCandidate(decisionCtx, candidate) }))
      .filter((row) => row.evaluation.recommendationState === 'beneficial')
      .sort((a, b) => b.evaluation.deltas.endingAfterTaxEstate - a.evaluation.deltas.endingAfterTaxEstate)
    expect(beneficial.length).toBeGreaterThan(0)
    expect(evaluated.action.patch).toEqual(beneficial[0]!.candidate.planPatch)
    expect(evaluated.impact).toBeDefined()
    expect(evaluated.impact!.endingAfterTaxEstateDelta).toBeGreaterThan(0)

    const applied = applyScenarioPatch(plan, evaluated.action.patch)
    expect(applied.ok).toBe(true)
  })
})

describe('SS bridge + income floor detectors (social-security-bridge-and-tips-ladder, step 4)', () => {
  /** Retire before the SS claim with liquid savings: the classic bridge shape. */
  function bridgePlan(): Plan {
    const plan = createSamplePlan()
    plan.household.people[0]!.dob = '1964-06-15' // 62 in 2026
    plan.household.people[0]!.retirementAge = 62
    plan.incomes = plan.incomes.map((inc) =>
      inc.type === 'socialSecurity' && inc.personId === plan.household.people[0]!.id
        ? { ...inc, piaMonthly: 2_400, earnings: null, claimAge: { years: 70, months: 0 } }
        : inc.type === 'wages'
          ? { ...inc, annualGross: 0 }
          : inc,
    )
    return plan
  }

  it('ssBridgeGap fires on delayed claims with unfunded gap years, previewing a sized bridge', () => {
    const plan = bridgePlan()
    const card = ssBridgeGap.screen(makeContext(plan))
    expect(card).not.toBeNull()
    expect(card!.id).toBe('ss-bridge-gap')
    expectReadableLearnSlug(card!)
    const { scenario } = comparePreviewScenario(plan, card!)
    expect(scenario.error).toBeNull()
    if (card!.action.kind === 'preview-scenario') {
      const floor = card!.action.patch.incomeFloor as { ladders: Array<{ purpose: string; startYear: number }> }
      expect(floor.ladders.some((l) => l.purpose === 'bridge')).toBe(true)
    }
  })

  it('ssBridgeGap stays silent when the gap is already covered by a plan ladder', () => {
    const plan = bridgePlan()
    const cashAccount = plan.accounts.find((a) => a.type === 'cash' || a.type === 'taxable')!
    plan.incomeFloor = {
      ladders: [
        {
          id: 'lad1',
          name: 'Bridge',
          purpose: 'bridge',
          startYear: 2027,
          endYear: 2033,
          annualRealAmount: 20_000,
          purchase: { year: 2026, fundingAccountId: cashAccount.id },
        },
      ],
    }
    expect(ssBridgeGap.screen(makeContext(plan))).toBeNull()
  })

  it('ssBridgeGap still fires when a ladder ends one year short of the gap', () => {
    const plan = bridgePlan()
    const cashAccount = plan.accounts.find((a) => a.type === 'cash' || a.type === 'taxable')!
    plan.incomeFloor = {
      ladders: [
        {
          id: 'lad1',
          name: 'Bridge',
          purpose: 'bridge',
          startYear: 2027,
          endYear: 2032, // gap runs through 2033 — one uncovered year remains
          annualRealAmount: 20_000,
          purchase: { year: 2026, fundingAccountId: cashAccount.id },
        },
      ],
    }
    expect(ssBridgeGap.screen(makeContext(plan))).not.toBeNull()
  })

  it('incomeFloorFunded reports the funded ratio when a required floor is set and underfunded', () => {
    const plan = createSamplePlan()
    plan.expenses.requiredAnnual = Math.min(plan.expenses.baseAnnual, 60_000)
    const card = incomeFloorFunded.screen(makeContext(plan))
    expect(card).not.toBeNull()
    expect(card!.id).toBe('income-floor-funded')
    expect(card!.action.kind).toBe('advisory')
    expect(card!.title).toMatch(/\d+% funded/)
    expectReadableLearnSlug(card!)
  })

  it('incomeFloorFunded stays silent without a required floor distinction', () => {
    const plan = createSamplePlan()
    plan.expenses.requiredAnnual = undefined
    expect(incomeFloorFunded.screen(makeContext(plan))).toBeNull()
  })
})

describe('spendingHeadroom detector (sustainable-spending plan, Step 6)', () => {
  /** Big surplus: modest spending against a large flat-return cash+taxable base. */
  function surplusPlan(): Plan {
    const plan = noTraditionalPlan()
    plan.expenses.baseAnnual = 20_000
    plan.accounts = plan.accounts.map((a) => (a.type === 'cash' ? { ...a, balance: 1_000_000 } : a))
    return plan
  }

  it('screens in on never-depleting plans with a large excess estate — with a rough, preview-scenario card', () => {
    const ctx = makeContext(surplusPlan())
    const card = spendingHeadroom.screen(ctx)
    expect(card).not.toBeNull()
    expect(card!.id).toBe('spending-headroom')
    expect(card!.exact).toBe(false)
    expect(card!.action.kind).toBe('preview-scenario')
    expectReadableLearnSlug(card!)
  })

  it('screens out depleting plans and plans without meaningful excess over the bequest target', () => {
    const overspending = surplusPlan()
    overspending.expenses.baseAnnual = 120_000 // depletes
    expect(spendingHeadroom.screen(makeContext(overspending))).toBeNull()

    const targeted = surplusPlan()
    targeted.expenses.bequestTargetDollars = 5_000_000 // excess below threshold
    expect(spendingHeadroom.screen(makeContext(targeted))).toBeNull()
  })

  it('evaluate() solves the exact level and agrees with the "How much can I spend?" surface', () => {
    const plan = surplusPlan()
    const ctx = makeContext(plan)
    const evaluated = spendingHeadroom.evaluate!(ctx)
    expect(evaluated.action.kind).toBe('preview-scenario')
    if (evaluated.action.kind !== 'preview-scenario') throw new Error('expected preview scenario')

    // Card ⇄ Optimize agreement: both run the solver with the same fixed budget.
    const surface = runSpendingSolveRequest({ plan, startYear: 2026 })
    const patchedExpenses = evaluated.action.patch.expenses as { baseAnnual: number }
    expect(patchedExpenses.baseAnnual).toBe(surface.maxBaseAnnual)

    // The solved-level patch previews cleanly through the scenario pipeline.
    const applied = applyScenarioPatch(plan, evaluated.action.patch)
    expect(applied.ok).toBe(true)
  })
})
