"""Playlist covers and counts follow the media each viewer can see (#876)."""

from unittest.mock import patch

from django.test import TestCase

from files.models import Media, Playlist, PlaylistMedia
from files.tests.helpers import create_test_media, create_test_user, make_vite_loader_mock


class PlaylistViewerVisibilityTests(TestCase):
    def setUp(self):
        self.owner = create_test_user(username="pl_vis_owner")
        self.viewer = create_test_user(username="pl_vis_viewer")
        self.playlist = Playlist.objects.create(title="Visibility", user=self.owner)

    def _media(self, name, state):
        return create_test_media(
            self.owner,
            state=state,
            thumbnail=f"original/thumbnails/user/{self.owner.username}/{name}.jpg",
        )

    def _add(self, *media):
        for ordering, item in enumerate(media, start=1):
            PlaylistMedia.objects.create(playlist=self.playlist, media=item, ordering=ordering)

    def _set_state(self, media, state):
        fresh = Media.objects.get(pk=media.pk)
        fresh.state = state
        fresh.save(update_fields=["state"])
        return fresh

    def _detail(self):
        response = self.client.get(f"/api/v1/playlists/{self.playlist.friendly_token}")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def _listing(self):
        response = self.client.get(f"/api/v1/playlists?author={self.owner.username}")
        self.assertEqual(response.status_code, 200)
        [row] = response.json()["results"]
        return row

    def _assert_cover(self, payload, media):
        if media is None:
            self.assertIsNone(payload["thumbnail_url"])
        else:
            self.assertTrue(payload["thumbnail_url"].endswith(media.thumbnail_url), payload["thumbnail_url"])

    def _assert_viewer_sees(self, viewer, cover, tokens):
        if viewer is None:
            self.client.logout()
        else:
            self.client.force_login(viewer)

        detail = self._detail()
        self.assertEqual([m["friendly_token"] for m in detail["playlist_media"]], tokens)
        self.assertEqual(detail["media_count"], len(tokens))
        self._assert_cover(detail, cover)

        row = self._listing()
        self.assertEqual(row["media_count"], len(tokens))
        self._assert_cover(row, cover)

    def test_cover_and_count_use_only_media_the_viewer_can_see(self):
        unlisted = self._media("unlisted", "unlisted")
        restricted = self._media("restricted", "restricted")
        private = self._media("private", "private")
        public = self._media("public", "public")
        self._add(restricted, unlisted, private, public)

        # Restricted thumbnails need a per-media token, so they never supply
        # a cover even though signed-in viewers see the item in the list.
        cases = [
            ("anonymous", None, public, [public.friendly_token]),
            (
                "signed in",
                self.viewer,
                unlisted,
                [restricted.friendly_token, unlisted.friendly_token, public.friendly_token],
            ),
        ]
        for label, viewer, cover, tokens in cases:
            with self.subTest(viewer=label):
                self._assert_viewer_sees(viewer, cover, tokens)

    def test_restricted_only_playlist_has_no_cover_for_signed_in_viewers(self):
        restricted = self._media("only-restricted", "restricted")
        self._add(restricted)

        self._assert_viewer_sees(self.viewer, None, [restricted.friendly_token])

    def test_cover_and_count_follow_visibility_changes(self):
        cases = [
            ("only video turns private", False),
            ("another public video remains", True),
        ]
        for label, has_other in cases:
            with self.subTest(case=label):
                PlaylistMedia.objects.filter(playlist=self.playlist).delete()
                first = self._media(f"first-{has_other}", "public")
                other = self._media(f"other-{has_other}", "public")
                self._add(*([first, other] if has_other else [first]))
                remaining = [other.friendly_token] if has_other else []

                for viewer in (None, self.viewer):
                    self._assert_viewer_sees(viewer, first, [first.friendly_token, *remaining])

                first = self._set_state(first, "private")
                for viewer in (None, self.viewer):
                    self._assert_viewer_sees(viewer, other if has_other else None, remaining)

                # Membership and ordering survive, so publishing again restores the cover.
                first = self._set_state(first, "public")
                for viewer in (None, self.viewer):
                    self._assert_viewer_sees(viewer, first, [first.friendly_token, *remaining])

    def test_model_defaults_are_safe_for_anonymous_viewers(self):
        unlisted = self._media("m-unlisted", "unlisted")
        public = self._media("m-public", "public")
        self._add(unlisted, public)

        self.assertEqual(self.playlist.thumbnail_url, public.thumbnail_url)
        self.assertEqual(self.playlist.media_count, 1)
        self.assertEqual(self.playlist.composite_thumbnail_url, public.thumbnail_url)

    @patch(
        "django_vite.core.asset_loader.DjangoViteAssetLoader.instance",
        return_value=make_vite_loader_mock(),
    )
    def test_share_image_skips_non_public_media(self, _mock_vite):
        unlisted = self._media("og-unlisted", "unlisted")
        public = self._media("og-public", "public")
        self._add(unlisted, public)

        response = self.client.get(self.playlist.get_absolute_url())

        content = response.content.decode()
        self.assertIn(public.thumbnail_url, content)
        self.assertNotIn(unlisted.thumbnail_url, content)

    def test_any_state_change_invalidates_cached_playlists(self):
        cases = [
            ("unlisted", "private", False),
            ("restricted", "unlisted", False),
            ("public", "private", True),
            ("private", "public", True),
        ]
        for before, after, composite_changes in cases:
            with self.subTest(transition=f"{before} -> {after}"):
                media = self._media(f"sig-{before}-{after}", before)
                self._add(media)
                media = Media.objects.get(pk=media.pk)
                media.state = after

                with (
                    patch("files.models.delete_composite_thumbnail") as delete_composite,
                    patch("files.models.invalidate_playlist_cache") as invalidate_playlist,
                ):
                    media.save(update_fields=["state"])

                invalidate_playlist.assert_called_with(self.playlist.friendly_token)
                self.assertEqual(delete_composite.called, composite_changes)
