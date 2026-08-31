import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import {
  publishedEntityFacts,
  type Form8606ConsequentialChannels,
  type PublishedEntityFactsInput,
} from './publishedEntityFacts.js'

const employerRoth = (id: string, ownerPersonId: string | null): Account =>
  ({ type: 'roth', kind: 'employer', id, ownerPersonId }) as Account

const rothIra = (id: string, ownerPersonId: string | null): Account =>
  ({ type: 'roth', kind: 'ira', id, ownerPersonId }) as Account

const cash = (id: string, ownerPersonId: string | null): Account =>
  ({ type: 'cash', id, ownerPersonId }) as Account

function input(
  over: Partial<PublishedEntityFactsInput> = {},
): PublishedEntityFactsInput {
  return {
    accounts: [],
    primaryPersonId: 'primary',
    ownedRothAssumedBasisConsequentialByOwner: new Map(),
    employerRothAssumedBasisConsequentialByAccount: new Map(),
    form8606ConsequentialByOwner: new Map(),
    ...over,
  }
}

describe('publishedEntityFacts — selection and ordering', () => {
  it('publishes only positive owned-Roth evidence in UTF-16 id order', () => {
    const facts = publishedEntityFacts(
      input({
        ownedRothAssumedBasisConsequentialByOwner: new Map([
          ['z-owner', Number.MIN_VALUE],
          ['zero-owner', 0],
          ['negative-zero-owner', -0],
          ['negative-owner', -2.5],
          ['a-owner', 0.1 + 0.2],
          ['ä-owner', Number.POSITIVE_INFINITY],
          ['nan-owner', Number.NaN],
        ]),
      }),
    )

    expect(facts.ownedRothIraPoolActivity).toEqual([
      {
        ownerPersonId: 'a-owner',
        assumedBasisConsequential: { withdrawal: 0.1 + 0.2 },
      },
      {
        ownerPersonId: 'z-owner',
        assumedBasisConsequential: { withdrawal: Number.MIN_VALUE },
      },
      {
        ownerPersonId: 'ä-owner',
        assumedBasisConsequential: { withdrawal: Number.POSITIVE_INFINITY },
      },
    ])
  })

  it('publishes a traditional-IRA owner when any one channel is positive', () => {
    const facts = publishedEntityFacts(
      input({
        form8606ConsequentialByOwner: new Map<
          string,
          Form8606ConsequentialChannels
        >([
          [
            'owner-z',
            { distributions: 0, conversions: 0, annuityPayments: 0 },
          ],
          [
            'owner-c',
            {
              distributions: -3,
              conversions: 0,
              annuityPayments: Number.POSITIVE_INFINITY,
            },
          ],
          [
            'owner-a',
            {
              distributions: Number.MIN_VALUE,
              conversions: -0,
              annuityPayments: Number.NaN,
            },
          ],
          [
            'owner-b',
            { distributions: 0, conversions: 12.75, annuityPayments: -8 },
          ],
          [
            'owner-nan',
            {
              distributions: Number.NaN,
              conversions: Number.NaN,
              annuityPayments: Number.NaN,
            },
          ],
        ]),
      }),
    )

    expect(facts.ownedTraditionalIraAggregateActivity).toEqual([
      {
        ownerPersonId: 'owner-a',
        assumedBasisConsequential: {
          distributions: Number.MIN_VALUE,
          conversions: -0,
          annuityPayments: Number.NaN,
        },
      },
      {
        ownerPersonId: 'owner-b',
        assumedBasisConsequential: {
          distributions: 0,
          conversions: 12.75,
          annuityPayments: -8,
        },
      },
      {
        ownerPersonId: 'owner-c',
        assumedBasisConsequential: {
          distributions: -3,
          conversions: 0,
          annuityPayments: Number.POSITIVE_INFINITY,
        },
      },
    ])
    expect(
      Object.is(
        facts.ownedTraditionalIraAggregateActivity[0]!
          .assumedBasisConsequential!.conversions,
        -0,
      ),
    ).toBe(true)
  })

  it('returns three empty arrays when no evidence is consequential', () => {
    const facts = publishedEntityFacts(
      input({
        ownedRothAssumedBasisConsequentialByOwner: new Map([['p', 0]]),
        employerRothAssumedBasisConsequentialByAccount: new Map([['r', -1]]),
        form8606ConsequentialByOwner: new Map([
          ['p', { distributions: -1, conversions: -0, annuityPayments: NaN }],
        ]),
      }),
    )

    expect(facts).toEqual({
      ownedRothIraPoolActivity: [],
      employerRothAccountActivity: [],
      ownedTraditionalIraAggregateActivity: [],
    })
  })
})

