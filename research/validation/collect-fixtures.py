"""Download and derive expectations only from KASI tables, never candidate engines."""
import datetime as dt, hashlib, json, re, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
stems='갑을병정무기경신임계'; branches='자축인묘진사오미신유술해'
cycle=[stems[i%10]+branches[i%12] for i in range(60)]
fixtures={'sources':[], 'dates':[], 'terms':[]}
def rows(table):
    return [[re.sub('<[^>]*>','',v).strip() for v in re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)] for r in re.findall(r'<tr[^>]*>(.*?)</tr>',table,re.S)]
for year in [2023,2024]:
    url=f'https://astro.kasi.re.kr/kor/life/post/calendarData?search_year={year}'
    path=ROOT/'fixtures'/f'kasi-{year}.html'
    if not path.exists(): path.write_bytes(urllib.request.urlopen(url,timeout=30).read())
    data=path.read_bytes(); text=data.decode()
    lunar=re.search(r'<h2[^>]*>음력\('+str(year)+r'.*?</table>',text,re.S).group()
    terms=re.search(r'<h2[^>]*>24절기.*?</table>',text,re.S).group()
    lr=[r for r in rows(lunar) if len(r)==8]; tr=[r for r in rows(terms) if len(r)==5]
    assert len(lr) in (12,13) and len(tr)==24
    fixtures['sources'].append({'year':year,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'retrieved':'2026-10-09','notice':'KASI calendar data page says not official promulgated publication; minute-rounded times.'})
    for r in lr:
        leap='윤' in r[0]; month=int(r[1] if leap else r[0]); days=30 if r[3 if leap else 2]=='대' else 29
        start=dt.date(*map(int,r[5:8])); idx=cycle.index(r[4])
        for offset in range(days):
            solar=start+dt.timedelta(days=offset)
            fixtures['dates'].append({'solar':[solar.year,solar.month,solar.day],'lunar':[year,month,offset+1,leap],'dayPillar':cycle[(idx+offset)%60],'sourceYear':year,'derivation':'month-start + published month length; day pillar advanced on sexagenary cycle'})
    for index,r in enumerate(tr):
        fixtures['terms'].append({'year':year,'index':index,'name':r[0],'local':[year,*map(int,r[1:])],'sourceYear':year})
(ROOT/'fixtures'/'kasi-derived.json').write_text(json.dumps(fixtures,ensure_ascii=False,indent=2)+'\n')
print('KASI dates:',len(fixtures['dates']),'terms:',len(fixtures['terms']))
