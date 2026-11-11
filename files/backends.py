# ffmpeg only backend

import codecs
import locale
import logging
import re
from collections import deque
from subprocess import PIPE, Popen

logger = logging.getLogger(__name__)


class VideoEncodingError(Exception):
    def __init__(self, *args, **kwargs):
        self.message = args[0]
        super(VideoEncodingError, self).__init__(*args, **kwargs)


RE_STDERR_SEGMENT = re.compile(r"([^\r\n]*)([\r\n])")
# Needs the "-loglevel level+..." flag, which tags each line after its "[context @ 0x...]" prefix.
RE_ERROR_LINE = re.compile(r"^(?:\[[^\]]+\] )?\[(?:error|fatal|panic)\] ")
RE_LOG_CONTEXT_ADDRESS = re.compile(r" @ 0x[0-9a-fA-F]+")
console_encoding = locale.getdefaultlocale()[1] or "UTF-8"


class FFmpegLogExcerpt:
    """The first error lines and the last lines of FFmpeg's log, kept in log order."""

    FIRST_ERROR_LINES = 10
    TAIL_LINES = 20
    MAX_LINE_CHARS = 500

    def __init__(self):
        self.first_errors = []
        self.tail = deque(maxlen=self.TAIL_LINES)
        self.line_count = 0

    def add(self, line):
        entry = (self.line_count, line[: self.MAX_LINE_CHARS])
        self.line_count += 1
        if len(self.first_errors) < self.FIRST_ERROR_LINES and RE_ERROR_LINE.match(line):
            self.first_errors.append(entry)
        self.tail.append(entry)

    def lines(self):
        kept = dict(self.first_errors)
        kept.update(self.tail)
        return [kept[position] for position in sorted(kept)]

    def failure_message(self, returncode):
        """Open with the first error, minus run-specific addresses, so one cause groups as one error."""
        if self.first_errors:
            header = RE_LOG_CONTEXT_ADDRESS.sub("", self.first_errors[0][1])
        else:
            header = f"FFmpeg exited with status {returncode}"
        return "\n".join([header, *self.lines()])


class FFmpegBackend:
    name = "FFmpeg"

    def __init__(self):
        self.process = None

    def _spawn(self, cmd):
        try:
            return Popen(
                cmd,
                shell=False,
                stdin=PIPE,
                stdout=PIPE,
                stderr=PIPE,
                close_fds=True,
            )
        except OSError as e:
            raise VideoEncodingError("Error while running ffmpeg", e)

    def _check_returncode(self, process):
        ret = {}
        stdout, stderr = process.communicate()
        ret["code"] = process.returncode
        return ret

    def terminate_process(self):
        """Gracefully terminate the FFmpeg subprocess."""
        if self.process is None:
            return

        try:
            # First try graceful termination
            if self.process.poll() is None:  # Check if still running
                logger.info("Terminating FFmpeg process gracefully")
                self.process.terminate()

                # Wait up to 5 seconds for graceful shutdown
                try:
                    self.process.wait(timeout=5)
                    logger.info("FFmpeg process terminated gracefully")
                except:
                    # Force kill if still alive
                    logger.warning("FFmpeg process did not terminate gracefully, force killing")
                    self.process.kill()
                    self.process.wait(timeout=2)

                # Close file descriptors
                if self.process.stdin:
                    self.process.stdin.close()
                if self.process.stdout:
                    self.process.stdout.close()
                if self.process.stderr:
                    self.process.stderr.close()
        except Exception as e:
            logger.error(f"Error terminating FFmpeg process: {e}")
        finally:
            self.process = None

    def encode(self, cmd):
        self.process = self._spawn(cmd)
        decoder = codecs.getincrementaldecoder(console_encoding)(errors="replace")
        excerpt = FFmpegLogExcerpt()
        pending = ""
        while True:
            chunk = self.process.stderr.read(10)
            pending += decoder.decode(chunk, final=not chunk)
            consumed = 0
            for segment in RE_STDERR_SEGMENT.finditer(pending):
                text, terminator = segment.groups()
                consumed = segment.end()
                if terminator == "\r":
                    yield text
                elif text:
                    excerpt.add(text)
            pending = pending[consumed:]
            if not chunk:
                break
        if pending:
            excerpt.add(pending)

        returncode = self._check_returncode(self.process)["code"]
        if returncode != 0:
            raise VideoEncodingError(excerpt.failure_message(returncode))

        output = "\n".join(excerpt.lines())
        if not output:
            raise VideoEncodingError("No output from FFmpeg.")

        yield output
