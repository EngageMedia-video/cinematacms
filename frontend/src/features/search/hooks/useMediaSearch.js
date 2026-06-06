import { useQuery } from '@tanstack/react-query';
import { DEFAULT_SORT, MULTI_FILTER_KEYS, SEARCH_PAGE_SIZE, SINGLE_FILTER_KEYS } from '../constants';

async function fetchJson(url, signal) {
	const response = await fetch(url, { signal, credentials: 'same-origin' });
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json();
}

function appendValues(params, key, values) {
	for (const value of values || []) {
		if (value) {
			params.append(key, value);
		}
	}
}

export function hasActiveSearch({ filters = {}, query = '' }) {
	if (query.trim()) {
		return true;
	}

	return [...MULTI_FILTER_KEYS, ...SINGLE_FILTER_KEYS].some((key) => {
		const value = filters[key];
		return Array.isArray(value) ? value.length > 0 : Boolean(value);
	});
}

export function buildMediaSearchUrl({
	filters = {},
	page = 1,
	pageSize = SEARCH_PAGE_SIZE,
	query = '',
	sort = DEFAULT_SORT,
}) {
	const params = new URLSearchParams();
	const trimmedQuery = query.trim();

	if (trimmedQuery) {
		params.set('q', trimmedQuery);
	}

	for (const key of MULTI_FILTER_KEYS) {
		appendValues(params, key, filters[key]);
	}

	for (const key of SINGLE_FILTER_KEYS) {
		if (filters[key]) {
			params.set(key, filters[key]);
		}
	}

	const sortField = sort.popularity || 'title';
	const sortOrdering = sort.popularity ? 'desc' : sort.ordering === 'asc' ? 'asc' : 'desc';
	params.set('sort_by', sortField);
	params.set('ordering', sortOrdering);
	params.set('page', String(page));
	params.set('page_size', String(pageSize));

	return `/api/v1/search?${params.toString()}`;
}

export function useMediaSearch({ filters, page, query, sort }) {
	const enabled = hasActiveSearch({ filters, query });
	const url = buildMediaSearchUrl({ filters, page, query, sort });

	return useQuery({
		queryKey: ['search', 'media', { filters, page, query, sort }],
		enabled,
		queryFn: ({ signal }) => fetchJson(url, signal),
	});
}
