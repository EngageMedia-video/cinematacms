import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaSaveButton } from './MediaSaveButton';

const storeMocks = vi.hoisted(() => {
	const listeners = new Map();
	const state = {
		mediaId: null,
		mediaData: null,
		playlists: [],
	};

	return {
		state,
		mediaPageStore: {
			get: vi.fn((key) => {
				if (key === 'media-id') return state.mediaId;
				if (key === 'media-data') return state.mediaData;
				if (key === 'playlists') return state.playlists;
				return null;
			}),
			on: vi.fn((eventName, callback) => {
				listeners.set(eventName, [...(listeners.get(eventName) || []), callback]);
			}),
			removeListener: vi.fn((eventName, callback) => {
				listeners.set(
					eventName,
					(listeners.get(eventName) || []).filter((listener) => listener !== callback)
				);
			}),
			emit(eventName) {
				(listeners.get(eventName) || []).forEach((listener) => listener());
			},
		},
		reset() {
			listeners.clear();
			state.mediaId = null;
			state.mediaData = null;
			state.playlists = [];
			this.mediaPageStore.get.mockClear();
			this.mediaPageStore.on.mockClear();
			this.mediaPageStore.removeListener.mockClear();
		},
	};
});

vi.mock('../../../../static/js/pages/MediaPage/store.js', () => ({
	default: storeMocks.mediaPageStore,
}));

vi.mock('./MediaSave/PlaylistsSelection', () => ({
	PlaylistsSelection: () => null,
}));

describe('MediaSaveButton', () => {
	beforeEach(() => {
		storeMocks.reset();
	});

	it('shows the active playlist state when the playlist contains the loaded media token', () => {
		storeMocks.state.mediaData = { friendly_token: 'loaded-token' };
		storeMocks.state.playlists = [
			{
				playlist_id: 'playlist-1',
				media_list: ['loaded-token'],
			},
		];

		render(<MediaSaveButton />);

		expect(screen.getAllByRole('button', { name: 'Added to playlist' })).toHaveLength(2);
	});

	it('syncs the active playlist state after playlists load', () => {
		storeMocks.state.mediaData = { friendly_token: 'loaded-token' };

		render(<MediaSaveButton />);
		expect(screen.getAllByRole('button', { name: 'Save to playlist' })).toHaveLength(2);

		storeMocks.state.playlists = [
			{
				playlist_id: 'playlist-1',
				media_list: ['loaded-token'],
			},
		];

		act(() => {
			storeMocks.mediaPageStore.emit('playlists_load');
		});

		expect(screen.getAllByRole('button', { name: 'Added to playlist' })).toHaveLength(2);
	});
});
