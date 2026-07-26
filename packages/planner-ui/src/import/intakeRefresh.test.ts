import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import type { ImportReviewItem } from './reviewChecklist'
import {
  applyIntakeRefresh,
  buildIntakeRefreshDelta,
  classifyIntakeRefresh,
  defaultIntakeRefreshSelection,
} from './intakeRefresh'

let id = 0
const nextId = () => `id-${++id}`

function empty(name: string): Plan {
  return createEmptyPlan({ name, newId: nextId, now: () => new Date('2026-07-01T00:00:00Z') })
}

function mapped(target: string, confidence: 'exact' | 'derived' | 'assumed' = 'exact'): ImportReviewItem {
  return {
    status: confidence === 'assumed' ? 'defaulted' : 'mapped',
    source: `source for ${target}`,
    detail: `mapped ${target}`,
    locator: { kind: 'jsonPath', path: `$.${target}` },
    confidence,
    target,
  }
}

function addCurrentFacts(plan: Plan): void {
  const personId = plan.household.people[0]!.id
  plan.household.people[0]!.dob = '1970-04-15'
  plan.incomes.push(
    { type: 'wages', id: nextId(), personId, annualGross: 100_000, endAge: 64, realGrowthPct: 2 },
    {
      type: 'recurring',
      id: nextId(),
      label: 'Beach Rental',
      annualAmount: 24_000,
      startYear: 2025,
      endYear: 2040,
      inflationAdjusted: true,
      taxTreatment: 'ordinary',
    },
    { type: 'oneTime', id: nextId(), label: 'Business sale', year: 2030, amount: 300_000, taxTreatment: 'capitalGain' },
    {
      type: 'socialSecurity',
      id: nextId(),
      personId,
      piaMonthly: 2_400,
      earnings: null,
      claimAge: { years: 70, months: 0 },
    },
  )
  plan.assumptions.recentAnnualMagi = 180_000
}

function addIncomingFacts(plan: Plan): ImportReviewItem[] {
  const personId = plan.household.people[0]!.id
  plan.household.people[0]!.dob = '1970-04-15'
  plan.incomes.push(
    { type: 'wages', id: nextId(), personId, annualGross: 112_000, endAge: 67, realGrowthPct: 9 },
    {
      type: 'recurring',
      id: nextId(),
      label: '  BEACH—rental ',
      annualAmount: 30_000,
      startYear: 2035,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'none',
    },
    { type: 'oneTime', id: nextId(), label: 'Business SALE!', year: 2030, amount: 450_000, taxTreatment: 'none' },
    {
      type: 'socialSecurity',
      id: nextId(),
      personId,
      piaMonthly: 9_999,
      earnings: null,
      claimAge: { years: 62, months: 0 },
    },
  )
  plan.assumptions.recentAnnualMagi = 205_000
  return [
    mapped('household.people[0].dob'),
    mapped('incomes[0]'),
    mapped('incomes[1]'),
    mapped('incomes[2]'),
    mapped('incomes[3]', 'assumed'),
    mapped('assumptions.recentAnnualMagi', 'derived'),
    mapped('household.filingStatus'),
  ]
}

function withoutAllowlistedValues(plan: Plan): unknown {
  const clone = structuredClone(plan)
  for (const income of clone.incomes) {
    if (income.type === 'wages') income.annualGross = -1
    if (income.type === 'recurring') income.annualAmount = -1
    if (income.type === 'oneTime') income.amount = -1
  }
  clone.assumptions.recentAnnualMagi = -1
  return clone
}

