"""ADR-0012 §1: composing Publisher in examples/minimal-host takes at most 50 lines.

Counts every non-blank, non-comment line of the host's code, outside its own
content and data (content/), which are the host's declarations, not composition.
"""
from pathlib import Path
import sys

BUDGET = 50
host = Path(__file__).resolve().parents[1] / "examples" / "minimal-host"
counted = 0
for file in sorted(host.rglob("*")):
    parts = file.relative_to(host).parts
    if not file.is_file() or parts[0] in {"content", ".nuxt", ".output", "node_modules"} or file.suffix not in {".ts", ".js", ".mjs", ".vue"}:
        continue
    lines = [line.strip() for line in file.read_text(encoding="utf-8").splitlines()]
    counted += sum(1 for line in lines if line and not line.startswith(("//", "/*", "*")))
print(f"examples/minimal-host composes Publisher in {counted} lines (budget {BUDGET})")
if counted > BUDGET:
    sys.exit(1)
