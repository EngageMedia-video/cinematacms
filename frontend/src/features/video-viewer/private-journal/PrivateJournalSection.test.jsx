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

	it('keeps the note list scrollable when notes are present', () => {
		render(
			<PrivateJournalSection
				initialNotes={[
					{ id: 'note-1', text: 'First saved thought', timestamp_seconds: 20 },
					{ id: 'note-2', text: 'Second saved thought', timestamp_seconds: 40 },
				]}
			/>
		);

		const listContainer = screen.getByText('First saved thought').closest('ul')?.parentElement;

		expect(listContainer).toHaveClass('max-h-[420px]', 'overflow-y-scroll', 'overscroll-contain');
		expect(listContainer?.className).toContain('[&::-webkit-scrollbar-thumb]:bg-text-dialog-accent');
	});
});
