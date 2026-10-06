import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRemovePlaylistMediaMutation, useReorderPlaylistMediaMutation } from './usePlaylistMediaMutations';

afterEach(() => {
	vi.unstubAllGlobals();
	delete window.CinemataAnalytics;
});

it.each([200, 403])('counts playlist removal only after confirmed success (%s)', async (status) => {
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	const id = '12345678-1234-4234-8234-123456789abc';
	client.setQueryData(['playlist', 'list-token'], {
		playlist_media: [{ friendly_token: 'film-token', uid: id, media_type: 'video' }],
	});
	const track = vi.fn();
	window.CinemataAnalytics = { track };
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: status === 200, status, json: async () => ({}) }))
	);
	const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	const { result } = renderHook(
		() => useRemovePlaylistMediaMutation('list-token', { api: { playlists: '/api/v1/playlists' } }),
		{ wrapper }
	);
	act(() => result.current.mutate({ mediaToken: 'film-token' }));
	await waitFor(() => expect(status === 200 ? result.current.isSuccess : result.current.isError).toBe(true));
	if (status === 200) {
		expect(track).toHaveBeenCalledExactlyOnceWith(
			'playlist_remove',
			{},
			{ id, type: 'video', context: 'playlist', revision: undefined }
		);
	} else {
		expect(track).not.toHaveBeenCalled();
	}
	client.clear();
});

it.each([200, 500])('counts one reorder only after all affected rows succeed (%s)', async (lastStatus) => {
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	const previousMedia = [{ friendly_token: 'first-token' }, { friendly_token: 'second-token' }];
	client.setQueryData(['playlist', 'list-token'], { playlist_media: previousMedia });
	const track = vi.fn();
	window.CinemataAnalytics = { track };
	const fetch = vi
		.fn()
		.mockResolvedValueOnce({ ok: true, status: 200 })
		.mockResolvedValueOnce({ ok: lastStatus === 200, status: lastStatus });
	vi.stubGlobal('fetch', fetch);
	const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	const { result } = renderHook(
		() => useReorderPlaylistMediaMutation('list-token', { api: { playlists: '/api/v1/playlists' } }),
		{ wrapper }
	);
	act(() => result.current.mutate({ media: [...previousMedia].reverse(), previousMedia }));
	await waitFor(() => expect(lastStatus === 200 ? result.current.isSuccess : result.current.isError).toBe(true));
	expect(fetch).toHaveBeenCalledTimes(2);
	if (lastStatus === 200) expect(track).toHaveBeenCalledExactlyOnceWith('playlist_reorder');
	else expect(track).not.toHaveBeenCalled();
	client.clear();
});
