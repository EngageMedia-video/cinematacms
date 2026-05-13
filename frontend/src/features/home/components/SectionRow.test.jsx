import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SectionRow } from './SectionRow';
import { CAROUSEL_GRID_TEMPLATE_COLUMNS } from './carouselLayout';

function makeItems(count = 5) {
	return Array.from({ length: count }, (_, i) => ({
		friendly_token: `t${i}`,
		title: `Movie ${i}`,
		thumbnail_url: '',
		url: `/media/m${i}/`,
		duration_in_seconds: 120,
		author_name: `Author ${i}`,
	}));
}

const ITEMS = makeItems();

describe('SectionRow', () => {
	it('renders null when items is empty and isLoading is false', () => {
		const { container } = render(
			<SectionRow items={[]} isLoading={false}>
				<SectionRow.Header badgeLabel="Test" />
			</SectionRow>
		);
		expect(container.firstChild).toBeNull();
	});

	it('renders null when isError is true regardless of items', () => {
		const { container } = render(
			<SectionRow items={ITEMS} isError={true}>
				<SectionRow.Header badgeLabel="Test" />
			</SectionRow>
		);
		expect(container.firstChild).toBeNull();
	});

	it('renders skeleton placeholders when isLoading is true', () => {
		const { container } = render(<SectionRow items={[]} isLoading={true} />);
		expect(container.querySelector('.animate-pulse')).not.toBeNull();
	});

	it('card variant paints a background layer without changing content alignment', () => {
		const { container } = render(
			<SectionRow items={ITEMS} variant="card">
				<SectionRow.Title>Featured Playlist</SectionRow.Title>
			</SectionRow>
		);
		const section = container.querySelector('section');
		const background = section.querySelector('[aria-hidden="true"]');

		expect(section).toHaveClass('relative');
		expect(section).toHaveClass('py-4');
		expect(section).not.toHaveClass('px-4');
		expect(section).not.toHaveClass('sm:px-6');
		expect(section).not.toHaveClass('lg:px-8');
		expect(background).toHaveClass('bg-cinemata-neutral-50');
		expect(background).toHaveClass('-left-4');
		expect(background).toHaveClass('-right-4');
		expect(background).toHaveClass('sm:rounded-[8px]');
		expect(background).toHaveClass('lg:-left-8');
		expect(background).toHaveClass('lg:-right-8');
	});

	it('renders badge with the supplied label when Header is present', () => {
		render(
			<SectionRow items={ITEMS}>
				<SectionRow.Header badgeLabel="GENDER & SEXUALITY" />
			</SectionRow>
		);
		expect(screen.getByText('GENDER & SEXUALITY')).toBeInTheDocument();
	});

	it('omitting Header renders description + carousel without badge', () => {
		render(
			<SectionRow items={ITEMS}>
				<SectionRow.Description text="Stories exploring identity." />
				<SectionRow.Carousel />
			</SectionRow>
		);
		expect(screen.queryByText('VIEW ALL')).toBeNull();
		expect(screen.getByText('Stories exploring identity.')).toBeInTheDocument();
	});

	it('omitting Description renders header + carousel without description', () => {
		render(
			<SectionRow items={ITEMS}>
				<SectionRow.Header badgeLabel="FILM" viewAllHref="/films" />
				<SectionRow.Carousel />
			</SectionRow>
		);
		expect(screen.getByText('FILM')).toBeInTheDocument();
		expect(screen.queryByText('READ MORE')).toBeNull();
	});

	it('renders a grid body for non-carousel rows', () => {
		const { container } = render(
			<SectionRow items={ITEMS}>
				<SectionRow.Title>Recent videos</SectionRow.Title>
				<SectionRow.Grid />
			</SectionRow>
		);

		const grid = container.querySelector('[data-section-row-grid]');
		expect(grid).not.toBeNull();
		expect(grid).toHaveClass('grid');
		expect(grid).not.toHaveClass('lg:grid-cols-4');
		expect(grid).not.toHaveClass('xl:grid-cols-5');
		expect(grid).toHaveStyle({
			gridTemplateColumns: CAROUSEL_GRID_TEMPLATE_COLUMNS,
		});
		expect(screen.queryByRole('group', { name: 'Page navigation' })).toBeNull();
	});

	it('VIEW ALL link points to the correct href', () => {
		render(
			<SectionRow items={ITEMS}>
				<SectionRow.Header badgeLabel="FILM" viewAllHref="/search?c=Film" />
			</SectionRow>
		);
		const link = screen.getByRole('link', { name: 'VIEW ALL' });
		expect(link).toHaveAttribute('href', '/search?c=Film');
	});

	it('renders Title text when SectionRow.Title is provided', () => {
		render(
			<SectionRow items={ITEMS}>
				<SectionRow.Title>Featured by Curators</SectionRow.Title>
			</SectionRow>
		);
		expect(screen.getByRole('heading', { name: 'Featured by Curators' })).toBeInTheDocument();
	});

	it('Title with viewAllHref renders heading and VIEW ALL link on the same line', () => {
		render(
			<SectionRow items={ITEMS}>
				<SectionRow.Title viewAllHref="/recommended">Featured by Curators</SectionRow.Title>
			</SectionRow>
		);
		expect(screen.getByRole('heading', { name: 'Featured by Curators' })).toHaveClass(
			'text-cinemata-pacific-deep-700'
		);
		const link = screen.getByRole('link', { name: 'VIEW ALL' });
		expect(link).toHaveAttribute('href', '/recommended');
		expect(link).toHaveClass('text-cinemata-sunset-horizon-400p');
	});

	it('Title and Description can both render alongside Header', () => {
		render(
			<SectionRow items={ITEMS}>
				<SectionRow.Header badgeLabel="INDIGENOUS" />
				<SectionRow.Title>Featured by Curators</SectionRow.Title>
				<SectionRow.Description text="Stories from indigenous communities." />
			</SectionRow>
		);
		expect(screen.getByText('INDIGENOUS')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Featured by Curators' })).toBeInTheDocument();
		expect(screen.getByText('Stories from indigenous communities.')).toBeInTheDocument();
	});

	it('HtmlDescription renders admin-provided line breaks and links', () => {
		const { container } = render(
			<SectionRow items={ITEMS}>
				<SectionRow.HtmlDescription html={'First line<br><br>Curated by <a href="#">someone</a>'} />
			</SectionRow>
		);

		const description = container.querySelector('section > div');
		expect(container.querySelectorAll('br')).toHaveLength(2);
		expect(description).toHaveClass('space-y-2');
		expect(description).toHaveClass('[&_p]:m-0');
		expect(description).toHaveClass('[&_br+br]:hidden');
		expect(description).toHaveClass('[&_a]:text-cinemata-sunset-horizon-400p');
		expect(screen.getByRole('link', { name: 'someone' })).toHaveAttribute('href', '#');
	});

	it('HtmlDescription sanitizes dangerous attributes before rendering', () => {
		const { container } = render(
			<SectionRow items={ITEMS}>
				<SectionRow.HtmlDescription
					html={'<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>'}
				/>
			</SectionRow>
		);

		expect(container.querySelector('img')).not.toHaveAttribute('onerror');
		const anchor = container.querySelector('a');
		expect(anchor).toHaveTextContent('bad');
		expect(anchor).not.toHaveAttribute('href');
	});
});
