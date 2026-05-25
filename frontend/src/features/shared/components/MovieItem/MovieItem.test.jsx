import { render, screen } from '@testing-library/react';
import { HorizontalMovieItem, MovieItem, VerticalMovieItem } from './MovieItem';

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
		expect(screen.getByText('2h 3m')).toHaveClass('right-1');
		expect(screen.getByText('2h 3m')).toHaveClass('bottom-1');
		expect(screen.getByText('2h 3m')).toHaveClass('text-[12px]');
		expect(screen.getByText('2h 3m')).toHaveClass('leading-[13.5px]');
		expect(screen.getByText('2h 3m')).toHaveClass('tracking-[0.5px]');
		expect(screen.getByText('2h 3m')).toHaveClass('bg-[var(--cinemata-pacific-deep-950)]');
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

	it('switches variants through the generic MovieItem orientation prop', () => {
		const { rerender } = render(
			<MovieItem
				orientation="horizontal"
				imageSrc={samplePoster}
				imageAlt="Horizontal poster"
				title="The Blue Boat"
				metadata={['2024', 'Documentary']}
			/>
		);

		expect(screen.getByRole('article')).toBeInTheDocument();

		rerender(
			<MovieItem
				orientation="vertical"
				imageSrc={samplePoster}
				imageAlt="Vertical poster"
				title="The Blue Boat"
				metadata={['2024', 'Documentary']}
			/>
		);

		expect(screen.getByRole('article')).toBeInTheDocument();
	});

	it('renders as a link when a detail URL is provided', () => {
		render(
			<MovieItem
				orientation="vertical"
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

	it('keeps the subtitle profile link clickable inside a linked movie card', () => {
		render(
			<VerticalMovieItem
				imageSrc={samplePoster}
				imageAlt="Clickable poster"
				title="Cinema Paradiso"
				subtitle="Giuseppe Tornatore"
				subtitleHref="/profiles/giuseppe-tornatore/"
				metadata={['1988']}
				link="/media/cinema-paradiso/"
			/>
		);

		expect(screen.getByRole('link', { name: 'Open Cinema Paradiso' })).toHaveAttribute(
			'href',
			'/media/cinema-paradiso/'
		);
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' })).toHaveAttribute(
			'href',
			'/profiles/giuseppe-tornatore/'
		);
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' })).toHaveClass('z-20');
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' })).toHaveClass('min-h-8');
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' })).toHaveClass('touch-manipulation');
		expect(screen.getByRole('link', { name: 'Giuseppe Tornatore' }).closest('a[aria-label]')).toBeNull();
	});
});
