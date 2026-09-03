import type { parseV2Backup } from '../../data/v2Backup'

type ImportFailure = Extract<ReturnType<typeof parseV2Backup>, { ok: false }>['reason']

/**
 * Human import-failure copy with a next step (UI/UX round 2, Step 6) — never the
 * raw enum reason with underscores, which leaked schema jargon at the user.
 *
 * Deliberately takes `| string`, not just `ImportFailure`: an unrecognized
 * reason (a future value this build's engine doesn't know, or a caller
 * outside the type system) must still fall through to the generic default
 * copy rather than a type error, so the union is documented here even though
 * `string` structurally subsumes it (errorRecovery.test.tsx exercises this
 * with a reason no `ImportFailure` variant names).
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function importErrorMessage(reason: ImportFailure | string): string {
  switch (reason) {
    case 'too_large':
      return 'That file is too large to be a RetireGolden backup. Pick the JSON file you downloaded from Data & privacy → Download backup.'
    case 'unsupported_version':
      return 'That backup was made by a different version of RetireGolden, so it can’t be imported here.'
    case 'no_valid_plans':
      return 'That backup didn’t contain any readable plans. Export a fresh one from Data & privacy → Download backup.'
    case 'not_json':
    case 'wrong_kind':
    default:
      return 'That file isn’t a RetireGolden backup. Export one from Data & privacy → Download backup, then import that file.'
  }
}
