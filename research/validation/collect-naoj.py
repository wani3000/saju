"""Pin independent NAOJ solar-term tables; no candidate engine imports.

Online refresh: python3 collect-naoj.py --download --retrieved YYYY-MM-DD
Offline rebuild: python3 collect-naoj.py
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
YEARS = [1908, 1912, 1948, 1954, 1961, 1988, 2000, 2024]
BASE = "https://eco.mtk.nao.ac.jp/cgi-bin/koyomi/cande/phenomena_sy.cgi"


def parse_table(raw, year):
    text = raw.decode("euc_jp")
    result = text.split('id="skipr"', 1)[1]
    assert f"{year}年の天象" in result and "標準時:UT+0<sup>h</sup>" in result
    assert "日付はすべてグレゴリオ暦" in result
    delta_t = re.search(r"ΔＴ＝(.*?)</span>", result).group(1)
    delta_t = html.unescape(re.sub(r"<[^>]+>", "", delta_t)).strip()
    table = re.search(r'<table[^>]*id="phenom".*?</table>', result, re.S).group()
    entries = []
    for row in re.findall(r"<tr>(.*?)</tr>", table, re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
                 for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if not cells:
            continue
        assert len(cells) == 6 and cells[3] == "二十四節気"
        name, longitude = re.fullmatch(r"(.+)\(黄経(\d+)°\)", cells[5]).groups()
        stamp = dt.datetime.strptime(f"{cells[0]} {cells[1]}", "%Y/%m/%d %H:%M")
        assert stamp.year == year
        entries.append({"index": len(entries), "name": name,
                        "longitude": int(longitude), "ut": stamp.isoformat() + "Z"})
    assert len(entries) == 24
    assert [e["longitude"] for e in entries] == [(285 + i * 15) % 360 for i in range(24)]
    assert [e["ut"] for e in entries] == sorted(e["ut"] for e in entries)
    return delta_t, entries


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--retrieved", type=dt.date.fromisoformat)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.download and not args.retrieved:
        parser.error("--download requires --retrieved YYYY-MM-DD")
    if args.download and args.check:
        parser.error("--check is offline and cannot be combined with --download")
    directory = ROOT / "fixtures" / "naoj"
    directory.mkdir(exist_ok=True)
    manifest_path = directory / "sources.json"
    if args.download:
        sources = []
        for year in YEARS:
            url = f"{BASE}?year={year}&lst=0&phenom=50&jg=1&dtm=0"
            raw = urllib.request.urlopen(url, timeout=30).read()
            parse_table(raw, year)  # reject errors/default-year responses before pinning
            (directory / f"{year}.html").write_bytes(raw)
            sources.append({"year": year, "url": url, "file": f"{year}.html",
                            "retrieved": args.retrieved.isoformat(),
                            "sha256": hashlib.sha256(raw).hexdigest()})
        manifest_path.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n")
    sources = json.loads(manifest_path.read_text())
    assert [s["year"] for s in sources] == YEARS
    terms = []
    for source in sources:
        raw = (directory / source["file"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == source["sha256"]
        delta_t, entries = parse_table(raw, source["year"])
        terms.extend({**entry, "sourceYear": source["year"], "deltaT": delta_t} for entry in entries)
    fixture = {"attribution": "(C) NAOJ — Ephemeris Computation Office",
               "usage": "https://eco.mtk.nao.ac.jp/koyomi/site/",
               "timeScale": "UT+0 as displayed by NAOJ; minute precision; not second-exact UTC",
               "limitations": "Modern retrospective calculation, not the historical published almanac. Default delta-T model retained per source. No DST in source; apply pinned Seoul offsets separately.",
               "sources": sources, "terms": terms}
    output = ROOT / "fixtures" / "naoj-terms.json"
    serialized = json.dumps(fixture, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        assert output.read_text() == serialized, "NAOJ_FIXTURE_DRIFT"
    else:
        output.write_text(serialized)
    print(f"NAOJ: {len(sources)} years, {len(terms)} independent term timestamps")


if __name__ == "__main__":
    main()
