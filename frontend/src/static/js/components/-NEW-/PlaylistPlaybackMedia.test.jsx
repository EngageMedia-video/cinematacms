import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../pages/_PageStore.js', () => ({
	default: {
		get: (key) => {
			if ('config-site' === key) return { url: 'https://cinemata.example/' };
			if ('config-media-item' === key) return { displayViews: true, displayCategories: true };
			return null;
		},
		on: vi.fn(),
		removeListener: vi.fn(),
	},
}));

vi.mock('../../mediacms/config.js', () => ({
	config: () => ({ url: { home: '', search: {} }, api: {}, site: { url: 'https://cinemata.example/' } }),
}));

import { PlaylistPlaybackMedia } from './PlaylistPlaybackMedia';

// The fields the playlist API returns for each item in `playlist_media`.
const playlistItem = {
	friendly_token: 'next1',
	title: 'Next Film',
	url: 'https://cinemata.example/view?m=next1',
	thumbnail_url: 'https://cinemata.example/media/thumb.jpg',
	media_type: 'video',
	user: 'alice',
	author_name: 'Alice Author',
	author_profile: 'https://cinemata.example/user/alice',
	duration: 60,
	views: 3,
	add_date: '2026-01-01T00:00:00Z',
	description: '',
};

describe('PlaylistPlaybackMedia', () => {
	// #496: the author name used to sit inside the item's media link.
	it("links an item's author name to the author's profile and its title to the media", async () => {
		render(<PlaylistPlaybackMedia items={[playlistItem]} playlistActiveItem={1} />);

		expect(await screen.findByRole('link', { name: 'Alice Author' })).toHaveAttribute(
			'href',
			'https://cinemata.example/user/alice'
		);
		expect(screen.getByRole('link', { name: 'Next Film' })).toHaveAttribute(
			'href',
			'https://cinemata.example/view?m=next1'
		);
	});
});
