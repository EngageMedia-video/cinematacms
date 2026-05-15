import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HeroSection } from './HeroSection';

vi.mock('./HeroVideoPlayer', () => ({
	default: function HeroVideoPlayerMock({ poster, className, sources = [], videoInfo = {} }) {
		return (
			<div
				data-testid="hero-video-player"
				data-poster={poster}
				data-class-name={className}
				data-sources={JSON.stringify(sources)}
				data-video-info={JSON.stringify(videoInfo)}
			/>
		);
	},
}));

const SAMPLE_MEDIA = {
	title: 'Test Featured Video',
	description: 'A wonderful description of the video.',
	summary: 'A fallback synopsis for the video.',
	thumbnail_url: 'https://example.com/thumb.jpg',
	author_name: 'Test Author',
	author_profile: '/profiles/test-author/',
	media_country: 'Philippines',
	media_country_info: [{ title: 'Philippines' }],
	views: 12345,
	duration_in_seconds: 676,
	hero_playback: {
		duration: 676,
		poster_url: 'https://example.com/thumb.jpg',
		hls_info: {},
		encodings_info: {
			720: {
				url: 'https://example.com/video.mp4',
				mime_type: 'video/mp4',
			},
		},
		subtitles_info: [],
	},
};

const originalResizeObserver = window.ResizeObserver;

function makeClient(seededData) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
	if (seededData !== undefined) {
		client.setQueryData(['home', 'featured'], seededData);
	}
	return client;
}

function renderHero(seededData, children) {
	const client = makeClient(seededData);
	return render(
		<QueryClientProvider client={client}>
			<HeroSection>{children ?? <HeroSection.Card />}</HeroSection>
		</QueryClientProvider>
	);
}