describe('publishedEntityFacts — employer Roth owner resolution', () => {
  it('publishes only strictly positive employer-Roth evidence in UTF-16 id order', () => {
    const facts = publishedEntityFacts(
      input({
        employerRothAssumedBasisConsequentialByAccount: new Map([
          ['z-minimum', Number.MIN_VALUE],
          ['zero', 0],
          ['negative-zero', -0],
          ['negative', -12.5],
          ['a-infinity', Number.POSITIVE_INFINITY],
          ['nan', Number.NaN],
        ]),
      }),
    )

    expect(facts.employerRothAccountActivity).toEqual([
      {
        accountId: 'a-infinity',
        ownerPersonId: 'primary',
        assumedBasisConsequential: { withdrawal: Number.POSITIVE_INFINITY },
      },
      {
        accountId: 'z-minimum',
        ownerPersonId: 'primary',
        assumedBasisConsequential: { withdrawal: Number.MIN_VALUE },
      },
    ])
  })

  it('uses the last matching duplicate account and the primary fallback', () => {
    const facts = publishedEntityFacts(
      input({
        accounts: [
          employerRoth('shared', 'first-owner'),
          cash('shared', 'cash-owner'),
          rothIra('ira-only', 'ira-owner'),
          employerRoth('shared', 'last-owner'),
          employerRoth('null-owner', null),
        ],
        employerRothAssumedBasisConsequentialByAccount: new Map([
          ['unknown-account', 7],
          ['shared', 3],
          ['null-owner', 5],
        ]),
      }),
    )

    expect(facts.employerRothAccountActivity).toEqual([
      {
        accountId: 'null-owner',
        ownerPersonId: 'primary',
        assumedBasisConsequential: { withdrawal: 5 },
      },
      {
        accountId: 'shared',
        ownerPersonId: 'last-owner',
        assumedBasisConsequential: { withdrawal: 3 },
      },
      {
        accountId: 'unknown-account',
        ownerPersonId: 'primary',
        assumedBasisConsequential: { withdrawal: 7 },
      },
    ])
  })

  it('does not let a later non-employer duplicate overwrite the employer owner', () => {
    const facts = publishedEntityFacts(
      input({
        accounts: [
          employerRoth('same-id', 'employer-owner'),
          rothIra('same-id', 'ira-owner'),
          cash('same-id', 'cash-owner'),
        ],
        employerRothAssumedBasisConsequentialByAccount: new Map([
          ['same-id', 1],
        ]),
      }),
    )

    expect(facts.employerRothAccountActivity[0]!.ownerPersonId).toBe(
      'employer-owner',
    )
  })
})

describe('publishedEntityFacts — purity and object identity', () => {
  const rothEvidence = new Map([
    ['p-a', 4],
    ['p-b', 4],
  ])
  const employerEvidence = new Map([
    ['r-a', 6],
    ['r-b', 6],
  ])
  const form8606Evidence = new Map([
    ['p-a', { distributions: 1, conversions: 2, annuityPayments: 3 }],
    ['p-b', { distributions: 1, conversions: 2, annuityPayments: 3 }],
  ])
  const accounts = [
    employerRoth('r-a', 'p-a'),
    employerRoth('r-b', 'p-b'),
  ]

  it('creates a distinct nested verdict for every row', () => {
    const facts = publishedEntityFacts(
      input({
        accounts,
        ownedRothAssumedBasisConsequentialByOwner: rothEvidence,
        employerRothAssumedBasisConsequentialByAccount: employerEvidence,
        form8606ConsequentialByOwner: form8606Evidence,
      }),
    )

    expect(facts.ownedRothIraPoolActivity[0]!.assumedBasisConsequential).toEqual(
      facts.ownedRothIraPoolActivity[1]!.assumedBasisConsequential,
    )
    expect(facts.ownedRothIraPoolActivity[0]!.assumedBasisConsequential).not.toBe(
      facts.ownedRothIraPoolActivity[1]!.assumedBasisConsequential,
    )
    expect(facts.employerRothAccountActivity[0]!.assumedBasisConsequential).not.toBe(
      facts.employerRothAccountActivity[1]!.assumedBasisConsequential,
    )
    expect(
      facts.ownedTraditionalIraAggregateActivity[0]!
        .assumedBasisConsequential,
    ).not.toBe(
      facts.ownedTraditionalIraAggregateActivity[1]!
        .assumedBasisConsequential,
    )
  })

  it('returns fresh arrays, rows, and nested verdicts on every call', () => {
    const value = input({
      accounts,
      ownedRothAssumedBasisConsequentialByOwner: rothEvidence,
      employerRothAssumedBasisConsequentialByAccount: employerEvidence,
      form8606ConsequentialByOwner: form8606Evidence,
    })
    const first = publishedEntityFacts(value)
    const second = publishedEntityFacts(value)

    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.ownedRothIraPoolActivity).not.toBe(
      first.ownedRothIraPoolActivity,
    )
    expect(second.employerRothAccountActivity).not.toBe(
      first.employerRothAccountActivity,
    )
    expect(second.ownedTraditionalIraAggregateActivity).not.toBe(
      first.ownedTraditionalIraAggregateActivity,
    )

    const arrayPairs = [
      [first.ownedRothIraPoolActivity, second.ownedRothIraPoolActivity],
      [first.employerRothAccountActivity, second.employerRothAccountActivity],
      [
        first.ownedTraditionalIraAggregateActivity,
        second.ownedTraditionalIraAggregateActivity,
      ],
    ] as const
    for (const [firstRows, secondRows] of arrayPairs) {
      expect(secondRows).toHaveLength(firstRows.length)
      for (let index = 0; index < firstRows.length; index++) {
        const firstRow = firstRows[index]!
        const secondRow = secondRows[index]!
        expect(secondRow).not.toBe(firstRow)
        expect(secondRow.assumedBasisConsequential).not.toBe(
          firstRow.assumedBasisConsequential,
        )
      }
    }
  })

  it('does not mutate the account list or evidence maps', () => {
    const accountSnapshot = structuredClone(accounts)
    const rothSnapshot = [...rothEvidence]
    const employerSnapshot = [...employerEvidence]
    const form8606Snapshot = structuredClone([...form8606Evidence])

    publishedEntityFacts(
      input({
        accounts,
        ownedRothAssumedBasisConsequentialByOwner: rothEvidence,
        employerRothAssumedBasisConsequentialByAccount: employerEvidence,
        form8606ConsequentialByOwner: form8606Evidence,
      }),
    )

    expect(accounts).toEqual(accountSnapshot)
    expect([...rothEvidence]).toEqual(rothSnapshot)
    expect([...employerEvidence]).toEqual(employerSnapshot)
    expect([...form8606Evidence]).toEqual(form8606Snapshot)
  })
})
