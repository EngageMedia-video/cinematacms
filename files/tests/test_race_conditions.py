"""
Tests for video view count accuracy fixes.

Tests cover:
1. Race conditions in concurrent counter increments
2. Anonymous user tracking behind NAT/proxies with rate limiting
3. Timezone-aware datetime comparisons

No manual video upload needed - test media is created programmatically.
"""

import threading
import time
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from actions.models import MediaAction
from files.methods import pre_save_action
from files.models import Media
from files.tasks import save_user_action

User = get_user_model()


def create_test_media(user, title="Test Video", **kwargs):
    """
    Helper to create test media without triggering file processing.
    Patches media_init to prevent file access errors during test media creation.
    """
    defaults = {
        "state": "public",
        "media_type": "video",
        "duration": 120,  # 2 minutes
        "views": 0,
        "likes": 0,
        "dislikes": 0,
        "reported_times": 0,
        "encoding_status": "success",
        "is_reviewed": True,
    }
    defaults.update(kwargs)

    # Thread-safe: patch media_init to prevent file processing errors
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title=title, user=user, **defaults)

    return media


class RaceConditionTest(TransactionTestCase):
    """Test that concurrent view increments don't lose counts."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Create or get a media owner
        cls.media_owner, created = User.objects.get_or_create(
            username="media_owner_race", defaults={"email": "owner_race@example.com", "password": "testpass123"}
        )
        # Create test media
        cls.test_media = create_test_media(user=cls.media_owner, title="Race Condition Test Video")

    def test_concurrent_views_no_lost_counts(self):
        """
        Test: 10 concurrent threads incrementing view count.
        Expected: All 10 views are recorded (no race condition).
        """
        media = self.test_media

        # Record initial view count
        initial_views = media.views

        # Create multiple test users (one for each thread to avoid cooldown blocking)
        num_threads = 10
        test_users = []

        for i in range(num_threads):
            username = f"testuser_race_{i}"
            user = User.objects.filter(username=username).first()
            if not user:
                user = User.objects.create_user(
                    username=username, email=f"testrace{i}@example.com", password="testpass123"
                )
            test_users.append(user)

        threads = []
        errors = []

        def increment_view(user):
            try:
                save_user_action(
                    friendly_token=media.friendly_token,
                    action="watch",
                    user_or_session={"user_id": user.id, "remote_ip_addr": f"192.168.1.{user.id % 255}"},
                )
            except Exception as e:
                errors.append(str(e))
            finally:
                from django.db import connection as thread_conn

                thread_conn.close()

        # Launch concurrent threads (each with different user)
        print(f"\n🚀 Launching {num_threads} concurrent view increments from {num_threads} different users...")
        start_time = time.time()

        for i in range(num_threads):
            thread = threading.Thread(target=increment_view, args=(test_users[i],))
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        elapsed_time = time.time() - start_time

        # Check results
        media.refresh_from_db()
        final_views = media.views
        views_added = final_views - initial_views

        print(f"⏱️  Completed in {elapsed_time:.2f} seconds")
        print(f"📊 Initial views: {initial_views}")
        print(f"📊 Final views: {final_views}")
        print(f"📊 Views added: {views_added}")
        print(f"❌ Errors: {len(errors)}")

        if errors:
            print(f"⚠️  Errors encountered: {errors[:3]}")  # Show first 3 errors

        # Verify no counts were lost
        self.assertEqual(len(errors), 0, f"Expected no errors, but got {len(errors)}: {errors[:3]}")
        self.assertEqual(
            views_added,
            num_threads,
            f"❌ RACE CONDITION DETECTED: Expected {num_threads} views, but only {views_added} were recorded. Lost {num_threads - views_added} views!",
        )

        print(f"✅ SUCCESS: All {num_threads} concurrent views were recorded correctly!")


class AnonymousNATTest(TestCase):
    """Test anonymous users behind NAT/proxy can view content."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Create or get a media owner
        cls.media_owner, created = User.objects.get_or_create(
            username="media_owner_anon", defaults={"email": "owner_anon@example.com", "password": "testpass123"}
        )
        # Create test media
        cls.test_media = create_test_media(user=cls.media_owner, title="Anonymous NAT Test Video")

    def test_multiple_anonymous_users_same_ip(self):
        """
        Test: 3 anonymous users behind same NAT IP try to view.
        Expected: All 3 can view (session-based tracking, not IP-based).
        """
        media = self.test_media

        shared_ip = "203.0.113.50"  # Simulated NAT gateway

        print(f"\n🏢 Simulating 3 users behind same NAT IP: {shared_ip}")

        # Create 3 different sessions (3 different anonymous users)
        sessions = []
        for i in range(3):
            session = SessionStore()
            session.create()
            sessions.append(session.session_key)
            print(f"👤 User {i + 1} session: {session.session_key[:16]}...")

        # Each user should be allowed to view
        results = []
        for i, session_key in enumerate(sessions):
            allowed = pre_save_action(
                media=media, user=None, session_key=session_key, action="watch", remote_ip=shared_ip
            )
            results.append(allowed)

            if allowed:
                # Record the view
                MediaAction.objects.create(
                    media=media,
                    user=None,
                    session_key=session_key,
                    action="watch",
                    action_date=timezone.now(),
                    remote_ip=shared_ip,
                )
                print(f"✅ User {i + 1}: Allowed to view")
            else:
                print(f"❌ User {i + 1}: Blocked")

        # Verify all were allowed
        self.assertTrue(all(results), f"❌ FAILED: Not all users behind NAT could view. Results: {results}")

        # Verify all 3 actions were recorded
        action_count = MediaAction.objects.filter(
            media=media, action="watch", remote_ip=shared_ip, session_key__in=sessions
        ).count()

        self.assertEqual(action_count, 3, f"❌ FAILED: Expected 3 recorded views, got {action_count}")

        print("✅ SUCCESS: All 3 anonymous users behind same NAT could view!")
        print(f"📊 Total views recorded from IP {shared_ip}: {action_count}")

    def test_rate_limiting_blocks_spam(self):
        """
        Test: Rate limiting blocks spam after 30 rapid views within 5 seconds.
        Expected: First 30 views allowed, 31st blocked and NOT recorded.
        """
        media = self.test_media
        spam_ip = "203.0.113.99"
        max_views = getattr(settings, "MAX_ANONYMOUS_VIEWS_PER_5SEC", 30)

        print(f"\n🚫 Testing rate limiting: {max_views} views/5sec from IP {spam_ip}")
        print("   (Allows classrooms of 30+ students while blocking spam)")

        # Record initial counts
        initial_action_count = MediaAction.objects.filter(media=media, remote_ip=spam_ip).count()

        # Create max_views sessions and record views within 5 seconds
        sessions_created = []
        for i in range(max_views):
            session = SessionStore()
            session.create()
            sessions_created.append(session.session_key)

            # Verify this view is allowed by rate limiter
            allowed = pre_save_action(
                media=media, user=None, session_key=session.session_key, action="watch", remote_ip=spam_ip
            )
            self.assertTrue(allowed, f"❌ View {i + 1}/{max_views} should be allowed but was blocked!")

            MediaAction.objects.create(
                media=media,
                user=None,
                session_key=session.session_key,
                action="watch",
                action_date=timezone.now() - timedelta(seconds=3),  # 3 seconds ago
                remote_ip=spam_ip,
            )
            print(f"✅ View {i + 1}/{max_views}: Allowed and recorded")

        # Try one more view (should be blocked by pre_save_action)
        # NOTE: User 31 can still WATCH the video, but their view won't be COUNTED
        blocked_session = SessionStore()
        blocked_session.create()

        allowed = pre_save_action(
            media=media, user=None, session_key=blocked_session.session_key, action="watch", remote_ip=spam_ip
        )

        if allowed:
            print(f"❌ View {max_views + 1}: Allowed (SHOULD HAVE BEEN BLOCKED)")
        else:
            print(f"🚫 View {max_views + 1}: Blocked by rate limiter (view not counted)")
            print("   ℹ️  Note: User can still watch the video, just not counted in stats")

        self.assertFalse(
            allowed, f"❌ FAILED: Rate limiting not working. View {max_views + 1} should have been blocked!"
        )

        # Verify the 31st view was NOT recorded in database
        # (simulate what save_user_action would do if allowed=False)
        if not allowed:
            # Don't save the action (this is what save_user_action does)
            pass

        final_action_count = MediaAction.objects.filter(media=media, remote_ip=spam_ip).count()

        # Verify exactly max_views actions were recorded (31st not saved)
        expected_count = initial_action_count + max_views
        self.assertEqual(
            final_action_count,
            expected_count,
            f"❌ FAILED: Expected {expected_count} actions, but found {final_action_count}",
        )

        # Verify the blocked session was NOT saved
        blocked_action = MediaAction.objects.filter(media=media, session_key=blocked_session.session_key).exists()

        self.assertFalse(blocked_action, "❌ FAILED: Blocked view (31st) should NOT be saved in database!")

        print("✅ SUCCESS: Rate limiting is working correctly!")
        print(f"   ✓ Allows classrooms ({max_views} views/5sec)")
        print(f"   ✓ Blocks rapid spam (>{max_views} views/5sec)")
        print("   ✓ Blocked view NOT saved in database")
        print(f"   📊 Total actions from IP: {final_action_count} (expected: {expected_count})")


