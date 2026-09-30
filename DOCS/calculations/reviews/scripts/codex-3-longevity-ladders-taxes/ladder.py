from decimal import Decimal,getcontext
getcontext().prec=50
D=Decimal
curves={'A':[(5,D('2'))],'B':[(5,D('2'))],'C':[(5,D('0'))],'D':[(5,D('1.93')),(7,D('2.06')),(10,D('2.20')),(20,D('2.54')),(30,D('2.73'))], 'old':[(5,D('1.85')),(7,D('2.05')),(10,D('2.25')),(20,D('2.55')),(30,D('2.70'))]}
def y(curve,k):
 if k<=curve[0][0]:return curve[0][1]/100
 for (a,ya),(b,yb) in zip(curve,curve[1:]):
  if k<=b:return (ya+(yb-ya)*D(k-a)/D(b-a))/100
 return curve[-1][1]/100
def ladder(A,first,n,curve):
 faces={}; coupons={}; costs={}
 for k in range(first+n-1,first-1,-1):
  r=max(y(curve,k),D('.00125'));later=sum(faces[j]*coupons[j] for j in faces)
  faces[k]=(A-later)/(1+r);coupons[k]=r
 for k,F in faces.items():
  r=y(curve,k);c=coupons[k]
  costs[k]=sum(F*c/(1+y(curve,t))**t for t in range(1,k+1))+F/(1+r)**k
 return sum(costs.values()),faces,costs
for name,A,k,n in [('A',D(10200),1,1),('B',D(10200),1,2),('C',D(20000),3,2),('D',D(30000),2,20),('old',D(30000),2,20)]:
 C,F,P=ladder(A,k,n,curves[name]);print(name,'cost',C,'yield',100*A/C,'faces',F if n<=2 else 'omitted','costs',P if n<=2 else 'omitted')

