import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../shared/utils/api';
import { playlistQueryKey } from './usePlaylistQuery';
import { getPlaylistApiUrl } from '../utils/playlist';

// Takes only the fields that changed ({ title?, description? }). A partial
// update leaves the other field as stored, so a concurrent edit of it is
// never overwritten with this dialog's stale copy.
export function usePlaylistUpdateMutation(token, config) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (changes) => {
			const response = await apiFetch(getPlaylistApiUrl(config, token), {
				method: 'POST',
				body: changes,
			});

			if (!response.ok) {
				throw new Error(`Failed to save playlist: ${response.status}`);
			}

			return response.json();
		},
		onMutate: async (changes) => {
			await queryClient.cancelQueries({ queryKey: playlistQueryKey(token) });
			const previous = queryClient.getQueryData(playlistQueryKey(token));

			queryClient.setQueryData(playlistQueryKey(token), (current) =>
				current ? { ...current, ...changes } : current
			);

			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playlistQueryKey(token), context.previous);
			}
		},
		onSuccess: (data) => {
			window.CinemataAnalytics?.track('playlist_update');
			queryClient.setQueryData(playlistQueryKey(token), (current) => ({ ...current, ...data }));
		},
	});
}
