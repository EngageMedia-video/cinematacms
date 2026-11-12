import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../static/js/contexts/UserContext', async () => {
	const React = await import('react');

	return {
		default: React.createContext({
			is: {
				admin: false,
				anonymous: false,
			},
		}),
	};
});

vi.mock('../../static/js/pages/_Page', async () => {
	const React = await import('react');

	return {
		Page: class Page extends React.PureComponent {
			render() {
				return this.pageContent();
			}
		},
	};
});

vi.mock('./bulk-upload/components/BulkUploadPage.jsx', async () => {
	const React = await import('react');

	return {
		default: function BulkUploadPageMock() {
			return React.createElement('div', null, 'Bulk upload workflow');
		},
	};
});

vi.mock('../../static/js/mediacms/config.js', () => ({
	config: () => ({ api: { media: '/api/v1/media' } }),
}));

const tus = vi.hoisted(() => ({ create: null }));
vi.mock('../shared/utils/tusUpload', async (importOriginal) => ({
	...(await importOriginal()),
	createTusUploader: (options) => tus.create(options),
}));

import { AddMediaPage } from './AddMediaPage';
import useBulkUploadStore from './bulk-upload/useBulkUploadStore';

describe('AddMediaPage multi-file single upload guard', () => {
	let addFiles;

	beforeEach(() => {
		window.MediaCMS = {
			addMediaPage: {
				allowedExtensions: ['mp4'],
				canAdd: true,
				canPublishDirectly: false,
				csrfToken: 'csrf-token',
				uploadEndpoint: '/fu/tus/',
				uploadMaxFilesNumber: 1,
				uploadMaxSize: 1000000,
			},
		};

		addFiles = vi.fn();
		tus.create = () => ({ addFiles, cancel: vi.fn(), remove: vi.fn(), reset: vi.fn() });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete window.MediaCMS;
		tus.create = null;
	});

	function dropMultipleFiles() {
		const dropzone = document.querySelector('[data-dropzone]');
		const firstFile = new File(['first'], 'first.mp4', { type: 'video/mp4' });
		const secondFile = new File(['second'], 'second.mp4', { type: 'video/mp4' });

		fireEvent.drop(dropzone, { dataTransfer: { files: [firstFile, secondFile] } });
	}

	it('cancels a multi-file drop when the user cancels the confirmation', async () => {
		const user = userEvent.setup();
		render(<AddMediaPage />);

		dropMultipleFiles();

		expect(await screen.findByRole('dialog', { name: 'Multiple media upload confirmation' })).toBeInTheDocument();
		expect(addFiles).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		await waitFor(() =>
			expect(screen.queryByRole('dialog', { name: 'Multiple media upload confirmation' })).not.toBeInTheDocument()
		);
		expect(addFiles).not.toHaveBeenCalled();
		expect(screen.getByRole('tab', { name: 'Single Film Upload' })).toHaveAttribute('aria-selected', 'true');
	});

	it('cancels a multi-file drop and switches to bulk upload when the user proceeds', async () => {
		const user = userEvent.setup();
		render(<AddMediaPage />);

		dropMultipleFiles();

		expect(await screen.findByRole('dialog', { name: 'Multiple media upload confirmation' })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Proceed' }));

		await waitFor(() =>
			expect(screen.queryByRole('dialog', { name: 'Multiple media upload confirmation' })).not.toBeInTheDocument()
		);
		expect(addFiles).not.toHaveBeenCalled();
		expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByText('Bulk upload workflow')).toBeInTheDocument();
	});
});

describe('AddMediaPage bulk upload viewport gate', () => {
	let mediaQuery;

	function stubViewport(isNarrow) {
		mediaQuery = {
			matches: isNarrow,
			media: '',
			addEventListener: vi.fn((type, listener) => {
				mediaQuery.listener = listener;
			}),
			removeEventListener: vi.fn(),
		};
		window.matchMedia = vi.fn((query) => {
			mediaQuery.media = query;
			return mediaQuery;
		});
	}

	function resizeViewport(isNarrow) {
		act(() => mediaQuery.listener({ matches: isNarrow }));
	}

	beforeEach(() => {
		window.MediaCMS = {
			addMediaPage: {
				allowedExtensions: ['mp4'],
				canAdd: true,
				uploadEndpoint: '/fu/tus/',
				uploadMaxFilesNumber: 1,
				uploadMaxSize: 1000000,
			},
		};
		tus.create = () => ({ addFiles: vi.fn(), cancel: vi.fn(), remove: vi.fn(), reset: vi.fn() });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete window.matchMedia;
		delete window.MediaCMS;
		tus.create = null;
	});

	it('watches the viewport below the 1024px desktop breakpoint', () => {
		stubViewport(false);
		render(<AddMediaPage />);

		expect(mediaQuery.media).toBe('(max-width: 1023px)');
	});

	it('hides bulk upload on a mobile or tablet viewport', () => {
		stubViewport(true);
		render(<AddMediaPage />);

		expect(screen.queryByRole('tab', { name: 'Bulk Upload' })).not.toBeInTheDocument();
		expect(screen.queryByRole('tab', { name: 'Single Film Upload' })).not.toBeInTheDocument();
	});

	it('offers bulk upload on a desktop viewport and follows viewport changes', () => {
		stubViewport(false);
		render(<AddMediaPage />);

		expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toBeInTheDocument();

		resizeViewport(true);
		expect(screen.queryByRole('tab', { name: 'Bulk Upload' })).not.toBeInTheDocument();

		resizeViewport(false);
		expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toBeInTheDocument();
	});

	it('stops watching the viewport after unmount', () => {
		stubViewport(false);
		const { unmount } = render(<AddMediaPage />);
		const { listener } = mediaQuery;

		unmount();

		expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', listener);
	});
});

