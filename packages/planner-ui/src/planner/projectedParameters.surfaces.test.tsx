/** @vitest-environment jsdom */
/**
 * Every surface that says which parameter years are projected says it, and an
 * example's labels name 2026 (decision D-2027-ROLLOVER; review L10,
 * 2026-09-29).
 *
 * The review found the words themselves pinned (`projectedParameters.test.ts`)
 * but not one surface that prints them: removing the Results year cell's mark
 * (I04), the ledger CSV's "Parameter figures" value (I06), the Assumptions hint
 * (I07), the export text line (I08) or the Optimizer sentence (I09) failed no
 * test, nor did the mark's "some component is projected" test reading "more
 * than one" (I01), nor an example's dollar label reading "today's" (A07). Each
 * surface is checked against the helper's own output, so a rewording of the
 * sentence moves the helper's test, not these.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { withParameterComponents } from '@retiregolden/engine/params'
import { landedComponents } from '@retiregolden/engine/testing/parameterLanding'

import { projectPlan } from '../projection'
import { startYearAsOf, startYearAsOfShort, startYearDollarsWord, startYearDollarsWordCapitalized } from '../startYear'
import { createSamplePlan } from '../testSupport/samplePlan'
import { mountPlanPage, yearTable } from '../testSupport/resultsPageMount'
import { waitFor } from '../testSupport/settle'
import { assumptionsExportText, buildAssumptionsSnapshot } from './assumptionsExport'
import { OptimizePage } from './OptimizePage'
import {
  isParameterYearProjected,
  parameterFiguresCsvValue,
  projectedComponentsIn,
  projectedParametersSentence,
} from './projectedParameters'
import { DisclaimerPage } from './DisclaimerPage'
import { ProvenancePanel } from './ProvenancePanel'
import { ResultsPage } from './ResultsPage'
import { buildLedgerCsv } from './resultsRows'
import { AssumptionsSection } from './sections/AssumptionsSection'

vi.mock('./useMcSuccessRate', async (importOriginal) => {
  const original = await importOriginal<typeof import('./useMcSuccessRate')>()
  return { ...original, useMcSuccessRateState: () => ({ rate: null, status: 'running', pathCount: 1_000, failureReason: null }) }
})
vi.mock('../optimize/runner', () => ({ runOptimize: vi.fn() }))

const START_YEAR = 2026

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 6, 1, 12))
})

afterAll(() => {
  vi.useRealTimers()
})

describe('an example names its year where a user plan says today (A07)', () => {
  it('reads 2026 for an example and today for a user plan', () => {
    expect(startYearDollarsWord({ origin: 'example' })).toBe('2026')
    expect(startYearDollarsWord({ origin: 'user' })).toBe("today's")
    expect(startYearDollarsWordCapitalized({ origin: 'example' })).toBe('2026')
    expect(startYearDollarsWordCapitalized({ origin: 'user' })).toBe("Today's")
    expect(startYearAsOf({ origin: 'example' })).toBe('the start of 2026')
    expect(startYearAsOf({ origin: 'user' })).toBe('today')
    expect(startYearAsOfShort({ origin: 'example' })).toBe('start of 2026')
  })
})

describe('a year with one publisher still projected is marked (I01)', () => {
  it('marks 2027 while CMS alone is projected, and not once CMS lands too', () => {
    const allButMedicare = landedComponents(['irsIncomeTax', 'irsRetirementPlanLimits', 'irsHsaLimits', 'ssaProgram'], 2027)
    withParameterComponents(allButMedicare, () => {
      expect(projectedComponentsIn(2027).map((component) => component.key)).toEqual(['cmsMedicare'])
      expect(isParameterYearProjected(2027)).toBe(true)
    })
    const all = landedComponents(['irsIncomeTax', 'irsRetirementPlanLimits', 'irsHsaLimits', 'ssaProgram', 'cmsMedicare'], 2027)
    withParameterComponents(all, () => {
      expect(isParameterYearProjected(2027)).toBe(false)
    })
  })
})

describe('the surfaces print it', () => {
  const plan = createSamplePlan()

  it('the ledger CSV’s last column is each year’s value (I06)', () => {
    const lines = buildLedgerCsv(plan, projectPlan(plan, START_YEAR)).split('\n')
    expect(lines[0]!.split(',').at(-1)).toBe('Parameter figures')
    const lastColumn = (year: number) => lines.find((line) => line.startsWith(`${year},`))!.split(',').at(-1)
    expect(lastColumn(2026)).toBe(parameterFiguresCsvValue(2026))
    expect(lastColumn(2027)).toBe(parameterFiguresCsvValue(2027))
    expect(lastColumn(2027)).not.toBe(lastColumn(2026))
  })

  it('the assumptions export text carries the sentence (I08)', () => {
    const sentence = projectedParametersSentence(START_YEAR, plan.assumptions)
    expect(sentence).not.toBeNull()
    expect(assumptionsExportText(buildAssumptionsSnapshot(plan, START_YEAR))).toContain(sentence!)
  })

  it('Results marks each projected year’s cell and not the published ones (I04)', async () => {
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      await waitFor(() => page.container.querySelector('#year-table table.year-table') !== null, { what: 'the year table' })
      const table = yearTable(page.container)
      const yearCell = (year: number) => table.cell(year, table.headers[0]!)
      expect(yearCell(2026).classList.contains('year-table-year--projected')).toBe(false)
      expect(yearCell(2027).classList.contains('year-table-year--projected')).toBe(true)
    } finally {
      await page.unmount()
    }
  })

  it('the Assumptions hint carries the sentence (I07)', async () => {
    const sentence = projectedParametersSentence(START_YEAR, plan.assumptions)!
    const page = await mountPlanPage(plan, <AssumptionsSection />, `/plan/${plan.id}/assumptions`)
    try {
      expect(page.container.textContent).toContain(sentence)
    } finally {
      await page.unmount()
    }
  })

  it('the Optimizer carries the sentence (I09)', async () => {
    const sentence = projectedParametersSentence(START_YEAR, plan.assumptions)!
    const page = await mountPlanPage(plan, <OptimizePage />, `/plan/${plan.id}/optimize`)
    try {
      expect(page.container.querySelector('.optimize-projected-parameters')?.textContent).toBe(sentence)
    } finally {
      await page.unmount()
    }
  })
})

describe('the Disclaimer and its source panel say what is loaded, and how later years grow (review M2)', () => {
  it('the panel titles the column "Loaded for" and lists the 2027 HSA limits as loaded', async () => {
    const page = await mountPlanPage(createSamplePlan(), <ProvenancePanel />, '/disclaimer')
    try {
      const table = page.container.querySelector('table.provenance-years')!
      expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toContain('Loaded for')
      const hsa = [...table.querySelectorAll('tbody tr')].find((row) => row.querySelector('.provenance-label')?.textContent === 'HSA limits')
      expect(hsa?.querySelectorAll('td')[0]?.textContent).toBe('2026, 2027')
      expect(page.container.textContent).toContain('once RetireGolden has loaded them')
      expect(page.container.textContent).toContain('Medicare premiums at its healthcare inflation')
      // The second verification's V4: the intro sat above 2027 and later rows
      // and called every figure "the ones loaded for 2026".
      expect(page.container.textContent).toContain("the first table's Loaded for column gives the years loaded")
      expect(page.container.textContent).not.toContain('the ones loaded for 2026')
    } finally {
      await page.unmount()
    }
  })

  it('the Disclaimer says later years use loaded figures, and that state figures are enacted or held', async () => {
    const page = await mountPlanPage(createSamplePlan(), <DisclaimerPage />, '/disclaimer')
    try {
      const text = page.container.textContent ?? ''
      expect(text).toContain("A later year uses an agency's figures once RetireGolden has loaded them")
      expect(text).toContain('and Medicare premiums at its healthcare inflation')
      expect(text).toContain("State income tax uses each state's enacted schedules where RetireGolden has loaded them")
      expect(text).toContain('held without growth')
      expect(text).toContain("one the state's own statute indexes (the District of Columbia's, Washington's) grows at the plan's")
      expect(text).not.toContain('once it is out')
    } finally {
      await page.unmount()
    }
  })
})
