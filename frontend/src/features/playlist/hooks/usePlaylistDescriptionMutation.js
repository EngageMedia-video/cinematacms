import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../shared/utils/api';
import { playlistQueryKey } from './usePlaylistQuery';
import { getPlaylistApiUrl } from '../utils/playlist';

export function usePlaylistDescriptionMutation(token, config) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ description }) => {
			// Partial update: only the description travels, so concurrent title
			// edits elsewhere are never stomped.
			const response = await apiFetch(getPlaylistApiUrl(config, token), {
				method: 'POST',
				body: { description },
			});

			if (!response.ok) {
				throw new Error(`Failed to save description: ${response.status}`);
			}

			return response.json();
		},
		onMutate: async ({ description }) => {
			await queryClient.cancelQueries({ queryKey: playlistQueryKey(token) });
			const previous = queryClient.getQueryData(playlistQueryKey(token));

			queryClient.setQueryData(playlistQueryKey(token), (current) =>
				current ? { ...current, description } : current
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
