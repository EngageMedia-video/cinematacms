# CinemataCMS Language Setup and Configuration

This document outlines the setting up and configuration of languages and media languages within your organization's build of CinemataCMS.

---
## Overview

CinemataCMS uses two types of language models:
- **Language**: Language codes used for subtitling and media metadata (based on BCP-47 standards)
- **MediaLanguage**: UX-facing language listings displayed to regular users and viewers

## Installation

During the initial installation process (via `install.sh`), CinemataCMS automatically loads 57 languages covering APAC regions and commonly used languages worldwide, plus 2 special entries for automatic transcription and translation.

```zsh
python manage.py load_apac_languages
```

This command creates both `Language` and `MediaLanguage` objects for all supported languages (excluding automatic transcription/translation entries from MediaLanguage).

### Updating Existing Language Data

If you have an existing installation, you can update language entries to the latest BCP-47 standards:

```zsh
# Update existing language entries and consolidate duplicates
python manage.py load_apac_languages --update

# Preview changes without applying them
python manage.py load_apac_languages --dry-run

# Preview update with consolidation
python manage.py load_apac_languages --update --dry-run
```

The `--update` flag will:
- Update language codes to BCP-47 standards (e.g., `zh` → `zh-Hans`)
- Consolidate duplicate language entries
- Migrate associated subtitle records to the new language codes
- Merge duplicate MediaLanguage entries and consolidate media counts

### Updating Media Language and Country Listings

For existing installations that need to refresh MediaLanguage and MediaCountry data:

```zsh
# Update MediaLanguage listings from existing media
python manage.py populate_media_languages

# Update MediaCountry listings from existing media
python manage.py populate_media_countries
```

Both commands support a `--dry-run` flag to preview changes:

```zsh
python manage.py populate_media_languages --dry-run
python manage.py populate_media_countries --dry-run
```

**What these commands do:**
- Scan all media for unique language/country codes
- Create missing MediaLanguage/MediaCountry entries based on actual media
- Update media counts for all existing entries

**When to run these commands:**
- After migrating from an older version
- When MediaLanguage/MediaCountry entries are out of sync with actual media
- After bulk media imports or deletions
- To refresh media counts and ensure all languages/countries used in media have corresponding listings

## Adding Languages / Media Languages

To add languages or media languages, ensure that you have access to the Django Admin page.

> [!NOTE] When adding languages and media languages, please ensure that you add both for each corresponding language.

**Languages**
1. From the admin page, select `Languages`.
2. On the upper-right corner of the page, click `Add Language`
3. Input a unique `code` and `title` that will be associated with the Language. (ex. code - 'ru', title - 'Russian')

**Media Languages**
1. From the admin page, select `Media languages`.
2. On the upper-right corner of the page, click `Add Language`.
3. For Media Languages, only the `title` will be necessary. Make sure the `title` used is equivalent to a `title` found in the Languages table.

You have successfully added a language.

## Deleting languages

For either one, you may delete a language by ticking the language in either Media Language or Language and selecting the `Delete selected media languages` action.