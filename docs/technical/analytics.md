# Umami analytics integration

The integration is off by default. Set `ANALYTICS_ENABLED=true` to collect CMS playback summaries and public role aggregates, even without Umami. For Umami event collection, also set an HTTPS `ANALYTICS_URL` and the environment's `ANALYTICS_WEBSITE_ID`. Set `ANALYTICS_API_KEY` on the CMS server to query Umami event figures for owner dashboards. The key needs read access to that Umami website and must never reach a browser. Use separate website records for staging and production. Umami starts with new data; Matomo history is not imported.

Signed-in viewers open the dedicated owner dashboard at `/analytics` from **Analytics** in the account menu. Analytics is separate from the profile tabs. The former profile URL redirects that owner there. Django session authorization limits dashboard queries to the media's current owner, including history before an ownership change. Umami's admin login is separate. The old `Media.views` counter remains for existing product behavior and is never an analytics fallback.

## Collection and privacy

Eligible public pages, accessible media pages and embeds, and authorized owner workflows load the tracker. Owner workflows use generic paths and no referrer or public role grant. Django staff, editors, managers, superusers, signed-in users who disable activity logging, and denied media pages do not. Curators are eligible viewers. The playback endpoint also rejects snapshots from opted-out users. Accessible public, unlisted, restricted, and private media are eligible. Audience media events carry the `media:<Media.uid>` tag plus an opaque media UUID, media type, page/embed/hero/playlist context, and content revision. Creator edit events use `workflow:<Media.uid>` and `/media/workflow` so they do not enter audience engagement queries. Playlist pages use `playlist:<Playlist.uid>` and a generic path. Nonpublic media sends a generic path and title and no referrer. Public activity sends only the referring domain. Search strings, hashes, friendly tokens, titles, user IDs, access tokens, and raw progress ticks stay out of Umami. The browser honors Do Not Track. The collector route `/api/send` must have proxy access logs disabled.

`media_view` counts eligible media page and embed loads. It does not count thumbnail impressions or hero playback. Playback starts and end events are separate counts. An end event includes seeking to the end; it is not evidence that a viewer watched the whole film. The player sends play, pause, finish, 25/50/75% unique-content-coverage milestones once per play, seek, mute/unmute, quality/subtitle/speed changes, fullscreen/theater changes, next/previous, and bounded error categories. Starts after a player action or on-site navigation are `deliberate`; autoplay and unknown starts remain separate. Confirmed likes, unlikes, playlist changes, copy actions, and comment submissions produce events. Download events represent click intent. Outbound links send the destination domain only.

The legacy home hero receives a signed, media-scoped measurement grant from the access-checked media detail API. Its playback contributes watch time without generating a media page-view event.

The browser also sends cumulative playback snapshots to same-origin `/analytics/playback` at start, every 60 seconds, pause, finish, and page exit. A signed page-load grant and random per-play UUID let the CMS merge retries without storing viewer identity. The endpoint checks origin, grant, media state and revision, and duration. Each snapshot and the accumulated coverage for a play are limited to 1,000 ranges. A snapshot whose merged coverage exceeds that limit returns HTTP 400 without changing the stored summary. The CMS records qualified elapsed viewing time in UTC minute buckets and unique content coverage per play. The existing `watch_days` JSON field and payload key are retained; new keys use `YYYY-MM-DDTHH:MMZ`. Both each request and the merged record are capped at 1,441 buckets and 24 hours of watch time, with at most 60 seconds per minute bucket. Retries merge each bucket by maximum. Legacy date-only snapshots remain accepted, but a play cannot mix date-only and minute keys. Pauses, buffering, seeking jumps, and hidden video below 50% visibility do not add watch time; picture-in-picture video and background audio can. Exit delivery is best effort, so recent plays may be incomplete. CMS summaries and Umami event counts are separate sources.

## New feature events

