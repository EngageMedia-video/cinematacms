import { useQuery } from '@tanstack/react-query';

export function useUnreadCount() {
	return useQuery({
		queryKey: ['notifications', 'unread-count'],
		queryFn: async () => {
			const r = await fetch('/api/v1/notifications/unread-count/');
			if (!r.ok) throw new Error(`Failed to fetch unread count: ${r.status}`);
			return r.json();
		},
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
		// Override the shared queryClient default (false) so the badge
		// refreshes immediately when the user switches back to this tab.
		refetchOnWindowFocus: true,
	});
}
