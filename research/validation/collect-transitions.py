"""Freeze host Asia/Seoul TZif transitions and Python zoneinfo boundary expectations.

No candidate engine is used. Both artifacts share IANA data, so passing proves
conversion against that dataset, not independent historical or pillar accuracy.
"""
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, TZPATH
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parent
source = next(Path(p) / 'Asia/Seoul' for p in TZPATH if (Path(p) / 'Asia/Seoul').exists())
raw = source.read_bytes()
zone = ZoneInfo.from_file(source.open('rb'), key='Asia/Seoul')

def header(pos):
    assert raw[pos:pos+4] == b'TZif'
    return struct.unpack('>6I', raw[pos+20:pos+44])

counts = header(0)
gmt, std, leap, times, types, chars = counts
pos = 44
width = 4
if raw[4:5] in (b'2', b'3', b'4'):
    pos += times * 5 + types * 6 + chars + leap * 8 + std + gmt
    gmt, std, leap, times, types, chars = header(pos)
    pos += 44
    width = 8
stamps = struct.unpack('>' + ('q' if width == 8 else 'i') * times, raw[pos:pos+times*width])
pos += times * width
indices = raw[pos:pos+times]
pos += times
infos = [struct.unpack('>iBB', raw[pos+i*6:pos+(i+1)*6]) for i in range(types)]
start = datetime(1899, 12, 30, tzinfo=timezone.utc)
end = datetime(2027, 1, 2, tzinfo=timezone.utc)
initial = int(start.astimezone(zone).utcoffset().total_seconds())
transitions = []
last = initial
for stamp, idx in zip(stamps, indices):
    offset = infos[idx][0]
    if start.timestamp() < stamp < end.timestamp() and offset != last:
        transitions.append({'utcSeconds': stamp, 'offsetSeconds': offset})
        last = offset
metadata = {'zone': 'Asia/Seoul', 'source': 'IANA TZif from host zoneinfo',
            'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'referenceUrl': 'https://data.iana.org/time-zones/tzdb-2025b/asia',
            'note': 'Reference URL documents the rules; this artifact is pinned by the host TZif hash, not claimed to be tzdb 2025b.',
            'collectedOn': '2026-10-13'}
data = {**metadata, 'minYear': 1900, 'maxYear': 2026,
        'initialOffsetSeconds': initial, 'transitions': transitions}
(ROOT / 'fixtures/seoul-transitions.json').write_text(json.dumps(data, indent=2)+'\n')

def expected(wall):
    candidates = {}
    for fold in (0, 1):
        aware = wall.replace(tzinfo=zone, fold=fold)
        utc = aware.astimezone(timezone.utc)
        if utc.astimezone(zone).replace(tzinfo=None) == wall:
            candidates[utc.timestamp()] = {'utc': utc.isoformat(timespec='milliseconds').replace('+00:00','Z'),
                                          'offsetSeconds': int(aware.utcoffset().total_seconds())}
    return [candidates[k] for k in sorted(candidates)]

walls = set()
before = initial
for transition in transitions:
    instant = datetime.fromtimestamp(transition['utcSeconds'], timezone.utc).replace(tzinfo=None)
    for offset in (before, transition['offsetSeconds']):
        boundary = instant + timedelta(seconds=offset)
        for delta in (-61, -1, 0, 1, 60, 1800, 3599, 3600):
            walls.add(boundary + timedelta(seconds=delta))
    before = transition['offsetSeconds']
for year in range(1900, 2027):
    for month in range(1, 13):
        walls.add(datetime(year, month, 15, 12))
rows=[]
for wall in sorted(walls):
    if 1900 <= wall.year <= 2026:
        choices=expected(wall)
        rows.append({'wall': {'year':wall.year,'month':wall.month,'day':wall.day,'hour':wall.hour,'minute':wall.minute,'second':wall.second},
                     'status': {0:'nonexistent',1:'unique',2:'ambiguous'}[len(choices)], 'candidates':choices})
(ROOT / 'fixtures/seoul-wall-times.json').write_text(json.dumps({**metadata,'cases':rows}, indent=2)+'\n')
print(f'{len(transitions)} offset transitions, {len(rows)} wall-clock cases')
