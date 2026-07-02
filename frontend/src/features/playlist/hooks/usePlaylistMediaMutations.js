import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../shared/utils/api';
import { getPlaylistApiUrl, moveItem } from '../utils/playlist';
import { playlistQueryKey } from './usePlaylistQuery';

async function updateMediaOrder(config, token, media) {
	const playlistUrl = getPlaylistApiUrl(config, token);

	for (let index = 0; index < media.length; index += 1) {
		const item = media[index];
		const response = await apiFetch(playlistUrl, {
			method: 'PUT',
			body: {
				type: 'ordering',
				media_friendly_token: item.friendly_token,
				ordering: index + 1,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to reorder playlist media: ${response.status}`);
		}
	}
}

export function useReorderPlaylistMediaMutation(token, config) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ media }) => {
			await updateMediaOrder(config, token, media);
			return media;
		},
		onMutate: async ({ media }) => {
			await queryClient.cancelQueries({ queryKey: playlistQueryKey(token) });
			const previous = queryClient.getQueryData(playlistQueryKey(token));

			queryClient.setQueryData(playlistQueryKey(token), (current) =>
				current ? { ...current, playlist_media: media } : current
			);

			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playlistQueryKey(token), context.previous);
			}
		},
		onSuccess: (media) => {
			queryClient.setQueryData(playlistQueryKey(token), (current) =>
				current ? { ...current, playlist_media: media } : current
			);
		},
		onSettled: () => {
			// The cover preview derives from the first item and the server-side
			// composite grid, so refetch after a reorder to pick both up.
			queryClient.invalidateQueries({ queryKey: playlistQueryKey(token) });
		},
	});
}

export function useMovePlaylistMediaMutation(token, config) {
	const reorderMutation = useReorderPlaylistMediaMutation(token, config);

	return {
		...reorderMutation,
		move: (media, fromIndex, toIndex) => {
			const nextMedia = moveItem(media, fromIndex, toIndex);
			if (nextMedia !== media) {
				reorderMutation.mutate({ media: nextMedia });
			}
		},
	};
}

export function useRemovePlaylistMediaMutation(token, config) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ mediaToken }) => {
			const response = await apiFetch(getPlaylistApiUrl(config, token), {
				method: 'PUT',
				body: {
					type: 'remove',
					media_friendly_token: mediaToken,
				},
			});

			if (!response.ok) {
				throw new Error(`Failed to remove playlist media: ${response.status}`);
			}

			return mediaToken;
		},
		onMutate: async ({ mediaToken }) => {
			await queryClient.cancelQueries({ queryKey: playlistQueryKey(token) });
			const previous = queryClient.getQueryData(playlistQueryKey(token));

			queryClient.setQueryData(playlistQueryKey(token), (current) =>
				current
					? {
							...current,
							playlist_media: (current.playlist_media || []).filter(
								(item) => item.friendly_token !== mediaToken
							),
						}
					: current
			);

			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playlistQueryKey(token), context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playlistQueryKey(token) });
		},
	});
}
