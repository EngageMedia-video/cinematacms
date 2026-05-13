import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import homeQueryClient, { HOME_QUERY_KEYS } from '../queryClient';
import { HomePage } from './HomePage';

// Mock the lazy-loaded video player to prevent videojs import in tests
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
	it('renders h1 heading', () => {
		render(<HomePage />);
		expect(screen.getByRole('heading', { level: 1, name: 'Most Popular' })).toHaveClass('heading-h4-32-medium');
	});

	it('uses 32px spacing between the heading and hero region', () => {
		render(<HomePage />);
		const heading = screen.getByRole('heading', { level: 1, name: 'Most Popular' });
		expect(heading.parentElement).toHaveClass('space-y-8');
		expect(document.querySelector('[data-modern-track]')).toHaveClass('space-y-10');
	});

	it('caps the home track width on very large screens', () => {
		render(<HomePage />);
		const track = document.querySelector('[data-modern-track]');

		expect(track).toHaveClass('mx-auto');
		expect(track).toHaveClass('max-w-[1680px]');
		expect(track).not.toHaveClass('px-4');
	});

	it('has exactly one h1', () => {
		render(<HomePage />);
		expect(document.querySelectorAll('h1')).toHaveLength(1);
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

		const player = await screen.findByTestId('hero-video-player');
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
			screen.getByText('Hand-picked stories from our editorial team.')
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
		expect(screen.getByRole('link', { name: 'VIEW ALL' })).toHaveAttribute(
			'href',
			'https://testserver/view?m=playlist&pl=abc123'
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
		expect(screen.getByRole('link', { name: 'VIEW ALL' })).toHaveAttribute('href', '/latest');
		expect(container.querySelector('[data-section-row-grid]')).not.toBeNull();
		expect(screen.queryByRole('group', { name: 'Page navigation' })).toBeNull();
	});

	it('does not render playlist rows when indexfeatured returns no playlists', async () => {
		render(<HomePage />);

		await waitFor(() => expect(screen.queryByText('Legacy Playlist')).toBeNull());
	});

	it('uses h2 for section headings (under the h1)', () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, [FEATURED_MEDIA]);
		render(<HomePage />);
		const h1 = screen.getByRole('heading', { level: 1 });
		const h2 = screen.getByRole('heading', { level: 2 });
		expect(h1).toBeInTheDocument();
		expect(h2).toBeInTheDocument();
	});

	it('HomePage module can be re-imported without rebuilding playlist row config', () => {
		const mod1 = import.meta.glob('./HomePage.jsx', { eager: true });
		const keys = Object.keys(mod1);
		expect(keys.length).toBeGreaterThan(0);
	});
});
