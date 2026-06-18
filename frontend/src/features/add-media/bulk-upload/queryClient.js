import { QueryClient } from '@tanstack/react-query';

const bulkUploadQueryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 },
	},
});

export default bulkUploadQueryClient;
