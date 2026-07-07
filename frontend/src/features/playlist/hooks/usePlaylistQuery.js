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
				const error = new Error(`Failed to load playlist: ${response.status}`);
				error.status = response.status;
				throw error;
			}

			return response.json();
		},
		retry: (failureCount, error) => {
			if (error?.status >= 400 && error?.status < 500) {
				return false;
			}
			return failureCount < 1;
		},
	});
}