class TimezoneTest(TestCase):
    """Test timezone-aware datetime comparisons work correctly."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Create or get a media owner
        cls.media_owner, created = User.objects.get_or_create(
            username="media_owner_tz", defaults={"email": "owner_tz@example.com", "password": "testpass123"}
        )
        # Create test media
        cls.test_media = create_test_media(user=cls.media_owner, title="Timezone Test Video")

    def test_timezone_aware_comparison_no_error(self):
        """
        Test: Timezone-aware datetime comparison doesn't raise TypeError.
        Expected: No TypeError when comparing dates.
        """
        media = self.test_media

        # Create a test user
        test_user = User.objects.filter(username="testuser_tz").first()
        if not test_user:
            test_user = User.objects.create_user(
                username="testuser_tz", email="testtz@example.com", password="testpass123"
            )

        print("\n🕐 Testing timezone-aware datetime comparison...")

        # Create an action with timezone-aware datetime
        action = MediaAction.objects.create(
            media=media,
            user=test_user,
            action="watch",
            action_date=timezone.now() - timedelta(seconds=30),
            remote_ip="192.168.1.200",
        )

        print(f"📅 Action date: {action.action_date}")
        print(f"📅 Is timezone aware: {action.action_date.tzinfo is not None}")

        # This should NOT raise TypeError
        try:
            result = pre_save_action(
                media=media, user=test_user, session_key=None, action="watch", remote_ip="192.168.1.200"
            )
            print("✅ No TypeError raised")
            print(f"📊 pre_save_action result: {result}")
            self.assertIsNotNone(result)
        except TypeError as e:
            print(f"❌ TypeError raised: {e}")
            self.fail(f"❌ FAILED: Timezone comparison raised TypeError: {e}")

        print("✅ SUCCESS: Timezone-aware datetime comparison works correctly!")


class PreSaveActionVariableShadowingTest(TestCase):
    """
    Regression test for variable shadowing bug in pre_save_action.

    The `query` variable was reassigned from a QuerySet to a MediaAction instance
    via `query.first()`, causing AttributeError when `query.exists()` was called
    later for anonymous users.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.media_owner, _ = User.objects.get_or_create(
            username="media_owner_shadow", defaults={"email": "owner_shadow@example.com", "password": "testpass123"}
        )
        cls.test_media = create_test_media(user=cls.media_owner, title="Variable Shadowing Test Video")

    def test_anonymous_user_with_existing_watch_no_attribute_error(self):
        """
        Regression: anonymous user who already watched should not raise
        AttributeError on query.exists() due to variable shadowing.
        """
        media = self.test_media
        session = SessionStore()
        session.create()
        session_key = session.session_key
        ip = "10.0.0.1"

        # Record an initial watch action for this anonymous user
        MediaAction.objects.create(
            media=media, user=None, session_key=session_key, action="watch", action_date=timezone.now(), remote_ip=ip
        )

        # This should NOT raise AttributeError
        # Before the fix, `query` was reassigned to a MediaAction instance,
        # and then `query.exists()` was called on it.
        try:
            result = pre_save_action(media=media, user=None, session_key=session_key, action="watch", remote_ip=ip)
            self.assertIsNotNone(result)
        except AttributeError as e:
            self.fail(f"AttributeError raised due to variable shadowing bug: {e}")

    def test_logged_in_user_with_existing_action_no_attribute_error(self):
        """
        Ensure logged-in users with existing actions also don't hit the bug.
        """
        media = self.test_media
        user, _ = User.objects.get_or_create(
            username="testuser_shadow", defaults={"email": "shadow@example.com", "password": "testpass123"}
        )

        # Record an initial like action
        MediaAction.objects.create(
            media=media, user=user, action="like", action_date=timezone.now(), remote_ip="10.0.0.2"
        )

        # Should return False (already liked) without any error
        result = pre_save_action(media=media, user=user, session_key=None, action="like", remote_ip="10.0.0.2")
        self.assertFalse(result)

    def test_anonymous_first_time_watch_allowed(self):
        """
        Ensure first-time anonymous watch is still allowed after the fix.
        """
        media = self.test_media
        session = SessionStore()
        session.create()

        result = pre_save_action(
            media=media, user=None, session_key=session.session_key, action="watch", remote_ip="10.0.0.3"
        )
        self.assertTrue(result)


