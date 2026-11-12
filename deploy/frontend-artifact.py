#!/usr/bin/env python3
"""Pack a Vite build into a deployable artifact, and unpack one after checking it."""

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

ARCHIVE_NAME = "frontend-build.tar.gz"
METADATA_NAME = "frontend-build.json"
MANIFEST_PATH = ".vite/manifest.json"
CHUNK_FIELDS_THAT_NAME_FILES = ("css", "assets")
CHUNK_FIELDS_THAT_NAME_CHUNKS = ("imports", "dynamicImports")
COMMIT_PATTERN = re.compile(r"[0-9a-f]{40}")
COPY_CHUNK_BYTES = 1024 * 1024


class ArtifactError(Exception):
    pass


def relative_parts(name):
    path = PurePosixPath(name)
    if not path.parts or path.is_absolute() or ".." in path.parts:
        raise ArtifactError(f"unsafe path: {name!r}")
    return path.parts


def chunk_names(key, chunk, field):
    names = chunk.get(field, [])
    if not isinstance(names, list) or not all(isinstance(name, str) for name in names):
        raise ArtifactError(f"{MANIFEST_PATH} chunk {key!r} has a {field} that is not a list of names")
    return names


def check_manifest_references(build_dir):
    try:
        manifest = json.loads((build_dir / MANIFEST_PATH).read_text())
    except FileNotFoundError:
        raise ArtifactError(f"the build has no {MANIFEST_PATH}") from None
    except ValueError as error:
        raise ArtifactError(f"{MANIFEST_PATH} is not valid JSON: {error}") from None
    if not isinstance(manifest, dict) or not manifest:
        raise ArtifactError(f"{MANIFEST_PATH} lists no chunks")

    files = set()
    imported_chunks = set()
    for key, chunk in manifest.items():
        if not isinstance(chunk, dict) or not isinstance(chunk.get("file"), str):
            raise ArtifactError(f"{MANIFEST_PATH} chunk {key!r} names no file")
        files.add(chunk["file"])
        for field in CHUNK_FIELDS_THAT_NAME_FILES:
            files.update(chunk_names(key, chunk, field))
        for field in CHUNK_FIELDS_THAT_NAME_CHUNKS:
            imported_chunks.update(chunk_names(key, chunk, field))

    # Every chunk is checked above, so a chunk that only another chunk imports is covered too.
    unlisted = sorted(imported_chunks - manifest.keys())
    if unlisted:
        raise ArtifactError("the manifest imports chunks it does not list: " + ", ".join(unlisted))
    missing = sorted(name for name in files if not build_dir.joinpath(*relative_parts(name)).is_file())
    if missing:
        raise ArtifactError("the manifest references files the build does not contain: " + ", ".join(missing))


def open_regular_file(path):
    """Open a file another account may own, refusing a symlink or a device."""
    try:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except OSError as error:
        raise ArtifactError(f"cannot open {path.name}: {error.strerror}") from None
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        os.close(descriptor)
        raise ArtifactError(f"{path.name} is not a regular file")
    return os.fdopen(descriptor, "rb")


def copy_with_sha256(source, destination):
    digest = hashlib.sha256()
    with open(destination, "wb") as sink:
        while chunk := source.read(COPY_CHUNK_BYTES):
            digest.update(chunk)
            sink.write(chunk)
    return digest.hexdigest()


def pack(build_dir, commit, output_dir):
    check_manifest_references(build_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / ARCHIVE_NAME
    with tarfile.open(archive, "w:gz", dereference=True) as tar:
        for path in sorted(build_dir.rglob("*")):
            if path.is_file():
                tar.add(path, arcname=path.relative_to(build_dir).as_posix())
    sha256 = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output_dir / METADATA_NAME).write_text(json.dumps({"commit": commit, "sha256": sha256}) + "\n")


def read_metadata(artifact_dir):
    with open_regular_file(artifact_dir / METADATA_NAME) as source:
        try:
            metadata = json.load(source)
        except ValueError as error:
            raise ArtifactError(f"{METADATA_NAME} is not valid JSON: {error}") from None
    if not isinstance(metadata, dict):
        raise ArtifactError(f"{METADATA_NAME} is not a JSON object")
    return metadata.get("commit"), metadata.get("sha256")


def extract(archive, destination):
    with tarfile.open(archive, "r:gz") as tar:
        for member in tar:
            if not member.isfile():
                raise ArtifactError(f"the archive holds a member that is not a regular file: {member.name!r}")
            output = destination.joinpath(*relative_parts(member.name))
            output.parent.mkdir(parents=True, exist_ok=True)
            # Written fresh instead of restoring the archived mtime: collectstatic
            # skips a source file that is older than the copy it already collected.
            with tar.extractfile(member) as source, open(output, "wb") as sink:
                shutil.copyfileobj(source, sink)


def unpack(artifact_dir, commit, target):
    built_from, expected_sha256 = read_metadata(artifact_dir)
    if built_from != commit:
        raise ArtifactError(f"the artifact was built from {built_from!r}, not from {commit}")

    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent, prefix=".frontend-artifact.") as scratch:
        # Everything after this copy reads the private copy, so the account that
        # delivered the artifact cannot change it between the check and the extraction.
        archive = Path(scratch) / ARCHIVE_NAME
        with open_regular_file(artifact_dir / ARCHIVE_NAME) as source:
            actual_sha256 = copy_with_sha256(source, archive)
        if actual_sha256 != expected_sha256:
            raise ArtifactError(f"{ARCHIVE_NAME} has SHA-256 {actual_sha256}, but {METADATA_NAME} records another")

        staged = Path(scratch) / "build"
        staged.mkdir()
        extract(archive, staged)
        check_manifest_references(staged)
        if target.exists():
            shutil.rmtree(target)
        staged.rename(target)


def commit_sha(value):
    if not COMMIT_PATTERN.fullmatch(value):
        raise argparse.ArgumentTypeError("expected a full 40-character lowercase commit SHA")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    pack_parser = commands.add_parser("pack", help="check a build and write the artifact files")
    pack_parser.add_argument("--build-dir", type=Path, required=True)
    pack_parser.add_argument("--commit", type=commit_sha, required=True)
    pack_parser.add_argument("--output-dir", type=Path, required=True)
    unpack_parser = commands.add_parser("unpack", help="check an artifact and extract it to a new directory")
    unpack_parser.add_argument("--artifact-dir", type=Path, required=True)
    unpack_parser.add_argument("--commit", type=commit_sha, required=True)
    unpack_parser.add_argument("--target", type=Path, required=True)
    args = parser.parse_args()

    try:
        if args.command == "pack":
            pack(args.build_dir, args.commit, args.output_dir)
        else:
            unpack(args.artifact_dir, args.commit, args.target)
    except ArtifactError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
