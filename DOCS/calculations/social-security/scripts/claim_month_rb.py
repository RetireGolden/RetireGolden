"""Case R-B of social-security-claim-age-monthly-refinement, worked by a separate script.

Two open claims, p1 and p2, both aged 60 in the start year, whose whole-year pick is 66 each. The
month index i of a claim is its months since 65y0m (0 to 35 over the window 65y0m to 67y11m). The
objective is coupled: primary = min(i1, i2 + 3) + min(i2, i1 + 3), every month eligible. The search
re-implements the record's statement: people in the order given, every month of the window around
the STARTING whole year, strictly greater primary replaces the incumbent, whole passes repeat until
one changes no claim, with no pass cap; a combination priced once is not priced again. The default
run is the worksheet's (six passes, 335 combinations, primary change 46); `max_passes` reproduces
the capped wrong readings, and `drift` the window that follows the incumbent.
"""


def search(max_passes=None, drift=False, order=('p1', 'p2')):
    start = {'p1': 66, 'p2': 66}
    best = {p: (66, 0) for p in order}
    idx = lambda c: (c[0] - 65) * 12 + c[1]
    primary = lambda b: min(idx(b['p1']), idx(b['p2']) + 3) + min(idx(b['p2']), idx(b['p1']) + 3)
    best_row = primary(best)
    start_row = best_row
    priced = set()
    passes = 0
    changed = True
    while changed and (max_passes is None or passes < max_passes):
        passes += 1
        changed = False
        for p in order:
            base = best[p][0] if drift else start[p]
            local = best[p]
            for y in range(base - 1, base + 2):
                if y < 62 or y > 70 or y < 60:
                    continue
                for m in range(0, 1 if y == 70 else 12):
                    claim = dict(best)
                    claim[p] = (y, m)
                    priced.add(tuple(claim[q] for q in ('p1', 'p2')))
                    v = primary(claim)
                    if v > best_row:
                        best_row = v
                        local = (y, m)
            if local != best[p]:
                best[p] = local
                changed = True
    return {'pick': {q: best[q] for q in ('p1', 'p2')}, 'primary': best_row, 'primary change': best_row - start_row,
            'priced': len(priced), 'passes': passes, 'settled': not changed}


for label, kw in [('record', {}), ('p2 first', {'order': ('p2', 'p1')}), ('one pass', {'max_passes': 1}),
                  ('two passes', {'max_passes': 2}), ('old five-pass cap', {'max_passes': 5}),
                  ('window drifts, five passes', {'drift': True, 'max_passes': 5})]:
    print(label, search(**kw))
