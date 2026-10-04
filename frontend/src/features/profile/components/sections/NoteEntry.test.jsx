import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoteEntry } from './NoteEntry';

const media = { title: 'My Film', friendly_token: 'abc', url: '/view?m=abc', thumbnail_url: '', duration: 120 };

describe('NoteEntry', () => {
	it('renders a bare URL in the latest note as a nofollow link that opens in the same tab', () => {
		render(<NoteEntry note={{ text: 'Read https://cinemata.org/essay first', timestamp_seconds: 65, media }} />);

		const link = screen.getByRole('link', { name: 'https://cinemata.org/essay' });
		expect(link).toHaveAttribute('href', 'https://cinemata.org/essay');
		expect(link).toHaveAttribute('rel', 'nofollow noopener');
		expect(link).not.toHaveAttribute('target');
	});

	it('shows markup typed into the latest note as text', () => {
		const { container } = render(<NoteEntry note={{ text: '<b>bold</b> idea', timestamp_seconds: 0, media }} />);

		expect(container.querySelector('b')).toBeNull();
		expect(screen.getByText('<b>bold</b> idea')).toBeInTheDocument();
	});
});