After a new action succeeds, call `window.CinemataAnalytics?.track('annotation_created')`. Use a fixed lowercase `snake_case` name of at most 50 characters. Never put a title, token, user ID, or other dynamic value in the name. The privacy boundary accepts new names without a tracker release but drops arbitrary event properties. A media-page action inherits its media UUID and appears in owner engagement counts. A general public-page action appears in Umami site reports only. For hero interactions pass media ID, type, context `hero`, and revision as the third argument. A hero player must also receive a signed measurement grant for CMS watch summaries.

For a new server-rendered public page, call `allow_page_analytics(request)` from `cms.analytics` **after** the access check. It sends a generic `/page/<route-name>` path. Denied pages must not call it. For a later SPA route transition on an eligible public page, call `window.CinemataAnalytics?.pageview('route_name')` after access succeeds. Do not call it again on the first server-rendered load. When a media page plays another media item in place, as a fullscreen playlist does when an item ends, call `window.CinemataAnalytics?.switchMedia()` with the item's `uid`, `media_type`, `state`, `analytics_revision`, `page_measurement_token`, and `audience_group` from the media detail API, before its player is created. It counts a media view as a navigation to that page would and attributes later playback and the audience group to the new item. Events recorded before Umami loads keep the item they happened on. The media page never plays a private item in place, because a private media page is not measured. The engineering SOP, PR template, and validation workflow require a tracker decision for new features.

For authorized upload, edit, subtitle, notification, contact and profile workflows,
call `allow_workflow_analytics(request, 'fixed_workflow_name')` after authorization.
Use `action_events(request, 'fixed_event', media=media)` in a successful JSON
response and forward it with `CinemataAnalytics.trackEvents`. For template forms,
`queue_action` carries a successful event to the next eligible rendered page and
consumes it once. Partial bulk submissions forward successful items only.
Authentication completion uses Allauth signals after login, signup and logout,
including MFA completion. Security forms remain untracked. Newsletter opt-in
counts consent intent, not successful delivery by the mailing service.

Private journal, account, profile, notification and private-contact actions are
count-only events with generic paths. They carry no media UUID, notification ID,
recipient or form contents and do not enter public role aggregates. Upload
events count transitions without filenames, byte progress or raw errors. A
transport completion is separate from saving a draft or submitting metadata.
Bulk visibility changes and removals count one successful batch action.

Navigation events use bounded destination categories and homepage placements.
Search submission and result selection contain no query text. Empty results
count once per settled search, not each render or failed request. Article aliases
`/p/slug` and `/slug` share `/slug`; public profile sections have distinct paths
without usernames. Collection failures must not interrupt the application action.

Register new events and emitter/test references in
[`analytics-coverage.json`](analytics-coverage.json). CI runs
`node .github/scripts/analytics-coverage.mjs` and rejects unregistered fixed event
names, missing emitters and missing test files. Add tests for confirmed success,
failure, retry duplication and partial bulk results where relevant. A source
contract cannot prove event semantics by itself. The PR Analytics declaration
must name its Coverage entry IDs as well as Events, Trigger and Verification.

## Platform audience groups

Superusers open **Reports → Platform analytics** on the Django Admin dashboard
or sidebar. This shortcut opens the configured Umami website in a new tab.
It uses `ANALYTICS_URL` and `ANALYTICS_WEBSITE_ID` and is hidden when either is
missing or invalid. Umami requires its own login and website permissions; the
shortcut does not forward CMS credentials or API keys. Disabling new collection
does not hide a valid shortcut to existing reports.

In Umami, open **Event data** and select the `audience_group` property to compare
`anonymous`, `regular`, `trusted`, and `curator` activity. The server supplies the
group for public page views and public events. Trusted corresponds to the
existing `advancedUser` role. Curators count unless they also have an excluded
staff role. Nonpublic media, account actions, journals, and creator workflows
omit the property. Reading milestones, public navigation and playback events
use the same boundary. Labels start with this tracker release; earlier events
are not backfilled.

