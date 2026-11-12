import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HorizontalMovieItem, VerticalMovieItem } from './MovieItem';

const samplePoster =
	'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"%3E%3Crect width="160" height="90" rx="6" fill="%23102746"/%3E%3Ccircle cx="120" cy="24" r="20" fill="%2385c4ff" fill-opacity="0.35"/%3E%3Cpath d="M0 66c24-18 47-27 68-27 21 0 52 12 92 35v16H0V66z" fill="%23D0735F"/%3E%3C/svg%3E';

describe('MovieItem', () => {
	it('renders the horizontal layout with badge and duration overlays', () => {
		render(
			<HorizontalMovieItem
				imageSrc={samplePoster}
				imageAlt="Arrival poster"
				title="Arrival"
				subtitle="Sci-Fi Drama"
				metadata={['2026', 'PG-13', '4K']}
				badge="Premiere"
				duration="2h 3m"
			/>
		);

		const article = screen.getByRole('article');
		const image = screen.getByRole('img', { name: 'Arrival poster' });
		expect(image).toHaveClass('object-cover');
		expect(screen.getByText('2026')).toBeVisible();
		expect(screen.getByText('PG-13')).toBeVisible();
		expect(screen.getByText('4K')).toBeVisible();
		expect(screen.getByText('Premiere')).toBeVisible();
		// Badge and duration share one bottom row; duration is pushed to the right edge with ml-auto.
		expect(screen.getByText('2h 3m')).toHaveClass('ml-auto');
		expect(screen.getByText('2h 3m').closest('div')).toHaveClass('inset-x-2');
		expect(screen.getByText('2h 3m').closest('div')).toHaveClass('bottom-2');
		expect(screen.getByText('2h 3m')).toHaveClass('text-[12px]');
		expect(screen.getByText('2h 3m')).toHaveClass('leading-[13.5px]');
		expect(screen.getByText('2h 3m')).toHaveClass('tracking-[0.5px]');
		expect(screen.getByText('2h 3m')).toHaveClass('bg-bg-overlay-dark');
		expect(article).toContainElement(image);
		expect(screen.getByText('Arrival')).toHaveClass('text-text-primary');
		expect(screen.getByText('Arrival')).toHaveClass('[font-family:Inter,Arial,sans-serif]');
		expect(screen.getByText('Arrival')).toHaveClass('leading-[22px]');
		expect(screen.getByText('Arrival')).toHaveClass('tracking-[-0.18px]');
		expect(screen.getByText('Sci-Fi Drama')).toHaveClass('body-body-12-regular');
		expect(screen.getByText('Sci-Fi Drama')).toHaveClass('text-text-link');
		expect(screen.getByText('2026').closest('div')).toHaveClass('text-text-disabled');
		expect(screen.getByText('2026').closest('div')).toHaveClass('gap-1');
		expect(screen.getAllByText('·')[0]).toHaveClass('mr-1');
	});

	it('renders the vertical layout with Figma-aligned copy styles and the top-right icon chip', () => {
		render(
			<VerticalMovieItem
				imageSrc={samplePoster}
				imageAlt="Festival poster"
				title="Past Lives"
				subtitle="Romance"
				metadata={['2025', 'Award Winner']}
				badge="Official Selection"
				duration="1h 46m"
				iconName="eyeSlash"
				iconLabel="Hidden"
			/>
		);

		const article = screen.getByRole('article');
		const icon = article.querySelector('svg[data-icon="eyeSlash"]');
		expect(icon).not.toBeNull();
		expect(screen.getByText('Official Selection')).toBeVisible();
		expect(screen.getByText('1h 46m')).toBeVisible();
		expect(screen.getByText('Past Lives')).toHaveClass('text-[16px]');
		expect(screen.getByText('Past Lives')).toHaveClass('leading-[22px]');
		expect(screen.getByText('Past Lives')).toHaveClass('tracking-[-0.18px]');
		expect(screen.getByText('Romance')).toHaveClass('body-body-12-regular');
		expect(screen.getByText('2025').closest('div')).toHaveClass('gap-1');
		expect(screen.getByText('2025').closest('div')).toHaveClass('max-h-[42px]');
		expect(screen.getByText('2025').closest('div')).toHaveClass('whitespace-nowrap');
		expect(screen.getByText('·')).toHaveClass('mr-1');
	});

	it('renders as a link when a detail URL is provided', () => {
		render(
			<VerticalMovieItem
				imageSrc={samplePoster}
				imageAlt="Clickable poster"
				title="Cinema Paradiso"
				metadata={['1988']}
				link="/media/cinema-paradiso/"
			/>
		);

		const movieLink = screen.getByRole('link', { name: 'Open Cinema Paradiso' });

		expect(movieLink).toHaveAttribute('href', '/media/cinema-paradiso/');
	});

	it('includes visible poster overlay text in the poster link accessible name', () => {
		render(
			<VerticalMovieItem
				imageSrc={samplePoster}
				imageAlt="Clickable poster"
				title="Cinema Paradiso"
				subtitle="Giuseppe Tornatore"
				subtitleLink="/profiles/giuseppe-tornatore/"
				badge="Documentary"
				duration="1:02"
				link="/media/cinema-paradiso/"
			/>
		);

		expect(screen.getByRole('link', { name: 'Documentary 1:02, Open Cinema Paradiso' })).toHaveAttribute(
			'href',
			'/media/cinema-paradiso/'
		);
	});

	it('keeps the subtitle profile link clickable inside a linked movie card', () => {
		render(
			<VerticalMovieItem
				imageSrc={samplePoster}
				imageAlt="Clickable poster"
				title="Cinema Paradiso"
				subtitle="Giuseppe Tornatore"
				subtitleLink="/profiles/giuseppe-tornatore/"
				metadata={['1988']}
				link="/media/cinema-paradiso/"
			/>
		);

		expect(screen.getByRole('link', { name: 'Cinema Paradiso' })).toHaveAttribute(
			'href',
			'/media/cinema-paradiso/'
		);
		expect(screen.getByRole('link', { name: 'Open Cinema Paradiso' })).toHaveAttribute(
			'href',
			'/media/cinema-paradiso/'
		);
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' })).toHaveAttribute(
			'href',
			'/profiles/giuseppe-tornatore/'
		);
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' })).not.toHaveClass('min-h-8');
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' })).toHaveClass('touch-manipulation');
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' }).closest('a[aria-label]')).toBeNull();
	});
});

