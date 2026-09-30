"""Independent re-derivation of montecarlo/survival.ts#jointSurvivalPercentileAge on SSA's 2023 table.

Reads only the q columns of SSA's 2023 period life table as DOCS/calculations/longevity/
ssa-period-life-table.md transcribes it, and re-implements the survival curve (the running product
of 1 - q, left to right, from the floored age; q = 1 from the table's closed last row, 119, on) and
the either-alive walk from the record's statement, in doubles. Imports and reads nothing from
packages/. Case 2 of the worksheet: a man of 70 with a woman of 35 at 25%.
Run from the repository root: python DOCS/calculations/longevity/scripts/joint_survival_2023.py
"""
import re
from pathlib import Path

TABLE = Path(__file__).resolve().parents[1] / 'ssa-period-life-table.md'
ROW = re.compile(r'^\|\s*(\d+)\s*\|\s*([01]\.\d{6})\s*\|\s*[\d.]+\s*\|\s*([01]\.\d{6})\s*\|\s*[\d.]+\s*\|')


def columns():
    rows = {}
    for line in TABLE.read_text(encoding='utf-8').splitlines():
        m = ROW.match(line)
        if m:
            rows[int(m[1])] = (float(m[2]), float(m[3]))
    assert sorted(rows) == list(range(120)), 'expected ages 0 to 119'
    return [rows[a][0] for a in range(120)], [rows[a][1] for a in range(120)]


MALE, FEMALE = columns()
Q = {'male': MALE, 'female': FEMALE}
LAST = 119


def q(age, sex):
    if age < 0:
        return 0.0
    if age >= LAST:
        return 1.0
    return Q[sex][age]


def curve(from_age, sex):
    products = [1.0]

    def to(t):
        while len(products) <= min(t, LAST + 2):
            last = products[-1]
            products.append(0.0 if last <= 0 else last * (0.0 if q(from_age + len(products) - 1, sex) >= 1 else 1 - q(from_age + len(products) - 1, sex)))
        return products[min(t, LAST + 2)] if t > 0 else 1.0
    return to


def joint(primary_age, primary_sex, partner_age, partner_sex, pct, either=True):
    threshold = min(max(pct, 0.1), 100) / 100
    sp, so = curve(primary_age, primary_sex), curve(partner_age, partner_sex)
    best = primary_age
    t = 0
    while primary_age + t <= LAST + 1 or (either and partner_age + t <= LAST + 1):
        a, b = sp(t), so(t)
        if t > 0 and a <= 0 and b <= 0:
            break
        if 1 - (1 - a) * (1 - b) >= threshold:
            best = primary_age + t
        else:
            break
        t += 1
    return best


assert len(Q['male']) == 120 and len(Q['female']) == 120
start = 2026
him = joint(70, 'male', 35, 'female', 25)
her = joint(35, 'female', 70, 'male', 25)
old = joint(70, 'male', 35, 'female', 25, either=False)
print('him first:', him, start - 70 + him)
print('her first:', her, start - 35 + her)
print('old walk, him first:', old, start - 70 + old)
print('case 1 (male 65, male 65, 99%):', joint(65, 'male', 65, 'male', 99))
