import { useQuery } from '@tanstack/react-query';
import { PROFILE_QUERY_KEYS } from '../queryClient';

// /api/v1/media uses DRF's plain PageNumberPagination (page_size=50, no
// page_size_query_param), so a single fetch silently truncates larger
// catalogs. MediaSection renders the full grid with no pagination UI, so
// follow `next` links until the catalog is fully loaded.
const MAX_PAGES = 20;

export async function fetchAllPages(url, signal) {
	const results = [];
	let nextUrl = url;
	let pageCount = 0;

	while (nextUrl && pageCount < MAX_PAGES) {
		const response = await fetch(nextUrl, { credentials: 'same-origin', signal });
		if (!response.ok) {
			throw new Error(`Failed to fetch ${nextUrl}: ${response.status}`);
		}
		const page = await response.json();
		results.push(...(Array.isArray(page?.results) ? page.results : []));
		nextUrl = page?.next || '';
		pageCount += 1;
	}

	// Hitting the page cap on a prolific author should not blank the whole tab.
	// Return the partial catalog and flag the truncation so the UI can say so.
	return { results, truncated: Boolean(nextUrl) };
}

export function useAuthorMedia(username) {
	const url = username ? `/api/v1/media?author=${encodeURIComponent(username)}` : '';

	return useQuery({
		queryKey: PROFILE_QUERY_KEYS.media(username),
		enabled: Boolean(url),
		queryFn: ({ signal }) => fetchAllPages(url, signal),
	});
}
