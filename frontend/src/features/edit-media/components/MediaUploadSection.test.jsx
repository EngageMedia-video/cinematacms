import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
});
