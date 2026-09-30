"""Independent finite coordinate search for worksheet R-A/R-B/R-C."""
def search(gap):
    cur=(12,12)
    seen=set()
    passes=0
    def primary(pair):
        a,b=pair
        return min(a,b+gap)+min(b,a+gap)
    while True:
        passes+=1
        changed=False
        for axis in range(2):
            for month in range(36):
                pair=list(cur);pair[axis]=month;pair=tuple(pair)
                if pair not in seen: seen.add(pair)
                if primary(pair)>primary(cur):
                    cur=pair;changed=True
        if not changed: break
    return cur, primary(cur)-24, len(seen), passes

for gap in (3,2): print(gap,search(gap))
