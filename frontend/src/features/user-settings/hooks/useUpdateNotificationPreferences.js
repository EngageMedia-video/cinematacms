import { useMutation, useQueryClient } from '@tanstack/react-query';
import getCSRFToken from '../../../static/js/functions/getCSRFToken';

export function useUpdateNotificationPreferences() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (patch) => {
			const r = await fetch('/api/v1/notifications/preferences/', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': getCSRFToken(),
				},
				body: JSON.stringify(patch),
			});
			if (!r.ok) {
				// Parse JSON error body when possible; otherwise fall back to a
				// generic message so Django DEBUG=True HTML stack traces aren't
				// rendered into the form.
				let detail = 'Server error';
				try {
					const body = await r.json();
					// `||` not `??`: empty strings must fall through to the
					// default so we never render `Failed to update (400): `.
					detail = body.detail || Object.values(body).flat().join(', ') || detail;
				} catch {
					// Non-JSON response — leave the generic message in place.
				}
				throw new Error(`Failed to update preferences (${r.status}): ${detail}`);
			}
			return r.json();
		},
		onSuccess: (data) => {
			queryClient.setQueryData(['notification-preferences'], data);
		},
	});
}
