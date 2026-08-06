import { describe, expect, it } from 'vitest'

import {
  checkAnnualLiabilityRunIdentitySet,
  mintAnnualLiabilityRunIdentity,
  sameAnnualLiabilityRun,
  type AnnualLiabilityRunIdentity,
  type AnnualLiabilityRunTaxInput,
  type MintAnnualLiabilityRunIdentityInput,
} from './annualLiabilityRunIdentity.js'

const STRUCTURAL_ID = /^[a-z0-9-]+:[0-9a-f]{64}$/

function inputs(): AnnualLiabilityRunTaxInput[] {
  return [
    { inputId: 'ordinaryIncome', value: { representation: 'exactCents', amountCents: 8_450_000 } },
    { inputId: 'capitalLossCarryforward', value: { representation: 'exactCents', amountCents: -300_000 } },
    { inputId: 'federalFilingStatus', value: { representation: 'declaredTerm', term: 'marriedFilingJointly' } },
  ]
}

function mintInput(
  overrides: Partial<MintAnnualLiabilityRunIdentityInput> = {},
): MintAnnualLiabilityRunIdentityInput {
  return {
    planId: 'plan-1',
    taxUnitId: 'tax-unit-1',
    taxYear: 2026,
    liabilityRun: {
      liabilityRunKind: 'committedAnnual',
      candidateFundingVectorEvidenceId: null,
    },
    taxInputs: inputs(),
    ...overrides,
  }
}

function minted(
  overrides: Partial<MintAnnualLiabilityRunIdentityInput> = {},
): Readonly<AnnualLiabilityRunIdentity> {
  const result = mintAnnualLiabilityRunIdentity(mintInput(overrides))
  if (result.status !== 'annualLiabilityRunIdentityMinted') {
    throw new Error(`expected a minted identity, got ${result.issues[0].detail}`)
  }
  return result.identity
}

function issue(
  overrides: Partial<MintAnnualLiabilityRunIdentityInput>,
): { kind: string; detail: string } {
  const result = mintAnnualLiabilityRunIdentity(mintInput(overrides))
  if (result.status !== 'annualLiabilityRunIdentityBlocked') {
    throw new Error('expected a blocked mint')
  }
  return result.issues[0]
}

