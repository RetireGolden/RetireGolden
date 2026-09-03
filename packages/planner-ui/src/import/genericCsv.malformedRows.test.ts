/**
 * Rows the generic CSV analysis cannot map are reported, never dropped in
 * silence (#557). A row below the header whose cells never read as money used
 * to vanish before the mapping loop: the wizard counted only the rows that
 * survived, and the review checklist listed nothing for the one that did not.
 * The analyzer sorts none of them: an account whose amount cell is blank
 * (`I-bonds,`) and a footer (`Prepared by Chase,`) look the same to it, so
 * every such row is set aside, listed by source row, and given a conditional
 * remediation rather than a guess about which it was. Row numbers are source
 * lines (blank lines count), lists are capped, and a sheet with no dollar
 * value at all still names its rows in the failure.
 */

import { describe, expect, it } from 'vitest'

import {
  analyzeGenericCsv,
  describeCsvRowCells,
  describeSetAsideRows,
  draftPlanFromGenericCsv,
  MAX_CELL_PREVIEW_CHARS,
  MAX_CELLS_PREVIEWED,
  MAX_SET_ASIDE_ITEMS,
  MAX_SET_ASIDE_LISTED,
  previewCell,
} from './genericCsv'

let n = 0
const testIds = () => `mr-${++n}`

// One good row, one row whose type, owner, and balance are all words.
const ONE_GOOD_ONE_MALFORMED = `Account,Type,Owner,Balance
Brokerage,Taxable,Sam,"$120,000"
Mystery,???,nobody,abc
`

// A good row, then every shape the analyzer cannot tell apart: two set-aside
// rows sharing a first cell, a truncated account row, a lone footer cell, a
// fund whose name starts with "Total", and a legend line.
const MIXED = `Account,Type,Balance
Brokerage,Taxable,"$120,000"
Notes,first note,n/a
Notes,second note,tbd
I-bonds,,
Prepared by Chase on 12/31/2025,,
Total Bond Market,Vanguard,n/a
Legend,green = good,
`

/** A sheet with `count` text-only rows after one good row, numbered from line 3. */
function manyTextRows(count: number): string {
  const lines = ['Account,Balance', 'Brokerage,"$120,000"']
  for (let i = 0; i < count; i++) lines.push(`Note ${i + 1},see below`)
  return lines.join('\n') + '\n'
}

