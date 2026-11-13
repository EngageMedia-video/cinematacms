"""robots.txt, following the "Cinemata and AI Crawlers" policy.

Film pages stay open to search engines and archives. Video and subtitle files
are closed to every crawler, and AI training crawlers are blocked from the
whole site.
"""

from django.conf import settings
from django.http import HttpResponse

from files import sitemaps

# The media prefixes that serve video or subtitle files (see files/secure_media_views.py).
# Posters and thumbnails under original/thumbnails/ stay open.
FILM_FILE_PREFIXES = (
    "original/user/",  # uploaded originals
    "original/subtitles/",
    "encoded/",  # encoded renditions and animated previews
    "hls/",
    "videos/",  # legacy video and subtitle paths
    "other_media/",
)

# Crawlers that collect AI training data. This is the list that Cloudflare's
# managed robots.txt blocks for AI training, so robots.txt and the CDN rules agree.
AI_TRAINING_CRAWLERS = (
    "Amazonbot",
    "Applebot-Extended",
    "Bytespider",
    "CCBot",
    "ClaudeBot",
    "Google-Extended",
    "GPTBot",
    "meta-externalagent",
)

HEADER = """\
# Cinemata's crawler rules. Film pages are open to search engines and archives.
# Video and subtitle files are closed to every crawler. AI training crawlers are
# blocked from the whole site."""

# The Content Signals Policy (CC0), copied verbatim from Cloudflare's managed
# robots.txt documentation. Its last paragraph states the restrictions of the
# Content-Signal line below as a reservation of rights under EU copyright law.
CONTENT_SIGNALS_POLICY = """\
# As a condition of accessing this website, you agree to abide by the
# following content signals:

# (a)  If a content-signal = yes, you may collect content for the
#      corresponding use.
# (b)  If a content-signal = no, you may not collect content for the
#      corresponding use.
# (c)  If the website operator does not include a content signal for a
#      corresponding use, the website operator neither grants nor restricts
#      permission via content signal with respect to the corresponding use.

# The content signals and their meanings are:

# search: building a search index and providing search results (e.g., returning
#         hyperlinks and short excerpts from your website's contents). Search
#         does not include providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models (e.g., retrieval
#           augmented generation, grounding, or other real-time taking of
#           content for generative AI search answers).
# ai-train: training or fine-tuning AI models.

# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT
# AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET."""

# Search and AI answers may use the pages. AI training may not.
CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no"


def robots_txt(request):
    lines = [HEADER, "", CONTENT_SIGNALS_POLICY, "", "User-agent: *", f"Content-Signal: {CONTENT_SIGNAL}"]
    lines += [f"Disallow: {settings.MEDIA_URL}{prefix}" for prefix in FILM_FILE_PREFIXES]
    for crawler in AI_TRAINING_CRAWLERS:
        lines += ["", f"User-agent: {crawler}", "Disallow: /"]
    lines += ["", f"Sitemap: {sitemaps.index_url(request)}", ""]
    return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")
