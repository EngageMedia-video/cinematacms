import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaUploadSection } from './MediaUploadSection';
import { REPLACEMENT_UPLOAD_QUERY_KEY } from '../hooks/useReplacementUploadState';

const CONFIG = {
	allowedExtensions: ['mp4'],
	csrfToken: 'csrf-token',
	media: {
		currentMediaFile: {
			name: 'current.mp4',
			url: '/media/current.mp4',
		},
	},
	uploadCancelEndpoint: '/upload/cancel/media-token/',
	uploadCompleteEndpoint: '/upload/complete/',
	uploadEndpoint: '/upload/',
	uploadMaxSize: 1000,
};

function renderMediaUploadSection(status) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	queryClient.setQueryData(REPLACEMENT_UPLOAD_QUERY_KEY, status);

	return render(
		<QueryClientProvider client={queryClient}>
			<MediaUploadSection config={CONFIG} />
		</QueryClientProvider>
	);
}

describe('MediaUploadSection', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps the staged replacement visible when server cancel fails', async () => {
		const user = userEvent.setup();
		vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false });

		renderMediaUploadSection({
			phase: 'complete',
			name: 'replacement.mp4',
			progress: 100,
			error: '',
			size: 512,
			id: 7,
		});

		await user.click(screen.getByRole('button', { name: 'Delete' }));

		await waitFor(() => {
			expect(screen.getByText('Could not remove the replacement upload. Please try again.')).toBeInTheDocument();
		});
		expect(screen.getByText('replacement.mp4')).toBeInTheDocument();
		expect(screen.queryByLabelText('Choose media file')).not.toBeInTheDocument();
	});

	describe('discarding a replacement', () => {
		let uploader;

		beforeEach(() => {
			vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true });
			window.CinemataAnalytics = { uploadEvent: vi.fn() };
			window.qq = {
				FineUploaderBasic: function FineUploaderBasic(options) {
					uploader = this;
					this.callbacks = options.callbacks;
					// Mirrors Fine Uploader's itemLimit: 1 bookkeeping.
					this.itemCount = 0;
					this.nextId = 0;
					this.addFiles = ([file]) => {
						if (this.itemCount >= 1) return;
						const id = this.nextId++;
						this.itemCount += 1;
						this.callbacks.onSubmit(id, file.name);
						this.callbacks.onSubmitted(id);
					};
					this.cancel = vi.fn((id) => {
						this.itemCount -= 1;
						this.callbacks.onCancel(id);
					});
					this.reset = vi.fn(() => {
						this.itemCount = 0;
					});
					this.getFile = () => ({ size: 512 });
					this.getUuid = (id) => `00000000-0000-4000-8000-00000000000${id}`;
					this.setCustomHeaders = vi.fn();
				},
			};
		});

		afterEach(() => {
			delete window.CinemataAnalytics;
			delete window.qq;
		});

		async function startReplacement(user) {
			renderMediaUploadSection({ phase: 'idle', name: '', progress: 0, error: '', size: null });
			await user.upload(
				screen.getByLabelText('Choose media files'),
				new File(['video'], 'replacement.mp4', { type: 'video/mp4' })
			);
		}

		function trackedActions() {
			return window.CinemataAnalytics.uploadEvent.mock.calls.map(([action]) => action);
		}

		it('sends the file uuid with the CSRF token as the headers of that upload', async () => {
			const user = userEvent.setup();
			await startReplacement(user);

			expect(uploader.setCustomHeaders).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({
					'X-CSRFToken': expect.any(String),
					'X-Upload-Id': '00000000-0000-4000-8000-000000000000',
				}),
				0
			);
		});

		it('does not count a finished upload as cancelled', async () => {
			const user = userEvent.setup();
			await startReplacement(user);
			act(() => uploader.callbacks.onComplete(0, 'replacement.mp4', { success: true }));

			await user.click(await screen.findByRole('button', { name: 'Delete' }));

			await waitFor(() => expect(trackedActions()).toContain('discard'));
			expect(uploader.cancel).not.toHaveBeenCalled();
			expect(trackedActions()).toEqual(['start', 'complete', 'discard']);
		});

		it('accepts a new file after a finished upload is deleted', async () => {
			const user = userEvent.setup();
			await startReplacement(user);
			act(() => uploader.callbacks.onComplete(0, 'replacement.mp4', { success: true }));

			await user.click(await screen.findByRole('button', { name: 'Delete' }));
			await user.upload(
				await screen.findByLabelText('Choose media files'),
				new File(['video'], 'second.mp4', { type: 'video/mp4' })
			);

			expect(await screen.findByText('second.mp4')).toBeInTheDocument();
		});

		it('stops a transfer that is still running', async () => {
			const user = userEvent.setup();
			await startReplacement(user);

			await user.click(screen.getByRole('button', { name: /cancel/i }));

			await waitFor(() => expect(trackedActions()).toContain('discard'));
			expect(uploader.cancel).toHaveBeenCalledWith(0);
			expect(trackedActions()).toEqual(['start', 'cancel', 'discard']);
		});
	});
});
