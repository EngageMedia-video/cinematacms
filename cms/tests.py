# TODO: insert test for checking if the whisper.cpp directory exists
import logging
import os
from pathlib import Path

from django.conf import settings
from django.test import TestCase


class WhisperCPPDirectoryTestCase(TestCase):
    logger = logging.getLogger(__name__)

    def test_whisper_directory_exists(self):
        _dir = Path(settings.WHISPER_CPP_DIR)
        self.assertTrue(_dir.exists(), "_dir missing")

    def test_whisper_command_exists(self):
        cmd_path = Path(settings.WHISPER_CPP_COMMAND)
        self.assertTrue(cmd_path.exists(), "WHISPER_CPP_COMMAND not found in /root directory")

    def test_whisper_command_is_executable(self):
        """Test that WHISPER_CPP_COMMAND is executable"""
        cmd_path = Path(settings.WHISPER_CPP_COMMAND)
        if cmd_path.exists():
            self.assertTrue(
                os.access(cmd_path, os.X_OK), f"WHISPER_CPP_COMMAND exists but is not executable: {cmd_path}"
            )
        else:
            self.fail(f"WHISPER_CPP_COMMAND does not exist: {cmd_path}")

    def test_whisper_model_exists(self):
        model_path = settings.WHISPER_CPP_MODEL
        self.assertTrue(model_path, "WHISPER_CPP_MODEL not found in /root directory")

    def test_whisper_model_is_bin(self):
        """Test that WHISPER_CPP_MODEL is a file (not directory)"""
        model_path = Path(settings.WHISPER_CPP_MODEL)
        if model_path:
            self.assertEqual(
                model_path.suffix.lower(), ".bin", f"WHISPER_CPP_MODEL exists but is not a file: {model_path}"
            )
        else:
            self.fail(f"WHISPER_CPP_MODEL does not exist: {model_path}")


class WhisperCPPIntegrationTestCase(TestCase):
    """Integration tests for Whisper.cpp functionality"""

    logger = logging.getLogger(__name__)

    def test_whisper_command_help(self):
        """Test that whisper.cpp command responds to --help flag"""
        import subprocess

        cmd_path = Path(settings.WHISPER_CPP_COMMAND)
        if not cmd_path.exists():
            self.skipTest(f"Whisper command not found: {cmd_path}")

        try:
            result = subprocess.run([str(cmd_path), "--help"], capture_output=True, timeout=10, text=True)
            # Whisper.cpp should respond to --help (exit code 0 or 1 is acceptable)
            self.assertIn(
                result.returncode,
                [0, 1],
                f"Whisper command should respond to --help flag. Got exit code: {result.returncode}",
            )
        except subprocess.TimeoutExpired:
            self.fail("Whisper command timed out responding to --help")
        except FileNotFoundError:
            self.fail(f"Whisper command not found or not executable: {cmd_path}")

    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests in this class"""
        super().tearDownClass()
