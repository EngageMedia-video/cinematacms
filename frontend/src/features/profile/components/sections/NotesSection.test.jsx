import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import profileQueryClient, { PROFILE_QUERY_KEYS } from '../../queryClient';
import { NotesSection } from './NotesSection';

function renderSection(author) {
	return render(
		<QueryClientProvider client={profileQueryClient}>
			<NotesSection author={author} />
		</QueryClientProvider>
	);
}

describe('NotesSection', () => {
	beforeEach(() => {
		profileQueryClient.clear();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shows the empty state for non-owners without fetching', () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		renderSection({ username: 'jen', is_owner: false });

		expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('renders the owner notes with media context and timestamp deep-link', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({
				results: [
					{
						uid: 'n1',
						text: 'Latest note',
						timestamp_seconds: 65,
						add_date: '2026-07-11T05:12:00Z',
						media: {
							title: 'My Film',
							friendly_token: 'abc',
							url: '/view?m=abc',
							thumbnail_url: '',
							duration: 120,
						},
					},
					{
						uid: 'n2',
						text: 'Older note',
						timestamp_seconds: 30,
						add_date: '2026-07-10T05:12:00Z',
						media: {
							title: 'My Film',
							friendly_token: 'abc',
							url: '/view?m=abc',
							thumbnail_url: '',
							duration: 120,
						},
					},
				],
				next: '',
			}),
		});

		renderSection({ username: 'jen', is_owner: true });

		await waitFor(() => expect(screen.getByText('Latest note')).toBeInTheDocument());
		expect(screen.queryByText('Older note')).not.toBeInTheDocument();
		expect(screen.getByText('Last Note')).toBeInTheDocument();
		// The note timestamp (1:05) shows beside the card; the film duration
		// (2:00) shows as a pill on the thumbnail.
		expect(screen.getByText('1:05')).toBeInTheDocument();
		expect(screen.getByText('2:00')).toBeInTheDocument();
		const link = screen.getByRole('link', { name: /open my film at 1:05/i });
		expect(link).toHaveAttribute('href', '/view?m=abc&t=65');
		expect(screen.getByRole('link', { name: /view all 2 notes on this film/i })).toHaveAttribute(
			'href',
			'/view?m=abc'
		);
	});

	it('shows the empty state when the owner has no notes', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ results: [], next: '' }),
		});

		renderSection({ username: 'jen', is_owner: true });

		await waitFor(() => expect(screen.getByText(/no notes yet/i)).toBeInTheDocument());
	});
});
