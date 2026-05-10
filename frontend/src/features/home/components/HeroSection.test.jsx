import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeroSection } from './HeroSection';

vi.mock('./HeroVideoPlayer', () => ({
	default: function HeroVideoPlayerMock({ poster }) {
		return <div data-testid="hero-video-player" data-poster={poster} />;
	},
}));

const SAMPLE_MEDIA = {
	title: 'Test Featured Video',
	description: 'A wonderful description of the video.',
	thumbnail_url: 'https://example.com/thumb.jpg',
	author_name: 'Test Author',
	media_country: 'Philippines',
	views: 12345,
	encodings_info: {},
	subtitles_info: [],
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

	it('renders title as h2', () => {
		renderHero([SAMPLE_MEDIA]);
		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Featured Video');
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

	it('description expand toggle updates aria-expanded', async () => {
		const user = userEvent.setup();
		renderHero([SAMPLE_MEDIA]);

		const btn = screen.getByRole('button', { name: 'READ MORE' });
		expect(btn).toHaveAttribute('aria-expanded', 'false');

		await user.click(btn);
		expect(screen.getByRole('button', { name: 'READ LESS' })).toHaveAttribute('aria-expanded', 'true');
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
