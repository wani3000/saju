"""Recompute independent JPL roots locally. No candidate engine or NAOJ seeds.

Install requirements-ephemeris.txt in a venv. --download restores only the exact
hash-locked kernel; default requires the cached kernel. --check never writes.
"""
import argparse
import hashlib
import importlib.metadata
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    lock = json.loads((ROOT / 'ephemeris.lock.json').read_text())
    for name, version in lock['dependencies'].items():
        assert importlib.metadata.version(name) == version, f'DEPENDENCY_DRIFT: {name}'
    kernel = ROOT / '.ephemeris-cache' / lock['kernel']['file']
    if args.download and not kernel.exists():
        raw = urllib.request.urlopen(lock['kernel']['url'], timeout=60).read()
        assert len(raw) == lock['kernel']['bytes']
        assert hashlib.sha256(raw).hexdigest() == lock['kernel']['sha256'], 'KERNEL_HASH_MISMATCH'
        kernel.parent.mkdir(exist_ok=True)
        kernel.write_bytes(raw)
    raw = kernel.read_bytes()  # Missing cache must fail; never claim an offline recheck ran.
    assert len(raw) == lock['kernel']['bytes']
    assert hashlib.sha256(raw).hexdigest() == lock['kernel']['sha256'], 'KERNEL_HASH_MISMATCH'
    from skyfield.api import load, load_file
    from skyfield import almanac
    from skyfield.nutationlib import iau2000a_radians
    ts = load.timescale(builtin=True)
    eph = load_file(str(kernel))
    earth, sun = eph['earth'], eph['sun']
    def solar_term(t):
        # Full IAU2000A; Skyfield's stock east-Asia search uses abbreviated 2000B.
        t._nutation_angles_radians = iau2000a_radians(t)
        longitude = earth.at(t).observe(sun).apparent().ecliptic_latlon('date')[1].degrees
        return (longitude // 15).astype(int)
    solar_term.step_days = 14
    start, end = lock['years']
    times, indices = almanac.find_discrete(ts.tt(start, 1, 1), ts.tt(end + 1, 1, 1),
        solar_term, epsilon=lock['searchToleranceSeconds'] / 86400)
    assert (solar_term(ts.tt_jd(times.tt - 0.005/86400)) == (indices - 1) % 24).all()
    assert (solar_term(ts.tt_jd(times.tt + 0.005/86400)) == indices).all()
    terms = [dict(year=int(t.tt_calendar()[0]), index=(int(i)-19)%24,
        ttJulianDay=float(t.tt), nutationLongitudeRadians=float(iau2000a_radians(t)[0]))
        for t, i in zip(times, indices)]
    eph.close()
    assert len(terms) == (end-start+1)*24
    for year in range(start, end+1):
        assert [t['index'] for t in terms if t['year'] == year] == list(range(24))
    fixture = dict(provenance=lock, terms=terms)
    output = ROOT / 'fixtures' / 'jpl-de440s-terms.json'
    checksum = output.with_suffix('.sha256')
    if args.check:
        pinned_bytes = output.read_bytes()
        assert hashlib.sha256(pinned_bytes).hexdigest() == checksum.read_text().strip(), 'FIXTURE_HASH_MISMATCH'
        pinned = json.loads(pinned_bytes)
        assert pinned['provenance'] == lock and len(pinned['terms']) == len(terms)
        for expected, actual in zip(pinned['terms'], terms):
            assert (expected['year'], expected['index']) == (actual['year'], actual['index'])
            # Allow last-bit/libm/search variation; this is a reproducibility
            # tolerance, NOT a statement of astronomical physical accuracy.
            assert abs(expected['ttJulianDay']-actual['ttJulianDay'])*86400 < 0.002
            assert abs(expected['nutationLongitudeRadians']-actual['nutationLongitudeRadians']) < 1e-10
    else:
        data = (json.dumps(fixture, indent=2)+'\n').encode()
        output.write_bytes(data)
        checksum.write_text(hashlib.sha256(data).hexdigest()+'\n')
    print(f'JPL DE440s: {len(terms)} independent TT roots, IAU2000A, productionApproved=false')

if __name__ == '__main__':
    main()
