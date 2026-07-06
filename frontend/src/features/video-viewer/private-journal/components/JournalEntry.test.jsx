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
});
