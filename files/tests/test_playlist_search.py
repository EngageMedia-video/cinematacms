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

    def test_blank_search_returns_all_playlists(self):
        response = self.client.get("/api/v1/playlists?search=")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 4)

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
