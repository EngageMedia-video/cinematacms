import { render, screen, within } from '@testing-library/react';
import { MediaGrid } from './MediaGrid';

function mediaItem(overrides) {
	return {
		friendly_token: 'abc123',
		title: 'A Film',
		url: '/view?m=abc123',
		thumbnail_url: '/media/thumb.jpg',
		...overrides,
	};
}

describe('MediaGrid visibility indicators', () => {
	it.each([
		['private', 'eyeSlash', 'Private'],
		['unlisted', 'link', 'Unlisted'],
		['restricted', 'lockKey', 'Restricted'],
	])('marks a %s film with its visibility icon', (state, iconName, label) => {
		render(<MediaGrid items={[mediaItem({ state })]} />);

		const icon = screen.getByRole('article').querySelector(`svg[data-icon="${iconName}"]`);

		expect(icon).not.toBeNull();
		expect(icon).toHaveAttribute('aria-label', label);
	});

	it('leaves a public film unmarked', () => {
		render(<MediaGrid items={[mediaItem({ state: 'public' })]} />);

		expect(screen.getByRole('article').querySelector('[data-movie-item-icon-chip]')).toBeNull();
	});
});

describe('MediaGrid details needed', () => {
	it('marks an upload whose details were never saved and links it to its edit page', () => {
		render(<MediaGrid items={[mediaItem({ state: 'private', details_needed: true })]} />);

		const card = screen.getByRole('article');
		expect(within(card).getByText('Details needed')).toBeInTheDocument();
		const hrefs = within(card)
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'));
		expect(hrefs.length).toBeGreaterThan(0);
		expect(hrefs.every((href) => href === '/edit?m=abc123')).toBe(true);
	});

	it('keeps a film with saved details linked to its media page', () => {
		render(<MediaGrid items={[mediaItem({ state: 'private', details_needed: false })]} />);

		const card = screen.getByRole('article');
		expect(within(card).queryByText('Details needed')).not.toBeInTheDocument();
		expect(within(card).getAllByRole('link')[0]).toHaveAttribute('href', '/view?m=abc123');
	});
});
