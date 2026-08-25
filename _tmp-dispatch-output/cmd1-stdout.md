# Re-verification dispatch: irc-4974-rmd-shortfall-excise-tax (generated 2026-08-25)

## Setup

- Repository: https://github.com/RetireGolden/RetireGolden
- Create a worktree/branch from `origin/main`.
- Enable Corepack and use pnpm (`corepack enable`).
- Read `AGENTS.md` first.
- The rule registry lives at `packages/engine/src/rules/taxRuleRegistry.ts`; each rule below is one record keyed by its id.

## The binding edit order

Follow this order imperatively for every rule below:

1. Re-read each cited authority at its URL.
2. Update the **registry record first** (`quotedText`, `authority`, `verifiedOn`, `effectiveFrom`/`effectiveThrough`, `classification` as facts require — `verifiedOn` must be bumped even when nothing changed) — including ADDING authority entries when a statement makes a claim the current quotes do not cover (sufficiency, not just fidelity: see `DOCS/operations/authority-sufficiency.md`). Set `verifiedOn` to the UTC date (YYYY-MM-DD) you finished re-reading the authorities.
3. Rewrite or confirm the discriminating fixture **from the authority** (never from code; fixtures name two candidate readings with different values). `fixtureFiles` below lists the files whose `describeRule(<id>)` blocks are this rule's discriminating fixtures — those blocks are the contract; other tests in the same files are ordinary coverage.
4. Only then change implementation until the fixture passes.

## Verification checklist

- `pnpm --filter @retiregolden/engine test`
- Quote-fidelity re-check: `pnpm verify:quotes -- --filter irc-4974-rmd-shortfall-excise-tax --refresh` (network, manual; see `DOCS/operations/quote-fidelity.md`)
- If any result moves: run `cases:diff`, review every delta, and add a `CHANGELOG.md` entry announcing the correction — corrections are announced, never silent.
- `pnpm rules:coverage` and commit the refreshed `DOCS/operations/rule-coverage.md` and `rule-coverage.json` (`verifiedOn` changes them)
- Confirm no other open PR changes the registry file: for each PR in `gh pr list --state open --json number -q .[].number`, run `gh pr diff <n> --name-only` and require zero hits for `taxRuleRegistry.ts` before pushing.
- One PR; review-bot findings fixed on the same branch

## irc-4974-rmd-shortfall-excise-tax

**Statement:** A payee who takes less than the required minimum distribution by its statutory deadline owes an excise tax of 25 percent of the shortfall, not of the whole required amount when part was paid. Ten percent applies only if the whole shortfall is distributed from the same applicable plan or legally aggregable plan group and a return reflecting the reduced tax is filed inside the correction window, which ends at the earliest of notice-of-deficiency mailing, assessment, or the end of the second taxable year beginning after the tax year. A reasonable-error waiver request does not set the tax to zero; an explicit modeled grant does. For tax years beginning in 2025 or later, the final regulation supplies only two automatic-waiver fact patterns: an eligible designated beneficiary whose owner died before the required beginning date and who defaulted to life expectancy without an affirmative election then timely elects the 10-year rule, and a beneficiary who timely corrects the decedent’s year-of-death miss. A first-year amount deferred to April 1 creates no excise in the attainment year; a miss is taxed in the RBD year alongside any separate current-year shortfall. If a balance remains after a 5-year or 10-year emptying deadline, the entire remaining benefit is required in that deadline year and every subsequent year. The engine prices each computed applicable-plan shortfall on the year row’s penalties channel, defaults to 25 percent, and exposes explicit correction and waiver evidence seams. The tax remains outside tax, AGI and MAGI; corrective-distribution evidence prices relief only and never fabricates the separate account movement or its income character.

