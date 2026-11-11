#!/usr/bin/env python3
"""Swap two paths in one step, so that neither name is ever absent.

rename(2) cannot put a symbolic link where a directory is. renameat2(2) with
RENAME_EXCHANGE can, and only Linux has it.
"""

import ctypes
import os
import sys

AT_FDCWD = -100
RENAME_EXCHANGE = 2


def main(arguments):
    if len(arguments) != 2:
        print("Usage: exchange-paths.py PATH OTHER_PATH", file=sys.stderr)
        return 2
    path, other_path = arguments
    renameat2 = getattr(ctypes.CDLL(None, use_errno=True), "renameat2", None)
    if renameat2 is None:
        print(f"Error: cannot swap {path} and {other_path}: this system has no renameat2.", file=sys.stderr)
        return 1
    if renameat2(AT_FDCWD, os.fsencode(path), AT_FDCWD, os.fsencode(other_path), RENAME_EXCHANGE) != 0:
        print(f"Error: cannot swap {path} and {other_path}: {os.strerror(ctypes.get_errno())}.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
