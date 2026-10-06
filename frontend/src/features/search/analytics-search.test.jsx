import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMediaSearch } from './hooks/useMediaSearch';

afterEach(() => {
	vi.unstubAllGlobals();
	delete window.CinemataAnalytics;
});
it('counts settled empty searches once, excludes failures and does not send the query', async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	const track = vi.fn();
	window.CinemataAnalytics = { track };
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url) => ({
			ok: !url.includes('fail'),
			status: url.includes('fail') ? 500 : 200,
			json: async () => ({ count: url.includes('found') ? 1 : 0, results: [] }),
		}))
	);
	const { result, rerender } = renderHook(({ query }) => useMediaSearch({ query, filters: {}, sort: {}, page: 1 }), {
		wrapper,
		initialProps: { query: 'private-empty-query' },
	});
	await waitFor(() => expect(track).toHaveBeenCalledExactlyOnceWith('search_no_results'));
	await act(() => client.refetchQueries());
	expect(track).toHaveBeenCalledTimes(1);
	rerender({ query: 'fail' });
	await waitFor(() => expect(result.current.isError).toBe(true));
	expect(track).toHaveBeenCalledTimes(1);
	rerender({ query: 'found' });
	await waitFor(() => expect(result.current.data?.count).toBe(1));
	rerender({ query: 'private-empty-query' });
	await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
	expect(track.mock.calls).toEqual([['search_no_results'], ['search_no_results']]);
	client.clear();
});
