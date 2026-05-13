import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function useCategoryMedia(playlistId) {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.category(playlistId),
		queryFn: async () => {
			const r = await fetch(`/api/v1/playlists/${playlistId}`);
			if (!r.ok) throw new Error(`Failed to fetch playlist media: ${r.status}`);
			return r.json();
		},
		enabled: Boolean(playlistId),
	});
}
