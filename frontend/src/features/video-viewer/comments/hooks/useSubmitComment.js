import { useMutation, useQueryClient } from '@tanstack/react-query';
import getCSRFToken from '../../../../static/js/functions/getCSRFToken';
import { commentsQueryKey } from './useComments';

export function useSubmitComment(friendlyToken) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (text) => {
			if (typeof friendlyToken !== 'string' || friendlyToken === '') {
				throw new Error('Cannot submit comment: missing media token.');
			}
			const r = await fetch(`/api/v1/media/${encodeURIComponent(friendlyToken)}/comments`, {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'X-CSRFToken': getCSRFToken() ?? '',
				},
				body: JSON.stringify({ text }),
			});
			if (!r.ok) {
				let detail = '';
				try {
					const body = await r.json();
					detail = body?.detail || body?.text?.[0] || '';
				} catch {}
				throw new Error(detail || `Failed to submit comment: ${r.status}`);
			}
			return r.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commentsQueryKey(friendlyToken) });
		},
	});
}
