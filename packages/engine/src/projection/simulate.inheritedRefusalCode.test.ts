/**
 * Every producer of `InheritedAccountYearEvidence.refusalReason` publishes an
 * `InheritedIraRefusalCode` beside it, and the six members of that union are
 * exactly the causes those producers can reach.
 *
 * Driven through `simulatePlan` rather than through the classifier, because
 * the claim being guarded is about the published evidence row: prose without a
 * code is what forced a consumer to classify by substring, and a code the
 * ledger never emits is a member no consumer can ever switch on.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { InheritedAccountYearEvidence, InheritedIraRefusalCode } from './types.js'

const noTax = createFlatTaxCalculator(0)
let sequence = 0
const id = () => `inherited-refusal-code-${++sequence}`

type Beneficiary = NonNullable<
  Extract<Account, { type: 'traditional' }>['inherited']
>['beneficiary']

function planFor(beneficiaryBirthYear: number, planningAge = 100): Plan {
  const plan = createEmptyPlan({
    newId: id,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'beneficiary',
    name: 'Beneficiary',
    dob: `${beneficiaryBirthYear}-06-15`,
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.accounts = [{
    type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null,
    annualReturnPct: null, balance: 1_000_000, annualContribution: 0,
  } as Account]
  return plan
}

function facts(overrides: Partial<NonNullable<Beneficiary>> = {}): NonNullable<Beneficiary> {
  return {
    beneficiaryClass: 'designated-individual',
    edbCategory: 'none',
    beneficiaryBirthYear: 1995,
    soleBeneficiary: true,
    ownerBirthYear: 1970,
    provenance: { source: 'test', asOf: '2026-01-01' },
    ...overrides,
  }
}

function withInherited(
  plan: Plan,
  inheritedFacts: Record<string, unknown>,
  kind: 'ira' | 'employer' = 'ira',
): Plan {
  plan.accounts.push({
    type: 'traditional', id: 'inherited', name: 'Inherited IRA',
    ownerPersonId: 'beneficiary', annualReturnPct: null, kind,
    balance: 300_000, annualContribution: 0, inherited: inheritedFacts,
  } as Account)
  return plan
}

function run(plan: Plan, deathAgeByPersonId?: Record<string, number>) {
  const parsed = parsePlan(plan)
  expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, {
    startYear: 2026,
    horizonEndYear: 2030,
    taxCalculator: noTax,
    ...(deathAgeByPersonId === undefined ? {} : { deathAgeByPersonId }),
  })
}

/** Every inherited-account evidence row the run published, in year order. */
function evidenceRows(
  result: ReturnType<typeof run>,
): InheritedAccountYearEvidence[] {
  return result.years.flatMap((y) => [...(y.inheritedAccounts ?? [])])
}

/** Fact sets chosen to reach one distinct refusal cause each. */
const PRODUCED: ReadonlyArray<{
  readonly label: string
  readonly code: InheritedIraRefusalCode
  readonly result: () => ReturnType<typeof run>
}> = [
  {
    label: 'X3 estate beneficiary',
    code: 'entity-beneficiary',
    result: () => run(withInherited(planFor(1995), {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: {
        beneficiaryClass: 'estate',
        provenance: { source: 'test', asOf: '2026-01-01' },
      },
    })),
  },
  {
    label: 'X2 successor beneficiary',
    code: 'successor-beneficiary',
    result: () => run(withInherited(planFor(1995), {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryClass: 'successor-beneficiary' }),
    })),
  },
  {
    label: 'X4 multiple beneficiaries without separate-account facts',
    code: 'multiple-beneficiaries',
    result: () => run(withInherited(planFor(1995), {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: facts({ soleBeneficiary: false }),
    })),
  },
  {
    label: 'X5 inherited employer plan',
    code: 'employer-plan',
    result: () => run(withInherited(planFor(1995), {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: facts(),
    }, 'employer')),
  },
  {
    // Primary-branch needs-review: the §1.401(a)(9)-3(d) commencement deferral
    // runs to the owner's applicable-age year, which no supplied fact fixes.
    label: 'X5 spouse remain-beneficiary with no owner birth year',
    code: 'needs-review',
    result: () => {
      const beneficiary = facts({
        beneficiaryBirthYear: 1960,
        edbCategory: 'surviving-spouse',
        election: 'remain-beneficiary',
      })
      delete (beneficiary as { ownerBirthYear?: number }).ownerBirthYear
      return run(withInherited(planFor(1960), {
        ownerDeathYear: 2022,
        decedentHadStartedRmds: false,
        beneficiary,
      }))
    },
  },
  {
    // The second producer branch in simulate.ts: the primary classification
    // succeeded as S2, and it is the synthetic S0 for the pre-election window
    // that refuses (contested born-1959 applicable age).
    label: 'S2 synthetic pre-election schedule refuses',
    code: 'needs-review',
    result: () => run(withInherited(planFor(1950), {
      ownerDeathYear: 2020,
      decedentHadStartedRmds: false,
      beneficiary: facts({
        beneficiaryBirthYear: 1950,
        ownerBirthYear: 1959,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
        treatAsOwnElectionYear: 2030,
      }),
    })),
  },
  {
    label: 'beneficiary death starts the successor clock',
    code: 'successor-clock-out-of-scope',
    // Alive through age 46 only, so 2028+ rows are successor scope.
    result: () => run(withInherited(planFor(1980), {
      ownerDeathYear: 2024,
      decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1980, ownerBirthYear: 1945 }),
    }), { beneficiary: 47 }),
  },
]

