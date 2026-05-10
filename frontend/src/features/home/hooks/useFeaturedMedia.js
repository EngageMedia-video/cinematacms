import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function useFeaturedMedia() {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.featured,
		queryFn: async () => {
			const r = await fetch('/api/v1/media?show=featured');
			if (!r.ok) throw new Error(`Failed to fetch featured media: ${r.status}`);
			return r.json();
		},
	});
}
