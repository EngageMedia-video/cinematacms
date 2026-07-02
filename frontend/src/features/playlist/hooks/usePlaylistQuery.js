import { useQuery } from '@tanstack/react-query';
import { getPlaylistApiUrl } from '../utils/playlist';

export function playlistQueryKey(token) {
	return ['playlist', token];
}

export function usePlaylistQuery(token, config) {
	return useQuery({
		queryKey: playlistQueryKey(token),
		enabled: Boolean(token),
		queryFn: async ({ signal }) => {
			const response = await fetch(getPlaylistApiUrl(config, token), {
				credentials: 'same-origin',
				headers: { Accept: 'application/json' },
				signal,
			});

			if (!response.ok) {
				throw new Error(`Failed to load playlist: ${response.status}`);
			}

			return response.json();
		},
	});
}
