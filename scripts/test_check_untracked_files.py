import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.check_untracked_files import list_untracked_files


class ListUntrackedFilesTests(unittest.TestCase):
    def test_lists_untracked_files_without_ignored_or_staged_files(self):
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            subprocess.run(["git", "init", "--quiet"], cwd=repository, check=True)

            (repository / ".gitignore").write_text("ignored.md\n")
            (repository / "ignored.md").write_text("ignored\n")
            (repository / "staged.md").write_text("staged\n")
            (repository / "new file.md").write_text("untracked\n")
            subprocess.run(
                ["git", "add", ".gitignore", "staged.md"],
                cwd=repository,
                check=True,
            )

            self.assertEqual(list_untracked_files(repository), ["new file.md"])


if __name__ == "__main__":
    unittest.main()