describe('AddMediaPage leaving the page', () => {
	let uploaderOptions;
	let uploader;

	beforeEach(() => {
		window.MediaCMS = {
			addMediaPage: {
				allowedExtensions: ['mp4'],
				canAdd: true,
				uploadEndpoint: '/fu/tus/',
				uploadMaxFilesNumber: 1,
				uploadMaxSize: 1000000,
			},
		};
		tus.create = (options) => {
			uploaderOptions = options;
			uploader = {
				addFiles: vi.fn(),
				cancel: vi.fn((id) => options.callbacks.onCancel(id)),
				remove: vi.fn(),
				reset: vi.fn(),
				pauseUpload: vi.fn(() => true),
				continueUpload: vi.fn(() => true),
				retry: vi.fn(() => true),
				getSize: () => 2048,
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
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		delete window.MediaCMS;
		tus.create = null;
	});

	// Hiding the page also happens on reload, on closing an old tab and on a tab discard,
	// so it never means the user discarded the upload.
	it('keeps completed single and bulk uploads when the page is hidden', () => {
		render(<AddMediaPage />);
		act(() => uploaderOptions.callbacks.onComplete(0, 'river.mp4', { media_url: '/view?m=single123' }));
		act(() => useBulkUploadStore.setState({ files: [{ id: 'bulk-1', friendlyToken: 'bulk456' }] }));

		window.dispatchEvent(new Event('pagehide'));

		const requestedUrls = fetch.mock.calls.map(([url]) => url);
		expect(requestedUrls.filter((url) => url.includes('/abandon'))).toEqual([]);
	});

	describe('single upload list', () => {
		function startUpload() {
			render(<AddMediaPage />);
			act(() => uploaderOptions.callbacks.onSubmitted(0, 'river.mp4'));
		}

		function listItem() {
			return screen.getByText('river.mp4').closest('[data-upload-status]');
		}

		it('shows a selected file as uploading with its progress', () => {
			startUpload();
			act(() => uploaderOptions.callbacks.onProgress(0, 'river.mp4', 512, 2048));

			expect(listItem()).toHaveAttribute('data-upload-status', 'uploading');
			expect(screen.getByText('25% (2 KB)')).toBeInTheDocument();
		});

		it('shows processing once every byte is sent, and complete when the media exists', () => {
			startUpload();
			act(() => uploaderOptions.callbacks.onProgress(0, 'river.mp4', 2048, 2048));
			expect(listItem()).toHaveAttribute('data-upload-status', 'processing');

			act(() => uploaderOptions.callbacks.onStatusChange(0, 'complete', ''));
			act(() => uploaderOptions.callbacks.onComplete(0, 'river.mp4', { media_url: '/view?m=single123' }));

			expect(listItem()).toHaveAttribute('data-upload-status', 'complete');
		});

		it('asks the user to sign in again and continues the same upload', async () => {
			const user = userEvent.setup();
			startUpload();

			act(() => uploaderOptions.callbacks.onStatusChange(0, 'awaiting-sign-in', 'Sign in again to continue.'));

			expect(listItem()).toHaveAttribute('data-upload-status', 'paused');
			expect(screen.getByText('Sign in again to continue.')).toBeInTheDocument();

			await user.click(screen.getByRole('button', { name: 'Continue' }));

			expect(uploader.continueUpload).toHaveBeenCalledExactlyOnceWith(0);
		});

		it('shows an expired upload as failed with its message and retries it', async () => {
			const user = userEvent.setup();
			startUpload();

			act(() => uploaderOptions.callbacks.onStatusChange(0, 'expired', 'This upload expired.'));

			expect(listItem()).toHaveAttribute('data-upload-status', 'failed');
			expect(screen.getByText('This upload expired.')).toBeInTheDocument();

			await user.click(screen.getByRole('button', { name: 'Retry' }));

			expect(uploader.retry).toHaveBeenCalledExactlyOnceWith(0);
		});

		it('pauses a running upload', async () => {
			const user = userEvent.setup();
			startUpload();

			await user.click(screen.getByRole('button', { name: 'Pause' }));

			expect(uploader.pauseUpload).toHaveBeenCalledExactlyOnceWith(0);
		});

		it('removes a cancelled upload and offers the dropzone again', async () => {
			const user = userEvent.setup();
			startUpload();

			await user.click(screen.getByRole('button', { name: 'Cancel' }));

			expect(uploader.cancel).toHaveBeenCalledExactlyOnceWith(0);
			expect(screen.queryByText('river.mp4')).not.toBeInTheDocument();
		});

		it('explains why a selected file was refused', async () => {
			const user = userEvent.setup();
			render(<AddMediaPage />);

			act(() => uploaderOptions.callbacks.onError(null, 'notes.txt', 'notes.txt has an invalid extension.'));

			const notice = await screen.findByRole('dialog', { name: 'Upload notice' });
			expect(notice).toHaveTextContent('notes.txt has an invalid extension.');

			await user.click(screen.getByRole('button', { name: 'Close' }));

			await waitFor(() =>
				expect(screen.queryByRole('dialog', { name: 'Upload notice' })).not.toBeInTheDocument()
			);
		});
	});
});
