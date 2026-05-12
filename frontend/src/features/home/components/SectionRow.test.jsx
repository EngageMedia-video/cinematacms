import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SectionRow } from './SectionRow';

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
});
