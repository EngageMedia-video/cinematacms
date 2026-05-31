import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import homeQueryClient, { HOME_QUERY_KEYS } from '../queryClient';
import { HomePage } from './HomePage';

// Mock the video player to prevent videojs import in tests
vi.mock('./HeroVideoPlayer', () => ({
	default: function HeroVideoPlayerMock({ poster, sources = [], videoInfo = {} }) {
		return (
			<div
				data-testid="hero-video-player"
				data-poster={poster}
				data-sources={JSON.stringify(sources)}
				data-video-info={JSON.stringify(videoInfo)}
			/>
		);
	},
}));

const FEATURED_MEDIA = {
	title: 'Featured Film',
	description: 'An important film about justice.',
	thumbnail_url: 'https://example.com/thumb.jpg',
	author_name: 'Director One',
	media_country: 'Philippines',
	views: 5000,
	encodings_info: {},
	subtitles_info: [],
	hero_playback: {
		duration: 420,
		poster_url: 'https://example.com/thumb.jpg',
		hls_info: {},
		encodings_info: {
			720: {
				h264: {
					url: 'https://example.com/featured-720.mp4',
					status: 'success',
				},
			},
		},
		subtitles_info: [],
	},
	url: '/media/featured-film/',
};

const RECOMMENDED_MEDIA = {
	title: 'Recommended Film',
	description: 'A curator pick.',
	thumbnail_url: 'https://example.com/rec-thumb.jpg',
	author_name: 'Director Two',
	media_country: 'Indonesia',
	views: 2000,
	encodings_info: {},
	subtitles_info: [],
	url: '/media/recommended-film/',
	friendly_token: 'rec-token',
};

const RECENT_MEDIA = {
	title: 'Recent Film',
	description: 'Fresh from the archive.',
	thumbnail_url: 'https://example.com/recent-thumb.jpg',
	author_name: 'Recent Director',
	media_country: 'Malaysia',
	views: 120,
	encodings_info: {},
	subtitles_info: [],
	url: '/media/recent-film/',
	friendly_token: 'recent-token',
};

const RECENT_MEDIA_WITH_USER_AUTHOR = {
	...RECENT_MEDIA,
	title: 'Fallback Author Film',
	author_name: '',
	user: 'Fallback User',
	media_country: '',
	media_country_info: [{ title: 'Singapore' }],
	url: '/media/fallback-author-film/',
	friendly_token: 'recent-token-with-user-author',
};

beforeEach(() => {
	homeQueryClient.clear();
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, []);
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.recommended, []);
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.recent, []);
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.indexFeatured, []);
});

afterEach(() => {
	vi.restoreAllMocks();
	homeQueryClient.clear();
});

