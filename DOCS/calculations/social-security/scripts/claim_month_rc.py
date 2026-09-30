"""Case R-C of social-security-claim-age-monthly-refinement (round-one review of #765, issue 4), worked
by a separate script: the R-B landscape with a tighter coupling, primary = min(i1, i2 + k) + min(i2,
i1 + k), so each pass moves each claim fewer months and the search needs more than five passes. The
search re-implements the record's statement with no pass cap: whole passes repeat until one changes
no claim; `cap` reproduces the old five-pass stop for the wrong reading."""


def search(k, cap=None, order=('p1', 'p2')):
    start = {'p1': 66, 'p2': 66}
    best = {p: (66, 0) for p in ('p1', 'p2')}
    idx = lambda c: (c[0] - 65) * 12 + c[1]
    primary = lambda b: min(idx(b['p1']), idx(b['p2']) + k) + min(idx(b['p2']), idx(b['p1']) + k)
    best_row = primary(best)
    start_row = best_row
    priced = set()
    passes = 0
    changed = True
    while changed and (cap is None or passes < cap):
        passes += 1
        changed = False
        for p in order:
            local = best[p]
            for y in range(start[p] - 1, start[p] + 2):
                if y < 62 or y > 70 or y < 60:
                    continue
                for m in range(0, 1 if y == 70 else 12):
                    claim = dict(best)
                    claim[p] = (y, m)
                    priced.add((claim['p1'], claim['p2']))
                    v = primary(claim)
                    if v > best_row:
                        best_row = v
                        local = (y, m)
            if local != best[p]:
                best[p] = local
                changed = True
    return {'pick': best, 'primary change': best_row - start_row, 'priced': len(priced), 'passes': passes, 'settled': not changed}


for k in (3, 2, 1):
    print('k =', k, 'no cap:', search(k), '| p2 first:', search(k, order=('p2', 'p1'))['pick'], '| cap 5:', search(k, cap=5))
