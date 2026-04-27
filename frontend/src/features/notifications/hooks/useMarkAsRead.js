import { useMutation, useQueryClient } from '@tanstack/react-query';
import getCSRFToken from '../../../static/js/functions/getCSRFToken';

export function useMarkAsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id) => {
			const r = await fetch(`/api/v1/notifications/${id}/read/`, {
				method: 'PATCH',
				headers: { 'X-CSRFToken': getCSRFToken() },
			});
			if (!r.ok) throw new Error(`Failed to mark notification as read: ${r.status}`);
			return r.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notifications'] });
		},
	});
}
