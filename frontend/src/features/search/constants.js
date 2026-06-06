export const SEARCH_PAGE_SIZE = 24;

export const COMMUNITY_IMPACT_OPTIONS = [
	{ value: 'screening', label: 'Screened in' },
	{ value: 'featured', label: 'Featured in' },
	{ value: 'saves', label: 'Saves & Playlists' },
	{ value: 'academic', label: 'Academic usage' },
];

export const LENGTH_OPTIONS = [
	{ value: 'less_than_10', label: 'Less than 10 mins' },
	{ value: 'more_than_10', label: 'More than 10 mins' },
];

export const UPLOAD_DATE_OPTIONS = [
	{ value: 'today', label: 'Today' },
	{ value: 'this_week', label: 'This week' },
	{ value: 'this_month', label: 'This month' },
	{ value: 'this_year', label: 'This year' },
];

export const LICENSE_OPTIONS = [
	{ value: '5', label: 'Attribution 4.0 International' },
	{ value: '6', label: 'Attribution-ShareAlike 4.0 International' },
	{ value: '7', label: 'Attribution-NoDerivatives 4.0 International' },
	{ value: '8', label: 'Attribution-NonCommercial 4.0 International' },
	{ value: '9', label: 'Attribution-NonCommercial-ShareAlike 4.0 International' },
	{ value: '10', label: 'Attribution-NonCommercial-NoDerivatives 4.0 International' },
	{ value: 'no_license', label: 'All Rights Reserved' },
];

export const SORT_OPTIONS = [
	{ value: 'add_date', label: 'Upload date' },
	{ value: 'title', label: 'Name' },
	{ value: 'edit_date', label: 'Last updated' },
	{ value: 'views', label: 'View count' },
	{ value: 'likes', label: 'Like count' },
	{ value: 'comment_count', label: 'Most discussed' },
	{ value: 'featured_date', label: 'Most featured' },
];

// Engagement/popularity sorts only — surfaced as the rail "Popularity" section.
// The full SORT_OPTIONS list stays on the top-right Sort button (general sorting + direction).
export const POPULARITY_OPTIONS = [
	{ value: 'views', label: 'View count' },
	{ value: 'likes', label: 'Like count' },
	{ value: 'comment_count', label: 'Most discussed' },
	{ value: 'featured_date', label: 'Most featured' },
];

export const MULTI_FILTER_KEYS = ['category', 'topic', 'country', 'subtitle_language', 'license', 'community_impact'];

export const SINGLE_FILTER_KEYS = ['length', 'upload_date'];

// `popularity` = one of the POPULARITY_OPTIONS values, or null for title sort.
// `ordering` = direction for the title A-Z/Z-A toggle (only applies when popularity is null).
export const DEFAULT_SORT = {
	popularity: null,
	ordering: 'asc',
};
