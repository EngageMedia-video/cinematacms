import { useQuery } from '@tanstack/react-query';

export const GLOBAL_SEARCH_LIMIT = 4;
const MIN_QUERY_LENGTH = 2;

async function fetchJson(url, signal) {
	const response = await fetch(url, { signal, credentials: 'same-origin' });
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json();
}

function normalizeListPayload(payload) {
	if (Array.isArray(payload)) {
		return { results: payload, count: payload.length };
	}
	if (payload && Array.isArray(payload.results)) {
		return { results: payload.results, count: payload.count ?? payload.results.length };
	}
	return { results: [], count: 0 };
}

function buildUrl(base, params) {
	const search = new URLSearchParams(params);
	return `${base}?${search.toString()}`;
}

export function useGlobalSearch(query) {
	const trimmed = (query || '').trim();
	const enabled = trimmed.length >= MIN_QUERY_LENGTH;

	const videos = useQuery({
		queryKey: ['global-search', 'videos', trimmed],
		enabled,
		queryFn: async ({ signal }) => {
			const data = await fetchJson(
				buildUrl('/api/v1/search', { q: trimmed, media_type: 'video', page_size: GLOBAL_SEARCH_LIMIT }),
				signal
			);
			return normalizeListPayload(data);
		},
	});

	const playlists = useQuery({
		queryKey: ['global-search', 'playlists', trimmed],
		enabled,
		queryFn: async ({ signal }) => {
			const data = await fetchJson(
				buildUrl('/api/v1/playlists', { search: trimmed, page_size: GLOBAL_SEARCH_LIMIT }),
				signal
			);
			return normalizeListPayload(data);
		},
	});

	const members = useQuery({
		queryKey: ['global-search', 'members', trimmed],
		enabled,
		queryFn: async ({ signal }) => {
			const data = await fetchJson(
				buildUrl('/api/v1/users', { search: trimmed, page_size: GLOBAL_SEARCH_LIMIT }),
				signal
			);
			return normalizeListPayload(data);
		},
	});

	function trimSection(queryResult) {
		const { results, count } = queryResult.data ?? { results: [], count: 0 };
		return {
			items: results.slice(0, GLOBAL_SEARCH_LIMIT),
			hasMore: count > GLOBAL_SEARCH_LIMIT,
			isLoading: queryResult.isLoading,
			isError: queryResult.isError,
		};
	}

	const videoSection = trimSection(videos);
	const playlistSection = trimSection(playlists);
	const memberSection = trimSection(members);

	const isLoading = enabled && (videos.isLoading || playlists.isLoading || members.isLoading);
	const isError = videos.isError && playlists.isError && members.isError;
	const totalResults = videoSection.items.length + playlistSection.items.length + memberSection.items.length;
	const anySectionErrored = videos.isError || playlists.isError || members.isError;
	const isEmpty = enabled && !isLoading && !anySectionErrored && totalResults === 0;

	return {
		enabled,
		isLoading,
		isError,
		isEmpty,
		videos: videoSection,
		playlists: playlistSection,
		members: memberSection,
	};
}
