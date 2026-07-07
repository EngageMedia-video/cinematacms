import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getJsonHeaders, getPrivateJournalUrl, privateJournalQueryKey } from './api';

export function useSubmitPrivateJournalNote(friendlyToken) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ text, timestampSeconds }) => {
			if (typeof friendlyToken !== 'string' || friendlyToken === '') {
				throw new Error('Cannot submit private journal note: missing media token.');
			}
			const response = await fetch(getPrivateJournalUrl(friendlyToken), {
				method: 'POST',
				credentials: 'same-origin',
				headers: getJsonHeaders(),
				body: JSON.stringify({ text, timestamp_seconds: timestampSeconds ?? 0 }),
			});
			if (!response.ok) {
				throw new Error(`Failed to submit private journal note: ${response.status}`);
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: privateJournalQueryKey(friendlyToken) });
		},
	});
}
