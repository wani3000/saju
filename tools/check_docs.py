"""Check planning files and relative links. Does not test an app or database."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
required = [root / name for name in ("README.md", "AGENTS.md", "TASKS.md")]
required += [root / "docs" / name for name in (
    "01-product.md", "02-ux.md", "03-architecture.md", "04-engine.md",
    "05-database.md", "06-api.md", "07-payments.md", "08-map-sharing.md",
    "09-quality-operations.md", "10-roadmap.md", "11-decisions.md", "12-references.md",
)]
errors = []
for path in required:
    if not path.is_file() or not path.read_text(encoding="utf-8").strip():
        errors.append(f"Missing or empty: {path.relative_to(root)}")
owned_docs = list(root.glob("*.md")) + list((root / "docs").glob("*.md")) + list((root / "design").rglob("*.md")) + [root / "research/validation/README.md"]
owned_docs += list((root / "prototype").glob("*.md")) + list((root / "prototype/licenses").glob("*.md"))
for path in (p for p in owned_docs if p.exists()):
    content = path.read_text(encoding="utf-8")
    if content.count("```") % 2:
        errors.append(f"Unclosed code fence: {path.relative_to(root)}")
    for target in re.findall(r"\]\(([^)]+)\)", content):
        if target.startswith(("https://", "http://", "mailto:", "#")):
            continue
        target = target.split("#", 1)[0]
        if not (path.parent / target).exists():
            errors.append(f"Broken link: {path.relative_to(root)} -> {target}")
report = root / "reference" / "site-audit" / "report.html"
if report.exists():
    for target in re.findall(r'<img\s+src="([^"]+)"', report.read_text(encoding="utf-8")):
        if not (report.parent / target).is_file():
            errors.append(f"Missing screenshot: {target}")
else:
    errors.append("Missing reference/site-audit/report.html")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"PASS: {len(required)} required planning documents; relative links, fences and screenshot references checked.")
print("Application, database migrations, calculation accuracy and payment behavior are NOT tested.")
