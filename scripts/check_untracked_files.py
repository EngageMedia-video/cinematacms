import os
import subprocess
import sys
from pathlib import Path


def list_untracked_files(repository: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "-z"],
        cwd=repository,
        check=True,
        capture_output=True,
    )
    return [os.fsdecode(path) for path in result.stdout.split(b"\0") if path]


def main() -> int:
    files = list_untracked_files(Path.cwd())
    if not files:
        return 0

    print("Running pre-commit on untracked files:")
    for path in files:
        print(f"  {path}")

    result = subprocess.run(
        [sys.executable, "-m", "pre_commit", "run", "--files", *files],
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
