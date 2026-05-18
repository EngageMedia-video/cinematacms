import { QueryClient } from '@tanstack/react-query';

export const HOME_QUERY_STALE_TIME_MS = 120_000;

const homeQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: HOME_QUERY_STALE_TIME_MS, refetchOnWindowFocus: false },
	},
});

export const HOME_QUERY_KEYS = {
	featured: ['home', 'featured'],
	recommended: ['home', 'recommended'],
	recent: ['home', 'recent'],
	heroDetail: (apiUrl) => ['home', 'hero-detail', apiUrl],
	indexFeatured: ['home', 'index-featured'],
	playlistMedia: (apiUrl) => ['home', 'playlist-media', apiUrl],
};

export default homeQueryClient;
