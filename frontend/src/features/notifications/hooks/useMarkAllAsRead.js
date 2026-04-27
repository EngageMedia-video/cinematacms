import { useMutation, useQueryClient } from '@tanstack/react-query';
import getCSRFToken from '../../../static/js/functions/getCSRFToken';

export function useMarkAllAsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const r = await fetch('/api/v1/notifications/mark-all-read/', {
				method: 'PATCH',
				headers: { 'X-CSRFToken': getCSRFToken() },
			});
			if (!r.ok) throw new Error(`Failed to mark all notifications as read: ${r.status}`);
			return r.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notifications'] });
		},
	});
}
