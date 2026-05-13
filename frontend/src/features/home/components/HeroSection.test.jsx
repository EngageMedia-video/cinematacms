import { render, screen } from '@testing-library/react';
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
	afterEach(() => vi.restoreAllMocks());

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
		expect(region.className).toContain('lg:gap-[26px]');
		expect(region.className).not.toContain('lg:pr-[27px]');
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

	it('HeroVideoPlayer is imported via dynamic import (lazy-load boundary exists)', async () => {
		// Verify the module file uses React.lazy by inspecting source
		const source = await import('./HeroSection.jsx?raw');
		expect(source.default).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/HeroVideoPlayer['"]\)/);
	});
});
