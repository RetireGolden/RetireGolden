# Exact ordinary IRA contribution deadline correction

The post-candidate annual IRA evidence builder previously accepted any canonical April 15–18 deadline in the following year. It now requires the exact ordinary federal filing date for the designated tax year. The existing IRC 219(f)(3) record covers the contribution window without extensions; IRC 6072(a), IRC 7503, and the existing ordinary-calendar record supply its calendar adjustment. Disaster relief remains outside this supported evidence kind.

For tax year 2030, April 15, 2031 is Tuesday and D.C. Emancipation Day is Wednesday, April 16. The ordinary deadline is therefore April 15. These are independent calendar inputs; the test does not obtain its expected deadline from the helper being exercised.

| Otherwise-identical evidence | Before | After |
|---|---|---|
| Deadline and contribution April 15, 2031 | classification input built | classification input built |
| Deadline and contribution April 18, 2031 | classification input built | contribution window incomplete |

[Before observation](ira-exact-filing-deadline-correction-2026-09-08/before.json) and [after observation](ira-exact-filing-deadline-correction-2026-09-08/after.json) contain the exact serialized inputs, actual engine statuses, and source hashes. The after receipt records the checkout base commit together with changed-file hashes; it does not claim those edits were already committed at observation time. The existing single rule fixture now drives the post-candidate enforcer as well as the filing-evidence path. A shared test-support factory preserves the canonical inputs without importing another test suite.

The bundled example-case comparison reports no deltas. Those examples do not establish this evidence-boundary behavior; the targeted fixture and builder observations above do. This correction changes admission of unsupported late evidence, not a tax parameter or the public input schema.
