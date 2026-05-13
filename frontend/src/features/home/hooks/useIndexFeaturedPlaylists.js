import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function useIndexFeaturedPlaylists() {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.indexFeatured,
		queryFn: async () => {
			const r = await fetch('/api/v1/indexfeatured');
			if (!r.ok) throw new Error(`Failed to fetch homepage playlists: ${r.status}`);
			return r.json();
		},
	});
}
