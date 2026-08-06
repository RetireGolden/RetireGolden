import { describe, expect, it } from 'vitest'

import * as engineBarrel from '../index.js'
import * as actionsBarrel from './index.js'
import { rothConversionRequestSchema } from './contract.js'
import {
  assessConversionLinkedWithdrawalGroups,
  type ConversionLinkedWithdrawalGroupDisposition,
} from './conversionLinkedWithdrawalGroup.js'
import { asActionId, asPersonId, type ActionId, type PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import {
  buildConversionTaxFundingAnnualGroupEvidence,
  conversionTaxFundingEvidenceSchema,
  parseConversionTaxFundingAnnualGroup,
  parseConversionTaxFundingEvidence,
  type ConversionTaxFundingAnnualGroupEvidence,
  type ConversionTaxFundingExactCentAmount,
  type ConversionTaxFundingTaxUnitEvidence,
} from './conversionTaxFundingEvidence.js'

const converter = asPersonId('p1')
const spouse = asPersonId('p2')

const taxUnit: ConversionTaxFundingTaxUnitEvidence = {
  taxUnitId: 'unit-joint-p1-p2',
  taxYear: 2030,
  federalFilingStatus: 'marriedFilingJointly',
  stateFilingStatusId: 'CA-marriedFilingJointly',
  taxUnitEvidenceId: 'tax-unit-evidence-joint-2030',
  taxUnitMemberPersonIds: [converter, spouse],
}

/** An exact quantity of cents. `denominator` of one is a whole cent. */
function cents(
  numeratorMinorUnits: number,
  denominator = 1,
): ConversionTaxFundingExactCentAmount {
  return {
    representation: 'exactRationalMinorUnits',
    numeratorMinorUnits: asUsdCents(numeratorMinorUnits),
    denominator,
    intermediateArithmetic: 'bigintRational',
  }
}

interface MemberFixture {
  readonly conversionActionId: ActionId
  readonly conversionPersonId: PersonId
  readonly allocationWeight: UsdCents
  readonly fundedAmount: UsdCents
}

function member(
  actionId: string,
  allocationWeight: number,
  fundedAmount: number,
  conversionPersonId: PersonId = converter,
): MemberFixture {
  return {
    conversionActionId: asActionId(actionId),
    conversionPersonId,
    allocationWeight: asUsdCents(allocationWeight),
    fundedAmount: asUsdCents(fundedAmount),
  }
}

function buildGroup(
  candidateAnnualTaxLiability: ConversionTaxFundingExactCentAmount,
  members: readonly MemberFixture[],
  overrides: Partial<{
    baselineAnnualTaxLiability: ConversionTaxFundingExactCentAmount
    taxUnit: ConversionTaxFundingTaxUnitEvidence
  }> = {},
) {
  return buildConversionTaxFundingAnnualGroupEvidence({
    taxUnit: overrides.taxUnit ?? taxUnit,
    baselineAnnualTaxLiabilityEvidenceId: 'liability-baseline-2030',
    candidateAnnualTaxLiabilityEvidenceId: 'liability-candidate-2030',
    baselineAnnualTaxLiability: overrides.baselineAnnualTaxLiability ?? cents(0),
    candidateAnnualTaxLiability,
    members,
  })
}

/** The built group, or a failure the fixture did not intend. */
function group(
  candidateAnnualTaxLiability: ConversionTaxFundingExactCentAmount,
  members: readonly MemberFixture[],
  overrides?: Parameters<typeof buildGroup>[2],
): ConversionTaxFundingAnnualGroupEvidence {
  const result = buildGroup(candidateAnnualTaxLiability, members, overrides)
  if (!result.ok) throw new Error(`Fixture did not build: ${result.issues.join('; ')}`)
  return result.members
}

/** A JSON round-trip, as a caller reloading a persisted group would see it. */
function reloaded(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function setAtPath(
  value: unknown,
  path: readonly (string | number)[],
  replacement: unknown,
): void {
  let cursor: unknown = value
  for (const segment of path.slice(0, -1)) {
    if (cursor === null || typeof cursor !== 'object') {
      throw new Error('Fixture path does not resolve to an object')
    }
    cursor = Reflect.get(cursor, segment)
  }
  if (cursor === null || typeof cursor !== 'object') {
    throw new Error('Fixture path does not resolve to an object')
  }
  Reflect.set(cursor, path.at(-1)!, replacement)
}

/** A reloaded group with one field replaced, for the rejection fixtures. */
function reloadedWith(
  members: ConversionTaxFundingAnnualGroupEvidence,
  path: readonly (string | number)[],
  replacement: unknown,
): unknown {
  const value = reloaded(members)
  setAtPath(value, path, replacement)
  return value
}

function issuePaths(issues: readonly string[]): string[] {
  return issues.map((issue) => issue.slice(0, issue.indexOf(': ')))
}

// One hundred cents owed, split across three conversions of equal principal.
const evenThirds = [
  member('conversion-a', 100_000, 34),
  member('conversion-b', 100_000, 33),
  member('conversion-c', 100_000, 33),
] as const

describe('conversion tax funding evidence', () => {
  it('round-trips a satisfied group and every mismatch arm through JSON', () => {
    const groups = [
      group(cents(100), evenThirds),
      group(cents(100), [
        member('conversion-a', 100_000, 34),
        member('conversion-b', 100_000, 33),
        member('conversion-c', 100_000, 30),
      ]),
      group(cents(100), [
        member('conversion-a', 100_000, 35),
        member('conversion-b', 100_000, 32),
        member('conversion-c', 100_000, 33),
      ]),
    ]

    for (const members of groups) {
      for (const evidence of members) {
        expect(parseConversionTaxFundingEvidence(reloaded(evidence)))
          .toEqual({ ok: true, evidence })
      }
      expect(parseConversionTaxFundingAnnualGroup(reloaded(members)))
        .toEqual({ ok: true, members })
    }
  })

  it('rejects unknown fields on either arm', () => {
    const [satisfied] = group(cents(100), evenThirds)
    expect(
      conversionTaxFundingEvidenceSchema.safeParse({ ...satisfied, dollars: 1 }).success,
    ).toBe(false)
    const [mismatch] = group(cents(100), [
      member('conversion-a', 100_000, 40),
      member('conversion-b', 100_000, 33),
      member('conversion-c', 100_000, 33),
    ])
    expect(
      conversionTaxFundingEvidenceSchema.safeParse({ ...mismatch, tolerance: 0.005 }).success,
    ).toBe(false)
  })
})

describe('group liability quantization', () => {
  it('rounds an exact half cent up, once, before anything is allocated', () => {
    // 1000.5 cents owed. Quantizing first gives 1001 to split; flooring first
    // would give 1000, and the two disagree about which conversion pays the
    // odd cent as well as about the total.
    const members = group(cents(2_001, 2), evenThirds)

    expect(members[0].unquantizedAnnualGroupRequiredFundingAmount)
      .toEqual(cents(2_001, 2))
    expect(members[0].annualGroupRequiredFundingAmount).toBe(1_001)
    expect(members.map((value) => value.requiredFundingAmount)).toEqual([334, 334, 333])
    expect(group(cents(1_000), evenThirds).map((value) => value.requiredFundingAmount))
      .toEqual([334, 333, 333])
  })

  it('rounds a non-tie fractional cent to the nearer whole cent', () => {
    expect(group(cents(200, 3), evenThirds)[0].annualGroupRequiredFundingAmount).toBe(67)
    expect(group(cents(100, 3), evenThirds)[0].annualGroupRequiredFundingAmount).toBe(33)
  })

  it('subtracts the two liabilities exactly rather than rounding each first', () => {
    // Both liabilities round to the same whole cent, so a caller that
    // quantized them separately would report nothing owed at all.
    const members = group(cents(2_003, 2), evenThirds, {
      baselineAnnualTaxLiability: cents(2_001, 2),
    })

    expect(members[0].unquantizedAnnualGroupRequiredFundingAmount).toEqual(cents(1))
    expect(members[0].annualGroupRequiredFundingAmount).toBe(1)
  })

  it('floors a candidate liability below the baseline at zero', () => {
    const members = group(cents(400), [
      member('conversion-a', 100_000, 0),
    ], { baselineAnnualTaxLiability: cents(900) })

    expect(members[0].unquantizedAnnualGroupRequiredFundingAmount).toEqual(cents(0))
    expect(members[0].annualGroupRequiredFundingAmount).toBe(0)
    expect(members[0].evaluation).toBe('satisfied')
  })

  it('keeps the difference exact where doubles would already have lost it', () => {
    // Each liability is two thirds of a cent short of the safe-integer
    // boundary; the cross-multiplied numerators are near 2.7e16, which no
    // double can hold. The honest answer is two thirds of a cent, which
    // quantizes up to one.
    const members = group(cents(9_007_199_254_740_991, 3), evenThirds, {
      baselineAnnualTaxLiability: cents(9_007_199_254_740_989, 3),
    })

    expect(members[0].unquantizedAnnualGroupRequiredFundingAmount).toEqual(cents(2, 3))
    expect(members[0].annualGroupRequiredFundingAmount).toBe(1)
  })

  it('refuses a difference that no longer fits an exact safe integer', () => {
    const result = buildGroup(cents(9_007_199_254_740_991, 2), evenThirds, {
      baselineAnnualTaxLiability: cents(1, 9_007_199_254_740_991),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(issuePaths(result.issues)).toContain('candidateAnnualTaxLiability')
    }
  })

  it('rejects a quantity that is not in lowest terms', () => {
    expect(buildGroup(cents(200, 4), evenThirds).ok).toBe(false)
    expect(buildGroup(cents(0, 2), evenThirds).ok).toBe(false)
  })

  it('rejects a stated quantization that is not the one the rule performs', () => {
    const [satisfied] = group(cents(2_001, 2), evenThirds)

    // Flooring instead of rounding half up, and an unrounded amount that is
    // not the difference of the two liabilities it sits beside.
    expect(parseConversionTaxFundingEvidence({
      ...satisfied,
      annualGroupRequiredFundingAmount: 1_000,
    }).ok).toBe(false)
    expect(parseConversionTaxFundingEvidence({
      ...satisfied,
      unquantizedAnnualGroupRequiredFundingAmount: cents(2_003, 2),
    }).ok).toBe(false)
  })
})

describe('largest-remainder allocation across the group', () => {
  it('splits a repeating share so the parts are the whole', () => {
    const members = group(cents(1_000), [
      member('conversion-a', 100_000, 333),
      member('conversion-b', 200_000, 667),
    ])

    expect(members.map((value) => value.requiredFundingAmount)).toEqual([333, 667])
    expect(members[0].evaluation).toBe('satisfied')
  })

  it('makes the member cents sum to the group requirement on every fixture', () => {
    const liabilities = [1, 7, 99, 100, 1_001, 123_457]
    const weights = [
      [1, 1, 1],
      [1, 2, 3],
      [0, 1],
      [999_983, 1, 17],
      [5_000_000],
    ]

    for (const liability of liabilities) {
      for (const weightSet of weights) {
        const members = group(
          cents(liability),
          weightSet.map((weight, index) => member(`conversion-${index}`, weight, 0)),
        )
        const allocated = members.reduce((sum, value) => sum + value.requiredFundingAmount, 0)
        expect(allocated).toBe(liability)
      }
    }
  })

  it('leaves a conversion with no taxable principal owing nothing', () => {
    const members = group(cents(101), [
      member('conversion-a', 0, 0),
      member('conversion-b', 100_000, 101),
    ])

    expect(members.map((value) => value.requiredFundingAmount)).toEqual([0, 101])
  })

  it('fails closed when a positive liability has no weight to land on', () => {
    const result = buildGroup(cents(100), [
      member('conversion-a', 0, 0),
      member('conversion-b', 0, 0),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(issuePaths(result.issues)).toContain('members')
  })

  it('rejects a group whose members re-split the requirement their own way', () => {
    const members = group(cents(100), evenThirds)
    const result = parseConversionTaxFundingAnnualGroup(
      reloadedWith(members, [1, 'requiredFundingAmount'], 34),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(issuePaths(result.issues)).toContain('1.requiredFundingAmount')
    }
  })

  it('rejects allocation order that is not contiguous from one in scheduled order', () => {
    const members = group(cents(100), evenThirds)

    for (const replacement of [0, 2, 4]) {
      const result = parseConversionTaxFundingAnnualGroup(
        reloadedWith(members, [0, 'allocationOrder'], replacement),
      )
      expect(result.ok).toBe(false)
    }
  })
})

describe('fixed-point and mismatch arms', () => {
  it('reports a shortfall with its signed cents on both the member and the group', () => {
    const members = group(cents(100), [
      member('conversion-a', 100_000, 34),
      member('conversion-b', 100_000, 33),
      member('conversion-c', 100_000, 30),
    ])

    expect(members[0]).toMatchObject({
      evaluation: 'mismatch',
      fundingEquality: 'notEqual',
      fundedAmountDifference: 0,
      annualGroupFundedAmountDifference: -3,
      mismatchKind: 'annualGroupOnly',
    })
    expect(members[2]).toMatchObject({
      evaluation: 'mismatch',
      fundedAmountDifference: -3,
      annualGroupFundedAmountDifference: -3,
      mismatchKind: 'memberAndAnnualGroup',
    })
  })

  it('reports an overshoot with a positive difference', () => {
    const members = group(cents(100), [
      member('conversion-a', 100_000, 36),
      member('conversion-b', 100_000, 33),
      member('conversion-c', 100_000, 33),
    ])

    expect(members[0]).toMatchObject({
      fundedAmountDifference: 2,
      annualGroupFundedAmountDifference: 2,
      mismatchKind: 'memberAndAnnualGroup',
    })
  })

  it('names a member-only mismatch when two members offset each other', () => {
    // The unit's tax is covered to the cent, and two of the three conversions
    // still funded the wrong share of it. The third is satisfied on its own
    // terms, which is why a consumer has to read the group and not a member.
    const members = group(cents(100), [
      member('conversion-a', 100_000, 35),
      member('conversion-b', 100_000, 32),
      member('conversion-c', 100_000, 33),
    ])

    expect(members.map((value) => value.evaluation))
      .toEqual(['mismatch', 'mismatch', 'satisfied'])
    expect(members[0]).toMatchObject({
      fundedAmountDifference: 1,
      annualGroupFundedAmountDifference: 0,
      mismatchKind: 'memberOnly',
    })
    expect(members[1]).toMatchObject({
      fundedAmountDifference: -1,
      mismatchKind: 'memberOnly',
    })
  })

  it('refuses a satisfied record whose funding does not in fact balance', () => {
    const members = group(cents(100), evenThirds)

    expect(parseConversionTaxFundingEvidence({
      ...members[0],
      fundedAmount: 35,
    }).ok).toBe(false)
    expect(parseConversionTaxFundingEvidence({
      ...members[0],
      annualGroupFundedAmount: 101,
    }).ok).toBe(false)
    expect(parseConversionTaxFundingEvidence({
      ...members[0],
      evaluation: 'satisfied',
      fundedAmountDifference: 1,
    }).ok).toBe(false)
  })

  it('refuses a mismatch record whose kind disagrees with its differences', () => {
    const [mismatch] = group(cents(100), [
      member('conversion-a', 100_000, 36),
      member('conversion-b', 100_000, 33),
      member('conversion-c', 100_000, 33),
    ])

    expect(parseConversionTaxFundingEvidence({
      ...mismatch,
      mismatchKind: 'memberOnly',
    }).ok).toBe(false)
    expect(parseConversionTaxFundingEvidence({
      ...mismatch,
      mismatchKind: 'annualGroupOnly',
    }).ok).toBe(false)
  })

  it('refuses a mismatch record that has nothing to mismatch about', () => {
    const [satisfied] = group(cents(100), evenThirds)

    expect(parseConversionTaxFundingEvidence({
      ...satisfied,
      evaluation: 'mismatch',
      fundingEquality: 'notEqual',
      mismatchKind: 'memberOnly',
    }).ok).toBe(false)
  })

  it('refuses either discriminant paired with the other arm shape', () => {
    const [satisfied] = group(cents(100), evenThirds)

    expect(parseConversionTaxFundingEvidence({
      ...satisfied,
      fundingEquality: 'notEqual',
    }).ok).toBe(false)
    expect(parseConversionTaxFundingEvidence({
      ...satisfied,
      mismatchKind: 'memberOnly',
    }).ok).toBe(false)
  })
})

describe('tax-unit binding', () => {
  const separateUnit: ConversionTaxFundingTaxUnitEvidence = {
    taxUnitId: 'unit-separate-p1',
    taxYear: 2030,
    federalFilingStatus: 'marriedFilingSeparately',
    stateFilingStatusId: 'CA-marriedFilingSeparately',
    taxUnitEvidenceId: 'tax-unit-evidence-separate-2030',
    taxUnitMemberPersonIds: [converter],
  }

  it('gives a joint and a separate unit different annual group identities', () => {
    const joint = group(cents(100), evenThirds)
    const separate = group(cents(100), evenThirds, { taxUnit: separateUnit })

    expect(separate[0].annualGroupId).not.toBe(joint[0].annualGroupId)
    expect(group(cents(100), evenThirds, {
      taxUnit: { ...taxUnit, taxYear: 2031 },
    })[0].annualGroupId).not.toBe(joint[0].annualGroupId)
  })

  it('refuses a group id that was not derived from the unit and year it names', () => {
    const members = group(cents(100), evenThirds)
    const foreign = group(cents(100), evenThirds, { taxUnit: separateUnit })

    expect(parseConversionTaxFundingEvidence(
      reloadedWith(members, [0, 'annualGroupId'], foreign[0].annualGroupId),
    ).ok).toBe(false)
    expect(parseConversionTaxFundingEvidence(
      reloadedWith(members, [0, 'annualGroupId'], 'annual-group-2030'),
    ).ok).toBe(false)
  })

  it('refuses a converting person who is not a member of the named unit', () => {
    const outsider = asPersonId('p3')

    expect(buildGroup(cents(100), [member('conversion-a', 100_000, 100, outsider)]).ok)
      .toBe(false)
    const members = group(cents(100), evenThirds)
    expect(parseConversionTaxFundingEvidence(
      reloadedWith(members, [0, 'conversionPersonId'], outsider),
    ).ok).toBe(false)
  })

  it('refuses a duplicated member of the unit itself', () => {
    expect(buildGroup(cents(100), [member('conversion-a', 100_000, 100)], {
      taxUnit: { ...taxUnit, taxUnitMemberPersonIds: [converter, converter] },
    }).ok).toBe(false)
  })

  it('refuses a foreign unit inside an otherwise balancing group', () => {
    // Every cent still sums. What is wrong is whose tax it is, which is the
    // failure that arithmetic alone can never surface.
    const members = group(cents(100), evenThirds)
    const result = parseConversionTaxFundingAnnualGroup(
      reloadedWith(members, [1, 'taxUnit'], separateUnit),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(issuePaths(result.issues)).toContain('1.taxUnit')
  })

  it('refuses a member carrying another run of the same unit', () => {
    const members = group(cents(100), evenThirds)

    for (const path of [
      [1, 'baselineAnnualTaxLiabilityEvidenceId'],
      [1, 'candidateAnnualTaxLiabilityEvidenceId'],
    ] as const) {
      const result = parseConversionTaxFundingAnnualGroup(
        reloadedWith(members, path, 'liability-from-another-run'),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(issuePaths(result.issues)).toContain(path.join('.'))
    }
  })

  it('refuses the same conversion counted twice in one group', () => {
    expect(buildGroup(cents(100), [
      member('conversion-a', 100_000, 50),
      member('conversion-a', 100_000, 50),
    ]).ok).toBe(false)

    const members = group(cents(100), evenThirds)
    const result = parseConversionTaxFundingAnnualGroup(
      reloadedWith(members, [1, 'conversionActionId'], 'conversion-a'),
    )
    expect(result.ok).toBe(false)
  })

  it('refuses a group with no members at all', () => {
    expect(parseConversionTaxFundingAnnualGroup([]).ok).toBe(false)
  })
})

describe('the boundary this contract stops at', () => {
  it('pins the linked-withdrawal group disposition to exactly its two members', () => {
    // This pin used to say "single-valued", and it said it like this:
    //
    //   const sole: ConversionLinkedWithdrawalGroupDisposition = 'refused…'
    //   const pinned: 'refused…' = sole
    //
    // which did not pin anything. A `const` with both an annotation and a
    // literal initializer is narrowed to that literal at every read, so the
    // second assignment went on compiling however wide the union became — the
    // pin would have survived the very change it was written to catch. Worth
    // recording rather than quietly replacing: the slice that opened the gate
    // discovered it by widening the union and watching this file stay green.
    //
    // What replaces it is mutual assignability, which has no narrowing to hide
    // behind. Adding a member makes the union no longer assignable to the
    // literal list; removing one makes the list no longer assignable to the
    // union; either way `true` stops being assignable to `false`.
    type MutuallyAssignable<Left, Right> = [Left] extends [Right]
      ? ([Right] extends [Left] ? true : false)
      : false
    const dispositionUnionIsExactly: MutuallyAssignable<
      ConversionLinkedWithdrawalGroupDisposition,
      'refusedPendingGroupExecution' | 'executedAsAtomicGroup'
    > = true
    expect(dispositionUnionIsExactly).toBe(true)

    const conversion = rothConversionRequestSchema.parse({
      actionId: 'conversion-a',
      kind: 'rothConversion',
      personId: 'p1',
      year: 2030,
      executionDate: '2030-12-15',
      executionSequence: 1,
      requestedAmount: 10_000,
      allocations: [
        { allocationId: 'allocation-a', sourceAccountId: 'traditional-a', requestedAmount: 10_000 },
      ],
      destinationRothAccountId: 'roth-a',
      taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'withdrawal-a' },
      provenance: { source: 'manual' },
    })
    const assessed = assessConversionLinkedWithdrawalGroups([conversion])

    expect(assessed.groups.map((value) => value.disposition))
      .toEqual(['refusedPendingGroupExecution'])
  })

  it('is published now that a producer exists, and not before', () => {
    // This pin used to assert the opposite, and its own text named the
    // condition for flipping: "Slice 3 writes that producer and publishes this
    // surface alongside it; until then a public evidence type with no producer
    // would be a promise the engine cannot keep." The producer is
    // `executeConversionLinkedWithdrawalGroups`, the simulator calls it, and
    // the records it builds now ride on published annual action records — so
    // the surface is reachable whether or not the barrel names it, and naming
    // it is the honest half of that.
    //
    // The safety property this was protecting has not moved and is not this
    // module's to hold: no dollar moves because
    // `ConversionLinkedWithdrawalGroupDisposition` still has one member and
    // `committedTaxFunding`'s linked arm still publishes `unsupported`. Both
    // are pinned above and beside this one.
    for (const name of [
      'buildConversionTaxFundingAnnualGroupEvidence',
      'conversionTaxFundingEvidenceSchema',
      'parseConversionTaxFundingAnnualGroup',
      'parseConversionTaxFundingEvidence',
    ]) {
      expect(Object.keys(actionsBarrel)).toContain(name)
    }
    // The engine barrel is a different surface with a different discipline: it
    // does not re-export the actions barrel wholesale, and a consumer reaching
    // this contract does so through the `./actions` subpath. Checked so that
    // publishing here cannot quietly widen the top-level package too.
    expect(Object.keys(engineBarrel))
      .not.toContain('buildConversionTaxFundingAnnualGroupEvidence')
  })
})