describe('existing-plan intake refresh', () => {
  it('matches without generated ids, previews exactly what apply writes, and preserves every unrelated field', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    addCurrentFacts(current)
    const review = addIncomingFacts(incoming)
    expect(incoming.household.people[0]!.id).not.toBe(current.household.people[0]!.id)
    expect(incoming.incomes[0]!.id).not.toBe(current.incomes[0]!.id)

    const classification = classifyIntakeRefresh(current, incoming, review)
    expect(classification.candidates.map((item) => item.match)).toEqual(['exact', 'exact', 'exact', 'exact'])
    expect(classification.candidates.map((item) => item.targetPath)).toEqual([
      'incomes[0].annualGross',
      'incomes[1].annualAmount',
      'incomes[2].amount',
      'assumptions.recentAnnualMagi',
    ])
    expect(classification.excluded.map((item) => item.sourcePath)).toEqual(
      expect.arrayContaining(['incomes[3]', 'household.filingStatus', 'household.people[0].dob']),
    )

    const selection = defaultIntakeRefreshSelection(classification)
    const delta = buildIntakeRefreshDelta(current, classification, selection)
    expect(delta.changes).toEqual([
      {
        path: 'incomes[0].annualGross',
        field: 'annualGross',
        before: 100_000,
        after: 112_000,
        sourcePath: 'incomes[0].annualGross',
        targetBinding: expect.objectContaining({
          path: 'incomes[0].annualGross',
          incomeId: current.incomes[0]!.id,
        }),
      },
      {
        path: 'incomes[1].annualAmount',
        field: 'annualAmount',
        before: 24_000,
        after: 30_000,
        sourcePath: 'incomes[1].annualAmount',
        targetBinding: expect.objectContaining({
          path: 'incomes[1].annualAmount',
          incomeId: current.incomes[1]!.id,
        }),
      },
      {
        path: 'incomes[2].amount',
        field: 'amount',
        before: 300_000,
        after: 450_000,
        sourcePath: 'incomes[2].amount',
        targetBinding: expect.objectContaining({
          path: 'incomes[2].amount',
          incomeId: current.incomes[2]!.id,
        }),
      },
      {
        path: 'assumptions.recentAnnualMagi',
        field: 'recentAnnualMagi',
        before: 180_000,
        after: 205_000,
        sourcePath: 'assumptions.recentAnnualMagi',
        targetBinding: null,
      },
    ])

    const beforeStrategy = withoutAllowlistedValues(current)
    const applied = applyIntakeRefresh(current, delta)
    expect(applied).toBe(4)
    for (const change of delta.changes) {
      if (change.field === 'recentAnnualMagi') {
        expect(current.assumptions.recentAnnualMagi).toBe(change.after)
      } else {
        const index = Number(/^incomes\[(\d+)]/.exec(change.path)![1])
        const income = current.incomes[index]!
        expect(
          income.type === 'wages'
            ? income.annualGross
            : income.type === 'recurring'
              ? income.annualAmount
              : income.type === 'oneTime'
                ? income.amount
                : null,
        ).toBe(change.after)
      }
    }
    expect(withoutAllowlistedValues(current)).toEqual(beforeStrategy)
    expect((current.incomes[3] as Extract<(typeof current.incomes)[number], { type: 'socialSecurity' }>).piaMonthly).toBe(2_400)
  })

  it('does not auto-match joint-1040 wages with assumed provenance or an untargeted DOB', () => {
    const current = empty('Current')
    const incoming = empty('1040')
    addCurrentFacts(current)
    incoming.household.people[0]!.dob = current.household.people[0]!.dob
    incoming.household.people.push({
      id: nextId(),
      name: 'Spouse',
      dob: '1971-05-16',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 95, source: 'manual' },
    })
    incoming.incomes.push({
      type: 'wages',
      id: nextId(),
      personId: incoming.household.people[0]!.id,
      annualGross: 250_000,
      endAge: null,
      realGrowthPct: 0,
    })

    const classification = classifyIntakeRefresh(current, incoming, [
      {
        ...mapped('incomes[0]', 'assumed'),
        source: 'From your 1040 — line 1a (wages)',
      },
      {
        ...mapped('household.people'),
        target: undefined,
        source: 'Dates of birth (guided entry, not on the 1040)',
      },
      mapped('assumptions.recentAnnualMagi', 'derived'),
    ])
    const wage = classification.candidates.find((item) => item.source.field === 'annualGross')!
    expect(wage).toMatchObject({ match: 'unmatched', targetPath: null, reason: 'unreviewed_assumption' })
    expect([...defaultIntakeRefreshSelection(classification).values()]).not.toContain('incomes[0].annualGross')
  })

  it('requires unique semantic labels (and year for one-time income); ids and equal amounts never match', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    const owner = current.household.people[0]!.id
    const incomingOwner = incoming.household.people[0]!.id
    current.incomes.push(
      {
        type: 'recurring',
        id: 'same-generated-looking-id',
        label: 'Rental A',
        annualAmount: 20_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: true,
        taxTreatment: 'ordinary',
      },
      { type: 'oneTime', id: nextId(), label: 'Sale', year: 2030, amount: 50_000, taxTreatment: 'ordinary' },
      { type: 'wages', id: nextId(), personId: owner, annualGross: 50_000, endAge: null, realGrowthPct: 0 },
    )
    incoming.incomes.push(
      {
        type: 'recurring',
        id: 'same-generated-looking-id',
        label: 'Different label',
        annualAmount: 20_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: true,
        taxTreatment: 'ordinary',
      },
      { type: 'oneTime', id: nextId(), label: 'Sale', year: 2031, amount: 50_000, taxTreatment: 'ordinary' },
      { type: 'wages', id: nextId(), personId: incomingOwner, annualGross: 50_000, endAge: null, realGrowthPct: 0 },
    )
    incoming.household.people[0]!.dob = '1980-01-01'
    current.household.people[0]!.dob = '1981-01-01'
    const classification = classifyIntakeRefresh(current, incoming, [
      mapped('incomes[0]'),
      mapped('incomes[1]'),
      mapped('incomes[2]'),
      mapped('household.people[0].dob'),
      mapped('assumptions.recentAnnualMagi'),
    ])
    expect(classification.candidates.slice(0, 3).map((item) => item.reason)).toEqual([
      'no_target',
      'no_target',
      'no_target',
    ])
  })

  it('preserves Unicode identity without matching distinct marks or stripped symbols', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    current.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: '\u5bb6\u8cc3\u53ce\u5165',
        annualAmount: 10_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'oneTime',
        id: nextId(),
        label: '\u58f2\u5374\u76ca\uff12\uff10\uff13\uff10',
        year: 2030,
        amount: 50_000,
        taxTreatment: 'ordinary',
      },
    )
    incoming.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: '\u5bb6\u8cc3\u53ce\u5165',
        annualAmount: 12_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'oneTime',
        id: nextId(),
        label: '\u58f2\u5374\u76ca2030',
        year: 2030,
        amount: 55_000,
        taxTreatment: 'ordinary',
      },
    )
    const classification = classifyIntakeRefresh(current, incoming, [
      mapped('incomes[0]'),
      mapped('incomes[1]'),
    ])
    expect(classification.candidates.slice(0, 2).map((item) => item.match)).toEqual([
      'exact',
      'exact',
    ])
    const delta = buildIntakeRefreshDelta(
      current,
      classification,
      defaultIntakeRefreshSelection(classification),
    )
    expect(delta.changes.map((change) => change.path)).toEqual([
      'incomes[0].annualAmount',
      'incomes[1].amount',
    ])
    expect(applyIntakeRefresh(current, delta)).toBe(2)

    const distinctCurrent = empty('Distinct current')
    const distinctIncoming = empty('Distinct incoming')
    distinctCurrent.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: '\u0915\u093e',
        annualAmount: 10_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: '\u0645\u064e\u0631',
        annualAmount: 20_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: '\u{1f600}\ufe0f',
        annualAmount: 30_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
    )
    distinctIncoming.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: '\u0915\u093f',
        annualAmount: 12_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: '\u0645\u064f\u0631',
        annualAmount: 22_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: '\u{1f603}\ufe0f',
        annualAmount: 32_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
    )
    const distinct = classifyIntakeRefresh(distinctCurrent, distinctIncoming, [
      mapped('incomes[0]'),
      mapped('incomes[1]'),
      mapped('incomes[2]'),
    ])
    expect(distinct.candidates.slice(0, 3).map((item) => item.reason)).toEqual([
      'no_target',
      'no_target',
      'no_target',
    ])
  })

  it('requires exactly one wage stream on both sides for the proven person', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    current.household.people[0]!.dob = '1975-03-02'
    incoming.household.people[0]!.dob = '1975-03-02'
    const currentPerson = current.household.people[0]!.id
    const incomingPerson = incoming.household.people[0]!.id
    current.incomes.push(
      { type: 'wages', id: nextId(), personId: currentPerson, annualGross: 80_000, endAge: null, realGrowthPct: 0 },
      { type: 'wages', id: nextId(), personId: currentPerson, annualGross: 20_000, endAge: 60, realGrowthPct: 0 },
    )
    incoming.incomes.push({
      type: 'wages',
      id: nextId(),
      personId: incomingPerson,
      annualGross: 110_000,
      endAge: null,
      realGrowthPct: 0,
    })
    const classification = classifyIntakeRefresh(current, incoming, [
      mapped('household.people[0].dob'),
      mapped('incomes[0]'),
      mapped('assumptions.recentAnnualMagi'),
    ])
    expect(classification.candidates[0]).toMatchObject({
      match: 'ambiguous',
      targetPath: null,
      reason: 'ambiguous_target',
      alternativeTargetPaths: ['incomes[0].annualGross', 'incomes[1].annualGross'],
    })
    expect(classification.staleTargetPaths).toEqual(['incomes[0].annualGross', 'incomes[1].annualGross'])
  })

  it('reports ambiguity and stale addressed income without adding, deleting, or zeroing records', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    current.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: 'Consulting',
        annualAmount: 10_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: 'CONSULTING',
        annualAmount: 12_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: true,
        taxTreatment: 'ordinary',
      },
    )
    incoming.incomes.push({
      type: 'recurring',
      id: nextId(),
      label: 'Consulting',
      annualAmount: 20_000,
      startYear: null,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'none',
    })
    const classification = classifyIntakeRefresh(current, incoming, [
      mapped('incomes[0]'),
      mapped('assumptions.recentAnnualMagi'),
    ])
    const recurring = classification.candidates.find((item) => item.source.field === 'annualAmount')!
    expect(recurring.match).toBe('ambiguous')
    expect(recurring.alternativeTargetPaths).toEqual(['incomes[0].annualAmount', 'incomes[1].annualAmount'])
    expect(classification.staleTargetPaths).toEqual(['incomes[0].annualAmount', 'incomes[1].annualAmount'])
    const before = structuredClone(current.incomes)
    const delta = buildIntakeRefreshDelta(current, classification, defaultIntakeRefreshSelection(classification))
    applyIntakeRefresh(current, delta)
    expect(current.incomes).toEqual(before)

    const resolved = buildIntakeRefreshDelta(
      current,
      classification,
      new Map([[0, 'incomes[0].annualAmount']]),
    )
    expect(resolved.changes.map((change) => change.path)).toEqual(['incomes[0].annualAmount'])
    expect(resolved.staleTargetPaths).toEqual(['incomes[1].annualAmount'])
  })

  it('blocks the entire preview and apply when two selected sources collide on one target', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    current.incomes.push({
      type: 'recurring',
      id: nextId(),
      label: 'Rental',
      annualAmount: 10_000,
      startYear: null,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    })
    incoming.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: 'Rental',
        annualAmount: 11_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: 'RENTAL',
        annualAmount: 12_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
    )
    current.assumptions.recentAnnualMagi = 90_000
    incoming.assumptions.recentAnnualMagi = 95_000
    const classification = classifyIntakeRefresh(current, incoming, [
      mapped('incomes[0]'),
      mapped('incomes[1]'),
      mapped('assumptions.recentAnnualMagi'),
    ])
    const selection = new Map([
      [0, 'incomes[0].annualAmount'],
      [1, 'incomes[0].annualAmount'],
      [2, 'assumptions.recentAnnualMagi'],
    ])
    const delta = buildIntakeRefreshDelta(current, classification, selection)
    expect(delta.duplicateGroups).toEqual([
      { targetPath: 'incomes[0].annualAmount', sourceIndexes: [0, 1] },
    ])
    expect(delta.changes).toEqual([])
    expect(delta.review).toHaveLength(3)
    expect(delta.review[2]!.detail).toContain('Another selected field has a duplicate target')
    expect(applyIntakeRefresh(current, delta)).toBe(0)
    expect((current.incomes[0] as Extract<(typeof current.incomes)[number], { type: 'recurring' }>).annualAmount).toBe(10_000)

    const aliased = buildIntakeRefreshDelta(
      current,
      classification,
      new Map([
        [0, 'incomes[0].annualAmount'],
        [1, 'incomes[00].annualAmount'],
      ]),
    )
    expect(aliased.duplicateGroups).toEqual([])
    expect(aliased.changes.map((change) => change.path)).toEqual(['incomes[0].annualAmount'])
    expect(applyIntakeRefresh(current, aliased)).toBe(1)
    expect((current.incomes[0] as Extract<(typeof current.incomes)[number], { type: 'recurring' }>).annualAmount).toBe(11_000)
  })

  it('carries protection from classify or build and enforces newly supplied apply protection', () => {
    const make = () => {
      const current = empty('Current')
      const incoming = empty('Incoming')
      addCurrentFacts(current)
      return { current, incoming, review: addIncomingFacts(incoming) }
    }
    const target = 'incomes[0].annualGross'

    const classifiedCase = make()
    const classified = classifyIntakeRefresh(classifiedCase.current, classifiedCase.incoming, classifiedCase.review, {
      protectedTargets: new Set([target]),
    })
    expect(classified.candidates[0]!.isProtected).toBe(true)
    const classifiedDelta = buildIntakeRefreshDelta(
      classifiedCase.current,
      classified,
      new Map([[0, target]]),
    )
    expect(classifiedDelta.changes).toEqual([])
    expect(applyIntakeRefresh(classifiedCase.current, classifiedDelta)).toBe(0)

    const builtCase = make()
    const builtClassification = classifyIntakeRefresh(builtCase.current, builtCase.incoming, builtCase.review)
    const builtDelta = buildIntakeRefreshDelta(
      builtCase.current,
      builtClassification,
      new Map([[0, target]]),
      new Set(['incomes[0]']),
    )
    expect(builtDelta.changes).toEqual([])
    expect(applyIntakeRefresh(builtCase.current, builtDelta)).toBe(0)

    const applyCase = make()
    const applyClassification = classifyIntakeRefresh(applyCase.current, applyCase.incoming, applyCase.review)
    const applyDelta = buildIntakeRefreshDelta(applyCase.current, applyClassification, new Map([[0, target]]))
    expect(applyDelta.changes).toHaveLength(1)
    expect(applyIntakeRefresh(applyCase.current, applyDelta, new Set(['incomes']))).toBe(0)
    expect((applyCase.current.incomes[0] as Extract<(typeof applyCase.current.incomes)[number], { type: 'wages' }>).annualGross).toBe(100_000)
  })

  it('excludes Social Security, accounts, filing facts, historical MAGI, and rejects non-allowlisted manual targets', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    addCurrentFacts(current)
    const review = addIncomingFacts(incoming)
    review.push(mapped('assumptions.historicalAnnualMagiByYear.2024'))
    review.push(mapped('accounts[0]'))
    const classification = classifyIntakeRefresh(current, incoming, review)
    expect(classification.excluded.map((item) => item.sourcePath)).toEqual(
      expect.arrayContaining([
        'incomes[3]',
        'accounts[0]',
        'household.filingStatus',
        'assumptions.historicalAnnualMagiByYear.2024',
      ]),
    )
    expect(classification.candidates.some((item) => item.source.field === ('piaMonthly' as never))).toBe(false)

    const maliciousSelection = new Map([[0, 'incomes[3].piaMonthly']])
    const delta = buildIntakeRefreshDelta(current, classification, maliciousSelection)
    expect(delta.changes).toEqual([])
    expect(applyIntakeRefresh(current, delta)).toBe(0)
    expect((current.incomes[3] as Extract<(typeof current.incomes)[number], { type: 'socialSecurity' }>).piaMonthly).toBe(2_400)
  })

  it('does not let a manual assignment bypass missing or rejected provenance', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    addCurrentFacts(current)
    const owner = incoming.household.people[0]!.id
    incoming.household.people[0]!.dob = current.household.people[0]!.dob
    incoming.incomes.push({
      type: 'wages',
      id: nextId(),
      personId: owner,
      annualGross: 777_000,
      endAge: null,
      realGrowthPct: 0,
    })
    const rejected = {
      ...mapped('assumptions.recentAnnualMagi'),
      decision: { state: 'rejected', decidedAtIso: '2026-07-01T00:00:00Z' } as const,
    }
    const classification = classifyIntakeRefresh(current, incoming, [rejected])
    expect(classification.candidates.map((item) => item.reason)).toEqual([
      'missing_provenance',
      'unreviewed_assumption',
    ])
    const delta = buildIntakeRefreshDelta(
      current,
      classification,
      new Map([
        [0, 'incomes[0].annualGross'],
        [1, 'assumptions.recentAnnualMagi'],
      ]),
    )
    expect(delta.changes).toEqual([])
    expect(applyIntakeRefresh(current, delta)).toBe(0)

    const unprovenPerson = classifyIntakeRefresh(current, incoming, [mapped('incomes[0]')])
    expect(unprovenPerson.candidates[0]).toMatchObject({
      reason: 'person_not_proven',
      source: { field: 'annualGross' },
    })
    const unprovenDelta = buildIntakeRefreshDelta(
      current,
      unprovenPerson,
      new Map([[0, 'incomes[0].annualGross']]),
    )
    expect(unprovenDelta.changes).toEqual([])
    expect(applyIntakeRefresh(current, unprovenDelta)).toBe(0)
  })

  it('requires record provenance for label/year identity and ignores invalid candidates in duplicate blocking', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    current.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: 'Rental',
        annualAmount: 10_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: 'Consulting',
        annualAmount: 20_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
    )
    incoming.incomes.push(
      {
        type: 'recurring',
        id: nextId(),
        label: 'Rental',
        annualAmount: 11_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: 'Rental',
        annualAmount: 999_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'recurring',
        id: nextId(),
        label: 'Consulting',
        annualAmount: 777_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
    )
    const classification = classifyIntakeRefresh(current, incoming, [
      mapped('incomes[0]'),
      // Amount-only evidence must not authenticate the adjacent label.
      mapped('incomes[2].annualAmount'),
      mapped('assumptions.recentAnnualMagi'),
    ])
    expect(classification.candidates.slice(0, 3).map((item) => item.reason)).toEqual([
      'ambiguous_source',
      'missing_provenance',
      'missing_provenance',
    ])
    const delta = buildIntakeRefreshDelta(
      current,
      classification,
      new Map([
        [0, 'incomes[0].annualAmount'],
        [1, 'incomes[0].annualAmount'],
        [2, 'incomes[1].annualAmount'],
      ]),
    )
    expect(delta.duplicateGroups).toEqual([])
    expect(delta.changes.map((change) => [change.path, change.after])).toEqual([
      ['incomes[0].annualAmount', 11_000],
    ])
  })

  it('requires reclassification when current income identities reorder or change semantically', () => {
    const make = () => {
      const current = empty('Current')
      const incoming = empty('Incoming')
      current.incomes.push(
        {
          type: 'recurring',
          id: nextId(),
          label: 'Rental A',
          annualAmount: 10_000,
          startYear: null,
          endYear: null,
          inflationAdjusted: false,
          taxTreatment: 'ordinary',
        },
        {
          type: 'recurring',
          id: nextId(),
          label: 'Rental B',
          annualAmount: 10_000,
          startYear: null,
          endYear: null,
          inflationAdjusted: false,
          taxTreatment: 'ordinary',
        },
      )
      incoming.incomes.push({
        type: 'recurring',
        id: nextId(),
        label: 'Rental A',
        annualAmount: 12_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      })
      const classification = classifyIntakeRefresh(current, incoming, [mapped('incomes[0]')])
      return { current, classification }
    }

    const reordered = make()
    const selection = defaultIntakeRefreshSelection(reordered.classification)
    reordered.current.incomes.reverse()
    const reorderedPreview = buildIntakeRefreshDelta(
      reordered.current,
      reordered.classification,
      selection,
    )
    expect(reorderedPreview.changes).toEqual([])
    expect(reorderedPreview.review[0]!.detail).toContain('requires reclassification')

    const changed = make()
    const changedSelection = defaultIntakeRefreshSelection(changed.classification)
    ;(
      changed.current.incomes[0] as Extract<
        (typeof changed.current.incomes)[number],
        { type: 'recurring' }
      >
    ).label = 'Rental B'
    expect(
      buildIntakeRefreshDelta(changed.current, changed.classification, changedSelection).changes,
    ).toEqual([])

    const afterPreview = make()
    const delta = buildIntakeRefreshDelta(
      afterPreview.current,
      afterPreview.classification,
      defaultIntakeRefreshSelection(afterPreview.classification),
    )
    const retargeted = structuredClone(delta)
    retargeted.changes[0]!.path = 'incomes[1].annualAmount'
    const beforeRetarget = structuredClone(afterPreview.current)
    expect(applyIntakeRefresh(afterPreview.current, retargeted)).toBe(0)
    expect(afterPreview.current).toEqual(beforeRetarget)

    afterPreview.current.incomes.reverse()
    const beforeApply = structuredClone(afterPreview.current)
    expect(applyIntakeRefresh(afterPreview.current, delta)).toBe(0)
    expect(afterPreview.current).toEqual(beforeApply)
  })

  it('fails a forged or stale delta as a whole before writing any field', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    addCurrentFacts(current)
    const classification = classifyIntakeRefresh(current, incoming, addIncomingFacts(incoming))
    const delta = buildIntakeRefreshDelta(
      current,
      classification,
      defaultIntakeRefreshSelection(classification),
    )
    const before = structuredClone(current)
    const forged = structuredClone(delta)
    forged.changes[1]!.after = Number.NaN
    expect(applyIntakeRefresh(current, forged)).toBe(0)
    expect(current).toEqual(before)

    const omittedBinding = structuredClone(delta)
    delete (omittedBinding.changes[0] as unknown as { targetBinding?: unknown }).targetBinding
    const primitiveBinding = structuredClone(delta)
    ;(primitiveBinding.changes[0] as unknown as { targetBinding: unknown }).targetBinding = 7
    const partialBinding = structuredClone(delta)
    ;(partialBinding.changes[0] as unknown as { targetBinding: unknown }).targetBinding = {
      path: 'incomes[0].annualGross',
    }
    const omittedBindings = structuredClone(delta)
    delete (omittedBindings.candidates[0] as unknown as { targetBindings?: unknown })
      .targetBindings
    const nullBindingEntry = structuredClone(delta)
    ;(nullBindingEntry.candidates[0] as unknown as { targetBindings: unknown }).targetBindings = [
      null,
    ]
    for (const malformed of [
      omittedBinding,
      primitiveBinding,
      partialBinding,
      omittedBindings,
      nullBindingEntry,
    ]) {
      expect(applyIntakeRefresh(current, malformed)).toBe(0)
      expect(current).toEqual(before)
    }

    current.incomes[0] = {
      ...(current.incomes[0] as Extract<(typeof current.incomes)[number], { type: 'wages' }>),
      annualGross: 101_000,
    }
    const staleBefore = structuredClone(current)
    expect(applyIntakeRefresh(current, delta)).toBe(0)
    expect(current).toEqual(staleBefore)
  })

  it('keeps runtime-invalid source money out of both preview and apply', () => {
    const current = empty('Current')
    const incoming = empty('Incoming')
    addCurrentFacts(current)
    const review = addIncomingFacts(incoming)
    const recurring = incoming.incomes[1] as Extract<
      (typeof incoming.incomes)[number],
      { type: 'recurring' }
    >
    recurring.annualAmount = Number.NaN
    const classification = classifyIntakeRefresh(current, incoming, review)
    const delta = buildIntakeRefreshDelta(
      current,
      classification,
      defaultIntakeRefreshSelection(classification),
    )
    expect(delta.changes.some((change) => change.field === 'annualAmount')).toBe(false)
    expect(delta.review.some((item) => item.detail.includes('finite, non-negative amount'))).toBe(
      true,
    )
    const before = structuredClone(current)
    expect(applyIntakeRefresh(current, delta)).toBe(3)
    expect(
      (
        current.incomes[1] as Extract<
          (typeof current.incomes)[number],
          { type: 'recurring' }
        >
      ).annualAmount,
    ).toBe(
      (
        before.incomes[1] as Extract<
          (typeof before.incomes)[number],
          { type: 'recurring' }
        >
      ).annualAmount,
    )
  })
})
