import { act, renderHook } from '@testing-library/react';
import useBulkUploadStore from '../useBulkUploadStore';
import { useBulkUpload } from './useBulkUpload';

const tus = vi.hoisted(() => ({ create: null }));
vi.mock('../../../shared/utils/tusUpload', async (importOriginal) => ({
	...(await importOriginal()),
	createTusUploader: (options) => tus.create(options),
}));

describe('useBulkUpload engine bookkeeping', () => {
	let callbacks;
	let uploader;

	beforeEach(() => {
		tus.create = (options) => {
			callbacks = options.callbacks;
			uploader = {
				addFiles: vi.fn(),
				remove: vi.fn(),
				cancel: vi.fn(),
				cancelAll: vi.fn(),
				getFile: (id) => new File(['video'], `film-${id}.mp4`),
				getSize: () => 5,
			};
			return uploader;
		};
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: true, json: async () => ({}) }))
		);
	});

	afterEach(() => {
		useBulkUploadStore.getState().reset();
		tus.create = null;
		vi.unstubAllGlobals();
	});

	function startTwoUploads() {
		const hook = renderHook(useBulkUpload);
		act(() => {
			callbacks.onSubmitted(0, 'film-0.mp4');
			callbacks.onSubmitted(1, 'film-1.mp4');
		});
		return hook;
	}

	it('keeps the engine files of rows that are still listed', () => {
		startTwoUploads();

		expect(uploader.remove).not.toHaveBeenCalled();
	});

	it('releases the engine file when a row is removed from the store', () => {
		startTwoUploads();

		act(() => useBulkUploadStore.getState().removeFile(1));

		expect(uploader.remove).toHaveBeenCalledExactlyOnceWith(1);
	});

	it('releases every engine file when the store is reset', () => {
		startTwoUploads();

		act(() => useBulkUploadStore.getState().reset());

		expect(uploader.remove.mock.calls).toEqual([[0], [1]]);
	});

	it('releases the old file before a reupload adds its replacement', () => {
		const { result } = startTwoUploads();
		const order = [];
		uploader.remove.mockImplementation((id) => order.push(['remove', id]));
		uploader.addFiles.mockImplementation(([file]) => order.push(['add', file.name]));

		act(() => result.current.reupload(1));

		expect(order).toEqual([
			['remove', 1],
			['add', 'film-1.mp4'],
		]);
	});
});
