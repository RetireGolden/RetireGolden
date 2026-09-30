# Targeted re-check, 2026-09-30 (recheck-grok)

Reviewer: Grok (grok-4.7, xAI), headless and read-only, on a snapshot of branch `claude/scrub-local-paths` at `b251c178`. Scope: 2 records rejected in the 2026-09-29 reviews, or approved there and then touched by a later fix, each checked only for whether its fix resolves the original finding and introduces no error. Verdicts: 2 approve, 0 reject. The only edits to the report below replace local paths with repository paths.

**Orchestrator's note (added 2026-09-30 after the pull request's round-one review; not the reviewer's words).** Where the report below says "`reviewedBy` stays `unreviewed`", it describes the change it was shown: the field had been reset to `unreviewed` pending this re-check, and the diff under review did not change it. The verdict for both records is approve, so both are recorded as reviewed by Grok (`reviewedBy: 'grok'`). The full-horizon pins are run measurements, not derivations: each record's limit states them as figures a repository test (`packages/planner-ui/src/planner/preStartEvents.figures.test.ts`) pins by running the engine, and the review did not recompute them. The worked cases Grok recomputed on 2026-09-29 (`REVIEW-2026-09-29-grok-1.md`) are unchanged.

Verbatim output follows.

---

# Re-check: run-pinned pre-start figures after the CMS IRMAA change

Reviewer: Grok (grok-4.7, xAI). Date: 2026-09-30. Records: `income-annuity-annual`, `income-tips-ladder-and-ladder-value-annual`. Read only; nothing was run, and the full-horizon pins were not recomputed. An unrelated hunk in `laddersAndValuation.ts` flips `reviewedBy` on the real-yield-curve record; it is not part of either record below.

## income-annuity-annual

**Verdict: approve.**

The worksheet diff and the two limit strings in `cashFlowAndSummary.ts` only replace the U1 pins and name the old ones. New pins: -$147,623.51 from a 2026 start and +$455,159.49 from a 2027 start. Old pins, stated beside them: -$147,622.51 and +$455,165.79. Provenance adds the 2026-09-29 Grok review line and a revision note that the CMS IRMAA table moved those pins. `reviewedBy` stays `unreviewed`. The claim's expected value ($11,016), the survivor arithmetic, the wrong readings, and the $700,000 brokerage worked case are untouched.

The limit and the worksheet both attribute the cent figures to a pin in `packages/planner-ui/src/planner/preStartEvents.figures.test.ts`, and they keep the derivation's rounded dollars ($147,623 / $454,837) separate. The revision note calls the pins a full-horizon measurement the review did not recompute. A CMS IRMAA table is a plausible cause: ending net worth over a full horizon includes Medicare surcharges, and this purchase changes income. The stated move is $1.00 and $6.30, cents to a few dollars, and not the same size on both start years.

## income-tips-ladder-and-ladder-value-annual

**Verdict: approve.**

Same shape. The worksheet paragraph and the two limit strings in `laddersAndValuation.ts` only replace the ladder pins and name the old ones. New pins: -$14,871.56 from a 2026 start and +$702,077.94 from a 2027 start. Old pins: -$14,872.97 and +$702,077.21. Provenance adds the same review line and the same IRMAA revision note. `reviewedBy` stays `unreviewed`. Purchase-year, offset-1, and offset-2 expected cash and value ($0 / $24,000, $8,820 / $16,800, $352 / $17,600), the wrong readings, the warning quote, and the brokerage worked case are untouched.

The limit and the worksheet both say those cent figures are pinned in `packages/planner-ui/src/planner/preStartEvents.figures.test.ts`, distinct from the check's rounded dollars ($14,873 / $702,171). The revision note again calls them a full-horizon measurement, not a figure the review recomputed. The IRMAA reason is equally plausible here: the ladder changes MAGI on a different path, and the pins move by $1.41 and $0.73, including a sign that differs from the annuity record.
