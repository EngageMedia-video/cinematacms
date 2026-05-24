import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MediaTile } from './MediaTile';

const BASE_ITEM = {
	title: 'Duration Film',
	thumbnail_url: 'https://example.com/thumb.jpg',
	url: '/media/duration-film/',
	author_name: 'Duration Author',
	author_profile: '/profiles/duration-author/',
	media_country: 'Indonesia',
	views: 42,
	state: 'private',
};

describe('MediaTile', () => {
	it('shows duration on the thumbnail and does not show a state icon chip', () => {
		const { container } = render(<MediaTile item={{ ...BASE_ITEM, duration_in_seconds: 676 }} />);

		expect(screen.getByText('11:16')).toHaveAttribute('data-movie-item-duration');
		expect(container.querySelector('[data-movie-item-icon-chip]')).toBeNull();
		expect(container.querySelector('svg[data-icon="eyeSlash"]')).toBeNull();
	});

	it('uses legacy duration strings when duration_in_seconds is absent', () => {
		render(<MediaTile item={{ ...BASE_ITEM, duration: '03:21' }} />);

		expect(screen.getByText('03:21')).toHaveAttribute('data-movie-item-duration');
	});

	it('links the author name to the author profile', () => {
		render(<MediaTile item={BASE_ITEM} />);

		const author = screen.getByRole('link', { name: 'Duration Author' });

		expect(author).toHaveAttribute('href', '/profiles/duration-author/');
	});
});
