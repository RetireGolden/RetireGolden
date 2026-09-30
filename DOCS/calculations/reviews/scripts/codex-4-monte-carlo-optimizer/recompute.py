"""Independent arithmetic for the assigned worksheets; imports no project code."""
import math
import struct
import re
from pathlib import Path


def show(label, value):
    print(f"{label}: {value}")


def garch(sig, alpha, beta, zs):
    v = sig * sig
    omega = v * (1 - alpha - beta)
    out = []
    for z in zs:
        e = math.sqrt(v) * z
        out.append((v, 100 * e))
        v = omega + alpha * e * e + beta * v
    return out


show("garch default", garch(.12, .1, .85, [1, .5, -2, 0]))
show("garch second", garch(1, .1, .8, [1, .5, -2]))
show("garch iid", garch(.12, 0, 0, [1, -2, .5]))


def gamma_attempt(df, u1, u2, u):
    d = df / 2 - 1 / 3
    c = 1 / math.sqrt(9 * d)
    x = math.sqrt(-2 * math.log(max(u1, 1e-12))) * math.cos(2 * math.pi * u2)
    s = 1 + c * x
    v = s**3 if s > 0 else None
    squeeze = 1 - .0331 * x**4
    exact = (x*x/2 + d*(1-v+math.log(v))) if v else None
    return d, c, x, s, v, squeeze, exact, (2*d*v if v else None)


for name, df, u in [("B1", 5, (.5, 0, .5)), ("B2 rejection", 5, (1e-5, .5, .5)),
                    ("B3 rejection", 5, (.5, 0, .999)), ("B4", 2.5, (.5, 0, .5))]:
    a = gamma_attempt(df, *u)
    show(name, a)
    if a[-1]:
        z = -2 if name == "B4" else 1
        m = math.sqrt((df - 2)/a[-1])
        show(name + " shock", 12 * m * z)

V = gamma_attempt(5, .5, 0, .5)[-1]
m = math.sqrt(3/V)
show("student wrong unscaled", 12*math.sqrt(5/V))
show("student wrong Gamma", 12*math.sqrt(3/(V/2)))
show("student wrong shape", 12*math.sqrt(3/gamma_attempt(10, .5, 0, .5)[-1]))
show("student wrong sine", 12*math.sqrt(3/(2*(5/2-1/3))))
show("student inflation", 1.5*(-.2*m + math.sqrt(.96)*.5))
show("student wrong inflation", 1.5*(-.2 + math.sqrt(.96)*.5))
show("student kurtosis", 3*(1-.95**2)/(1-.95**2-2*.1**2))

def garch_wrong(mode):
    v=.0144
    if mode == "pre-update": v=.00072+.85*v
    out=[]
    for z in [1,.5,-2,0]:
        e=math.sqrt(v)*z
        out.append(100*e)
        if mode == "percent-feedback":
            v=.00072+.1*(100*e)**2+.85*v
        elif mode == "omega-1e-5":
            v=1e-5+.1*e*e+.85*v
        else:
            v=.00072+.1*e*e+.85*v
    return out
for mode in ["percent-feedback","omega-1e-5","pre-update"]:
    show("garch wrong "+mode,garch_wrong(mode))

v=.0001
old=[]
for z in [1,.5,-2,0]:
    v=.00001+.85*v if not old else .00001+.1*(old[-1]/100)**2+.85*v
    old.append(100*math.sqrt(v)*(.12*5)*z)
show("garch earlier recursion",old)

# Read only the published observations, never a function body or executable module.
raw=Path("packages/engine/src/montecarlo/historicalReturns.ts").read_text()
rows=[(int(y),float(s),float(b),float(i)) for y,s,b,i in re.findall(
    r"\{ year: (\d+), stocksPct: ([\d.-]+), bondsPct: ([\d.-]+), inflationPct: ([\d.-]+) \}",raw)]
