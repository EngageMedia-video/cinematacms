import { render, screen } from '@testing-library/react';
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
