import unittest

from scripts.check_color_token_references import unknown_references

TOKENS_CSS = "body {\n\t--bg-surface: #fff;\n\t--text-muted: #333;\n}\n@theme inline {\n\t--color-border-hr: red;\n}\n"


def check(code, path="Page.jsx"):
    return unknown_references({"tailwind.css": TOKENS_CSS, path: code})


class CheckColorTokenReferencesTests(unittest.TestCase):
    def test_accepts_defined_tokens_in_utilities_and_var_references(self):
        code = (
            '<div className="bg-bg-surface hover:text-text-muted ring-offset-bg-surface '
            '[&::-webkit-scrollbar-thumb]:bg-text-muted/40 border-t-border-hr" '
            "style={{ color: 'var(--text-muted)', fill: 'var(--color-bg-surface)' }} />"
        )
        self.assertEqual(check(code), [])

    def test_reports_a_utility_whose_token_is_not_defined(self):
        self.assertEqual(
            check('<p className="m-0\n text-text-primary" />'),
            [("Page.jsx", 2, "text-primary")],
        )

    def test_reports_a_var_reference_whose_token_is_not_defined(self):
        self.assertEqual(
            check(".x { border-color: var(--border-divider); }", "x.scss"), [("x.scss", 1, "border-divider")]
        )

    def test_accepts_a_token_defined_next_to_the_code_that_uses_it(self):
        self.assertEqual(check(".btn { --bg-color: red; background: var(--bg-color); }", "btn.scss"), [])

    def test_ignores_utilities_that_are_not_color_tokens(self):
        self.assertEqual(check('<p className="text-sm border-b-2 ring-2 ring-offset-2 bg-transparent" />'), [])


if __name__ == "__main__":
    unittest.main()
