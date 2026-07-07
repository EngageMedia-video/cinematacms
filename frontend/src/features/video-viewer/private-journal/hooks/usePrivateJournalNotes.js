import { useQuery } from '@tanstack/react-query';
import { getPrivateJournalUrl, privateJournalQueryKey } from './api';

async function fetchPrivateJournalPage(url) {
	const response = await fetch(url, {
		headers: { Accept: 'application/json' },
		credentials: 'same-origin',
	});
	if (!response.ok) {
		throw new Error(`Failed to load private journal notes: ${response.status}`);
	}
	return response.json();
}

export function usePrivateJournalNotes(friendlyToken, { enabled = true } = {}) {
	return useQuery({
		queryKey: privateJournalQueryKey(friendlyToken),
		enabled: enabled && !!friendlyToken,
		queryFn: async () => {
			const results = [];
			let count = 0;
			let nextUrl = getPrivateJournalUrl(friendlyToken);

			while (nextUrl) {
				const data = await fetchPrivateJournalPage(nextUrl);

				if (Array.isArray(data)) {
					results.push(...data);
					count = results.length;
					break;
				}

				const pageResults = Array.isArray(data?.results) ? data.results : [];
				results.push(...pageResults);
				count = typeof data?.count === 'number' ? data.count : results.length;
				nextUrl = data?.next || '';
			}

			return {
				results,
				count,
			};
		},
	});
}
