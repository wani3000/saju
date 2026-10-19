"""Offline named IANA release cross-check; not independent historical evidence.

Compile the archived source instead of consulting the host timezone database.
Only temporary files are written; the application's original fixture is retained.
"""
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import hashlib
import json
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'fixtures/time-standards'
for record in json.loads((SOURCE / 'sources.json').read_text()):
    assert hashlib.sha256((SOURCE / record['file']).read_bytes()).hexdigest() == record['sha256']
zic = shutil.which('zic') or '/usr/sbin/zic'
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run([zic, '-d', tmp, str(SOURCE / 'iana-2025b-asia')], check=True, capture_output=True)
    with (Path(tmp) / 'Asia/Seoul').open('rb') as stream:
        zone = ZoneInfo.from_file(stream, key='Asia/Seoul')
    data = json.loads((ROOT / 'fixtures/seoul-transitions.json').read_text())
    samples = json.loads((ROOT / 'fixtures/seoul-wall-times.json').read_text())['cases']
    # Enumerate daily intervals throughout the support range, then locate every
    # change to the second. This detects transitions absent from the app fixture.
    start = int(datetime(1900, 1, 1, tzinfo=timezone.utc).timestamp())
    end = int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp())
    def offset(stamp):
        return int(datetime.fromtimestamp(stamp, timezone.utc).astimezone(zone).utcoffset().total_seconds())
    active = offset(start)
    assert active == data['initialOffsetSeconds']
    transitions = []
    for right in range(start + 86400, end + 1, 86400):
        if offset(right) == active:
            continue
        left = right - 86400
        while right - left > 1:
            mid = (left + right) // 2
            if offset(mid) == active:
                left = mid
            else:
                right = mid
        active = offset(right)
        transitions.append({'utcSeconds': right, 'offsetSeconds': active})
    assert transitions == data['transitions']
    for sample in samples:
        wall = datetime(**sample['wall'])
        choices = {}
        for fold in (0, 1):
            local = wall.replace(tzinfo=zone, fold=fold)
            utc = local.astimezone(timezone.utc)
            if utc.astimezone(zone).replace(tzinfo=None) == wall:
                choices[utc.timestamp()] = {
                    'utc': utc.isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
                    'offsetSeconds': int(local.utcoffset().total_seconds()),
                }
        assert [choices[key] for key in sorted(choices)] == sample['candidates'], sample
print(f'IANA 2025b: {len(transitions)} transitions and {len(samples)} wall cases match; source hashes verified')
