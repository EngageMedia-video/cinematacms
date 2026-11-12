import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useBulkUpload } from './useBulkUpload';

const tus = vi.hoisted(() => ({ create: null }));
vi.mock('../../../shared/utils/tusUpload', async (importOriginal) => ({
	...(await importOriginal()),
	createTusUploader: (options) => tus.create(options),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	tus.create = null;
	delete window.CinemataAnalytics;
});
it('tracks accepted transfers and completion, omitting byte progress and disposal cancellation', async () => {
	let callbacks;
	const uploadEvent = vi.fn();
	window.CinemataAnalytics = { uploadEvent };
	tus.create = (options) => {
		callbacks = options.callbacks;
		return {
			getFile: () => new File(['contents'], 'secret-film.mp4'),
			getSize: () => 8,
			cancelAll: () => callbacks.onCancel(1),
		};
	};
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, json: async () => ({}) }))
	);
	const { unmount } = renderHook(useBulkUpload);
	act(() => callbacks.onSubmitted(1, 'secret-film.mp4'));
	act(() => callbacks.onProgress(1, 'secret-film.mp4', 4, 8));
	expect(uploadEvent).toHaveBeenCalledExactlyOnceWith('start', 1);
	await act(async () => callbacks.onComplete(1, 'secret-film.mp4', { media_url: '/view?m=secret-token' }));
	expect(uploadEvent.mock.calls).toEqual([
		['start', 1],
		['complete', 1],
	]);
	unmount();
	expect(uploadEvent.mock.calls).toEqual([
		['start', 1],
		['complete', 1],
	]);
});
