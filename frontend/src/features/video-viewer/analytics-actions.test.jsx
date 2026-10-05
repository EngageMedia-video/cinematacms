import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSubmitComment } from './comments/hooks/useSubmitComment';
import { useDeleteComment } from './comments/hooks/useDeleteComment';
import { useSubmitPrivateJournalNote } from './private-journal/hooks/useSubmitPrivateJournalNote';
import { useUpdatePrivateJournalNote } from './private-journal/hooks/useUpdatePrivateJournalNote';
import { useDeletePrivateJournalNote } from './private-journal/hooks/useDeletePrivateJournalNote';
import { useMarkAsRead } from '../notifications/hooks/useMarkAsRead';
import { useMarkAllAsRead } from '../notifications/hooks/useMarkAllAsRead';

afterEach(() => {
	vi.unstubAllGlobals();
	delete window.CinemataAnalytics;
});

const actions = [
	['comment_success', useSubmitComment, 'A private test message'],
	['comment_delete', useDeleteComment, 'comment-id'],
	['journal_create', useSubmitPrivateJournalNote, { text: 'A secret note', timestampSeconds: 19 }],
	['journal_update', useUpdatePrivateJournalNote, { uid: 'note-id', text: 'A secret note' }],
	['journal_delete', useDeletePrivateJournalNote, 'note-id'],
	['notification_read', useMarkAsRead, 42],
	['notifications_read_all', useMarkAllAsRead, undefined],
];

it.each(actions)('%s fires once on success and sends no action contents', async (event, hook, input) => {
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	const track = vi.fn();
	window.CinemataAnalytics = { track };
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ uid: 'result' }) }))
	);
	const { result } = renderHook(() => hook('film-token'), { wrapper });
	act(() => result.current.mutate(input));
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	client.clear();
	expect(track).toHaveBeenCalledExactlyOnceWith(event);
});

it.each(actions)('%s does not count a failed request', async (_event, hook, input) => {
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	const track = vi.fn();
	window.CinemataAnalytics = { track };
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ detail: 'Denied' }) }))
	);
	const { result } = renderHook(() => hook('film-token'), { wrapper });
	act(() => result.current.mutate(input));
	await waitFor(() => expect(result.current.isError).toBe(true));
	client.clear();
	expect(track).not.toHaveBeenCalled();
});