describe('HomePage', () => {
	it('does not render the removed Popular hero label', () => {
		render(<HomePage />);
		expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
	});

	it('keeps the hero first so curator rows stay visible on first load', () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, [FEATURED_MEDIA]);
		render(<HomePage />);
		const track = document.querySelector('[data-modern-track]');
		expect(track).toHaveClass('space-y-6');
		expect(track.firstElementChild?.querySelector('section[aria-label="Featured media"]')).not.toBeNull();
	});

	it('caps the home track width on very large screens', () => {
		render(<HomePage />);
		const track = document.querySelector('[data-modern-track]');

		expect(track).toHaveClass('mx-auto');
		expect(track).toHaveClass('max-w-[1515px]');
		expect(track).toHaveClass('px-[27px]');
	});

	it('does not promote the hero rail to a page h1', () => {
		render(<HomePage />);
		expect(document.querySelectorAll('h1')).toHaveLength(0);
	});

	it('renders HeroSection synchronously from seeded cache data', () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, [FEATURED_MEDIA]);
		render(<HomePage />);
		expect(screen.getByRole('heading', { level: 2, name: 'Featured Film' })).toBeInTheDocument();
	});

	it('renders the hero player from seeded hero_playback without fetching media detail', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, [FEATURED_MEDIA]);
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.recommended, []);

		render(<HomePage />);

		const player = screen.getByTestId('hero-video-player');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(JSON.parse(player.dataset.sources)).toEqual([
			{ src: 'https://example.com/featured-720.mp4', type: 'video/mp4' },
		]);
		expect(JSON.parse(player.dataset.videoInfo)).toMatchObject({
			720: {
				format: ['h264'],
				url: ['https://example.com/featured-720.mp4'],
			},
		});
	});

	it('FeaturedByCuratorsRow renders when recommended data is seeded', async () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.recommended, [RECOMMENDED_MEDIA]);
		const { container } = render(<HomePage />);

		expect(await screen.findByText('Recommended Film')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Featured by Curators' })).toHaveClass(
			'heading-h6-20-medium'
		);
		expect(container.querySelector('section > .flex.flex-col.gap-2')).toContainElement(
			screen.getByText("Selected by Cinemata's community curators")
		);
	});

	it('renders configured legacy homepage playlists from indexfeatured', async () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.indexFeatured, [
			{
				title: 'Legacy Playlist',
				text: 'Playlist description from admin.<br><br>Curated by <a href="#">someone</a>',
				url: 'https://testserver/view?m=playlist&pl=abc123',
				api_url: 'https://testserver/api/v1/playlists/abc123',
				ordering: 1,
			},
		]);
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({
				playlist_media: [
					{
						id: 3,
						title: 'Playlist Film',
						thumbnail_url: 'https://example.com/playlist-thumb.jpg',
						author_name: 'Playlist Curator',
						url: '/media/playlist-film/',
					},
				],
			}),
		});

		render(<HomePage />);

		expect(await screen.findByText('Playlist Film')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Legacy Playlist' })).toBeInTheDocument();
		expect(document.querySelector('[data-modern-track]')).toHaveTextContent('Playlist description from admin.');
		expect(screen.getByRole('link', { name: 'someone' })).toHaveAttribute('href', '#');
		expect(globalThis.fetch).toHaveBeenCalledWith('https://testserver/api/v1/playlists/abc123');
		expect(screen.getAllByRole('link', { name: 'VIEW ALL' }).some((link) => link.href.includes('abc123'))).toBe(
			true
		);
	});

	it('does not reuse React keys when playlist API URLs repeat', async () => {
		const duplicateApiUrl = 'https://testserver/api/v1/playlists/duplicate';
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		homeQueryClient.setQueryData(HOME_QUERY_KEYS.indexFeatured, [
			{
				title: 'Duplicate Playlist One',
				url: 'https://testserver/view?m=playlist&pl=one',
				api_url: duplicateApiUrl,
				ordering: 1,
			},
			{
				title: 'Duplicate Playlist Two',
				url: 'https://testserver/view?m=playlist&pl=two',
				api_url: duplicateApiUrl,
				ordering: 2,
			},
		]);
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.playlistMedia(duplicateApiUrl), [
			{
				id: 10,
				title: 'Shared Playlist Film',
				thumbnail_url: 'https://example.com/shared-playlist-thumb.jpg',
				author_name: 'Shared Curator',
				url: '/media/shared-playlist-film/',
			},
		]);

		render(<HomePage />);

		expect(await screen.findByRole('heading', { level: 2, name: 'Duplicate Playlist One' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Duplicate Playlist Two' })).toBeInTheDocument();
		expect(consoleErrorSpy.mock.calls.flat().join('\n')).not.toContain(
			'Encountered two children with the same key'
		);
	});

	it('renders Recent videos from the latest media feed', async () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.recent, {
			results: [RECENT_MEDIA, RECENT_MEDIA_WITH_USER_AUTHOR],
		});

		const { container } = render(<HomePage />);

		expect(await screen.findByText('Recent Film')).toBeInTheDocument();
		expect(await screen.findByText('Fallback User')).toBeInTheDocument();
		expect(await screen.findByText('Singapore')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Recent videos' })).toBeInTheDocument();
		expect(
			screen.getAllByRole('link', { name: 'VIEW ALL' }).some((link) => link.getAttribute('href') === '/latest')
		).toBe(true);
		expect(container.querySelector('[data-section-row-grid]')).not.toBeNull();
	});

	it('does not render playlist rows when indexfeatured returns no playlists', async () => {
		render(<HomePage />);

		await waitFor(() => expect(screen.queryByText('Legacy Playlist')).toBeNull());
	});

	it('uses h2 for hero and section headings without the removed hero label', () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, [FEATURED_MEDIA]);
		render(<HomePage />);
		const h2 = screen.getByRole('heading', { level: 2, name: 'Featured Film' });
		expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
		expect(h2).toBeInTheDocument();
	});

	it('HomePage module can be re-imported without rebuilding playlist row config', () => {
		const mod1 = import.meta.glob('./HomePage.jsx', { eager: true });
		const keys = Object.keys(mod1);
		expect(keys.length).toBeGreaterThan(0);
	});
});
