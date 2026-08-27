#!/usr/bin/env python3
"""Pure block-move: Batch B+C (through wi-stat) before irc-408."""
from pathlib import Path

path = Path(__file__).resolve().parent / "packages/engine/src/rules/taxRuleRegistry.ts"
content = path.read_text(encoding="utf-8")
orig_len = len(content)
lines_before = content.count("\n") + (0 if content.endswith("\n") else 1)

BATCH_B_MARKER = "  // WS4d Batch B — KY, LA, MD, MA, MI, MN, MT, NE, NH, NJ. 2026-08-27."
WI_STAT_KEY = "  'wi-stat-71-05-retirement-income-subtraction': {"
KS_KEY = "  'ks-stat-79-32-117-public-pension-exclusion': {"
IRC_KEY = "  'irc-408-d-2-C-projection-pro-rata-measurement-instant': {"
SEP_LINE = "  // ---------------------------------------------------------------------------"

content = content.replace("\n__BATCH_BC_BLOCK__\n", "\n")

batch_b_idx = content.find(BATCH_B_MARKER)
if batch_b_idx == -1:
    raise SystemExit("Batch B marker not found")
block_start = content.rfind(SEP_LINE, 0, batch_b_idx)
if block_start == -1:
    raise SystemExit("Separator before Batch B not found")

wi_idx = content.rfind(WI_STAT_KEY)
if wi_idx == -1 or wi_idx < batch_b_idx:
    raise SystemExit("wi-stat not found after Batch B block")
close_idx = content.find("  },\n", wi_idx + len(WI_STAT_KEY))
if close_idx == -1:
    raise SystemExit("wi-stat closing brace not found")
block_end = close_idx + len("  },\n")

block = content[block_start:block_end]
insert_idx = content.find(IRC_KEY)
if insert_idx == -1:
    raise SystemExit("irc-408 not found")
if block_start <= insert_idx < block_end:
    raise SystemExit("irc-408 inside block")

if insert_idx > block_end:
    without = content[:block_start] + content[block_end:]
    if block_start < insert_idx:
        insert_idx -= len(block)
    content = without[:insert_idx] + block + without[insert_idx:]
else:
    raise SystemExit(f"Unexpected layout: irc-408 at {insert_idx}, block {block_start}-{block_end}")

for marker, name in [
    (KS_KEY, "KS"),
    (BATCH_B_MARKER, "Batch B"),
    (WI_STAT_KEY, "wi-stat"),
    (IRC_KEY, "irc-408"),
]:
    if content.count(marker) != 1:
        raise SystemExit(f"Expected 1 {name}, got {content.count(marker)}")

order = sorted(
    [("KS", content.find(KS_KEY)), ("Batch B", content.find(BATCH_B_MARKER)),
     ("wi-stat", content.find(WI_STAT_KEY)), ("irc-408", content.find(IRC_KEY))],
    key=lambda x: x[1],
)
if [n for n, _ in order] != ["KS", "Batch B", "wi-stat", "irc-408"]:
    raise SystemExit(f"Wrong order: {[n for n,_ in order]}")

lines_after = content.count("\n") + (0 if content.endswith("\n") else 1)
if lines_before != lines_after:
    raise SystemExit(f"Line count changed: {lines_before} -> {lines_after}")
if len(content) != orig_len:
    raise SystemExit(f"Length changed: {orig_len} -> {len(content)}")

path.write_text(content, encoding="utf-8", newline="")
print("move=OK")
print(f"lines={lines_after}")
for name, pos in order:
    print(f"  {name}: line {content[:pos].count(chr(10)) + 1}")
