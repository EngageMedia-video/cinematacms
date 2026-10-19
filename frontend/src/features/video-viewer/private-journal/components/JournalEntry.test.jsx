import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JournalEntry } from './JournalEntry';

const note = {
	id: 'note-1',
	title: 'Note #1',
	text: 'First line\nSecond line',
	timestamp: '0:20',
	dayLabel: 'Today',
	timeLabel: '10:00',
};

describe('JournalEntry', () => {
	it('preserves line breaks in displayed note text', () => {
		render(<JournalEntry note={note} />);

		const noteText = screen.getByText((_, element) => element?.textContent === 'First line\nSecond line');

		expect(noteText.tagName).toBe('P');
		expect(noteText).toHaveClass('whitespace-pre-wrap', 'break-words');
	});

	it('renders a bare URL in the note as a nofollow link that opens in the same tab', () => {
		render(
			<JournalEntry note={{ ...note, text: 'Source: https://cinemata.org/archive.\nAlso www.engagemedia.org' }} />
		);

		const link = screen.getByRole('link', { name: 'https://cinemata.org/archive' });
		expect(link).toHaveAttribute('href', 'https://cinemata.org/archive');
		expect(link).toHaveAttribute('rel', 'nofollow noopener');
		expect(link).not.toHaveAttribute('target');
		expect(screen.getByRole('link', { name: 'www.engagemedia.org' })).toHaveAttribute(
			'href',
			'https://www.engagemedia.org/'
		);
	});

	it('shows markup typed into a note as text', () => {
		const { container } = render(<JournalEntry note={{ ...note, text: '<img src=x onerror="alert(1)"> idea' }} />);

		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByText('<img src=x onerror="alert(1)"> idea')).toBeInTheDocument();
	});
});
