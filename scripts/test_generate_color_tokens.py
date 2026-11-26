import json
import unittest

from scripts.generate_color_tokens import BEGIN, END, TokenError, build

PALETTE = "body {\n\t--cinemata-white: #fff;\n\t--cinemata-pacific-deep-900: #011c34;\n}\n"
CSS = f"/* before */\n{BEGIN}\nstale\n{END}\n/* after */\n"


def color(light, dark=None):
    token = {"$type": "color", "$value": light}
    if dark:
        token["$extensions"] = {"org.cinemata.modes": {"dark": dark}}
    return token


def generate(document):
    return build(json.dumps(document), PALETTE, CSS)


class GenerateColorTokensTests(unittest.TestCase):
    def test_writes_light_dark_and_theme_blocks_between_the_markers(self):
        css = generate(
            {
                "semantic": {
                    "bg": {"surface": {"default": color("{palette.white}", "{palette.pacific-deep-900}")}},
                    "ring": {"focus": color("{palette.pacific-deep-900}")},
                },
                "legacy": {"bg-panel": color("{semantic.bg.surface.default}")},
            }
        )

        self.assertTrue(css.startswith("/* before */\n"))
        self.assertTrue(css.endswith(f"{END}\n/* after */\n"))
        self.assertNotIn("stale", css)
        light, dark = css.split("body.dark_theme {")
        self.assertIn("--bg-surface: var(--cinemata-white);", light)
        self.assertIn("--bg-panel: var(--bg-surface);", light)
        self.assertIn("--bg-surface: var(--cinemata-pacific-deep-900);", dark)
        self.assertNotIn("--ring-focus", dark.split("@theme")[0])
        self.assertIn("--color-bg-panel: var(--bg-panel);", css)

    def test_output_is_stable_when_run_twice(self):
        document = {"semantic": {"text": {"default": color("{palette.white}")}}}
        once = generate(document)
        self.assertEqual(build(json.dumps(document), PALETTE, once), once)

    def test_rejects_a_palette_step_that_does_not_exist(self):
        with self.assertRaisesRegex(TokenError, "no --cinemata-red-500"):
            generate({"semantic": {"bg": {"danger": color("{palette.red-500}")}}})

    def test_rejects_a_reference_to_a_missing_token(self):
        with self.assertRaisesRegex(TokenError, "no such token"):
            generate({"legacy": {"bg-old": color("{semantic.bg.gone}")}})

    def test_rejects_two_tokens_with_one_css_name(self):
        with self.assertRaisesRegex(TokenError, "text-subtle"):
            generate(
                {
                    "semantic": {"text": {"subtle": color("{palette.white}")}},
                    "legacy": {"text-subtle": color("{semantic.text.subtle}")},
                }
            )

    def test_rejects_css_without_the_markers(self):
        with self.assertRaisesRegex(TokenError, "markers"):
            build(json.dumps({}), PALETTE, "body {}\n")


if __name__ == "__main__":
    unittest.main()
