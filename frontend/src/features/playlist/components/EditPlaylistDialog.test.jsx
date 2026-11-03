import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditPlaylistDialog } from './EditPlaylistDialog';
import usePlaylistUiStore from '../store/usePlaylistUiStore';
import { playlistQueryKey } from '../hooks/usePlaylistQuery';
import { apiFetch } from '../../shared/utils/api';

vi.mock('../../shared/utils/api', () => ({
	apiFetch: vi.fn(),
}));

const LONG_DESCRIPTION = Array.from({ length: 500 }, (_, index) => `word${index}`).join(' ');
const CURATOR_NOTE_HINT =
	'Explain why these films belong together. Links you paste here become clickable automatically.';
const SAVE_ERROR = 'Your changes could not be saved. Try again.';
const TOKEN = 'pltest01';

function renderDialog(playlist) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	queryClient.setQueryData(playlistQueryKey(TOKEN), playlist);
	render(
		<QueryClientProvider client={queryClient}>
			<EditPlaylistDialog config={{}} playlist={playlist} token={TOKEN} />
		</QueryClientProvider>
	);
	return queryClient;
}

function succeedWith(data) {
	apiFetch.mockResolvedValue({ ok: true, json: async () => data });
}

function sentBody() {
	return apiFetch.mock.calls[0][1].body;
}

