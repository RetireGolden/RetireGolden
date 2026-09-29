/**
 * Plan schema v5 -> v6 (decision D-EXAMPLE-SOURCE-SWITCH, 2026-09-28): a plan
 * saved from a library example carries the example recipe's premium-credit
 * contracts as fixed dollars; v6 rewrites the ones the recipe wrote to
 * 'premiumField' and reports it. Only a v5 document with `exampleSourceId` is
 * touched. The dollars are compared to half a cent: a contract is the
 * recipe's only when its amount is the premium field times one growth factor
 * per plan to the power of the years since 2026, the factor fitting at least
 * two contracts (review finding M1; PR #761 review 9). A contract from the
 * recipe that no longer matched the plan's premium is removed, as the v5
 * engine left it out, and the figures do not change (PR #761 review 2). An
 * unedited converted plan projects to the same figures to the cent.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, CURRENT_PLAN_SCHEMA_VERSION, type Plan } from './plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { cashAccount, productionTaxCalculator, recurringOrdinaryIncome } from '../testing/planFixtures.js'
import { migratePlanToCurrent, migratePlanV5ToV6 } from './migrations.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'

const fixedNow = () => new Date('2026-06-29T12:00:00.000Z')
let counter = 0
const ids = () => `v6-${++counter}`

const FACTS = {
  taxExemptInterest: { state: 'notApplicable', amount: null },
  foreignExclusionAddback: { state: 'notApplicable', amount: null },
  assertions: {
    coverageEligibility: 'supported',
    form8814: 'notApplicable',
    specialAllocation: 'notApplicable',
    marriedFilingSeparatelyException: 'notApplicable',
    selfEmployedHealthInsuranceDeduction: 'notApplicable',
    otherMaterialFacts: 'none',
  },
}

/**
 * The example recipe as the planner wrote it before v6 (buildContext.ts
 * parseExamplePlan at origin/main d6d61e3d): one contract per year from 2026
 * with someone covered, premium = premium field x (1 + inflation +
 * extra)^(year - 2026), for the people alive by planning age.
 */
function recipeContracts(plan: Plan): Record<string, unknown>[] {
  const g = (plan.assumptions.inflationPct + plan.assumptions.healthcareExtraInflationPct) / 100
  const end = Math.max(...plan.household.people.map((p) => Number(p.dob.slice(0, 4)) + p.longevity.planningAge))
  const out: Record<string, unknown>[] = []
  for (let year = 2026; year <= end; year++) {
    const living = plan.household.people.filter((p) => year - Number(p.dob.slice(0, 4)) <= p.longevity.planningAge)
    const covered = living
      .map((p) => {
        const age = year - Number(p.dob.slice(0, 4))
        return { p, months: age < 65 ? 12 : age === 65 ? Number(p.dob.slice(5, 7)) - 1 : 0 }
      })
      .filter((c) => c.months > 0)
    if (covered.length === 0) continue
    const premium = plan.expenses.healthcare.pre65MonthlyPremiumPerPerson * Math.pow(1 + g, year - 2026)
    const row = (months: number) => Array.from({ length: 12 }, (_, m) => (m < months ? premium : 0))
    out.push({
      year,
      fplRegion: 'contiguous',
      taxFamilyMembers: living.map((p, i) => ({ personId: p.id, relationship: i === 0 ? 'primary' : 'spouse', requiredToFile: 'required', magi: 0 })),
      coveredMembers: covered.map(({ p, months }) => ({ personId: p.id, enrollmentPremiumByMonth: row(months), slcspBenchmarkPremiumByMonth: row(months) })),
      ...structuredClone(FACTS),
    })
  }
  return out
}

/** A couple retiring early on Marketplace coverage, as an example would be saved at v5. */
function couple(): Plan {
  const plan = createEmptyPlan({ newId: ids, now: fixedNow })
  plan.household.state = 'CO'
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: 'a', name: 'Alex', dob: '1968-04-02', sex: 'average', retirementAge: 58, longevity: { planningAge: 90, source: 'manual' } },
    { id: 'b', name: 'Blair', dob: '1963-09-15', sex: 'average', retirementAge: 58, longevity: { planningAge: 90, source: 'manual' } },
  ]
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.healthcareExtraInflationPct = 2
  plan.accounts = [cashAccount('cash', 900_000)]
  plan.incomes = [recurringOrdinaryIncome('consulting', 40_000)]
  plan.expenses.baseAnnual = 50_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 900, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

function rawV5(plan: Plan, exampleSourceId: string | null): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
  raw['schemaVersion'] = 5
  if (exampleSourceId === null) delete raw['exampleSourceId']
  else raw['exampleSourceId'] = exampleSourceId
  ;(raw['expenses'] as { healthcare: Record<string, unknown> }).healthcare['acaYears'] = recipeContracts(plan)
  return raw
}

