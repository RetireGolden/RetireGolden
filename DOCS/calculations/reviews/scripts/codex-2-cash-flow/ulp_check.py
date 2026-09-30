import random, math
random.seed(2)
for m in range(2,20):
 for z in range(100000):
  t=round(random.uniform(1,1e6),2)
  needs=[round(random.uniform(0,t/(m+1)),2) for _ in range(m)]
  rem=t; b=[]
  for n in needs:
   x=min(rem,n); b.append(x); rem-=x
  b.append(rem)
  delta=sum(b)-t
  if abs(delta)>math.ulp(t):
   print(m,t,needs,b,delta,math.ulp(t)); quit()
print('none')
