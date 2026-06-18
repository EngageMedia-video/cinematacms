import { QueryClient } from '@tanstack/react-query';

const singleUploadQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 },
	},
});

export default singleUploadQueryClient;
