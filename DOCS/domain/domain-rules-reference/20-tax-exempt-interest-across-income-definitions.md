## 20. Tax-exempt interest across income definitions (authority matrix)

One tax-exempt-interest amount belongs to some program income definitions and not others, so the engine
carries it as a named, characterized input consumed base by base — never as a generic MAGI field and never
as ordinary income. Under IRC §103(a) the amount does not enter gross income, so no path may add it to AGI,
ordinary federal taxable income, or federal taxable income directly; it reaches taxable Social Security only
through the §86(b)(2)(B) add-back and each program MAGI only through that program's own statute.

| Income base | Tax-exempt interest | Authority | Engine site |
|---|---|---|---|
| Federal AGI / ordinary taxable income | Excluded | IRC 103(a) | [federalTax.ts](../../../packages/engine/src/tax/federalTax.ts) (enters only via taxable SS) |
| §86 provisional income (taxable SS) | Included | IRC 86(b)(2)(B) | `taxableSocialSecurity` in [federalTax.ts](../../../packages/engine/src/tax/federalTax.ts) |
| ACA household MAGI (§36B PTC) | Included | IRC 36B(d)(2)(B)(ii) | `buildAcaHouseholdMagi` in [aca.ts](../../../packages/engine/src/tax/aca.ts) |
| Medicare IRMAA MAGI | Included (tax-exempt interest); foreign-exclusion addback omitted from lookback feed | 42 U.S.C. 1395r(i)(4)(A)(ii) settled; (A)(i) approximated | realized-MAGI history in [simulate.ts](../../../packages/engine/src/projection/simulate.ts) |
| NIIT net investment income | Excluded | IRC 1411(c)(1)(A)(i) — never gross income | NII assembly in [federalTax.ts](../../../packages/engine/src/tax/federalTax.ts) |
| NIIT MAGI (threshold leg) | Excluded | IRC 1411(d) — only the §911 add-back | federal MAGI in [federalTax.ts](../../../packages/engine/src/tax/federalTax.ts) |
| Senior-deduction MAGI phase-out | Excluded | IRC 151(d)(5)(C)(iii)(II) — only §911/931/933 add-backs | same federal MAGI in [federalTax.ts](../../../packages/engine/src/tax/federalTax.ts) |
| AMT (AMTI) | Excluded as modeled | IRC 57(a)(5) reaches only *specified private-activity-bond* interest; see limitations | AMTI assembly in [federalTax.ts](../../../packages/engine/src/tax/federalTax.ts) |
| State taxable income | Not added | State-specific; see limitations | [stateTax.ts](../../../packages/engine/src/tax/stateTax.ts) (still lifts federally taxable SS in states that tax SS) |

**Limitations (disclosed, not assumed away):**

- **Private-activity-bond AMT preference is not modeled.** The plan model carries tax-exempt interest as one
  annual amount with no issue-level detail, so the §57(a)(5)(C) specified-PAB test cannot be expressed; the
  whole amount is treated as non-preference interest. Account generation makes the PAB gap reachable by plans
  that never authored an ACA contract. Understates tax for PAB holders — registry record
  `irc-57-a-5-private-activity-bond-interest-amt-preference`.
- **State sourcing is not modeled.** Many states tax municipal interest from other states' issuers while
  exempting their own. The engine adds tax-exempt interest to no state base and makes no universal
  state-exemption claim; until sourcing is modeled, state treatment is a disclosed limitation rather than
  an assumption of exemption.
- **Characterized tax-exempt interest** comes from account generation (`taxExemptInterestYieldPct`) and, in
  ACA years, from the contract attestation; characterization takes max(attested total, generated subset);
  unknown contracts are satisfied by plan-derived amounts only when generation is positive and are
  evidence-marked `tax-exempt-interest-plan-derived`; a notApplicable contract contradicted by generation is
  used-and-flagged `tax-exempt-interest-contract-contradicted`.
- **IRMAA (A)(i) without-regard addback is not in the lookback feed.** ACA household MAGI and §86 provisional
  income already add the plan’s foreign-exclusion amount; `magiHistory` that supplies IRMAA does not.
  Understates IRMAA MAGI / premiums — registry record
  `usc-42-1395r-i-4-a-i-irmaa-magi-foreign-exclusion-addback`.

The machine-readable half of this matrix lives in the rule registry:
`irc-103-a-state-local-bond-interest-exclusion`, `irc-36B-d-2-B-aca-household-magi-composition`,
`irc-1411-tax-exempt-interest-outside-both-niit-legs`, and
`irc-57-a-5-private-activity-bond-interest-amt-preference` (added with this section), alongside the existing
`irc-86-b-2-provisional-income-modified-agi` and `irc-1411-d-modified-agi-foreign-exclusion-addback` records.
The IRMAA tax-exempt limb is `usc-42-1395r-i-4-a-magi-agi-plus-tax-exempt-interest`; the (A)(i) gap is the
approximated companion above. Other IRMAA records carry the tier schedule and two-year lookback.
