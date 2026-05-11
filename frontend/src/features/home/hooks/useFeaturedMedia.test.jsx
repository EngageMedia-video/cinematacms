import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HOME_QUERY_KEYS } from '../queryClient';
import { useFeaturedMedia } from './useFeaturedMedia';
import { useCategoryMedia } from './useCategoryMedia';
import { readInitialDataFromDom } from '../initialData';

// ── readInitialDataFromDom ──────────────────────────────────────────────────

describe('readInitialDataFromDom', () => {
	afterEach(() => {
		document.querySelectorAll('script[type="application/json"]').forEach((el) => el.remove());
	});

	function injectScriptTag(id, content) {
		const el = document.createElement('script');
		el.type = 'application/json';
		el.id = id;
		el.textContent = content;
		document.body.appendChild(el);
	}

	it('returns null when both script tags are absent', () => {
		expect(readInitialDataFromDom()).toBeNull();
	});

	it('returns null when only one script tag is present', () => {
		injectScriptTag('home-initial-data-featured', '[]');
		expect(readInitialDataFromDom()).toBeNull();
	});

	it('returns null when JSON.parse throws (malformed JSON)', () => {
		injectScriptTag('home-initial-data-featured', 'not json {{{');
		injectScriptTag('home-initial-data-recommended', '[]');
		expect(readInitialDataFromDom()).toBeNull();
	});

	it('returns { featured, recommended } when both tags contain valid JSON arrays', () => {
		const featured = [{ id: 1, title: 'Featured' }];
		const recommended = [{ id: 2, title: 'Recommended' }];
		injectScriptTag('home-initial-data-featured', JSON.stringify(featured));
		injectScriptTag('home-initial-data-recommended', JSON.stringify(recommended));

		const result = readInitialDataFromDom();
		expect(result).toEqual({ featured, recommended });
	});
});

// ── useFeaturedMedia ────────────────────────────────────────────────────────

function makeWrapper(client) {
	return function Wrapper({ children }) {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	};
}

describe('useFeaturedMedia', () => {
	let client;

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		client.clear();
	});

	it('returns seeded data without firing a network request when cache is pre-populated', async () => {
		const seeded = [{ id: 99, title: 'Seeded' }];
		client.setQueryData(HOME_QUERY_KEYS.featured, seeded);

		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const { result } = renderHook(() => useFeaturedMedia(), { wrapper: makeWrapper(client) });

		expect(result.current.data).toEqual(seeded);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('performs a fetch and returns data when no seed exists', async () => {
		const payload = [{ id: 1, title: 'From API' }];
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => payload,
		});

		const { result } = renderHook(() => useFeaturedMedia(), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(payload);
	});

	it('surfaces isError: true when the response status is non-2xx', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });

		const { result } = renderHook(() => useFeaturedMedia(), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});

// ── useCategoryMedia ────────────────────────────────────────────────────────

describe('useCategoryMedia', () => {
	let client;

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 120_000 } } });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		client.clear();
	});

	it('fetches /api/v1/search?c=<searchTerm> and returns the envelope', async () => {
		const payload = { count: 1, results: [{ id: 1, title: 'Gender Film' }] };
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => payload });

		const { result } = renderHook(() => useCategoryMedia('Gender'), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(payload);
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/search?c=Gender');
	});

	it('encodes special characters in the search term', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });

		const { result } = renderHook(() => useCategoryMedia('Gender & Sexuality'), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/search?c=Gender%20%26%20Sexuality');
	});

	it('surfaces isError: true when the response is non-2xx', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });

		const { result } = renderHook(() => useCategoryMedia('Film'), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isError).toBe(true));
	});

	it('does not fire a fetch when searchTerm is empty', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		renderHook(() => useCategoryMedia(''), { wrapper: makeWrapper(client) });

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
