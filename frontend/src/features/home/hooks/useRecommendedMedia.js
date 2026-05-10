import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function useRecommendedMedia() {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.recommended,
		queryFn: async () => {
			const r = await fetch('/api/v1/media?show=recommended');
			if (!r.ok) throw new Error(`Failed to fetch recommended media: ${r.status}`);
			return r.json();
		},
	});
}
