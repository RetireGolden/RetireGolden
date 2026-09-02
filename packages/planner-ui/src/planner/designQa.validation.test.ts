/**
 * Source and stylesheet pins for the validation chrome (#452, #459, #476,
 * #494). Behaviour is covered in validationChrome.test.tsx; these hold the
 * pieces jsdom cannot see.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

describe('validation chrome pins', () => {
  it('invalid controls and their messages use the danger token; the save chip is a button that jumps', () => {
    const css = read('./planner.css')
    expect(css).toMatch(/\.field input\[aria-invalid='true'\],\n\.field select\[aria-invalid='true'\] \{\s*border-color: var\(--bad\)/)
    expect(css).toMatch(/\.field-error \{[^}]*color: var\(--bad\)/)
    expect(css).toMatch(/\.save-state--button \{[^}]*cursor: pointer/)
    expect(css).toMatch(/\.save-state--button \{[^}]*border: 0;[^}]*background: none;/)
    expect(css).toMatch(/\.field--invalid > \.field-label-row > \.field-label \{\s*color: var\(--bad\)/)
    expect(css).toMatch(/\.issue-list:focus \{\s*outline: 2px solid var\(--accent\)/)
    // The chip is a button, so keyboard focus is visible on it too (r1-8), and
    // `font: inherit` does not cost it the size every save state shares (r2-5).
    expect(css).toMatch(/\.save-state--button:focus-visible \{\s*outline: 2px solid var\(--accent\)/)
    expect(css).toMatch(/\.save-state--button \{[^}]*font: inherit;\s*font-size: 0\.85rem;/)
    // A rejected block is outlined in the danger token at rest, as an invalid input is bordered (r2-6).
    expect(css).toMatch(/\.field\[role='group'\]\[aria-invalid='true'\] \{\s*outline: 1px solid var\(--bad\)/)
    // A whole block the engine rejected (the cash-value schedule) takes focus.
    expect(css).toMatch(/\.field--invalid\[tabindex\]:focus \{\s*outline: 2px solid var\(--bad\)/)
    // An accepted-and-adjusted value reads as a note, not a fault (r1-2).
    expect(css).toMatch(/\.field-note \{[^}]*color: var\(--muted\)/)
    // A diff chip wraps inside its cell instead of stretching the table (r1-9).
    expect(css).toMatch(/\.diff-chip \{[^}]*overflow-wrap: anywhere/)
    expect(css).not.toMatch(/\.diff-chip \{[^}]*white-space: nowrap/)
    const workspace = read('./PlanWorkspace.tsx')
    expect(workspace).toContain('const target = `/plan/${plan.id}/${route}`')
    expect(workspace).toContain('navigate(target)')
    expect(workspace).toContain('className="save-state save-state--error save-state--button"')
    // The chip goes somewhere even when nothing is placeable (r1-4), the retry
    // loop is cancellable (r1-6), and hovering it describes the jump, not
    // where the plan is stored (r1-15).
    expect(workspace).toContain('const route = routeForIssues(issues)')
    // The retry is scoped to the plan outlet and cancelled by a route change,
    // by focus moving to a control the person chose, and on unmount (r2-1, r2-3).
    expect(workspace).toContain('focusIssueTarget(workspaceRoot(), section, path)')
    expect(workspace).toContain('if (pendingJump.current && pendingJump.current.target !== pathname) cancelJump()')
    expect(workspace).toContain('useEffect(() => cancelJump, [])')
    expect(workspace).toContain('retryFocus(workspaceRoot, section, path, focusMoved)')
    expect(workspace).toContain('title="Go to the first thing to fix. The plan is stored once it is valid."')
  })

  it('every plan section, Social Security included, scopes its issue list, and Strategy lists above its cards', () => {
    const sections = ['Accounts', 'Assumptions', 'Household', 'IncomeFloor', 'Income', 'Insurance', 'Spending', 'Strategy']
    for (const name of sections) {
      const src = read(`./sections/${name}Section.tsx`)
      expect(src, name).toMatch(/<Issues section="[a-z-]+" \/>/)
      expect(src, name).not.toContain('<Issues />')
    }
    expect(read('./SocialSecuritySection.tsx')).toContain('<Issues section="social-security" />')
    const strategy = read('./sections/StrategySection.tsx')
    expect(strategy.indexOf('<Issues section="strategy" />')).toBeLessThan(strategy.indexOf('<div className="card">'))
  })

  it('the fields the walk cited carry their schema path, so the engine issue lands beside them', () => {
    const pins: Array<[string, string[]]> = [
      ['./sections/StrategySection.tsx', [
        'path="strategies.qcdAnnual"',
        'path="strategies.taxableSafetyNetFloor"',
        'path="strategies.itemizedDeductions.stateAndLocalTaxes"',
        'path="strategies.rothConversion.targetValue"',
        'path="strategies.rothConversion.startYear"',
        'path="strategies.rothConversion.endYear"',
      ]],
      ['./sections/AssumptionsSection.tsx', [
        'path="assumptions.localIncomeTaxPct"',
        'path="assumptions.stateEffectiveTaxPct"',
        'path="assumptions.inflationPct"',
        'path="assumptions.healthcareExtraInflationPct"',
        'path="assumptions.defaultReturnPct"',
        'path="assumptions.heirTaxRatePct"',
      ]],
      ['./sections/HouseholdSection.tsx', [
        'path={`household.people.${i}.longevity.planningAge`}',
        'path={`household.people.${i}.retirementAge`}',
      ]],
      // The ladder row is addressed by id (#512), so its field paths carry the
      // index the issues were computed against, via one helper.
      ['./sections/IncomeFloorSection.tsx', [
        'const fieldPath = (leaf: string) =>',
        "path={fieldPath('startYear')}",
        "path={fieldPath('endYear')}",
      ]],
      ['./sections/SpendingSection.tsx', [
        'path="expenses.baseAnnual"',
        'path={`expenses.phases.${i}.fromAge`}',
        'path={`expenses.phases.${i}.multiplier`}',
        'path={`expenses.oneTimeGoals.${i}.label`}',
        'path={`expenses.oneTimeGoals.${i}.year`}',
        'path={`expenses.oneTimeGoals.${i}.amount`}',
      ]],
      ['./sections/InsuranceSection.tsx', [
        'path={`insurance.${index}.premiumEndAge`}',
        'path={`insurance.${index}.cashValueGrowthPct`}',
        'useFieldIssue(`insurance.${index}.cashValueSchedule`)',
        'path={`careEvents.${index}.durationYears`}',
      ]],
      ['./sections/AccountEditorSharedFields.tsx', ['path={`accounts.${index}.balance`}']],
      ['./sections/PropertyDebtAccountEditors.tsx', [
        'path={`accounts.${index}.payoffYear`}',
        'path={`accounts.${index}.plannedSaleYear`}',
        'path={`accounts.${index}.interestPct`}',
      ]],
      ['./sections/LiquidAccountEditors.tsx', [
        'path={`accounts.${index}.dividendYieldPct`}',
        'path={`accounts.${index}.qualifiedRatio`}',
      ]],
      ['./sections/IncomeSection.tsx', [
        'path={`incomes.${index}.annualGross`}',
        'path={`incomes.${index}.endAge`}',
        'path={`incomes.${index}.startYear`}',
        'path={`incomes.${index}.endYear`}',
      ]],
      ['./SocialSecuritySection.tsx', [
        'path={`incomes.${streamIndex}.claimAge.years`}',
        'path={`incomes.${streamIndex}.claimAge.months`}',
      ]],
    ]
    for (const [file, paths] of pins) {
      const src = read(file)
      for (const p of paths) expect(src, `${file} ${p}`).toContain(p)
    }
  })

  it('scenario field lists never show raw pointer or dotted paths (#459)', () => {
    const scenarios = read('./ScenariosPage.tsx')
    expect(scenarios).not.toContain("preview.operationPaths.join(', ')")
    expect(scenarios).not.toContain("d.path.split('.').slice(-2)")
    expect(scenarios).toContain('{preview.operationPaths.map(fieldName)')
    expect(scenarios).toContain('{fieldName(d.path)}')
  })
})
