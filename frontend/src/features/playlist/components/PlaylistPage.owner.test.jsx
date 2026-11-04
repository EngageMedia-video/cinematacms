import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaylistPage } from './PlaylistPage';
import usePlaylistUiStore from '../store/usePlaylistUiStore';
import { apiFetch } from '../../shared/utils/api';

vi.mock('../../shared/utils/api', () => ({
	apiFetch: vi.fn(),
}));

vi.mock('../../../static/js/mediacms/config', () => ({
	config: () => ({
		member: { username: 'owner', is: { anonymous: false } },
		api: { playlists: '/api/v1/playlists' },
	}),
}));

vi.mock('./FilmList', () => ({ FilmList: () => null }));

function playlist(overrides) {
	return {
		title: 'Trusted Playlist',
		description: 'Why these films belong together',
		user: 'owner',
		add_date: '2026-10-01T00:00:00Z',
		media_count: 0,
		playlist_media: [],
		...overrides,
	};
}

async function renderOwnerPage(data) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, status: 200, json: async () => data }))
	);
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={queryClient}>
			<PlaylistPage />
		</QueryClientProvider>
	);
	await screen.findByRole('heading', { level: 1 });
}

describe('PlaylistPage owner editing', () => {
	beforeEach(() => {
		window.MediaCMS = { playlistId: 'pl-token' };
		window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
		usePlaylistUiStore.getState().resetPlaylistUi();
	});

	afterEach(() => {
		delete window.MediaCMS;
		delete window.matchMedia;
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('labels the Curator’s Note card and its edit action', async () => {
		await renderOwnerPage(playlist());

		const card = screen.getByRole('heading', { name: "Curator's Note" }).closest('div').parentElement;
		expect(within(card).getByRole('button', { name: 'Edit Playlist' })).toBeInTheDocument();
	});

	it('offers Edit Playlist on an empty Curator’s Note and keeps its prompt', async () => {
		await renderOwnerPage(playlist({ description: '' }));

		const card = screen.getByRole('heading', { name: "Curator's Note" }).closest('div').parentElement;
		expect(within(card).getByRole('button', { name: 'Edit Playlist' })).toBeInTheDocument();
		expect(screen.getByText('Add a description to help viewers understand this program.')).toBeInTheDocument();
	});

	it('offers Edit Playlist beside Delete in the cover card’s mobile actions', async () => {
		const user = userEvent.setup();
		await renderOwnerPage(playlist());

		const coverDetails = screen.getByRole('heading', { level: 2, name: 'Trusted Playlist' }).parentElement;
		const mobileActions = within(coverDetails).getByRole('button', {
			name: 'Delete playlist Trusted Playlist',
		}).parentElement;
		await user.click(within(mobileActions).getByRole('button', { name: 'Edit Playlist' }));

		expect(screen.getByRole('dialog', { name: 'Edit playlist' })).toBeInTheDocument();
	});

	it('shows a renamed title in the header and cover card without a reload', async () => {
		const user = userEvent.setup();
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => playlist({ title: 'Coastal Futures' }),
		});
		await renderOwnerPage(playlist());

		const card = screen.getByRole('heading', { name: "Curator's Note" }).closest('div').parentElement;
		await user.click(within(card).getByRole('button', { name: 'Edit Playlist' }));
		const dialog = screen.getByRole('dialog', { name: 'Edit playlist' });
		await user.clear(within(dialog).getByLabelText('Title'));
		await user.type(within(dialog).getByLabelText('Title'), 'Coastal Futures');
		await user.click(within(dialog).getByRole('button', { name: 'Save' }));

		expect(await screen.findByRole('heading', { level: 1, name: 'Coastal Futures' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Coastal Futures' })).toBeInTheDocument();
		expect(screen.queryByRole('dialog', { name: 'Edit playlist' })).not.toBeInTheDocument();
	});

	it('closes the dialog once a slow save succeeds', async () => {
		const user = userEvent.setup();
		let finishSave;
		apiFetch.mockReturnValue(
			new Promise((resolve) => {
				finishSave = () => resolve({ ok: true, json: async () => playlist({ title: 'Coastal Futures' }) });
			})
		);
		await renderOwnerPage(playlist());

		const card = screen.getByRole('heading', { name: "Curator's Note" }).closest('div').parentElement;
		await user.click(within(card).getByRole('button', { name: 'Edit Playlist' }));
		const dialog = screen.getByRole('dialog', { name: 'Edit playlist' });
		await user.clear(within(dialog).getByLabelText('Title'));
		await user.type(within(dialog).getByLabelText('Title'), 'Coastal Futures');
		await user.click(within(dialog).getByRole('button', { name: 'Save' }));
		await screen.findByRole('heading', { level: 1, name: 'Coastal Futures', hidden: true });
		finishSave();

		await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Edit playlist' }));
	});
});
