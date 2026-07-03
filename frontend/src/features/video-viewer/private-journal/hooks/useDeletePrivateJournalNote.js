import { useMutation, useQueryClient } from '@tanstack/react-query';
import getCSRFToken from '../../../../static/js/functions/getCSRFToken';
import { getPrivateJournalUrl, privateJournalQueryKey } from './api';

export function useDeletePrivateJournalNote(friendlyToken) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (uid) => {
			if (typeof friendlyToken !== 'string' || friendlyToken === '') {
				throw new Error('Cannot delete private journal note: missing media token.');
			}
			if (typeof uid !== 'string' || uid === '') {
				throw new Error('Cannot delete private journal note: missing note id.');
			}
			const response = await fetch(getPrivateJournalUrl(friendlyToken, uid), {
				method: 'DELETE',
				credentials: 'same-origin',
				headers: { 'X-CSRFToken': getCSRFToken() ?? '' },
			});
			if (!response.ok && response.status !== 204) {
				throw new Error(`Failed to delete private journal note: ${response.status}`);
			}
			return uid;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: privateJournalQueryKey(friendlyToken) });
		},
	});
}
