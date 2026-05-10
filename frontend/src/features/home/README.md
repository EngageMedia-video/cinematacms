# Home Feature

Modern-track home page: hero section + Featured by Curators row + provisional category rows.

## Data flow

1. Django renders `templates/cms/index_revamp.html` and injects two `json_script` blocks:
   - `#home-initial-data-featured` — `/api/v1/media?show=featured` payload (first 20 items)
   - `#home-initial-data-recommended` — `/api/v1/media?show=recommended` payload

2. `src/entries/index-revamp.js` reads both blocks via `readInitialDataFromDom()` and seeds
   `homeQueryClient` before first render. The hero and curators row paint with no network request.

3. `useFeaturedMedia` and `useRecommendedMedia` hooks observe keys `['home','featured']` and
   `['home','recommended']`. On `staleTime` expiry or focus, they refetch from the API.

## Category rows (deferred)

`useCategoryMedia(categoryId)` is a stub returning `{ data: [], isLoading: false, isError: false }`.
The `PROVISIONAL_CATEGORIES` list in `HomePage.jsx` defines the shape; category rows hide themselves
when their data is empty (R7). To wire real data:

1. Replace the body of `hooks/useCategoryMedia.js` with a real query.
2. The `PROVISIONAL_CATEGORIES` list and `CategorySectionRow` composition in `HomePage.jsx` stay unchanged.

## Component tree

```
HomePage (QueryClientProvider)
└── HomePageContent
    ├── HeroSection (compound, reads useFeaturedMedia)
    │   ├── HeroSection.Player  (lazy → HeroVideoPlayer → @mediacms/media-player)
    │   └── HeroSection.Card   (title, meta, ExpandableText)
    ├── FeaturedByCuratorsRow  (thin wrapper → SectionRow + useRecommendedMedia)
    └── CategorySectionRow × N (thin wrapper → SectionRow + useCategoryMedia, renders null)
        └── SectionRow (compound)
            ├── SectionRow.Header
            ├── SectionRow.Description (ExpandableText)
            └── SectionRow.Carousel → Carousel (compound)
                ├── Carousel.Track
                ├── Carousel.Dots
                └── Carousel.Arrows
```
