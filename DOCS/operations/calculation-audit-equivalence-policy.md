# Calculation-audit equivalence policy (2026-09-12)

The calculation audit is a correctness change against application baseline
`43d56ee5a5137f3c957ad3f17df97e9072bd243b`. It is not a claim of byte-identical
behavior for every existing plan. The equivalence tool remains an unchanged,
strict comparison instrument; a reported difference is evidence to explain,
not a result to suppress or relabel as a passing comparison.

## Inherited Roth evidence changes existing-plan behavior

[The RMD domain reference](../domain/domain-rules-reference/06-rmds-secure-20.md)
and rule `treas-reg-1-408A-6-inherited-roth-nonqualified-earnings` separate the
distribution schedule from its tax character. [Treas. Reg. 1.408A-6](https://www.law.cornell.edu/cfr/text/26/1.408A-6)
and [IRS Publication 590-B](https://www.irs.gov/publications/p590b) supply the
qualified-distribution clock and nonqualified ordering rules. The inherited
account's distribution obligation alone does not prove tax-free treatment.

Previously, an inherited Roth outside the owned Roth pool could contribute no
ordinary income even when the plan supplied neither a qualified clock nor
nonqualified basis evidence. That omission is no longer treated as proof of
zero taxable earnings. A positive distribution with insufficient character
evidence is priced conservatively as ordinary income and publishes incomplete
tax character. This amount is an uncertainty estimate, not a determination
that the entire distribution is legally taxable. It can change tax, MAGI,
funding withdrawals, balances, warnings and recommendation eligibility.

There is no feature switch restoring the old missing-evidence assumption.
Omitting newly added fields therefore does **not** promise the old result for
this affected class of saved plans. Shape compatibility and additive schema
defaults remain distinct from economic equivalence.

The supported controls are:

- A verified completed legacy decedent clock can still establish qualified
  treatment and zero ordinary income without inventing contribution basis.
  `characterizeLegacyQualifiedInheritedRoth` delegates to the qualified leaf
  arm; an incomplete clock does not take that shortcut.
- A nonqualified distribution with known ordering pools consumes contribution
  and conversion basis once, then recognizes only earnings. The production
  fixture with two $100 mandatory draws and $60 shared basis expects $140
  ordinary income; adding a $100 voluntary draw expects $240. These are
  source-derived worksheets in `simulate.inheritedRegimeExecution.test.ts`,
  not values obtained by accepting a new equivalence dump.
- A positive distribution with unknown clock or required ordering evidence
  retains the conservative amount and incomplete disclosure. Do not supply
  invented zero basis, a backdated clock, or fabricated provenance merely to
  make a prior corpus member match.

## Corpus and evidence handling

The committed `full` corpus combines scenario members in
`packages/engine/scripts/equivalence/corpus/`. For example,
`w4-rothAndMissingInheritedAmount` in `blocks.mjs` deliberately includes an
inherited Roth without clock/basis evidence and a positive voluntary funding
need. It belongs to the intentional missing-evidence comparison category.
The `o3-finalSweepSubCentAggregationAndDeath` and
`o6-singleRothSubCentShortfall` members supply a legacy decedent clock; they
remain useful controls for qualified tax character and inherited section 4974
residues. This classification does not assert their entire dumps are equal:
other audited rules may affect the same member.

Keep the original corpus inputs in the baseline-versus-head comparison. Do
not remove the affected members or change their inputs retroactively. Capture
both frozen trees with the same corpus manifest, retain the strict comparison
result, and attach a review of each observed difference to the implementation
receipt. Identify the member, mode, year and output path, the relevant rule,
and an independent expected-value or explicit incompleteness test. The
missing-evidence policy described here is not blanket approval of unrelated
changes or an assertion that a comparison has been run.

If additional controls are needed, add separately named corpus members for a
verified qualified clock, known nonqualified basis and unknown evidence;
retain the original member alongside them. Source/test owners must supply the
facts and provenance. Keep expected correctness assertions in the unit and
production tests; corpus captures are observations rather than oracles.

Reach-spec anchors continue to bind measured source ranges. An anchor pass
proves source location, and a runtime reach pass proves exercised lines;
neither establishes correctness of this economic change or authorizes a
blanket default-off equivalence statement. Changes in other audited domains
need their own source and test explanation in the comparison receipt.
