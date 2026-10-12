"""Independent historical offset expectations from the host IANA zoneinfo database."""
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
import json
rows=[]
for y in range(1900,2027):
    for m in range(1,13):
        d=datetime(y,m,15,12,tzinfo=ZoneInfo('Asia/Seoul'))
        rows.append({'year':y,'month':m,'day':15,'hour':12,'offsetMinutes':d.utcoffset().total_seconds()/60})
path=Path(__file__).resolve().parent/'fixtures/iana-seoul.json'
path.write_text(json.dumps({'source':'Python zoneinfo Asia/Seoul, host tzdata retrieved 2026-10-09; monthly noon samples, NOT transition proof','cases':rows},indent=2)+'\n')
