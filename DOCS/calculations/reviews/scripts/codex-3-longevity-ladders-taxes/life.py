from pathlib import Path
import re, math, hashlib
p=Path('DOCS/calculations/longevity/ssa-period-life-table.md').read_text(encoding='utf-8')
rows={}
for line in p.splitlines():
 m=re.match(r'^\|\s*(\d+)\s*\|\s*(0\.\d{6}|1\.000000)\s*\|\s*(\d+\.\d{2})\s*\|\s*(0\.\d{6}|1\.000000)\s*\|\s*(\d+\.\d{2})\s*\|',line)
 if m: rows[int(m[1])]=(float(m[2]),float(m[3]),float(m[4]),float(m[5]))
print('rows',len(rows),'first',rows.get(0),'last',rows.get(119))
canon='age,qM,eM,qF,eF\n'+''.join(f'{a},{rows[a][0]:.6f},{rows[a][1]:.2f},{rows[a][2]:.6f},{rows[a][3]:.2f}\n' for a in range(120))
print('sha256',hashlib.sha256(canon.encode()).hexdigest())
def s(age,sex,t,h=1):
 if age<0: return s(0,sex,t+age,h) if t+age>=0 else 1
 if sex=='avg':return (s(age,'m',t,h)+s(age,'f',t,h))/2
 z=1
 for x in range(age,age+t):z*= (1-(rows[x][0 if sex=='m' else 2] if x<119 else 1))**h
 return z
def E(age,sex,h=1):return .5+sum(s(age,sex,t,h) for t in range(1,max(121-age,1)))
def pct(age,sex,p,h=1):return max([age]+[age+t for t in range(1,max(121-age,1)) if s(age,sex,t,h)>=p])
def joint(a,sa,b,sb,t):return 1-(1-s(a,sa,t))*(1-s(b,sb,t))
def je(a,sa,b,sb):return .5+sum(joint(a,sa,b,sb,t) for t in range(1,max(121-a,121-b)))
print('survival65',*[f'{sex}:{[s(65,sex,t) for t in range(1,5)]}' for sex in ('m','f','avg')])
print('pct65', {sex:[pct(65,sex,p) for p in (.97,.5,.25,.1)] for sex in ('m','f','avg')})
print('joint65 ages69-71',[joint(65,'m',65,'m',t) for t in (4,5,6)])
print('joint65 99',[65+t for t in range(0,56) if joint(65,'m',65,'m',t)>=.99][-1])
print('joint70/35 25',[70+t for t in range(0,86) if joint(70,'m',35,'f',t)>=.25][-1])
print('joint men118',je(118,'m',118,'m'))
print('joint 70/67',je(70,'m',67,'f'),je(70,'avg',67,'avg'))
print('E65',*[E(65,x) for x in ('m','f','avg')])
print('pct woman25 10',pct(25,'f',.1))
for sex in ('m','f','avg'):
 target=.8*E(65,sex);lo=.2;hi=8
 for _ in range(40):
  mid=(lo+hi)/2
  if E(65,sex,mid)>target:lo=mid
  else:hi=mid
 print('hazard65',sex,(lo+hi)/2)
print('negative joint',je(-2,'m',118,'m'))
