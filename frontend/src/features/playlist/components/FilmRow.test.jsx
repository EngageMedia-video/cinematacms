import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilmRow } from './FilmRow';

const previewUrl = '/media/encoded/preview.gif?v=1';

function renderRow(mediaOverrides = {}) {
	const media = {
		friendly_token: 'abc123',
		title: 'Harbour Lights',
		url: '/view?m=abc123',
		thumbnail_url: '/media/thumb.jpg',
		preview_url: previewUrl,
		author_name: 'Curator',
		author_profile: '/members/curator',
		description: 'A night on the docks.',
		views: 3,
		...mediaOverrides,
	};
	return render(
		<ul>
			<FilmRow
				index={0}
				isOwner={false}
				media={media}
				mediaCount={1}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onShare={vi.fn()}
				playlistToken="pl1"
			/>
		</ul>
	);
}

function getPreview(container) {
	return container.querySelector('img[data-film-row-preview]');
}

describe('FilmRow hover preview', () => {
	it('loads the preview only on hover, shows it once loaded and removes it on leave', async () => {
		const user = userEvent.setup();
		const { container } = renderRow();
		const thumbnailLink = screen.getByRole('link', { name: 'Open Harbour Lights' });

		expect(getPreview(container)).toBeNull();

		await user.hover(thumbnailLink);
		const preview = getPreview(container);
		expect(preview).toHaveAttribute('src', previewUrl);
		expect(preview).toHaveAttribute('alt', '');
		expect(preview).toHaveClass('opacity-0');

		fireEvent.load(preview);
		expect(preview).toHaveClass('opacity-100');

		await user.unhover(thumbnailLink);
		expect(getPreview(container)).toBeNull();
	});

	it('plays while keyboard focus is on the film links and stops at the row menu', async () => {
		const user = userEvent.setup();
		const { container } = renderRow();

		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Open Harbour Lights' }));
		expect(getPreview(container)).toHaveAttribute('src', previewUrl);

		await user.tab();
		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Curator' }));
		expect(getPreview(container)).toHaveAttribute('src', previewUrl);

		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More actions for Harbour Lights' }));
		expect(getPreview(container)).toBeNull();
	});

	it('does not play when the pointer is over the synopsis', async () => {
		const user = userEvent.setup();
		const { container } = renderRow();

		await user.hover(screen.getByText('A night on the docks.'));

		expect(getPreview(container)).toBeNull();
	});

	it.each([
		{ name: 'without a preview URL', overrides: { preview_url: '' } },
		{ name: 'without a thumbnail or preview', overrides: { thumbnail_url: '', preview_url: null } },
	])('keeps the static thumbnail $name', async ({ overrides }) => {
		const user = userEvent.setup();
		const { container } = renderRow(overrides);

		await user.hover(screen.getByRole('link', { name: 'Open Harbour Lights' }));

		expect(getPreview(container)).toBeNull();
	});

	it('keeps the static thumbnail after the preview fails to load', async () => {
		const user = userEvent.setup();
		const { container } = renderRow();
		const thumbnailLink = screen.getByRole('link', { name: 'Open Harbour Lights' });

		await user.hover(thumbnailLink);
		fireEvent.error(getPreview(container));
		await user.unhover(thumbnailLink);
		await user.hover(thumbnailLink);

		expect(getPreview(container)).toBeNull();
		expect(thumbnailLink.querySelector('img')).toHaveAttribute('src', '/media/thumb.jpg');
	});
});
