import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaylistPage } from './PlaylistPage';

const query = vi.hoisted(() => ({ data: null }));

vi.mock('../hooks/usePlaylistQuery', () => ({
	usePlaylistQuery: () => ({ data: query.data, isLoading: false, isError: false }),
}));

vi.mock('../hooks/useDeletePlaylistMutation', () => ({
	useDeletePlaylistMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../static/js/mediacms/config', () => ({
	config: () => ({ member: { is: { anonymous: true } }, api: { playlists: '/api/v1/playlists' } }),
}));

vi.mock('./FilmList', () => ({ FilmList: () => null }));

const firstMedia = {
	friendly_token: 'restricted-film',
	title: 'Restricted film',
	url: '/view?m=restricted-film',
	thumbnail_url: '/media/original/thumbnails/user/owner/restricted.jpg',
	views: 0,
};

function playlist(overrides) {
	return {
		title: 'Visibility',
		user: 'owner',
		add_date: '2026-10-01T00:00:00Z',
		media_count: 1,
		composite_thumbnail_url: null,
		thumbnail_url: null,
		playlist_media: [firstMedia],
		...overrides,
	};
}

function coverImage(container) {
	return container.querySelector('img[alt=""][width="650"]');
}

describe('PlaylistPage cover', () => {
	beforeEach(() => {
		window.MediaCMS = { playlistId: 'pl-token' };
		window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
	});

	afterEach(() => {
		delete window.MediaCMS;
		delete window.matchMedia;
	});

	it.each([
		[
			'composite',
			{ composite_thumbnail_url: '/media/composite_thumbnails/pl-token.jpg' },
			'/media/composite_thumbnails/pl-token.jpg',
		],
		[
			'viewer cover',
			{ thumbnail_url: '/media/original/thumbnails/user/owner/public.jpg' },
			'/media/original/thumbnails/user/owner/public.jpg',
		],
	])('shows the %s the API selected', (_label, overrides, src) => {
		query.data = playlist(overrides);

		const { container } = render(<PlaylistPage />);

		expect(coverImage(container)).toHaveAttribute('src', src);
	});

	it('shows the placeholder instead of a listed item when the API has no cover', () => {
		query.data = playlist();

		const { container } = render(<PlaylistPage />);

		expect(coverImage(container)).toBeNull();
		expect(screen.getByText('No playlist cover')).toBeInTheDocument();
	});
});
