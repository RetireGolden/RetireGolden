# Detector governance

This policy applies to every detector in this directory. Keep detector output
deterministic, evidence-based, and suitable for a future advisor fleet scan.

## Stable IDs

Give every detector a stable kebab-case ID matching
`^[a-z0-9]+(-[a-z0-9]+)*$`.

Do not rename or reuse an ID after it ships. The card `id` must always equal
its detector `id`.

When a detector retires, reserve its ID forever. Deprecation does not make an
ID available for a replacement or a different finding.

## Severity ladder

Set severity on the finding, not on the detector.

Use `info` for an optimization opportunity with no deadline.

Use `attention` for a time-bound window or an approaching threshold where
inaction has a quantifiable cost.

Use `urgent` for an active or imminent material impact that requires review in
this planning cycle.

A detector may emit different severities for different plans when its evidence
justifies that distinction. Do not assign a permanent severity to a detector.

Tie severity to the evidence on the card. A threshold proximity, election year,
or quantified active impact must be visible in the card's evidence and
rationale.

## Evidence requirement

Every emitted card must include a non-empty `evidence[]` array.

Each evidence item must name an exact triggering value already computed by the
detector. Format the user's own figure for display. A value must contain the
actual number that triggered the finding, not a placeholder, range, or generic
statement.

Include a `year` when the value belongs to a particular plan year.

Use two to five concise evidence items where the detector has them. Prefer the
numbers already named in the title or rationale. Do not add fresh calculations
only to populate evidence.

The rationale prose and `evidence[]` must agree. If either changes, review the
other in the same change.

Exact triggering values are the WS1 acceptance criterion: every detector must
explain the numbers that caused it to fire.

### Published facts, not re-derivation

Detectors consume facts the ledger publishes on `YearResult` (per-entity
activity, Social Security resolution, and similar one-source-of-truth channels).
A detector must not re-derive attribution, eligibility, or precedence from plan
inputs when a published fact exists — parallel recomputation silently drifts
(limits clip, payments skip, streams get overridden, pools separate).

When new detector work needs a fact the ledger does not yet publish, add the
published field on `YearResult` first (populated in the same simulation pass at
the mutation site), then write the detector as a reader of that field.

## False-positive policy

Keep thresholds conservative by default.

Each detector must ship a fixture test that triggers it and a near-threshold
negative fixture that does not trigger it.

Return `null` from `screen()` whenever required inputs are missing or
ambiguous. Silence is preferable to a speculative card.

Do not infer a user's facts, dates, eligibility, intent, or execution details.
The detector may describe an exploratory comparison, but must clearly retain
its limits.

Future advisor dismissal-reason data will inform threshold tuning. Do not tune
thresholds from anecdote alone; record the version change and add boundary
coverage when tuning is justified.

## Versioning

Start every detector at `version: 1`.

Bump the version when trigger conditions, thresholds, severity mapping, or
evidence semantics change materially.

Do not bump for cosmetic copy-only changes that preserve meaning and the
triggering evidence.

Fleet scan results record the detector version. A version bump permits results
from the prior logic to be invalidated and rerun.

Keep the version an integer greater than or equal to one.

## Deprecation

Do not delete a shipped detector file in the same change that retires it.

Set its `deprecated` metadata with `since` and `reason`. Include `replacedBy`
when another detector supersedes the finding.

Remove deprecated detectors from the default registry. Keep their export and
their ID reservation for stability and historical scan interpretation.

Do not register a deprecated detector by default.

## Testing requirements

`registry.test.ts` mechanically verifies that default-registry IDs are unique,
match the kebab-case rule, use integer versions of at least one, and carry no
deprecation metadata.

The registry test also verifies the registry ordering and the shared scoring
behavior. It does not validate an individual detector's domain decision.

Each detector's own tests must cover:

- a representative fixture that fires;
- a near-threshold fixture that remains silent;
- each distinct card-emitting path;
- the severity selected for material variants when severity can differ;
- evidence values that agree with the title and rationale; and
- missing or ambiguous inputs that require silence.

Integration tests verify every fired card has a severity and non-empty,
numeric evidence values. Keep those tests focused on the contract; retain
detector-level assertions for the domain facts and thresholds.

When adding a detector, add it to the default registry only after its stable
ID, version, fixtures, severity, and evidence are complete.

## Catalog

| WS2 catalog item | Detector ID | Delivery |
| --- | --- | --- |
| Stale balances/income | `stale-plan-data` | Advisory |
| Missing dates/basis | `missing-data-basis` | Advisory |
| RMD/QCD | `qcd-efficiency` | Preview scenario |
| Roth window | `roth-bridge-headroom` | Preview scenario |
| IRMAA | `irmaa-tier-edge` | Advisory or preview scenario |
| ACA threshold | `aca-threshold-proximity` | Advisory |
| SS claim milestone | `ss-claim-milestone` | Advisory |
| Pension/annuity decision | `pension-election-pending` / `annuitization-headroom` | Advisory or preview scenario (pension); preview scenario (annuitization) |
| Guardrail adjustment | `spending-guardrails` | Preview scenario |
| Survivor/beneficiary review | `widows-penalty-roth` | Preview scenario / advisory |
| Relocation | `state-relocation` | Preview scenario |
| Assumption/law-pack drift | `law-pack-drift` | Advisory |
