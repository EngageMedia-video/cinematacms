import { QueryClient } from '@tanstack/react-query';

const privateJournalQueryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 30000, refetchOnWindowFocus: false } },
});

export default privateJournalQueryClient;
