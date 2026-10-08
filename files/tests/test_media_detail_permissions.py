from django.test import TestCase

from files.tests.helpers import create_test_media, create_test_user


class MediaDetailManagePermissionTests(TestCase):
    """The detail API reports the media page's edit/delete permission.

    Playlist playback that stays in fullscreen loads the next item from this
    API instead of the media page, so the page controls need the same answer
    that ``view_media`` renders.
    """

    def test_only_owner_editor_and_manager_can_manage_media(self):
        owner = create_test_user()
        media = create_test_media(owner)
        url = f"/api/v1/media/{media.friendly_token}"
        cases = [
            ("anonymous", None, False),
            ("other user", create_test_user(), False),
            ("owner", owner, True),
            ("editor", create_test_user(is_editor=True), True),
            ("manager", create_test_user(is_manager=True), True),
        ]

        for label, user, expected in cases:
            with self.subTest(label):
                self.client.logout()
                if user:
                    self.client.force_login(user)
                self.assertIs(self.client.get(url).data["user_can_manage_media"], expected)

    def test_media_page_controls_follow_the_same_rule(self):
        owner = create_test_user()
        media = create_test_media(owner)

        self.client.force_login(create_test_user(is_editor=True))
        page = self.client.get(f"/view?m={media.friendly_token}")

        self.assertTrue(page.context["CAN_EDIT_MEDIA"])
        self.assertTrue(page.context["CAN_DELETE_MEDIA"])
        self.assertTrue(page.context["CAN_DELETE_COMMENTS"])
