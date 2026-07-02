import { useMutation, useQueryClient } from '@tanstack/react-query';
import getCSRFToken from '../../../../static/js/functions/getCSRFToken';
import { commentsQueryKey } from './useComments';

export function useDeleteComment(friendlyToken) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (uid) => {
			if (typeof friendlyToken !== 'string' || friendlyToken === '') {
				throw new Error('Cannot delete comment: missing media token.');
			}
			if (typeof uid !== 'string' || uid === '') {
				throw new Error('Cannot delete comment: missing comment id.');
			}
			const r = await fetch(
				`/api/v1/media/${encodeURIComponent(friendlyToken)}/comments/${encodeURIComponent(uid)}`,
				{
					method: 'DELETE',
					credentials: 'same-origin',
					headers: { 'X-CSRFToken': getCSRFToken() ?? '' },
				}
			);
			if (!r.ok && r.status !== 204) {
				throw new Error(`Failed to delete comment: ${r.status}`);
			}
			return uid;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commentsQueryKey(friendlyToken) });
		},
	});
}