describe('minting one annual liability run identity', () => {
  it('derives both IDs structurally from the run and its inputs', () => {
    const identity = minted()

    expect(identity.taxInputSnapshotId).toMatch(STRUCTURAL_ID)
    expect(identity.annualTaxLiabilityEvidenceId).toMatch(STRUCTURAL_ID)
    expect(identity.taxInputSnapshotId.startsWith('annual-tax-input-snapshot:'))
      .toBe(true)
    expect(
      identity.annualTaxLiabilityEvidenceId
        .startsWith('annual-tax-liability-evidence:'),
    ).toBe(true)
    expect(identity.identityDerivation).toBe('canonicalJsonSha256')
    expect(Object.isFrozen(identity)).toBe(true)
  })

  it('does not let the caller\'s input ordering change either ID', () => {
    // Structural means structural: a snapshot is a set of named figures, so the
    // order the caller happened to build the array in is not part of it.
    const forward = minted()
    const reversed = minted({ taxInputs: [...inputs()].reverse() })

    expect(reversed.taxInputSnapshotId).toBe(forward.taxInputSnapshotId)
    expect(reversed.annualTaxLiabilityEvidenceId)
      .toBe(forward.annualTaxLiabilityEvidenceId)
    expect(reversed.orderedTaxInputs.map((entry) => entry.inputId))
      .toEqual(['capitalLossCarryforward', 'federalFilingStatus', 'ordinaryIncome'])
  })

  it('moves both IDs when one cent of one input moves', () => {
    const shifted = minted({
      taxInputs: [
        { inputId: 'ordinaryIncome', value: { representation: 'exactCents', amountCents: 8_450_001 } },
        ...inputs().slice(1),
      ],
    })
    const base = minted()

    expect(shifted.taxInputSnapshotId).not.toBe(base.taxInputSnapshotId)
    expect(shifted.annualTaxLiabilityEvidenceId)
      .not.toBe(base.annualTaxLiabilityEvidenceId)
  })

  it('gives a baseline and a candidate over the same inputs one snapshot and two evidence IDs', () => {
    // This is the property the conversion tax-funding record rests on. `T0` and
    // `T1` are two runs, so they may never share an evidence ID; but the
    // snapshot names the inputs alone, so two runs handed identical inputs
    // share it -- which is exactly how a caller proves a counterfactual removed
    // nothing, rather than being asked to take its word for it.
    const baseline = minted({
      liabilityRun: {
        liabilityRunKind: 'baselineT0',
        candidateFundingVectorEvidenceId: null,
      },
    })
    const candidate = minted({
      liabilityRun: {
        liabilityRunKind: 'candidateT1',
        candidateFundingVectorEvidenceId: 'funding-vector-1',
      },
    })
    const committed = minted()

    expect(candidate.taxInputSnapshotId).toBe(baseline.taxInputSnapshotId)
    expect(committed.taxInputSnapshotId).toBe(baseline.taxInputSnapshotId)
    expect(new Set([
      baseline.annualTaxLiabilityEvidenceId,
      candidate.annualTaxLiabilityEvidenceId,
      committed.annualTaxLiabilityEvidenceId,
    ]).size).toBe(3)
  })

  it('separates two candidates that answer for different funding vectors', () => {
    const first = minted({
      liabilityRun: {
        liabilityRunKind: 'candidateT1',
        candidateFundingVectorEvidenceId: 'funding-vector-1',
      },
    })
    const second = minted({
      liabilityRun: {
        liabilityRunKind: 'candidateT1',
        candidateFundingVectorEvidenceId: 'funding-vector-2',
      },
    })

    expect(second.taxInputSnapshotId).toBe(first.taxInputSnapshotId)
    expect(second.annualTaxLiabilityEvidenceId)
      .not.toBe(first.annualTaxLiabilityEvidenceId)
  })

  it('separates two filing units and two years in one plan', () => {
    const base = minted()

    expect(minted({ taxUnitId: 'tax-unit-2' }).annualTaxLiabilityEvidenceId)
      .not.toBe(base.annualTaxLiabilityEvidenceId)
    expect(minted({ taxYear: 2027 }).annualTaxLiabilityEvidenceId)
      .not.toBe(base.annualTaxLiabilityEvidenceId)
    expect(minted({ planId: 'plan-2' }).annualTaxLiabilityEvidenceId)
      .not.toBe(base.annualTaxLiabilityEvidenceId)
  })

  it('detaches its input, so a later mutation cannot rewrite a minted identity', () => {
    const mutable = mintInput()
    const identity = mintAnnualLiabilityRunIdentity(mutable)
    if (identity.status !== 'annualLiabilityRunIdentityMinted') {
      throw new Error('expected a minted identity')
    }
    const before = JSON.stringify(identity.identity)

    ;(mutable.taxInputs as AnnualLiabilityRunTaxInput[]).push({
      inputId: 'late-arrival',
      value: { representation: 'exactCents', amountCents: 1 },
    })

    expect(JSON.stringify(identity.identity)).toBe(before)
  })
})

describe('refusing an identity the run cannot honestly claim', () => {
  it('requires a candidate run to name its funding vector', () => {
    expect(issue({
      liabilityRun: {
        liabilityRunKind: 'candidateT1',
        candidateFundingVectorEvidenceId: '   ',
      },
    })).toMatchObject({ kind: 'runBindingInvalid' })
  })

  it('refuses a non-candidate run that names one', () => {
    // The union already forbids it in types; a Plan-shaped value crossing a
    // boundary does not answer to types, and substituting a null would publish
    // a candidate's liability under a baseline's name.
    expect(issue({
      liabilityRun: {
        liabilityRunKind: 'baselineT0',
        candidateFundingVectorEvidenceId: 'funding-vector-1',
      } as never,
    })).toMatchObject({ kind: 'runBindingInvalid' })
  })

  it('refuses an unknown run kind and a malformed binding', () => {
    expect(issue({
      liabilityRun: {
        liabilityRunKind: 'speculative',
        candidateFundingVectorEvidenceId: null,
      } as never,
    })).toMatchObject({ kind: 'runBindingInvalid' })
    expect(issue({
      liabilityRun: { liabilityRunKind: 'committedAnnual' } as never,
    })).toMatchObject({ kind: 'runBindingInvalid' })
  })

  it('refuses an empty snapshot and a repeated input name', () => {
    expect(issue({ taxInputs: [] })).toMatchObject({
      kind: 'taxInputSnapshotInvalid',
    })
    expect(issue({ taxInputs: [...inputs(), inputs()[0]!] }))
      .toMatchObject({ kind: 'taxInputSnapshotInvalid' })
  })

  it('refuses an input that is neither exact cents nor a declared term', () => {
    expect(issue({
      taxInputs: [{
        inputId: 'ordinaryIncome',
        value: { representation: 'exactCents', amountCents: 1.5 },
      }],
    })).toMatchObject({ kind: 'taxInputSnapshotInvalid' })
    expect(issue({
      taxInputs: [{
        inputId: 'federalFilingStatus',
        value: { representation: 'estimate', term: 'single' } as never,
      }],
    })).toMatchObject({ kind: 'taxInputSnapshotInvalid' })
  })

  it('refuses a natural key with a blank member or an impossible year', () => {
    expect(issue({ planId: ' ' })).toMatchObject({ kind: 'naturalKeyInvalid' })
    expect(issue({ taxUnitId: '' })).toMatchObject({ kind: 'naturalKeyInvalid' })
    expect(issue({ taxYear: 2026.5 })).toMatchObject({ kind: 'naturalKeyInvalid' })
    expect(issue({ taxYear: 0 })).toMatchObject({ kind: 'naturalKeyInvalid' })
  })

  it('refuses input it cannot detach rather than hashing whatever it can reach', () => {
    const hostile = {
      get planId(): string {
        throw new Error('hostile accessor')
      },
    } as unknown as MintAnnualLiabilityRunIdentityInput
    const result = mintAnnualLiabilityRunIdentity(hostile)

    expect(result.status).toBe('annualLiabilityRunIdentityBlocked')
    expect(result.issues[0]).toMatchObject({ kind: 'hostileInput' })
  })
})

