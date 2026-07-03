import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getJsonHeaders, getPrivateJournalUrl, privateJournalQueryKey } from './api';

export function useUpdatePrivateJournalNote(friendlyToken) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ uid, text }) => {
			if (typeof friendlyToken !== 'string' || friendlyToken === '') {
				throw new Error('Cannot update private journal note: missing media token.');
			}
			if (typeof uid !== 'string' || uid === '') {
				throw new Error('Cannot update private journal note: missing note id.');
			}
			const response = await fetch(getPrivateJournalUrl(friendlyToken, uid), {
				method: 'PATCH',
				credentials: 'same-origin',
				headers: getJsonHeaders(),
				body: JSON.stringify({ text }),
			});
			if (!response.ok) {
				throw new Error(`Failed to update private journal note: ${response.status}`);
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: privateJournalQueryKey(friendlyToken) });
		},
	});
}
