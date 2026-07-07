import { QueryClient } from '@tanstack/react-query';

const commentsQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
	},
});

export default commentsQueryClient;
