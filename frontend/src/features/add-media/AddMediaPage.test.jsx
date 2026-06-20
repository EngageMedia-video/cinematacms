import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
