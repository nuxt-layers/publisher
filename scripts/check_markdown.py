"""Validate Markdown headings, local links, and that external links appear only in RESOURCES.md, pinned (ADR-0010)."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

root = Path(__file__).resolve().parents[1]
# ADR-0010: external links appear only in RESOURCES.md, pinned to a tag or commit;
# CHANGELOG.md holds no links at all.
RESOURCES = "RESOURCES.md"
CHANGELOG = "CHANGELOG.md"
moving_ref = re.compile(
    r"^https?://github\.com/nuxt-layers/[^/]+/(?:blob|tree|raw)/(?:master|main|HEAD|develop)(?:/|$)",
    re.IGNORECASE,
)
errors = []
files = sorted(root.rglob("*.md"))
# .github holds templates whose body GitHub pastes into issues and pull requests.
for file in files:
    if any(part in {".git", ".github", "node_modules", ".nuxt"} for part in file.relative_to(root).parts):
        continue
    lines = file.read_text(encoding="utf-8").splitlines()
    if not any(re.match(r"^#\s+\S", line) for line in lines):
        errors.append(f"{file.relative_to(root)}: missing H1 heading")
    in_fence = False
    for number, line in enumerate(lines, 1):
        if re.match(r"^\s*(?:`{3,}|~{3,})", line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for match in re.finditer(r"!?\[[^\]]*\]\(([^\s)]+)\)", line):
            href = match.group(1).strip("<>")
            parsed = urlsplit(href)
            name = file.relative_to(root).as_posix()
            if name == CHANGELOG:
                errors.append(f"{name}:{number}: the changelog holds no links {href}")
                continue
            if (parsed.scheme in {"http", "https"} or parsed.netloc) and name != RESOURCES:
                errors.append(f"{name}:{number}: external link outside {RESOURCES} {href}")
                continue
            if moving_ref.match(href):
                errors.append(f"{file.relative_to(root)}:{number}: unpinned link to a moving branch {href}")
                continue
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            target = (file.parent / unquote(parsed.path)).resolve()
            if not target.is_relative_to(root) or not target.exists():
                errors.append(f"{file.relative_to(root)}:{number}: broken local link {href}")
if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print(f"Checked {len(files)} Markdown files for headings, local links and external links")
