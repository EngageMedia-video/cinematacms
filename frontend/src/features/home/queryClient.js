import { QueryClient } from '@tanstack/react-query';

const homeQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 120_000, refetchOnWindowFocus: false },
	},
});

export const HOME_QUERY_KEYS = {
	featured: ['home', 'featured'],
	recommended: ['home', 'recommended'],
	recent: ['home', 'recent'],
	indexFeatured: ['home', 'index-featured'],
	playlistMedia: (apiUrl) => ['home', 'playlist-media', apiUrl],
};

export default homeQueryClient;
