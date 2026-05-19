from django.test import Client, TestCase

from files.models import Playlist
from users.models import User


class PlaylistListSearchTests(TestCase):
    """Test ?search= filtering on the /api/v1/playlists endpoint."""

    def setUp(self):
        self.client = Client()
        self.author = User.objects.create_user(
            username="playlist_author",
            email="author@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="testpass123",
        )

        self.matching = Playlist.objects.create(
            title="My Favourite Films",
            user=self.author,
            friendly_token="pl000001",
        )
        self.matching_lower = Playlist.objects.create(
            title="favourite indie picks",
            user=self.author,
            friendly_token="pl000002",
        )
        self.non_matching = Playlist.objects.create(
            title="Cooking shows",
            user=self.author,
            friendly_token="pl000003",
        )
        self.other_authors_match = Playlist.objects.create(
            title="Favourite documentaries",
            user=self.other,
            friendly_token="pl000004",
        )

    def _titles(self, response):
        return sorted(item["title"] for item in response.json()["results"])

    def test_search_filters_by_title_icontains(self):
        response = self.client.get("/api/v1/playlists?search=favourite")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._titles(response),
            sorted(["My Favourite Films", "favourite indie picks", "Favourite documentaries"]),
        )

    def test_search_is_case_insensitive(self):
        response = self.client.get("/api/v1/playlists?search=FAVOURITE")
        self.assertEqual(response.status_code, 200)
        self.assertIn("My Favourite Films", self._titles(response))

    def test_blank_search_is_a_no_op(self):
        # MIRROR='default' means the test DB shares rows with the dev DB, so
        # the absolute count varies. Verify blank ?search= behaves identically
        # to no ?search= param (i.e. the filter is skipped, not applied with
        # an empty string).
        with_blank = self.client.get("/api/v1/playlists?search=").json()["count"]
        without = self.client.get("/api/v1/playlists").json()["count"]
        self.assertEqual(with_blank, without)

    def test_search_composes_with_author_filter(self):
        response = self.client.get("/api/v1/playlists?author=playlist_author&search=favourite")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._titles(response),
            sorted(["My Favourite Films", "favourite indie picks"]),
        )

    def test_search_no_match_returns_empty(self):
        response = self.client.get("/api/v1/playlists?search=nonexistentquery")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    def test_page_size_caps_result_rows_but_count_reflects_total(self):
        response = self.client.get("/api/v1/playlists?search=favourite&page_size=2")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        # Three playlists match 'favourite' in setUp; page_size=2 returns the
        # first two rows but count still reports the full match total so the
        # client can show a "Show more" affordance.
        self.assertEqual(len(body["results"]), 2)
        self.assertEqual(body["count"], 3)

    def test_page_size_above_cap_is_clamped(self):
        # SmallPreviewPagination.max_page_size is 10, so an oversized request
        # must not return more than the cap (no DoS via a 1000-row request).
        response = self.client.get("/api/v1/playlists?search=&page_size=999")
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(response.json()["results"]), 10)
