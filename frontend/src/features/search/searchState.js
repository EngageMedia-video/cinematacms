import { DEFAULT_SORT, MULTI_FILTER_KEYS, SINGLE_FILTER_KEYS } from './constants';

export function createEmptyFilters() {
	return {
		category: [],
		topic: [],
		country: [],
		subtitle_language: [],
		license: [],
		community_impact: [],
		length: '',
		upload_date: '',
	};
}

function getAll(searchParams, key, legacyKey) {
	const values = searchParams.getAll(key);
	if (legacyKey) {
		values.push(...searchParams.getAll(legacyKey));
	}
	return values.filter(Boolean);
}

export function parseSearchState(search = '') {
	const searchParams = new URLSearchParams(search);
	const filters = createEmptyFilters();

	for (const key of MULTI_FILTER_KEYS) {
		filters[key] = getAll(searchParams, key, key === 'category' ? 'c' : key === 'tag' ? 't' : '');
	}

	for (const key of SINGLE_FILTER_KEYS) {
		filters[key] = searchParams.get(key) || '';
	}

	const sortBy = searchParams.get('sort_by') || '';
	const POPULARITY_FIELDS = ['views', 'likes', 'comment_count', 'featured_date'];
	return {
		filters,
		page: Number(searchParams.get('page')) || 1,
		query: searchParams.get('q') || '',
		sort: {
			popularity: POPULARITY_FIELDS.includes(sortBy) ? sortBy : null,
			ordering: searchParams.get('ordering') === 'desc' ? 'desc' : 'asc',
		},
	};
}

export function buildBrowserSearch({ filters, page, query, sort }) {
	const params = new URLSearchParams();

	if (query.trim()) {
		params.set('q', query.trim());
	}

	for (const key of MULTI_FILTER_KEYS) {
		for (const value of filters[key] || []) {
			params.append(key, value);
		}
	}

	for (const key of SINGLE_FILTER_KEYS) {
		if (filters[key]) {
			params.set(key, filters[key]);
		}
	}

	if (sort.popularity) {
		params.set('sort_by', sort.popularity);
	}
	if (sort.ordering === 'desc') {
		params.set('ordering', 'desc');
	}
	if (page > 1) {
		params.set('page', String(page));
	}

	const serialized = params.toString();
	return serialized ? `?${serialized}` : window.location.pathname;
}

export function toggleFilterValue(filters, key, value, checked) {
	const nextFilters = { ...filters };

	if (Array.isArray(filters[key])) {
		const currentValues = new Set(filters[key]);
		if (checked) {
			currentValues.add(value);
		} else {
			currentValues.delete(value);
		}
		nextFilters[key] = [...currentValues];
		return nextFilters;
	}

	nextFilters[key] = checked ? value : '';
	return nextFilters;
}

export function clearFilterValue(filters, key, value) {
	return toggleFilterValue(filters, key, value, false);
}
