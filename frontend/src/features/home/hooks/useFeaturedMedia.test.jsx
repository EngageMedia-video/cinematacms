import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HOME_QUERY_KEYS } from '../queryClient';
import { useFeaturedMedia } from './useFeaturedMedia';
import { useIndexFeaturedPlaylists } from './useIndexFeaturedPlaylists';
import { usePlaylistMedia } from './usePlaylistMedia';
import { useRecentMedia } from './useRecentMedia';
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

// ── useRecentMedia ─────────────────────────────────────────────────────────

describe('useRecentMedia', () => {
	let client;

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		client.clear();
	});

	it('fetches the latest media feed for recent videos', async () => {
		const payload = { results: [{ id: 1, title: 'Recent Film' }] };
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => payload,
		});

		const { result } = renderHook(() => useRecentMedia(), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(payload);
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/media?show=latest');
	});

	it('surfaces isError: true when the recent media response is non-2xx', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });

		const { result } = renderHook(() => useRecentMedia(), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});

// ── useIndexFeaturedPlaylists ───────────────────────────────────────────────

describe('useIndexFeaturedPlaylists', () => {
	let client;

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 120_000 } } });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		client.clear();
	});

	it('fetches /api/v1/indexfeatured and returns configured homepage playlists', async () => {
		const payload = [{ title: 'Legacy Playlist', api_url: '/api/v1/playlists/abc123' }];
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => payload });

		const { result } = renderHook(() => useIndexFeaturedPlaylists(), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(payload);
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/indexfeatured');
	});

	it('surfaces isError: true when the response is non-2xx', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });

		const { result } = renderHook(() => useIndexFeaturedPlaylists(), { wrapper: makeWrapper(client) });

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});

// ── usePlaylistMedia ────────────────────────────────────────────────────────

describe('usePlaylistMedia', () => {
	let client;

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 120_000 } } });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		client.clear();
	});

	it('fetches a playlist api_url and returns the envelope', async () => {
		const payload = { title: 'Legacy Playlist', playlist_media: [{ id: 1, title: 'Playlist Film' }] };
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => payload });

		const { result } = renderHook(() => usePlaylistMedia('/api/v1/playlists/abc123'), {
			wrapper: makeWrapper(client),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(payload);
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/playlists/abc123');
	});

	it('surfaces isError: true when the response is non-2xx', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });

		const { result } = renderHook(() => usePlaylistMedia('/api/v1/playlists/abc123'), {
			wrapper: makeWrapper(client),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
	});

	it('does not fire a fetch when apiUrl is falsy', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		renderHook(() => usePlaylistMedia(null), { wrapper: makeWrapper(client) });

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