**Classification:** settled; convention rationale: The law fixes the arithmetic, applicable-plan restriction, correction-window endpoints, and relief fact patterns. Three implementation choices remain. First, ordinary employer plans fail closed per account; only an account explicitly classified as a 403(b) joins the owner’s other explicit 403(b)s. Second, inherited IRAs join only when the Plan carries the same explicit decedentId; absent identity fails closed per account, because matching birth/death facts cannot prove one decedent. Third, correction and waiver inputs are evidence, not money movements. The §4974 calculator therefore cannot manufacture a distribution, tax character, or cash flow: callers model the corrective distribution separately in the year received and use the evidence seam only to price the original excise. That separation keeps the chapter 43 tax out of MAGI and prevents a correction from silently satisfying a current-year RMD while proposed §1.401(a)(9)-5(g)(2)(iv) remains reserved in the final regulations.
**Jurisdiction:** federal | **Volatility:** staticStatute | **Verified on:** 2026-08-21 | **Due on:** 2027-08-21
**Effective:** 2023 (no end)

### Authority: statute — IRC 4974(a)

URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleD-chap43-sec4974.htm

> If the amount distributed during the taxable year of the payee under any qualified retirement plan or any eligible deferred compensation plan (as defined in section 457(b)) is less than the minimum required distribution for such taxable year, there is hereby imposed a tax equal to 25 percent of the amount by which such minimum required distribution exceeds the actual amount distributed during the taxable year. The tax imposed by this section shall be paid by the payee.

### Authority: statute — IRC 4974(e)(1)

URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleD-chap43-sec4974.htm

> In the case of a taxpayer who— (A) receives a distribution, during the correction window, of the amount which resulted in imposition of a tax under subsection (a) from the same plan to which such tax relates, and (B) submits a return, during the correction window, reflecting such tax (as modified by this subsection), the first sentence of subsection (a) shall be applied by substituting “10 percent” for “25 percent”.

### Authority: statute — IRC 4974(d)

URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleD-chap43-sec4974.htm

> If the taxpayer establishes to the satisfaction of the Secretary that— (1) the shortfall described in subsection (a) in the amount distributed during any taxable year was due to reasonable error, and (2) reasonable steps are being taken to remedy the shortfall, the Secretary may waive the tax imposed by subsection (a) for the taxable year.

### Authority: regulation — Treas. Reg. 54.4974-1(a)(2)(iii)

URL: https://www.law.cornell.edu/cfr/text/26/54.4974-1

> For purposes of paragraph (a)(2) of this section, the correction window ends on the earliest of— (A) The date a notice of deficiency under section 6212 with respect to the tax imposed by section 4974(a) is mailed; (B) The date on which the tax imposed by section 4974(a) is assessed; or (C) The last day of the second taxable year that begins after the end of the taxable year in which the tax under section 4974(a) is imposed.

### Authority: regulation — Treas. Reg. 54.4974-1(e)

URL: https://www.law.cornell.edu/cfr/text/26/54.4974-1

> If there is any remaining benefit with respect to an employee (or IRA owner) after the calendar year in which the entire remaining benefit is required to be distributed, the required minimum distribution for each calendar year subsequent to that calendar year is the entire remaining benefit.

### Authority: regulation — Treas. Reg. 54.4974-1(h)

URL: https://www.law.cornell.edu/cfr/text/26/54.4974-1

> This section applies for taxable years beginning on or after January 1, 2025.

### Authority: formInstruction — 2025 Instructions for Form 5329, Part IX

URL: https://www.irs.gov/pub/irs-pdf/i5329.pdf

> The tax is due for the tax year that includes the last day by which the minimum required distribution must be taken.

**Implemented by:**
- packages/engine/src/projection/simulate.ts
- packages/engine/src/rmd/rmdShortfallExcise.ts

**Fixture files:**
- packages/engine/src/projection/rmdShortfallExcise.test.ts
- packages/engine/src/rmd/rmdShortfallExcise.test.ts
- packages/engine/src/rules/approximations/rmdAndInherited.approximation.test.ts
