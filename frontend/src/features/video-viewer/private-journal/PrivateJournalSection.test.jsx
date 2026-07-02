import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrivateJournalSection } from './PrivateJournalSection';

vi.mock('./utils/journalMedia', async (importOriginal) => ({
	...(await importOriginal()),
	getCurrentPlayerTime: () => 150,
}));

describe('PrivateJournalSection', () => {
	it('shows private journal empty state', () => {
		render(<PrivateJournalSection />);

		expect(screen.getByRole('heading', { name: 'Your Film Notes' })).toBeInTheDocument();
		expect(screen.getByText('No Documented Thoughts')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Write a Note')).toBeInTheDocument();
	});

	it('adds a private note from the input', () => {
		render(<PrivateJournalSection />);

		fireEvent.change(screen.getByPlaceholderText('Write a Note'), {
			target: { value: 'I enjoyed how this was handled at 2:58, it did not feel forced.' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'ADD NOTE' }));

		expect(screen.getByText('Note #1')).toBeInTheDocument();
		expect(screen.getByText('2:30')).toBeInTheDocument();
		expect(screen.queryByText('No Documented Thoughts')).not.toBeInTheDocument();
	});
});
