import { useQuery } from '@tanstack/react-query';

export function useNotificationPreferences() {
	return useQuery({
		queryKey: ['notification-preferences'],
		queryFn: async () => {
			const r = await fetch('/api/v1/notifications/preferences/');
			if (!r.ok) throw new Error(`Failed to fetch notification preferences: ${r.status}`);
			return r.json();
		},
	});
}
