import { useQuery } from '@tanstack/react-query';

export function useNotifications({ pageSize = 10, page = 1, type, is_read } = {}) {
	const params = new URLSearchParams({ page_size: pageSize, page });
	if (type) params.set('type', type);
	if (is_read !== undefined) params.set('is_read', String(is_read));

	return useQuery({
		queryKey: ['notifications', { pageSize, page, type, is_read }],
		queryFn: async () => {
			const r = await fetch(`/api/v1/notifications/?${params}`);
			if (!r.ok) throw new Error(`Failed to fetch notifications: ${r.status}`);
			return r.json();
		},
	});
}
