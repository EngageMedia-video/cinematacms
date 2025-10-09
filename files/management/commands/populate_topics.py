from django.core.management.base import BaseCommand
from django.db import transaction
from files.models import Topic
from files import lists


class Command(BaseCommand):
    help = "Populate Topic table from video_topics list"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without making changes",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting Topic population..."))

        created_count = 0
        updated_count = 0

        for topic_code, topic_title in lists.video_topics:
            if options["dry_run"]:
                existing = Topic.objects.filter(title=topic_title).first()
                if existing:
                    self.stdout.write(
                        f"Topic already exists: {topic_title} (media count: {existing.media_count})"
                    )
                else:
                    self.stdout.write(
                        f"Would create Topic: {topic_title}"
                    )
            else:
                # Create or get the Topic record
                topic_obj, created = Topic.objects.get_or_create(
                    title=topic_title
                )

                # Update the media count
                topic_obj.update_tag_media()

                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created Topic: {topic_title} (media count: {topic_obj.media_count})"
                        )
                    )
                else:
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Updated Topic: {topic_title} (media count: {topic_obj.media_count})"
                        )
                    )

        if not options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n{'=' * 80}\n"
                    f"FINAL SUMMARY:\n"
                    f"Topics - Created: {created_count}, Updated: {updated_count}\n"
                    f"{'=' * 80}"
                )
            )
        else:
            self.stdout.write(
                self.style.NOTICE("\nDry run completed - no changes made")
            )