const contractsOf = (raw: Record<string, unknown>) =>
  (raw['expenses'] as { healthcare: { acaYears: Record<string, unknown>[] } }).healthcare.acaYears

describe('migratePlanV5ToV6', () => {
  it('rewrites every recipe-shaped contract of a saved example to premiumField, keeping only its year and facts', () => {
    const raw = rawV5(couple(), 'early-retiree-aca')
    const before = contractsOf(raw)
    // Alex (1968) is covered 2026-2033, Blair (1963) 2026-2028 (8 months in
    // 2028, the year of 65 with a September birthday): 8 contract years.
    expect(before.map((c) => c['year'])).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033])
    const migrated = contractsOf(migratePlanV5ToV6(raw))
    expect(migrated).toEqual(before.map((c) => ({ year: c['year'], premiumBasis: 'premiumField', ...FACTS })))
  })

  // Review finding M1: the dollars are compared. A contract is the recipe's
  // only when its amount is the premium field x g^(year - 2026) to half a
  // cent, for one growth factor g per plan.
  const setAmount = (contract: Record<string, unknown>, amount: number) => {
    for (const member of contract['coveredMembers'] as Record<string, number[]>[]) {
      member['enrollmentPremiumByMonth'] = member['enrollmentPremiumByMonth']!.map((v) => (v > 0 ? amount : 0))
      member['slcspBenchmarkPremiumByMonth'] = member['slcspBenchmarkPremiumByMonth']!.map((v) => (v > 0 ? amount : 0))
    }
  }
  // Each stored contract's fate, in stored order: its basis after the
  // migration, or 'removed' when the migration took it out (review 2).
  const bases = (raw: Record<string, unknown>) => {
    const migrated = contractsOf(migratePlanV5ToV6(raw)) ?? []
    return contractsOf(raw).map((stored) => {
      const after = migrated.find((contract) => contract['year'] === stored['year'])
      return after === undefined ? 'removed' : (after['premiumBasis'] ?? 'stated')
    })
  }
  const removalsOf = (raw: Record<string, unknown>) =>
    (migratePlanV5ToV6(raw)['expenses'] as { healthcare: { acaYearsRemoved?: unknown } }).healthcare.acaYearsRemoved

  it('never takes a contract with the dollars of a quote for the recipe', () => {
    // Review finding M1: a quote of $1,150 a month for both members in 2026,
    // benchmark equal to enrollment, has the recipe's shape but not its
    // dollars ($900), so it is not rewritten to follow the premium field. It
    // does not match the plan's premium, so the v5 engine was leaving it out
    // (PR #761 review 2): the migration removes it and records why.
    const quote = rawV5(couple(), 'early-retiree-aca')
    setAmount(contractsOf(quote)[0]!, 1_150)
    expect(bases(quote)).toEqual(['removed', ...new Array<string>(7).fill('premiumField')])
    expect(removalsOf(quote)).toEqual([{ edit: 'exampleNoLongerMatched', years: [2026] }])
    // A later year at $1,400: the factor read off it alone
    // ((1,400 / 900)^(1/1)) fits no other year, so it is not the plan's.
    const later = rawV5(couple(), 'early-retiree-aca')
    setAmount(contractsOf(later)[1]!, 1_400)
    expect(bases(later)).toEqual(['premiumField', 'removed', ...new Array<string>(6).fill('premiumField')])
  })

  it('recognises the recipe after an inflation edit, but not after a premium edit', () => {
    // Inflation raised from 2.5 to 3.5 percent after saving: the stored rates
    // no longer fit, but every contract after 2026 agrees on 1.045.
    const inflation = rawV5(couple(), 'early-retiree-aca')
    ;(inflation['assumptions'] as Record<string, number>)['inflationPct'] = 3.5
    expect(bases(inflation).every((basis) => basis === 'premiumField')).toBe(true)
    // The premium field edited to $1,300 in the file after saving: the 2026
    // contract is not $1,300, and no one factor takes $1,300 to the later
    // years' amounts, so none of them is the recipe's; none matches the
    // premium, so the v5 engine left them all out, and the migration removes
    // them (review 2).
    const premium = rawV5(couple(), 'early-retiree-aca')
    ;(premium['expenses'] as { healthcare: Record<string, number> }).healthcare['pre65MonthlyPremiumPerPerson'] = 1_300
    expect(bases(premium).every((basis) => basis === 'removed')).toBe(true)
  })

  it('needs two contracts to agree on a factor, the plan rates included (PR #761 review 9)', () => {
    // The premium field edited to $1,300 after saving, and one later contract
    // that happens to be $1,300 grown one year at the plan's rates (1.045):
    // $1,358.50 in 2027. It is the only later contract the stored rates fit,
    // and six others do not, so the rates do not qualify as the recipe's
    // factor. The v5 engine priced that contract as written (it is the premium
    // field grown at the stored rates), so it becomes 'premiumField' all the
    // same (PR #761 second review); the others no longer matched and are
    // removed.
    const coincidence = rawV5(couple(), 'early-retiree-aca')
    ;(coincidence['expenses'] as { healthcare: Record<string, number> }).healthcare['pre65MonthlyPremiumPerPerson'] = 1_300
    setAmount(contractsOf(coincidence)[1]!, 1_300 * 1.045)
    expect(bases(coincidence)).toEqual(['removed', 'premiumField', ...new Array<string>(6).fill('removed')])
    // With a single contract after 2026 the stored rates alone qualify, by
    // fitting it: a saved example covered in 2026 and 2027 only.
    const twoYears = rawV5(couple(), 'early-retiree-aca')
    const healthcare = (twoYears['expenses'] as { healthcare: Record<string, unknown> }).healthcare
    healthcare['acaYears'] = contractsOf(twoYears).slice(0, 2)
    expect(bases(twoYears)).toEqual(['premiumField', 'premiumField'])
  })

  it('compares the dollars to half a cent', () => {
    // 2026 must equal the premium field, $900: $900.004 is the recipe's,
    // $900.006 is not.
    const within = rawV5(couple(), 'early-retiree-aca')
    setAmount(contractsOf(within)[0]!, 900.004)
    expect(bases(within)[0]).toBe('premiumField')
    // $900.006 is not, and the v5 engine left it out at the same half cent.
    const outside = rawV5(couple(), 'early-retiree-aca')
    setAmount(contractsOf(outside)[0]!, 900.006)
    expect(bases(outside)[0]).toBe('removed')
    // 2027 at the plan's factor: 900 x 1.045 = 940.5.
    const later = rawV5(couple(), 'early-retiree-aca')
    setAmount(contractsOf(later)[1]!, 940.5 + 0.006)
    expect(bases(later)[1]).toBe('removed')
    // A zero premium in the covered months is not the recipe's, even in every
    // year after 2026, where the one factor that fits them all would be 0.
    const zero = rawV5(couple(), 'early-retiree-aca')
    for (const contract of contractsOf(zero).slice(1)) setAmount(contract, 0)
    expect(bases(zero)).toEqual(['premiumField', ...new Array<string>(7).fill('removed')])
    // The recipe wrote no year before 2026: a 2025 contract with its shape at
    // the premium field deflated by the plan's factor (900 / 1.045) is stated.
    const earlier = rawV5(couple(), 'early-retiree-aca')
    contractsOf(earlier).unshift({ ...structuredClone(contractsOf(earlier)[0]!), year: 2025 })
    setAmount(contractsOf(earlier)[0]!, 900 / 1.045)
    expect(bases(earlier)).toEqual(['stated', ...new Array<string>(8).fill('premiumField')])
  })

  it('checks each part of the shape of the recipe', () => {
    const variant = (edit: (contracts: Record<string, unknown>[]) => void, planEdit?: (plan: Plan) => void) => {
      const plan = couple()
      planEdit?.(plan)
      const raw = rawV5(plan, 'early-retiree-aca')
      edit(contractsOf(raw))
      return bases(raw)
    }
    const member = (contract: Record<string, unknown>, index: number) =>
      (contract['coveredMembers'] as Record<string, unknown>[])[index]!
    // A contract that already names a basis is the household's, not the recipe's.
    expect(variant((c) => void (c[0]!['premiumBasis'] = 'stated'))[0]).toBe('stated')
    // Roles swapped with the order kept: Alex spouse, Blair primary.
    expect(
      variant((c) => {
        const family = c[0]!['taxFamilyMembers'] as Record<string, string>[]
        family[0]!['relationship'] = 'spouse'
        family[1]!['relationship'] = 'primary'
      })[0],
    ).toBe('stated')
    // A covered member with a field the recipe never wrote.
    expect(variant((c) => void (member(c[0]!, 0)['note'] = 'quote from the broker'))[0]).toBe('stated')
    // A premium in a Medicare month: Blair turns 65 in September 2028, so
    // January to August are covered and November is not. The v5 engine left
    // that contract out (a premium where none was expected), so it is removed.
    expect(
      variant((c) => {
        const blair = member(c[2]!, 1) as Record<string, number[]>
        const amount = blair['enrollmentPremiumByMonth']![0]!
        blair['enrollmentPremiumByMonth']![10] = amount
        blair['slcspBenchmarkPremiumByMonth']![10] = amount
      })[2],
    ).toBe('removed')
    // Age-rated premiums: Alex at the premium field ($900), Blair at $950.
    expect(
      variant((c) => {
        const blair = member(c[0]!, 1) as Record<string, number[]>
        blair['enrollmentPremiumByMonth'] = blair['enrollmentPremiumByMonth']!.map((v) => (v > 0 ? 950 : 0))
        blair['slcspBenchmarkPremiumByMonth'] = blair['slcspBenchmarkPremiumByMonth']!.map((v) => (v > 0 ? 950 : 0))
      })[0],
    ).toBe('stated')
    // A contract for a year nobody is covered (2040: both past 65) with no
    // covered member is not the recipe's (it never wrote one).
    expect(
      variant((c) =>
        void c.push({
          ...structuredClone(c[0]!),
          year: 2040,
          coveredMembers: [],
        }),
      ).at(-1),
    ).toBe('stated')
    // The planning-age boundary: Blair's planning age is 64, so she is alive
    // through 2027, the year she is 64, and the recipe put her in that year's
    // family and coverage; every contract is still the recipe's.
    expect(
      variant(
        () => {},
        (plan) => void (plan.household.people[1]!.longevity.planningAge = 64),
      ).every((basis) => basis === 'premiumField'),
    ).toBe(true)
  })

  it('leaves a plan without exampleSourceId alone, and keeps stated a contract the premium-field fill would not reproduce', () => {
    const noSource = rawV5(couple(), null)
    expect(migratePlanV5ToV6(noSource)).toBe(noSource)

    const raw = rawV5(couple(), 'early-retiree-aca')
    const contracts = contractsOf(raw)
    // Three ways off the shape the fill derives: a benchmark that differs from
    // the premium, a family that is not the people alive in order, and a
    // premium where the fill has none. They stay as written.
    ;(contracts[0]!['coveredMembers'] as Record<string, number[]>[])[0]!['slcspBenchmarkPremiumByMonth']![0] = 950
    ;(contracts[2]!['taxFamilyMembers'] as unknown[]).reverse()
    ;(contracts[3]!['coveredMembers'] as Record<string, number[]>[])[0]!['enrollmentPremiumByMonth']![5] = 1
    // Known tax-exempt interest is not the recipe's, but the v5 engine priced
    // the contract as written and the fill keeps that fact, so it becomes
    // 'premiumField' with its interest (PR #761 second review): the same
    // figures in the deterministic run, the premium field on every path.
    contracts[1]!['taxExemptInterest'] = { state: 'known', amount: 1_000 }
    const migrated = contractsOf(migratePlanV5ToV6(raw))
    expect([0, 2, 3].map((index) => migrated[index])).toEqual([0, 2, 3].map((index) => contracts[index]))
    expect(migrated[1]).toEqual({ year: 2027, premiumBasis: 'premiumField', ...FACTS, taxExemptInterest: { state: 'known', amount: 1_000 } })
    expect(migrated.slice(4).every((c) => c['premiumBasis'] === 'premiumField')).toBe(true)
  })

  it('rewrites a contract the v5 engine priced as written even when another factor fits more (PR #761 second review)', () => {
    // Inflation raised from 2.5 to 3.5 percent after saving, so the stored
    // rates are 1.055, and the 2027 contract happens to be $900 x 1.055 =
    // $949.50: the stored rates fit it alone, while 1.045 fits the six later
    // ones. The recipe's factor is 1.045; the 2027 contract is not the
    // recipe's by it, but the v5 engine priced it as written (it is the
    // premium field grown at the stored rates), so it becomes 'premiumField'
    // and is reported with the rewrite. The v5 engine left out 2028 to 2033
    // (their amounts are 1.045's): the repair says so.
    const raw = rawV5(couple(), 'early-retiree-aca')
    ;(raw['assumptions'] as Record<string, number>)['inflationPct'] = 3.5
    setAmount(contractsOf(raw)[1]!, 900 * 1.055)
    expect(bases(raw).every((basis) => basis === 'premiumField')).toBe(true)
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.repairs).toEqual([
      {
        kind: 'exampleContractsFollowPremiumField',
        exampleSourceId: 'early-retiree-aca',
        contractCount: 8,
        firstYear: 2026,
        lastYear: 2033,
        previouslyLeftOut: { contractCount: 6, firstYear: 2028, lastYear: 2033 },
      },
    ])
    // The deterministic figures equal the v5 engine's, measured on origin/main
    // 5224c5d0 for this document (every ledger value within 4e-12 dollars):
    // healthcare spending, the credit and the investable balance, 2026-2028.
    const years = simulatePlan(result.plan, { startYear: 2026, taxCalculator: productionTaxCalculator() }).years.slice(0, 3)
    const v5 = [
      [2_428, 19_172, 886_448.8],
      [2_396, 20_392, 871_341.89],
      [20_937.78, null, 836_678.34],
    ]
    v5.forEach(([healthcare, credit, investable], index) => {
      expect(years[index]!.expenses.healthcare, `healthcare ${2026 + index}`).toBeCloseTo(healthcare!, 2)
      if (credit === null) expect(years[index]!.aca?.modeledAllowablePtc ?? null).toBeNull()
      else expect(years[index]!.aca?.modeledAllowablePtc, `credit ${2026 + index}`).toBeCloseTo(credit, 2)
      expect(years[index]!.investableTotal, `investable ${2026 + index}`).toBeCloseTo(investable!, 2)
    })
  })

  it('reports the rewrite as a load repair, and only on the way from v5', () => {
    const result = migratePlanToCurrent(rawV5(couple(), 'early-retiree-aca'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.schemaVersion).toBe(CURRENT_PLAN_SCHEMA_VERSION)
    expect(result.repairs).toEqual([
      { kind: 'exampleContractsFollowPremiumField', exampleSourceId: 'early-retiree-aca', contractCount: 8, firstYear: 2026, lastYear: 2033 },
    ])
    // A v6 document is never rewritten, whatever it carries: its stated
    // contracts are the household's figures.
    const v6 = rawV5(couple(), 'early-retiree-aca')
    v6['schemaVersion'] = CURRENT_PLAN_SCHEMA_VERSION
    const current = migratePlanToCurrent(v6)
    expect(current.ok).toBe(true)
    if (!current.ok) return
    expect(current.repairs).toEqual([])
    expect(current.plan.expenses.healthcare.acaYears?.every((c) => c.premiumBasis === undefined)).toBe(true)
  })

  it("keeps a v5 survival-percentile pick's life-table edition", () => {
    // v5 gained the optional longevity.percentile.tableEdition (decision
    // D-LIFE-TABLE-2023); v6 carries it and the migration leaves it as it is,
    // with or without an example source, and a pick without one stays without.
    for (const source of ['early-retiree-aca', null]) {
      const plan = couple()
      plan.household.people[0]!.longevity = {
        planningAge: 94,
        source: 'percentile',
        percentile: { pct: 25, joint: false, tableEdition: { periodYear: 2023, trusteesReportYear: 2026 } },
      }
      plan.household.people[1]!.longevity = { planningAge: 92, source: 'percentile', percentile: { pct: 25, joint: false } }
      const result = migratePlanToCurrent(rawV5(plan, source))
      expect(result.ok, String(source)).toBe(true)
      if (!result.ok) continue
      expect(result.plan.household.people[0]!.longevity).toEqual(plan.household.people[0]!.longevity)
      expect(result.plan.household.people[1]!.longevity.percentile).toEqual({ pct: 25, joint: false })
    }
  })

  it('rewrites a stored scenario that writes the contracts, on both legs', () => {
    const raw = rawV5(couple(), 'early-retiree-aca')
    const stored = structuredClone(contractsOf(raw))
    const healthcare = structuredClone((raw['expenses'] as { healthcare: Record<string, unknown> }).healthcare)
    raw['scenarios'] = [
      {
        id: 's1',
        name: 'Contracts',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          operations: [
            { op: 'set', path: '/expenses/healthcare/acaYears', before: { present: true, value: stored }, value: stored },
          ],
        },
      },
      { id: 's2', name: 'Loose', patch: { expenses: { healthcare: { acaYears: stored } } } },
      {
        id: 's3',
        name: 'Whole healthcare',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          operations: [{ op: 'set', path: '/expenses/healthcare', before: { present: true, value: healthcare }, value: healthcare }],
        },
      },
    ]
    const migrated = migratePlanV5ToV6(raw)['scenarios'] as Record<string, Record<string, unknown>>[]
    const ops = migrated[0]!['patch']!['operations'] as Record<string, unknown>[]
    const derived = stored.map((c) => ({ year: c['year'], premiumBasis: 'premiumField', ...FACTS }))
    expect(ops[0]!['value']).toEqual(derived)
    expect((ops[0]!['before'] as Record<string, unknown>)['value']).toEqual(derived)
    expect(((migrated[1]!['patch'] as Record<string, Record<string, Record<string, unknown>>>)['expenses']!['healthcare']!)['acaYears']).toEqual(derived)
    const whole = (migrated[2]!['patch']!['operations'] as Record<string, Record<string, unknown>>[])[0]!
    expect(whole['value']!['acaYears']).toEqual(derived)
    expect(((whole['before'] as Record<string, unknown>)['value'] as Record<string, unknown>)['acaYears']).toEqual(derived)
  })

  it('keeps an unedited converted plan\'s figures to the cent at a 2026 start', () => {
    // Before v6 the engine priced these stated recipe contracts as written (on
    // the deterministic run each equals the premium field grown at the plan's
    // rate, so the old example check passed). After v6 the same years are
    // derived from the premium field by the ledger's running product instead
    // of Math.pow: equal to within a fraction of a cent, not bit for bit.
    const raw = rawV5(couple(), 'early-retiree-aca')
    const statedDoc = structuredClone(raw)
    statedDoc['schemaVersion'] = CURRENT_PLAN_SCHEMA_VERSION
    delete statedDoc['exampleSourceId']
    const stated = migratePlanToCurrent(statedDoc)
    const converted = migratePlanToCurrent(raw)
    if (!stated.ok || !converted.ok) throw new Error('did not load')
    expect(converted.plan.expenses.healthcare.acaYears?.every((c) => c.premiumBasis === 'premiumField')).toBe(true)
    const project = (plan: Plan) => simulatePlan(plan, { startYear: 2026, taxCalculator: productionTaxCalculator() })
    const a = project(stated.plan)
    const b = project(converted.plan)
    expect(b.depletionYear).toBe(a.depletionYear)
    const leaves: [string, number, number][] = []
    const walk = (x: unknown, y: unknown, path: string) => {
      if (typeof x === 'number' && typeof y === 'number') leaves.push([path, x, y])
      else if (x !== null && typeof x === 'object' && y !== null && typeof y === 'object') {
        for (const key of Object.keys(x)) {
          if (key === 'premiumBasis') continue
          walk((x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key], `${path}.${key}`)
        }
      }
    }
    walk(a.years, b.years, 'years')
    expect(leaves.length).toBeGreaterThan(1_000)
    const offByACent = leaves.filter(([, x, y]) => !(Math.abs(x - y) < 0.005))
    expect(offByACent).toEqual([])
    // The credit is priced in 2026 and 2027 on both.
    for (const year of [2026, 2027]) {
      expect(a.years.find((row) => row.year === year)?.aca?.readiness).toBe('actionable')
      expect(b.years.find((row) => row.year === year)?.aca?.readiness).toBe('actionable')
      expect(b.years.find((row) => row.year === year)?.aca?.modeledAllowablePtc).toBeGreaterThan(0)
    }
  })

  // PR #761 review 2: a saved example whose premium, inflation or household
  // was changed after saving holds contracts that came from the recipe but no
  // longer match its premium. The v5 engine was leaving them out at run time
  // (gross premium, no credit), so the migration removes them and records it,
  // and the plan's figures do not change. The figures below were measured on
  // the v5 engine (origin/main 5224c5d0) for these same documents, deterministic
  // run from 2026 with this file's production tax calculator: depletion year,
  // healthcare spending 2026-2029, and investable balances 2026-2031. Every
  // ledger value of each document was identical between the two engines.
  it('leaves out the contracts the v5 engine was leaving out, and the figures do not change (PR #761 review 2)', () => {
    const healthcareOf = (raw: Record<string, unknown>) => (raw['expenses'] as { healthcare: Record<string, unknown> }).healthcare
    const docs: Record<string, { edit: (raw: Record<string, unknown>) => void; v5: { depletion: number; healthcare: number[]; investable: number[] }; removed: number[] }> = {
      'premium edited to $1,300': {
        edit: (raw) => void (healthcareOf(raw)['pre65MonthlyPremiumPerPerson'] = 1_300),
        v5: {
          depletion: 2048,
          healthcare: [31_200, 32_604, 29_278.94, 20_580.7],
          investable: [857_676.8, 812_815.52, 770_810.13, 735_874.09, 698_797.04, 659_506.93],
        },
        removed: [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033],
      },
      'inflation edited, one contract after 2026': {
        edit: (raw) => {
          healthcareOf(raw)['acaYears'] = contractsOf(raw).slice(0, 2)
          ;(raw['assumptions'] as Record<string, number>)['inflationPct'] = 3.5
        },
        v5: {
          depletion: 2046,
          healthcare: [2_428, 22_788, 20_937.78, 15_540.85],
          investable: [886_448.8, 850_949.89, 816_286.34, 784_953.93, 751_015.67, 714_334],
        },
        removed: [2027],
      },
      "Blair's date of birth a year earlier": {
        edit: (raw) => void ((raw['household'] as { people: Record<string, unknown>[] }).people[1]!['dob'] = '1962-09-15'),
        v5: {
          depletion: 2049,
          healthcare: [2_428, 19_658.12, 14_452.73, 15_103.11],
          investable: [886_448.8, 855_307.31, 828_128.13, 798_669.69, 767_316.73, 734_008.28],
        },
        removed: [2027, 2028],
      },
      'a $1,150 quote for 2026': {
        edit: (raw) => setAmount(contractsOf(raw)[0]!, 1_150),
        v5: {
          depletion: 2049,
          healthcare: [21_600, 2_396, 20_542.74, 15_103.11],
          investable: [867_276.8, 852_623.52, 819_354.33, 789_895.89, 758_542.93, 725_234.49],
        },
        removed: [2026],
      },
    }
    for (const [name, { edit, v5, removed }] of Object.entries(docs)) {
      const raw = rawV5(couple(), 'early-retiree-aca')
      edit(raw)
      const result = migratePlanToCurrent(raw)
      expect(result.ok, name).toBe(true)
      if (!result.ok) continue
      expect(result.plan.expenses.healthcare.acaYearsRemoved, name).toEqual([{ edit: 'exampleNoLongerMatched', years: removed }])
      expect(result.repairs.find((repair) => repair.kind === 'exampleContractsLeftOut'), name).toEqual({
        kind: 'exampleContractsLeftOut',
        exampleSourceId: 'early-retiree-aca',
        contractCount: removed.length,
        firstYear: removed[0],
        lastYear: removed.at(-1),
      })
      const projection = simulatePlan(result.plan, { startYear: 2026, taxCalculator: productionTaxCalculator() })
      expect(projection.depletionYear, name).toBe(v5.depletion)
      v5.healthcare.forEach((value, index) => expect(projection.years[index]!.expenses.healthcare, `${name} healthcare ${2026 + index}`).toBeCloseTo(value, 2))
      v5.investable.forEach((value, index) => expect(projection.years[index]!.investableTotal, `${name} investable ${2026 + index}`).toBeCloseTo(value, 2))
    }
    // A contract that did not come from the recipe (a benchmark unlike its
    // premium) is kept as it is, 'stated', whatever it holds.
    const household = rawV5(couple(), 'early-retiree-aca')
    healthcareOf(household)['pre65MonthlyPremiumPerPerson'] = 1_300
    const own = contractsOf(household)[0]!
    ;(own['coveredMembers'] as Record<string, number[]>[])[0]!['slcspBenchmarkPremiumByMonth']![0] = 950
    expect(bases(household)).toEqual(['stated', ...new Array<string>(7).fill('removed')])
  })

  // PR #761 follow-up. The figures pinned below were measured on the v5
  // engine (origin/main 5224c5d0) for these same documents, deterministic run
  // from 2026 with this file's production tax calculator: each year's
  // healthcare spending, premium credit and investable balance, 2026-2028.
  // Every other ledger value was compared too: the ones marked "unchanged"
  // matched the v5 engine to the last bit.
  const setMonths = (contract: Record<string, unknown>, enrollment: number, benchmark: number) => {
    for (const member of contract['coveredMembers'] as Record<string, number[]>[]) {
      member['enrollmentPremiumByMonth'] = member['enrollmentPremiumByMonth']!.map((v) => (v > 0 ? enrollment : 0))
      member['slcspBenchmarkPremiumByMonth'] = member['slcspBenchmarkPremiumByMonth']!.map((v) => (v > 0 ? benchmark : 0))
    }
  }
  const firstYears = (plan: Plan) =>
    simulatePlan(plan, { startYear: 2026, taxCalculator: productionTaxCalculator() })
      .years.slice(0, 3)
      .map((year) => [year.expenses.healthcare, year.aca?.modeledAllowablePtc ?? null, year.investableTotal])
  const expectFigures = (actual: (number | null)[][], expected: (number | null)[][], label: string) => {
    expected.forEach((row, index) =>
      row.forEach((value, column) => {
        const got = actual[index]![column]!
        if (value === null) expect(got, `${label} ${index}.${column}`).toBeNull()
        else expect(got, `${label} ${index}.${column}`).toBeCloseTo(value, 2)
      }),
    )
  }
  // The v5 engine's figures when the 2026 credit is left out, and when the
  // example's own 2026 contract is priced.
  const V5_2026_LEFT_OUT = [
    [21_600, null, 867_276.8],
    [2_396, 20_176, 852_623.52],
    [20_542.74, null, 819_354.33],
  ]

  it('prices a contract entered for a saved example that the v5 engine refused, and says the figures change (PR #761 follow-up a)', () => {
    // Not the recipe's (its benchmark, $1,200, is not its premium, $1,150), so
    // it stays 'stated'; the v5 engine refused it because $1,150 is not the
    // example's $900, and left the 2026 credit out. v6 prices it as entered.
    const raw = rawV5(couple(), 'early-retiree-aca')
    setMonths(contractsOf(raw)[0]!, 1_150, 1_200)
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.expenses.healthcare.acaYears?.[0]?.premiumBasis).toBeUndefined()
    expect(result.repairs).toContainEqual({
      kind: 'exampleEnteredContractsNowPriced',
      exampleSourceId: 'early-retiree-aca',
      contractCount: 1,
      firstYear: 2026,
      lastYear: 2026,
    })
    const figures = firstYears(result.plan)
    // v5: $21,600 gross, no credit. v6: $27,600 gross, a $26,372 credit.
    expect(figures[0]![0]).not.toBeCloseTo(V5_2026_LEFT_OUT[0]![0]!, 2)
    expectFigures(figures, [[1_228, 26_372, 887_648.8], [2_396, 20_176, 872_995.52], [20_542.74, null, 839_726.33]], 'v6')
    // A contract the v5 engine priced as written is not announced: the
    // unedited example reports only the rewrite.
    const unedited = migratePlanToCurrent(rawV5(couple(), 'early-retiree-aca'))
    if (!unedited.ok) throw new Error('did not load')
    expect(unedited.repairs.map((repair) => repair.kind)).toEqual(['exampleContractsFollowPremiumField'])
  })

  it("sorts the contracts a stored scenario writes by the same rule, in the scenario's plan (PR #761 follow-up b)", () => {
    const raw = rawV5(couple(), 'early-retiree-aca')
    const stored = structuredClone(contractsOf(raw))
    const quote = structuredClone(stored)
    setMonths(quote[0]!, 1_150, 1_150)
    const own = structuredClone(stored)
    setMonths(own[0]!, 1_150, 1_200)
    raw['scenarios'] = [
      { id: 's-rewrite', name: 'Spend more', patch: { expenses: { baseAnnual: 52_000, healthcare: { acaYears: structuredClone(stored) } } } },
      { id: 's-removed', name: 'A quote', patch: { expenses: { healthcare: { acaYears: quote } } } },
      { id: 's-priced', name: 'Own figures', patch: { expenses: { healthcare: { acaYears: own } } } },
      {
        id: 's-canonical',
        name: 'Quote, canonical',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: { planId: raw['id'], planSchemaVersion: 5, snapshotHash: 'fnv1a64:0000000000000000' },
          title: 'Quote, canonical',
          rationale: null,
          createdAtIso: '2026-06-29T12:00:00.000Z',
          actor: { kind: 'user' },
          operations: [{ op: 'set', path: '/expenses/healthcare/acaYears', before: { present: true, value: stored }, value: quote }],
        },
      },
    ]
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const scenario = (id: string) => {
      const found = result.plan.scenarios.find((entry) => entry.id === id)!
      const applied = applyScenarioPatch(result.plan, found.patch as never)
      if (!applied.ok) throw new Error(`${id}: ${applied.issues.join('; ')}`)
      return applied.plan
    }
    const repairFor = (id: string, kind: string) =>
      result.repairs.find((repair) => repair.kind === kind && 'scenario' in repair && repair.scenario?.id === id)
    // Each kind once: the recipe's contracts rewritten, the same figures.
    const rewrite = scenario('s-rewrite')
    expect(rewrite.expenses.healthcare.acaYears?.every((contract) => contract.premiumBasis === 'premiumField')).toBe(true)
    expectFigures(firstYears(rewrite), [[2_428, 19_172, 884_448.8], [2_396, 20_176, 867_745.52], [20_542.74, null, 832_375.08]], 's-rewrite')
    expect(repairFor('s-rewrite', 'exampleContractsFollowPremiumField')).toMatchObject({ contractCount: 8, firstYear: 2026, lastYear: 2033 })
    // A recipe-shaped quote that no longer matched: removed, recorded, the same figures.
    for (const id of ['s-removed', 's-canonical']) {
      const removed = scenario(id)
      expect(removed.expenses.healthcare.acaYears?.map((contract) => contract.year)[0], id).toBe(2027)
      expect(removed.expenses.healthcare.acaYearsRemoved, id).toEqual([{ edit: 'exampleNoLongerMatched', years: [2026] }])
      expectFigures(firstYears(removed), V5_2026_LEFT_OUT, id)
      expect(repairFor(id, 'exampleContractsLeftOut'), id).toMatchObject({ contractCount: 1, firstYear: 2026, lastYear: 2026 })
    }
    // An entered contract the v5 engine refused: priced now, and announced.
    const priced = scenario('s-priced')
    expect(priced.expenses.healthcare.acaYears?.[0]).toMatchObject({ year: 2026 })
    expect(priced.expenses.healthcare.acaYears?.[0]?.premiumBasis).toBeUndefined()
    expect(firstYears(priced)[0]![1]).toBeCloseTo(26_372, 2)
    expect(repairFor('s-priced', 'exampleEnteredContractsNowPriced')).toEqual({
      kind: 'exampleEnteredContractsNowPriced',
      exampleSourceId: 'early-retiree-aca',
      contractCount: 1,
      firstYear: 2026,
      lastYear: 2026,
      scenario: { id: 's-priced', name: 'Own figures' },
    })
  })
})
