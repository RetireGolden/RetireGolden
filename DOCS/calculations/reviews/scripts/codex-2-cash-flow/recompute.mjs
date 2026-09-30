const needs=[10000,20000,30000,40000,50000],totals=[200000,150000,100000,60000,20000];
function lens(t,n,s,i){let rem=t,c=i,b=[];for(const span of s){let nn=0;for(let k=0;k<span&&c+k<n.length;k++)nn+=n[c+k];c+=span;let v=Math.min(rem,nn);b.push(v);rem-=v}return [...b,rem]}
for (const s of [[2,8],[3]]) console.log('lens',JSON.stringify(s),totals.map((t,i)=>lens(t,needs,s,i)));
console.log('floatlens',lens(100000.01,[1028.55,2057.21,0],[1,1],0));
let a=[41234.11,17890.2,3000.3,0,12.07].reduce((x,y)=>x+y,0);let b=((([41234.11,3000.3,12.07].reduce((x,y)=>x+y,0)+17890.2)+0));console.log('hub',a,b,b-a,'unfunded',[0,1500.25,0,300.5,0.1].reduce((x,y)=>x+y,0));
let f=1;for(let i=0;i<=40;i++){if([5,10,40].includes(i))console.log('factor',i,f);f*=1.025}
for(let [x,y,n] of [[.912,.948,'Y'],[.912,.916,'AA'],[.501,.500,'AB']]) console.log('mc',n,y-x);
console.log('sumV',[.1,.2,.3].reduce((a,b)=>a+b,0),'sumX',[48123.46,51234.57,.51].reduce((a,b)=>a+b,0));
