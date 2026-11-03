"""Limit Pillow to the image formats Cinemata accepts from users.

TODO(pillow-13): temporary mitigation. Pillow 12.3.0 has advisories in decoders
this app never needs (TIFF, GIF, EPS, PDF, BMP, PPM, MSP, JPEG 2000, ...). The
fix is Pillow 13.0.0, which requires Python >= 3.11, and the app still runs
Python 3.10 (#1072). Remove this module and its call in FilesConfig.ready() once
the app runs on Python >= 3.11 with Pillow >= 13.
"""

from PIL import Image

ACCEPTED_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})


def restrict_pillow_decoders() -> None:
    # Image.open() imports plugins lazily and each import registers its decoder,
    # so load them all first; later imports are then cached and register nothing.
    Image.init()
    Image.ID[:] = [image_format for image_format in Image.ID if image_format in ACCEPTED_IMAGE_FORMATS]
    for image_format in list(Image.OPEN):
        if image_format not in ACCEPTED_IMAGE_FORMATS:
            del Image.OPEN[image_format]
