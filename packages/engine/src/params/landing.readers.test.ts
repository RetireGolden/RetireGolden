/**
 * The four readers the PR #768 review found still on the base pack's year,
 * each held to its own publisher when one publisher's 2027 figures land alone
 * (decision D-2027-ROLLOVER; review issues 1 and 7, 2026-09-29).
 *
 * The base pack's year (`packForYear(year).pack.year`, LATEST_PACK_YEAR)
 * stays 2026 however many publishers land 2027, and the income-tax figures'
 * projection factor is 1 in a year the IRS is loaded for. A reader that
 * scaled one publisher's figures by either read them wrong from the first
 * landing on. Each landing below is the maintenance schedule's step 1 for one
 * publisher, through the test seam (`withParameterComponents`,
 * `testing/parameterLanding.ts`): the IRS income-tax figures for 2027 alone,
 * and CMS's Medicare figures for 2027 alone. The landed figures are the 2026
 * ones (with an illustrative $16,500 and $33,000 standard deduction for the
 * IRS), so what moves is only which year each reader grows from.
 *
 * - The widow's-penalty detector prices the survivor's bracket jump on the
 *   IRS figures the ledger uses: loaded ones as they are, not grown again.
 * - The law-pack detector says a year's figures have landed.
 * - The IRMAA tier-edge detector reads Medicare through the CMS component.
 * - The optimizer LP scales its IRMAA thresholds by the CMS component's factor.
 *
 * Each test failed before its reader moved.
 */
import { describe, expect, it } from 'vitest'

