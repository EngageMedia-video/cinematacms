# Understanding Video Recommendation Algorithms in CinemataCMS

This guide explains how Cinemata, built on MediaCMS, handles video recommendations, including the algorithms behind popular videos, related content suggestions, and featured media.

## Popular Videos Algorithm

Cinemata calculates popular videos through the `get_list_of_popular_media` task in `files/tasks.py`. This task runs every 10 hours via the Celery scheduler and determines popular content based on two key metrics:

1. **Recent Views**: The top 25 videos with the most views during the past week
2. **Liked Content**: The top 25 videos that received the most likes over the past six months

### Implementation Details

The algorithm follows these steps:

```python
# Calculate popular videos through these steps:
# X = the top 25 videos that have the most views during the last week
# Y = the most recent 25 videos that have been liked over the last 6 months
```

1. It retrieves all public, reviewed, successfully-encoded media
2. For each media item:
   - Counts views within the last 7 days
   - Counts likes within the last 6 months
3. Creates two ranked lists:
   - Top 25 videos with most views in the last week
   - Top 25 videos with most likes in the last 6 months
4. Combines both lists, removes duplicates, and caches the result in Redis with a 12-hour expiration

```python
x = sorted(valid_media_x.items(), key=lambda kv: kv[1], reverse=True)[:25]
y = sorted(valid_media_y.items(), key=lambda kv: kv[1], reverse=True)[:25]

media_ids = [a[0] for a in x]
media_ids.extend([a[0] for a in y])
media_ids = list(set(media_ids))
cache.set("popular_media_ids", media_ids, 60 * 60 * 12)
```

This cached list is then used by the `show_recommended_media` function in `files/methods.py` when users access the "Recommended" or "Popular" page, providing a performant way to deliver popular content.

## Related Videos Algorithm

When a user views a video, Cinemata suggests related content through the `show_related_media` function in `files/methods.py`. The platform supports two strategies, configurable via the `RELATED_MEDIA_STRATEGY` setting:

1. `content` (default) - Based on categories, tags, and other content metadata
2. `author` - Shows other videos from the same creator

### Content-Based Strategy

The content-based recommendation strategy (`show_related_media_content`) works through the following hierarchy:

1. First prioritizes videos from the same author
2. If this doesn't reach the limit, adds videos from the same category
3. If spots remain available, adds generic videos sorted by random criteria from:
   ```python
   order_criteria = [
       "-views",
       "views",
       "add_date",
       "-add_date",
       "featured",
       "-featured",
       "user_featured",
       "-user_featured",
   ]
   ```
4. The results are combined, deduplicated, the original video is removed, and the list is shuffled to provide variety

### Author-Based Strategy

The author-based strategy (`show_related_media_author`) simply shows other videos from the same creator, randomly shuffled to encourage discovery across the creator's content.

## Manually Featured Content

Beyond algorithmic recommendations, Cinemata provides administrative tools for manually featuring content through the `IndexPageFeatured` model. This allows site administrators to:

1. Manually select videos or playlists to appear on the homepage
2. Override or complement algorithmic recommendations with editorially curated content
3. Highlight important or timely content regardless of popularity metrics

This feature is managed through the admin interface and gives site managers direct control over homepage content.

## Technical Implementation Notes

The recommendation system has several notable technical aspects:

1. **Hybrid Approach** - Combines engagement metrics (views, likes) with recency factors
2. **Time-Based Windows**: Different time windows (7 days for views, 6 months for likes) balance recent popularity with sustained value
3. **Caching Strategy** - Results are cached to improve performance and reduce database load
4. **Transparent Algorithms** - Uses straightforward, explainable algorithms rather than black-box ML approaches
5. **Customizable Strategy** - Site administrators can choose between related content strategies
6. **Manual Override** - Featured content functionality allows for editorial control

## Customizing Recommendation Behavior

To modify the recommendation behavior, you can adjust these settings:

1. Adjust the time windows in `get_list_of_popular_media` to change how far back the system looks for popular content
2. Modify the `RELATED_MEDIA_STRATEGY` setting to change the default approach to related content
3. Change the limit parameters in `show_related_media` to control how many related videos appear
4. Add new criteria to the `order_criteria` list to change how generic videos are sorted

These settings allow platform administrators to fine-tune the recommendation experience based on their specific community needs.

## Conclusion

Cinemata's recommendation system employs a pragmatic blend of engagement metrics, recency factors, and manual curation. This approach prioritizes transparency and simplicity while still providing relevant content recommendations to users. By understanding these algorithms, developers can better customize the platform and administrators can make informed decisions about content promotion.
