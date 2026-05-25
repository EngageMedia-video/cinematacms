import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroMediaCard, HeroMediaCardSkeleton } from './HeroMediaCard';

const MEDIA = {
	title: 'A Long Featured Film Title That Still Needs To Wrap Cleanly',
	url: '/media/featured-film/',
	description: 'A synopsis loaded from the media description.',
	summary: 'A fallback synopsis.',
	author_name: 'Featured Author',
	author_profile: '/profiles/featured-author/',
	media_country: 'Philippines',
	media_country_info: [{ title: 'Philippines' }],
	views: 12345,
};

describe('HeroMediaCard', () => {
	it('uses the Figma light mapping by default and provides dark mode overrides', () => {
		render(<HeroMediaCard media={MEDIA} className="lg:h-[480px]" />);

		const card = screen.getByRole('article');
		expect(card.parentElement).toHaveClass('lg:h-[480px]');
		expect(card).toHaveClass('bg-bg-surface');
		expect(card).not.toHaveClass('border');
		expect(card).not.toHaveClass('border-cinemata-pacific-deep-100');

		const heading = screen.getByRole('heading', { level: 2 });
		expect(heading).toHaveClass('heading-h6-20-medium');
		expect(heading).toHaveClass('break-words');
		expect(heading).toHaveClass('text-text-primary');

		const titleLink = screen.getByRole('link', {
			name: 'A Long Featured Film Title That Still Needs To Wrap Cleanly',
		});
		expect(titleLink).toHaveAttribute('href', '/media/featured-film/');
		expect(titleLink.closest('h2')).toBe(heading);
		expect(titleLink).toHaveClass('text-inherit');
		expect(titleLink).toHaveClass('hover:underline');

		const description = screen.getByText('A synopsis loaded from the media description.');
		expect(description).toHaveClass('body-body-14-regular');
		expect(description).toHaveClass('text-text-description');
		expect(description.className).not.toMatch(/dark:text-\[/);
		expect(description).not.toHaveClass('dark:text-cinemata-pacific-deep-50');

		const author = screen.getByRole('link', { name: 'Featured Author' });
		expect(author).toHaveClass('body-body-12-regular');
		expect(author).toHaveClass('text-text-link');

		const views = screen.getByText('12,345 views');
		expect(views).toHaveClass('text-text-muted');
	});

	it('falls back to summary and object-shaped country info from the API', () => {
		render(
			<HeroMediaCard
				media={{
					...MEDIA,
					description: '',
					summary: 'Summary from the API list payload.',
					media_country: '',
					media_country_info: { title: 'Singapore' },
					views: '1 view',
				}}
			/>
		);

		expect(screen.getByText('Summary from the API list payload.')).toBeInTheDocument();
		expect(screen.getByText('Singapore')).toBeInTheDocument();
		expect(screen.getByText('1 view')).toBeInTheDocument();
	});

	it('renders a plain title when the media URL is absent', () => {
		const mediaWithoutUrl = { ...MEDIA };
		delete mediaWithoutUrl.url;

		render(<HeroMediaCard media={mediaWithoutUrl} />);

		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(MEDIA.title);
		expect(screen.queryByRole('link', { name: MEDIA.title })).not.toBeInTheDocument();
	});

	it('renders description as plain text', () => {
		render(<HeroMediaCard media={{ ...MEDIA, description: '<img src=x onerror=alert(1)>' }} />);

		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
	});

	it('supports light and dark mode on the skeleton state', () => {
		const { container } = render(<HeroMediaCardSkeleton className="lg:h-[480px]" />);
		const skeleton = container.firstChild;

		expect(skeleton).toHaveClass('bg-bg-surface');
		expect(skeleton).not.toHaveClass('border');
		expect(skeleton).not.toHaveClass('border-cinemata-pacific-deep-100');
		expect(skeleton).toHaveClass('lg:h-[480px]');
	});
});
