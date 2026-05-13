import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function usePlaylistMedia(apiUrl) {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.playlistMedia(apiUrl),
		queryFn: async () => {
			const r = await fetch(apiUrl);
			if (!r.ok) throw new Error(`Failed to fetch playlist media: ${r.status}`);
			return r.json();
		},
		enabled: Boolean(apiUrl),
	});
}
