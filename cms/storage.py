"""
Custom static files storage for CinemataCMS.

Since Webpack handles content hashing with [contenthash], we don't need Django
to post-process and re-hash the files. This storage simply collects files
without any post-processing.
"""
from django.contrib.staticfiles.storage import StaticFilesStorage


class WebpackHashedFilesStorage(StaticFilesStorage):
    """
    A static files storage that doesn't post-process files.

    Since Webpack already adds content hashes to filenames (e.g., app-a1b2c3d4.js),
    we don't need Django to reprocess them. This storage simply collects files
    as-is without any URL rewriting or hashing.

    This avoids issues with:
    - Missing font files referenced in CSS
    - Absolute paths in CSS
    - Complex CSS URL rewriting

    The trade-off is that template files need to reference the exact webpack-
    generated filenames, but this is typically handled by the build system
    generating HTML with correct paths.
    """

    def post_process(self, *args, **kwargs):
        """
        Skip post-processing entirely since Webpack handles hashing.

        Yields each file as-is without any processing.
        """
        # Simply yield all files without processing
        for name in args[0].keys():
            yield name, name, False
