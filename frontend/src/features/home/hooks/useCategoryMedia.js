import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function useCategoryMedia(searchTerm) {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.category(searchTerm),
		queryFn: async () => {
			const r = await fetch(`/api/v1/search?c=${encodeURIComponent(searchTerm)}`);
			if (!r.ok) throw new Error(`Failed to fetch category media: ${r.status}`);
			return r.json();
		},
		enabled: Boolean(searchTerm),
	});
}
