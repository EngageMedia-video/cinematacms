import { QueryClient } from '@tanstack/react-query';

const homeQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 120_000, refetchOnWindowFocus: false },
	},
});

export const HOME_QUERY_KEYS = {
	featured: ['home', 'featured'],
	recommended: ['home', 'recommended'],
	category: (playlistId) => ['home', 'category', playlistId],
};

export default homeQueryClient;
