"""Pinned public KASI month pages; no candidate engine is used to derive expectations."""
import argparse
import calendar
import gzip
import hashlib
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIR = ROOT / "fixtures/kasi-months"
URL = "https://astro.kasi.re.kr/kor/life/pageView/5"
MONTHS = [(1908,1),(1908,4),(1912,2),(1920,2),(1930,1),(1940,2),(1948,6),
          (1954,3),(1954,12),(1961,8),(1972,1),(1972,7),(1987,5),(1987,10),
          (1988,5),(1988,10),(2000,2),(2012,5),(2020,5),(2020,6),
          (2025,7),(2025,8),(2026,2),(2026,10)]
def digest(data):
    return hashlib.sha256(data).hexdigest()
def cells(row):
    return [html.unescape(re.sub(r"<[^>]+>","",c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>",row,re.S)]
def parse_month(raw, year, month):
    text = raw.decode("utf-8")
    if not re.search(fr"양력 {year}년 0?{month}월 달력정보",text):
        raise ValueError("REQUESTED_MONTH_NOT_RETURNED")
    table = re.search(r'<table[^>]*class="[^"]*monthly_bg[^"]*"[^>]*>(.*?)</table>',text,re.S)
    if not table or "그레고리력" not in table[1]:
        raise ValueError("GREGORIAN_TABLE_MISSING")
    records = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>",table[1],re.S):
        c = cells(row)
        if not c:
            continue
        if len(c) != 5:
            raise ValueError("UNEXPECTED_CALENDAR_COLUMNS")
        solar = re.fullmatch(r"(\d+)년\s*(\d+)월\s*(\d+)일",c[0])
        lunar = re.fullmatch(r"(\d+)년\s*(윤?)(\d+)월\s*(\d+)일",c[1])
        day_pillar = re.search(r"([갑을병정무기경신임계][자축인묘진사오미신유술해])\([^()]+\)일$",c[2])
        if not solar or not lunar or not day_pillar:
            raise ValueError("UNRECOGNIZED_SOURCE_ROW")
        sy,sm,sd = map(int,solar.groups())
        if (sy,sm) != (year,month):
            raise ValueError("MIXED_SOURCE_MONTH")
        records.append({"solar":[sy,sm,sd],"lunar":[int(lunar[1]),int(lunar[3]),int(lunar[4]),bool(lunar[2])],
                        "dayPillar":day_pillar[1],"sourceGanji":c[2],"sourceMonth":f"{year}-{month:02}"})
    expected = calendar.monthrange(year,month)[1]
    if [r["solar"][2] for r in records] != list(range(1,expected+1)):
        raise ValueError("INCOMPLETE_OR_DUPLICATED_SOURCE_DAYS")
    return records

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--download",action="store_true")
    parser.add_argument("--check",action="store_true")
    args=parser.parse_args()
    if args.download and args.check:
        parser.error("download and check are separate operations")
    DIR.mkdir(exist_ok=True)
    manifest_path=DIR/"sources.json"
    if args.download:
        sources=[]
        for year,month in MONTHS:
            params={"search_year":str(year),"search_month":f"{month:02}","search_dp":"1","search_check":"G"}
            request=urllib.request.Request(URL,data=urllib.parse.urlencode(params).encode(),
                                           headers={"Content-Type":"application/x-www-form-urlencoded"})
            raw=urllib.request.urlopen(request,timeout=30).read()
            parse_month(raw,year,month)
            compressed=gzip.compress(raw,mtime=0)
            name=f"kasi-{year}-{month:02}.html.gz"
            (DIR/name).write_bytes(compressed)
            sources.append({"year":year,"month":month,"file":name,"url":URL,"method":"POST","parameters":params,
                            "retrievedOn":"2026-10-20","sha256":digest(raw),"gzipSha256":digest(compressed)})
            time.sleep(0.15)
        manifest_path.write_text(json.dumps({"sources":sources},ensure_ascii=False,indent=2)+"\n")
    manifest=json.loads(manifest_path.read_text())
    if [(s["year"],s["month"]) for s in manifest["sources"]] != MONTHS:
        raise ValueError("SOURCE_SELECTION_CHANGED")
    dates=[]
    for s in manifest["sources"]:
        expected_parameters={"search_year":str(s["year"]),"search_month":f'{s["month"]:02}',"search_dp":"1","search_check":"G"}
        if s["url"]!=URL or s["method"]!="POST" or s["parameters"]!=expected_parameters:
            raise ValueError("SOURCE_REQUEST_MISMATCH")
        compressed=(DIR/s["file"]).read_bytes()
        raw=gzip.decompress(compressed)
        if digest(raw)!=s["sha256"] or digest(compressed)!=s["gzipSha256"]:
            raise ValueError("SOURCE_HASH_MISMATCH")
        dates.extend(parse_month(raw,s["year"],s["month"]))
    value={"source":"KASI public monthly Gregorian-to-lunar table, fetched separately from candidate engines",
           "retrievedOn":"2026-10-20","sourcesManifest":"kasi-months/sources.json","dates":dates,
           "limitations":["Selected months only, not continuous coverage of 1908..2026.",
                          "The source lunar year/month ganji are not solar-term saju year/month pillars.",
                          "Historical outputs are the current service's proleptic Gregorian conversion, not period birth records or clock-transition evidence.",
                          "Day pillars are published date labels; they do not select 23:00 vs midnight or validate hour pillars."]}
    output=ROOT/"fixtures/kasi-months-derived.json"
    serialized=json.dumps(value,ensure_ascii=False,indent=2)+"\n"
    if args.check:
        if output.read_text()!=serialized:
            raise ValueError("KASI_DERIVATION_STALE")
    else:
        output.write_text(serialized)
    print(f"PASS: {len(manifest['sources'])} pinned KASI months; {len(dates)} date rows reproduced.")

if __name__=="__main__":
    main()
