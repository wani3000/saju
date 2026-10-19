"""Controlled delta-T experiment. Online refresh explicit; verification offline by default."""
import argparse
import hashlib
import json
import urllib.request
import importlib.util
from pathlib import Path
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('naoj', ROOT / 'collect-naoj.py')
naoj = importlib.util.module_from_spec(spec)
spec.loader.exec_module(naoj)
CASES = [(1954, 22, '31.031079'), (1988, 18, '56.425241'), (2024, 21, '69.085702')]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--thresholds', action='store_true', help='Verify the later minute-transition controls')
    parser.add_argument('--retrieved', type=naoj.dt.date.fromisoformat)
    args = parser.parse_args()
    if args.download and not args.retrieved:
        parser.error('--download requires --retrieved YYYY-MM-DD')
    directory = ROOT / 'fixtures' / ('naoj-threshold' if args.thresholds else 'naoj-sensitivity')
    cases = [(y, i, v) for y, i, d in CASES for v in ['0', d]]
    if args.thresholds:
        cases = [(1988,18,v) for v in ['55','56','57']] + [(2024,21,v) for v in ['67','68','69']] + [(1988,18,'55.1'),(2024,21,'68.9')]
    manifest = directory / 'sources.json'
    sources = [] if args.download else json.loads(manifest.read_text())
    for n, (year, index, value) in enumerate(cases):
        url = f'{naoj.BASE}?year={year}&lst=0&phenom=50&jg=1&dtm=99&dt={value}'
        filename = f'{year}-dt-{value}.html'
        raw = urllib.request.urlopen(url, timeout=30).read() if args.download else (directory / filename).read_bytes()
        delta, terms = naoj.parse_table(raw, year)
        assert '(入力値)' in delta
        assert abs(float(delta.split('s')[0]) - float(value)) <= 0.051
        record = dict(year=year, index=index, deltaTInput=value, url=url, file=filename,
                      retrieved=args.retrieved.isoformat() if args.download else sources[n]['retrieved'],
                      sha256=hashlib.sha256(raw).hexdigest(), deltaTDisplayed=delta, term=terms[index])
        if args.download:
            directory.mkdir(exist_ok=True)
            (directory / filename).write_bytes(raw)
            sources.append(record)
        else:
            assert record == sources[n], 'NAOJ_SENSITIVITY_DRIFT'
    assert len(sources) == len(cases)
    if args.download:
        manifest.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n')
    print(f'NAOJ delta-T controls: {len(cases)} pinned responses verified')

if __name__ == '__main__':
    main()
