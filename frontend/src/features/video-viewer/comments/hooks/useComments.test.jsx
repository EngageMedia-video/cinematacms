import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useComments } from './useComments';

function wrapper({ children }) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const respondWith = (status, body) =>
	vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	});

describe('useComments access refusals', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('treats 403 as a disabled thread rather than a load error', async () => {
		// Issue #907: the endpoint now answers 403 for any film the viewer
		// cannot open, private and token-less restricted alike.
		vi.stubGlobal('fetch', respondWith(403, { detail: 'bad permissions' }));

		const { result } = renderHook(() => useComments('tok'), { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({ results: [], count: 0, commentsDisabled: true });
	});

	it('still understands the pre-#907 400 refusal', async () => {
		vi.stubGlobal('fetch', respondWith(400, { detail: 'media is private' }));

		const { result } = renderHook(() => useComments('tok'), { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data.commentsDisabled).toBe(true);
	});

	it('surfaces any other failure as an error', async () => {
		vi.stubGlobal('fetch', respondWith(500, {}));

		const { result } = renderHook(() => useComments('tok'), { wrapper });

		await waitFor(() => expect(result.current.isError).toBe(true));
	});

	it('returns the thread when the request succeeds', async () => {
		vi.stubGlobal('fetch', respondWith(200, { count: 1, results: [{ uid: 'a' }] }));

		const { result } = renderHook(() => useComments('tok'), { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({ results: [{ uid: 'a' }], count: 1, commentsDisabled: false });
	});
});
