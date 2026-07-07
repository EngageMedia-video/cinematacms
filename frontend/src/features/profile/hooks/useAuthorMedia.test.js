import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './useAuthorMedia';

function jsonResponse(body) {
	return { ok: true, json: async () => body };
}

describe('fetchAllPages', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('follows next links and returns the full catalog untruncated', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(jsonResponse({ results: [{ id: 1 }], next: '/api/v1/media?page=2' }))
			.mockResolvedValueOnce(jsonResponse({ results: [{ id: 2 }], next: '' }));

		const result = await fetchAllPages('/api/v1/media?author=jen');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.results).toEqual([{ id: 1 }, { id: 2 }]);
		expect(result.truncated).toBe(false);
	});

	it('returns the partial catalog and flags truncation past the page cap', async () => {
		// Every page keeps pointing at a next link, so the cap is hit.
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
			jsonResponse({ results: [{ id: 1 }], next: '/api/v1/media?page=next' })
		);

		const result = await fetchAllPages('/api/v1/media?author=prolific');

		// Partial results are returned rather than throwing and blanking the tab.
		expect(result.results.length).toBeGreaterThan(0);
		expect(result.truncated).toBe(true);
	});

	it('throws when a page request fails', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 500 });

		await expect(fetchAllPages('/api/v1/media?author=jen')).rejects.toThrow(/500/);
	});
});
