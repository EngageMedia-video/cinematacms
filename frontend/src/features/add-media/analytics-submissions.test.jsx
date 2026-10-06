import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSubmitSingle } from './single-upload/hooks/useSubmitSingle';
import { useSubmitEditMedia } from '../edit-media/hooks/useSubmitEditMedia';
import { useSubmitBulk } from './bulk-upload/hooks/useSubmitBulk';

afterEach(() => {
	vi.unstubAllGlobals();
	delete window.CinemataAnalytics;
});
function setup(hook) {
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	const trackEvents = vi.fn();
	window.CinemataAnalytics = { trackEvents };
	return { ...renderHook(hook, { wrapper }), trackEvents, client };
}

it.each([useSubmitSingle, useSubmitEditMedia])('forwards only server-confirmed metadata events', async (hook) => {
	const { result, trackEvents, client } = setup(hook);
	const form = document.createElement('form');
	form.action = '/edit?m=private-token';
	const events = [{ name: 'media_update', media: { id: 'opaque-uuid', context: 'workflow' } }];
	const response = vi
		.fn()
		.mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: async () => ({ errors: { title: ['Missing'] }, analytics_events: events }),
		})
		.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ success: true, analytics_events: events }),
		});
	vi.stubGlobal('fetch', response);
	act(() => result.current.mutate({ form }));
	await waitFor(() => expect(result.current.isError).toBe(true));
	expect(trackEvents).not.toHaveBeenCalled();
	act(() => result.current.mutate({ form }));
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(trackEvents).toHaveBeenCalledExactlyOnceWith(events);
	client.clear();
});

it('counts only successful files in a partially failed bulk submission', async () => {
	const { result, trackEvents, client } = setup(useSubmitBulk);
	const events = [{ name: 'media_draft_save' }];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url) =>
			url.includes('good-token')
				? { ok: true, status: 200, json: async () => ({ success: true, analytics_events: events }) }
				: {
						ok: false,
						status: 400,
						json: async () => ({ errors: { title: ['Missing'] }, analytics_events: events }),
					}
		)
	);
	act(() =>
		result.current.mutate({
			action: 'draft',
			files: [
				{ id: 1, friendlyToken: 'good-token', metadata: {} },
				{ id: 2, friendlyToken: 'bad-token', metadata: {} },
			],
		})
	);
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(result.current.data.succeeded).toHaveLength(1);
	expect(result.current.data.failed).toHaveLength(1);
	expect(trackEvents).toHaveBeenCalledExactlyOnceWith(events);
	client.clear();
});
