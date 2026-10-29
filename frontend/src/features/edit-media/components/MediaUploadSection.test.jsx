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
					this.addFiles = ([file]) => {
						this.callbacks.onSubmit(0, file.name);
						this.callbacks.onSubmitted(0);
					};
					this.cancel = vi.fn((id) => this.callbacks.onCancel(id));
					this.getFile = () => ({ size: 512 });
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

		it('does not count a finished upload as cancelled', async () => {
			const user = userEvent.setup();
			await startReplacement(user);
			act(() => uploader.callbacks.onComplete(0, 'replacement.mp4', { success: true }));

			await user.click(await screen.findByRole('button', { name: 'Delete' }));

			await waitFor(() => expect(trackedActions()).toContain('discard'));
			expect(uploader.cancel).not.toHaveBeenCalled();
			expect(trackedActions()).toEqual(['start', 'complete', 'discard']);
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
