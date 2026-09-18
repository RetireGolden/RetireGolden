## Claim

Kind: model. `insights/detectors/spendingGuardrails.ts#spendingGuardrails.screen` publishes the nominal required annual floor for a depleting plan with first-year investable balance at least `$100,000`, selecting the plan's explicit `requiredAnnual` when present and otherwise using `80%` of base annual spending from the generated probability-band guardrail patch.

## Justification

The model preserves an explicit floor because it is the user's constraint; absent one, the generator's 80% convention supplies an illustrative essential floor while allowing discretionary cuts. Its intended use is a guardrail preview, not a claim that 80% is an objectively required household budget or that the policy improves every path. The domain requires nonnegative finite spending and the stated depletion/balance screen.

## Inputs

| Case | Plan depletes | First-year investable | Base annual spending | Explicit required annual | Unit |
|---|---|---:|---:|---:|---|
| Fallback | yes | 150,000 | 60,000 | absent | nominal dollars/year |
| Explicit | yes | 150,000 | 60,000 | 42,000 | nominal dollars/year |

## Arithmetic

Fallback floor `=0.80*$60,000=$48,000/year`. Explicit case selects `$42,000/year` without applying 80% again.

## Expected

Expected fallback required annual is exactly `$48,000.00`; expected explicit required annual is exactly `$42,000.00`, both with exact-cent tolerance.

## Wrong readings

- Using 80% of the first-year investable balance gives `$120,000.00`.
- Applying 80% to the explicit floor gives `$33,600.00`.

## Family

outputs: `insight-spending-guardrails-illustrative-floor`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
