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

import { AddMediaPage } from './AddMediaPage';

describe('AddMediaPage multi-file single upload guard', () => {
	let addFiles;

	beforeEach(() => {
		window.MediaCMS = {
			addMediaPage: {
				allowedExtensions: ['mp4'],
				canAdd: true,
				canPublishDirectly: false,
				csrfToken: 'csrf-token',
				uploadCompleteEndpoint: '/fu/upload/complete/',
				uploadEndpoint: '/fu/upload/',
				uploadMaxFilesNumber: 1,
				uploadMaxSize: 1000000,
			},
		};

		addFiles = vi.fn();
		window.qq = {
			FineUploader: vi.fn(function FineUploaderMock() {
				this.addFiles = addFiles;
				this.cancel = vi.fn();
				this.reset = vi.fn();
			}),
			status: {},
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete window.MediaCMS;
		delete window.qq;
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
				uploadEndpoint: '/fu/upload/',
				uploadMaxFilesNumber: 1,
				uploadMaxSize: 1000000,
			},
		};
		window.qq = {
			FineUploader: vi.fn(function FineUploaderMock() {
				this.addFiles = vi.fn();
				this.cancel = vi.fn();
				this.reset = vi.fn();
			}),
			status: {},
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete window.matchMedia;
		delete window.MediaCMS;
		delete window.qq;
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
