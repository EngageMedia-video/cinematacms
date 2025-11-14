# Generated manually to fix data issues from migrations 0003 and 0005
# These migrations were already applied to production with incorrect defaults

from django.db import migrations, models
import files.helpers


def fix_invalid_state_values(apps, schema_editor):
    """
    Fix Media records that may have invalid state='private_verified'.

    This addresses the issue where migration 0003 set default='private_verified'
    which is not in the valid MEDIA_STATES choices.
    """
    Media = apps.get_model('files', 'Media')

    # Convert any records with invalid 'private_verified' state to 'private'
    updated_count = Media.objects.filter(state='private_verified').update(state='private')

    if updated_count > 0:
        print(f"\n  Fixed {updated_count} Media record(s) with invalid state='private_verified'")


def fix_invalid_country_values(apps, schema_editor):
    """
    Fix Media records that have invalid media_country='en'.

    This addresses the issue where migration 0005 set default='en'
    which is not in the valid country choices.
    """
    Media = apps.get_model('files', 'Media')

    # Convert any records with invalid 'en' country code to None
    updated_count = Media.objects.filter(media_country='en').update(media_country=None)

    if updated_count > 0:
        print(f"\n  Fixed {updated_count} Media record(s) with invalid media_country='en'")


def reverse_fix(apps, schema_editor):
    """
    Reverse migration: No action needed.

    We don't restore invalid values since they were incorrect.
    """
    print("\n  Reverse migration: No action needed (keeping corrected values)")


class Migration(migrations.Migration):

    dependencies = [
        ('files', '0007_encoding_filename_media_filename_and_more'),
    ]

    operations = [
        # Step 1: Fix invalid data in existing records
        migrations.RunPython(
            fix_invalid_state_values,
            reverse_code=reverse_fix,
        ),
        migrations.RunPython(
            fix_invalid_country_values,
            reverse_code=reverse_fix,
        ),

        # Step 2: Fix the default value for state field
        # This corrects the invalid default='private_verified' from migration 0003
        # Note: The model uses helpers.get_portal_workflow() which evaluates at import time.
        # We use the callable here so the migration matches the model definition.
        migrations.AlterField(
            model_name='media',
            name='state',
            field=models.CharField(
                choices=[
                    ('private', 'Private'),
                    ('public', 'Public'),
                    ('restricted', 'Restricted'),
                    ('unlisted', 'Unlisted')
                ],
                db_index=True,
                default=files.helpers.get_portal_workflow(),  # Call function to get current workflow
                max_length=20
            ),
        ),

        # Step 3: Fix the default value for media_country field
        # This corrects the invalid default='en' from migration 0005
        migrations.AlterField(
            model_name='media',
            name='media_country',
            field=models.CharField(
                blank=True,
                choices=[
                    ('AQ', 'Antarctica'), ('AU', 'Australia'), ('BD', 'Bangladesh'),
                    ('BT', 'Bhutan'), ('BU', 'Bougainville'), ('BN', 'Brunei Darussalam'),
                    ('KH', 'Cambodia'), ('CN', 'China'), ('EG', 'Egypt'), ('FJ', 'Fiji'),
                    ('PF', 'French Polynesia'), ('GU', 'Guam'), ('HA', 'Hawaii'),
                    ('HK', 'Hong Kong'), ('IN', 'India'), ('ID', 'Indonesia'),
                    ('XX', 'International'), ('JP', 'Japan'), ('KI', 'Kiribati'),
                    ('KP', "Korea, Democratic People's Republic Of"), ('LA', 'Laos'),
                    ('MY', 'Malaysia'), ('MV', 'Maldives'), ('MH', 'Marshall Islands'),
                    ('FM', 'Micronesia, Federated States Of'), ('MN', 'Mongolia'),
                    ('MM', 'Myanmar'), ('NR', 'Nauru'), ('NP', 'Nepal'),
                    ('NC', 'New Caledonia'), ('NZ', 'New Zealand'),
                    ('MP', 'Northern Mariana Islands'), ('PK', 'Pakistan'),
                    ('PW', 'Palau'), ('PG', 'Papua New Guinea'), ('PH', 'Philippines'),
                    ('PN', 'Pitcairn'), ('WS', 'Samoa'), ('SG', 'Singapore'),
                    ('SB', 'Solomon Islands'), ('LK', 'Sri Lanka'), ('TW', 'Taiwan'),
                    ('TH', 'Thailand'), ('TI', 'Tibet'), ('TL', 'Timor-Leste'),
                    ('TK', 'Tokelau'), ('TO', 'Tonga'), ('TV', 'Tuvalu'),
                    ('VU', 'Vanuatu'), ('VN', 'Viet Nam'), ('WP', 'West Papua'),
                    ('KR', 'South Korea')
                ],
                db_index=True,
                default=None,  # Changed from invalid 'en' to None
                max_length=5,
                null=True
            ),
        ),
    ]