describe('MovieItem hover preview', () => {
	const previewSrc = 'https://example.com/media/encoded/preview.gif?v=3';
	const originalMatchMedia = window.matchMedia;

	function mockMatchMedia(matchingQuery = '') {
		window.matchMedia = vi.fn((query) => ({
			matches: Boolean(matchingQuery) && query.includes(matchingQuery),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
	}

	function getPreview(container) {
		return container.querySelector('img[data-movie-item-preview]');
	}

	beforeEach(() => {
		mockMatchMedia();
	});

	afterEach(() => {
		window.matchMedia = originalMatchMedia;
	});

	it.each([
		['vertical', VerticalMovieItem],
		['horizontal', HorizontalMovieItem],
	])('loads the %s preview only on hover and removes it on leave', async (_layout, MovieItem) => {
		const user = userEvent.setup();
		const { container } = render(
			<MovieItem imageSrc={samplePoster} previewSrc={previewSrc} title="Arrival" link="/media/arrival/" />
		);
		const article = screen.getByRole('article');

		expect(getPreview(container)).toBeNull();

		await user.hover(article);
		const preview = getPreview(container);
		expect(preview).toHaveAttribute('src', previewSrc);
		expect(preview).toHaveAttribute('alt', '');
		expect(preview).toHaveClass('opacity-0');

		fireEvent.load(preview);
		expect(preview).toHaveClass('opacity-100');
		expect(screen.getByRole('img', { name: 'Movie artwork' })).toHaveAttribute('src', samplePoster);

		await user.unhover(article);
		expect(getPreview(container)).toBeNull();
	});

	it('plays the preview while a tile link has keyboard focus', async () => {
		const user = userEvent.setup();
		const { container } = render(
			<>
				<VerticalMovieItem
					imageSrc={samplePoster}
					previewSrc={previewSrc}
					title="Arrival"
					subtitle="Denis Villeneuve"
					subtitleLink="/profiles/denis/"
					link="/media/arrival/"
				/>
				<a href="/after/">After</a>
			</>
		);

		await user.tab();
		const preview = getPreview(container);
		expect(preview).toHaveAttribute('src', previewSrc);
		fireEvent.load(preview);

		await user.tab();
		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Denis Villeneuve' }));
		// Moving focus between links inside the tile must not restart the preview.
		expect(getPreview(container)).toBe(preview);
		expect(preview).toHaveClass('opacity-100');

		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole('link', { name: 'After' }));
		expect(getPreview(container)).toBeNull();
	});

	it('keeps the static thumbnail and stops requesting the preview after it fails to load', async () => {
		const user = userEvent.setup();
		const { container } = render(
			<VerticalMovieItem imageSrc={samplePoster} previewSrc={previewSrc} title="Arrival" link="/media/arrival/" />
		);
		const article = screen.getByRole('article');

		await user.hover(article);
		fireEvent.error(getPreview(container));
		expect(getPreview(container)).toBeNull();

		await user.unhover(article);
		await user.hover(article);
		expect(getPreview(container)).toBeNull();
		expect(screen.getByRole('img', { name: 'Movie artwork' })).toHaveAttribute('src', samplePoster);
	});

	it.each([
		{
			name: 'plays on a mouse pointer',
			previewUrl: previewSrc,
			matchingQuery: '',
			pointerType: 'mouse',
			plays: true,
		},
		{ name: 'skips without a preview URL', previewUrl: '', matchingQuery: '', pointerType: 'mouse', plays: false },
		{
			name: 'skips under reduced motion',
			previewUrl: previewSrc,
			matchingQuery: 'prefers-reduced-motion: reduce',
			pointerType: 'mouse',
			plays: false,
		},
		{
			name: 'skips on a hover-less device',
			previewUrl: previewSrc,
			matchingQuery: 'hover: none',
			pointerType: 'mouse',
			plays: false,
		},
		{
			name: 'skips a touch pointer',
			previewUrl: previewSrc,
			matchingQuery: '',
			pointerType: 'touch',
			plays: false,
		},
	])('$name', ({ previewUrl, matchingQuery, pointerType, plays }) => {
		mockMatchMedia(matchingQuery);
		const { container } = render(
			<VerticalMovieItem imageSrc={samplePoster} previewSrc={previewUrl} title="Arrival" link="/media/arrival/" />
		);

		fireEvent.pointerOver(screen.getByRole('article'), { pointerType });

		expect(Boolean(getPreview(container))).toBe(plays);
	});

	it.each([
		{ name: 'plays on focus', matchingQuery: '', plays: true },
		{ name: 'skips focus under reduced motion', matchingQuery: 'prefers-reduced-motion: reduce', plays: false },
		{ name: 'skips focus on a hover-less device', matchingQuery: 'hover: none', plays: false },
	])('$name', ({ matchingQuery, plays }) => {
		mockMatchMedia(matchingQuery);
		const { container } = render(
			<VerticalMovieItem imageSrc={samplePoster} previewSrc={previewSrc} title="Arrival" link="/media/arrival/" />
		);

		act(() => screen.getByRole('link', { name: 'Open Arrival' }).focus());

		expect(Boolean(getPreview(container))).toBe(plays);
	});
});
