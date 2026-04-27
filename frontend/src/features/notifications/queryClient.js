import { QueryClient } from '@tanstack/react-query';

const notificationQueryClient = new QueryClient({
	defaultOptions: {
		// refetchOnWindowFocus is false here to avoid unnecessary refetches
		// on the notifications list. useUnreadCount intentionally overrides
		// this to true so the badge updates immediately on tab focus.
		queries: { staleTime: 30_000, refetchOnWindowFocus: false },
	},
});

export default notificationQueryClient;
