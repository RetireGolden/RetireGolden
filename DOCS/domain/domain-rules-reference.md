# Domain rules reference (2026 law)

The financial rules the RetireGolden engine encodes, with current (tax year 2026) figures and sources. **All dollar figures live in versioned parameter-data files (`packages/engine/src/params/`), not code** — see [standards.md](../standards.md). Verified June 2026; re-verify each fall when the IRS/SSA/CMS publish next-year numbers — cadence and the legislative watch-list are in [maintenance-schedule.md](../maintenance-schedule.md).

Legal baseline: the **One Big Beautiful Bill Act (OBBBA, July 2025)** made the TCJA rate structure permanent and added the senior deduction, so 2026 brackets are stable current law rather than a sunset cliff.

**The rule registry is the machine-checked chain; this document is the human map.**
[`packages/engine/src/rules/records/`](../../packages/engine/src/rules/records) holds one
typed, frozen record per statutory rule the engine implements, in per-domain modules that
[`taxRuleRegistry.ts`](../../packages/engine/src/rules/taxRuleRegistry.ts) composes into the frozen
registry. Each record carries the authority with its operative language quoted
rather than paraphrased, the reading taken, the jurisdiction, the date last verified, and the engine sources
implementing it. Every `settled` rule must be covered by a fixture that discriminates between candidate readings,
and `taxRuleRegistry.conformance.test.ts` enforces that. **Convention: where a rule has a record, cite the record
ID here rather than restating its authority, and move the record — not only this prose — when a reading changes.**
Four classifications:

- `settled` — the authority controls; implement it and cover it.
- `approximated` — the engine returns a figure that is knowably not the one the authority requires. A required
  typed `errorDirection` (`understatesTax` / `overstatesTax` / `bothDirections`) says which way, anchored on the
  **taxpayer's exposure to the fisc** rather than on the quantity the rule names.
- `outOfScope` — the engine produces no figure from the rule at all. A required `outOfScope.shape`
  says which of the two ways that happens: `typedRefusal`, where the engine fails closed at a named site,
  or `inexpressibleInput`, where the fact the rule turns on cannot be expressed in `model/plan.ts` or
  `params/types.ts` at all, so no accepted input ever reaches the rule. The second shape lists the absent
  facts in `missingInputFacts`; the first owes a refusal fixture instead. See
  [testing.md](../testing.md#covering-a-rule-the-engine-refuses-to-answer) for the coverage obligations.
- `unsettled` — authority is absent or conflicting; the rejected reading is recorded in `contraryReading`.

The split between `approximated` and `outOfScope` is the load-bearing one: "computes a knowably-wrong number" and
"refuses to answer" are different risks to whoever consumes the result, and one field used to carry both. The
`outOfScope.shape` field draws the same kind of line one level down: "we refuse this input" and "this input cannot
be entered" are also different claims, and the shape is typed rather than left to the record's prose because only
one of them can be pinned by a fixture. Current
counts — total records, the classification split, and the per-state jurisdiction spread — live in the generated
[operations/rule-coverage.md](../operations/rule-coverage.md) and are asserted against the registry at test time;
this document deliberately states none, because dated prose counts rot. Every record also carries a `jurisdiction`,
which fixes the publisher tier its citations may be drawn from: a federal rule may cite only federal publishers, and a
state rule may cite its own state's publishers plus the federal law its state code incorporates by reference — a state
source may never carry a federal rule; a state whose publisher tier has not been researched admits nothing at all, so
the tier fails closed.

---

## Sections

The reference is split one file per section under
[`domain-rules-reference/`](domain-rules-reference/), so a rule change edits the section it
belongs to instead of a single 1,400-line file. Section headings, numbering, and text are
unchanged by the split; a heading anchor still resolves inside its own file.

| Section | File |
| --- | --- |
| 1. Federal income tax (2026) | [01-federal-income-tax-2026.md](domain-rules-reference/01-federal-income-tax-2026.md) |
| 2. Long-term capital gains and NIIT (2026) | [02-long-term-capital-gains-and-niit-2026.md](domain-rules-reference/02-long-term-capital-gains-and-niit-2026.md) |
| 3. Social Security benefit taxation | [03-social-security-benefit-taxation.md](domain-rules-reference/03-social-security-benefit-taxation.md) |
| 4. Social Security program parameters (2026) | [04-social-security-program-parameters-2026.md](domain-rules-reference/04-social-security-program-parameters-2026.md) |
| 5. Retirement accounts: contribution limits (2026) | [05-retirement-accounts-contribution-limits-2026.md](domain-rules-reference/05-retirement-accounts-contribution-limits-2026.md) |
| 6. RMDs (SECURE 2.0) | [06-rmds-secure-20.md](domain-rules-reference/06-rmds-secure-20.md) |
| 7. Medicare and IRMAA (2026) | [07-medicare-and-irmaa-2026.md](domain-rules-reference/07-medicare-and-irmaa-2026.md) |
| 8. ACA premium tax credit (pre-65 retirees) | [08-aca-premium-tax-credit-pre-65-retirees.md](domain-rules-reference/08-aca-premium-tax-credit-pre-65-retirees.md) |
| 9. State and local income tax | [09-state-and-local-income-tax.md](domain-rules-reference/09-state-and-local-income-tax.md) |
| 10. Roth conversion rules | [10-roth-conversion-rules.md](domain-rules-reference/10-roth-conversion-rules.md) |
| 11. Withdrawal sequencing (modeling conventions) | [11-withdrawal-sequencing-modeling-conventions.md](domain-rules-reference/11-withdrawal-sequencing-modeling-conventions.md) |
| 12. Monte Carlo methodology notes | [12-monte-carlo-methodology-notes.md](domain-rules-reference/12-monte-carlo-methodology-notes.md) |
| 13. Default assumptions (user-overridable) | [13-default-assumptions-user-overridable.md](domain-rules-reference/13-default-assumptions-user-overridable.md) |
| 14. Spending layers and guardrails (opt-in) | [14-spending-layers-and-guardrails-opt-in.md](domain-rules-reference/14-spending-layers-and-guardrails-opt-in.md) |
| 15. Asset classes, allocation, and rebalancing (opt-in) | [15-asset-classes-allocation-and-rebalancing-opt-in.md](domain-rules-reference/15-asset-classes-allocation-and-rebalancing-opt-in.md) |
| 16. Account eligibility, HSA, nondeductible basis, and fixed-asset disposition (opt-in) | [16-account-eligibility-hsa-nondeductible-basis.md](domain-rules-reference/16-account-eligibility-hsa-nondeductible-basis.md) |
| 17. Guaranteed income (annuity purchases) and estate & beneficiary depth (opt-in) | [17-guaranteed-income-annuity-purchases.md](domain-rules-reference/17-guaranteed-income-annuity-purchases.md) |
| 18. TIPS income floor: ladders, the SS bridge, and the funded ratio (opt-in) | [18-tips-income-floor-ladders-the-ss-bridge.md](domain-rules-reference/18-tips-income-floor-ladders-the-ss-bridge.md) |
| 19. Annuity payout forms, the annuitization sweep, pension lump-sum elections, and the HECM buffer (opt-in) | [19-annuity-payout-forms-the-annuitization-sweep.md](domain-rules-reference/19-annuity-payout-forms-the-annuitization-sweep.md) |
| 20. Tax-exempt interest across income definitions (authority matrix) | [20-tax-exempt-interest-across-income-definitions.md](domain-rules-reference/20-tax-exempt-interest-across-income-definitions.md) |
