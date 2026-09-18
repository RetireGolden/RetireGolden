import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { couplePlan, traditionalAccount } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { widowsPenalty } from './widowsPenalty.js'

vi.mock('../../tax/federalTax.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../tax/federalTax.js')>()
  return {
    ...original,
    computeFederalTax: vi.fn((input: { filingStatus: string }) => ({
      totalTax: input.filingStatus === 'single' ? 28_000 : 18_000,
    })),
  }
})

/**
 * Constructed DetectorContext: MFJ, no conversions, traditional balance
 * $600,000, last joint year 2039, first single-filed survivor year 2040 with
 * MAGI $150,000. The worksheet's already-resolved Single $28,000 and MFJ
 * $18,000 taxes are passed through the mocked computeFederalTax; deflate
 * is the stated 4/5.
 */
function context(): DetectorContext {
  const plan = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1958-01-01' })
  plan.accounts = [traditionalAccount('trad', 600_000, 'p1')] as never
  const years = [
    {
      year: 2039,
      filingStatus: 'marriedFilingJointly',
      magi: 150_000,
      irmaaTier: 0,
      people: [
        { personId: 'p1', alive: true, ageAttained: 79 },
        { personId: 'p2', alive: true, ageAttained: 81 },
      ],
      balances: { trad: 600_000 },
    },
    {
      year: 2040,
      filingStatus: 'single',
      magi: 150_000,
      irmaaTier: 0,
      people: [
        { personId: 'p1', alive: true, ageAttained: 80 },
        { personId: 'p2', alive: false, ageAttained: 82 },
      ],
      balances: { trad: 600_000 },
    },
  ]
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: { years },
      deflate: (_year: number, amount: number) => amount * (4 / 5),
    },
  } as unknown as DetectorContext
}

describeCalculation(
  'insight-widows-penalty-bracket-jump',
  {
    example: {
      inputs: {
        firstSingleFiledSurvivorYear: 2040,
        magi: 150_000,
        federalTaxSingle: 28_000,
        federalTaxMfj: 18_000,
        deflationFactor: 0.8,
      },
      expected: { bracketJumpToday: 8_000 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/insights/insight-widows-penalty-bracket-jump.md',
    mutation: 'DOCS/calculations/insights/insight-widows-penalty-bracket-jump.mutation.md',
  },
  ({ example }) => {
    it('deflates the $10,000 nominal jump by 4/5 to $8,000 today', () => {
      const card = widowsPenalty.screen(context())
      expect(card).not.toBeNull()
      const row = card!.evidence.find((entry) => entry.label === 'Estimated survivor bracket jump')
      if (row === undefined) throw new Error('missing bracket-jump evidence')
      const jump = Number(row.value.replace(/[$,]/gu, ''))
      const expected = example.expected.bracketJumpToday as number
      expect(
        withinTolerance(jump, expected, example.tolerance),
        `bracketJumpToday ${jump} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
