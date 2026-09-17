import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('./media-save/PlaylistsSelection', () => ({
	PlaylistsSelection: () => <div>Playlist picker</div>,
}));

const PRIVATE_NOTICE = "Private films can't be added to a playlist. Change this film's visibility to Public first.";

async function openSaveDialog() {
	await userEvent.click(screen.getAllByRole('button', { name: /playlist/i })[0]);
}

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

	it('opens the playlist picker for a public film', async () => {
		storeMocks.state.mediaData = { friendly_token: 'loaded-token', state: 'public' };

		render(<MediaSaveButton />);
		await openSaveDialog();

		expect(screen.getByText('Playlist picker')).toBeInTheDocument();
		expect(screen.queryByText(PRIVATE_NOTICE)).not.toBeInTheDocument();
	});

	it('explains why a private film cannot be saved instead of opening the playlist picker', async () => {
		storeMocks.state.mediaData = { friendly_token: 'loaded-token', state: 'private' };

		render(<MediaSaveButton />);
		await openSaveDialog();

		expect(screen.getByText(PRIVATE_NOTICE)).toBeInTheDocument();
		expect(screen.queryByText('Playlist picker')).not.toBeInTheDocument();
	});

	it('switches to the explanation once the media data reports a private film', async () => {
		render(<MediaSaveButton />);

		storeMocks.state.mediaData = { friendly_token: 'loaded-token', state: 'private' };
		act(() => {
			storeMocks.mediaPageStore.emit('loaded_media_data');
		});
		await openSaveDialog();

		expect(screen.getByText(PRIVATE_NOTICE)).toBeInTheDocument();
		expect(screen.queryByText('Playlist picker')).not.toBeInTheDocument();
	});

	it('closes the explanation dialog from its close button', async () => {
		storeMocks.state.mediaData = { friendly_token: 'loaded-token', state: 'private' };

		render(<MediaSaveButton />);
		await openSaveDialog();
		await userEvent.click(screen.getByRole('button', { name: 'Close' }));

		expect(screen.queryByText(PRIVATE_NOTICE)).not.toBeInTheDocument();
	});
});
