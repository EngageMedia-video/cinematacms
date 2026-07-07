import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrivateJournalNotes } from './usePrivateJournalNotes';

function makeWrapper(client) {
	return function Wrapper({ children }) {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	};
}

describe('usePrivateJournalNotes', () => {
	let client;

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		client.clear();
	});

	it('combines paginated note results', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					count: 2,
					next: '/api/v1/media/film-token/private-journal?page=2',
					results: [{ uid: 'note-1', text: 'First note' }],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					count: 2,
					next: null,
					results: [{ uid: 'note-2', text: 'Second note' }],
				}),
			});

		const { result } = renderHook(() => usePrivateJournalNotes('film-token'), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual({
			count: 2,
			results: [
				{ uid: 'note-1', text: 'First note' },
				{ uid: 'note-2', text: 'Second note' },
			],
		});
		expect(globalThis.fetch).toHaveBeenNthCalledWith(1, '/api/v1/media/film-token/private-journal', {
			headers: { Accept: 'application/json' },
			credentials: 'same-origin',
		});
		expect(globalThis.fetch).toHaveBeenNthCalledWith(2, '/api/v1/media/film-token/private-journal?page=2', {
			headers: { Accept: 'application/json' },
			credentials: 'same-origin',
		});
	});

	it('surfaces an error when any page request fails', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });

		const { result } = renderHook(() => usePrivateJournalNotes('film-token'), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});
