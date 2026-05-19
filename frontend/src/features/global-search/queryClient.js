import { QueryClient } from '@tanstack/react-query';

const globalSearchQueryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60_000,
			gcTime: 5 * 60_000,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

export default globalSearchQueryClient;
