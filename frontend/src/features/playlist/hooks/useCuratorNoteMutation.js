import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../shared/utils/api';
import { playlistQueryKey } from './usePlaylistQuery';
import { getPlaylistApiUrl } from '../utils/playlist';

export function useCuratorNoteMutation(token, config) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ playlist, curatorNote }) => {
			const response = await apiFetch(getPlaylistApiUrl(config, token), {
				method: 'POST',
				body: {
					title: playlist.title,
					description: playlist.description || '',
					curator_note: curatorNote,
				},
			});

			if (!response.ok) {
				throw new Error(`Failed to save curator note: ${response.status}`);
			}

			return response.json();
		},
		onMutate: async ({ curatorNote }) => {
			await queryClient.cancelQueries({ queryKey: playlistQueryKey(token) });
			const previous = queryClient.getQueryData(playlistQueryKey(token));

			queryClient.setQueryData(playlistQueryKey(token), (current) =>
				current ? { ...current, curator_note: curatorNote } : current
			);

			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playlistQueryKey(token), context.previous);
			}
		},
		onSuccess: (data) => {
			queryClient.setQueryData(playlistQueryKey(token), (current) => ({ ...current, ...data }));
		},
	});
}
