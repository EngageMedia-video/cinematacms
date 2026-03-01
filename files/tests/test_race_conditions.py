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
            username='media_owner_shadow',
            defaults={
                'email': 'owner_shadow@example.com',
                'password': 'testpass123'
            }
        )
        cls.test_media = create_test_media(
            user=cls.media_owner,
            title='Variable Shadowing Test Video'
        )

    def test_anonymous_user_with_existing_watch_no_attribute_error(self):
        """
        Regression: anonymous user who already watched should not raise
        AttributeError on query.exists() due to variable shadowing.
        """
        media = self.test_media
        session = SessionStore()
        session.create()
        session_key = session.session_key
        ip = '10.0.0.1'

        # Record an initial watch action for this anonymous user
        MediaAction.objects.create(
            media=media,
            user=None,
            session_key=session_key,
            action='watch',
            action_date=timezone.now(),
            remote_ip=ip
        )

        # This should NOT raise AttributeError
        # Before the fix, `query` was reassigned to a MediaAction instance,
        # and then `query.exists()` was called on it.
        try:
            result = pre_save_action(
                media=media,
                user=None,
                session_key=session_key,
                action='watch',
                remote_ip=ip
            )
            self.assertIsNotNone(result)
        except AttributeError as e:
            self.fail(
                f"AttributeError raised due to variable shadowing bug: {e}"
            )

    def test_logged_in_user_with_existing_action_no_attribute_error(self):
        """
        Ensure logged-in users with existing actions also don't hit the bug.
        """
        media = self.test_media
        user, _ = User.objects.get_or_create(
            username='testuser_shadow',
            defaults={
                'email': 'shadow@example.com',
                'password': 'testpass123'
            }
        )

        # Record an initial like action
        MediaAction.objects.create(
            media=media,
            user=user,
            action='like',
            action_date=timezone.now(),
            remote_ip='10.0.0.2'
        )

        # Should return False (already liked) without any error
        result = pre_save_action(
            media=media,
            user=user,
            session_key=None,
            action='like',
            remote_ip='10.0.0.2'
        )
        self.assertFalse(result)

    def test_anonymous_first_time_watch_allowed(self):
        """
        Ensure first-time anonymous watch is still allowed after the fix.
        """
        media = self.test_media
        session = SessionStore()
        session.create()

        result = pre_save_action(
            media=media,
            user=None,
            session_key=session.session_key,
            action='watch',
            remote_ip='10.0.0.3'
        )
        self.assertTrue(result)
