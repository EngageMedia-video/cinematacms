import { QueryClient } from '@tanstack/react-query';

const playlistQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
	},
});

export default playlistQueryClient;