describe('checking a set of minted identities for collisions', () => {
  it('accepts the three runs of one filing unit\'s year', () => {
    const identities = [
      minted(),
      minted({
        liabilityRun: {
          liabilityRunKind: 'baselineT0',
          candidateFundingVectorEvidenceId: null,
        },
      }),
      minted({
        liabilityRun: {
          liabilityRunKind: 'candidateT1',
          candidateFundingVectorEvidenceId: 'funding-vector-1',
        },
      }),
    ]

    expect(checkAnnualLiabilityRunIdentitySet(identities))
      .toEqual({ status: 'annualLiabilityRunIdentitySetDistinct', issues: [] })
  })

  it('accepts the same identity minted twice', () => {
    expect(checkAnnualLiabilityRunIdentitySet([minted(), minted()]).status)
      .toBe('annualLiabilityRunIdentitySetDistinct')
  })

  it('blocks one evidence ID that covers two different runs', () => {
    // The failure this exists for: a consumer rebuilt the run by hand, got a
    // different input set, and kept the ID it was handed.
    const identity = minted()
    const forged: AnnualLiabilityRunIdentity = {
      ...minted({ taxInputs: [...inputs().slice(1)] }),
      annualTaxLiabilityEvidenceId: identity.annualTaxLiabilityEvidenceId,
      taxInputSnapshotId: identity.taxInputSnapshotId,
    }
    const result = checkAnnualLiabilityRunIdentitySet([identity, forged])

    expect(result.status).toBe('annualLiabilityRunIdentitySetBlocked')
    expect(result.issues[0]).toMatchObject({ kind: 'identityCollision' })
  })

  it('blocks one snapshot ID that covers two different input sets', () => {
    const identity = minted()
    const forged: AnnualLiabilityRunIdentity = {
      ...minted({ taxInputs: [...inputs().slice(1)] }),
      taxInputSnapshotId: identity.taxInputSnapshotId,
    }
    const result = checkAnnualLiabilityRunIdentitySet([identity, forged])

    expect(result.status).toBe('annualLiabilityRunIdentitySetBlocked')
    expect(result.issues[0]?.detail)
      .toContain('covers two different input sets')
  })

  it('blocks one run published under two evidence IDs', () => {
    const identity = minted()
    const forged: AnnualLiabilityRunIdentity = {
      ...identity,
      annualTaxLiabilityEvidenceId: `${identity.annualTaxLiabilityEvidenceId}-2`,
    }
    const result = checkAnnualLiabilityRunIdentitySet([identity, forged])

    expect(result.status).toBe('annualLiabilityRunIdentitySetBlocked')
    expect(result.issues[0]?.detail)
      .toContain('published under two evidence IDs')
  })
})

describe('comparing two run bindings', () => {
  it('separates the kinds and the funding vectors', () => {
    expect(sameAnnualLiabilityRun(
      { liabilityRunKind: 'baselineT0', candidateFundingVectorEvidenceId: null },
      { liabilityRunKind: 'baselineT0', candidateFundingVectorEvidenceId: null },
    )).toBe(true)
    expect(sameAnnualLiabilityRun(
      { liabilityRunKind: 'baselineT0', candidateFundingVectorEvidenceId: null },
      { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    )).toBe(false)
    expect(sameAnnualLiabilityRun(
      { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'a' },
      { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'b' },
    )).toBe(false)
  })
})