/**
 * Exhaustive over the union: adding a member without a producer fixture above
 * fails to compile here, and removing one leaves an unmatched observation.
 */
function producerFor(code: InheritedIraRefusalCode): string {
  switch (code) {
    case 'successor-beneficiary':
    case 'entity-beneficiary':
    case 'multiple-beneficiaries':
    case 'employer-plan':
    case 'needs-review':
      return 'simulate.ts inherited class cache (classifier refusal)'
    case 'successor-clock-out-of-scope':
      return 'annualInheritedIraDistributions.ts beneficiary-death row'
    default: {
      const unreachable: never = code
      throw new Error(`unhandled refusal code: ${String(unreachable)}`)
    }
  }
}

describe('published inherited-IRA refusal codes', () => {
  it.each(PRODUCED)('$label publishes $code on every refused row', (fixture) => {
    const rows = evidenceRows(fixture.result())
    const refused = rows.filter((row) => row.refusalReason !== undefined)
    expect(refused.length).toBeGreaterThan(0)
    for (const row of refused) expect(row.refusalCode).toBe(fixture.code)
    // Not an assertion: `producerFor` always returns a non-empty string or
    // throws from its `never` arm, so the real pin is the observed-set
    // equality below and the compile-time exhaustiveness check this call
    // exercises.
    producerFor(fixture.code)
  })

  it('publishes the code exactly when it publishes the prose', () => {
    for (const fixture of PRODUCED) {
      for (const row of evidenceRows(fixture.result())) {
        expect(row.refusalCode === undefined).toBe(row.refusalReason === undefined)
      }
    }
  })

  it('leaves the labeled legacy planning approximation with neither', () => {
    // X1: death before the SECURE Act boundary. The row labels itself through
    // `regime`, publishes no refusal prose, and so must publish no code.
    const rows = evidenceRows(run(withInherited(planFor(1995), {
      ownerDeathYear: 2018,
      decedentHadStartedRmds: true,
      beneficiary: facts(),
    })))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.regime).toBe('legacy-planning-approximation')
      expect(row.refusalReason).toBeUndefined()
      expect(row.refusalCode).toBeUndefined()
    }
  })

  it('accounts for every member of the union with a real producer', () => {
    const observed = new Set<InheritedIraRefusalCode>()
    for (const fixture of PRODUCED) {
      for (const row of evidenceRows(fixture.result())) {
        if (row.refusalCode !== undefined) observed.add(row.refusalCode)
      }
    }
    // The declared set: one entry per union member, checked exhaustive by the
    // `never` arm in `producerFor`. A new member with no fixture shows up as a
    // missing observation here rather than as a code no consumer ever sees.
    const declared: InheritedIraRefusalCode[] = [
      'successor-beneficiary',
      'entity-beneficiary',
      'multiple-beneficiaries',
      'employer-plan',
      'needs-review',
      'successor-clock-out-of-scope',
    ]
    for (const code of declared) producerFor(code)
    expect([...observed].sort()).toEqual([...declared].sort())
  })
})
