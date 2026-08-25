# Re-verification dispatch: irc-223-f-4-B-hsa-death-exception (generated 2026-08-25)

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
- Quote-fidelity re-check: `pnpm verify:quotes -- --filter irc-223-f-4-B-hsa-death-exception --refresh` (network, manual; see `DOCS/operations/quote-fidelity.md`)
- If any result moves: run `cases:diff`, review every delta, and add a `CHANGELOG.md` entry announcing the correction — corrections are announced, never silent.
- `pnpm rules:coverage` and commit the refreshed `DOCS/operations/rule-coverage.md` and `rule-coverage.json` (`verifiedOn` changes them)
- Confirm no other open PR changes the registry file: for each PR in `gh pr list --state open --json number -q .[].number`, run `gh pr diff <n> --name-only` and require zero hits for `taxRuleRegistry.ts` before pushing.
- One PR; review-bot findings fixed on the same branch

## irc-223-f-4-B-hsa-death-exception

**Statement:** The 20 percent additional tax does not apply to a distribution made after the account beneficiary becomes disabled or dies. Not modelled: the engine carries disability evidence but holds no death fact, and death also ends the account HSA status under 223(f)(8), so treating it as merely waiving the 20 percent would understate the event.

**Classification:** outOfScope
**Jurisdiction:** federal | **Volatility:** staticStatute | **Verified on:** 2026-08-03 | **Due on:** 2027-08-03
**Effective:** 2026 (no end)

### Authority: statute — IRC 223(f)(4)(B)

URL: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim

> Subparagraph (A) shall not apply if the payment or distribution is made after the account beneficiary becomes disabled within the meaning of section 72(m)(7) or dies.

**Implemented by:**
- packages/engine/src/actions/annualHsaPenaltyEvaluation.ts

**Fixture files:**
- No discriminating fixtures: this rule is outOfScope and is enforced as a typed refusal — confirm the refusal behavior and its tests instead of a describeRule fixture.
