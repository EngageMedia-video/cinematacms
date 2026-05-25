from django.test import SimpleTestCase

from files.methods import _parse_encode_media_task_args


class EncodeMediaTaskArgsTests(SimpleTestCase):
    def test_parses_current_celery_list_args(self):
        self.assertEqual(
            _parse_encode_media_task_args(["TSdxEUg84", 19, 565, "http://localhost/encoding/565"]),
            ("TSdxEUg84", 19),
        )

    def test_parses_legacy_celery_string_args(self):
        self.assertEqual(
            _parse_encode_media_task_args("('TSdxEUg84', 19, 565, 'http://localhost/encoding/565')"),
            ("TSdxEUg84", 19),
        )

    def test_ignores_malformed_args(self):
        self.assertIsNone(_parse_encode_media_task_args(["TSdxEUg84"]))
