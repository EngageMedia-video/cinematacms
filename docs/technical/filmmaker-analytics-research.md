# Analytics that help filmmakers make decisions

Research date: 29 September 2026. This records the pre-implementation
measurement review and recommendation. Statements below about what was
"current" or "not implemented" refer to that draft, not the current code.
For the implemented contract, use [analytics.md](analytics.md).

Here, **portfolio** means media owned by the signed-in filmmaker. It does not
mean site-wide analytics. **Film** means one selected video; audio can use the
same playback measures, while images and documents need different measures.

## Give the two pages different jobs

The portfolio page should answer: Which films need attention, and where should
I put distribution effort? The film page should answer: Are people starting this
film, reaching its later sections, and responding to it?

This distinction follows established product patterns. Wistia's account view
combines trends, top media, and embed domains, with links into individual media.
[Wistia account overview](https://support.wistia.com/en/articles/8215793-account-overview-analytics).
YouTube uses a video's retention report to investigate specific moments and
compares videos of similar length.
[YouTube audience retention](https://support.google.com/youtube/answer/9314415?hl=en).
Our priorities below are an inference from those patterns and Cinemata's privacy
contract, not evidence that every filmmaker needs the same dashboard.

## What Cinemata can actually measure today

This review inspected the working tree based on commit
`4a0b3b52d441fde82fb582dfa2dd6ceaa9d92417`, including uncommitted issue #578 work.
Recheck these sources when implementing a recommendation:

- [`cms/creator_analytics.py`](../../cms/creator_analytics.py) aggregates owned
  media tags, daily views, starts, finishes, milestones, and engagement events.
- [`static/js/cinemata-analytics.js`](../../static/js/cinemata-analytics.js)
  defines player triggers and the outbound privacy allowlist.
- [`MediaPlayer.js`](../../frontend/packages/media-player/src/MediaPlayer.js)
  connects the shared player and records setting changes and navigation.
- [The collection contract](analytics.md) defines authorization, retention,
  nonpublic media handling, and the Umami v3.4.0 query contract.

The relevant names can be located with:

```sh
rg -n 'creator_analytics|playback_start|progress_25|attachPlayer|subtitle_change' cms/creator_analytics.py static/js/cinemata-analytics.js frontend/packages/media-player/src/MediaPlayer.js
```

The current service uses `stats`, `pageviews`, `metrics`, and `events/series`.
New property breakdowns require a tested query against the pinned Umami version.
Collection of a property does not establish that the current CMS API adapter
can aggregate it. The upstream release is
[Umami v3.4.0](https://github.com/umami-software/umami/releases/tag/v3.4.0).

### Keep the definitions visible

| Current measure          | What the code counts                                                                     | What the count cannot establish                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Media views              | Eligible tagged media page and embed loads                                               | People, thumbnail impressions, or films watched                                      |
| Playback starts          | First `play` after player initialization or `ended`; pause and resume do not add a start | Deliberate starts only; autoplay is not separated                                    |
| Completions              | Player `ended` events                                                                    | Watching every preceding section                                                     |
| Completion rate          | `100 × finish / playback_start` inside the selected period                               | The fraction of a matched group of plays that completed                              |
| Reached 25%, 50%, or 75% | First observed position at or beyond each threshold per play                             | Continuous viewing or seconds watched                                                |
| Engagement               | Recorded successful actions, with click intent for downloads                             | Unique participants, current like totals, successful downloads, or external outcomes |

A seek to 80% can emit all three progress milestones. Completion can occur
after seeking to the end. A start before the selected period and a finish inside
it affect different denominators. Keep the agreed **Completion rate** label with
a definition beside it; show its numerator and denominator, and a dash for no
starts. Do not clamp ratios above 100% or draw the milestones as a guaranteed
descending retention funnel.

Definitions differ across providers. Vimeo distinguishes finishes near the end
from session completion and derives average watched time from measured watch
time. Its terms are useful references, not interchangeable Cinemata metrics.
[Vimeo analytics glossary](https://help.vimeo.com/hc/en-us/articles/46427526982545-Analytics-Glossary).

## Prioritize the portfolio view

P1 means the next useful dashboard work. P2 means useful after the measurement
or query gap is closed. Availability describes this review's working tree.

| Priority and measure                         | Filmmaker decision                                          | Definition and availability                                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: views, starts, and completions over time | Is activity growing after a release or distribution effort? | Daily counts and totals already available. Keep the three names separate.                                                                                                                            |
| P1: films by starts and completions          | Which films deserve promotion or investigation?             | Counts exist per visible table page. A true portfolio ranking needs aggregation across all owned media before pagination. Sorting 20 newest rows is not a top-films report.                          |
| P1: weighted completion rate                 | Is the portfolio's playback mix changing?                   | `100 × sum(finishes) / sum(starts)` already available. Never average individual film percentages. Show alongside counts and film duration.                                                           |
| P1: response by action                       | Which films prompt discussion or redistribution?            | Likes, comment submissions, playlist additions, link copies, embed copies, and download clicks already collected. Keep actions separate; subtracting unlikes gives event balance, not current likes. |
| P1: equal preceding-period comparison        | Did activity change after recent work?                      | Existing events support another time-window query. Comparison is not implemented. Show count differences; use percentage change only with a nonzero baseline.                                        |
| P2: distribution context                     | Are embeds contributing playback?                           | `page`, `embed`, and `hero` are collected on media events. Add and verify property aggregation before showing counts by context.                                                                     |
| P2: public referral domains                  | Which publishers or partners send activity?                 | Public referrer domains are collected. An owner-scoped query and validation are needed. No referrer exists for nonpublic activity; missing referrers do not prove direct visits.                     |
| P2: total watch time                         | Which films account for sustained viewing?                  | Sum qualified watch time across owned films once the new measurement below exists. Show film contributions alongside starts; longer films naturally offer more watch time.                           |

Weighting avoids allowing a film with very few starts to dominate the portfolio
percentage. Vimeo documents the same aggregation principle for its own
completion definition.
[Vimeo engagement analytics](https://help.vimeo.com/hc/en-us/articles/44934439084561-About-engagement-analytics).

Avoid one total called “engagement rate.” A person can like, comment, copy a
link, and remove a playlist entry during the same play. Adding those events
does not measure how many people responded or whether the response was positive.

## Prioritize the film view

| Priority and measure                               | Filmmaker decision                                                    | Definition and availability                                                                                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: views, starts, completions, and daily activity | Does this release attract activity and playback?                      | Available for the selected media tag, with its title, duration, type, and visibility supplied by the CMS.                                                                                                             |
| P1: completion rate and milestone counts           | Is there a reason to investigate playback or the film's presentation? | Available counts, with the seeking and period-boundary limits above. They cannot identify an exact drop-off scene.                                                                                                    |
| P1: discussion and response                        | Does this film prompt an action?                                      | Show confirmed comments and likes separately from removals. Comment events measure submission, not sentiment or meaningful discussion.                                                                                |
| P1: sharing and reuse intent                       | Is the film being prepared for redistribution?                        | Link copies, embed copies, playlist additions, and download clicks are available. Copying an embed does not prove installation; copying a link does not prove another visit.                                          |
| P2: starts per 100 media loads                     | Do visits lead to playback in the same context?                       | `100 × starts / loads`, restricted to matching page or embed contexts. Needs context queries and a compatible denominator. Hero starts currently have no matching tagged media load.                                  |
| P2: public referral and playback context           | Which distribution routes work for this film?                         | Same query gaps as the portfolio. An embed referrer can indicate its containing site; browser policy can suppress it.                                                                                                 |
| P2: playback problems                              | Should I investigate the file or delivery?                            | `player_error` categories are collected but omitted from the dashboard. Display counts first. A failure rate needs one failure outcome per playback attempt and a matching attempt denominator.                       |
| P2: watch time and average watched duration        | How much of the film is actually consumed?                            | New measurement required. `sum(qualified watched seconds)` and that sum divided by matching measured plays. Milestones cannot supply these values.                                                                    |
| P2: average percentage watched                     | How does attention compare with films of similar length?              | New measurement required. Average the watched proportion per measured play, using film duration at playback and a defined repeat/speed policy. Do not divide wall-clock time by duration when playback speeds differ. |

Starts per load is an event ratio, not a thumbnail click-through rate. Replays
and autoplay can increase it. YouTube's CTR uses registered thumbnail
impressions and their associated views, neither of which Cinemata currently
collects.
[YouTube impressions and CTR](https://support.google.com/youtube/answer/7628154?hl=en).

Subtitle, quality, and speed change counts belong in secondary diagnostics.
The current events do not contain language, selected resolution, speed value,
or whether subtitles were enabled. They cannot support claims about preferred
languages, accessibility needs, or bandwidth conditions.

## Close measurement gaps before adding richer charts

YouTube reports total watch time, average view duration, and average percentage
watched as distinct measures. This supports showing both the volume and depth
of viewing rather than treating starts as sufficient evidence of attention.
[YouTube watch-time metric definitions](https://developers.google.com/youtube/analytics/metrics#watch-time-metrics).

Watch time is the most useful missing film measure. A future implementation
could accumulate qualified playback locally and emit bounded summaries at
pause, finish, and page exit. It needs an explicit policy for buffering, seeking,
speed, background playback, repeats, duplicate delivery, and lost exit events.
Raw playback ticks must remain off the collector. The current property allowlist
would also need a reviewed extension and a tested numeric aggregation query.
Keep accumulation local without persistent viewer or play identifiers. Any
proposal to transmit those identifiers requires a new privacy decision.

True retention needs observed playback intervals or watched segments, with a
defined play denominator. A line interpolated through four milestone counts
would imply precision the events do not have. Keep a future retention chart
separate from the daily activity chart. YouTube's report relates changes to
specific video moments; that requires richer evidence than today's milestones.
[YouTube audience retention](https://support.google.com/youtube/answer/9314415?hl=en).

Qualified play, thumbnail impression, call-to-action display, and confirmed
campaign outcome events need their own specifications. An outbound domain click
does not establish a donation, screening request, petition signature, or
successful referral. General donation-page visits also lack film attribution.

## Make comparisons honest

Use UTC for both periods. For a selected interval `[start, end)`, compare the
immediately preceding interval of equal length. Either match the partial day or
compare complete days; never compare today's partial count with a full day
without saying so. Show rate changes in percentage points.

Keep a comparison unavailable when either interval predates activation or falls
outside retained data. A 365-day selection cannot have a complete preceding
365-day comparison under 12-month retention. Ownership transfers change which
films enter a portfolio; comparisons should use the same currently owned set
and explain that historical events follow the media.

Show denominators for small samples and avoid “good” or “bad” percentage badges.
Compare films of similar length and release age before drawing conclusions.
DNT, staff exclusions, blocked collection, and delivery failures mean these are
observed events rather than a census. None of the dashboards prove that a
promotion caused a change.

## Keep the interface tied to those decisions

The portfolio should lead with totals and trends, then film comparison, with
response and distribution in separate sections. Keep visibility and media type
visible so private review copies, trailers, full films, and documents are not
mistaken for equivalent releases.

The film page should lead with its identity and a proper breadcrumb from
**Home** to **Analytics** to the film title. Follow with playback activity,
milestone counts, response and sharing, then distribution and diagnostics when
those queries exist. Links back to Analytics should preserve the date range.
Watch time and retention belong here when valid measurement exists. They do not
need another seekbar.

## Keep impact and privacy boundaries explicit

Unique viewers, viewer identities, demographics, individual journeys, full
referrer paths, and session replay remain outside the agreed dashboard scope.
Public referrers contain domains only; nonpublic media sends none. All tracked
states remain visible only to the current owner, within the retained period.

For filmmakers working on social change, campaign goals determine what impact
means. Doc Society recommends defining goals and indicators before choosing
measurement tools.
[Doc Society evaluation planning](https://impactguide.org/guide/measuring-impact/your-evaluation-plan/).
Screening reports, partner activity, voluntary audience feedback, and documented
institutional responses can support that evaluation. Treat these as a separate
future workflow with consent and access rules. Page loads and playback events
alone cannot establish changed attitudes, policy change, or community benefit.
