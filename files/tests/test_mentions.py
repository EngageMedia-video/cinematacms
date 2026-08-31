"""Tests for @mention parsing and resolution in comment text."""

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from files.mentions import (
    MAX_MENTIONS_PER_COMMENT,
    extract_mention_handles,
    resolve_mentioned_users,
)

User = get_user_model()


class ExtractMentionHandlesTest(TestCase):
    def test_returns_empty_for_blank_text(self):
        self.assertEqual(extract_mention_handles(""), [])
        self.assertEqual(extract_mention_handles(None), [])

    def test_extracts_handle_at_start_and_after_whitespace(self):
        self.assertEqual(extract_mention_handles("@alice hello @bob"), ["alice", "bob"])

    def test_ignores_email_addresses(self):
        self.assertEqual(extract_mention_handles("write to alice@example.com"), [])

    def test_strips_trailing_punctuation(self):
        self.assertEqual(extract_mention_handles("thanks @alice."), ["alice"])

    def test_deduplicates_case_insensitively_keeping_first_spelling(self):
        self.assertEqual(extract_mention_handles("@Alice and @alice"), ["Alice"])

    def test_caps_the_number_of_handles(self):
        text = " ".join(f"@user{index}" for index in range(MAX_MENTIONS_PER_COMMENT + 5))
        self.assertEqual(len(extract_mention_handles(text)), MAX_MENTIONS_PER_COMMENT)


class ResolveMentionedUsersTest(TestCase):
    def _create_user(self, username, **kwargs):
        return User.objects.create_user(
            username=username,
            email=f"{uuid.uuid4().hex[:8]}@example.com",
            password="testpass1234567890",
            **kwargs,
        )

    def test_resolves_known_handles_and_drops_unknown_ones(self):
        alice = self._create_user("alice")
        self.assertEqual(
            resolve_mentioned_users("@alice and @nobody"),
            [alice],
        )

    def test_resolution_is_case_insensitive(self):
        alice = self._create_user("alice")
        self.assertEqual(resolve_mentioned_users("@ALICE"), [alice])

    def test_skips_inactive_users(self):
        self._create_user("ghost", is_active=False)
        self.assertEqual(resolve_mentioned_users("@ghost"), [])

    def test_excludes_the_given_user(self):
        author = self._create_user("author")
        bob = self._create_user("bob")
        self.assertEqual(resolve_mentioned_users("@author @bob", exclude=author), [bob])

    def test_preserves_mention_order(self):
        alice = self._create_user("alice")
        bob = self._create_user("bob")
        self.assertEqual(resolve_mentioned_users("@bob then @alice"), [bob, alice])