def _jpeg_bytes():
    """Smallest real JPEG. thumbnail/poster/uploaded_thumbnail run bytes through PIL."""
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (2, 2)).save(buf, format="JPEG")
    return buf.getvalue()


class StaleInstanceFileFieldSaveTest(TestCase):
    """FileField writes on Media must not replay a stale row (#841).

    FieldFile.save() defaults to save=True, which calls Model.save() with no
    update_fields: a full write of every concrete column from in-memory state.
    The encoding pipeline holds an instance across a long task, so any column
    another worker changed in the meantime was silently reverted.

    #840 guarded encryption_key alone. These tests assert on an unrelated
    column (title) on purpose, so they cover the general pattern rather than
    re-testing that one guard.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="stale_filefield_user", email="stale@example.com", password="testpass123"
        )

    def _stale_instance_with_concurrent_update(self, **kwargs):
        """Return an instance loaded before another worker changed title."""
        from django.core.files.base import ContentFile

        media = create_test_media(self.user, title="original", **kwargs)
        # A real media_file, so the thumbnail paths can read it off disk.
        media.media_file.save("source.jpg", ContentFile(_jpeg_bytes()), save=False)
        Media.objects.filter(pk=media.pk).update(media_file=media.media_file.name)
        stale = Media.objects.get(pk=media.pk)
        # Another worker commits to the same row while `stale` is still held.
        Media.objects.filter(pk=media.pk).update(title="changed")
        self.assertEqual(stale.title, "original")
        return stale

    def _stored_title(self, media):
        return Media.objects.filter(pk=media.pk).values_list("title", flat=True).first()

    def test_sprites_save_does_not_revert_unrelated_column(self):
        """files/sprites.py -- generate_sprite_for_media() writing media.sprites."""
        from files.sprites import generate_sprite_for_media

        stale = self._stale_instance_with_concurrent_update(duration=20)

        # ffmpeg/imagemagick are not installed in CI. Both branches just need to
        # leave a file at the output path the command was given.
        def fake_run(command):
            with open(command[-1], "wb") as out:
                out.write(_jpeg_bytes())
            return {"out": "", "error": ""}

        with (
            patch("files.sprites.run_command", side_effect=fake_run),
            patch("files.sprites.get_file_type", return_value="image"),
        ):
            result = generate_sprite_for_media(stale)

        self.assertTrue(result["ok"], result)
        self.assertEqual(self._stored_title(stale), "changed")
        stored = Media.objects.get(pk=stale.pk)
        self.assertTrue(stored.sprites.name)
        self.assertEqual(stored.sprite_num_secs, result["sprite_num_secs"])

    def test_set_thumbnail_does_not_revert_unrelated_column(self):
        """files/models.py set_thumbnail() -- the image branch, thumbnail + poster."""
        stale = self._stale_instance_with_concurrent_update(media_type="image")

        stale.set_thumbnail(force=True)

        self.assertEqual(self._stored_title(stale), "changed")
        stored = Media.objects.get(pk=stale.pk)
        self.assertTrue(stored.thumbnail.name)
        self.assertTrue(stored.poster.name)

    def test_produce_thumbnails_from_video_does_not_revert_unrelated_column(self):
        """files/models.py produce_thumbnails_from_video() -- thumbnail + poster."""
        stale = self._stale_instance_with_concurrent_update()

        # ffmpeg is not installed in CI, so stand in for it by writing the frame
        # the real command would have produced at the output path it was given.
        def fake_run_command(command, **kwargs):
            with open(command[-1], "wb") as out:
                out.write(_jpeg_bytes())
            return {}

        with patch("files.helpers.run_command", side_effect=fake_run_command):
            stale.produce_thumbnails_from_video()

        self.assertEqual(self._stored_title(stale), "changed")
        stored = Media.objects.get(pk=stale.pk)
        self.assertTrue(stored.thumbnail.name)
        self.assertTrue(stored.poster.name)

    def test_uploaded_thumbnail_save_does_not_revert_unrelated_column(self):
        """files/models.py Media.save() -- the uploaded_poster -> uploaded_thumbnail write."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        media = create_test_media(self.user, title="original")
        stale = Media.objects.get(pk=media.pk)
        Media.objects.filter(pk=media.pk).update(title="changed")

        # Assigning the field (as the upload form does) is what makes
        # Media.save() see uploaded_poster as changed and write
        # uploaded_thumbnail from it. Calling uploaded_poster.save() instead
        # would mutate the very FieldFile the change-tracker holds, so the
        # branch would never fire.
        stale.uploaded_poster = SimpleUploadedFile("poster.jpg", _jpeg_bytes(), content_type="image/jpeg")
        stale.save(update_fields=["uploaded_poster"])

        self.assertEqual(self._stored_title(stale), "changed")
        stored = Media.objects.get(pk=media.pk)
        self.assertTrue(stored.uploaded_thumbnail.name)

    def test_every_filefield_on_media_is_safe_under_the_default_save(self):
        """FieldFile.save()'s default save=True must not revert a stale row.

        The four call sites in #841 each pass save=False and persist explicitly,
        and are pinned by the tests above. This one enforces the rule for the
        model as a whole: Media's file fields use ScopedFieldFile, so even a
        caller who forgets save=False writes only its own column. A FileField
        added later is picked up automatically, because the fields come from
        _meta rather than a hand-maintained list.
        """
        from django.core.files.base import ContentFile
        from django.db import models as django_models

        file_fields = [f for f in Media._meta.get_fields() if isinstance(f, django_models.FileField)]
        # Guard against the introspection silently matching nothing.
        self.assertGreaterEqual(len(file_fields), 6, "expected Media to still carry its file fields")

        for field in file_fields:
            with self.subTest(field=field.name):
                stale = self._stale_instance_with_concurrent_update()
                # ProcessedImageField runs content through PIL, so only real
                # image bytes survive; a plain FileField accepts either.
                # Deliberately the default save=True: this is the call a future
                # contributor writes by accident, and it must stay safe.
                getattr(stale, field.name).save(f"{field.name}.jpg", ContentFile(_jpeg_bytes()))

                self.assertEqual(
                    self._stored_title(stale),
                    "changed",
                    f"{field.name}.save() with the default save=True reverted an unrelated "
                    f"column. Its field must subclass ScopedFileField / "
                    f"ScopedProcessedImageField (#841).",
                )
                self.assertTrue(
                    getattr(Media.objects.get(pk=stale.pk), field.name).name,
                    f"{field.name} was not persisted",
                )

    def test_new_instance_filefield_save_inserts_instead_of_forcing_update(self):
        """A FileField write on an unsaved Media must insert, not force an UPDATE.

        The scoping in Media.save() derives update_fields from the marker set by
        ScopedFieldFile. Applying it to an insert makes Django force an UPDATE,
        which raises "Cannot force an update in save() with no primary key."
        A new instance has no stale snapshot to protect, so it saves in full.
        """
        from django.core.files.base import ContentFile

        media = Media(user=self.user, title="new instance")
        media.media_file.save("new.jpg", ContentFile(_jpeg_bytes()))

        self.assertIsNotNone(media.pk)
        self.assertTrue(Media.objects.filter(pk=media.pk).exists())
        self.assertTrue(Media.objects.get(pk=media.pk).media_file.name)

    def test_scoped_save_persists_uploads_cleared_by_thumbnail_regeneration(self):
        """Choosing a new frame clears the uploaded poster/thumbnail on the row too.

        That branch in Media.save() deletes both files with delete(save=False),
        which clears them in memory only. Under a scoped caller the columns must
        still be written, or the row keeps pointing at files no longer on disk.
        """
        from django.core.files.base import ContentFile

        media = create_test_media(self.user, title="original", duration=60)
        media.uploaded_thumbnail.save("ut.jpg", ContentFile(_jpeg_bytes()), save=False)
        media.uploaded_poster.save("up.jpg", ContentFile(_jpeg_bytes()), save=False)
        Media.objects.filter(pk=media.pk).update(
            uploaded_thumbnail=media.uploaded_thumbnail.name,
            uploaded_poster=media.uploaded_poster.name,
        )

        fresh = Media.objects.get(pk=media.pk)
        self.assertTrue(fresh.uploaded_thumbnail.name)
        fresh.thumbnail_time = 5
        with patch.object(Media, "set_thumbnail", return_value=True):
            fresh.save(update_fields=["thumbnail_time"])

        stored = Media.objects.get(pk=media.pk)
        self.assertFalse(stored.uploaded_thumbnail.name, "cleared uploaded_thumbnail was not persisted")
        self.assertFalse(stored.uploaded_poster.name, "cleared uploaded_poster was not persisted")

    def test_media_file_write_persists_the_recalculated_filename(self):
        """A scoped media_file write must carry the filename it recomputes.

        Media.save() derives filename from media_file for faster lookups. Scoping
        the write to media_file alone left the row holding the previous basename
        while media_file pointed at the new file, desynchronising a lookup column.
        """
        import os

        from django.core.files.base import ContentFile

        media = create_test_media(self.user, title="original")
        media.media_file.save("first.mp4", ContentFile(b"first"), save=False)
        Media.objects.filter(pk=media.pk).update(media_file=media.media_file.name, filename="first.mp4")

        fresh = Media.objects.get(pk=media.pk)
        fresh.media_file.save("second.mp4", ContentFile(b"second"))

        stored = Media.objects.get(pk=media.pk)
        self.assertIn("second.mp4", stored.media_file.name)
        self.assertEqual(
            stored.filename,
            os.path.basename(stored.media_file.name),
            "filename was not updated alongside media_file",
        )

        # Clearing the file must clear the lookup column too, or searches point
        # at a file the row no longer has. Reachable from the edit form, which
        # exposes media_file through a ClearableFileInput.
        fresh = Media.objects.get(pk=media.pk)
        fresh.media_file.delete()

        cleared = Media.objects.get(pk=media.pk)
        self.assertFalse(cleared.media_file.name)
        self.assertEqual(cleared.filename, "", "filename survived the deletion of media_file")

    def test_filefield_delete_does_not_revert_unrelated_column(self):
        """FieldFile.delete()'s default save=True must not replay a stale row.

        delete() clears the column then calls the same bare instance.save() that
        save() does, so it carries the identical lost-update risk.
        """
        from django.core.files.base import ContentFile

        stale = self._stale_instance_with_concurrent_update()
        stale.sprites.save("sprites.jpg", ContentFile(_jpeg_bytes()), save=False)
        Media.objects.filter(pk=stale.pk).update(sprites=stale.sprites.name)

        stale.sprites.delete()

        self.assertEqual(self._stored_title(stale), "changed")
        self.assertFalse(Media.objects.get(pk=stale.pk).sprites.name, "sprites column was not cleared")

    def test_every_filefield_on_media_is_safe_under_the_default_delete(self):
        """The delete() counterpart of the model-wide guard above.

        Same introspection, so a FileField added later is covered without
        updating a list.
        """
        from django.core.files.base import ContentFile
        from django.db import models as django_models

        file_fields = [f for f in Media._meta.get_fields() if isinstance(f, django_models.FileField)]
        self.assertGreaterEqual(len(file_fields), 6, "expected Media to still carry its file fields")

        for field in file_fields:
            with self.subTest(field=field.name):
                stale = self._stale_instance_with_concurrent_update()
                getattr(stale, field.name).save(f"{field.name}.jpg", ContentFile(_jpeg_bytes()), save=False)
                Media.objects.filter(pk=stale.pk).update(**{field.name: getattr(stale, field.name).name})

                # Deliberately the default save=True.
                getattr(stale, field.name).delete()

                self.assertEqual(
                    self._stored_title(stale),
                    "changed",
                    f"{field.name}.delete() with the default save=True reverted an unrelated "
                    f"column. Its field must subclass ScopedFileField / "
                    f"ScopedProcessedImageField (#841).",
                )

    def test_processed_image_fields_still_process_their_uploads(self):
        """Scoping must not cost imagekit's processing.

        ProcessedImageField's own file class runs the processors, picks the
        output format and fixes the extension in its save(). Replacing
        attr_class with a plain scoped FieldFile silently stored raw uploads at
        full size, so the scoping is a mixin over each field's own class.
        """
        import io

        from django.core.files.base import ContentFile
        from PIL import Image

        def png_bytes(width, height):
            buf = io.BytesIO()
            Image.new("RGB", (width, height), "red").save(buf, format="PNG")
            return buf.getvalue()

        # (field, configured max width) from the model declarations.
        cases = [("thumbnail", 344), ("poster", 1280), ("uploaded_thumbnail", 344)]

        for field_name, max_width in cases:
            with self.subTest(field=field_name):
                media = create_test_media(self.user, title="original")
                # Deliberately a PNG, wider than the target, via the save=False
                # path the call sites use.
                getattr(media, field_name).save("source.png", ContentFile(png_bytes(max_width + 400, 700)), save=False)
                media.save(update_fields=[field_name])

                stored = getattr(Media.objects.get(pk=media.pk), field_name)
                self.assertTrue(stored.name.endswith(".jpg"), f"{field_name} kept the .png extension: {stored.name}")
                stored.open()
                try:
                    image = Image.open(stored)
                    self.assertEqual(image.format, "JPEG", f"{field_name} was not converted to JPEG")
                    self.assertLessEqual(
                        image.width, max_width, f"{field_name} was not resized to its configured width"
                    )
                finally:
                    stored.close()

    def test_scoped_save_does_not_fire_hooks_for_unpersisted_columns(self):
        """Lifecycle hooks must not fire for a column this save does not write.

        A ScopedFieldFile write scopes update_fields to the file column. An
        unrelated in-memory edit (a state the caller never persisted) is not
        written, so announcing it would report a change the row never took.
        """
        from django.core.files.base import ContentFile

        media = create_test_media(self.user, title="original", state="private")
        fresh = Media.objects.get(pk=media.pk)
        # Dirty in memory only; this save is scoped to sprites.
        fresh.state = "public"

        with (
            patch("files.methods.notify_users") as notify_users,
            patch.object(Media, "_invalidate_permission_cache") as invalidate,
        ):
            fresh.sprites.save("sprites.jpg", ContentFile(b"sprite"))

        self.assertFalse(notify_users.called, "published notification fired for an unwritten state")
        self.assertFalse(invalidate.called, "permission cache invalidated for an unwritten state")
        self.assertEqual(Media.objects.get(pk=media.pk).state, "private")
        self.assertTrue(Media.objects.get(pk=media.pk).sprites.name)

    def test_unscoped_save_still_fires_its_hooks(self):
        """The guards must not suppress hooks on an ordinary full save."""
        media = create_test_media(self.user, title="original", state="private")
        fresh = Media.objects.get(pk=media.pk)
        fresh.state = "public"

        with (
            patch("files.methods.notify_users") as notify_users,
            patch.object(Media, "_invalidate_permission_cache") as invalidate,
        ):
            fresh.save()

        self.assertTrue(notify_users.called, "published notification did not fire on a full save")
        self.assertTrue(invalidate.called, "permission cache was not invalidated on a full save")
        self.assertEqual(Media.objects.get(pk=media.pk).state, "public")

    def test_explicitly_scoped_save_of_state_still_fires_its_hooks(self):
        """A caller that does persist state must still get the notification."""
        media = create_test_media(self.user, title="original", state="private")
        fresh = Media.objects.get(pk=media.pk)
        fresh.state = "public"

        with (
            patch("files.methods.notify_users") as notify_users,
            patch.object(Media, "_invalidate_permission_cache") as invalidate,
        ):
            fresh.save(update_fields=["state"])

        self.assertTrue(notify_users.called, "published notification did not fire for a persisted state")
        self.assertTrue(invalidate.called, "permission cache was not invalidated for a persisted state")
        self.assertEqual(Media.objects.get(pk=media.pk).state, "public")
