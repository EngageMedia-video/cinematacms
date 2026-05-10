import { QueryClient } from '@tanstack/react-query';

const homeQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 60_000, refetchOnWindowFocus: false },
	},
});

export default homeQueryClient;
