import os
import re

UUID4_PATTERN = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$", re.IGNORECASE)


def strip_delimiters(input_string):
    delimiters = " \t\n\r'\"[]{}()<>\\|&;:*-=+"
    return "".join(char for char in input_string if char not in delimiters)


def clean_filename(filename):
    # basename first: a client-supplied path must not reach the filesystem
    return strip_delimiters(os.path.basename(filename))


def is_valid_uuid_format(uuid_string):
    return bool(UUID4_PATTERN.match(uuid_string))
