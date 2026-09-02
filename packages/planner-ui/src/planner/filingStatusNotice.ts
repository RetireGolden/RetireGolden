/**
 * How the ledger reads two people under a Single filing status (#555). The
 * schema allows the shape (an unmarried two-person household, per
 * DOCS/features/household-map.md), and `simulate` prices every year of such
 * a plan on one Single return for the whole household — it never flips to
 * joint or splits the people. Household and the report both say so with the
 * same sentence, so neither surface contradicts the other.
 */
export const SINGLE_WITH_PARTNER_NOTE =
  'RetireGolden prices each year as one household on one Single return; Married filing jointly is the only two-person filing status it models.'
