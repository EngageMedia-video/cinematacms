import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditDescriptionDialog } from './EditDescriptionDialog';
import usePlaylistUiStore from '../store/usePlaylistUiStore';
import { apiFetch } from '../../shared/utils/api';

vi.mock('../../shared/utils/api', () => ({
	apiFetch: vi.fn(),
}));

const LONG_DESCRIPTION = Array.from({ length: 500 }, (_, index) => `word${index}`).join(' ');

function renderDialog(playlist) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<EditDescriptionDialog config={{}} playlist={playlist} token="pltest01" />
		</QueryClientProvider>
	);
}

describe('EditDescriptionDialog', () => {
	beforeEach(() => {
		usePlaylistUiStore.getState().resetPlaylistUi();
		usePlaylistUiStore.getState().setDescriptionDialogOpen(true);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('shows a description longer than 450 words without truncating it', () => {
		renderDialog({ description: LONG_DESCRIPTION });

		expect(screen.getByLabelText('Description')).toHaveValue(LONG_DESCRIPTION);
	});

	it('submits the full description text', async () => {
		const user = userEvent.setup();
		apiFetch.mockResolvedValue({ ok: true, json: async () => ({ description: LONG_DESCRIPTION }) });

		renderDialog({ description: LONG_DESCRIPTION });
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(apiFetch).toHaveBeenCalledWith(
			expect.stringContaining('pltest01'),
			expect.objectContaining({ method: 'POST', body: { description: LONG_DESCRIPTION } })
		);
	});

	it('shows an error banner when the save fails', async () => {
		const user = userEvent.setup();
		apiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

		renderDialog({ description: 'Original' });
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(await screen.findByText('The description could not be saved. Try again.')).toBeInTheDocument();
	});
});