blends=[.6*s+.4*b for _,s,b,_ in rows]
mean=sum(blends)/len(blends)
show("history count sum mean",(len(rows),sum(blends),mean))
lookup={y:(s,b,i) for y,s,b,i in rows}
for y in [2004,2003,2002,2001,2000,2009,2008,2007]:
    s,b,i=lookup[y]
    show(f"reversed {y}",(.6*s+.4*b-mean,i))


seed = 0x5eeded
mask = 2**32-1
def path_seed(index):
    h = seed ^ (((index + 1) * 0x9e3779b9) & mask)
    h = ((h ^ (h >> 16)) * 0x21f0aaad) & mask
    h = ((h ^ (h >> 15)) * 0x735a2d97) & mask
    return h ^ (h >> 15)
show("seed", (seed, path_seed(0), path_seed(1)))


def fnv1a(s):
    h = 2166136261
    for c in s:
        h = ((h ^ ord(c)) * 16777619) & mask
    return h
show("old FNV reading", fnv1a("example:all-401k-no-bridge"))


def edge(target):
    lo, hi = .02, 4
    for _ in range(10):
        mid = (lo + hi)/2
        if min(1, mid/2) >= target: hi = mid
        else: lo = mid
    return lo, hi
fl, fu = edge(.7)[1], edge(.95)[1]
show("guardrail edges", (edge(.7), edge(.95), fl*10000, fu*10000))
def spend(f, lo, hi):
    for _ in range(8):
        mid=(lo+hi)/2
        if min(1, f/(2*mid)) >= .825: lo=mid
        else: hi=mid
    return lo, abs(1-lo)*40000, abs(1-lo)*40000/12, min(1, f/(2*lo))
show("guardrail cut", spend(fl, .3, 1))
show("guardrail raise", spend(fu, 1, 2))


show("fan row", ((400000,1300000),(600000,1000000),1300000-400000,1000000-600000))
for name, vals, bins in [("hist A",[100000,1600000],30),("hist B",[0,0,250000,1200000,3000000],30),
                        ("hist C",[0,0,0,0],30),("hist D",[],30),("hist E",[0,20,40,80,100],4)]:
    mn=min(vals) if vals else 0
    mx=max(vals) if vals else 0
    w=(mx-mn)/bins if mx>mn else 1
    cs=[mn+(i+.5)*w if mx>mn else mn for i in range(bins)]
    counts=[0]*bins
    for v in vals: counts[min(bins-1,math.floor((v-mn)/w))]+=1
    show(name,(w,cs,counts))


show("claim gains", (1118000-1000000, 2109001.02-2103456.78))
show("claim gain bits", struct.pack(">d",2109001.02-2103456.78).hex())


def factor(rate, start, end):
    f=1.0
    for _ in range(end-start): f*=1+rate
    return f
fb=factor(.025,2026,2050)
fp=factor(.025,2026,2060)
show("money I", (fb,fp,1800000/fb,2000000/fp,2000000/fp-1800000/fb))
show("money J", (5000+5100/1.02,3000+3060/1.02+3121.2/1.0404))
show("relocation N",363292.60-433212.40)
f=factor(.025,2026,2059)
show("relocation P",(f,4058000/f))

# Student-t(5) two-sided tail via t = sqrt(5)*tan(theta). Simpson integration.
def t5_tail_scaled(threshold):
    x=threshold/math.sqrt(3/5)
    lo=math.atan(x/math.sqrt(5))
    hi=math.pi/2
    n=100000
    step=(hi-lo)/n
    # t5 PDF times the Jacobian sqrt(5) sec^2(theta) = 8/(3*pi) cos^4(theta).
    total=math.cos(lo)**4+math.cos(hi)**4
    for k in range(1,n):
        total+=(4 if k%2 else 2)*math.cos(lo+k*step)**4
    return 2*(8/(3*math.pi))*step*total/3
show("student P(abs(t)>3)",t5_tail_scaled(3))
for vol in [12,20,25]:
    show(f"student P(shock<=-105) vol {vol}",t5_tail_scaled(105/vol)/2)
