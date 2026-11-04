import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlaylistCreationForm } from './PlaylistCreationForm';

vi.mock('../../../../../static/js/pages/MediaPage/store.js', () => ({
	default: { on: vi.fn(), removeListener: vi.fn() },
}));
vi.mock('../../../../../static/js/pages/MediaPage/actions.js', () => ({ createPlaylist: vi.fn() }));
vi.mock('../../../../../static/js/pages/_PageActions.js', () => ({ addNotification: vi.fn() }));

describe('PlaylistCreationForm', () => {
	it('stops the title at 90 characters, the most a playlist title can hold', async () => {
		const user = userEvent.setup();
		render(<PlaylistCreationForm onCancel={vi.fn()} onPlaylistSave={vi.fn()} />);

		const title = screen.getByPlaceholderText('Enter playlist title...');
		await user.click(title);
		await user.paste('a'.repeat(95));

		expect(title).toHaveValue('a'.repeat(90));
	});
});
