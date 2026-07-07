import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../shared/utils/api';
import { getPlaylistApiUrl } from '../utils/playlist';

export function useDeletePlaylistMutation(token, config) {
	return useMutation({
		mutationFn: async () => {
			const response = await apiFetch(getPlaylistApiUrl(config, token), {
				method: 'DELETE',
			});

			if (!response.ok) {
				throw new Error(`Failed to delete playlist: ${response.status}`);
			}
		},
		onSuccess: () => {
			window.location.assign(config?.url?.profile?.playlists || config?.site?.url || '/');
		},
	});
}