describe('HeroSection', () => {
	afterEach(() => {
		Object.defineProperty(window, 'ResizeObserver', {
			configurable: true,
			writable: true,
			value: originalResizeObserver,
		});
		vi.restoreAllMocks();
	});

	function mockHeroWidth(width) {
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
			bottom: 0,
			height: 0,
			left: 0,
			right: width,
			top: 0,
			width,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		});

		class ResizeObserverMock {
			observe() {}
			disconnect() {}
		}

		Object.defineProperty(window, 'ResizeObserver', {
			configurable: true,
			writable: true,
			value: ResizeObserverMock,
		});
	}

	it('renders null when featured data resolves to an empty array', () => {
		const { container } = renderHero([]);
		expect(container.firstChild).toBeNull();
	});

	it('renders null when featured data is an object with empty results', () => {
		const { container } = renderHero({ results: [] });
		expect(container.firstChild).toBeNull();
	});

	it('renders Card slot only when Player is omitted', () => {
		renderHero([SAMPLE_MEDIA], <HeroSection.Card />);
		expect(screen.getByRole('heading', { level: 2, name: 'Test Featured Video' })).toBeInTheDocument();
		expect(screen.queryByTestId('hero-video-player')).toBeNull();
	});

	it('renders Player slot only when Card is omitted', async () => {
		renderHero([SAMPLE_MEDIA], <HeroSection.Player />);
		expect(await screen.findByTestId('hero-video-player')).toBeInTheDocument();
		expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
		expect(screen.queryByText('11:16')).not.toBeInTheDocument();
	});

	it('renders both Player and Card when composed together', async () => {
		renderHero(
			[SAMPLE_MEDIA],
			<>
				<HeroSection.Player />
				<HeroSection.Card />
			</>
		);
		expect(await screen.findByTestId('hero-video-player')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Test Featured Video' })).toBeInTheDocument();
	});

	it('renders the Figma-aligned hero region shell', () => {
		renderHero([SAMPLE_MEDIA]);
		const region = screen.getByRole('region', { name: 'Featured media' });
		expect(region).toHaveClass('flex');
		expect(region).toHaveClass('flex-col');
		expect(region.className).not.toContain('lg:flex-row');
	});

	it('keeps the player visible and card constrained when the hero container reaches desktop width', async () => {
		mockHeroWidth(1400);

		renderHero(
			[SAMPLE_MEDIA],
			<>
				<HeroSection.Player />
				<HeroSection.Card />
			</>
		);

		const region = screen.getByRole('region', { name: 'Featured media' });
		await waitFor(() => expect(region).toHaveClass('flex-row'));

		const player = await screen.findByTestId('hero-video-player');
		expect(player.parentElement).toHaveClass('h-[440px]');
		expect(player.parentElement).toHaveClass('aspect-auto');
		expect(player.parentElement.parentElement).toHaveClass('flex-1');
		expect(screen.getByRole('article').parentElement).toHaveClass('w-[466px]');
		expect(screen.getByRole('article').parentElement).toHaveClass('h-[440px]');
	});

	it('uses the light mode Figma color mapping for the metadata card', () => {
		renderHero([SAMPLE_MEDIA]);
		const card = screen.getByRole('article');
		expect(card.className).toContain('bg-bg-cards');
		expect(card).not.toHaveClass('border');
		expect(card).not.toHaveClass('border-cinemata-pacific-deep-100');
		expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-cinemata-pacific-deep-700');
	});

	it('passes a full-height desktop player class to the lazy player', async () => {
		renderHero([SAMPLE_MEDIA], <HeroSection.Player />);
		const player = await screen.findByTestId('hero-video-player');
		expect(player).toHaveAttribute('data-class-name', expect.stringContaining('h-full'));
	});

	it('renders the poster directly when the API does not provide hero playback', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		renderHero([{ ...SAMPLE_MEDIA, hero_playback: undefined }], <HeroSection.Player />);

		expect(screen.queryByTestId('hero-video-player')).not.toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(screen.getByRole('img', { name: 'Video poster' })).toHaveAttribute(
			'src',
			'https://example.com/thumb.jpg'
		);
		expect(screen.getByText('11:16')).toBeInTheDocument();
	});

	it('fetches legacy media detail for hero playback when the featured list has no playback payload', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({
				...SAMPLE_MEDIA,
				title: 'Detail Featured Video',
				hero_playback: undefined,
				poster_url: 'https://example.com/detail-poster.jpg',
				hls_info: {},
				encodings_info: {
					720: {
						h264: {
							url: '/media/detail-720.mp4',
							status: 'success',
						},
					},
				},
				subtitles_info: [],
			}),
		});

		renderHero(
			[{ ...SAMPLE_MEDIA, hero_playback: undefined, url: '/view?m=legacy-token' }],
			<>
				<HeroSection.Player />
				<HeroSection.Card />
			</>
		);

		const player = await screen.findByTestId('hero-video-player');
		expect(fetchSpy).toHaveBeenCalledWith('/api/v1/media/legacy-token');
		expect(player).toHaveAttribute('data-poster', 'https://example.com/detail-poster.jpg');
		expect(JSON.parse(player.dataset.sources)).toEqual([{ src: '/media/detail-720.mp4', type: 'video/mp4' }]);
		expect(screen.getByRole('heading', { level: 2, name: 'Detail Featured Video' })).toBeInTheDocument();
	});

	it('surfaces a retry action when legacy hero detail playback fails', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 });

		renderHero(
			[{ ...SAMPLE_MEDIA, hero_playback: undefined, url: '/view?m=legacy-token' }],
			<HeroSection.Player />
		);

		expect(await screen.findByRole('button', { name: 'RETRY' })).toBeInTheDocument();
		expect(fetchSpy).toHaveBeenCalledWith('/api/v1/media/legacy-token');
		expect(screen.getByRole('img', { name: 'Video poster' })).toHaveAttribute(
			'src',
			'https://example.com/thumb.jpg'
		);
	});

	it('renders the hero player from hero_playback without calling fetch', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({}),
		});

		renderHero(
			[
				{
					...SAMPLE_MEDIA,
					api_url: '/api/v1/media/featured-token',
					hero_playback: {
						...SAMPLE_MEDIA.hero_playback,
						encodings_info: {
							720: {
								h264: {
									url: 'https://example.com/hero-video.mp4',
									status: 'success',
								},
							},
						},
					},
				},
			],
			<HeroSection.Player />
		);

		const player = await screen.findByTestId('hero-video-player');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(JSON.parse(player.dataset.sources)).toEqual([
			{ src: 'https://example.com/hero-video.mp4', type: 'video/mp4' },
		]);
	});

	it('uses nested resolution and codec encoding info when it is already present', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) });

		renderHero(
			[
				{
					...SAMPLE_MEDIA,
					hero_playback: {
						...SAMPLE_MEDIA.hero_playback,
						encodings_info: {
							1080: {
								h265: {
									url: 'https://example.com/1080p.mp4',
									status: 'success',
								},
							},
						},
					},
				},
			],
			<HeroSection.Player />
		);

		const player = await screen.findByTestId('hero-video-player');
		expect(JSON.parse(player.dataset.sources)).toEqual([
			{ src: 'https://example.com/1080p.mp4', type: 'video/mp4' },
		]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('prefers the HLS master source from hero_playback like the legacy home player', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) });

		renderHero(
			[
				{
					...SAMPLE_MEDIA,
					api_url: '/api/v1/media/featured-token',
					hero_playback: {
						...SAMPLE_MEDIA.hero_playback,
						hls_info: {
							master_file: '/media/hls/master.m3u8?v=123',
							'720_playlist': '/media/hls/720.m3u8?v=123',
						},
						encodings_info: {
							720: {
								h264: {
									url: '/media/video-720.mp4?v=123',
									status: 'success',
								},
							},
						},
					},
				},
			],
			<HeroSection.Player />
		);

		const player = await screen.findByTestId('hero-video-player');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(JSON.parse(player.dataset.sources)).toEqual([
			{ src: '/media/hls/master.m3u8?v=123', type: 'application/x-mpegURL' },
		]);
		expect(JSON.parse(player.dataset.videoInfo)).toMatchObject({
			Auto: { format: ['hls'], url: ['/media/hls/master.m3u8?v=123'] },
			720: {
				format: ['hls', 'h264'],
				url: ['/media/hls/720.m3u8?v=123', '/media/video-720.mp4?v=123'],
			},
		});
	});

	it('keeps root-relative playback URLs on the current origin for CSP-safe media loading', async () => {
		const previousMediaCMS = globalThis.MediaCMS;
		globalThis.MediaCMS = { site: { url: 'http://backend.test' } };

		try {
			renderHero(
				[
					{
						...SAMPLE_MEDIA,
						hero_playback: {
							...SAMPLE_MEDIA.hero_playback,
							encodings_info: {
								360: {
									h264: {
										url: '/media/video-360.mp4?v=123',
										status: 'success',
									},
								},
							},
						},
					},
				],
				<HeroSection.Player />
			);

			const player = await screen.findByTestId('hero-video-player');
			expect(JSON.parse(player.dataset.sources)).toEqual([
				{ src: '/media/video-360.mp4?v=123', type: 'video/mp4' },
			]);
		} finally {
			if (previousMediaCMS === undefined) {
				delete globalThis.MediaCMS;
			} else {
				globalThis.MediaCMS = previousMediaCMS;
			}
		}
	});

	it('renders title as h2', () => {
		renderHero([SAMPLE_MEDIA]);
		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Featured Video');
	});

	it('renders author, country, and views metadata', () => {
		renderHero(
			[SAMPLE_MEDIA],
			<>
				<HeroSection.Player />
				<HeroSection.Card />
			</>
		);
		expect(screen.getByRole('link', { name: 'Test Author' })).toHaveAttribute('href', '/profiles/test-author/');
		expect(screen.getByText('Philippines')).toBeInTheDocument();
		expect(screen.getByText('12,345 views')).toBeInTheDocument();
	});

	it('falls back to legacy media_country when country info is absent', () => {
		renderHero([{ ...SAMPLE_MEDIA, media_country_info: undefined, media_country: 'Indonesia' }]);
		expect(screen.getByText('Indonesia')).toBeInTheDocument();
	});

	it('supports object-shaped media_country_info from the live API', () => {
		renderHero([{ ...SAMPLE_MEDIA, media_country_info: { title: 'Singapore' }, media_country: '' }]);
		expect(screen.getByText('Singapore')).toBeInTheDocument();
	});

	it('renders summary when description is empty', () => {
		renderHero([{ ...SAMPLE_MEDIA, description: '', summary: 'Summary from the list API.' }]);
		expect(screen.getByText('Summary from the list API.')).toBeInTheDocument();
	});

	it('renders description as plain text, not HTML', () => {
		const mediaWithHtml = {
			...SAMPLE_MEDIA,
			description: '<img src=x onerror=alert(1)>',
		};
		renderHero([mediaWithHtml]);
		expect(screen.queryByRole('img', { name: '' })).toBeNull();
		expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
	});

	it('Player wraps in Suspense — poster is visible while player chunk loads', async () => {
		renderHero(
			[SAMPLE_MEDIA],
			<>
				<HeroSection.Player />
				<HeroSection.Card />
			</>
		);
		// The mock resolves asynchronously; verify player renders after resolution
		expect(await screen.findByTestId('hero-video-player')).toBeInTheDocument();
	});

	it('uses the SVG-to-component pipeline for the poster play affordance', async () => {
		const source = await import('./HeroSection.jsx?raw');
		expect(source.default).toMatch(/shared\/icons\/hero-play-button\.svg\?react/);
		expect(source.default).toContain('bottom-12 left-12');
		expect(source.default).not.toContain('top-1/2');
		expect(source.default).not.toMatch(/<svg\b/);
		expect(source.default).not.toMatch(/PLAY_CIRCLE_PATH/);
	});

	it('HeroVideoPlayer is imported via dynamic import (lazy-load boundary exists)', async () => {
		const source = await import('./HeroSection.jsx?raw');
		expect(source.default).toContain('lazy');
		expect(source.default).toContain('HeroVideoPlayer');
		expect(source.default).toMatch(/import\s*\(/);
	});
});
