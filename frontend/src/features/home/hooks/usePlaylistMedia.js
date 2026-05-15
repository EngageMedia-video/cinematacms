import { useQuery } from '@tanstack/react-query';
import { HOME_QUERY_KEYS } from '../queryClient';

export function usePlaylistMedia(apiUrl) {
	return useQuery({
		queryKey: HOME_QUERY_KEYS.playlistMedia(apiUrl),
		queryFn: async () => {
			const response = await fetch(apiUrl);
			if (!response.ok) throw new Error(`Failed to fetch ${apiUrl}: ${response.status}`);
			return response.json();
		},
		enabled: Boolean(apiUrl),
	});
}
