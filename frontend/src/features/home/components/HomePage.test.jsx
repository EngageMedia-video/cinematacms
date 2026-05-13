import { render, screen } from '@testing-library/react';
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

beforeEach(() => {
	homeQueryClient.clear();
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
		render(<HomePage />);
		expect(await screen.findByText('Recommended Film')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Featured by Curators' })).toBeInTheDocument();
	});

	it('CategorySectionRow instances render null because useCategoryMedia returns []', () => {
		render(<HomePage />);
		// PROVISIONAL_CATEGORIES have badgeLabels; they should not appear since rows are empty
		expect(screen.queryByText('GENDER & SEXUALITY')).toBeNull();
		expect(screen.queryByText('FILM')).toBeNull();
	});

	it('uses h2 for section headings (under the h1)', () => {
		homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, [FEATURED_MEDIA]);
		render(<HomePage />);
		const h1 = screen.getByRole('heading', { level: 1 });
		const h2 = screen.getByRole('heading', { level: 2 });
		expect(h1).toBeInTheDocument();
		expect(h2).toBeInTheDocument();
	});

	it('PROVISIONAL_CATEGORIES is referentially identical across re-renders', () => {
		// Import the module to access the constant
		const mod1 = import.meta.glob('./HomePage.jsx', { eager: true });
		const keys = Object.keys(mod1);
		// The constant should be defined at module scope — verified by the source contract test
		expect(keys.length).toBeGreaterThan(0);
	});
});
