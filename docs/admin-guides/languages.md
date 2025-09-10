# CinemataCMS Language Setup and Configuration

This document outlines the setting up and configuration of additional languages within your organization's build of CinemataCMS.

---
## Installation

Take note that in the `install.sh` script, a set of installation methods are employed as CinemataCMS comes pre-packaged with 25 native languages, and 2 additional ones for transcription and translation purposes.

```zsh
python manage.py loaddata fixtures/apac_languages.json
# ...
python manage.py load_apac_languages
```

These two lines of code refer to the installation of `Language` and `MediaLanguage` objects. The former refers to language **used for subtitling** while the latter refers to **UX-facing** / **website** information that can be seen by regular users and viewers of CinemataCMS.

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