describe('generic CSV import — rows with no dollar value (#557)', () => {
  it('the analysis sets the malformed row aside with its source row number instead of dropping it', () => {
    const r = analyzeGenericCsv(ONE_GOOD_ONE_MALFORMED)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.analysis.dataRows).toHaveLength(1)
    expect(r.analysis.dataRowNumbers).toEqual([2])
    expect(r.analysis.skippedRows).toEqual([{ rowNumber: 3, cells: ['Mystery', '???', 'nobody', 'abc'] }])
  })

  it('the draft lists the malformed row as skipped, led by its row number, with the reason and a whole-row locator', () => {
    const r = analyzeGenericCsv(ONE_GOOD_ONE_MALFORMED)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    // The good row still imports on its own.
    expect(d.plan.accounts).toHaveLength(1)
    expect(d.plan.accounts[0].name).toBe('Brokerage')
    const skipped = d.review.filter((item) => item.status === 'skipped')
    expect(skipped).toHaveLength(1)
    expect(skipped[0].source).toBe('Row 3: Mystery')
    expect(skipped[0].detail).toContain('No cell in this row read as a dollar value')
    // Conditional remediation: neither "it is a note" nor "it is an account".
    expect(skipped[0].detail).toContain('A note or footer needs nothing')
    expect(skipped[0].detail).toContain('an account whose amount is missing can be entered on the Accounts screen')
    // The row, not a column: no cell in it read as a figure, and the balance
    // column may have been re-assigned by hand.
    expect(skipped[0].locator).toEqual({ kind: 'csvRow', row: 3 })
    expect(skipped[0].confidence).toBe('unmapped')
  })

  it('sets aside every text-only row alike, account-shaped or footer-shaped, each by its own row number', () => {
    const r = analyzeGenericCsv(MIXED)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.analysis.dataRowNumbers).toEqual([2])
    // A truncated account (`I-bonds,`), a footer, a fund named "Total…", and a
    // legend line are all set aside: nothing here calls any of them a note.
    expect(r.analysis.skippedRows!.map((row) => row.rowNumber)).toEqual([3, 4, 5, 6, 7, 8])
    expect((r.analysis as { ignoredRows?: unknown }).ignoredRows).toBeUndefined()

    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    const skipped = d.review.filter((item) => item.status === 'skipped')
    // Two "Notes" lines stay distinguishable by their row numbers; the
    // I-bonds row is pointed at the Accounts screen like every other.
    const expected: Array<[number, string]> = [
      [3, 'Notes'],
      [4, 'Notes'],
      [5, 'I-bonds'],
      [6, 'Prepared by Chase on 12/31/2025'],
      [7, 'Total Bond Market'],
      [8, 'Legend'],
    ]
    expect(skipped.map((item) => item.source)).toEqual(expected.map(([row, label]) => `Row ${row}: ${label}`))
    expect(skipped.map((item) => item.locator)).toEqual(expected.map(([row]) => ({ kind: 'csvRow', row })))
    for (const item of skipped) expect(item.detail).toContain('Accounts screen')
  })

  it('numbers rows by source line, so a blank separator line does not shift what the person is told', () => {
    // Blank line between the header and the data, and another before the note.
    const r = analyzeGenericCsv('Account,Balance\n\nBrokerage,"$120,000"\n\n\nI-bonds,\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.analysis.dataRowNumbers).toEqual([3])
    expect(r.analysis.skippedRows).toEqual([{ rowNumber: 6, cells: ['I-bonds', ''] }])
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    const skipped = d.review.filter((item) => item.status === 'skipped')
    expect(skipped.map((item) => item.source)).toEqual(['Row 6: I-bonds'])
    expect(skipped[0].locator).toEqual({ kind: 'csvRow', row: 6 })
  })

  it('a sheet with no dollar value below its header fails, and the failure still names the rows', () => {
    const r = analyzeGenericCsv('Account,Type,Balance\nI-bonds,,\nPrepared by Chase,,\n')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.message).toContain('A header row (Account, Type, Balance) was found, but no row below it has a dollar value.')
    expect(r.message).toContain('2 rows with no dollar value in any column were set aside: Row 2: I-bonds; Row 3: Prepared by Chase.')
  })

  it('caps the text-only failure list like the map step, counting the rest', () => {
    const lines = ['Account,Balance']
    for (let i = 0; i < MAX_SET_ASIDE_LISTED + 3; i++) lines.push(`Note ${i + 1},x`)
    const r = analyzeGenericCsv(lines.join('\n') + '\n')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.message).toContain(`Row ${MAX_SET_ASIDE_LISTED + 1}: Note ${MAX_SET_ASIDE_LISTED} · x; and 3 more (rows ${MAX_SET_ASIDE_LISTED + 2} to ${MAX_SET_ASIDE_LISTED + 4})`)
    expect(r.message).not.toContain(`Note ${MAX_SET_ASIDE_LISTED + 1} `)
  })

  it('folds set-aside rows past the checklist cap into one counted, ranged entry', () => {
    const count = MAX_SET_ASIDE_ITEMS + 7
    const r = analyzeGenericCsv(manyTextRows(count))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.analysis.skippedRows).toHaveLength(count)
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    const skipped = d.review.filter((item) => item.status === 'skipped')
    expect(skipped).toHaveLength(MAX_SET_ASIDE_ITEMS + 1)
    expect(skipped[0].source).toBe('Row 3: Note 1')
    expect(skipped[MAX_SET_ASIDE_ITEMS - 1].source).toBe(`Row ${MAX_SET_ASIDE_ITEMS + 2}: Note ${MAX_SET_ASIDE_ITEMS}`)
    const rest = skipped[MAX_SET_ASIDE_ITEMS]
    expect(rest.source).toBe(`7 more rows (rows ${MAX_SET_ASIDE_ITEMS + 3} to ${count + 2})`)
    expect(rest.detail).toContain('Accounts screen')
    expect(rest.locator).toEqual({ kind: 'none', note: `7 further rows with no dollar value (rows ${MAX_SET_ASIDE_ITEMS + 3} to ${count + 2})` })
  })

  it('keeps the set-aside disclosure when no row maps to an account', () => {
    const r = analyzeGenericCsv('Account,Balance,Note\nCash,-100,x\nMystery,abc,y\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(false)
    if (d.ok) return
    expect(d.message).toContain('No rows with a readable balance')
    expect(d.message).toContain('1 row with no dollar value in any column was set aside: Row 3: Mystery · abc · y.')
  })

  it('caps the set-aside list in the no-account failure message like every other surface', () => {
    const count = MAX_SET_ASIDE_LISTED + 5
    const lines = ['Account,Balance', 'Cash,-100']
    for (let i = 0; i < count; i++) lines.push(`Note ${i + 1},x`)
    const r = analyzeGenericCsv(lines.join('\n') + '\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(false)
    if (d.ok) return
    expect(d.message).toContain(`${count} rows with no dollar value in any column were set aside: Row 3: Note 1 · x;`)
    expect(d.message).toContain(`and 5 more (rows ${MAX_SET_ASIDE_LISTED + 3} to ${count + 2}).`)
    expect(d.message).not.toContain(`Note ${MAX_SET_ASIDE_LISTED + 1} `)
  })

  it('says a row range only when the overflow rows sit together', () => {
    // Every other row imports, so the rows past the cap are scattered.
    const lines = ['Account,Balance']
    for (let i = 0; i < MAX_SET_ASIDE_ITEMS + 4; i++) {
      lines.push(`Note ${i + 1},x`)
      lines.push(`Fund ${i + 1},100`)
    }
    const r = analyzeGenericCsv(lines.join('\n') + '\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    const rest = d.review.filter((item) => item.status === 'skipped')[MAX_SET_ASIDE_ITEMS]
    expect(rest.source).toBe('4 more rows')
    expect(rest.locator).toEqual({ kind: 'none', note: '4 further rows with no dollar value' })
    const scattered = r.analysis.skippedRows!.slice(MAX_SET_ASIDE_LISTED)
    expect(describeSetAsideRows(r.analysis.skippedRows!)).toMatch(new RegExp(`; and ${scattered.length} more$`))
  })

  it('bounds each echoed cell so a huge cell never becomes a huge label', () => {
    const long = 'x'.repeat(500)
    const r = analyzeGenericCsv(`Account,Balance\nCash,100\n${long},words\n`)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const shown = describeCsvRowCells(r.analysis.skippedRows![0])
    expect(shown).toBe(`${'x'.repeat(MAX_CELL_PREVIEW_CHARS - 1)}… · words`)
    expect(shown.length).toBeLessThan(MAX_CELL_PREVIEW_CHARS + 10)
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    const item = d.review.find((i) => i.status === 'skipped')!
    expect(item.source).toBe(`Row 3: ${'x'.repeat(MAX_CELL_PREVIEW_CHARS - 1)}…`)
    // Short cells are untouched.
    expect(previewCell('  Brokerage ')).toBe('Brokerage')
  })

  it('names the header in a text-only failure only when its labels named recognised columns', () => {
    // A multi-cell title line above the real header: the title must not be
    // reported as the header with the header set aside beneath it.
    const titled = analyzeGenericCsv('My net worth,as of year end\nAccount,Type,Balance\nI-bonds,,\n')
    expect(titled.ok).toBe(false)
    if (titled.ok) return
    expect(titled.message).toContain('A header row (Account, Type, Balance) was found')
    // The title line above the header is set aside too; the header is not.
    expect(titled.message).toContain('2 rows with no dollar value in any column were set aside: Row 1: My net worth · as of year end; Row 3: I-bonds.')
    expect(titled.message).not.toContain('Row 2: Account')
    // No row names a column the analyzer knows: say so rather than crown one.
    const junk = analyzeGenericCsv('just,words\nno,numbers\n')
    expect(junk.ok).toBe(false)
    if (junk.ok) return
    expect(junk.message).toContain('No header row was recognised')
    expect(junk.message).toContain('Row 2: no · numbers')
  })

  it('an analysis built without the field still drafts (additive contract)', () => {
    const d = draftPlanFromGenericCsv(
      { header: ['Account', 'Balance'], dataRows: [['Cash', '100']], guessedRoles: ['name', 'balance'] },
      ['name', 'balance'],
      testIds,
    )
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.review.filter((item) => item.status === 'skipped')).toHaveLength(0)
  })

  it('formats rows and cells the way the wizard shows them', () => {
    const row = (rowNumber: number, ...cells: string[]) => ({ rowNumber, cells })
    expect(describeCsvRowCells({ rowNumber: 3, cells: [' Mystery ', '', '???', 'abc'] })).toBe('Mystery · ??? · abc')
    expect(describeSetAsideRows([row(3, 'a'), row(4, 'b'), row(12, 'c')], 2)).toBe('Row 3: a; Row 4: b; and 1 more')
    expect(describeSetAsideRows([row(3, 'a'), row(4, 'b'), row(5, 'c'), row(6, 'd')], 2)).toBe('Row 3: a; Row 4: b; and 2 more (rows 5 to 6)')
    expect(describeSetAsideRows([row(3, 'a'), row(4, 'b'), row(5, 'c'), row(9, 'd')], 2)).toBe('Row 3: a; Row 4: b; and 2 more')
    expect(describeSetAsideRows([row(3, 'a')], 2)).toBe('Row 3: a')
  })
})