import { lawPackDrift } from '../insights/detectors/lawPackDrift.js'
import { irmaaTierEdge } from '../insights/detectors/irmaaTierEdge.js'
import { widowsPenalty } from '../insights/detectors/widowsPenalty.js'
import type { DetectorContext } from '../insights/types.js'
import { formatWholeUsd } from '../internal/evidenceFormat.js'
import type { Plan } from '../model/plan.js'
import { buildOptimizerInput } from '../projection/optimizePlan.js'
import { computeFederalTax } from '../tax/federalTax.js'
import { landedComponents } from '../testing/parameterLanding.js'
import {
  couplePlan,
  productionTaxCalculator,
  singlePersonPlan,
  traditionalAccount,
  cashAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { componentPackView, irmaaTierThreshold, packForYear, withParameterComponents } from './index.js'

const irs2027 = () =>
  landedComponents(['irsIncomeTax'], 2027, {
    'federalTax.standardDeduction': { single: 16_500, marriedFilingJointly: 33_000 },
  })
const cms2027 = () => landedComponents(['cmsMedicare'], 2027)
const INFLATION = 0.025

describe('the widow’s-penalty detector reads the IRS income-tax figures’ own year', () => {
  // A couple whose first survivor year, 2027, files single on $120,000.
  function context(): DetectorContext {
    const plan = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1958-01-01' })
    plan.assumptions.inflationPct = INFLATION * 100
    plan.accounts = [traditionalAccount('trad', 600_000, 'p1')] as never
    const row = (year: number, alive: number, filingStatus: string, magi: number) => ({
      year,
      filingStatus,
      magi,
      irmaaTier: 0,
      balances: { trad: 600_000 },
      people: [
        { personId: 'p1', alive: true, ageAttained: year - 1960 },
        { personId: 'p2', alive: alive === 2, ageAttained: year - 1958 },
      ],
    })
    return {
      plan,
      params: packForYear(2026).pack,
      projection: {
        startYear: 2026,
        result: { years: [row(2026, 2, 'marriedFilingJointly', 0), row(2027, 1, 'single', 120_000), row(2028, 1, 'single', 120_000)] },
        deflate: (_year: number, amount: number) => amount,
      },
    } as unknown as DetectorContext
  }
  /** The survivor bracket jump priced as the ledger would, at `scale`, rounded as the card rounds it. */
  const jumpAt = (scale: number): string => {
    const tax = (filingStatus: 'single' | 'marriedFilingJointly', peopleAged65Plus: number) =>
      computeFederalTax({ year: 2027, filingStatus, ordinaryIncome: 120_000, capitalGains: 0, ssBenefits: 0, peopleAged65Plus, inflationScale: scale }).totalTax
    return formatWholeUsd(Math.round(Math.max(0, tax('single', 1) - tax('marriedFilingJointly', 2))))
  }
  const jumpOnCard = (): string | undefined =>
    widowsPenalty.screen(context())?.evidence.find((entry) => entry.label === 'Estimated survivor bracket jump')?.value

  it('while the IRS figures are projected, grows them at the plan’s inflation', () => {
    expect(jumpOnCard()).toBe(jumpAt(1 + INFLATION))
  })

  it('once the IRS figures for 2027 are loaded, prices them as loaded, not grown a second time', () => {
    withParameterComponents(irs2027(), () => {
      expect(jumpAt(1)).not.toBe(jumpAt(1 + INFLATION))
      expect(jumpOnCard()).toBe(jumpAt(1))
    })
  })

  it('a CMS landing changes nothing it reads', () => {
    const projected = jumpOnCard()
    expect(withParameterComponents(cms2027(), jumpOnCard)).toBe(projected)
  })
})

describe('the law-pack detector says a year’s figures have landed', () => {
  function context(startYear: number, updatedAtIso = '2026-10-15T12:00:00.000Z'): DetectorContext {
    const plan = singlePersonPlan()
    plan.updatedAtIso = updatedAtIso
    return {
      plan,
      params: packForYear(startYear).pack,
      projection: { startYear, result: { years: [] } },
    } as unknown as DetectorContext
  }

  it('a plan saved in 2026 and run from 2027: the loaded 2027 publishers, and the IRS once it lands', () => {
    // Today 2027's HSA limits (Rev. Proc. 2026-24) and its premium tax credit
    // figures (Rev. Proc. 2026-26) are loaded; nothing else is.
    const today = lawPackDrift.screen(context(2027))
    expect(today?.title).toBe('2027 rules need a plan review')
    expect(today?.rationale).toContain('HSA limits and premium tax credit figures now reflect 2027 figures')
    const landed = withParameterComponents(irs2027(), () => lawPackDrift.screen(context(2027)))
    expect(landed?.rationale).toContain('tax brackets, HSA limits, and premium tax credit figures now reflect 2027 figures')
    expect(landed?.evidence).toContainEqual({ label: 'Active parameter year', value: '2027', year: 2027 })
  })

  it('names CMS’s figures when they land', () => {
    const landed = withParameterComponents(cms2027(), () => lawPackDrift.screen(context(2027)))
    expect(landed?.rationale).toContain('HSA limits, Medicare premiums, and premium tax credit figures now reflect 2027 figures')
  })

  it('a plan saved in 2027 and run from 2027 has nothing newer to review', () => {
    expect(withParameterComponents(irs2027(), () => lawPackDrift.screen(context(2027, '2027-02-01T12:00:00.000Z')))).toBeNull()
  })

  it('a plan run from 2026 reads 2026’s figures, whatever 2027’s', () => {
    expect(withParameterComponents(irs2027(), () => lawPackDrift.screen(context(2026)))).toBeNull()
    expect(withParameterComponents(irs2027(), () => lawPackDrift.screen(context(2026, '2025-06-01T12:00:00.000Z')))?.rationale).toContain(
      'brackets, limits, and tables now reflect the 2026 parameter set',
    )
  })
})

describe('the IRMAA tier-edge detector reads Medicare through the CMS component', () => {
  // A 2027 MAGI prices 2029 premiums; the single filer is 73 then.
  const premiumYear = 2029
  const at = (baseYear: number) => ({
    premiumYear,
    inflationFactorToYear: (toYear: number) => Math.pow(1 + INFLATION, Math.max(0, toYear - baseYear)),
    inflationFactorBetween: (fromYear: number, toYear: number) => Math.pow(1 + INFLATION, Math.max(0, toYear - fromYear)),
  })
  /** The first tier's threshold for 2029 premiums, grown from `baseYear`. */
  const threshold = (baseYear: number) => irmaaTierThreshold(packForYear(2026).pack, 0, 'single', at(baseYear))
  function context(magi: number): DetectorContext {
    const plan = singlePersonPlan({ dob: '1956-01-01' })
    plan.assumptions.inflationPct = INFLATION * 100
    const year = (y: number, over: { magi?: number; ages?: number[] } = {}) => ({
      year: y,
      magi: over.magi ?? 0,
      rothConversion: 0,
      people: (over.ages ?? [71]).map((ageAttained, i) => ({ personId: `p${i + 1}`, alive: true, ageAttained })),
    })
    return {
      plan,
      params: packForYear(2027).pack,
      projection: { startYear: 2027, result: { years: [year(2027, { magi }), year(2028), year(premiumYear, { ages: [73] })] } },
    } as unknown as DetectorContext
  }
  // A MAGI $1,000 over the threshold grown from 2027, which is under the one
  // grown from 2026: a card only when the thresholds grow from CMS's 2027.
  const magi = () => threshold(2027) + 1_000

  it('the fixture separates the two base years', () => {
    expect(threshold(2026) - threshold(2027)).toBeGreaterThan(1_000)
  })

  it('while CMS’s figures are projected, grows the thresholds from 2026: no card', () => {
    expect(irmaaTierEdge.screen(context(magi()))).toBeNull()
  })

  it('once CMS’s figures for 2027 are loaded, grows them from 2027: the card names that threshold', () => {
    withParameterComponents(cms2027(), () => {
      expect(componentPackView(packForYear(premiumYear), 'cmsMedicare').year).toBe(2027)
      const card = irmaaTierEdge.screen(context(magi()))
      expect(card?.evidence).toContainEqual({
        label: `IRMAA tier threshold (${premiumYear} premiums)`,
        value: formatWholeUsd(threshold(2027)),
        year: premiumYear,
      })
    })
  })

  it('an IRS landing changes nothing it reads', () => {
    expect(withParameterComponents(irs2027(), () => irmaaTierEdge.screen(context(magi())))).toBeNull()
  })
})

describe('the optimizer LP scales IRMAA by the CMS component’s factor', () => {
  function plan(): Plan {
    const draft = singlePersonPlan({ dob: '1958-06-15', planningAge: 75 })
    draft.id = 'lp-irmaa-landing'
    draft.assumptions.inflationPct = INFLATION * 100
    draft.accounts = [traditionalAccount('ira', 900_000, 'p1', 'ira'), cashAccount('cash', 100_000)]
    return validatePlan(draft)
  }
  const year2027 = () =>
    buildOptimizerInput(plan(), { startYear: 2027, taxCalculator: productionTaxCalculator() }).years.find((y) => y.year === 2027)!

  it('while every publisher is projected, both factors are the plan’s inflation', () => {
    expect(year2027().inflationScale).toBeCloseTo(1 + INFLATION, 12)
  })

  it('CMS’s 2027 figures loaded: the IRMAA factor is 1', () => {
    expect(withParameterComponents(cms2027(), year2027).inflationScale).toBe(1)
  })

  it('the IRS’s 2027 figures loaded alone: the IRMAA factor still grows CMS’s 2026 figures', () => {
    withParameterComponents(irs2027(), () => {
      const year = year2027()
      expect(year.pack.federalTax.standardDeduction.single).toBe(16_500)
      expect(year.inflationScale).toBeCloseTo(1 + INFLATION, 12)
    })
  })
})
