import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function useRecentMedia() {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.recent,
		queryFn: async () => {
			const r = await fetch('/api/v1/media?show=latest');
			if (!r.ok) throw new Error(`Failed to fetch recent media: ${r.status}`);
			return r.json();
		},
	});
}
