#!/usr/bin/env python3
"""Recovery for taxRuleRegistry.ts: fix corruption, DC/KS, move Batch B+C."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REGISTRY = ROOT / "packages/engine/src/rules/taxRuleRegistry.ts"

BATCH_B_MARKER = "  // WS4d Batch B — KY, LA, MD, MA, MI, MN, MT, NE, NH, NJ. 2026-08-27."
INSERT_MARKER = "  'irc-408-d-2-C-projection-pro-rata-measurement-instant': {"
WI_STAT_KEY = "  'wi-stat-71-05-retirement-income-subtraction': {"
MD_KEY = "  'md-tax-10-209-pension-exclusion': {"
KS_KEY = "  'ks-stat-79-32-117-public-pension-exclusion': {"
SEP_LINE = "  // ---------------------------------------------------------------------------"

WI_WISCONSIN_TITLE = (
    "Wisconsin excludes Social Security and allows a $24,000 age-67 retirement subtraction"
)
MD_TITLE = "Maryland's pension subtraction is not a flat $41,200 of all retirement"


def try_git_checkout() -> bool:
    r = subprocess.run(
        ["git", "checkout", "HEAD", "--", "packages/engine/src/rules/taxRuleRegistry.ts"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    ok = r.returncode == 0
    print("git checkout HEAD:", "OK" if ok else f"FAILED ({r.stderr.strip() or r.stdout.strip()})")
    return ok


def extract_record(content: str, key: str) -> tuple[int, int, str]:
    start = content.find(key)
    if start == -1:
        raise SystemExit(f"Key not found: {key!r}")
    close = content.find("\n  },\n", start + len(key))
    if close == -1:
        raise SystemExit(f"Close not found for {key!r}")
    end = close + len("\n  },\n")
    return start, end, content[start:end]


def fix_corruption(content: str) -> str:
    """Undo partial block move: duplicate wi-stat / misplaced Batch B header."""
    wi_count = content.count(WI_STAT_KEY)
    if wi_count == 0:
        raise SystemExit("wi-stat record missing")
    if wi_count == 1:
        # Check wrong key on MD
        _, _, wi_block = extract_record(content, WI_STAT_KEY)
        if MD_TITLE.replace("'", "\u2019") in wi_block or "Maryland" in wi_block.split("title:")[1][:200]:
            content = content.replace(WI_STAT_KEY, MD_KEY, 1)
            print("fix_corruption: renamed mis-keyed MD record")
        return content

    if wi_count != 2:
        raise SystemExit(f"Expected 1 or 2 wi-stat keys, got {wi_count}")

    first_start, first_end, first_block = extract_record(content, WI_STAT_KEY)
    second_start, second_end, second_block = extract_record(content, WI_STAT_KEY)

    if WI_WISCONSIN_TITLE not in first_block:
        first_start, first_end, first_block = second_start, second_end, second_block
        second_start, second_end, second_block = extract_record(content, WI_STAT_KEY)

    if WI_WISCONSIN_TITLE not in first_block:
        raise SystemExit("Could not locate Wisconsin wi-stat block")

    wi_block = first_block
    ks_end = content.find(KS_KEY)
    if ks_end == -1:
        raise SystemExit("KS key missing")
    _, ks_record_end, _ = extract_record(content, KS_KEY)
    irc_idx = content.find(INSERT_MARKER, ks_record_end)
    if irc_idx == -1:
        raise SystemExit("irc-408 missing after KS")

    # Premature block sits between KS and irc-408
    premature_start = content.find(SEP_LINE, ks_record_end, irc_idx)
    if premature_start != -1 and BATCH_B_MARKER in content[premature_start:irc_idx]:
        content = content[:premature_start] + content[irc_idx:]
        print("fix_corruption: removed premature Batch B+wi block before irc-408")
        # re-find second (MD) wi-stat
        wi_count = content.count(WI_STAT_KEY)
        if wi_count != 1:
            # still have MD mis-key
            pass

    if content.count(WI_STAT_KEY) == 0:
        # append wi at end before satisfies
        sat = content.find("\n} satisfies Record<string, TaxRuleRecord>")
        if sat == -1:
            raise SystemExit("satisfies close not found")
        content = content[:sat] + "\n\n" + wi_block + content[sat:]
        print("fix_corruption: appended wi-stat at end of registry")

    if content.count(WI_STAT_KEY) == 1:
        _, wi_only, wi_only_block = extract_record(content, WI_STAT_KEY)
        if "Maryland" in wi_only_block:
            content = content[:wi_only] + wi_only_block.replace(WI_STAT_KEY, MD_KEY, 1) + content[wi_only + len(wi_only_block):]
            sat = content.find("\n} satisfies Record<string, TaxRuleRecord>")
            content = content[:sat] + "\n\n" + wi_block + content[sat:]
            print("fix_corruption: fixed MD key + restored wi-stat at end")

    # Ensure Batch B header + LA records exist before MD
    if content.find(BATCH_B_MARKER) == -1 or content.find(BATCH_B_MARKER) > content.find(INSERT_MARKER):
        md_idx = content.find(MD_KEY)
        if md_idx == -1:
            md_idx = content.find(WI_STAT_KEY)  # fallback
        la1 = "  'la-rs-47-44-1-retirement-exemption': {"
        if content.find(la1) == -1 or content.find(la1) > content.find(INSERT_MARKER):
            batch_header = content[premature_start:content.find(la1, premature_start) if premature_start else 0]
            # rebuild from saved wi_block extraction - use hardcoded header+LA from known good
            header_la = '''  // ---------------------------------------------------------------------------
  // WS4d Batch B — KY, LA, MD, MA, MI, MN, MT, NE, NH, NJ. 2026-08-27.
  //
  // KY is not in this block: the staged KY fetch is a chapter table of
  // contents with no operative KRS 141.019 / 141.020 text. BLOCKED-SOURCE, not
  // a silent omission. NH was blocked on the first pass (DOR Access Denied);
  // the RSA Chapter 77 repeal page is now in the staged set and is registered.
  // ---------------------------------------------------------------------------

  'la-rs-47-44-1-retirement-exemption': {
    title: 'Louisiana exempts $12,000 of retirement income from age 65',
    statement:
      'Louisiana exempts twelve thousand dollars of annual retirement income — pension and annuity income included in tax-table income — received by an individual sixty-five years of age or older. That is the amount the pack encodes as `{ kind: \\'capped\\', capPerPerson: 12000, minAge: 65 }`, and it is why a reading that still used the former six-thousand-dollar figure is rejected. The same subsection requires the amount to be adjusted annually beginning January 1, 2026 by the CPI-U increase for the previous calendar year, which is why this record is annually indexed rather than static. The separate six-thousand-dollar disability exemption in subsection B is not modelled.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:LA',
    authority: [{
      kind: 'statute',
      citation: 'La. R.S. 47:44.1(A)',
      url: 'https://www.legis.la.gov/legis/Law.aspx?d=102133',
      quotedText:
        'Twelve thousand dollars of annual retirement income which is received by an individual sixty-five years of age or older shall be exempt from state income taxation. "Annual retirement income" is defined as pension and annuity income which is included in "tax table income" as defined in R.S. 47:293.  This Section shall not affect the status of any income which is exempt from state income taxation by law.  The amount of the exemption provided for in this Subsection shall be adjusted annually beginning January 1, 2026, by an amount calculated by multiplying the amount of the prior year\\'s exemption by the percentage increase in the Consumer Price Index United States city average for all urban consumers (CPI-U),  as reported by the United States Department of Labor, Bureau of Labor Statistics, or its successor, for the previous calendar year.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
  },

  'la-rs-47-44-2-social-security-federal-retirement': {
    title: 'Louisiana exempts Social Security, federal retirement, and railroad retirement',
    statement:
      'Louisiana exempts any benefit received under Chapter 7 of Title 42 of the United States Code, any income received under a retirement system for retirees of the United States Government, and any income received under the Railroad Retirement Act of 1974. That is what `taxesSocialSecurity: false` encodes, and it is the United States Government retirement the pack\\'s public-pension `{ kind: \\'full\\' }` override carries.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:LA',
    authority: [{
      kind: 'statute',
      citation: 'La. R.S. 47:44.2',
      url: 'https://www.legis.la.gov/legis/Law.aspx?d=102134',
      quotedText:
        'Any benefit received by an individual pursuant to the provisions of Chapter 7 of Title 42 of the United States Code (42 U.S.C. 301 et seq.), and any income received by an individual pursuant to a retirement system for retirees of the United States Government or pursuant to the Railroad Retirement Act of 1974 (45 U.S.C. 231 et seq.) shall be exempt from the state income tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
  },

'''
            md_idx = content.find(MD_KEY)
            if md_idx == -1:
                raise SystemExit("MD record missing after corruption fix")
            content = content[:md_idx] + header_la + content[md_idx:]
            print("fix_corruption: inserted Batch B header + LA records before MD")

    return content


def apply_dc_fix(content: str) -> str:
    content = content.replace("\\\\u00a7\\u200286", "\\u00a7\\u200286")
    content = content.replace("\\\\u00a7 47-1801.04", "\\u00a7 47-1801.04")
    return content


def apply_ks_fix(content: str) -> str:
    if "ksrevenue.gov" not in content:
        return content
    # Remove stateAgencyPublication authority and fix statement if old HEAD
    content = re.sub(
        r",?\s*\{\s*kind: 'stateAgencyPublication',[^}]+\},?\s*",
        "",
        content,
        count=1,
    )
    print("apply_ks_fix: removed ksrevenue.gov authority")
    return content


def move_batch_bc(content: str) -> str:
    batch_b_idx = content.find(BATCH_B_MARKER)
    if batch_b_idx == -1:
        raise SystemExit("Batch B marker not found")
    block_start = content.rfind(SEP_LINE, 0, batch_b_idx)
    if block_start == -1:
        raise SystemExit("Separator before Batch B not found")

    wi_idx = content.find(WI_STAT_KEY, batch_b_idx)
    if wi_idx == -1:
        raise SystemExit("wi-stat not found after Batch B")
    close_idx = content.find("  },\n", wi_idx + len(WI_STAT_KEY))
    if close_idx == -1:
        raise SystemExit("wi-stat close not found")
    block_end = close_idx + len("  },\n")

    block = content[block_start:block_end]
    insert_idx = content.find(INSERT_MARKER)
    if insert_idx == -1:
        raise SystemExit("irc-408 marker not found")
    if block_start <= insert_idx < block_end:
        raise SystemExit("Insertion point inside block — already moved?")

    without = content[:block_start] + content[block_end:]
    if block_start < insert_idx:
        insert_idx -= len(block)
    new_content = without[:insert_idx] + block + without[insert_idx:]

    if len(new_content) != len(content):
        raise SystemExit(f"Length changed: {len(content)} -> {len(new_content)}")
    return new_content


def verify(content: str) -> list[tuple[str, int]]:
    for marker in (KS_KEY, BATCH_B_MARKER, WI_STAT_KEY, INSERT_MARKER):
        n = content.count(marker)
        if n != 1:
            raise SystemExit(f"Expected 1 x {marker!r}, got {n}")
    markers = [
        ("KS public pension", content.find(KS_KEY)),
        ("Batch B comment", content.find(BATCH_B_MARKER)),
        ("wi-stat", content.find(WI_STAT_KEY)),
        ("irc-408 projection", content.find(INSERT_MARKER)),
    ]
    sorted_m = sorted(markers, key=lambda x: x[1])
    expected = ["KS public pension", "Batch B comment", "wi-stat", "irc-408 projection"]
    actual = [n for n, _ in sorted_m]
    if actual != expected:
        raise SystemExit(f"Order wrong: {actual} (expected {expected})")
    return sorted_m


def main() -> None:
    restored = try_git_checkout()
    content = REGISTRY.read_text(encoding="utf-8")
    lines_before = content.count("\n") + (0 if content.endswith("\n") else 1)

    if content.count(WI_STAT_KEY) > 1 or (
        content.count(WI_STAT_KEY) == 1 and "Maryland" in extract_record(content, WI_STAT_KEY)[2]
    ):
        content = fix_corruption(content)

    content = apply_dc_fix(content)
    content = apply_ks_fix(content)
    content = move_batch_bc(content)
    order = verify(content)

    lines_after = content.count("\n") + (0 if content.endswith("\n") else 1)
    if lines_before != lines_after:
        raise SystemExit(f"Line count changed: {lines_before} -> {lines_after}")

    REGISTRY.write_text(content, encoding="utf-8", newline="")
    print(f"lines_before={lines_before} lines_after={lines_after}")
    print("marker order (line):")
    for name, pos in order:
        print(f"  {name}: line {content[:pos].count(chr(10)) + 1}")
    print(f"restored={restored} move=OK")


if __name__ == "__main__":
    main()
