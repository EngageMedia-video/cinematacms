# Home Feature

Modern-track home page: hero section + Featured by Curators row + admin-configured homepage playlist rows + Recent videos grid.

## Data flow

1. Django renders `templates/cms/index_revamp.html` and injects two `json_script` blocks:
   - `#home-initial-data-featured` — `/api/v1/media?show=featured` payload (first 20 items)
   - `#home-initial-data-recommended` — `/api/v1/media?show=recommended` payload

2. `src/entries/index-revamp.js` reads both blocks via `readInitialDataFromDom()` and seeds
   `homeQueryClient` before first render. The hero and curators row paint from seeded list data.

3. `useFeaturedMedia` and `useRecommendedMedia` hooks observe keys `['home','featured']` and
   `['home','recommended']`. On `staleTime` expiry or focus, they refetch from the API.

4. `HeroSection.Player` uses list playback data when present. When the featured list item has no playback payload,
   it fetches the legacy media detail endpoint derived from `url`, `friendly_token`, `uid`, or `id` before mounting
   the player.

5. `useRecentMedia()` fetches `/api/v1/media?show=latest` for the Recent videos grid. This mirrors the legacy
   homepage/latest feed while keeping initial hero rendering focused on server-injected featured data.

## Homepage playlist rows

The legacy homepage lets admins configure playlist rows through `IndexPageFeatured`.
The modern homepage now uses the same source:

1. `useIndexFeaturedPlaylists()` fetches `/api/v1/indexfeatured`.
2. Each configured row fetches its returned `api_url` via `usePlaylistMedia(apiUrl)`.
3. `normalizeMediaList()` accepts playlist detail envelopes via `playlist_media`, plus paginated `results`
   and bare arrays.
4. `IndexPageFeatured.text` renders through `SectionRow.HtmlDescription`, preserving the legacy row behavior
   for admin-authored HTML such as `<br>` and `<a>`, with DOMPurify as a client-side safety net.
5. Rows hide themselves when their playlist has no visible media, matching the existing `SectionRow` contract.

## Component tree

```text
HomePage (QueryClientProvider)
└── HomePageContent
    ├── HeroSection (compound, reads useFeaturedMedia)
    │   ├── HeroSection.Player  (HeroVideoPlayer → @mediacms/media-player)
    │   └── HeroSection.Card   (title, meta, ExpandableText)
    ├── FeaturedByCuratorsRow  (thin wrapper → SectionRow + useRecommendedMedia)
    ├── HomepagePlaylistRow × N (thin wrapper → SectionRow + usePlaylistMedia)
    └── RecentVideosRow        (thin wrapper → SectionRow.Grid + useRecentMedia)
        └── SectionRow (compound)
            ├── SectionRow.Title
            ├── SectionRow.HtmlDescription (sanitized admin HTML, playlist rows only)
            ├── SectionRow.Carousel → Carousel (playlist/curator rows)
            └── SectionRow.Grid     → responsive movie grid (Recent videos)
                └── MediaTile       → VerticalMovieItem
```

Playlist and curator rows use the carousel body. Recent videos intentionally uses `SectionRow.Grid` to match the
legacy latest-video block rather than the horizontal playlist carousel.

```text
Carousel (compound)
                ├── Carousel.Track
                ├── Carousel.Dots
                └── Carousel.Arrows
```
