#!/usr/bin/env python3
"""Fail when frontend code uses a color token that no stylesheet defines.

A color utility such as `bg-bg-surface` or `ring-offset-bg-page`, or a
`var(--text-muted)` reference, names a `bg-*`, `text-*`, `border-*` or `ring-*`
custom property. Tailwind and the browser both ignore an undefined one, so a
removed or misspelled token silently renders no color. This check makes it fail.

Usage:
    uv run python scripts/check_color_token_references.py
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIRS = ("frontend/src", "templates")
SOURCE_SUFFIXES = {".js", ".jsx", ".ts", ".tsx", ".mdx", ".html", ".css", ".scss"}

TOKEN = r"(?:bg|text|border|ring)-[a-z0-9-]*[a-z0-9]"
COLOR_UTILITY = (
    r"(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|stroke|fill|divide"
    r"|decoration|accent|caret|placeholder|from|via|to|shadow)"
)
UTILITY_REFERENCE = re.compile(rf"(?<![\w-]){COLOR_UTILITY}-({TOKEN})(?![\w-])")
VAR_REFERENCE = re.compile(rf"var\(--(?:color-)?({TOKEN})\b")
DEFINITION = re.compile(rf"--(?:color-)?({TOKEN}):")


def defined_tokens(sources):
    return {name for text in sources.values() for name in DEFINITION.findall(text)}


def unknown_references(sources):
    """Return `(path, line, name)` for each color token reference with no definition."""
    defined = defined_tokens(sources)
    found = []
    for path, text in sources.items():
        for pattern in (UTILITY_REFERENCE, VAR_REFERENCE):
            for match in pattern.finditer(text):
                if match[1] not in defined:
                    found.append((path, text.count("\n", 0, match.start()) + 1, match[1]))
    return sorted(found)


def read_sources():
    listed = subprocess.run(
        ["git", "ls-files", "-z", *SOURCE_DIRS], cwd=ROOT, capture_output=True, check=True, text=True
    ).stdout.split("\0")
    paths = [path for path in listed if Path(path).suffix in SOURCE_SUFFIXES]
    return {path: (ROOT / path).read_text(encoding="utf-8") for path in paths if (ROOT / path).is_file()}


def main():
    unknown = unknown_references(read_sources())
    for path, line, name in unknown:
        print(f"{path}:{line}: no stylesheet defines the color token --{name}", file=sys.stderr)
    if unknown:
        print(
            "Use a semantic role from frontend/src/static/css/tokens.json, "
            "or define the custom property next to the code that uses it.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