Property totals count events, not people or visits. Select `page_view` for
public page loads, `media_view` for public media loads, or a specific action and
date range. The named `page_view` is a custom event for audience comparisons;
it does not add another native page view to Umami's Views total. Do not treat
the sum of views and actions as an audience size. These event properties do not
provide a role filter for every
Umami report; no session property or `identify()` call is added. Umami supplies
its own reporting controls, while the CMS has no duplicate audience table.
See [Umami's Event data guide](https://docs.umami.is/docs/event-data).

## Owner dashboard

The portfolio has **Overview**, **Your media**, and **Engagement** tabs. Film reports have **Overview**, **Viewing details**, and **Engagement**. Overview puts the daily chart directly after the measured-viewing summary; Viewing details contains segment coverage, milestones, and playback breakdowns. Images and documents use **Traffic details** and omit playback measurements. Reports without Umami omit Engagement; CMS viewing details remain available. The shared TabView supports keyboard navigation. URL fragments preserve the selected tab through date changes, film-version changes, refresh, and pagination. Current database totals are available in a separate disclosure and do not follow the date filter.

Report filters group the date range and film version separately from Export CSV. Export CSV uses a filled design-system action in both reports: the portfolio downloads its CSV directly; film reports offer a dropdown of datasets. Reload the browser to update the report with the same filters. The date span is shown for CMS-only reports too. Watch time uses explicit hours, minutes, and seconds; daily chart axes show seconds. Watch time is the initial chart selection for playable media. Each statistic exposes its definition and period comparison through a tappable label with an info icon, using the shared Tooltip. Enter or Space opens it; Escape or an outside click closes it. Incomplete older watch time is explained in metric help and the **How viewing is measured** disclosure below the metrics. The update timestamp refreshes once per minute as relative time; tap it for the exact date and time in the report timezone. Segment chart tooltips identify the film segment and its average coverage. Player context and error codes have readable labels. Report navigation does not emit visitor analytics events because owner reports are outside the tracked public visitor flow.

The dashboard joins owner-scoped Umami v3.4.0 events with CMS playback summaries. It offers 7, 30, 90, and 365 calendar days in the browser timezone, default 30. The entry point detects the browser IANA timezone and reloads the report with a validated `tz` parameter before rendering when necessary. Direct API-style requests without `tz` use UTC; unknown zones return 404. Filters, media links, pagination, and CSV exports retain the timezone. Local midnights set the query bounds, including daylight-saving changes; Umami groups daily events in the same timezone. Current event counts include today so they may grow; the 7/30/90-day event comparisons use the immediately preceding window of equal elapsed time, calculated using UTC instants so daylight-saving changes do not alter the comparison duration. A zero prior count may mean the tracker had not yet been activated. CMS watch time has daily buckets and is not compared with an intraday window. A preceding 365-day range falls outside retention. The portfolio leads with measured watch time and shows media views, starts after interaction and all starts, end events, daily trends, engagement, and all owned media ranked by views in pages of 20. It shows event counts, never unique visitor or demographic estimates.

Select a media title for its detail page. The header shows title, thumbnail, duration, type, and visibility. Only detail reports show an **Analytics → media title** breadcrumb; Analytics returns to Your media with the selected date range and timezone. The portfolio has no breadcrumb. Detail adds starts per matching page/embed load, average qualified watch time, mean unique content coverage, and 20 five-percent film-segment coverage bins, playback milestones, context, public referral domains, and bounded error categories where available. Segment coverage is the average portion of each segment watched per measured play; it is not audience retention or a survival curve. Daily and total watch time follow the local day of consumption; average watch and coverage use plays started in the selected range. Use **Film version** to select **All versions**, the current file (the default), an earlier file, or **Data without a film version** events. Selecting that option explains that the views and plays cannot be linked to a specific film version and are included in **All versions**. Files have stable chronological numbers: **Version 3 - Current**, **Version 2**, and **Version 1**, for example. Version 1 is the first file known to the tracker, not necessarily the original upload; replacement dates and historical filenames are not stored. **All versions** combines the selected film's data across revisions, including events without a known version; averages and segment coverage are computed across measured plays. CSV exports preserve this selection. Replacing `media_file` starts a new version; editing the title or thumbnail does not. Invalid or unowned IDs return 404 before any Umami query.

The dashboard uses shared design-system controls, cards, typography, badges, icons, and thumbnails. Pagination owns report paging controls; DataTable renders both daily figures and responsive media rows. Both charts use the shared LineChart wrapper around TanStack, which owns axis typography, theme colors, grid lines, and tooltip styling. Film versions and film CSV exports use the shared Dropdown. Choose a metric above the interactive TanStack daily chart to inspect its dates; **View daily figures** exposes a table. The owner dashboard does not load visitor tracking. Without Umami, CMS watch time, measured plays, average qualified watch time, mean content coverage, segment coverage, and the daily watch-time chart remain available. The portfolio still lists owned media in pages of 20, newest first, with measured plays and watch time. Unavailable Umami sections and the connection notice are hidden, so the dashboard leads with CMS figures. New measurements require the CMS tracker to be enabled; historical summaries remain readable if collection is later disabled.

**Current media totals** shows the existing `Media.views` counter, current `Media.likes`, and the current number of comments from the CMS database. These totals cover all versions and are not filtered by the selected dates. They follow current ownership and are available without either tracker. They do not represent anonymous page views, confirmed like events within a reporting period, or a creator's precise audience. Missing Umami values remain unavailable, never replaced with these product counters. Sessions, estimated visitors, referrals, geography, devices, player errors, and period engagement require Umami data.

**Export CSV** downloads the full owned portfolio, including rows beyond the visible page. It includes CMS measured plays and the separately named current counters. A film has summary, daily, segment-coverage (`retention` dataset name), and engagement exports. The summary includes end events per start as a diagnostic ratio, not a play completion rate. Current counters have no date or version filter in the summary export. An unavailable Umami value is blank and marked unavailable, not zero. CSV text is escaped against spreadsheet formulas. Date columns are named `start_date`, `end_date`, and `date`; every export includes `timezone` and `watch_time_status`.

Older CMS records with only UTC-day totals cannot be split accurately across local midnight. They remain stored and usable in UTC reports. When their day boundaries differ from the requested timezone, local reports exclude their watch time, show a visible incomplete-data explanation, omit average watch time, and mark exports `watch_time_status=partial`. Measured-play counts and film coverage still use the play timestamps and coverage. New minute buckets support local-day grouping without inventing a distribution for old data.

The [filmmaker analytics research](filmmaker-analytics-research.md) records the decision rationale and measurement limits. It predates this implementation.

The [platform analytics privacy review](platform-analytics-privacy-review.md) records the data limits for site-wide admin reports and visitor segments.

## Platform segments and text pages

Audience reporting uses the Umami event property described above. The current
browser tracker no longer posts daily role counts to the CMS. The older
`/analytics/segment-event` endpoint and signed grants remain compatible with
cached older trackers, and `/analytics/segments` remains a superuser-only JSON
API for those historical CMS aggregates, including small counts. Its records
have no visitor key and are not migrated to Umami. CMS playback measurements
and the existing media counter continue independently.

The role breakdown covers public page and named-event counts in Event data.
No session role property is sent, so the ordinary Visits, estimated visitors,
country, browser, OS, device, and Journey reports do not gain a global role
filter. Historical CMS daily counts have no session key.

Every existing `Page` with its own public URL gets foreground-time milestones at 15, 30, 60, 120, and 300 seconds. The timer pauses when the tab is hidden or loses focus. Each threshold fires once per page load as `text_read_<seconds>s` in Umami. These events show how many page loads reached each threshold. They do not prove that the visitor read the text, and a page containing several articles cannot identify which article was read.

## Retention and rollout

`purge_playback_summaries` removes CMS playback snapshots and daily segment counts after 12 months; Celery Beat schedules it daily. The private deployment's version-pinned Umami v3.4.0 SQL job removes old Umami data and refuses to run after an unreviewed Prisma migration. Review and test both jobs before upgrading Umami. Backups must honor the retention policy too. The disposable OrbStack VM is the current integration environment. Staging and production activation, including DNS for `analytics.cinemata.org`, are later operational steps.
