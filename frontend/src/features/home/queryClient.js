import { QueryClient } from '@tanstack/react-query';

const homeQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 60_000, refetchOnWindowFocus: false },
	},
});

export const HOME_QUERY_KEYS = {
	featured: ['home', 'featured'],
	recommended: ['home', 'recommended'],
};

export default homeQueryClient;
