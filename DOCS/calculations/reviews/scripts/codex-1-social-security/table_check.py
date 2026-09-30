"""Compare worksheet transcriptions to saved publisher extracts, without packages/."""
from pathlib import Path
from html.parser import HTMLParser
from decimal import Decimal
import json
import re

ROOT=Path('DOCS/calculations/social-security')

class Cells(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows=[]; self.row=None; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=='tr': self.row=[]
        if tag in ('td','th'): self.cell=''
    def handle_data(self,data):
        if self.cell is not None: self.cell+=data
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(self.cell.split())); self.cell=None
        if tag=='tr' and self.row is not None:
            self.rows.append(self.row); self.row=None

def cells(path):
    p=Cells(); p.feed(path.read_text(encoding='utf8')); return p.rows

def years(token):
    a,_,b=token.partition('-'); start=int(a); end=int(b) if b else start
    if b and len(b)==2: end=start//100*100+end
    return range(start,end+1)

def sheet_rows(name):
    t=(ROOT/(name+'.md')).read_text(encoding='utf8')
    t=t.split('## Expected')[1].split('## Wrong readings')[0]
    return [list(map(str.strip,line.strip('|').split('|'))) for line in t.splitlines() if re.match(r'^\|\s*\d{4}\s*\|',line)]

def compare_cpi():
    src=json.loads((ROOT/'sources/bls-cpiu/data-viewer-annual-1937-2025.json').read_text(encoding='utf8'))['annual']
    rows=sheet_rows('cpi-u-annual-average')
    diff=[(y,v,src.get(y)) for y,v in rows if Decimal(v)!=Decimal(src.get(y,'NaN'))]
    print('CPI',len(rows),len(src),'mismatch',diff)

def compare_qc():
    src={}
    for row in cells(ROOT/'sources/ssa-quarter-of-coverage.table.html'):
        if len(row)>=2 and re.fullmatch(r'\d{4}',row[0]):
            src[row[0]]=int(row[1].replace('$','').replace(',',''))
    rows=sheet_rows('covered-work-credit-estimate')
    rows=[(a.replace('QC ',''),b) for a,b in rows if a.startswith('QC ')] if rows else []
    if not rows:
        t=(ROOT/'covered-work-credit-estimate.md').read_text(encoding='utf8').split('## Expected')[1].split('## Wrong readings')[0]
        rows=[(m.group(1),m.group(2)) for m in re.finditer(r'^\| QC (\d{4}) \| (\d+) \|',t,re.M)]
    diff=[(y,v,src.get(y)) for y,v in rows if int(v)!=src.get(y)]
    print('QC',len(rows),len(src),'mismatch',diff)

def compare_rates():
    source={}
    for row in cells(ROOT/'sources/ssa-oasdi-rates.table.html'):
        yr=re.match(r'^(\d{4}(?:-\d{2,4})?)',row[0]) if len(row)>=7 else None
        if yr:
            span=range(2019,2027) if 'and later' in row[0] else years(yr.group(1))
            for y in span:
                emp=Decimal(row[3].replace(',',''))
                se=None if row[6]=='--' else Decimal(row[6].replace(',',''))
                source[y]=(emp,se)
    table=[]
    for row in sheet_rows('oasdi-tax-rate-history'):
        y=int(row[0]); emp=Decimal(row[1]); er=Decimal(row[2]); se=None if row[3]=='none' else Decimal(row[3]); table.append((y,emp,er,se))
    diff=[]
    for y,emp,er,se in table:
        expected_er,expected_se=source[y]
        expected_emp=Decimal('5.4') if y==1984 else Decimal('4.2') if y in (2011,2012) else expected_er
        if y in (2011,2012): expected_se=Decimal('10.4')
        if (emp,er,se)!=(expected_emp,expected_er,expected_se):
            diff.append((y,emp,er,se,expected_emp,expected_er,expected_se))
    print('rates',len(table),len(source),'mismatch',diff)

compare_cpi(); compare_qc(); compare_rates()