describe('generic CSV import — bounds and completeness of what is echoed back (#557 review)', () => {
  it('bounds a preview per row as well as per cell: at most MAX_CELLS_PREVIEWED cells, then an ellipsis', () => {
    const wide = Array.from({ length: MAX_CELLS_PREVIEWED + 5 }, (_, i) => `c${i + 1}`)
    const shown = describeCsvRowCells({ rowNumber: 3, cells: wide })
    expect(shown).toBe(`${wide.slice(0, MAX_CELLS_PREVIEWED).join(' · ')} · …`)
    // Exactly the cap: no ellipsis, nothing dropped.
    expect(describeCsvRowCells({ rowNumber: 3, cells: wide.slice(0, MAX_CELLS_PREVIEWED) })).toBe(wide.slice(0, MAX_CELLS_PREVIEWED).join(' · '))
    // A row of the widest allowed shape stays a bounded string.
    const huge = Array.from({ length: 100 }, () => 'x'.repeat(500))
    expect(describeCsvRowCells({ rowNumber: 3, cells: huge }).length).toBeLessThan((MAX_CELL_PREVIEW_CHARS + 3) * (MAX_CELLS_PREVIEWED + 1))
  })

  it('a sheet that imports still sets aside the rows above its header, by spreadsheet row, on the map step and the checklist', () => {
    const r = analyzeGenericCsv('My net worth,as of year end\n\nAccount,Type,Balance\nBrokerage,Taxable,"$120,000"\nI-bonds,,\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.analysis.header).toEqual(['Account', 'Type', 'Balance'])
    expect(r.analysis.dataRowNumbers).toEqual([4])
    // The title line (row 1; row 2 is blank) comes first, then the row below the header.
    expect(r.analysis.skippedRows).toEqual([
      { rowNumber: 1, cells: ['My net worth', 'as of year end'] },
      { rowNumber: 5, cells: ['I-bonds', '', ''] },
    ])
    const d = draftPlanFromGenericCsv(r.analysis, r.analysis.guessedRoles, testIds)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.plan.accounts.map((a) => a.name)).toEqual(['Brokerage'])
    expect(d.review.filter((item) => item.status === 'skipped').map((item) => item.source)).toEqual(['Row 1: My net worth', 'Row 5: I-bonds'])
  })

  it('a text-only failure names the rows above the recognised header too, not only those below it', () => {
    const r = analyzeGenericCsv('Title line,for the sheet\nnote about nothing,x\nAccount,Type,Balance\nI-bonds,,\n')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.message).toContain('A header row (Account, Type, Balance) was found')
    expect(r.message).toContain(
      '3 rows with no dollar value in any column were set aside: Row 1: Title line · for the sheet; Row 2: note about nothing · x; Row 4: I-bonds.',
    )
    expect(r.message).not.toContain('Row 3')
  })
})
