# ffmpeg only backend

import locale
import logging
import re
from subprocess import PIPE, Popen

logger = logging.getLogger(__name__)


class VideoEncodingError(Exception):
    def __init__(self, *args, **kwargs):
        self.message = args[0]
        super(VideoEncodingError, self).__init__(*args, **kwargs)


RE_TIMECODE = re.compile(r"time=(\d+:\d+:\d+.\d+)")
console_encoding = locale.getdefaultlocale()[1] or "UTF-8"


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
        buf = output = ""
        while True:
            out = self.process.stderr.read(10)

            if not out:
                break
            try:
                out = out.decode(console_encoding)
            except UnicodeDecodeError:
                out = ""
            output = output[-500:] + out
            buf = buf[-500:] + out
            try:
                line, buf = buf.split("\r", 1)
            except:
                continue

            progress = RE_TIMECODE.findall(line)
            if progress:
                progress = progress[0]
            yield progress

        process_check = self._check_returncode(self.process)
        if process_check["code"] != 0:
            raise VideoEncodingError(output[-1000:])  # output could be huge

        if not output:
            raise VideoEncodingError("No output from FFmpeg.")

        yield output[-1000:]  # output could be huge
