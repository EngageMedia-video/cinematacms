import io
import os
import tempfile

from django import forms
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image, UnidentifiedImageError


def _image_bytes(image_format):
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buffer, format=image_format)
    return buffer.getvalue()


class PillowDecoderAllowlistTests(SimpleTestCase):
    def test_accepted_formats_still_upload(self):
        for image_format, name in (("JPEG", "a.jpg"), ("PNG", "a.png"), ("WEBP", "a.webp")):
            with self.subTest(image_format=image_format):
                upload = SimpleUploadedFile(name, _image_bytes(image_format))
                cleaned = forms.ImageField().clean(upload)
                self.assertEqual(cleaned.image.format, image_format)

    def test_other_formats_are_rejected_as_invalid_images(self):
        for image_format, name in (("GIF", "a.gif"), ("BMP", "a.bmp"), ("TIFF", "a.tiff"), ("GIF", "disguised.jpg")):
            with self.subTest(image_format=image_format, name=name):
                upload = SimpleUploadedFile(name, _image_bytes(image_format))
                with self.assertRaises(forms.ValidationError):
                    forms.ImageField().clean(upload)

    def test_file_extension_cannot_reload_a_removed_decoder(self):
        with self.assertRaises(UnidentifiedImageError):
            Image.open(io.BytesIO(_image_bytes("TIFF")))
        with self.assertRaises(UnidentifiedImageError):
            Image.open(self._write_temp_file("a.tif", _image_bytes("TIFF")))

    def _write_temp_file(self, name, content):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = os.path.join(directory.name, name)
        with open(path, "wb") as file:
            file.write(content)
        return path