describe('EditPlaylistDialog', () => {
	beforeEach(() => {
		usePlaylistUiStore.getState().resetPlaylistUi();
		usePlaylistUiStore.getState().setEditDialogOpen(true);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('is labelled as a playlist editor', () => {
		renderDialog({ title: 'Trusted Playlist', description: '' });

		expect(screen.getByRole('dialog', { name: 'Edit playlist' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Edit Playlist' })).toBeInTheDocument();
		expect(screen.getByText("Update your playlist title and Curator's Note.")).toBeInTheDocument();
	});

	it('prefills the title with a character count and the Curator’s Note', () => {
		renderDialog({ title: 'Trusted Playlist', description: 'Why these films' });

		expect(screen.getByLabelText('Title')).toHaveValue('Trusted Playlist');
		expect(screen.getByText('16/90')).toBeInTheDocument();
		expect(screen.getByLabelText("Curator's Note")).toHaveValue('Why these films');
	});

	it('describes the Curator’s Note with a muted hint rather than the accent helper text', () => {
		renderDialog({ title: 'Trusted Playlist', description: '' });

		expect(screen.getByLabelText("Curator's Note")).toHaveAccessibleDescription(CURATOR_NOTE_HINT);
		expect(screen.getByText(CURATOR_NOTE_HINT)).toHaveClass('text-text-muted');
		expect(screen.getByText(CURATOR_NOTE_HINT)).not.toHaveClass('text-text-accent');
	});

	it('caps the title at 90 characters', () => {
		renderDialog({ title: 'Trusted Playlist', description: '' });

		expect(screen.getByLabelText('Title')).toHaveAttribute('maxlength', '90');
	});

	it('shows a description longer than 450 words without truncating it', () => {
		renderDialog({ title: 'Trusted Playlist', description: LONG_DESCRIPTION });

		expect(screen.getByLabelText("Curator's Note")).toHaveValue(LONG_DESCRIPTION);
	});

	it('sends only the trimmed title when only the title changed', async () => {
		const user = userEvent.setup();
		succeedWith({ title: 'Coastal Futures', description: 'Why these films' });

		renderDialog({ title: 'Trusted Playlist', description: 'Why these films' });
		await user.clear(screen.getByLabelText('Title'));
		await user.type(screen.getByLabelText('Title'), '  Coastal Futures  ');
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(apiFetch).toHaveBeenCalledWith(
			expect.stringContaining(TOKEN),
			expect.objectContaining({ method: 'POST' })
		);
		expect(sentBody()).toEqual({ title: 'Coastal Futures' });
	});

	it('saves when Enter is pressed in the title', async () => {
		const user = userEvent.setup();
		succeedWith({ title: 'Coastal Futures', description: 'Why these films' });

		renderDialog({ title: 'Trusted Playlist', description: 'Why these films' });
		await user.clear(screen.getByLabelText('Title'));
		await user.type(screen.getByLabelText('Title'), 'Coastal Futures{Enter}');

		expect(sentBody()).toEqual({ title: 'Coastal Futures' });
	});

	it('closes on Cancel without saving', async () => {
		const user = userEvent.setup();

		renderDialog({ title: 'Trusted Playlist', description: 'Why these films' });
		await user.type(screen.getByLabelText('Title'), ' edited');
		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(apiFetch).not.toHaveBeenCalled();
		expect(usePlaylistUiStore.getState().editDialogOpen).toBe(false);
	});

	it('stays open on Escape while a save is pending, then shows a failure', async () => {
		const user = userEvent.setup();
		let failSave;
		apiFetch.mockReturnValue(
			new Promise((resolve) => {
				failSave = () => resolve({ ok: false, status: 500, json: async () => ({}) });
			})
		);

		renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.clear(screen.getByLabelText('Title'));
		await user.type(screen.getByLabelText('Title'), 'Coastal Futures');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await user.keyboard('{Escape}');

		expect(screen.getByRole('dialog', { name: 'Edit playlist' })).toBeInTheDocument();

		await act(async () => failSave());

		expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument();
		expect(screen.getByLabelText('Title')).toHaveValue('Coastal Futures');
	});

	it('locks both fields while a save is pending so no later edit is dropped', async () => {
		const user = userEvent.setup();
		apiFetch.mockReturnValue(new Promise(() => {}));

		renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.clear(screen.getByLabelText('Title'));
		await user.type(screen.getByLabelText('Title'), 'Coastal Futures');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await user.type(screen.getByLabelText('Title'), ' later');
		await user.type(screen.getByLabelText("Curator's Note"), ' later');

		expect(screen.getByLabelText('Title')).toHaveValue('Coastal Futures');
		expect(screen.getByLabelText("Curator's Note")).toHaveValue('Original');
	});

	it('starts from the current playlist each time it reopens', async () => {
		const user = userEvent.setup();

		renderDialog({ title: 'Trusted Playlist', description: 'Why these films' });
		await user.type(screen.getByLabelText('Title'), ' edited');
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		act(() => usePlaylistUiStore.getState().setEditDialogOpen(true));

		expect(screen.getByLabelText('Title')).toHaveValue('Trusted Playlist');
	});

	it('sends only the description when only the description changed', async () => {
		const user = userEvent.setup();
		succeedWith({ title: 'Trusted Playlist', description: LONG_DESCRIPTION });

		renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.clear(screen.getByLabelText("Curator's Note"));
		await user.click(screen.getByLabelText("Curator's Note"));
		await user.paste(LONG_DESCRIPTION);
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(sentBody()).toEqual({ description: LONG_DESCRIPTION });
	});

	it('closes without a request when nothing changed', async () => {
		const user = userEvent.setup();

		renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.type(screen.getByLabelText('Title'), '   ');
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(apiFetch).not.toHaveBeenCalled();
		expect(usePlaylistUiStore.getState().editDialogOpen).toBe(false);
	});

	it('requires a title and does not save an empty one', async () => {
		const user = userEvent.setup();

		renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.clear(screen.getByLabelText('Title'));

		expect(screen.getByText('Title is required.')).toBeInTheDocument();
		expect(screen.getByText('0/90')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(apiFetch).not.toHaveBeenCalled();
		expect(usePlaylistUiStore.getState().editDialogOpen).toBe(true);
	});

	it('rejects a whitespace-only title on save', async () => {
		const user = userEvent.setup();

		renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.clear(screen.getByLabelText('Title'));
		await user.type(screen.getByLabelText('Title'), '   ');
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.getByText('Title is required.')).toBeInTheDocument();
		expect(apiFetch).not.toHaveBeenCalled();
	});

	it('updates the cached title once the save succeeds', async () => {
		const user = userEvent.setup();
		succeedWith({ title: 'Coastal Futures', description: 'Original' });

		const queryClient = renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.clear(screen.getByLabelText('Title'));
		await user.type(screen.getByLabelText('Title'), 'Coastal Futures');
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(queryClient.getQueryData(playlistQueryKey(TOKEN)).title).toBe('Coastal Futures');
		expect(usePlaylistUiStore.getState().editDialogOpen).toBe(false);
	});

	it('restores the cached title and shows an error when the save fails', async () => {
		const user = userEvent.setup();
		apiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

		const queryClient = renderDialog({ title: 'Trusted Playlist', description: 'Original' });
		await user.clear(screen.getByLabelText('Title'));
		await user.type(screen.getByLabelText('Title'), 'Coastal Futures');
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument();
		expect(queryClient.getQueryData(playlistQueryKey(TOKEN)).title).toBe('Trusted Playlist');
		expect(screen.getByLabelText("Curator's Note")).toHaveAccessibleDescription(
			`${CURATOR_NOTE_HINT} ${SAVE_ERROR}`
		);
	});
});
