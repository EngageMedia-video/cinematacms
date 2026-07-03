import { useQuery } from '@tanstack/react-query';
import { getPrivateJournalUrl, privateJournalQueryKey } from './api';

export function usePrivateJournalNotes(friendlyToken, { enabled = true } = {}) {
	return useQuery({
		queryKey: privateJournalQueryKey(friendlyToken),
		enabled: enabled && !!friendlyToken,
		queryFn: async () => {
			const response = await fetch(getPrivateJournalUrl(friendlyToken), {
				headers: { Accept: 'application/json' },
				credentials: 'same-origin',
			});
			if (!response.ok) {
				throw new Error(`Failed to load private journal notes: ${response.status}`);
			}
			const data = await response.json();
			const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
			return {
				results,
				count: typeof data?.count === 'number' ? data.count : results.length,
			};
		},
	});
}
